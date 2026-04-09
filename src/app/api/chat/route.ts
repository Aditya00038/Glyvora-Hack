import { NextResponse } from 'next/server';

function extractText(response: any): string {
  return response?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
}

export async function POST(req: Request) {
  try {
    const { message, history = [], userContext = '' } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing Gemini API key in environment' }, { status: 500 });
    }

    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    const prior = history
      .slice(-8)
      .map((h: any) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
      .join('\n');

    const prompt = [
      'You are Parivartan, GLYVORA assistant.',
      'Answer in very short helpful text, maximum 40 words.',
      'Focus on webapp help (features, navigation) or nutrition/wellness guidance.',
      'Never provide diagnosis. Be safe and practical.',
      userContext ? `User context: ${userContext}` : '',
      prior ? `Conversation:\n${prior}` : '',
      `User question: ${message}`,
      'Return plain text only.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({ error: errorText }, { status: res.status });
    }

    const data = await res.json();
    const reply = extractText(data).trim();

    if (!reply) {
      return NextResponse.json({ reply: 'Try a simple question like: generate my meal plan or explain carbs.' });
    }

    return NextResponse.json({ reply });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Chat failed' }, { status: 500 });
  }
}
