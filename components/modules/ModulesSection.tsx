'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Play, Clock, CheckCircle } from 'lucide-react'
import { GlowingEffect } from '@/components/ui/glowing-effect'

const MODULES = [
  {
    id: 1,
    title: 'Welcome to NorthStar',
    description: 'A walkthrough of your dashboard and what to expect over the next few days.',
    duration: '2 min',
    category: 'Getting Started',
    color: '#5E6AD2',
  },
  {
    id: 2,
    title: 'Understanding Your ICP',
    description: 'Why ideal customer profiling is the foundation of every successful outreach campaign.',
    duration: '4 min',
    category: 'Strategy',
    color: '#2ECC71',
  },
  {
    id: 3,
    title: 'Email Warmup Explained',
    description: "What's happening in the background before your campaign goes live — and why it matters.",
    duration: '3 min',
    category: 'Technical',
    color: '#E67E22',
  },
  {
    id: 4,
    title: 'Reading Your Analytics',
    description: 'How to interpret open rates, reply rates, and positive sentiment to gauge campaign health.',
    duration: '5 min',
    category: 'Analytics',
    color: '#9B59B6',
  },
  {
    id: 5,
    title: 'Your Campaign Goes Live',
    description: 'What to expect on launch day, the ramp-up period, and when you start seeing replies.',
    duration: '3 min',
    category: 'Launch',
    color: '#E74C3C',
  },
  {
    id: 6,
    title: 'Converting Replies into Revenue',
    description: 'Best practices for following up on interested prospects and getting them booked.',
    duration: '6 min',
    category: 'Sales',
    color: '#3498DB',
  },
]

export default function ModulesSection() {
  const [watched, setWatched] = useState<Set<number>>(new Set())

  const toggle = (id: number) =>
    setWatched(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-medium text-white mb-1">Training Modules</h2>
        <p className="text-[13px] text-[#6B6B6B]">
          Short videos to help you get the most from your campaign.{' '}
          <span className="text-[#5E6AD2]">
            {watched.size}/{MODULES.length} watched
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MODULES.map((mod, i) => (
          <motion.div
            key={mod.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="relative rounded-xl border border-[#1E1E1E] bg-[#0F0F0F] overflow-hidden"
          >
            <GlowingEffect spread={20} glow={false} disabled={false} proximity={60} borderWidth={1} />

            {/* Thumbnail */}
            <div
              className="relative aspect-video bg-[#141414] flex items-center justify-center cursor-pointer group"
              onClick={() => toggle(mod.id)}
            >
              {/* Placeholder gradient */}
              <div
                className="absolute inset-0 opacity-10"
                style={{ background: `radial-gradient(ellipse at 30% 50%, ${mod.color}, transparent 70%)` }}
              />

              <div className="w-12 h-12 rounded-full bg-white/8 border border-white/15 flex items-center justify-center group-hover:bg-white/12 transition-colors">
                <Play size={18} className="text-white ml-0.5" fill="white" />
              </div>

              {/* Module number */}
              <span className="absolute top-3 left-3 text-[11px] font-semibold text-white/25">
                {String(mod.id).padStart(2, '0')}
              </span>

              {/* Duration */}
              <div className="absolute bottom-3 right-3 flex items-center gap-1 text-[11px] text-white/40">
                <Clock size={11} />
                {mod.duration}
              </div>

              {/* Watched badge */}
              {watched.has(mod.id) && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute top-3 right-3"
                >
                  <CheckCircle size={18} className="text-[#2ECC71]" />
                </motion.div>
              )}
            </div>

            {/* Content */}
            <div className="p-4">
              <span
                className="inline-block text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded mb-2"
                style={{ color: mod.color, background: `${mod.color}18` }}
              >
                {mod.category}
              </span>
              <h3 className="text-[14px] font-medium text-white mb-1">{mod.title}</h3>
              <p className="text-[12px] text-[#6B6B6B] leading-relaxed">{mod.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
