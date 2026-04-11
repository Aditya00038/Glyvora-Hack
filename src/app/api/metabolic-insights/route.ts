import { NextResponse } from 'next/server';
import { generateMetabolicInsights } from '@/ai/flows/generate-metabolic-insights';

export async function POST(req: Request) {
  const body = await req.json();
  const result = await generateMetabolicInsights(body);
  return NextResponse.json(result);
}
