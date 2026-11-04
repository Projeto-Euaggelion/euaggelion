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
| créditos | obra (edição em inglês) + versão da tradução (tradutor/revisor) | — |
| status | obra (`draft`, `active`, `archived`); versão (`in_progress`, `published`, `archived`) | — |

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

O layout atual (`/works/[workId]/[lang]/v/[version]`) usa dados de demonstração
(`apps/luther/src/lib/demo`), que serão trocados pelo Supabase na etapa 2.

## MDX

- **Parse:** `unified` + `remark-mdx` + `remark-frontmatter`.
- **Segmentação por nó de bloco:** parágrafo, título, item de lista, citação e nota de rodapé
  viram segmentos. A formatação inline fica dentro do segmento como markdown.
- **Não traduzíveis:** `import`/`export`, código e atributos de componentes (salvo os marcados como
  traduzíveis no schema) são preservados como estão e nunca vão para a IA.
- **Reconstrução:** a AST original recebe os textos traduzidos e é serializada de volta.
- A saída da IA é validada contra o segmento original: a marcação inline (links, ênfases, notas
  `[^n]`) precisa ser preservada.

Componentes iniciais, compartilhados entre Luther (preview) e site via `packages/mdx`:

| Componente | Uso |
|---|---|
| `<Scripture ref="John 3:16">…</Scripture>` | citação bíblica; `ref` localizado automaticamente |
| `<Quote source="…">…</Quote>` | citação de outro autor |
| `<Note>…</Note>` | nota editorial do Euaggelion |
| Notas de rodapé GFM `[^1]` | notas do autor; cada uma é um segmento |

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

**Regras aplicadas no banco:**
- transições de etapa válidas e o papel exigido para cada uma;
- aprovação bloqueada por thread aberta na tradução;
- texto obrigatório para aprovar;
- segmento aprovado não aceita edição direta;
- versões publicadas ou arquivadas ficam congeladas;
- uma versão publicada e no máximo uma em andamento por tradução;
- o histórico (revisões e `stage_events`) é gravado por trigger;
- notificações de menção, resposta e thread resolvida (o envio por Mailgun lê `emailed_at is null`).

**RPCs** (o app chama via `supabase.rpc`):
- `create_source_version(work_id, mdx, segments jsonb, frontmatter?, notes?)`: o app segmenta o MDX
  e envia os segmentos;
- `create_translation_version(work_id, language, mode 'copy'|'blank', source_version_id?)`;
- `apply_ai_translation(segment_id, text, model, tokens?)`: grava a revisão com origem `ai`;
- `publish_translation_version(version_id, mdx)`: o app reconstrói o MDX e o envia.

**Testes:** `pnpm --filter @euaggelion/db test:db` aplica as migrations num Postgres em memória
(PGlite, com stub de `auth` e dos papéis do Supabase) e verifica RLS e regras. Rode sempre que
alterar o schema. Tipos TypeScript: `pnpm --filter @euaggelion/db gen:types`, com o Supabase
local rodando.

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
                      created_by, published_at
segments              id, translation_version_id, source_segment_id, text, stage, updated_by
segment_revisions     id, segment_id, text, origin, model, tokens, author_id
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
/works, /works/new                         Importar/colar .mdx → pré-visualizar segmentação
/works/[workId]                            Metadados, versões da fonte, traduções por idioma
/works/[workId]/[lang]                     Versões da tradução
/works/[workId]/[lang]/v/[version]         Editor lado a lado (fonte | tradução | comentários)
/works/[workId]/[lang]/v/[version]/review
/works/[workId]/[lang]/v/[version]/preview
/works/[workId]/[lang]/compare?a=&b=       Diff entre versões
/glossary
/admin/users                               Equipe do Luther (memberships, via servidor)
/settings

POST /api/translate                        Segmento(s) → DeepSeek (SSE)
POST /api/works/parse                      MDX → segmentos
GET  /api/translations/[id]/export         Reconstrução do .mdx
```

O CRUD usa Server Actions. Route handlers ficam só para streaming, upload e exportação.

## Roadmap

1. ~~Setup do monorepo + shadcn + UI compartilhada (shell e layout do editor)~~
2. ~~Schema e RLS (migrations + testes); login único, multi-zones e autorização no servidor~~
   (pendente: `/admin/users` para gerenciar a equipe)
3. Parser/segmentador MDX, com testes
4. CRUD de obras + importação (incluindo o acervo de `content/`)
5. Editor + DeepSeek
6. Fluxo de etapas + comentários
7. Versionamento, publicação e exportação
