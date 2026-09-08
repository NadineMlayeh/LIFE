// Spec B.6: the window's light comes from the visitor's own clock, never a weather API.
// Everything the room's mood depends on is derived here.

export type Phase = 'morning' | 'day' | 'sunset' | 'night'

export interface DayLighting {
  phase: Phase
  skyTop: string
  skyBottom: string
  sunColor: string
  sunIntensity: number
  /**
   * Sun position in world space. Aimed so the ray toward the room's centre passes through the
   * window opening in the left wall — otherwise the wall simply blocks the daylight.
   */
  sunPosition: [number, number, number]
  ambientColor: string
  ambientIntensity: number
  bounceColor: string
  bounceIntensity: number
  /** Warm lamp fill that only really matters after dark. */
  lampIntensity: number
  moon: boolean
}

const PHASES: Record<Phase, Omit<DayLighting, 'phase'>> = {
  morning: {
    skyTop: '#BFD4E8',
    skyBottom: '#F6DFB8',
    sunColor: '#FFD9A0',
    sunIntensity: 2.6,
    sunPosition: [-7.6, 2.7, 1.5],
    ambientColor: '#C9D6E4',
    ambientIntensity: 0.78,
    bounceColor: '#F0D8B4',
    bounceIntensity: 0.62,
    lampIntensity: 0.15,
    moon: false,
  },
  day: {
    skyTop: '#A9C8E4',
    skyBottom: '#EAF0F2',
    sunColor: '#FFF0D6',
    sunIntensity: 3.2,
    sunPosition: [-6.6, 4.4, 0.9],
    ambientColor: '#DCE6EE',
    ambientIntensity: 0.9,
    bounceColor: '#E8D9C0',
    bounceIntensity: 0.68,
    lampIntensity: 0.08,
    moon: false,
  },
  sunset: {
    skyTop: '#8C86A8',
    skyBottom: '#F2C295',
    // Warm amber rather than a saturated orange — the earlier values washed every surface
    // in the room to the same tangerine and lost the wood and gilt entirely.
    sunColor: '#FFCF9E',
    sunIntensity: 2.6,
    sunPosition: [-8.2, 1.95, 1.9],
    ambientColor: '#CBBBB0',
    ambientIntensity: 0.72,
    bounceColor: '#DCB794',
    bounceIntensity: 0.66,
    lampIntensity: 0.5,
    moon: false,
  },
  // Night has to stay *legible* with the lamp off — dark enough to read as evening, never so
  // dark the room becomes unusable. The lamp is what makes it warm and bright again.
  night: {
    skyTop: '#161F33',
    skyBottom: '#2E3A57',
    sunColor: '#A8BCDC',
    sunIntensity: 0.45,
    sunPosition: [-6.2, 3.9, 1.1],
    ambientColor: '#5A688A',
    ambientIntensity: 0.46,
    bounceColor: '#6E7899',
    bounceIntensity: 0.3,
    lampIntensity: 1.5,
    moon: true,
  },
}

export function phaseForHour(hour: number): Phase {
  if (hour >= 6 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 17) return 'day'
  // Sunset ends at 19:00 rather than 20:00 — by quarter past seven the room should already
  // be reading as evening, which is what it looks like out of a real window.
  if (hour >= 17 && hour < 19) return 'sunset'
  return 'night'
}

export function lightingForDate(date = new Date()): DayLighting {
  const phase = phaseForHour(date.getHours())
  return { phase, ...PHASES[phase] }
}
