/**
 * SUNAN Notifier – Redesign Design System Tokens
 */

export type ThemeColors = {
  bgBase: string;
  bgSurface: string;
  bgCard: string;
  bgCardHover: string;
  borderSubtle: string;
  borderMuted: string;
  borderAccent: string;
  accent: string;
  accentDim: string;
  accentBright: string;
  success: string;
  successDim: string;
  warning: string;
  warningDim: string;
  danger: string;
  dangerDim: string;
  purple: string;
  purpleDim: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  tabActive: string;
  tabInactive: string;
  tabBg: string;
  tabBorder: string;
};

// ── Dark palette (existing) ──────────────────────────────────
export const darkColors: ThemeColors = {
  // Background layers
  bgBase: '#0B1120',
  bgSurface: '#111827',
  bgCard: '#151F30',
  bgCardHover: '#1A2740',

  // Borders
  borderSubtle: 'rgba(255,255,255,0.07)',
  borderMuted: 'rgba(255,255,255,0.12)',
  borderAccent: 'rgba(79,142,247,0.4)',

  // Accent (blue)
  accent: '#4F8EF7',
  accentDim: 'rgba(79,142,247,0.15)',
  accentBright: '#6BA3FF',

  // Semantic
  success: '#2ECC71',
  successDim: 'rgba(46,204,113,0.15)',
  warning: '#FFB347',
  warningDim: 'rgba(255,179,71,0.15)',
  danger: '#FF5C5C',
  dangerDim: 'rgba(255,92,92,0.15)',
  purple: '#A78BFA',
  purpleDim: 'rgba(167,139,250,0.15)',

  // Text
  textPrimary: '#F0F4FF',
  textSecondary: '#8496BC',
  textMuted: '#4A5A78',
  textInverse: '#0B1120',

  // Tab bar
  tabActive: '#4F8EF7',
  tabInactive: '#4A5A78',
  tabBg: '#0E1525',
  tabBorder: 'rgba(255,255,255,0.06)',
};

// ── Light palette (new) ──────────────────────────────────────
export const lightColors: ThemeColors = {
  // Background layers
  bgBase: '#F0F4FF',
  bgSurface: '#FFFFFF',
  bgCard: '#FFFFFF',
  bgCardHover: '#EEF3FF',

  // Borders
  borderSubtle: 'rgba(0,0,0,0.07)',
  borderMuted: 'rgba(0,0,0,0.12)',
  borderAccent: 'rgba(79,142,247,0.35)',

  // Accent (blue) — same across modes
  accent: '#2D6EE8',
  accentDim: 'rgba(45,110,232,0.12)',
  accentBright: '#1B5CD6',

  // Semantic — same across modes
  success: '#18A557',
  successDim: 'rgba(24,165,87,0.12)',
  warning: '#D97706',
  warningDim: 'rgba(217,119,6,0.12)',
  danger: '#DC2626',
  dangerDim: 'rgba(220,38,38,0.12)',
  purple: '#7C3AED',
  purpleDim: 'rgba(124,58,237,0.12)',

  // Text
  textPrimary: '#0E1A30',
  textSecondary: '#3D5278',
  textMuted: '#8496BC',
  textInverse: '#FFFFFF',

  // Tab bar
  tabActive: '#2D6EE8',
  tabInactive: '#8496BC',
  tabBg: '#FFFFFF',
  tabBorder: 'rgba(0,0,0,0.08)',
};

// ── Legacy export alias (darkColors) so existing code that imports
// `Colors` from this file still works during migration ──────
export const Colors = darkColors;

export type ThemeMode = 'dark' | 'light' | 'system';
export type ResolvedThemeMode = Exclude<ThemeMode, 'system'>;

export const Radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  full: 999,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const Shadow = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 8,
  },
  subtle: {
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

export type ThemeColor = keyof typeof darkColors;
