# Projeto Euaggelion

Documento vivo de arquitetura e decisões. É carregado em toda sessão do Claude Code neste
repositório e deve ser atualizado sempre que uma decisão for tomada ou revista.

## Visão

O Euaggelion é um conjunto de aplicações: site, Luther (tradução/revisão), comentário bíblico,
leitor bíblico, dicionário, cronologia, atlas etc. **Cada app tem seus próprios recursos, mas todos
compartilham a mesma UI** (`packages/ui`). O primeiro app é o **Luther**, para traduzir e revisar
textos de autores clássicos do cristianismo (sermões, artigos e comentários).

## Stack

- **Next.js** (App Router) + **TypeScript**
- **shadcn/ui** + Tailwind CSS v4
- **Supabase**: Postgres, Auth e RLS
- **DeepSeek API** para tradução assistida, chamada **somente no servidor**
- **MDX** como formato de conteúdo, do original à tradução publicada
- **Tiptap (ProseMirror)** no editor de tradução (etapa 5)
- **Mailgun** para e-mails transacionais (notificações)
- **pnpm workspaces** + **Turborepo**

> A versão do Next.js usada aqui tem mudanças incompatíveis com versões anteriores. Consulte
> `apps/luther/AGENTS.md` e `node_modules/next/dist/docs/` antes de escrever código.

## Estrutura do monorepo

```
apps/site        Zona principal (/): site público, /login único, rotas de auth, /sem-acesso
apps/luther      Zona /luther: tradução/revisão (só para a equipe)
apps/…           Demais apps (comentário, leitor, cronologia, atlas…), cada um na sua zona
packages/ui      UI compartilhada: shadcn/ui, tema, tokens e o shell dos apps
packages/auth    Autenticação/autorização (somente servidor): clientes Supabase, proxy, DAL
packages/mdx     Convenções MDX: schema do frontmatter, parser/segmentador, componentes
packages/db      Registro dos apps (ids, caminhos, acesso), tipos gerados do Supabase
packages/importer Conversão do acervo legado (content/) para MDX e importação no Supabase
supabase/        Migrations (Supabase CLI)
content/         Acervo legado de textos-fonte (ver abaixo)
```

## Aplicações, login único e autorização

**Multi-zones (Next.js):** todos os apps são servidos no **mesmo domínio**, cada um no seu
caminho.
- `apps/site` é a zona principal. Ela serve `/`, `/login`, `/auth/callback`, `/auth/signout` e
  `/sem-acesso`, e encaminha os caminhos das outras zonas por `rewrites` (ex.: `/luther/*` →
  `LUTHER_ORIGIN`).
- Cada app roda com `basePath` igual ao seu caminho (ex.: `basePath: "/luther"`). Em dev: site na
  porta 3000 e Luther na 3001; acesse sempre pela 3000.
- Links entre zonas usam `<a>` (navegação "hard"), não `<Link>`.
- Ids, caminhos e regra de acesso de cada app ficam em `@euaggelion/db/apps`
  (`EUAGGELION_APP_CONFIG`), espelhando o enum `public.euaggelion_app`.

**Login único:** uma conta (Supabase Auth) vale para todo o Euaggelion. Como o domínio é um só, o
cookie de sessão também é. O logout (`POST /auth/signout`) encerra a sessão em todos os apps.

**Acesso por app:** `app_memberships` (usuário × app × papel). Uma mesma conta pode ter acesso a
um app e não a outro. Apps `public` são abertos; apps `members` (ex.: Luther) exigem membership
ativa. Os papéis do Luther são `admin`, `translator` e `reviewer`.

**As permissões são conferidas exclusivamente no servidor:**
- `proxy.ts` de cada zona: renova a sessão. No Luther, também exige login (checagem otimista) e
  redireciona para `/login?next=…`.
- DAL em `@euaggelion/auth/access` (`server-only`):
  - `getAccount()`;
  - `getAppRole(app)`;
  - `getAccessibleApps()`;
  - `requireAppAccess(app, { roles })`: sem login vai para `/login`, sem acesso vai para
    `/sem-acesso?app=…`.

  No Luther, use `requireLuther(roles?)` em layouts, páginas, **cada** Server Action e cada
  Route Handler.
- `app_memberships` **não tem grants para `anon`/`authenticated`**: só o servidor a lê, com
  `SUPABASE_SECRET_KEY`.
- Os helpers de papel usados nas policies ficam no schema `private`, fora da API (PostgREST).
- **O client nunca recebe papéis nem regras.** Ele recebe só dados de exibição (nome, e-mail) e a
  lista de apps que pode abrir. Quando a UI precisa de algo como "pode aprovar", o servidor
  calcula um booleano e revalida na ação.
- Com Cache Components, a leitura da sessão fica dentro de `<Suspense>`, e
  `createSupabaseServerClient()` chama `connection()`.
- O parâmetro `next` do login passa por `safeNextPath` (só caminhos do próprio domínio; evita open
  redirect).

## UI compartilhada (`packages/ui`)

- **shadcn/ui** (estilo `radix-nova`) fica em `packages/ui/src/components`. Para adicionar um
  componente, rode o CLI **dentro de `packages/ui`**: `pnpm dlx shadcn@latest add <nome>`.
  Nos apps, importe de `@euaggelion/ui/components/<nome>`.
- **Tema** em `packages/ui/src/styles/globals.css`. Cada app só faz
  `@import "@euaggelion/ui/globals.css"`.
  - Cor principal do Euaggelion: **`#d12026`** (`--brand`, `oklch(0.553 0.209 26.33)`), usada como
    `primary`, `ring` e `sidebar-primary`.
  - **O modo escuro é o padrão** (`next-themes`, `defaultTheme="dark"`). O modo claro continua
    disponível pelo menu do usuário.
  - Fonte: Inter.
- **Shell** (`@euaggelion/ui/shell/*`), igual em todos os apps:
  - **Trilho externo**: seletor das aplicações do Euaggelion (`shell/apps.ts`: nome, ícone,
    caminho). Mostra apenas os apps recebidos em `apps`, uma lista calculada no servidor por
    `getAccessibleApps()`. Apps com `status: "soon"` aparecem desabilitados.
  - **Sidebar interna**: navegação e funções do app aberto. Cada app fornece a sua (ex.:
    `apps/luther/src/components/luther-sidebar.tsx`).
  - `AppShell` (`currentApp`, `sidebar`, `user` = { name, email }, `apps`) compõe os dois níveis. `AppHeader` é o cabeçalho
    padrão da área de conteúdo. `NavUser` é o menu do usuário (perfil, notificações, tema, sair → `/auth/signout`).

### `content/` (acervo legado)

Contém textos raspados de fontes públicas: sermões (ex.: Spurgeon), o comentário de Kretzmann,
verbetes de dicionário e algumas traduções pt-BR. São arquivos `.md` em texto bruto, com quebras
de linha fixas e cabeçalhos informais. **Não é MDX válido nem segue o schema abaixo.** Serve de
material de importação para o Luther: a importação normaliza cada texto para MDX e cria a obra no
Supabase. A fonte da verdade passa a ser o Supabase.

**Importação (`packages/importer`)**, em duas fases:
1. `pnpm import:convert [--author <pasta>] [--limit N]` converte `content/sermons/en-US/<pasta>/*.md`
   para `content/mdx/sermons/<autor>/<slug>.mdx` e grava `report.json`.
   - Faz: cabeçalho → frontmatter (título, fonte, data, copyright → `credits`); remove o bloco de
     autoria; desfaz as quebras de linha; remove ênfases desbalanceadas; escapa `{ } <`.
   - É heurística. **Revise os arquivos no git antes de aplicar**; o relatório lista avisos
     (sem data, HTML bruto, aviso de copyright).
2. `pnpm import:apply [--author <slug>] [--dry-run]` cria autores e obras (rascunho) via
   `create_work`.
   - Usa `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SECRET_KEY` do `.env` da raiz.
   - É idempotente: pula obras cujo autor+slug já existe.
- Autores do acervo e o tipo padrão por autor ficam em `src/authors.ts` e `src/cli.ts`.
- Ainda não converte o comentário de Kretzmann, o dicionário nem as traduções pt-BR existentes.
- ~50 sermões de Spurgeon trazem aviso de copyright de edição moderna (Tony Capoccia, 2000):
  confirme os direitos antes de publicar.

## Modelo de domínio

```
Autor
 └─ Obra (EN, sempre)            tipo: sermon | article | commentary
     ├─ Versões da fonte         v1, v2... (correções no original; cada versão é imutável)
     └─ Tradução                 no máximo UMA por idioma (UNIQUE work_id + language)
         └─ Versões da tradução  retraduzir cria uma nova versão, não uma nova tradução
             └─ Segmentos        cada um passa pelo fluxo editorial
                  ├─ Revisões    histórico (origem: ai | human)
                  └─ Comentários threads de discussão
```

- O idioma de origem é sempre o **inglês**. O par principal é EN → pt-BR, mas o modelo aceita
  *n* idiomas de destino.
- **Uma única versão publicada por tradução**. Publicar uma nova versão arquiva a anterior.
- Uma nova versão pode **copiar a anterior** (os segmentos voltam para `review`) ou **começar do
  zero** (os segmentos ficam em `original`).
- Cada versão da tradução registra a versão da fonte em que se baseia. Se a fonte mudar, a
  tradução é marcada como **desatualizada**.

### Metadados da obra

| Campo | Local | Traduzível |
|---|---|---|
| autor | `authors` | não |
| tipo | obra | rótulo localizado |
| título, descrição | obra + versão da tradução (segmentos `title` / `description`) | sim |
| data | obra, precisão variável (`1857`, `1857-03`, `1857-03-15`) | não |
| fonte | obra | não |
| créditos | obra (edição em inglês) + versão da tradução (`credits`, texto livre) | — |
| colaboradores | versão da tradução: tradutores e revisores, derivados do histórico (ver abaixo) | — |
| status | obra (`draft`, `active`, `archived`); versão (`in_progress`, `published`, `archived`) | — |

### Colaboradores da versão

Quem traduziu e revisou faz parte dos metadados da versão publicada. A lista é **derivada do que
cada pessoa fez**, não do papel da conta:
- **tradutor**: editou o texto (à mão ou aplicando sugestão da IA) com o segmento em `original` ou
  `translation`;
- **revisor**: editou o texto em `review`/`discussion`/`approved`, ou fez uma transição reservada a
  revisores (aprovar, devolver, fechar discussão, reabrir);
- texto copiado da versão anterior (modo `copy`) mantém o crédito dos tradutores de origem.
  Hoje isso vale para todos os tradutores da versão anterior, mesmo os de segmentos que mudaram;
  as revisões antigas não contam, porque a nova versão é revisada de novo.

Fontes: `segment_revisions` (com a etapa no momento da edição) e `stage_events`. Em andamento, a
lista vem de `version_contributors(version_id)`. Na publicação, `publish_translation_version` a
congela em `translation_versions.contributors` (`[{ name, roles }]`, sem ids), e o site a lê em
`published_translations.contributors`. Na etapa 7, o MDX publicado leva a mesma lista no
frontmatter (`translation.contributors`). `translator_id`/`reviewer_id` ficam como responsáveis
designados (opcionais), e `credits` como texto livre adicional.

## Fluxo editorial (por segmento)

```
original ─► translation ─► review ─► approved
                ▲            │  ▲
                └── discussion ◄┘
```

| Etapa | Significado | Quem move |
|---|---|---|
| `original` | ainda não traduzido | — |
| `translation` | rascunho (IA ou humano) | tradutor |
| `review` | aguardando revisão | tradutor envia, revisor atua |
| `discussion` | dúvida aberta com thread de comentários | qualquer um abre, revisor fecha |
| `approved` | final | revisor/admin |

O status da versão é derivado dos segmentos. Toda transição fica registrada em `stage_events`.

**Regras de conclusão:**
- Um segmento **não pode ser aprovado** enquanto houver thread aberta **na tradução** desse
  segmento.
- A tradução (versão) **só pode ser concluída/publicada** com todos os segmentos `approved` e
  **nenhuma** thread aberta na tradução.
- Threads **não alteram a etapa** do segmento. `discussion` é marcada explicitamente.
- Threads **no original (EN)** são permitidas e **não criam pendências**.

## Editor e comentários

- **Duas colunas por segmento**: original (EN) à esquerda, em tom mais discreto e imutável;
  tradução à direita, editável. Cada segmento mostra a etapa (indicador na margem e menu
  "Mover para") e a ação "Aprovar".
- **Barra de seleção**: ao selecionar um trecho aparece a barra flutuante. **Comentário** é a ação
  principal (vale nos dois lados). Na tradução, a barra também mostra a formatação que o MDX
  representa: negrito, itálico, link, nota de rodapé e `<Scripture>`. Não há fonte, cor,
  sublinhado nem alinhamento.
- **Threads ancoradas em trechos**: a seleção fica restrita a um segmento. A âncora guarda o
  trecho citado + prefixo/sufixo + offsets, para ser recalculada após edições. Se o trecho deixar
  de existir, a thread fica "desancorada" mas continua visível no segmento.
- **Painel lateral** com três abas:
  - Comentários: abertas, resolvidas ou todas; responder, @menções, resolver/reabrir.
  - IA: sugestões do DeepSeek, com "Outra sugestão", "Ver diferenças" e "Substituir".
  - Histórico do segmento.
- **Notificações** de @menções e respostas: no app (sino) e por **e-mail via Mailgun**.

O editor (`/works/[workId]/[lang]/v/[version]`) ainda usa dados de demonstração
(`apps/luther/src/lib/demo`); passa a ler o Supabase na etapa 5.

## MDX

Implementado em `packages/mdx` (testes: `pnpm --filter @euaggelion/mdx test`). Use
`@euaggelion/mdx` no servidor; em Client Components, importe só `@euaggelion/mdx/schema`
(constantes e tipos, sem o parser).

- **Parse** (`parseMdx`): `unified` + `remark-parse` + `remark-mdx` + `remark-gfm` +
  `remark-frontmatter`.
  - CRLF e BOM são normalizados; `source` é o texto a gravar em `source_versions.mdx`.
  - Erro de sintaxe lança `MdxSyntaxError` (com linha e coluna).
- **Frontmatter** validado por `frontmatterSchema` (zod): `title`, `author`, `type` (obrigatórios),
  `description`, `date` (`AAAA`, `AAAA-MM` ou `AAAA-MM-DD`; `datePrecision()` deriva a precisão),
  `source`, `credits`, `slug`. Problemas vêm em `frontmatterIssues` e não impedem a segmentação.
- **Segmentação** por bloco folha, na ordem do documento:
  - `title` e `description` do frontmatter;
  - `heading`; `paragraph` (inclui células de tabela);
  - `list_item` (cada parágrafo de um item);
  - `quote` (blockquote, `<Quote>`, `<Scripture>` em bloco);
  - `footnote` (cada parágrafo da definição `[^n]:`);
  - `attribute` (atributos traduzíveis de componentes).

  O texto do segmento é o MDX do conteúdo, com a formatação inline e sem marcadores de bloco
  (`>`, `-`, recuo). `ast_path` é a chave estável do segmento: índices dos nós (`"4.0"`),
  `"<caminho>@<atributo>"` ou `"frontmatter.title"`.
- **Não traduzíveis:** `import`/`export`, código, expressões `{…}`, imagens sem texto e atributos
  não marcados como traduzíveis. Ficam fora dos segmentos e nunca vão para a IA.
- **Reconstrução** (`reconstructMdx(original, { [ast_path]: texto }, { allowMissing?, frontmatter? })`):
  - substitui só o intervalo de cada segmento no texto original, reaplicando os marcadores nas
    linhas de continuação; tudo o mais é preservado byte a byte;
  - sem mudanças, a saída é idêntica ao original;
  - o frontmatter é editado no YAML, e `frontmatter` acrescenta campos (ex.: `language`);
  - erros: lança `ReconstructError` para `ast_path` desconhecido, segmento faltando (salvo
    `allowMissing`, usado na pré-visualização) ou estrutura alterada.
- **Validação** (`validateTranslation(original, tradução, kind)`): confere MDX válido, a mesma
  estrutura de bloco e a mesma marcação inline (links, notas `[^n]`, código, expressões, componentes
  com os atributos não traduzíveis, ênfases). Use-a na saída da IA e ao salvar edições.

Componentes iniciais, compartilhados entre Luther (preview) e site via `packages/mdx`:

| Componente | Uso |
|---|---|
| `<Scripture ref="John 3:16">…</Scripture>` | citação bíblica; `ref` localizado automaticamente |
| `<Quote source="…">…</Quote>` | citação de outro autor |
| `<Note>…</Note>` | nota editorial do Euaggelion |
| Notas de rodapé GFM `[^1]` | notas do autor; cada uma é um segmento |

O registro fica em `MDX_COMPONENTS` (`schema.ts`): o `kind` dos segmentos internos e os
atributos traduzíveis (hoje, `source` de `<Quote>`). Os componentes React ficam para a
pré-visualização (etapa 7).

## Supabase

- **Auth:** e-mail/senha ou magic link (`shouldCreateUser: false`). **Não há cadastro público**:
  as contas são criadas manualmente (painel do Supabase ou `auth.admin.inviteUserByEmail` no
  servidor). O convite pode trazer `app_metadata.apps`, por exemplo
  `{ "luther": "translator" }`.
- **Perfil global** (`profiles`) + **acesso por app** (`app_memberships`, ver "Aplicações, login
  único e autorização").
- **RLS em todas as tabelas.** As permissões do fluxo editorial são aplicadas no banco, não só na
  UI.
- O site lê versões publicadas pela view `published_translations` (leitura anônima, só colunas
  públicas; tabelas internas sem grant para `anon`).
- `supabase/config.toml` (CLI) já vem com `enable_signup = false`.
- Primeiro admin do Luther (SQL editor), depois de criar a conta:
  `insert into public.app_memberships (user_id, app, role) select id, 'luther', 'admin' from public.profiles where email = '...';`
  Depois disso, a equipe é gerenciada em `/luther/admin/users`.
- **E-mail de convite** (painel do Supabase → Authentication → Emails → *Invite user*): o link
  precisa passar pelo callback do servidor, que usa `token_hash` (o link padrão traz os tokens no
  `#fragmento`, que o servidor não lê). Use
  `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next=/luther` e inclua
  `EUAGGELION_URL/auth/callback` nas *Redirect URLs*. (O link mágico do `/login` não precisa
  disso: ele sai do cliente SSR com PKCE e volta com `?code=`.)
  O convidado entra pelo link e, nas próximas vezes, usa o link mágico do `/login` (ainda não há
  tela para definir senha).

### Migrations (`supabase/migrations`)

| Arquivo | Conteúdo |
|---|---|
| `…120000_types_and_helpers` | enums e `set_updated_at` |
| `…120100_profiles_and_auth` | `profiles`, `app_memberships`, trigger de `auth.users`, `private.luther_has_role` / `is_luther_admin` / `is_luther_member` |
| `…120200_content` | `authors`, `works`, `source_versions` / `source_segments` (imutáveis) |
| `…120300_translations` | `translations`, `translation_versions`, `segments`, `segment_revisions`, `stage_events` |
| `…120400_comments_and_notifications` | `comment_threads`, `comments`, `notifications` |
| `…120500_glossary` | `glossary_terms` |
| `…120600_workflow` | regras do fluxo editorial (triggers), RPCs e `translation_version_overview` |
| `…120700_public_site` | acesso anônimo ao que foi publicado + view `published_translations` |
| `…120800_segment_kind_attribute` | `segment_kind` ganha `attribute` (atributos traduzíveis) |
| `…120900_works_management` | `create_work` (obra + v1 do original, atômico); nova versão do original sincroniza título/descrição da obra |
| `…121000_version_contributors` | etapa em `segment_revisions`; `version_contributors()`; colaboradores congelados na publicação e expostos ao site |
| `…121100_luther_admin_guard` | trigger: o Luther nunca fica sem admin ativo (rebaixar/desativar/remover o último é recusado) |

**Regras aplicadas no banco:**
- transições de etapa válidas e o papel exigido para cada uma;
- aprovação bloqueada por thread aberta na tradução;
- texto obrigatório para aprovar;
- segmento aprovado não aceita edição direta;
- versões publicadas ou arquivadas ficam congeladas;
- uma versão publicada e no máximo uma em andamento por tradução;
- o Luther sempre tem ao menos um admin ativo;
- o histórico (revisões e `stage_events`) é gravado por trigger;
- notificações de menção, resposta e thread resolvida (o envio por Mailgun lê `emailed_at is null`).

**RPCs** (o app chama via `supabase.rpc`):
- `create_work(author_id, type, slug, mdx, segments, frontmatter, date_text?, date_precision?, source?, credits?)`:
  cria a obra (rascunho) e a v1 do original numa transação;
- `create_source_version(work_id, mdx, segments jsonb, frontmatter?, notes?)`: o app segmenta o MDX
  e envia os segmentos;
- `create_translation_version(work_id, language, mode 'copy'|'blank', source_version_id?)`;
- `apply_ai_translation(segment_id, text, model, tokens?)`: grava a revisão com origem `ai`;
- `version_contributors(version_id)`: tradutores e revisores da versão (nome, papéis, contagens);
- `publish_translation_version(version_id, mdx)`: o app reconstrói o MDX e o envia; congela os
  colaboradores.

**Testes:** `pnpm --filter @euaggelion/db test:db` aplica as migrations num Postgres em memória
(PGlite, com stub de `auth` e dos papéis do Supabase) e verifica RLS e regras. Rode sempre que
alterar o schema. Tipos TypeScript (`packages/db/src/database.types.ts`, importados de
`@euaggelion/db/types`): `pnpm --filter @euaggelion/db gen:types`, com o Supabase local rodando.
Regere sempre que mudar o schema. Os clientes de `@euaggelion/auth/server` já são tipados.

### Schema

```
profiles              id (=auth.users.id), name, email
app_memberships       user_id, app (euaggelion_app), role, active, granted_by   PK(user_id, app)
authors               id, name, slug, bio, era
works                 id, author_id, type, slug, date_text, date_precision, source, credits, status
source_versions       id, work_id, version, mdx, frontmatter
source_segments       id, source_version_id, position, kind, text, ast_path
translations          id, work_id, language, published_version_id   UNIQUE(work_id, language)
translation_versions  id, translation_id, version, source_version_id, based_on_version_id,
                      status, credits, translator_id, reviewer_id, mdx (publicado),
                      contributors (congelado na publicação), created_by, published_at
segments              id, translation_version_id, source_segment_id, text, stage, updated_by
segment_revisions     id, segment_id, text, origin, model, tokens, author_id, stage
comment_threads       id, translation_version_id, segment_id, side (source|target), quote,
                      prefix, suffix, start_offset, end_offset, detached, status (open|resolved),
                      created_by, resolved_by, resolved_at
comments              id, thread_id, author_id, body, mentions[], created_at, edited_at
notifications         id, user_id, kind (mention|reply|thread_resolved), actor_id, thread_id,
                      comment_id, read_at, emailed_at
glossary_terms        id, language, source_term, target_term, notes
stage_events          id, segment_id, from_stage, to_stage, actor_id
```

## Rotas do Luther

Os caminhos abaixo são relativos ao `basePath` `/luther`. O `/login` é o da zona principal.

```
/                                          Dashboard: minhas tarefas
/authors, /authors/[slug]
/works, /works/new                         Lista (busca, filtros, paginação) · importar .mdx com pré-visualização
/works/[workId]                            Metadados, traduções por idioma (progresso), versões do original
/works/[workId]/source/new                 Nova versão do original (admin)
/works/[workId]/source/[version]           Segmentos e MDX de uma versão do original
/works/[workId]/[lang]                     Versões da tradução
/works/[workId]/[lang]/v/[version]         Editor lado a lado (fonte | tradução | comentários)
/works/[workId]/[lang]/v/[version]/review
/works/[workId]/[lang]/v/[version]/preview
/works/[workId]/[lang]/compare?a=&b=       Diff entre versões
/glossary
/admin/users                               Equipe do Luther (só admin; 404 para os demais)
/settings

POST /api/translate                        Segmento(s) → DeepSeek (SSE)
GET  /api/translations/[id]/export         Reconstrução do .mdx
```

O CRUD usa Server Actions. Route handlers ficam só para streaming, upload e exportação.

Convenções do app (etapa 4):
- **Leituras** em `src/lib/data/*` (`server-only`), com o cliente da sessão: a RLS se aplica.
  - O PostgREST devolve no máximo 1000 linhas: listas grandes paginam com `.range()`.
- **Server Actions** em `actions.ts` de cada rota.
  - Cada uma chama `requireLuther(roles)` e valida a entrada com zod.
  - Devolvem `ActionState` (`error`, `fieldErrors`, `success`); erros do Postgres passam por
    `databaseErrorMessage`.
- A visibilidade de botões usa `getLutherPermissions()`, que dá booleanos calculados no servidor
  (`canManageCatalog`, `canStartTranslation`, `canManageTeam`).
- **Formulários** usam `useFormAction` (`src/lib/use-form-action.ts`), não `<form action>`
  direto: o React 19 limparia os campos quando o servidor recusa os dados.
- **Páginas:** o shell é estático e os dados ficam num componente async dentro de `<Suspense>`.
  - Ids da URL passam por `isUuid` antes de ir ao banco.
  - Links internos usam `next/link` (respeitam o basePath); `BreadcrumbLink` vai com `asChild`.

**Equipe (`/admin/users`):**
- A leitura (`src/lib/data/team.ts`) e as ações usam `createSupabaseAdminClient()` porque
  `app_memberships` não é exposta à API; por isso a página confere `role === "admin"` (senão
  `notFound()`) e cada ação chama `requireLuther(["admin"])` antes de tocar no banco.
- **Convidar:** se o e-mail já tem conta no Euaggelion, só cria/reativa a membership; senão,
  `auth.admin.inviteUserByEmail` (com `name` no `user_metadata` e retorno para `/luther`) e a
  membership com `granted_by`.
- **Editar** nome e papel; **desativar/reativar** (`active`, sem apagar histórico nem créditos);
  **reenviar convite** para quem foi convidado e nunca entrou (`invited_at` sem `last_sign_in_at`).
- Ninguém muda o próprio papel nem desativa a própria conta (checado na ação); o banco garante o
  último admin.

## Roadmap

1. ~~Setup do monorepo + shadcn + UI compartilhada (shell e layout do editor)~~
2. ~~Schema e RLS (migrations + testes); login único, multi-zones e autorização no servidor;
   `/admin/users` (equipe)~~
3. ~~Parser/segmentador MDX, com testes~~
4. ~~CRUD de obras + importação (incluindo o acervo de `content/`)~~
5. Editor + DeepSeek
6. Fluxo de etapas + comentários
7. Versionamento, publicação e exportação

## graphify (grafo de conhecimento do código)

O [graphify](https://github.com/safishamsi/graphify) indexa o código (TS/TSX, SQL das migrations,
configs) num grafo consultável em `graphify-out/`. O grafo é feito localmente com tree-sitter,
sem LLM e sem chave de API.

- **Instalação (uma vez por máquina):** `uv tool install "graphifyy[sql]"` (ou `pipx install
  "graphifyy[sql]"`; o pacote PyPI tem dois "y"; o extra `sql` indexa as migrations).
- **Gerar/atualizar o grafo:** `pnpm graph` (= `graphify update .`, segundos). `graphify-out/` não
  vai para o git; cada um gera o seu. Opcional: `graphify hook install` atualiza após commit/checkout.
- **Fora do grafo** (`.graphifyignore`): `content/` (acervo, texto e não código) e artefatos gerados.
- Projeto: skill em `.claude/skills/graphify/` (`/graphify`) e hooks `PreToolUse` em
  `.claude/settings.json` que lembram de consultar o grafo antes de buscas e leituras (só aviso,
  sem bloqueio). Sem o `graphify` instalado, os hooks dão erro não bloqueante.

Regras:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- O grafo casa termos com nomes de símbolos e arquivos (em inglês): pergunte com identificadores (`version_contributors`, `getVersionContributors`), não com frases em português.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `pnpm graph` (`graphify update .`) to keep the graph current (AST-only, no API cost).
