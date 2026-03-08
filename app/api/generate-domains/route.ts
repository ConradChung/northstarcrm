import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const { company_name } = await request.json()
  if (!company_name) {
    return NextResponse.json({ error: 'company_name required' }, { status: 400 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Generate exactly 30 short professional email domain name variations for a company called "${company_name}".

Rules:
- Each domain must be under 20 characters including the extension
- Mix of extensions: .com, .io, .co, .net (prioritize .com)
- Variations: abbreviations, initials, short forms, descriptive suffixes like "hq", "team", "app", "get", "use", "try"
- No spaces, only lowercase letters, numbers, and hyphens
- Make them sound professional and brandable
- Slight variations of the company name, not completely different names

Return ONLY a JSON array of 30 strings, no other text:
["example.com", "examplehq.com", ...]`,
    }],
  })

  const raw = (message.content[0] as { type: string; text: string }).text.trim()
  let domainList: string[] = []
  try {
    const match = raw.match(/\[[\s\S]*\]/)
    domainList = match ? JSON.parse(match[0]) : []
  } catch {
    domainList = []
  }

  // Check domain availability via RDAP (official ICANN protocol, no API key needed)
  // 404 = not registered (available), 200 = registered (taken)
  const domains = await Promise.all(
    domainList.slice(0, 30).map(async (name: string) => {
      try {
        const res = await fetch(
          `https://rdap.org/domain/${encodeURIComponent(name)}`,
          { signal: AbortSignal.timeout(5000) }
        )
        return { name, available: res.status === 404 }
      } catch {
        return { name, available: false }
      }
    })
  )

  return NextResponse.json({ domains })
}
