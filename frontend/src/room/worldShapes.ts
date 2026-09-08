// Simplified continent outlines in equirectangular space: x is longitude mapped to 0..1
// (-180°..180°), y is latitude mapped to 0..1 (90°..-90°). Deliberately coarse — this is a
// decorative wall map seen from across a room, not an atlas, and hand-tuned polygons are the
// only way to get recognisable landmasses with no external assets.

import { COUNTRIES } from '../data/countries'

export type Outline = [number, number][]

const ll = (lon: number, lat: number): [number, number] => [
  (lon + 180) / 360,
  (90 - lat) / 180,
]

export const CONTINENTS: Outline[] = [
  // North America
  [
    ll(-168, 65), ll(-158, 71), ll(-130, 70), ll(-114, 69), ll(-95, 72), ll(-82, 73),
    ll(-62, 68), ll(-57, 52), ll(-66, 45), ll(-74, 40), ll(-81, 31), ll(-80, 25),
    ll(-90, 29), ll(-97, 26), ll(-105, 20), ll(-96, 15), ll(-84, 10), ll(-78, 8),
    ll(-88, 16), ll(-95, 17), ll(-106, 23), ll(-114, 30), ll(-124, 40), ll(-125, 49),
    ll(-135, 57), ll(-150, 59), ll(-165, 55), ll(-168, 65),
  ],
  // Greenland
  [
    ll(-45, 83), ll(-25, 82), ll(-20, 74), ll(-30, 68), ll(-43, 60), ll(-52, 68),
    ll(-58, 76), ll(-45, 83),
  ],
  // South America
  [
    ll(-78, 8), ll(-70, 11), ll(-60, 8), ll(-50, 1), ll(-44, -3), ll(-35, -6),
    ll(-38, -13), ll(-48, -25), ll(-53, -34), ll(-62, -39), ll(-65, -46), ll(-69, -53),
    ll(-74, -50), ll(-73, -40), ll(-71, -30), ll(-70, -18), ll(-75, -14), ll(-81, -5),
    ll(-79, 2), ll(-78, 8),
  ],
  // Africa
  [
    ll(-17, 21), ll(-6, 35), ll(10, 37), ll(25, 32), ll(35, 31), ll(43, 12),
    ll(51, 12), ll(41, -2), ll(40, -15), ll(35, -25), ll(20, -35), ll(18, -30),
    ll(12, -17), ll(9, -1), ll(1, 5), ll(-8, 4), ll(-16, 12), ll(-17, 21),
  ],
  // Europe
  [
    ll(-10, 43), ll(-9, 52), ll(-4, 58), ll(5, 61), ll(15, 68), ll(28, 71),
    ll(40, 68), ll(48, 60), ll(40, 50), ll(30, 45), ll(22, 40), ll(12, 38),
    ll(0, 39), ll(-10, 43),
  ],
  // Asia
  [
    ll(40, 50), ll(50, 68), ll(70, 74), ll(100, 77), ll(130, 73), ll(160, 70),
    ll(178, 66), ll(170, 60), ll(155, 55), ll(140, 46), ll(130, 35), ll(122, 30),
    ll(110, 20), ll(105, 10), ll(97, 6), ll(92, 21), ll(80, 8), ll(72, 20),
    ll(62, 25), ll(55, 25), ll(45, 30), ll(35, 37), ll(45, 42), ll(52, 45), ll(40, 50),
  ],
  // Australia
  [
    ll(114, -22), ll(122, -17), ll(132, -11), ll(142, -11), ll(146, -19), ll(153, -26),
    ll(150, -37), ll(141, -38), ll(131, -32), ll(120, -34), ll(114, -22),
  ],
  // Antarctica, drawn as a band across the foot of the map
  [
    ll(-180, -68), ll(-120, -72), ll(-60, -70), ll(0, -70), ll(60, -68), ll(120, -70),
    ll(180, -70), ll(180, -88), ll(-180, -88), ll(-180, -68),
  ],
]

/**
 * Pin positions in the map's 0..1 space, derived from the country list rather than kept as a
 * second hand-maintained table. An unknown code simply gets no pin, which is the honest
 * failure for a retired or mistyped one.
 */
export const COUNTRY_POINTS: Record<string, [number, number]> = Object.fromEntries(
  COUNTRIES.map((country) => [country.code, ll(country.lon, country.lat)]),
)
