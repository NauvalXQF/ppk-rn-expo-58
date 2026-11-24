export const Colors = {
  // Surface
  background: '#EEF1F6',
  listBackground: '#F3F3F5',
  surface: '#FFFFFF',
  glass: 'rgba(255,255,255,0.55)',
  glassStrong: 'rgba(255,255,255,0.70)',
  glassTrack: 'rgba(255,255,255,0.60)',
  glassEmptyDot: 'rgba(255,255,255,0.90)',
  glassBorder: 'rgba(255,255,255,0.70)',
  unreadSurface: '#F4F9FC',
  unreadBorder: 'rgba(123,184,212,0.30)',
  backdrop: 'rgba(35,38,45,0.35)',

  // Text
  text: '#23262D',
  textMuted: '#596270',
  textOnDark: '#FFFFFF',

  // Aksi utama (charcoal)
  primary: '#2B2E35',
  primaryPressed: '#1B1D22',
  primarySoft: 'rgba(43,46,53,0.08)',

  // Aksen data
  accentBlue: '#7BB8D4',
  accentPink: '#E3A8DC',
  accentLavender: '#CFC3F0',
  accentMint: '#BFE6E4',
  accentPeach: '#F6C9B0',
  accentYellow: '#F7E6A8',
  border: 'rgba(0,0,0,0.06)',
  handle: '#E5E7EB',

  // Semantik (versi soft)
  success: '#2F8F6B',
  successSoft: '#DDF3EA',
  warning: '#B7791F',
  warningSoft: '#FBEFCF',
  danger: '#D14B4B',
  dangerSoft: '#FBE1E1',
  neutralSoft: '#F1F2F5',
} as const;

export const Gradients = {
  screen: ['#C6DEEA', '#D9E1F0', '#E9D3EA'],
  courseA: ['#F2B8D8', '#E4C4EE', '#D7D2F3'],
  courseB: ['#F6C4B8', '#F7E3A8', '#F3C7D0'],
  courseC: ['#B9E3E6', '#CFE6EF', '#D8D4F2'],
  detailTop: ['#BFE0EE', '#D8C9EE'],
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const Radius = {
  sm: 12,
  md: 20,
  lg: 28,
  xl: 32,
  pill: 999,
} as const;

export const FontSize = {
  xs: 12,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 24,
  stat: 28,
  display: 32,
} as const;

export const FontFamily = {
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semibold: 'Outfit_600SemiBold',
} as const;

export const Shadow = {
  card: {
    shadowColor: '#5B6B8C',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  floating: {
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} as const;
