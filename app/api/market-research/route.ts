import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const { company_name, company_url, client_id } = await request.json()

  let prompt: string
  let max_tokens = 8096

  if (client_id) {
    const supabase = await createClient()

    const [profileRes, s2Res, s3Res, attachRes] = await Promise.all([
      supabase.from('profiles').select('company_name, email').eq('id', client_id).single(),
      supabase.from('stage2_onboarding').select('*').eq('client_id', client_id).maybeSingle(),
      supabase.from('onboarding_forms').select('*').eq('client_id', client_id).maybeSingle(),
      supabase.from('client_attachments').select('name, url, type').eq('client_id', client_id),
    ])

    const profile = profileRes.data
    const s2 = s2Res.data
    const s3 = s3Res.data
    const attachments = attachRes.data

    if (!profile) return new Response('Client not found', { status: 404 })

    const clientCompany = profile.company_name || profile.email
    const offerDesc = s3?.offer_description || s2?.biggest_problem || 'N/A'
    const industries = Array.isArray(s3?.industries) ? s3.industries.join(', ') : s3?.industries || 'N/A'
    const bestCustomer = s2?.best_client_description || s3?.best_customer_description || 'N/A'
    const resultDelivered = s2?.result_delivered || 'N/A'
    const whySaidYes = s2?.why_said_yes || 'N/A'
    const dealSize = s3?.deal_size_range || 'N/A'
    const ctaType = s3?.cta_type || 'N/A'
    const jobTitles = Array.isArray(s3?.job_titles_include) ? s3.job_titles_include.join(', ') : s3?.job_titles_include || 'N/A'

    // Fetch the primary linked URL to ground research in actual website copy (1 URL, tightly trimmed)
    const linkUrls = attachments?.filter(a => a.type === 'link' && a.url?.startsWith('http')) || []
    let websiteContent = ''
    if (linkUrls.length > 0) {
      try {
        const r = await fetch(linkUrls[0].url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research-bot/1.0)' },
          signal: AbortSignal.timeout(6000),
        })
        const html = await r.text()
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 1200)
        if (text.length > 100) websiteContent = `\n\nWebsite (${linkUrls[0].url}): ${text}`
      } catch {
        // skip unreachable URL
      }
    }

    const attachmentContext = attachments?.length
      ? `\nAttachments/links: ${attachments.map(a => `${a.name}: ${a.url}`).join(', ')}`
      : ''

    prompt = `You are a founder and GTM mentor who just spent 2 hours auditing this client's business and website. Write the report the way you'd debrief them on a call. Direct. Conversational. Specific. You believe in them, and you're going to tell them exactly what to fix.

Tone rules:
- Sound like a person, not a consultant. Short sentences. Real talk.
- Open each section with what they're doing right, then pivot to the gap.
- No em-dashes. Use commas or periods instead.
- No corporate language ("leverage", "utilize", "optimize"). Say what you mean.
- Specific numbers and examples always beat vague statements.
- Do NOT start with any research narration, preamble, or summary of findings. The very first characters of your response must be "## Section 1".
- Do NOT write anything like "Now I have enough data" or "Based on my research" or "I can confirm". Just write the report.
- Format: ## for section headers, ### for subheaders, - for top-level bullets only. No nested bullets or indented sub-bullets.
- Never use a bullet point as a subheading. If something would be a labelled sub-item (e.g. "Book a Door Growth Audit"), make it a ### header instead.
- No ** markers anywhere.

CLIENT DATA (use this, not the company name, to understand the business)
Company: ${clientCompany} | Does: ${offerDesc} | Serves: ${industries}, targeting ${jobTitles}
Best customer: ${bestCustomer} | Result delivered: ${resultDelivered}
Why they buy: ${whySaidYes} | Deal size: ${dealSize} | CTA: ${ctaType}${attachmentContext}${websiteContent}

---

## Section 1: Offer & CTA Analysis
### What's Already Working
2-3 sentences of specific, genuine praise. What are they doing right? Niche focus, clarity, delivery model? Make them feel seen.
### Current Offer Assessment
Is the offer about outcomes or features? Does the CTA match the deal size? What is the single biggest gap?
### Recommended CTA Improvements
3 CTAs that would convert better. For each: name it, say why it works in one sentence, give the exact copy.
### Offer Reframe
Rewrite their offer in 2-3 sentences. Lead with the outcome. Name the buyer. Include a guarantee or risk-reversal.

---

## Section 2: Direct Competitor Snapshot
Use web search. Find 2-3 real direct competitors doing the same service for the same buyer. If fewer exist, just cover what's there. No SaaS tools or CRMs unless client is SaaS.
For each: ### [Company Name] (URL) then bullets covering what they do, their front-end offer or CTA, how they position, pricing, one strength and one weakness.

---

## Section 3: Website Copy & Positioning Gaps
### Above-the-Fold Headline
2 headline examples. Each should name the outcome, name the buyer, and kill the biggest objection in one line.
### Pain Points to Lead With
3 pain points. Write them exactly how the buyer says it at 11pm when they're frustrated.
### Missing Elements
What's missing from their site that's costing them conversions? Credibility signals, proof formats, page sections.

---

## Section 4: Testimonial & Proof Strategy
### What Converts in This Niche
What testimonial format works best for this buyer type? Why?
### Metrics to Lead With
5 specific outcome metrics they should be collecting and showing. Make them niche-specific.
### Ideal Case Study Structure
5-part case study structure that fits their deal size and industry.`

  } else {
    if (!company_name) return new Response('company_name required', { status: 400 })
    max_tokens = 8096

    prompt = `You are a B2B market research analyst. Produce a structured market intelligence report for ${company_name}${company_url ? ` (${company_url})` : ''}. Use ## for section headers, ### for subsections, - for bullets.

## Company Analysis
Core offerings, revenue model, market presence, team structure.

## Market Landscape
TAM size and growth, market segments, buyer journey, regulatory environment.

## Value Proposition
Primary value drivers, ROI metrics, competitive advantages, pricing power.

## Competitive Intelligence
Direct competitors (name them), indirect alternatives, gaps and white space, win/loss factors.

## Go-To-Market Challenges
Sales cycle friction, buyer education needs, channel dynamics, budget patterns.

Be specific. Include real company names and data where known.`
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 } as any],
    messages: [{ role: 'user', content: prompt }],
  })

  // Extract only text blocks from the response (tool_use/tool_result blocks are search internals)
  let text = message.content
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((b: any) => b.type === 'text')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((b: any) => b.text as string)
    .join('')

  // Strip any preamble/note before the first ## header
  const firstHeader = text.indexOf('\n## ')
  if (firstHeader > 0) text = text.slice(firstHeader).trimStart()

  return new Response(text, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
