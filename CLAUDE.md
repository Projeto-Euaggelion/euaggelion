# Projeto Euaggelion

Documento vivo de arquitetura e decisões. É carregado em toda sessão do Claude Code neste
repositório e deve ser atualizado sempre que uma decisão for tomada ou revista.

## Visão

O Euaggelion é um projeto que vai crescer em várias frentes. A primeira é o **Luther**, um webapp
de tradução e revisão de textos de autores clássicos do cristianismo (sermões, artigos e
comentários). O site público (`apps/site`) será construído depois, sobre esta mesma arquitetura.

## Stack

- **Next.js** (App Router) + **TypeScript**
- **shadcn/ui** + Tailwind CSS v4
- **Supabase**: Postgres, Auth e RLS
- **DeepSeek API** para tradução assistida, chamada **somente no servidor**
- **MDX** como formato de conteúdo, do original à tradução publicada
- **pnpm workspaces** + **Turborepo**

> A versão do Next.js usada aqui tem mudanças incompatíveis com versões anteriores. Consulte
> `apps/luther/AGENTS.md` e `node_modules/next/dist/docs/` antes de escrever código.

## Estrutura do monorepo

```
apps/luther      Webapp de tradução/revisão (interno, autenticado)
apps/site        Site público (futuro): lê apenas versões publicadas
packages/mdx     Convenções MDX: schema do frontmatter, parser/segmentador, componentes
packages/db      Tipos gerados do Supabase + queries compartilhadas
supabase/        Migrations (Supabase CLI)
content/         Acervo legado de textos-fonte (ver abaixo)
```

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

O status da versão é derivado dos segmentos. Para publicar, todos os segmentos precisam estar
`approved`. Toda transição fica registrada em `stage_events`.

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

- **Auth:** e-mail/senha ou magic link. **Não há cadastro público**: colaboradores são criados
  manualmente (painel do Supabase ou `/admin/users`, via `auth.admin.inviteUserByEmail` no
  servidor).
- **Papéis** (`profiles.role`): `admin`, `translator`, `reviewer`.
- **RLS em todas as tabelas.** As permissões do fluxo editorial são aplicadas no banco, não só na
  UI.
- O site lê versões publicadas por uma view pública, com leitura anônima.

### Schema (alvo)

```
profiles              id (=auth.users.id), name, role
authors               id, name, slug, bio, era
works                 id, author_id, type, slug, date_text, date_precision, source, credits, status
source_versions       id, work_id, version, mdx, frontmatter
source_segments       id, source_version_id, position, kind, text, ast_path
translations          id, work_id, language, published_version_id   UNIQUE(work_id, language)
translation_versions  id, translation_id, version, source_version_id, based_on_version_id,
                      status, credits, created_by, published_at
segments              id, translation_version_id, source_segment_id, text, stage, updated_by
segment_revisions     id, segment_id, text, origin, model, tokens, author_id
comments              id, segment_id, parent_id, author_id, body, resolved
glossary_terms        id, language, source_term, target_term, notes
stage_events          id, segment_id, from_stage, to_stage, actor_id
```

## Rotas do Luther

```
/login
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
/admin/users
/settings

POST /api/translate                        Segmento(s) → DeepSeek (SSE)
POST /api/works/parse                      MDX → segmentos
GET  /api/translations/[id]/export         Reconstrução do .mdx
```

O CRUD usa Server Actions. Route handlers ficam só para streaming, upload e exportação.

## Roadmap

1. ~~Setup do monorepo~~ (parcial: falta concluir a configuração do shadcn)
2. Schema, RLS e Auth
3. Parser/segmentador MDX, com testes
4. CRUD de obras + importação (incluindo o acervo de `content/`)
5. Editor + DeepSeek
6. Fluxo de etapas + comentários
7. Versionamento, publicação e exportação
