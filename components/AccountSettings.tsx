'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { THEMES, ACCENTS, type ThemeId, type AccentId } from '@/lib/themes'
import { Check } from 'lucide-react'

export default function AccountSettings() {
  const { themeId, accentId, setTheme, setAccent } = useTheme()

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-10">
      {/* Header */}
      <div>
        <h2 className="text-[17px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          Account Settings
        </h2>
        <p className="text-[13px] mt-1" style={{ color: 'var(--text-secondary)' }}>
          Personalise your workspace appearance.
        </p>
      </div>

      {/* Theme */}
      <section className="space-y-4">
        <div>
          <h3 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>Theme</h3>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>Choose your preferred colour scheme.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {THEMES.map(t => {
            const active = t.id === themeId
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id as ThemeId)}
                className="relative rounded-xl p-3 text-left transition-all focus:outline-none"
                style={{
                  background: t.previewBg,
                  border: active
                    ? `2px solid var(--accent)`
                    : `2px solid ${t.previewBorder}`,
                  boxShadow: active ? `0 0 0 1px var(--accent)` : 'none',
                }}
              >
                {/* Mini preview */}
                <div className="w-full h-14 rounded-lg mb-3 overflow-hidden flex gap-1.5 p-1.5"
                  style={{ background: t.previewBg }}>
                  {/* Sidebar strip */}
                  <div className="w-5 h-full rounded-md flex-shrink-0"
                    style={{ background: t.previewSurface, border: `1px solid ${t.previewBorder}` }}>
                    <div className="mt-1.5 mx-1 space-y-1">
                      {[40, 55, 45].map((w, i) => (
                        <div key={i} className="rounded-sm h-1" style={{ width: `${w}%`, background: t.previewBorder }} />
                      ))}
                    </div>
                  </div>
                  {/* Main area */}
                  <div className="flex-1 rounded-md"
                    style={{ background: t.previewSurface, border: `1px solid ${t.previewBorder}` }}>
                    <div className="p-1.5 space-y-1">
                      {[80, 60, 70].map((w, i) => (
                        <div key={i} className="rounded-sm h-1" style={{ width: `${w}%`, background: t.previewBorder }} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Label row */}
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium" style={{ color: t.textPrimary }}>
                    {t.name}
                  </span>
                  {active && (
                    <span className="w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--accent)' }}>
                      <Check size={10} color="var(--accent-fg)" strokeWidth={3} />
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border)' }} />

      {/* Accent colour */}
      <section className="space-y-4">
        <div>
          <h3 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>Accent Colour</h3>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Applied to active states, buttons and highlights.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {ACCENTS.map(a => {
            const active = a.id === accentId
            return (
              <button
                key={a.id}
                onClick={() => setAccent(a.id as AccentId)}
                title={a.name}
                className="group flex flex-col items-center gap-1.5 focus:outline-none"
              >
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{
                    background: a.value,
                    boxShadow: active
                      ? `0 0 0 2px var(--surface), 0 0 0 4px ${a.value}`
                      : '0 0 0 2px transparent',
                    transform: active ? 'scale(1.1)' : undefined,
                  }}
                >
                  {active && <Check size={14} color={a.fg} strokeWidth={3} />}
                </span>
                <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{a.name}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border)' }} />

      {/* Preview strip */}
      <section className="space-y-3">
        <h3 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>Preview</h3>
        <div className="rounded-xl p-5 space-y-3"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <button className="px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
              style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}>
              Primary Button
            </button>
            <button className="px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
              style={{ background: 'var(--surface-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
              Secondary Button
            </button>
          </div>
          <input
            className="w-full px-3 py-2 rounded-lg text-[13px] focus:outline-none"
            style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
            placeholder="Input field preview…"
            readOnly
          />
          <div className="flex gap-2 flex-wrap">
            {['Label', 'Badge', 'Tag'].map(label => (
              <span key={label} className="px-2 py-0.5 rounded-md text-[11px]"
                style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
