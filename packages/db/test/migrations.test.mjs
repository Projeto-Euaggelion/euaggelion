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
const U = { admin: '00000000-0000-0000-0000-00000000000a', tr: '00000000-0000-0000-0000-00000000000b', rev: '00000000-0000-0000-0000-00000000000c' }
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
console.log('\nAuth / perfis')
await db.query(`insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ($1, 'admin@x.org', '{"name":"Admin"}', '{"role":"admin"}'),
  ($2, 'tr@x.org', '{"name":"Tradutor"}', '{}'),
  ($3, 'rev@x.org', '{}', '{"role":"reviewer"}')`, [U.admin, U.tr, U.rev])
const roles = (await db.query(`select email, name, role from public.profiles order by email`)).rows
roles.length === 3 && roles.find(r => r.email === 'tr@x.org').role === 'translator' && roles.find(r => r.email === 'rev@x.org').name === 'rev'
  ? ok('perfis criados por trigger com papéis') : bad('perfis', JSON.stringify(roles))
await expectErr('tradutor não muda o próprio papel', 'tr', `update public.profiles set role='admin' where id='${U.tr}'`, 'administradores')
await expectOk('tradutor edita o próprio nome', 'tr', `update public.profiles set name='Davi' where id='${U.tr}'`)
await expectErr('anon não lê perfis', 'anon', `select * from public.profiles`, 'permission denied')

// --- Conteúdo ------------------------------------------------------------------
console.log('\nConteúdo')
await expectErr('tradutor não cria autor', 'tr', `insert into public.authors (name, slug) values ('X','x')`, 'row-level security')
const author = (await expectOk('admin cria autor', 'admin', `insert into public.authors (name, slug) values ('C. H. Spurgeon','c-h-spurgeon') returning id`)).rows[0].id
await expectErr('data incoerente com a precisão', 'admin', `insert into public.works (author_id, type, slug, title, date_text, date_precision) values ('${author}','sermon','x','X','1855-01','year')`, 'works_date_matches_precision')
const work = (await expectOk('admin cria obra', 'admin', `insert into public.works (author_id, type, slug, title, date_text, date_precision, status) values ('${author}','sermon','the-immutability-of-god','The Immutability of God','1855-01-07','day','active') returning id`)).rows[0].id
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
await expectErr('versão publicada é congelada', 'admin', `update public.segments set stage='review' where id='${S[0]}'`, 'não está em andamento')

console.log('\nLeitura pública')
const pub = await expectOk('anon lê published_translations', 'anon', `select work_slug, author_name, language, version, mdx from public.published_translations`)
pub?.rows.length === 1 && pub.rows[0].version === 1 ? ok('site vê a v1 publicada') : bad('published_translations', JSON.stringify(pub?.rows))
await expectErr('anon não lê segmentos', 'anon', `select * from public.segments`, 'permission denied')
await expectErr('anon não lê colunas internas da versão', 'anon', `select created_by from public.translation_versions`, 'permission denied')

console.log('\nNova versão (cópia) e desatualização')
const segs2 = JSON.stringify([
  { position: 0, kind: 'title', text: 'The Immutability of God', ast_path: '0' },
  { position: 1, kind: 'paragraph', text: 'It has been said by someone (corrigido)...', ast_path: '1' },
  { position: 2, kind: 'quote', text: 'Great God, how infinite art thou', ast_path: '2' },
])
await expectOk('admin cria versão 2 do original', 'admin', `select public.create_source_version('${work}', '# mdx v2', '${segs2}'::jsonb, '{}'::jsonb, 'correção de digitação')`)
const ov1 = (await as('rev', `select is_outdated from public.translation_version_overview where id='${v1}'`)).rows[0]
ov1.is_outdated ? ok('v1 da tradução marcada como desatualizada') : bad('is_outdated', JSON.stringify(ov1))
const v2 = (await expectOk('revisor cria v2 copiando a v1', 'rev', `select public.create_translation_version('${work}', 'pt-BR', 'copy') as id`)).rows[0].id
const v2segs = (await db.query(`select ss.position, s.stage, s.text from public.segments s join public.source_segments ss on ss.id=s.source_segment_id where s.translation_version_id=$1 order by 1`, [v2])).rows
v2segs[0].stage === 'review' && v2segs[0].text && v2segs[1].stage === 'original' && v2segs[1].text === '' && v2segs[2].stage === 'review'
  ? ok('cópia reaproveita segmentos inalterados (review) e zera os alterados (original)') : bad('cópia', JSON.stringify(v2segs))
const pub2 = (await as('anon', `select version from public.published_translations`)).rows
pub2.length === 1 && pub2[0].version === 1 ? ok('site continua na v1 enquanto a v2 está em andamento') : bad('pub após v2', JSON.stringify(pub2))

console.log(`\n${pass} ok, ${fail} falha(s)`)
process.exit(fail ? 1 : 0)
