/**
 * @euaggelion/mdx
 *
 * Convenções de MDX compartilhadas entre os apps do Euaggelion:
 * - schema do frontmatter e componentes conhecidos (`schema`)
 * - parser / segmentador (`parseMdx`)
 * - reconstrução do MDX traduzido (`reconstructMdx`)
 * - validação da tradução de um segmento (`validateTranslation`)
 */

export * from "./schema"
export { MdxSyntaxError, normalizeSource } from "./processor"
export { parseMdx, locateSegments } from "./segment"
export type { SourceSegment, ParsedMdx, MdxIssue, LocatedSegment, LocatedDocument } from "./segment"
export { reconstructMdx, ReconstructError } from "./reconstruct"
export type { ReconstructOptions } from "./reconstruct"
export { validateTranslation } from "./validate"
export type { ValidationResult } from "./validate"
