'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  THEMES, ACCENTS, DEFAULT_THEME, DEFAULT_ACCENT,
  type ThemeId, type AccentId, type ThemePalette, type AccentColor,
} from '@/lib/themes'

interface ThemeContextValue {
  themeId: ThemeId
  accentId: AccentId
  theme: ThemePalette
  accent: AccentColor
  setTheme: (id: ThemeId) => void
  setAccent: (id: AccentId) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyTheme(theme: ThemePalette, accent: AccentColor) {
  const root = document.documentElement
  root.style.setProperty('--bg', theme.bg)
  root.style.setProperty('--surface', theme.surface)
  root.style.setProperty('--surface-raised', theme.surfaceRaised)
  root.style.setProperty('--border', theme.border)
  root.style.setProperty('--border-subtle', theme.borderSubtle)
  root.style.setProperty('--text-primary', theme.textPrimary)
  root.style.setProperty('--text-secondary', theme.textSecondary)
  root.style.setProperty('--text-tertiary', theme.textTertiary)
  root.style.setProperty('--text-placeholder', theme.textPlaceholder)
  root.style.setProperty('--accent', accent.value)
  root.style.setProperty('--accent-fg', accent.fg)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('ns_theme') as ThemeId) || DEFAULT_THEME
    }
    return DEFAULT_THEME
  })

  const [accentId, setAccentId] = useState<AccentId>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('ns_accent') as AccentId) || DEFAULT_ACCENT
    }
    return DEFAULT_ACCENT
  })

  const theme = THEMES.find(t => t.id === themeId) ?? THEMES[0]
  const accent = ACCENTS.find(a => a.id === accentId) ?? ACCENTS[0]

  useEffect(() => {
    applyTheme(theme, accent)
  }, [theme, accent])

  const setTheme = (id: ThemeId) => {
    setThemeId(id)
    localStorage.setItem('ns_theme', id)
  }

  const setAccent = (id: AccentId) => {
    setAccentId(id)
    localStorage.setItem('ns_accent', id)
  }

  return (
    <ThemeContext.Provider value={{ themeId, accentId, theme, accent, setTheme, setAccent }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
