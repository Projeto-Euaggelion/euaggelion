// Aplica as migrations num Postgres em memória (PGlite) com stub do Supabase
// (schema auth, papéis anon/authenticated) e testa RLS e regras do fluxo editorial.
// Uso: pnpm --filter @euaggelion/db test:db
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import path from 'node:path'

const dir = process.argv[2] ?? new URL('../../../supabase/migrations', import.meta.url).pathname
const db = new PGlite()
let pass = 0, fail = 0
const ok = (name) => { pass++; console.log('  ✓', name) }
const bad = (name, e) => { fail++; console.log('  ✗', name, '→', e) }

// --- Stub do ambiente Supabase -------------------------------------------------
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`)

for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  try { await db.exec(fs.readFileSync(path.join(dir, f), 'utf8')); console.log('migrated', f) }
  catch (e) { console.log('FAILED', f, e.message); process.exit(1) }
}

// --- Helpers -------------------------------------------------------------------
const U = { admin: '00000000-0000-0000-0000-00000000000a', tr: '00000000-0000-0000-0000-00000000000b', rev: '00000000-0000-0000-0000-00000000000c', reader: '00000000-0000-0000-0000-00000000000d' }
async function as(who, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  if (who === 'anon') await db.exec(`set role anon;`)
  else if (who !== 'service') await db.exec(`select set_config('request.jwt.claim.sub', '${U[who]}', false); set role authenticated;`)
  try { if (!params && sql.trim().replace(/;$/, '').includes(';')) { const rs = await db.exec(sql); return rs[rs.length - 1] } return await db.query(sql, params) } finally { await db.exec('reset role;') }
}
async function expectOk(name, who, sql, params) { try { const r = await as(who, sql, params); ok(name); return r } catch (e) { bad(name, e.message) } }
async function expectErr(name, who, sql, match, params) {
  try { await as(who, sql, params); bad(name, 'esperava erro') }
  catch (e) { (!match || e.message.includes(match)) ? ok(`${name} (${e.message.slice(0, 70)})`) : bad(name, e.message) }
}

// --- Usuários (trigger handle_new_user) ----------------------------------------
console.log('\nContas e acesso por app')
await db.query(`insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ($1, 'admin@x.org', '{"name":"Admin"}', '{"apps":{"luther":"admin"}}'),
  ($2, 'tr@x.org', '{"name":"Tradutor"}', '{"apps":{"luther":"translator"}}'),
  ($3, 'rev@x.org', '{}', '{"apps":{"luther":"reviewer","atlas":"viewer"}}'),
  ($4, 'leitor@x.org', '{"name":"Leitor"}', '{}')`, [U.admin, U.tr, U.rev, U.reader])
const profiles = (await db.query(`select email, name from public.profiles order by email`)).rows
profiles.length === 4 && profiles.find(r => r.email === 'rev@x.org').name === 'rev' ? ok('perfil global criado para todo usuário') : bad('perfis', JSON.stringify(profiles))
const mem = (await db.query(`select p.email, m.app, m.role from public.app_memberships m join public.profiles p on p.id = m.user_id order by 1, 2`)).rows
mem.length === 4 && mem.some(m => m.email === 'rev@x.org' && m.app === 'atlas') && !mem.some(m => m.email === 'leitor@x.org')
  ? ok('memberships por app vindas do convite (leitor sem acesso ao Luther)') : bad('memberships', JSON.stringify(mem))
await expectErr('papel inválido no Luther é recusado', 'service', `insert into public.app_memberships (user_id, app, role) values ('${U.reader}', 'luther', 'owner')`, 'app_memberships_luther_role')
await expectErr('client não lê memberships (nem as próprias)', 'tr', `select * from public.app_memberships`, 'permission denied')
await expectErr('client não se concede acesso', 'reader', `insert into public.app_memberships (user_id, app, role) values ('${U.reader}', 'luther', 'admin')`, 'permission denied')
await expectErr('helpers de papel ficam fora da API (schema private)', 'tr', `select public.is_luther_member()`, 'does not exist')
await expectOk('tradutor edita o próprio nome', 'tr', `update public.profiles set name='Davi' where id='${U.tr}'`)
const readerProfiles = await as('reader', `select count(*)::int as n from public.profiles`)
readerProfiles.rows[0].n === 1 ? ok('usuário fora do Luther só vê o próprio perfil') : bad('perfis do leitor', readerProfiles.rows[0].n)
await expectErr('anon não lê perfis', 'anon', `select * from public.profiles`, 'permission denied')

// --- Conteúdo ------------------------------------------------------------------
console.log('\nConteúdo')
await expectErr('tradutor não cria autor', 'tr', `insert into public.authors (name, slug) values ('X','x')`, 'row-level security')
const author = (await expectOk('admin cria autor', 'admin', `insert into public.authors (name, slug) values ('C. H. Spurgeon','c-h-spurgeon') returning id`)).rows[0].id
await expectErr('data incoerente com a precisão', 'admin', `insert into public.works (author_id, type, slug, title, date_text, date_precision) values ('${author}','sermon','x','X','1855-01','year')`, 'works_date_matches_precision')
const work = (await expectOk('admin cria obra', 'admin', `insert into public.works (author_id, type, slug, title, date_text, date_precision, status) values ('${author}','sermon','the-immutability-of-god','The Immutability of God','1855-01-07','day','active') returning id`)).rows[0].id
const readerWorks = await as('reader', `select count(*)::int as n from public.works`)
readerWorks.rows[0].n === 0 ? ok('usuário sem acesso ao Luther não vê obras em andamento') : bad('obras do leitor', readerWorks.rows[0].n)
await expectErr('usuário sem acesso ao Luther não cria versão', 'reader', `select public.create_translation_version('${work}', 'pt-BR')`, 'revisores')
const segs = JSON.stringify([
  { position: 0, kind: 'title', text: 'The Immutability of God', ast_path: '0' },
  { position: 1, kind: 'paragraph', text: 'It has been said by some one...', ast_path: '1' },
  { position: 2, kind: 'quote', text: 'Great God, how infinite art thou', ast_path: '2' },
])
await expectErr('tradutor não cria versão do original', 'tr', `select public.create_source_version('${work}', '# x', '${segs}'::jsonb)`, 'administradores')
const sv1 = (await expectOk('admin cria versão 1 do original', 'admin', `select public.create_source_version('${work}', '# mdx', '${segs}'::jsonb) as id`)).rows[0].id
await expectErr('versão do original é imutável', 'service', `update public.source_versions set mdx='y' where id='${sv1}'`, 'imutável')

// --- Traduções -----------------------------------------------------------------
console.log('\nTraduções')
await expectErr('idioma en recusado', 'admin', `select public.create_translation_version('${work}', 'en-US')`, 'translations_language_check')
await expectErr('tradutor não cria versão de tradução', 'tr', `select public.create_translation_version('${work}', 'pt-BR')`, 'revisores')
const v1 = (await expectOk('revisor cria v1 pt-BR', 'rev', `select public.create_translation_version('${work}', 'pt-BR') as id`)).rows[0].id
await expectErr('só uma versão em andamento', 'admin', `select public.create_translation_version('${work}', 'pt-BR')`, 'em andamento')
const S = Object.fromEntries((await db.query(`select s.id, ss.position from public.segments s join public.source_segments ss on ss.id = s.source_segment_id where s.translation_version_id = $1`, [v1])).rows.map(r => [r.position, r.id]))

console.log('\nFluxo editorial')
await expectErr('original → approved é inválido', 'admin', `update public.segments set stage='approved' where id='${S[1]}'`, 'inválida')
const r1 = await expectOk('tradutor escreve texto (vai para translation)', 'tr', `update public.segments set text='Já se disse que...' where id='${S[1]}' returning stage`)
r1?.rows[0].stage === 'translation' ? ok('etapa automática original → translation') : bad('etapa automática', r1?.rows[0]?.stage)
await expectOk('IA traduz o título', 'tr', `select stage from public.apply_ai_translation('${S[0]}', 'A Imutabilidade de Deus', 'deepseek-chat', 42)`)
const rev = (await db.query(`select origin, model, tokens from public.segment_revisions where segment_id=$1`, [S[0]])).rows[0]
rev?.origin === 'ai' && rev.model === 'deepseek-chat' && rev.tokens === 42 ? ok('revisão registra origem IA, modelo e tokens') : bad('revisão IA', JSON.stringify(rev))
const hrev = (await db.query(`select origin, author_id from public.segment_revisions where segment_id=$1`, [S[1]])).rows[0]
hrev?.origin === 'human' && hrev.author_id === U.tr ? ok('revisão humana com autor') : bad('revisão humana', JSON.stringify(hrev))
await expectOk('tradutor envia para revisão', 'tr', `update public.segments set stage='review' where id in ('${S[0]}','${S[1]}')`)
await expectErr('tradutor não aprova', 'tr', `update public.segments set stage='approved' where id='${S[1]}'`, 'papel não permite')

// Threads
const t1 = (await expectOk('tradutor abre thread na tradução', 'tr', `insert into public.comment_threads (translation_version_id, segment_id, side, quote, start_offset, end_offset, created_by) values ('${v1}','${S[1]}','target','disse',3,8,'${U.tr}') returning id`)).rows[0].id
await expectOk('revisor abre thread no original', 'rev', `insert into public.comment_threads (translation_version_id, segment_id, side, quote, start_offset, end_offset, created_by) values ('${v1}','${S[0]}','source','Immutability',4,16,'${U.rev}') returning id`)
await expectErr('thread com segmento de outra versão é recusada (FK composta)', 'tr', `insert into public.comment_threads (translation_version_id, segment_id, side, quote, start_offset, end_offset, created_by) values (gen_random_uuid(),'${S[1]}','target','x',0,1,'${U.tr}')`)
await expectErr('thread aberta na tradução bloqueia aprovação', 'rev', `update public.segments set stage='approved' where id='${S[1]}'`, 'threads abertas')
await expectOk('thread no original não bloqueia aprovação', 'rev', `update public.segments set stage='approved' where id='${S[0]}'`)
await expectErr('segmento aprovado não aceita edição direta', 'rev', `update public.segments set text='outro' where id='${S[0]}'`, 'mova-o para revisão')
const se = (await db.query(`select from_stage, to_stage, actor_id from public.stage_events where segment_id=$1 order by created_at desc limit 1`, [S[0]])).rows[0]
se?.to_stage === 'approved' && se.actor_id === U.rev ? ok('stage_events registra a transição e o autor') : bad('stage_events', JSON.stringify(se))

// Comentários e notificações
await expectOk('revisor responde mencionando o admin', 'rev', `insert into public.comments (thread_id, author_id, body, mentions) values ('${t1}','${U.rev}','Sugiro "afirmou"', array['${U.admin}']::uuid[])`)
const notes = (await db.query(`select user_id, kind from public.notifications order by kind`)).rows
notes.some(n => n.user_id === U.admin && n.kind === 'mention') && notes.some(n => n.user_id === U.tr && n.kind === 'reply') && !notes.some(n => n.user_id === U.rev)
  ? ok('notificações: menção ao admin, resposta ao autor da thread') : bad('notificações', JSON.stringify(notes))
const myNotes = await as('tr', `select count(*)::int as n from public.notifications`)
myNotes.rows[0].n === 1 ? ok('usuário só vê as próprias notificações') : bad('RLS notificações', myNotes.rows[0].n)
await expectErr('tradutor não resolve thread de outro', 'tr', `update public.comment_threads set status='resolved' where id=(select id from public.comment_threads where side='source')`, 'Apenas quem abriu')
await expectOk('autor resolve a própria thread', 'tr', `update public.comment_threads set status='resolved' where id='${t1}'`)
const resolvedNote = (await db.query(`select count(*)::int as n from public.notifications where kind='thread_resolved' and user_id=$1`, [U.rev])).rows[0].n
resolvedNote === 1 ? ok('notificação de thread resolvida ao participante') : bad('thread_resolved', resolvedNote)
await expectErr('não comenta em thread resolvida', 'rev', `insert into public.comments (thread_id, author_id, body) values ('${t1}','${U.rev}','x')`, 'reabra')

// Publicação
console.log('\nPublicação')
await expectErr('não publica com segmentos pendentes', 'rev', `select public.publish_translation_version('${v1}', '# A Imutabilidade')`, 'não aprovado')
await expectOk('revisor aprova o restante', 'rev', `update public.segments set stage='approved' where id='${S[1]}'`)
await expectOk('IA + aprovação do 3º segmento', 'rev', `select public.apply_ai_translation('${S[2]}', 'Grande Deus, quão infinito és tu', 'deepseek-chat'); update public.segments set stage='review' where id='${S[2]}'; update public.segments set stage='approved' where id='${S[2]}';`)
const ov = (await as('rev', `select segments_total, segments_approved, open_target_threads, open_source_threads, can_publish, is_outdated from public.translation_version_overview where id='${v1}'`)).rows[0]
ov.can_publish && ov.open_source_threads === 1 && !ov.is_outdated ? ok('overview: pronta para publicar, thread do original não conta') : bad('overview', JSON.stringify(ov))
await expectErr('status não muda por update direto', 'admin', `update public.translation_versions set status='published' where id='${v1}'`, 'publish_translation_version')
await expectErr('tradutor não publica', 'tr', `select public.publish_translation_version('${v1}', '# A Imutabilidade')`, 'revisores publicam')
await expectOk('revisor publica v1', 'rev', `select public.publish_translation_version('${v1}', '---\ntitle: A Imutabilidade de Deus\n---\n# A Imutabilidade de Deus')`)
const snap = (await db.query(`select contributors from public.translation_versions where id=$1`, [v1])).rows[0].contributors
JSON.stringify(snap) === JSON.stringify([{ name: 'Davi', roles: ['translator'] }, { name: 'rev', roles: ['translator', 'reviewer'] }])
  ? ok('publicação congela os colaboradores (tradução por IA/edição e revisão, pelo que cada um fez)') : bad('contributors v1', JSON.stringify(snap))
await expectErr('colaboradores não mudam por update direto', 'admin', `update public.translation_versions set contributors='[]' where id='${v1}'`, 'publish_translation_version')
await expectErr('usuário fora do Luther não consulta colaboradores', 'reader', `select * from public.version_contributors('${v1}')`, 'restrito')
await expectErr('versão publicada é congelada', 'admin', `update public.segments set stage='review' where id='${S[0]}'`, 'não está em andamento')

console.log('\nLeitura pública')
const pub = await expectOk('anon lê published_translations', 'anon', `select work_slug, author_name, language, version, mdx, contributors from public.published_translations`)
pub?.rows[0]?.contributors?.length === 2 && !JSON.stringify(pub.rows[0].contributors).includes('0000') ? ok('site recebe os colaboradores (só nome e papéis, sem ids)') : bad('contributors públicos', JSON.stringify(pub?.rows[0]?.contributors))
pub?.rows.length === 1 && pub.rows[0].version === 1 ? ok('site vê a v1 publicada') : bad('published_translations', JSON.stringify(pub?.rows))
await expectErr('anon não lê segmentos', 'anon', `select * from public.segments`, 'permission denied')
await expectErr('anon não lê colunas internas da versão', 'anon', `select created_by from public.translation_versions`, 'permission denied')

console.log('\nNova versão (cópia) e desatualização')
const segs2 = JSON.stringify([
  { position: 0, kind: 'title', text: 'The Immutability of God', ast_path: '0' },
  { position: 1, kind: 'paragraph', text: 'It has been said by someone (corrigido)...', ast_path: '1' },
  { position: 2, kind: 'quote', text: 'Great God, how infinite art thou', ast_path: '2' },
])
const segsAttr = JSON.stringify([{ position: 0, kind: 'attribute', text: 'Augustine, Confessions', ast_path: '3@source' }])
const workAttr = (await db.query(`insert into public.works (author_id, type, slug, title) values ('${author}','article','attr','Attr') returning id`)).rows[0].id
await expectOk('segmento de atributo (kind attribute) é aceito', 'admin', `select public.create_source_version('${workAttr}', '<Quote source="Augustine, Confessions">x</Quote>', '${segsAttr}'::jsonb)`)
await expectOk('admin cria versão 2 do original', 'admin', `select public.create_source_version('${work}', '# mdx v2', '${segs2}'::jsonb, '{}'::jsonb, 'correção de digitação')`)
const ov1 = (await as('rev', `select is_outdated from public.translation_version_overview where id='${v1}'`)).rows[0]
ov1.is_outdated ? ok('v1 da tradução marcada como desatualizada') : bad('is_outdated', JSON.stringify(ov1))
const v2 = (await expectOk('revisor cria v2 copiando a v1', 'rev', `select public.create_translation_version('${work}', 'pt-BR', 'copy') as id`)).rows[0].id
const v2segs = (await db.query(`select ss.position, s.stage, s.text from public.segments s join public.source_segments ss on ss.id=s.source_segment_id where s.translation_version_id=$1 order by 1`, [v2])).rows
v2segs[0].stage === 'review' && v2segs[0].text && v2segs[1].stage === 'original' && v2segs[1].text === '' && v2segs[2].stage === 'review'
  ? ok('cópia reaproveita segmentos inalterados (review) e zera os alterados (original)') : bad('cópia', JSON.stringify(v2segs))
const pub2 = (await as('anon', `select version from public.published_translations`)).rows
pub2.length === 1 && pub2[0].version === 1 ? ok('site continua na v1 enquanto a v2 está em andamento') : bad('pub após v2', JSON.stringify(pub2))

// --- Colaboradores com texto copiado --------------------------------------------
console.log('\nColaboradores (versão copiada)')
const S2 = Object.fromEntries((await db.query(`select s.id, ss.position from public.segments s join public.source_segments ss on ss.id = s.source_segment_id where s.translation_version_id = $1`, [v2])).rows.map(r => [r.position, r.id]))
await expectOk('admin traduz o segmento alterado da v2', 'admin', `update public.segments set text='Já foi dito por alguém (corrigido)...' where id='${S2[1]}'; update public.segments set stage='review' where id='${S2[1]}';`)
const live = (await as('tr', `select name, roles, translations, reviews from public.version_contributors('${v2}')`)).rows
JSON.stringify(live.map(c => [c.name, c.roles])) === JSON.stringify([['Davi', ['translator']], ['Admin', ['translator']], ['rev', ['translator']]])
  ? ok('em andamento: tradutores da v1 mantêm o crédito do texto copiado; revisões da v1 não contam') : bad('live v2', JSON.stringify(live))
await expectOk('revisor aprova a v2', 'rev', `update public.segments set stage='approved' where translation_version_id='${v2}'`)
await expectOk('revisor publica a v2', 'rev', `select public.publish_translation_version('${v2}', '# v2')`)
const snap2 = (await as('anon', `select version, contributors from public.published_translations`)).rows[0]
snap2.version === 2 && JSON.stringify(snap2.contributors) === JSON.stringify([{ name: 'Davi', roles: ['translator'] }, { name: 'rev', roles: ['translator', 'reviewer'] }, { name: 'Admin', roles: ['translator'] }])
  ? ok('v2 publicada com tradutores herdados + quem traduziu e revisou a v2') : bad('contributors v2', JSON.stringify(snap2))
const v1after = (await db.query(`select status, jsonb_array_length(contributors) as n from public.translation_versions where id=$1`, [v1])).rows[0]
v1after.status === 'archived' && v1after.n === 2 ? ok('v1 arquivada mantém os próprios colaboradores') : bad('v1 arquivada', JSON.stringify(v1after))

// --- Gestão de obras -----------------------------------------------------------
console.log('\nGestão de obras')
const fm = JSON.stringify({ title: 'All of Grace', description: 'An earnest word.', author: 'c-h-spurgeon', type: 'article' })
const wsegs = JSON.stringify([{ position: 0, kind: 'title', text: 'All of Grace', ast_path: 'frontmatter.title' }, { position: 1, kind: 'paragraph', text: 'Body.', ast_path: '1' }])
await expectErr('tradutor não cria obra', 'tr', `select public.create_work('${author}', 'article', 'all-of-grace', '# x', '${wsegs}'::jsonb, '${fm}'::jsonb)`, 'administradores')
const cw = (await expectOk('admin cria obra + versão 1 numa transação', 'admin', `select public.create_work('${author}', 'article', 'all-of-grace', '---\\ntitle: All of Grace\\n---\\n\\nBody.', '${wsegs}'::jsonb, '${fm}'::jsonb, '1886', 'year', 'Spurgeon Archive', 'Public domain') as id`)).rows[0].id
const cwRow = (await db.query(`select w.title, w.description, w.date_text, w.status, (select count(*)::int from public.source_versions sv where sv.work_id = w.id) as versions, (select count(*)::int from public.source_segments ss join public.source_versions sv on sv.id = ss.source_version_id where sv.work_id = w.id) as segs from public.works w where w.id = $1`, [cw])).rows[0]
cwRow.title === 'All of Grace' && cwRow.description === 'An earnest word.' && cwRow.status === 'draft' && cwRow.versions === 1 && cwRow.segs === 2
  ? ok('obra criada como rascunho, com título/descrição do frontmatter e 2 segmentos') : bad('create_work', JSON.stringify(cwRow))
await expectErr('slug repetido para o mesmo autor', 'admin', `select public.create_work('${author}', 'article', 'all-of-grace', '# x', '${wsegs}'::jsonb, '${fm}'::jsonb)`, 'works_author_id_slug_key')
const before = (await db.query(`select count(*)::int as n from public.works`)).rows[0].n
await expectErr('falha nos segmentos desfaz a obra (atômico)', 'admin', `select public.create_work('${author}', 'article', 'sem-segmentos', '# x', '[]'::jsonb, '${fm}'::jsonb)`, 'ao menos um segmento')
const after = (await db.query(`select count(*)::int as n from public.works`)).rows[0].n
before === after ? ok('nenhuma obra órfã após a falha') : bad('obra órfã', `${before} → ${after}`)
const fm2 = JSON.stringify({ title: 'All of Grace (revised)' })
await expectOk('nova versão do original', 'admin', `select public.create_source_version('${cw}', '# y', '${wsegs}'::jsonb, '${fm2}'::jsonb, 'revisão')`)
const cw2 = (await db.query(`select title, description from public.works where id=$1`, [cw])).rows[0]
cw2.title === 'All of Grace (revised)' && cw2.description === 'An earnest word.'
  ? ok('nova versão atualiza o título e mantém a descrição ausente no frontmatter') : bad('sync', JSON.stringify(cw2))

// --- Equipe do Luther ----------------------------------------------------------
console.log('\nEquipe do Luther (último admin)')
await expectErr('não rebaixa o único admin', 'service', `update public.app_memberships set role='reviewer' where user_id='${U.admin}' and app='luther'`, 'ao menos um administrador')
await expectErr('não desativa o único admin', 'service', `update public.app_memberships set active=false where user_id='${U.admin}' and app='luther'`, 'ao menos um administrador')
await expectErr('não remove o único admin', 'service', `delete from public.app_memberships where user_id='${U.admin}' and app='luther'`, 'ao menos um administrador')
await expectOk('admin promove o revisor a admin', 'service', `update public.app_memberships set role='admin' where user_id='${U.rev}' and app='luther'`)
await expectOk('com outro admin ativo, o primeiro pode ser rebaixado', 'service', `update public.app_memberships set role='reviewer' where user_id='${U.admin}' and app='luther'`)
await expectErr('agora o revisor promovido é o único admin', 'service', `update public.app_memberships set active=false where user_id='${U.rev}' and app='luther'`, 'ao menos um administrador')
await expectOk('desativar um tradutor não é afetado', 'service', `update public.app_memberships set active=false where user_id='${U.tr}' and app='luther'`)
await expectOk('outros apps não são afetados', 'service', `delete from public.app_memberships where user_id='${U.rev}' and app='atlas'`)
await expectOk('restaura os papéis', 'service', `update public.app_memberships set role='admin' where user_id='${U.admin}' and app='luther'; update public.app_memberships set role='reviewer' where user_id='${U.rev}' and app='luther'; update public.app_memberships set active=true where user_id='${U.tr}' and app='luther';`)

console.log(`\n${pass} ok, ${fail} falha(s)`)
process.exit(fail ? 1 : 0)
