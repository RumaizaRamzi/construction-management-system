/** RN Trading Lanka palette and shared styling for dashboard charts. */
export const BRAND = {
  red: '#c8211a',
  redDark: '#8b1813',
  gold: '#d4a017',
  goldLight: '#eec95a',
  charcoal: '#262626',
  green: '#059669',
  sky: '#0284c7',
  slate: '#94a3b8',
}

export const DONUT_COLORS = [BRAND.red, BRAND.gold, BRAND.charcoal, '#e5483d', '#b07f10', '#64748b', '#0284c7', '#059669']

export const GRID_PROPS = { strokeDasharray: '4 4', stroke: '#e2e8f0', vertical: false }

export const AXIS_PROPS = {
  tick: { fontSize: 12, fill: '#64748b' },
  tickLine: false,
  axisLine: false,
}

export const LEGEND_PROPS = {
  iconType: 'circle',
  iconSize: 8,
  wrapperStyle: { fontSize: 12, paddingTop: 8 },
}

export const CURSOR = { fill: 'rgba(200, 33, 26, 0.06)' }

export function compactNumber(value) {
  const n = Number(value) || 0
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}
