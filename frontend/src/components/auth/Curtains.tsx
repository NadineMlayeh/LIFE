import { useId } from 'react'

/**
 * Velvet drapes, drawn rather than fetched — the same rule the room follows.
 *
 * What makes cloth read as cloth, learned the hard way over three attempts:
 *
 *  - **The tonal range has to be wide.** Mid-browns throughout was the first version's main
 *    fault. Velvet in a dark room goes almost black in the creases and catches a warm sheen
 *    only on the ridges. Cloth is mostly shadow; the light is the exception. So the drape is
 *    drawn dark first and lit afterwards, never the other way round.
 *  - **No hard edges.** Crisp boundaries between gradients read as printed stripes. The whole
 *    shading layer is blurred, and that softness is what turns bands into folds.
 *  - **Nothing even.** Equal widths and alternating tones make a fence. Widths, tones, sheen
 *    and even where the ridge falls across each fold are all varied from a hash.
 *  - **Only cloth.** Every hard ornament tried here failed the same way: a gold tieback cord, a
 *    scalloped pelmet and a swag's rope each read as a flat 2D line ruled over the top of the
 *    picture, because a stroke has no shading and everything around it does. **A single stroke
 *    of colour cannot sit in a scene built entirely out of soft gradients.** Drawing the rope
 *    convincingly would mean giving it the same treatment as the folds — its own core shadow,
 *    sheen and blur — which is not worth it for something the eye should pass over. The drapes
 *    are held back by nothing visible, and read better for it.
 */

/* -------------------------------------------------------------------------- */

/**
 * The drape's coordinate space, kept near the real aspect ratio (roughly 1:3). The SVG is
 * stretched to fit, so a square viewBox would smear the blur and the damask vertically.
 */
const W = 100
const H = 300

const FOLDS = 11
/** Height at which the cloth is drawn back. */
const TIE_Y = 0.5 * H
/**
 * Width there, as a fraction of the width at the rail. Gentler than a tieback would give:
 * nothing visible is holding the cloth, so a sharp pinch would look unexplained.
 */
const TIE_IN = 0.52
/** Width at the hem. Cloth released below the gather falls wider again, but not to full. */
const HEM_OUT = 0.86

/** Deterministic noise, so the same drape is drawn identically on every render. */
function hash(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

/** Velvet at a given lightness, 0 = the depth of a crease, 1 = the sheen on a ridge. */
function velvet(t: number) {
  const c = Math.max(0, Math.min(1, t))
  // Deliberately not a straight interpolation: cloth darkens fast as it turns away from the
  // light, so the low end is weighted.
  const e = c ** 1.5
  const dark = [14, 7, 2]
  const light = [186, 132, 68]
  return `rgb(${dark.map((d, i) => Math.round(d + (light[i] - d) * e)).join(',')})`
}

/**
 * The x of a fold boundary at a given height. Every boundary follows the same profile — in to
 * the gather, out to the hem — so folds cannot cross and the drape reads as one cloth.
 */
function profile(u: number) {
  const top = u * W
  const tie = u * W * TIE_IN
  const hem = u * W * HEM_OUT
  return { top, tie, hem }
}

function boundaryPath(u: number) {
  const { top, tie, hem } = profile(u)
  return [
    `M ${top} 0`,
    `C ${top} ${TIE_Y * 0.34}, ${tie + (top - tie) * 0.55} ${TIE_Y * 0.72}, ${tie} ${TIE_Y}`,
    `C ${tie} ${TIE_Y + (H - TIE_Y) * 0.3}, ${hem} ${TIE_Y + (H - TIE_Y) * 0.62}, ${hem} ${H}`,
  ].join(' ')
}

/** The closed band between two boundaries — one fold. */
function foldPath(uA: number, uB: number) {
  const a = profile(uA)
  const b = profile(uB)
  return [
    `M ${a.top} 0`,
    `L ${b.top} 0`,
    `C ${b.top} ${TIE_Y * 0.34}, ${b.tie + (b.top - b.tie) * 0.55} ${TIE_Y * 0.72}, ${b.tie} ${TIE_Y}`,
    `C ${b.tie} ${TIE_Y + (H - TIE_Y) * 0.3}, ${b.hem} ${TIE_Y + (H - TIE_Y) * 0.62}, ${b.hem} ${H}`,
    `L ${a.hem} ${H}`,
    `C ${a.hem} ${TIE_Y + (H - TIE_Y) * 0.62}, ${a.tie} ${TIE_Y + (H - TIE_Y) * 0.3}, ${a.tie} ${TIE_Y}`,
    `C ${a.tie + (a.top - a.tie) * 0.55} ${TIE_Y * 0.72}, ${a.top} ${TIE_Y * 0.34}, ${a.top} 0`,
    'Z',
  ].join(' ')
}

function Drape({ side }: { side: 'left' | 'right' }) {
  const id = useId()
  const seed = side === 'left' ? 3 : 17

  // Uneven fold widths, accumulated across the drape.
  const widths = Array.from({ length: FOLDS }, (_, i) => 0.6 + hash(seed + i) * 0.85)
  const total = widths.reduce((a, b) => a + b, 0)

  // The folds are laid out past both edges of the silhouette and then clipped back to it.
  // Without this the blurred shading fades to nothing at each edge and lets the near-black
  // base show through — which is exactly the pair of dark strips that appeared down the sides
  // of every drape. A blur needs cloth to blur *from* beyond the edge it stops at.
  const OVER = 0.2
  const span = 1 + OVER * 2
  const edges: number[] = [-OVER]
  widths.forEach((w) => edges.push(edges[edges.length - 1] + (w / total) * span))

  const folds = edges.slice(0, -1).map((u, i) => {
    const centre = (u + edges[i + 1]) / 2
    // Normalised back into 0..1 across the visible drape, so the overscan does not skew the
    // lighting toward one side.
    const t = Math.max(0, Math.min(1, (centre + OVER) / span))
    // Lit from the middle of the room, so the folds nearest the window edge catch most.
    const exposure = 0.22 + 0.78 * t ** 1.2
    const jitter = hash(seed * 5 + i) * 0.3 - 0.15
    return {
      d: foldPath(u, edges[i + 1]),
      ridge: boundaryPath(centre),
      crease: boundaryPath(edges[i + 1]),
      lit: Math.max(0.08, exposure + jitter),
      // Where across the fold the ridge sits. Never the middle, or they all look the same.
      peak: 0.32 + hash(seed * 11 + i) * 0.34,
    }
  })

  const silhouette = [
    'M 0 0',
    `L ${W} 0`,
    `C ${W} ${TIE_Y * 0.34}, ${W * TIE_IN + (W - W * TIE_IN) * 0.55} ${TIE_Y * 0.72}, ${W * TIE_IN} ${TIE_Y}`,
    `C ${W * TIE_IN} ${TIE_Y + (H - TIE_Y) * 0.3}, ${W * HEM_OUT} ${TIE_Y + (H - TIE_Y) * 0.62}, ${W * HEM_OUT} ${H}`,
    'L 0 ' + H,
    'Z',
  ].join(' ')

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
      className="h-full w-full"
      style={{ transform: side === 'right' ? 'scaleX(-1)' : undefined }}
    >
      <defs>
        {/* The softness that turns bands into cloth. Anisotropic, because the viewBox is
            stretched to the window and an even blur would smear vertically. */}
        <filter id={`${id}-soft`} x="-10%" y="-4%" width="120%" height="108%">
          <feGaussianBlur stdDeviation="1.6 3.2" />
        </filter>
        <filter id={`${id}-sheen`} x="-14%" y="-4%" width="128%" height="108%">
          <feGaussianBlur stdDeviation="2.2 5" />
        </filter>

        {folds.map((fold, i) => (
          /*
            The trough at each end of a fold is relative to how lit that fold is, never a fixed
            near-black. Fixed dark stops put a black tail on every fold — and the outermost
            fold's tail lands exactly on the drape's free edge, which is what drew a dark band
            down the inside of each curtain. A bright fold's crease is a dark *brown*, not a
            hole.
          */
          <linearGradient key={i} id={`${id}-g${i}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={velvet(Math.max(0.06, fold.lit * 0.2))} />
            <stop offset={`${fold.peak * 100 - 14}%`} stopColor={velvet(fold.lit * 0.5)} />
            <stop offset={`${fold.peak * 100}%`} stopColor={velvet(fold.lit)} />
            <stop offset={`${fold.peak * 100 + 20}%`} stopColor={velvet(fold.lit * 0.42)} />
            <stop
              offset="100%"
              stopColor={velvet(
                // The last fold's outer edge is the free edge of the curtain, nearest the
                // light. It is the brightest part of the cloth, not the darkest.
                i === folds.length - 1 ? fold.lit * 0.8 : Math.max(0.05, fold.lit * 0.16),
              )}
            />
          </linearGradient>
        ))}

        <pattern id={`${id}-damask`} width="11" height="17" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="#F0CE96" strokeWidth={0.55}>
            <path d="M5.5 2 C9 5.5, 9 10.5, 5.5 14 C2 10.5, 2 5.5, 5.5 2 Z" />
            <path d="M0 9 C2.4 10.6, 3.2 13, 2.6 15.5" />
            <path d="M11 9 C8.6 10.6, 7.8 13, 8.4 15.5" />
            <circle cx="5.5" cy="8" r="1.1" />
          </g>
        </pattern>

        <clipPath id={`${id}-clip`}>
          <path d={silhouette} />
        </clipPath>

        {/* Darkness gathering at the hem and up in the gather, where light cannot reach. */}
        <linearGradient id={`${id}-foot`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(10,5,1,0)" />
          <stop offset="100%" stopColor="rgba(10,5,1,0.72)" />
        </linearGradient>
      </defs>

      {/* Base: the drape is a dark object first. Anything lit is added on top. Not pure black
          — a base that dark shows as a hole wherever the shading does not quite reach. */}
      <path d={silhouette} fill={velvet(0.16)} />

      <g clipPath={`url(#${id}-clip)`}>
        {/* The folds, softened. */}
        <g filter={`url(#${id}-soft)`}>
          {folds.map((fold, i) => (
            <path key={i} d={fold.d} fill={`url(#${id}-g${i})`} />
          ))}
        </g>

        {/* Woven damask, only where the cloth is already lit — a pattern of even strength all
            over is what makes printed fabric look like wallpaper. */}
        <g opacity={0.13} style={{ mixBlendMode: 'overlay' }}>
          <rect width={W} height={H} fill={`url(#${id}-damask)`} />
        </g>

        {/* Deep creases along the fold boundaries. */}
        <g filter={`url(#${id}-soft)`} opacity={0.85}>
          {folds.map((fold, i) => (
            <path
              key={i}
              d={fold.crease}
              fill="none"
              stroke="rgba(8,4,1,0.85)"
              strokeWidth={1.6 + hash(seed * 23 + i) * 1.4}
              // Folds narrow toward the anchored edge, so the creases crowd there. Fading the
              // innermost ones keeps that pile-up from reading as a dark band.
              opacity={Math.min(1, 0.25 + (i / folds.length) * 1.5)}
            />
          ))}
        </g>

        {/* The sheen along each ridge. Narrow, warm, and never at full strength — a specular
            highlight that reaches white is satin, not velvet. */}
        <g filter={`url(#${id}-sheen)`}>
          {folds.map((fold, i) => (
            <path
              key={i}
              d={fold.ridge}
              fill="none"
              stroke={velvet(Math.min(1, fold.lit * 1.5))}
              strokeWidth={1.4 + hash(seed * 31 + i) * 1.8}
              opacity={0.42 + fold.lit * 0.4}
            />
          ))}
        </g>

        <rect y={H * 0.66} width={W} height={H * 0.34} fill={`url(#${id}-foot)`} />

        {/* The shadow the gathered cloth throws down over what hangs below it. With no cord
            drawn, this is what says the drape is held back rather than simply narrow. */}
        <ellipse
          cx={W * 0.26}
          cy={TIE_Y + 20}
          rx={W * 0.4}
          ry={18}
          fill="rgba(10,5,1,0.26)"
          filter={`url(#${id}-sheen)`}
        />
      </g>

    </svg>
  )
}

/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */

/**
 * The full set, behind whatever is on the stage.
 *
 * Hidden below 1024px: on a narrow window the drapes crowd the card down to a slot, and the
 * card is the point. Purely decorative, so `aria-hidden` throughout.
 */
export function Curtains() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
      <div className="absolute inset-y-0 left-0 w-[20vw] max-w-[280px]">
        <Drape side="left" />
      </div>
      <div className="absolute inset-y-0 right-0 w-[20vw] max-w-[280px]">
        <Drape side="right" />
      </div>
    </div>
  )
}
