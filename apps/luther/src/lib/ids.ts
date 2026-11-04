const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Evita consultar o banco (e um erro 22P02) com ids malformados vindos da URL. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}
