'use client'

import { motion } from 'framer-motion'

interface Props {
  onViewCampaign?: () => void
  onViewModules?: () => void
  hasCampaign: boolean
}

const NEXT_STEPS = [
  'Our team reviews your ICP and builds your lead list',
  'Email inboxes enter the warmup period (5–7 days)',
  'Campaign goes live — you start receiving replies',
]

export default function OnboardingComplete({ onViewCampaign, onViewModules, hasCampaign }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {/* Animated checkmark */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="relative mb-6"
      >
        <svg
          className="w-16 h-16 text-[#5E6AD2]"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="32" cy="32" r="30" strokeOpacity="0.15" />
          <path
            d="M20 32l9 9 15-18"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 40,
              strokeDashoffset: 0,
              animation: 'draw-check 0.5s 0.2s ease both',
            }}
          />
        </svg>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-xl font-medium text-[var(--text-primary)] mb-2">You're all set.</h2>
        <p className="text-[var(--text-secondary)] text-[14px] max-w-sm">
          We'll have your campaign ready within 48 hours. You'll hear from us shortly.
        </p>
      </motion.div>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="flex flex-col sm:flex-row gap-3 mt-8"
      >
        {onViewModules && (
          <button
            onClick={onViewModules}
            className="px-5 py-2.5 bg-[#5E6AD2] text-[var(--text-primary)] text-[13px] font-medium rounded-lg hover:bg-[#5060C2] transition-colors"
          >
            Explore Training Modules
          </button>
        )}
        {hasCampaign && onViewCampaign && (
          <button
            onClick={onViewCampaign}
            className="px-5 py-2.5 bg-white/5 border border-white/10 text-[var(--text-primary)] text-[13px] font-medium rounded-lg hover:bg-white/8 transition-colors"
          >
            View Campaign Analytics
          </button>
        )}
      </motion.div>

      {/* Next steps */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-12 border-t border-[var(--border)] pt-8 text-left w-full max-w-sm"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-placeholder)] mb-4">
          What happens next
        </p>
        <ol className="space-y-3">
          {NEXT_STEPS.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-[var(--border-subtle)] border border-[var(--border)] text-[var(--text-secondary)] text-[11px] flex items-center justify-center shrink-0 mt-0.5 font-medium">
                {i + 1}
              </span>
              <span className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </motion.div>

      <style>{`
        @keyframes draw-check {
          from { stroke-dashoffset: 40; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  )
}
