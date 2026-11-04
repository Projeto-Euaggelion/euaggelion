-- =============================================================================
-- Segmentos de atributos traduzíveis de componentes MDX (ex.: <Quote source="…">)
-- O parser (@euaggelion/mdx) gera esses segmentos com ast_path "<caminho>@<atributo>".
-- =============================================================================

alter type public.segment_kind add value if not exists 'attribute';
