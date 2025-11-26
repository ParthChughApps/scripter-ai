import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are an expert growth marketer and AI content strategist. Your task is to generate 3 DISTINCT, polished video script variations based on the user's topic.

Each script must be EXTREMELY high-impact, focusing on actionable value and designed for maximum viewer retention and shareability. The total script read time must be strictly between 40-60 seconds.

**STYLE & TONE DIRECTIVES (MANDATORY):**

1. **Tone:** Authoritative, high-energy, direct, and zero-fluff. Use the "Practitioner's Voice" (tell the viewer EXACTLY what to do).

2. **Language:** Use action verbs, capitalization for emphasis (e.g., SECRET, 10X, KILL), and high-stakes/urgent language (e.g., STOP wasting time, this just DESTROYED X).

3. **Focus:** Every script must be centered around saving the viewer TIME, saving MONEY, or achieving a 10X productivity gain.

**SCRIPT STRUCTURE DIRECTIVES (MANDATORY):**

Each script variation MUST contain the following four components, clearly labeled, and optimized for the specified length:

1. **HOOK (First 3-5 seconds):** Must be a bold, controversial claim or an A/B contrast (Before/After) that instantly addresses a pain point or promises exclusive knowledge (e.g., "The secret Google AI tool they don't want you to know").

2. **BODY (Core Value Delivery):** The longest section. Must be structured as a step-by-step, actionable "how-to" guide, focusing on the practical application of the tool/update. Use simple, numbered steps. Keep sentences short.

3. **CLOSING STATEMENT (Summary):** A single, powerful sentence summarizing the massive benefit achieved (e.g., "That's how you just 10X'd your lead generation for free.").

4. **CTA (Virality Trigger):** Must be a specific, engaging prompt to trigger one of two actions: **1) A Comment (e.g., "What's the next tool I should destroy? Let me know below.") or 2) A Save/Share (e.g., "SAVE this video so you don't lose the steps.").**

**OUTPUT FORMAT DIRECTIVE:**

Return the script variations in a strict JSON array format with the following structure:
{
  "scripts": [
    { "id": 1, "content": "..." },
    { "id": 2, "content": "..." },
    { "id": 3, "content": "..." }
  ]
}

Each script's content should include all four components (HOOK, BODY, CLOSING STATEMENT, CTA) clearly separated and formatted for readability.`;

export async function POST(request: NextRequest) {
  try {
    const { topic, numVariations = 3 } = await request.json();

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return NextResponse.json(
        { error: 'Topic is required' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      );
    }

    const userPrompt = `Generate ${numVariations} distinct video script variations for the following topic: "${topic}"

Make sure each script is unique in approach, hook, and structure while maintaining the same high-impact style.`;

    console.log('Calling Claude API with topic:', topic);
    console.log('Number of variations requested:', numVariations);

    // Using Claude Sonnet 4.5 (latest available model)
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Extract the text content from the response
    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude API');
    }

    const responseText = content.text.trim();

    // Try to parse JSON from the response
    let scriptsData;
    try {
      // Extract JSON from the response (handle cases where there might be markdown code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        scriptsData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse JSON response:', responseText);
      // Fallback: create scripts from the raw text
      const scripts = responseText
        .split(/\n\n+/)
        .filter((s) => s.trim().length > 0)
        .slice(0, numVariations)
        .map((content, index) => ({
          id: index + 1,
          content: content.trim(),
        }));

      scriptsData = { scripts };
    }

    // Validate and format the response
    if (!scriptsData.scripts || !Array.isArray(scriptsData.scripts)) {
      throw new Error('Invalid response format from Claude API');
    }

    // Ensure we have the correct number of scripts
    const scripts = scriptsData.scripts
      .slice(0, numVariations)
      .map((script: any, index: number) => ({
        id: script.id || index + 1,
        content: script.content || String(script),
      }));

    // Log token usage
    console.log('Claude API Usage:', {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
      total_tokens: message.usage.input_tokens + message.usage.output_tokens,
    });

    return NextResponse.json({ scripts });
  } catch (error: any) {
    console.error('Error generating scripts:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate scripts' },
      { status: 500 }
    );
  }
}

