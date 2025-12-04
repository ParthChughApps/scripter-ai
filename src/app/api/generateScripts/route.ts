import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a skilled content creator who writes clear, engaging video scripts. Your task is to generate 3 distinct, well-written video script variations based on the user's topic.

Each script should be engaging and provide real value to viewers, designed to keep them watching and interested. The total script read time must be between 40-60 seconds.

**STYLE & TONE GUIDELINES:**

1. **Tone:** Friendly, clear, and helpful. Write in a conversational style that feels natural and easy to understand. Explain things simply without using overly technical jargon.

2. **Language:** Use everyday language that anyone can understand. Write in a clear, straightforward way. Avoid using excessive capitalization or aggressive marketing terms. Focus on being helpful rather than pushy.

3. **Focus:** Every script should help viewers by either saving them time, saving them money, or teaching them something useful they can actually use.

**SCRIPT STRUCTURE GUIDELINES:**

Each script variation should contain the following four components, clearly labeled:

1. **HOOK (First 3-5 seconds):** Start with an interesting opening that grabs attention. This could be a helpful tip, a surprising fact, or a clear benefit (e.g., "Here's a useful tool that can help you get more done in less time").

2. **BODY (Main Content):** This is the longest section. Provide a step-by-step guide that's easy to follow. Break things down into simple, numbered steps. Use short, clear sentences. Explain any technical terms in plain language.

3. **CLOSING STATEMENT (Summary):** End with a brief sentence that summarizes the main benefit or takeaway (e.g., "And that's how you can improve your workflow with this simple tool.").

4. **CTA (Call to Action):** Include a friendly prompt to encourage engagement: either ask for comments (e.g., "What other tools would you like to learn about? Let me know in the comments.") or encourage saving/sharing (e.g., "Save this video so you can come back to these steps later.").

**OUTPUT FORMAT:**

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

Make sure each script is unique in approach, hook, and structure while keeping the language clear and accessible to a general audience.`;

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

