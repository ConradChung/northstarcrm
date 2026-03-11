export type ThemeId = 'midnight' | 'frost' | 'linear' | 'stark'
export type AccentId = 'blue' | 'purple' | 'green' | 'orange' | 'rose' | 'cyan'

export interface ThemePalette {
  id: ThemeId
  name: string
  bg: string
  surface: string
  surfaceRaised: string
  border: string
  borderSubtle: string
  textPrimary: string
  textSecondary: string
  textTertiary: string
  textPlaceholder: string
  // preview swatch colors for the settings card
  previewBg: string
  previewSurface: string
  previewBorder: string
}

export const THEMES: ThemePalette[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    bg: '#0A0A0A',
    surface: '#111111',
    surfaceRaised: '#0F0F0F',
    border: '#1E1E1E',
    borderSubtle: '#1A1A1A',
    textPrimary: '#FFFFFF',
    textSecondary: '#5A5A5A',
    textTertiary: '#3A3A3A',
    textPlaceholder: '#4A4A4A',
    previewBg: '#0A0A0A',
    previewSurface: '#111111',
    previewBorder: '#1E1E1E',
  },
  {
    id: 'frost',
    name: 'Frost',
    bg: '#EFEFEF',
    surface: '#FFFFFF',
    surfaceRaised: '#F8F8F8',
    border: '#E0E0E0',
    borderSubtle: '#EBEBEB',
    textPrimary: '#0A0A0A',
    textSecondary: '#6B6B6B',
    textTertiary: '#9A9A9A',
    textPlaceholder: '#BABABA',
    previewBg: '#EFEFEF',
    previewSurface: '#FFFFFF',
    previewBorder: '#E0E0E0',
  },
  {
    id: 'linear',
    name: 'Linear',
    bg: '#0B0B0F',
    surface: '#16161E',
    surfaceRaised: '#1C1C26',
    border: '#2A2A3A',
    borderSubtle: '#222230',
    textPrimary: '#FFFFFF',
    textSecondary: '#7B7F9E',
    textTertiary: '#4A4D6A',
    textPlaceholder: '#3A3D5A',
    previewBg: '#0B0B0F',
    previewSurface: '#16161E',
    previewBorder: '#2A2A3A',
  },
  {
    id: 'stark',
    name: 'Stark',
    bg: '#FFFFFF',
    surface: '#FAFAFA',
    surfaceRaised: '#F5F5F5',
    border: '#000000',
    borderSubtle: '#333333',
    textPrimary: '#000000',
    textSecondary: '#333333',
    textTertiary: '#666666',
    textPlaceholder: '#999999',
    previewBg: '#FFFFFF',
    previewSurface: '#FAFAFA',
    previewBorder: '#000000',
  },
]

export interface AccentColor {
  id: AccentId
  name: string
  value: string
  fg: string // text color on top of accent background
}

export const ACCENTS: AccentColor[] = [
  { id: 'blue',   name: 'Blue',   value: '#3B82F6', fg: '#FFFFFF' },
  { id: 'purple', name: 'Purple', value: '#8B5CF6', fg: '#FFFFFF' },
  { id: 'green',  name: 'Green',  value: '#10B981', fg: '#FFFFFF' },
  { id: 'orange', name: 'Orange', value: '#F59E0B', fg: '#000000' },
  { id: 'rose',   name: 'Rose',   value: '#F43F5E', fg: '#FFFFFF' },
  { id: 'cyan',   name: 'Cyan',   value: '#06B6D4', fg: '#000000' },
]

export const DEFAULT_THEME: ThemeId = 'midnight'
export const DEFAULT_ACCENT: AccentId = 'blue'
