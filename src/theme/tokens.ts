// ==========================================
// DAYCRAFT — THEME TOKENS & PRESETS
// Distinctive, premium, calm visual identity
// ==========================================

export type ThemePresetKey =
  | 'warm_paper'
  | 'midnight'
  | 'emerald_luxe'
  | 'aurora'
  | 'solar_gold'
  | 'sage_garden'
  | 'lavender_haze'
  | 'sunset'
  | 'monochrome';

export type ThemeMode = 'light' | 'dark' | 'system';

export type ThemeUnlockCondition =
  | {
      type: 'default';
      label: string;
    }
  | {
      type: 'level';
      requiredLevel: number;
      label: string;
    }
  | {
      type: 'achievement';
      requiredAchievementId: string;
      requiredAchievementTitle: string;
      label: string;
    };

export interface ThemeUnlockContext {
  level: number;
  unlockedAchievementIds: Iterable<string> | string[];
}

export interface ThemeColors {
  bgApp: string;
  bgSurface: string;
  bgSurfaceElevated: string;
  bgSurfaceSubtle: string;
  border: string;
  borderFocus: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  accentSubtle: string;
  accentForeground: string;
  success: string;
  successSubtle: string;
  warning: string;
  warningSubtle: string;
  danger: string;
  dangerSubtle: string;
  info: string;
  infoSubtle: string;
  sidebarBg: string;
  cardShadow: string;
}

export interface PresetDefinition {
  id: ThemePresetKey;
  name: string;
  description: string;
  unlockedByDefault: boolean;
  unlockCondition: ThemeUnlockCondition;
  previewSwatches: {
    bg: string;
    surface: string;
    accent: string;
    text: string;
  };
  light: ThemeColors;
  dark: ThemeColors;
}

export const DEFAULT_THEME_PRESET: ThemePresetKey = 'warm_paper';

export const THEME_PRESETS: Record<ThemePresetKey, PresetDefinition> = {
  warm_paper: {
    id: 'warm_paper',
    name: 'Warm Paper · Forest Core',
    description: 'Cream, rich charcoal, and muted terracotta tones inspired by archival stationery',
    unlockedByDefault: true,
    unlockCondition: {
      type: 'default',
      label: 'Default Theme',
    },
    previewSwatches: {
      bg: '#F8F6F0',
      surface: '#FFFFFF',
      accent: '#C86D51',
      text: '#2B2825',
    },
    light: {
      bgApp: '#F8F6F0',
      bgSurface: '#FFFFFF',
      bgSurfaceElevated: '#FFFFFF',
      bgSurfaceSubtle: '#F0EBE1',
      border: '#E3DCCE',
      borderFocus: '#C86D51',
      textPrimary: '#2B2825',
      textSecondary: '#66615B',
      textMuted: '#9B948C',
      accent: '#C86D51', // terracotta
      accentHover: '#B55B40',
      accentSubtle: '#F9ECE7',
      accentForeground: '#FFFFFF',
      success: '#4A7C59',
      successSubtle: '#EDF5F0',
      warning: '#C48228',
      warningSubtle: '#FAF3E8',
      danger: '#BC4B42',
      dangerSubtle: '#FBEFED',
      info: '#4B6B94',
      infoSubtle: '#EDF2F8',
      sidebarBg: '#F3EFE7',
      cardShadow: '0 2px 8px -2px rgba(43, 40, 37, 0.06), 0 1px 3px -1px rgba(43, 40, 37, 0.04)',
    },
    dark: {
      bgApp: '#191816',
      bgSurface: '#24221F',
      bgSurfaceElevated: '#2F2C28',
      bgSurfaceSubtle: '#1F1D1A',
      border: '#3A3631',
      borderFocus: '#D47B5F',
      textPrimary: '#F2EFE9',
      textSecondary: '#B3ACA3',
      textMuted: '#7D766C',
      accent: '#D47B5F',
      accentHover: '#E08A6F',
      accentSubtle: '#38251E',
      accentForeground: '#FFFFFF',
      success: '#68A87B',
      successSubtle: '#1C2C20',
      warning: '#DB9E45',
      warningSubtle: '#332615',
      danger: '#D9655B',
      dangerSubtle: '#331B18',
      info: '#6E93C4',
      infoSubtle: '#182436',
      sidebarBg: '#1E1C1A',
      cardShadow: '0 3px 12px -2px rgba(0, 0, 0, 0.35)',
    },
  },

  midnight: {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep charcoal surfaces with cool slate and cerulean-emerald accents',
    unlockedByDefault: false,
    unlockCondition: {
      type: 'level',
      requiredLevel: 3,
      label: 'Reach Level 3',
    },
    previewSwatches: {
      bg: '#0F1218',
      surface: '#171B24',
      accent: '#3B82F6',
      text: '#F3F4F6',
    },
    light: {
      bgApp: '#F4F6F9',
      bgSurface: '#FFFFFF',
      bgSurfaceElevated: '#FFFFFF',
      bgSurfaceSubtle: '#E8ECF2',
      border: '#D3DAE4',
      borderFocus: '#2563EB',
      textPrimary: '#111827',
      textSecondary: '#4B5563',
      textMuted: '#9CA3AF',
      accent: '#2563EB',
      accentHover: '#1D4ED8',
      accentSubtle: '#EFF6FF',
      accentForeground: '#FFFFFF',
      success: '#059669',
      successSubtle: '#ECFDF5',
      warning: '#D97706',
      warningSubtle: '#FFFBEB',
      danger: '#DC2626',
      dangerSubtle: '#FEF2F2',
      info: '#0284C7',
      infoSubtle: '#F0F9FF',
      sidebarBg: '#EAEEF5',
      cardShadow: '0 2px 8px -2px rgba(17, 24, 39, 0.06)',
    },
    dark: {
      bgApp: '#0F1218',
      bgSurface: '#171B24',
      bgSurfaceElevated: '#202633',
      bgSurfaceSubtle: '#13161F',
      border: '#293040',
      borderFocus: '#3B82F6',
      textPrimary: '#F3F4F6',
      textSecondary: '#9CA3AF',
      textMuted: '#6B7280',
      accent: '#3B82F6',
      accentHover: '#60A5FA',
      accentSubtle: '#1A2942',
      accentForeground: '#FFFFFF',
      success: '#10B981',
      successSubtle: '#112F24',
      warning: '#F59E0B',
      warningSubtle: '#332612',
      danger: '#EF4444',
      dangerSubtle: '#3B191B',
      info: '#38BDF8',
      infoSubtle: '#102A3C',
      sidebarBg: '#12151D',
      cardShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.5)',
    },
  },

  emerald_luxe: {
    id: 'emerald_luxe',
    name: 'Emerald Luxe',
    description: 'Rich botanical greens with warm antique gold highlights and velvet depth',
    unlockedByDefault: false,
    unlockCondition: {
      type: 'achievement',
      requiredAchievementId: 'first_project',
      requiredAchievementTitle: 'Grand Architect',
      label: 'Unlock "Grand Architect" badge',
    },
    previewSwatches: {
      bg: '#0D1914',
      surface: '#14261E',
      accent: '#D4A853',
      text: '#ECF5F0',
    },
    light: {
      bgApp: '#F2F7F4',
      bgSurface: '#FFFFFF',
      bgSurfaceElevated: '#FFFFFF',
      bgSurfaceSubtle: '#E3EFE8',
      border: '#C6DDD0',
      borderFocus: '#1B6B4A',
      textPrimary: '#132A20',
      textSecondary: '#3E5E4F',
      textMuted: '#729383',
      accent: '#1B6B4A',
      accentHover: '#145339',
      accentSubtle: '#E3F3EC',
      accentForeground: '#FFFFFF',
      success: '#1E7E53',
      successSubtle: '#E6F6EE',
      warning: '#B8862D',
      warningSubtle: '#FBF4E4',
      danger: '#B8403A',
      dangerSubtle: '#FCECEB',
      info: '#2B6E8C',
      infoSubtle: '#E8F3F8',
      sidebarBg: '#E8F2EC',
      cardShadow: '0 2px 10px -2px rgba(19, 42, 32, 0.07)',
    },
    dark: {
      bgApp: '#0D1914',
      bgSurface: '#14261E',
      bgSurfaceElevated: '#1C3329',
      bgSurfaceSubtle: '#102019',
      border: '#264537',
      borderFocus: '#D4A853',
      textPrimary: '#ECF5F0',
      textSecondary: '#A3C2B2',
      textMuted: '#688B79',
      accent: '#D4A853',
      accentHover: '#E2BA6B',
      accentSubtle: '#2D2918',
      accentForeground: '#121915',
      success: '#38B27A',
      successSubtle: '#133324',
      warning: '#E0A842',
      warningSubtle: '#302512',
      danger: '#E0635A',
      dangerSubtle: '#331A19',
      info: '#4CA3C9',
      infoSubtle: '#142B36',
      sidebarBg: '#101F18',
      cardShadow: '0 4px 18px -2px rgba(0, 0, 0, 0.5)',
    },
  },

  aurora: {
    id: 'aurora',
    name: 'Aurora',
    description: 'Atmospheric Nordic teal, deep pine, and luminous cyan-emerald currents',
    unlockedByDefault: false,
    unlockCondition: {
      type: 'level',
      requiredLevel: 7,
      label: 'Reach Level 7',
    },
    previewSwatches: {
      bg: '#0B161B',
      surface: '#122229',
      accent: '#14B8A6',
      text: '#EBF8F6',
    },
    light: {
      bgApp: '#F1F8F7',
      bgSurface: '#FFFFFF',
      bgSurfaceElevated: '#FFFFFF',
      bgSurfaceSubtle: '#E1F1EF',
      border: '#C3E1DD',
      borderFocus: '#0D9488',
      textPrimary: '#11292B',
      textSecondary: '#3F6366',
      textMuted: '#72979A',
      accent: '#0D9488',
      accentHover: '#0F766E',
      accentSubtle: '#E0F7F5',
      accentForeground: '#FFFFFF',
      success: '#109868',
      successSubtle: '#E6F8F1',
      warning: '#C28124',
      warningSubtle: '#FBF3E6',
      danger: '#C2414B',
      dangerSubtle: '#FCECEE',
      info: '#0284C7',
      infoSubtle: '#E6F4FE',
      sidebarBg: '#E6F3F1',
      cardShadow: '0 2px 10px -2px rgba(17, 41, 43, 0.06)',
    },
    dark: {
      bgApp: '#0B161B',
      bgSurface: '#122229',
      bgSurfaceElevated: '#1A3039',
      bgSurfaceSubtle: '#0E1B21',
      border: '#233F4B',
      borderFocus: '#2DD4BF',
      textPrimary: '#EBF8F6',
      textSecondary: '#9EC5C2',
      textMuted: '#638C89',
      accent: '#14B8A6',
      accentHover: '#2DD4BF',
      accentSubtle: '#123534',
      accentForeground: '#061312',
      success: '#34D399',
      successSubtle: '#103328',
      warning: '#FBBF24',
      warningSubtle: '#322610',
      danger: '#F87171',
      dangerSubtle: '#36191D',
      info: '#38BDF8',
      infoSubtle: '#112B3C',
      sidebarBg: '#0E1B21',
      cardShadow: '0 4px 18px -2px rgba(0, 0, 0, 0.5)',
    },
  },

  solar_gold: {
    id: 'solar_gold',
    name: 'Solar Gold',
    description: 'Warm forest neutrals illuminated by sunlit amber and burnished gold accents',
    unlockedByDefault: false,
    unlockCondition: {
      type: 'achievement',
      requiredAchievementId: 'focus_300',
      requiredAchievementTitle: 'Flow State Veteran',
      label: 'Unlock "Flow State Veteran" badge',
    },
    previewSwatches: {
      bg: '#FAF7F0',
      surface: '#FFFFFF',
      accent: '#B4781E',
      text: '#28231B',
    },
    light: {
      bgApp: '#FAF7F0',
      bgSurface: '#FFFFFF',
      bgSurfaceElevated: '#FFFFFF',
      bgSurfaceSubtle: '#F3ECE0',
      border: '#E4D8C3',
      borderFocus: '#B4781E',
      textPrimary: '#28231B',
      textSecondary: '#645A4A',
      textMuted: '#998C78',
      accent: '#B4781E',
      accentHover: '#966215',
      accentSubtle: '#FBF1DF',
      accentForeground: '#FFFFFF',
      success: '#3F7A52',
      successSubtle: '#EAF5EE',
      warning: '#C97A16',
      warningSubtle: '#FCF3E3',
      danger: '#BD423A',
      dangerSubtle: '#FCECEB',
      info: '#3E6B89',
      infoSubtle: '#EBF3F8',
      sidebarBg: '#F4EFE4',
      cardShadow: '0 2px 10px -2px rgba(40, 35, 27, 0.06)',
    },
    dark: {
      bgApp: '#171511',
      bgSurface: '#211E18',
      bgSurfaceElevated: '#2D2820',
      bgSurfaceSubtle: '#1B1813',
      border: '#3B3429',
      borderFocus: '#E5A93B',
      textPrimary: '#F5F0E6',
      textSecondary: '#B8AD99',
      textMuted: '#807664',
      accent: '#E5A93B',
      accentHover: '#F0BC59',
      accentSubtle: '#362913',
      accentForeground: '#17140E',
      success: '#5CA874',
      successSubtle: '#182C1E',
      warning: '#EBA434',
      warningSubtle: '#332410',
      danger: '#DE6158',
      dangerSubtle: '#341A18',
      info: '#629BC2',
      infoSubtle: '#162634',
      sidebarBg: '#1B1813',
      cardShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.48)',
    },
  },

  sage_garden: {
    id: 'sage_garden',
    name: 'Sage Garden',
    description: 'Calming botanical greens, eucalyptus tones, and warm earth neutrals',
    unlockedByDefault: true,
    unlockCondition: {
      type: 'default',
      label: 'Default Theme',
    },
    previewSwatches: {
      bg: '#F5F7F4',
      surface: '#FFFFFF',
      accent: '#3E7051',
      text: '#1F2E23',
    },
    light: {
      bgApp: '#F5F7F4',
      bgSurface: '#FFFFFF',
      bgSurfaceElevated: '#FFFFFF',
      bgSurfaceSubtle: '#E8EFE6',
      border: '#D4DEC2',
      borderFocus: '#406E51',
      textPrimary: '#1F2E23',
      textSecondary: '#526658',
      textMuted: '#889B8D',
      accent: '#3E7051',
      accentHover: '#325B41',
      accentSubtle: '#E8F2EC',
      accentForeground: '#FFFFFF',
      success: '#38734A',
      successSubtle: '#EBF6EF',
      warning: '#A67424',
      warningSubtle: '#F9F2E6',
      danger: '#A8433C',
      dangerSubtle: '#F8ECEB',
      info: '#366C82',
      infoSubtle: '#E7F2F6',
      sidebarBg: '#ECF2EA',
      cardShadow: '0 2px 8px -2px rgba(31, 46, 35, 0.06)',
    },
    dark: {
      bgApp: '#121714',
      bgSurface: '#19211C',
      bgSurfaceElevated: '#222D26',
      bgSurfaceSubtle: '#151D18',
      border: '#2C3A31',
      borderFocus: '#57946D',
      textPrimary: '#EDF2EE',
      textSecondary: '#A9B8AD',
      textMuted: '#6C7D71',
      accent: '#57946D',
      accentHover: '#6EAA83',
      accentSubtle: '#1F3327',
      accentForeground: '#FFFFFF',
      success: '#4E9E67',
      successSubtle: '#162C1E',
      warning: '#C4943E',
      warningSubtle: '#2E2413',
      danger: '#C75850',
      dangerSubtle: '#2D1A19',
      info: '#529BB8',
      infoSubtle: '#162832',
      sidebarBg: '#151B17',
      cardShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.45)',
    },
  },

  lavender_haze: {
    id: 'lavender_haze',
    name: 'Lavender Haze',
    description: 'Soothing violet, dusk mauve, and soft heather reflections',
    unlockedByDefault: false,
    unlockCondition: {
      type: 'level',
      requiredLevel: 5,
      label: 'Reach Level 5',
    },
    previewSwatches: {
      bg: '#F8F6FA',
      surface: '#FFFFFF',
      accent: '#7C5295',
      text: '#261F2E',
    },
    light: {
      bgApp: '#F8F6FA',
      bgSurface: '#FFFFFF',
      bgSurfaceElevated: '#FFFFFF',
      bgSurfaceSubtle: '#EFEBF4',
      border: '#DFD8E8',
      borderFocus: '#7C5295',
      textPrimary: '#261F2E',
      textSecondary: '#625670',
      textMuted: '#978BA6',
      accent: '#7C5295',
      accentHover: '#67417E',
      accentSubtle: '#F2ECF7',
      accentForeground: '#FFFFFF',
      success: '#3F7A56',
      successSubtle: '#ECF5F0',
      warning: '#B57C26',
      warningSubtle: '#FAF3E8',
      danger: '#B3454B',
      dangerSubtle: '#FCEEF0',
      info: '#4B67A3',
      infoSubtle: '#EEF2FA',
      sidebarBg: '#F1ECF6',
      cardShadow: '0 2px 8px -2px rgba(38, 31, 46, 0.06)',
    },
    dark: {
      bgApp: '#15121A',
      bgSurface: '#1D1924',
      bgSurfaceElevated: '#282332',
      bgSurfaceSubtle: '#191520',
      border: '#352E42',
      borderFocus: '#A070BF',
      textPrimary: '#F2EDF7',
      textSecondary: '#B7ACCC',
      textMuted: '#796F8C',
      accent: '#A070BF',
      accentHover: '#B588D4',
      accentSubtle: '#2F1E3D',
      accentForeground: '#FFFFFF',
      success: '#59A675',
      successSubtle: '#182C20',
      warning: '#D49B45',
      warningSubtle: '#332613',
      danger: '#CF5961',
      dangerSubtle: '#33191C',
      info: '#6C8FD6',
      infoSubtle: '#18243E',
      sidebarBg: '#191520',
      cardShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.45)',
    },
  },

  sunset: {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm coral, amber dusk, and rich plum undercurrents',
    unlockedByDefault: false,
    unlockCondition: {
      type: 'achievement',
      requiredAchievementId: 'habit_7d',
      requiredAchievementTitle: 'Weekly Anchor',
      label: 'Unlock "Weekly Anchor" badge',
    },
    previewSwatches: {
      bg: '#FAF6F4',
      surface: '#FFFFFF',
      accent: '#D45D3A',
      text: '#2E221E',
    },
    light: {
      bgApp: '#FAF6F4',
      bgSurface: '#FFFFFF',
      bgSurfaceElevated: '#FFFFFF',
      bgSurfaceSubtle: '#F4ECE6',
      border: '#E8DAD0',
      borderFocus: '#D45D3A',
      textPrimary: '#2E221E',
      textSecondary: '#6F5B53',
      textMuted: '#A38E86',
      accent: '#D45D3A',
      accentHover: '#BC4B2A',
      accentSubtle: '#FBEEE8',
      accentForeground: '#FFFFFF',
      success: '#477C57',
      successSubtle: '#ECF5EE',
      warning: '#C97D1E',
      warningSubtle: '#FAF2E6',
      danger: '#C43D41',
      dangerSubtle: '#FBECED',
      info: '#4B6B96',
      infoSubtle: '#EEF2F8',
      sidebarBg: '#F5ECE5',
      cardShadow: '0 2px 8px -2px rgba(46, 34, 30, 0.06)',
    },
    dark: {
      bgApp: '#191312',
      bgSurface: '#241B19',
      bgSurfaceElevated: '#312522',
      bgSurfaceSubtle: '#1E1614',
      border: '#3D2D29',
      borderFocus: '#E86E4A',
      textPrimary: '#F6EEEB',
      textSecondary: '#BDAAA3',
      textMuted: '#82706A',
      accent: '#E86E4A',
      accentHover: '#F28362',
      accentSubtle: '#3B2018',
      accentForeground: '#FFFFFF',
      success: '#5DA371',
      successSubtle: '#182B1E',
      warning: '#E29738',
      warningSubtle: '#332310',
      danger: '#D9575A',
      dangerSubtle: '#36181A',
      info: '#668EC4',
      infoSubtle: '#172436',
      sidebarBg: '#1F1614',
      cardShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.45)',
    },
  },

  monochrome: {
    id: 'monochrome',
    name: 'Monochrome',
    description: 'Clean architectural grayscale with focused contrast',
    unlockedByDefault: true,
    unlockCondition: {
      type: 'default',
      label: 'Default Theme',
    },
    previewSwatches: {
      bg: '#F5F5F5',
      surface: '#FFFFFF',
      accent: '#262626',
      text: '#171717',
    },
    light: {
      bgApp: '#F5F5F5',
      bgSurface: '#FFFFFF',
      bgSurfaceElevated: '#FFFFFF',
      bgSurfaceSubtle: '#EAEAEA',
      border: '#D4D4D4',
      borderFocus: '#171717',
      textPrimary: '#171717',
      textSecondary: '#525252',
      textMuted: '#8A8A8A',
      accent: '#262626',
      accentHover: '#0A0A0A',
      accentSubtle: '#F0F0F0',
      accentForeground: '#FFFFFF',
      success: '#15803D',
      successSubtle: '#F0FDF4',
      warning: '#B45309',
      warningSubtle: '#FFFBEB',
      danger: '#B91C1C',
      dangerSubtle: '#FEF2F2',
      info: '#0369A1',
      infoSubtle: '#F0F9FF',
      sidebarBg: '#ECECEC',
      cardShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.05)',
    },
    dark: {
      bgApp: '#121212',
      bgSurface: '#1A1A1A',
      bgSurfaceElevated: '#242424',
      bgSurfaceSubtle: '#161616',
      border: '#2E2E2E',
      borderFocus: '#E5E5E5',
      textPrimary: '#F5F5F5',
      textSecondary: '#A3A3A3',
      textMuted: '#6B6B6B',
      accent: '#E5E5E5',
      accentHover: '#FFFFFF',
      accentSubtle: '#2E2E2E',
      accentForeground: '#121212',
      success: '#22C55E',
      successSubtle: '#14301D',
      warning: '#F59E0B',
      warningSubtle: '#332410',
      danger: '#EF4444',
      dangerSubtle: '#381A1B',
      info: '#38BDF8',
      infoSubtle: '#122B38',
      sidebarBg: '#161616',
      cardShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.5)',
    },
  },
};

export function isValidThemePresetKey(key: unknown): key is ThemePresetKey {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(THEME_PRESETS, key);
}

export function isThemeUnlocked(
  themeId: string,
  context: ThemeUnlockContext
): boolean {
  if (!isValidThemePresetKey(themeId)) return false;
  const preset = THEME_PRESETS[themeId];
  if (preset.unlockedByDefault || preset.unlockCondition.type === 'default') {
    return true;
  }

  const safeLevel = Number.isFinite(context.level) && context.level >= 1 ? Math.floor(context.level) : 1;
  const unlockedSet =
    context.unlockedAchievementIds instanceof Set
      ? context.unlockedAchievementIds
      : new Set(context.unlockedAchievementIds || []);

  if (preset.unlockCondition.type === 'level') {
    return safeLevel >= preset.unlockCondition.requiredLevel;
  }

  if (preset.unlockCondition.type === 'achievement') {
    return unlockedSet.has(preset.unlockCondition.requiredAchievementId);
  }

  return false;
}

export function getThemeUnlockStatus(
  themeId: ThemePresetKey,
  context: ThemeUnlockContext
): {
  unlocked: boolean;
  label: string;
  progressPercent: number;
  requiredLevel?: number;
  requiredAchievementId?: string;
  requiredAchievementTitle?: string;
} {
  const preset = THEME_PRESETS[themeId];
  const unlocked = isThemeUnlocked(themeId, context);
  const safeLevel = Number.isFinite(context.level) && context.level >= 1 ? Math.floor(context.level) : 1;

  if (preset.unlockCondition.type === 'default') {
    return {
      unlocked: true,
      label: preset.unlockCondition.label,
      progressPercent: 100,
    };
  }

  if (preset.unlockCondition.type === 'level') {
    const req = preset.unlockCondition.requiredLevel;
    const progressPercent = unlocked
      ? 100
      : Math.min(99, Math.max(0, Math.round((safeLevel / Math.max(1, req)) * 100)));
    return {
      unlocked,
      label: preset.unlockCondition.label,
      progressPercent,
      requiredLevel: req,
    };
  }

  return {
    unlocked,
    label: preset.unlockCondition.label,
    progressPercent: unlocked ? 100 : 0,
    requiredAchievementId: preset.unlockCondition.requiredAchievementId,
    requiredAchievementTitle: preset.unlockCondition.requiredAchievementTitle,
  };
}

export function resolveEligibleThemePreset(
  requestedPreset: unknown,
  context: ThemeUnlockContext
): ThemePresetKey {
  if (isValidThemePresetKey(requestedPreset) && isThemeUnlocked(requestedPreset, context)) {
    return requestedPreset;
  }
  return DEFAULT_THEME_PRESET;
}

export function getNewlyUnlockedThemes(
  previousContext: ThemeUnlockContext,
  nextContext: ThemeUnlockContext
): PresetDefinition[] {
  const keys = Object.keys(THEME_PRESETS) as ThemePresetKey[];
  return keys
    .filter(
      key =>
        !isThemeUnlocked(key, previousContext) &&
        isThemeUnlocked(key, nextContext)
    )
    .map(key => THEME_PRESETS[key]);
}

