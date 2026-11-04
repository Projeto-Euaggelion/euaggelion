/**
 * Autores do acervo legado (`content/sermons/en-US/<pasta>`). O slug é o que vai no frontmatter
 * (`author`) e em `public.authors.slug`.
 */
export interface LegacyAuthor {
  slug: string
  name: string
  era: string
  /** Formas como o nome aparece nos cabeçalhos (comparadas sem espaços, pontos e caixa). */
  aliases: string[]
}

export const LEGACY_AUTHORS: Record<string, LegacyAuthor> = {
  c_h_spurgeon: { slug: "c-h-spurgeon", name: "C. H. Spurgeon", era: "1834–1892", aliases: ["C. H. Spurgeon", "Charles Spurgeon", "Charles Haddon Spurgeon"] },
  george_whitefield: { slug: "george-whitefield", name: "George Whitefield", era: "1714–1770", aliases: ["George Whitefield"] },
  j_c_philpot: { slug: "j-c-philpot", name: "J. C. Philpot", era: "1802–1869", aliases: ["J. C. Philpot", "Joseph Charles Philpot"] },
  j_c_ryle: { slug: "j-c-ryle", name: "J. C. Ryle", era: "1816–1900", aliases: ["J. C. Ryle", "John Charles Ryle", "Bishop Ryle"] },
  john_bunyan: { slug: "john-bunyan", name: "John Bunyan", era: "1628–1688", aliases: ["John Bunyan", "J O H N. B U N Y A N"] },
  john_newton: { slug: "john-newton", name: "John Newton", era: "1725–1807", aliases: ["John Newton"] },
  john_owen: { slug: "john-owen", name: "John Owen", era: "1616–1683", aliases: ["John Owen"] },
  jonathan_edwards: { slug: "jonathan-edwards", name: "Jonathan Edwards", era: "1703–1758", aliases: ["Jonathan Edwards"] },
  samuel_davies: { slug: "samuel-davies", name: "Samuel Davies", era: "1723–1761", aliases: ["Samuel Davies"] },
  thomas_watson: { slug: "thomas-watson", name: "Thomas Watson", era: "c. 1620–1686", aliases: ["Thomas Watson"] },
}
