import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const { client_id } = await request.json()
  if (!client_id) return new Response('client_id required', { status: 400 })

  const supabase = await createClient()

  const [s3res, s2res] = await Promise.all([
    supabase.from('onboarding_forms').select('*').eq('client_id', client_id).maybeSingle(),
    supabase.from('stage2_onboarding').select('*').eq('client_id', client_id).maybeSingle(),
  ])

  const s3 = s3res.data
  const s2 = s2res.data

  if (!s3 && !s2) return new Response('No ICP data found for this client', { status: 404 })

  const { data: attachments } = await supabase
    .from('client_attachments')
    .select('name, url, type')
    .eq('client_id', client_id)

  const attachmentContext = attachments?.length
    ? `\nCLIENT REFERENCE MATERIALS:\n${attachments.map(a => `- ${a.name} (${a.type}): ${a.url}`).join('\n')}\n`
    : ''

  const locations = Array.isArray(s3?.locations) ? s3.locations : []
  const industries = Array.isArray(s3?.industries) ? s3.industries : []

  const prompt = `You are a Clay.com expert. Generate exactly 4 Clay column prompt templates for a B2B outbound campaign.

CLIENT ICP DATA:
Industries: ${industries.join(', ') || 'N/A'}
Locations: ${locations.join(', ') || 'N/A'}
Job titles (target): ${Array.isArray(s3?.job_titles_include) ? s3.job_titles_include.join(', ') : s3?.job_titles_include || s2?.best_client_description || 'N/A'}
Offer: ${s3?.offer_description || s2?.biggest_problem || 'N/A'}
${attachmentContext}
Best customer: ${s3?.best_customer_description || s2?.best_client_description || 'N/A'}

CANVAS SPEC — Generate these 4 prompts exactly:

1. LOCATION PROMPT
Generate a short phrase mentioning 3 service areas + 1 main city where this prospect operates. Used for personalization in cold emails (e.g. "serving Dallas, Austin, and Houston").

2. ACHIEVEMENTS PROMPT
Find a recent achievement, award, milestone, or growth signal for this company. Used for signal-based sending. Should feel like you noticed something specific (e.g. "just closed a Series A", "recently ranked #1 in X", "just expanded to Y market").

3. LINKEDIN POST PROMPT (for Sales Nav leads)
Summarize the prospect's most recent LinkedIn post in one sentence, in a way that creates a natural conversation opener. If no post found, return a relevant industry insight they'd likely care about.

4. GOOGLE REVIEWS PROMPT (for local/SMB businesses)
Return the number of Google Reviews and average rating for this company. Format as: "X reviews, Y★". If not applicable (enterprise/SaaS), return "N/A — enterprise prospect".

OUTPUT FORMAT — Return a JSON array of exactly 4 objects:
[
  {
    "id": "location",
    "title": "Location Personalization",
    "description": "One sentence explaining what this prompt does",
    "prompt": "The full Clay prompt text to paste into a Clay column"
  },
  {
    "id": "achievements",
    "title": "Achievement Signal",
    "description": "...",
    "prompt": "..."
  },
  {
    "id": "linkedin_post",
    "title": "LinkedIn Post Opener",
    "description": "...",
    "prompt": "..."
  },
  {
    "id": "google_reviews",
    "title": "Google Reviews",
    "description": "...",
    "prompt": "..."
  }
]

Make the prompt text specific to this client's ICP data. Return ONLY the JSON array, no other text.`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = (message.content[0] as { type: string; text: string }).text.trim()
  let prompts = []
  try {
    const match = raw.match(/\[[\s\S]*\]/)
    prompts = match ? JSON.parse(match[0]) : []
  } catch {
    return new Response('Failed to parse prompts', { status: 500 })
  }

  return Response.json({ prompts })
}
