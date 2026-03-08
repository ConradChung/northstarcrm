import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const { client_id } = await request.json()
  if (!client_id) return new Response('client_id required', { status: 400 })

  const supabase = await createClient()

  const [s2res, s3res] = await Promise.all([
    supabase.from('stage2_onboarding').select('*').eq('client_id', client_id).maybeSingle(),
    supabase.from('onboarding_forms').select('*').eq('client_id', client_id).maybeSingle(),
  ])

  const s2 = s2res.data
  const s3 = s3res.data

  if (!s2 && !s3) return new Response('No onboarding data found for this client', { status: 404 })

  const { data: attachments } = await supabase
    .from('client_attachments')
    .select('name, url, type')
    .eq('client_id', client_id)

  const attachmentContext = attachments?.length
    ? `\n=== CLIENT REFERENCE MATERIALS ===\n${attachments.map(a => `- ${a.name} (${a.type}): ${a.url}`).join('\n')}\n`
    : ''

  const onboardingData = `
=== DREAM CLIENT QUESTIONNAIRE (Stage 2) ===
Best client description: ${s2?.best_client_description || 'N/A'}
Biggest problem solved: ${s2?.biggest_problem || 'N/A'}
Why client said yes: ${s2?.why_said_yes || 'N/A'}
Result delivered: ${s2?.result_delivered || 'N/A'}
Red flags to avoid: ${s2?.red_flags || 'N/A'}
Ideal clone client: ${s2?.clone_client || 'N/A'}

=== ICP & TARGETING (Stage 3) ===
Industries: ${Array.isArray(s3?.industries) ? s3.industries.join(', ') : s3?.industries || 'N/A'}
Company size: ${Array.isArray(s3?.company_size) ? s3.company_size.join(', ') : s3?.company_size || 'N/A'}
Revenue ranges: ${Array.isArray(s3?.revenue_ranges) ? s3.revenue_ranges.join(', ') : s3?.revenue_ranges || 'N/A'}
Locations: ${Array.isArray(s3?.locations) ? s3.locations.join(', ') : s3?.locations || 'N/A'}
Job titles (target): ${Array.isArray(s3?.job_titles_include) ? s3.job_titles_include.join(', ') : s3?.job_titles_include || 'N/A'}
Offer description: ${s3?.offer_description || 'N/A'}
CTA type: ${s3?.cta_type || 'N/A'}
Deal size: ${s3?.deal_size_range || 'N/A'}
Best customer description: ${s3?.best_customer_description || 'N/A'}
Calendly/booking link: ${s3?.calendly_link || 'N/A'}
`

  const prompt = `You are a B2B cold email copywriter. Write a 5-email outreach set based on the client data below.

EMAIL 1 has 3 opening angle variants (A, B, C) — each uses a completely different hook AND a different CTA pattern.
EMAIL 2 is a short Follow-Up with a binary ultimatum CTA. EMAIL 3 is a soft closing reminder.

STRICT RULES — violations will break the output:
- Never use em-dashes (--) or M-dashes. Use commas or short sentences instead.
- Every email must open with "Hey {{first_name}}," or just "{{first_name}}," on its own line, followed by a blank line.
- The first sentence of the email body (after the blank line) must start with a capital letter.
- The first paragraph (after the greeting) can be 1-2 sentences. After that, every individual sentence gets its own paragraph with a blank line above it — EXCEPT sentences inside parentheses (brackets), which stay attached to the line above them with no blank line.
- Subject lines must be short (2-4 words) AND include a Clay personalization variable like {{company_name}} or {{first_name}} or {{location}} or {{industry}}. Use spintext format: {option1|option2|option3}
- Use Clay variables throughout the body where relevant: {{first_name}}, {{company_name}}, {{location}}, {{industry}}, {{operating_cities}}, {{google_reviews}}, {{recent_achievement}}, {{job_title}}. Pick the ones that fit naturally.
- Include a real client result or testimonial detail subtly woven into the copy (not a formal quote — just reference the outcome naturally).
- Never use "if that sounds relevant to you" or any soft opt-in phrasing. Every CTA must be confident.
- Each email under 75 words total (EMAIL 2 and 3 under 50 words).
- No reasoning summary, no explanations, no preamble, no intro text.
- Output ONLY the 5 emails in exact format below, nothing else.

CTA PATTERNS — use exactly one per variant:

EMAIL 1A — Soft FOMO CTA:
State the single best result delivered (with specifics). Then end with something like:
"If not, no worries at all!"
The tone should convey abundance, not desperation. No question — just a clear statement of value followed by a graceful out.

EMAIL 1B — Strong FOMO CTA:
Reference {{location}} or their specific market. Name the competitive pressure directly (other businesses in their area doing this). The final question should assume success and ask about their CAPACITY once it works — not whether it will work. Example: "Do you have the bandwidth to take on extra clients if we get this running for {{company_name}}?"

EMAIL 1C — Free Blueprint PDF CTA:
End with: "Want me to send our free Blueprint PDF over?"
Then on a new line in parentheses: "(Heads up: I only want to send this if you actually have the ops/capacity to take on [relevant outcome from client data] — this moves pretty fast once it's turned on.)"

${onboardingData}${attachmentContext}

---

## EMAIL 1A: Direct Offer
Subject: {option1|option2|option3}

Hey {{first_name}},

[Lead with the single best result or outcome delivered. Numbers if available. Reference a real result subtly woven in. Max 2 sentences per paragraph, blank line between. Use {{operating_cities}} or {{google_reviews}} if it fits. Soft FOMO CTA: state the value confidently, end with "If not, no worries at all!" — no question mark.]

Words: [N] | Variables: {{var1}}, {{var2}}

---

## EMAIL 1B: Industry Pain
Subject: {option1|option2|option3}

Hey {{first_name}},

[Name one painful pattern specific to this industry that quietly limits results. Max 2 sentences per paragraph, blank line between. Reference {{location}} or {{operating_cities}} and the competitive pressure there. Strong FOMO CTA: final question assumes success and asks about capacity after it works, not whether it will work. Example: "Do you have room to take on more once we get this live for {{company_name}}?"]

Words: [N] | Variables: {{var1}}, {{var2}}

---

## EMAIL 1C: Curiosity Hook
Subject: {option1|option2|option3}

{{first_name}},

[Open with a sharp, specific statement that names something uncomfortable or challenges an assumption. Max 2 sentences per paragraph, blank line between. Use {{google_reviews}}, {{recent_achievement}}, or {{industry}} if relevant. Free Blueprint PDF CTA: "Want me to send our free Blueprint PDF over?" then on a new line: "(Heads up: I only want to send this if you have the capacity to take on [specific outcome] — it moves pretty fast once it's on.)"]

Words: [N] | Variables: {{var1}}

---

## EMAIL 2: Follow-Up
Subject: {option1|option2|option3}

Hey {{first_name}},

[Short. One line referencing you reached out before. Give them exactly two options labeled A) and B) — one is a clear next step, one closes this out. Binary. Easy to reply to. Under 50 words.]

Words: [N] | Variables: {{var1}}

---

## EMAIL 3: Final Touch
Subject: {option1|option2|option3}

Hey {{first_name}},

[Soft, warm, no-pressure close. Acknowledge timing might be off. Leave the door open. No guilt, no urgency. One short invite to circle back. Under 50 words.]

Words: [N] | Variables: {{var1}}`

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 6000,
    messages: [{ role: 'user', content: prompt }],
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
