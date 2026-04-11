import { NextResponse } from 'next/server';

type VisionRequest = {
  imageDataUrl?: string;
  contentType?: string;
};

function extractText(response: any): string {
  return response?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('') || '';
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as VisionRequest;
    const imageDataUrl = String(body.imageDataUrl || '').trim();
    const contentType = String(body.contentType || 'image/jpeg').trim() || 'image/jpeg';

    if (!imageDataUrl) {
      return NextResponse.json({ error: 'Missing image data' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key is not configured' }, { status: 500 });
    }

    const base64 = imageDataUrl.includes(',') ? imageDataUrl.split(',')[1] : imageDataUrl;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: 'Identify the Indian food dish in this image. Return only the dish name.' },
                { inlineData: { mimeType: contentType, data: base64 } },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      return NextResponse.json({ error: 'Vision analysis failed' }, { status: 502 });
    }

    const data = await response.json();
    const dishName = extractText(data).replace(/^dish\s*name\s*:\s*/i, '').trim().replace(/^['"`]|['"`]$/g, '');

    if (!dishName) {
      return NextResponse.json({ error: 'Could not identify the dish' }, { status: 422 });
    }

    return NextResponse.json({ dishName });
  } catch (error) {
    console.error('Food vision route failed:', error);
    return NextResponse.json({ error: 'Food photo analysis failed' }, { status: 500 });
  }
}