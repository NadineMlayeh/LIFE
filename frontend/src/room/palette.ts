// One palette for the whole room. Spec's rule: every object must look like it belongs in the
// same space — same materials, same age, same colour language.
export const PALETTE = {
  wall: '#F3E4D0',
  wallShadowed: '#E7D6C0',
  floorLight: '#C9A77C',
  floorDark: '#9C7748',
  rug: '#B98A5E',
  woodLight: '#A87A4E',
  woodDark: '#6E4A2E',
  woodFrame: '#7A5233',
  brass: '#C9A227',
  glass: '#BFD9DE',
  paper: '#EADFC8',
  coral: '#D85A30',
  teal: '#1D8A6B',
  amber: '#C98A2E',
  ink: '#5C4630',
} as const

// Victorian binding leathers and cloths: oxblood, forest, navy, tan calf, aubergine. Deep
// and muted — the gilt does the talking, not the colour.
export const BOOK_COLORS = [
  '#6E2B26',
  '#2C4438',
  '#28374F',
  '#7A4B23',
  '#4A2A3E',
  '#5C3220',
  '#33503F',
  '#8A5A2B',
  '#5E1F22',
  '#243C52',
  '#6B4526',
  '#3E2B44',
] as const

// Deterministic per-id variation: the same book always gets the same spine, height and lean,
// so the shelf never reshuffles itself between renders.
export function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967296
}

export function variantFrom(id: string, index: number) {
  const a = hashString(id)
  const b = hashString(`${id}:lean`)
  const c = hashString(`${id}:size`)

  return {
    color: BOOK_COLORS[Math.floor(a * BOOK_COLORS.length) % BOOK_COLORS.length],
    height: 0.29 + c * 0.14,
    thickness: 0.055 + b * 0.05,
    lean: (b - 0.5) * 0.07,
    depth: 0.2 + a * 0.035,
    bandOffset: 0.55 + ((index * 0.13) % 0.2),
  }
}
