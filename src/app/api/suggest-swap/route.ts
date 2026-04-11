import { NextResponse } from 'next/server';
import { explainSpikeAndSuggestSwap } from '@/ai/flows/explain-spike-and-suggest-swap';

export async function POST(req: Request) {
  const body = await req.json();
  const result = await explainSpikeAndSuggestSwap(body);
  return NextResponse.json(result);
}
