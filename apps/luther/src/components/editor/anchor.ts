import type { Anchor, Side } from "./types"

/** Raiz de ancoragem: elemento que contém o texto puro de um segmento (fonte ou tradução). */
export const ANCHOR_ROOT = "data-anchor-root"

/**
 * Converte a seleção atual do navegador numa âncora (segmento + lado + offsets).
 * Só aceita seleções contidas num único segmento.
 */
export function anchorFromSelection(selection: Selection | null): (Anchor & { rect: DOMRect }) | null {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  const startRoot = closestRoot(range.startContainer)
  const endRoot = closestRoot(range.endContainer)
  if (!startRoot || startRoot !== endRoot) return null

  const raw = range.toString()
  const quote = raw.trim()
  if (!quote) return null

  const pre = document.createRange()
  pre.selectNodeContents(startRoot)
  pre.setEnd(range.startContainer, range.startOffset)
  const start = pre.toString().length + (raw.length - raw.trimStart().length)

  return {
    segmentId: startRoot.dataset.segmentId!,
    side: startRoot.dataset.side as Side,
    quote,
    start,
    end: start + quote.length,
    rect: range.getBoundingClientRect(),
  }
}

function closestRoot(node: Node): HTMLElement | null {
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
  return (el?.closest(`[${ANCHOR_ROOT}]`) as HTMLElement | null) ?? null
}
