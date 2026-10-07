/**
 * Sri Lankan Poya days and public holidays, calculated offline from sun/moon positions
 * (Jean Meeus, "Astronomical Algorithms"). Official dates are gazetted each year and can differ
 * by a day, so admins can correct any date through the holiday overrides in Settings.
 */

const RAD = Math.PI / 180
const SL_OFFSET_DAYS = 5.5 / 24
const COLOMBO = { lat: 6.9271, lon: 79.8612 }
const SYNODIC_MONTH = 29.530588861
// Hours of moon age at Colombo sunset after which the new crescent is taken as sighted (Islamic months).
const CRESCENT_MIN_AGE_HOURS = 22

const POYA_BY_SIGN_ENTERED = ['Bak', 'Vesak', 'Poson', 'Esala', 'Nikini', 'Binara', 'Vap', 'Il', 'Unduvap', 'Duruthu', 'Navam', 'Medin']

const sin = (deg) => Math.sin(deg * RAD)
const norm360 = (deg) => ((deg % 360) + 360) % 360

const pad = (n) => String(n).padStart(2, '0')

/** Calendar date (YYYY-MM-DD) in Sri Lanka time for a Julian Day (UT). */
function slDateKey(jd) {
  const d = new Date((jd + SL_OFFSET_DAYS - 2440587.5) * 86400000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** Julian Day (UT) of 00:00 Sri Lanka time on the given date key. */
function jdOfSlMidnight(key) {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86400000 + 2440587.5 - SL_OFFSET_DAYS
}

function shiftKey(key, days) {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

function deltaTDays(year) {
  const t = year - 2000
  return (62.92 + 0.32217 * t + 0.005589 * t * t) / 86400
}

/** Julian Day (UT) of the new moon (phase 0) or full moon (phase 0.5) for lunation k. */
function moonPhaseJd(k, phase) {
  const kk = k + phase
  const T = kk / 1236.85
  const T2 = T * T
  const T3 = T2 * T
  const T4 = T3 * T
  let jde = 2451550.09766 + SYNODIC_MONTH * kk + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4
  const E = 1 - 0.002516 * T - 0.0000074 * T2
  const M = 2.5534 + 29.1053567 * kk - 0.0000014 * T2 - 0.00000011 * T3
  const Mp = 201.5643 + 385.81693528 * kk + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4
  const F = 160.7108 + 390.67050284 * kk - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4
  const Om = 124.7746 - 1.56375588 * kk + 0.0020672 * T2 + 0.00000215 * T3

  const full = phase === 0.5
  jde +=
    (full ? -0.40614 : -0.4072) * sin(Mp) +
    (full ? 0.17302 : 0.17241) * E * sin(M) +
    (full ? 0.01614 : 0.01608) * sin(2 * Mp) +
    (full ? 0.01043 : 0.01039) * sin(2 * F) +
    (full ? 0.00734 : 0.00739) * E * sin(Mp - M) -
    (full ? 0.00515 : 0.00514) * E * sin(Mp + M) +
    (full ? 0.00209 : 0.00208) * E * E * sin(2 * M) -
    0.00111 * sin(Mp - 2 * F) -
    0.00057 * sin(Mp + 2 * F) +
    0.00056 * E * sin(2 * Mp + M) -
    0.00042 * sin(3 * Mp) +
    0.00042 * E * sin(M + 2 * F) +
    0.00038 * E * sin(M - 2 * F) -
    0.00024 * E * sin(2 * Mp - M) -
    0.00017 * sin(Om) -
    0.00007 * sin(Mp + 2 * M) +
    0.00004 * sin(2 * Mp - 2 * F) +
    0.00004 * sin(3 * M) +
    0.00003 * sin(Mp + M - 2 * F) +
    0.00003 * sin(2 * Mp + 2 * F) -
    0.00003 * sin(Mp + M + 2 * F) +
    0.00003 * sin(Mp - M + 2 * F) -
    0.00002 * sin(Mp - M - 2 * F) -
    0.00002 * sin(3 * Mp + M) +
    0.00002 * sin(4 * Mp)

  const planetary = [
    [0.000325, 299.77 + 0.107408 * kk - 0.009173 * T2],
    [0.000165, 251.88 + 0.016321 * kk],
    [0.000164, 251.83 + 26.651886 * kk],
    [0.000126, 349.42 + 36.412478 * kk],
    [0.00011, 84.66 + 18.206239 * kk],
    [0.000062, 141.74 + 53.303771 * kk],
    [0.00006, 207.14 + 2.453732 * kk],
    [0.000056, 154.84 + 7.30686 * kk],
    [0.000047, 34.52 + 27.261239 * kk],
    [0.000042, 207.19 + 0.121824 * kk],
    [0.00004, 291.34 + 1.844379 * kk],
    [0.000037, 161.72 + 24.198154 * kk],
    [0.000035, 239.56 + 25.513099 * kk],
    [0.000023, 331.55 + 3.592518 * kk],
  ]
  jde += planetary.reduce((sum, [coef, arg]) => sum + coef * sin(arg), 0)

  return jde - deltaTDays(2000 + kk / 12.3685)
}

function sunLongitude(jd) {
  const T = (jd - 2451545) / 36525
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * sin(M) + (0.019993 - 0.000101 * T) * sin(2 * M) + 0.000289 * sin(3 * M)
  const om = 125.04 - 1934.136 * T
  return norm360(L0 + C - 0.00569 - 0.00478 * sin(om))
}

const MOON_TERMS = [
  // D, M, M', F, coefficient (1e-6 degrees)
  [0, 0, 1, 0, 6288774], [2, 0, -1, 0, 1274027], [2, 0, 0, 0, 658314], [0, 0, 2, 0, 213618],
  [0, 1, 0, 0, -185116], [0, 0, 0, 2, -114332], [2, 0, -2, 0, 58793], [2, -1, -1, 0, 57066],
  [2, 0, 1, 0, 53322], [2, -1, 0, 0, 45758], [0, 1, -1, 0, -40923], [1, 0, 0, 0, -34720],
  [0, 1, 1, 0, -30383], [2, 0, 0, -2, 15327], [0, 0, 1, 2, -12528], [0, 0, 1, -2, 10980],
  [4, 0, -1, 0, 10675], [0, 0, 3, 0, 10034], [4, 0, -2, 0, 8548], [2, 1, -1, 0, -7888],
  [2, 1, 0, 0, -6766], [1, 0, -1, 0, -5163], [1, 1, 0, 0, 4987], [2, -1, 1, 0, 4036],
  [2, 0, 2, 0, 3994], [4, 0, 0, 0, 3861], [2, 0, -3, 0, 3665], [0, 1, -2, 0, -2689],
  [2, 0, -1, 2, -2602], [2, -1, -2, 0, 2390], [1, 0, 1, 0, -2348], [2, -2, 0, 0, 2236],
  [0, 1, 2, 0, -2120], [0, 2, 0, 0, -2069],
]

function moonLongitude(jd) {
  const T = (jd - 2451545) / 36525
  const T2 = T * T
  const T3 = T2 * T
  const T4 = T3 * T
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000
  const F = 93.272095 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000
  const E = 1 - 0.002516 * T - 0.0000074 * T2
  const A1 = 119.75 + 131.849 * T
  const A2 = 53.09 + 479264.29 * T

  let sum = 3958 * sin(A1) + 1962 * sin(Lp - F) + 318 * sin(A2)
  for (const [d, m, mp, f, coef] of MOON_TERMS) {
    const eFactor = Math.abs(m) === 2 ? E * E : Math.abs(m) === 1 ? E : 1
    sum += coef * eFactor * sin(d * D + m * M + mp * Mp + f * F)
  }
  const om = 125.04452 - 1934.136261 * T
  return norm360(Lp + sum / 1e6 - 0.00478 * sin(om))
}

/** Moon − sun longitude: 0° new moon, 180° full moon; each tithi spans 12°. */
const elongation = (jd) => norm360(moonLongitude(jd) - sunLongitude(jd))

function lahiriAyanamsa(jd) {
  return 23.853 + (0.013969 * (jd - 2451545)) / 365.25
}

const siderealSun = (jd) => norm360(sunLongitude(jd) - lahiriAyanamsa(jd))
const sunSign = (jd) => Math.floor(siderealSun(jd) / 30)

/** Moment (UT) the sidereal sun reaches the given longitude, searching from jdStart. */
function sankrantiJd(targetDeg, jdStart) {
  let lo = jdStart
  let hi = jdStart + 40
  const ahead = (jd) => norm360(siderealSun(jd) - targetDeg + 180) - 180
  for (let i = 0; i < 50; i += 1) {
    const mid = (lo + hi) / 2
    if (ahead(mid) < 0) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Moment the elongation reaches targetDeg, searched backwards up to 1.6 days before jdEnd. */
function elongationCrossingJd(targetDeg, jdEnd) {
  let lo = jdEnd - 1.6
  let hi = jdEnd
  const behind = (jd) => norm360(elongation(jd) - targetDeg + 180) - 180
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2
    if (behind(mid) < 0) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

function colomboSunsetJd(key) {
  const [y, m, d] = key.split('-').map(Number)
  const doy = (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000
  const g = ((2 * Math.PI) / 365) * (doy - 1)
  const eqTime =
    229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g))
  const decl =
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g)
  const lat = COLOMBO.lat * RAD
  const ha = Math.acos(Math.cos(90.833 * RAD) / (Math.cos(lat) * Math.cos(decl)) - Math.tan(lat) * Math.tan(decl)) / RAD
  const sunsetUtcMinutes = 720 - 4 * COLOMBO.lon - eqTime + 4 * ha
  return Date.UTC(y, m - 1, d) / 86400000 + 2440587.5 + sunsetUtcMinutes / 1440
}

/**
 * Poya day: the day whose sunset falls inside the Purnima tithi (elongation 168°–180°).
 * When no sunset does, the day of the full moon itself.
 */
function poyaDateKey(fullMoonJd) {
  const fullMoonDay = slDateKey(fullMoonJd)
  const dayBefore = shiftKey(fullMoonDay, -1)
  const purnimaStart = elongationCrossingJd(168, fullMoonJd)
  return purnimaStart <= colomboSunsetJd(dayBefore) ? dayBefore : fullMoonDay
}

/** Sinhala month (amanta) name for the lunation containing this full moon, with Adhi months. */
function poyaName(fullMoonJd) {
  const prevNew = fullMoonJd - SYNODIC_MONTH / 2
  const k = Math.round((prevNew - 2451550.09766) / SYNODIC_MONTH)
  const startJd = moonPhaseJd(k, 0)
  const endJd = moonPhaseJd(k + 1, 0)
  const startSign = sunSign(startJd)
  const endSign = sunSign(endJd)
  if (startSign === endSign) return `Adhi ${POYA_BY_SIGN_ENTERED[(endSign + 1) % 12]}`
  return POYA_BY_SIGN_ENTERED[endSign]
}

function lunationsAround(year) {
  const k0 = Math.floor((year - 2000) * 12.3685) - 2
  return Array.from({ length: 17 }, (_, i) => k0 + i)
}

function poyaDays(year) {
  return lunationsAround(year)
    .map((k) => moonPhaseJd(k, 0.5))
    .map((jd) => ({ date: poyaDateKey(jd), name: `${poyaName(jd)} Full Moon Poya Day`, kind: 'poya' }))
    .filter((h) => h.date.startsWith(`${year}-`))
}

function newMoonsInSign(year, sign) {
  return lunationsAround(year)
    .map((k) => moonPhaseJd(k, 0))
    .filter((jd) => slDateKey(jd).startsWith(`${year}-`) && sunSign(jd) === sign)
}

/** Day whose following midnight falls in Krishna Chaturdashi of Magha (Maha Shivaratri). */
function mahaShivaratri(year) {
  const newMoon = newMoonsInSign(year, 10)[0]
  if (!newMoon) return null
  const newMoonDay = slDateKey(newMoon)
  for (let back = 0; back <= 3; back += 1) {
    const key = shiftKey(newMoonDay, -back)
    const e = elongation(jdOfSlMidnight(shiftKey(key, 1)))
    if (e >= 336 && e < 348) return key
  }
  return shiftKey(newMoonDay, -2)
}

function deepavali(year) {
  const newMoon = newMoonsInSign(year, 6)[0]
  return newMoon ? shiftKey(slDateKey(newMoon), -1) : null
}

function easterSunday(year) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return `${year}-${pad(month)}-${pad(day)}`
}

/** First day of an Islamic month: the day after the first Colombo sunset with a sighted crescent. */
function islamicMonthStart(hijriYear, month) {
  const tabular =
    1948439.5 + Math.ceil(29.5 * (month - 1)) + (hijriYear - 1) * 354 + Math.floor((3 + 11 * hijriYear) / 30)
  const k = Math.round((tabular - 2451550.09766) / SYNODIC_MONTH)
  const newMoon = [k - 1, k].map((kk) => moonPhaseJd(kk, 0)).filter((jd) => jd < tabular + 1.5).pop()
  let key = slDateKey(newMoon)
  for (let i = 0; i < 4; i += 1) {
    if ((colomboSunsetJd(key) - newMoon) * 24 >= CRESCENT_MIN_AGE_HOURS) return shiftKey(key, 1)
    key = shiftKey(key, 1)
  }
  return key
}

function islamicHolidays(year) {
  const approxHijri = Math.floor(((year - 622) * 33) / 32)
  const list = []
  for (let h = approxHijri - 1; h <= approxHijri + 2; h += 1) {
    list.push(
      { date: islamicMonthStart(h, 10), name: 'Id-Ul-Fitr (Ramazan Festival Day)', kind: 'public' },
      { date: shiftKey(islamicMonthStart(h, 12), 9), name: 'Id-Ul-Alha (Hadji Festival Day)', kind: 'public' },
      { date: shiftKey(islamicMonthStart(h, 3), 11), name: 'Milad-Un-Nabi (Holy Prophet’s Birthday)', kind: 'public' }
    )
  }
  return list.filter((holiday) => holiday.date.startsWith(`${year}-`))
}

function publicHolidays(year, poyas) {
  const jan1 = jdOfSlMidnight(`${year}-01-01`)
  const makara = sankrantiJd(270, jan1 - 20)
  const mesha = sankrantiJd(0, jdOfSlMidnight(`${year}-03-25`))
  const newYear = slDateKey(mesha)
  const vesak = poyas.find((p) => /^Vesak /.test(p.name))

  return [
    { date: slDateKey(makara), name: 'Tamil Thai Pongal Day', kind: 'public' },
    { date: `${year}-02-04`, name: 'National Day', kind: 'public' },
    { date: mahaShivaratri(year), name: 'Mahasivarathri Day', kind: 'public' },
    { date: shiftKey(easterSunday(year), -2), name: 'Good Friday', kind: 'public' },
    { date: shiftKey(newYear, -1), name: 'Day prior to Sinhala & Tamil New Year Day', kind: 'public' },
    { date: newYear, name: 'Sinhala & Tamil New Year Day', kind: 'public' },
    { date: `${year}-05-01`, name: 'May Day', kind: 'public' },
    vesak ? { date: shiftKey(vesak.date, 1), name: 'Day following Vesak Full Moon Poya Day', kind: 'public' } : null,
    ...islamicHolidays(year),
    { date: deepavali(year), name: 'Deepavali Festival Day', kind: 'public' },
    { date: `${year}-12-25`, name: 'Christmas Day', kind: 'public' },
  ].filter((h) => h?.date?.startsWith(`${year}-`))
}

const cache = new Map()

/** Calculated Poya days and public holidays for a year, sorted by date. */
export function calculateSriLankaHolidays(year) {
  if (!cache.has(year)) {
    const poyas = poyaDays(year)
    const list = [...poyas, ...publicHolidays(year, poyas)]
      .map((h) => ({ ...h, source: 'auto' }))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'poya' ? -1 : 1))
    cache.set(year, list)
  }
  return cache.get(year)
}

/**
 * Calculated holidays with admin corrections applied.
 * overrides: [{ action: 'remove', date, name }] hides a calculated holiday;
 *            [{ action: 'add', date, name, kind }] adds one (a moved holiday is a remove + add).
 */
export function getSriLankaHolidays(year, overrides = []) {
  const removed = new Set(
    overrides.filter((o) => o.action === 'remove').map((o) => `${o.date}|${o.name}`)
  )
  const added = overrides
    .filter((o) => o.action === 'add' && String(o.date || '').startsWith(`${year}-`))
    .map((o) => ({ date: o.date, name: o.name, kind: o.kind === 'poya' ? 'poya' : 'public', source: 'custom' }))
  return [...calculateSriLankaHolidays(year).filter((h) => !removed.has(`${h.date}|${h.name}`)), ...added].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.kind === 'poya' ? -1 : 1)
  )
}
