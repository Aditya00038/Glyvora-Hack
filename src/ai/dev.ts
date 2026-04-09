import { config } from 'dotenv';
config();

import '@/ai/flows/provide-immediate-action-guidance.ts';
import '@/ai/flows/analyze-meal-for-glucose-impact.ts';
import '@/ai/flows/explain-spike-and-suggest-swap.ts';
import '@/ai/flows/process-voice-meal.ts';
import '@/ai/flows/extract-glucose-ocr.ts';
import '@/ai/flows/generate-metabolic-meal-plan.ts';
import '@/ai/flows/ai-metabolic-coach.ts';
import '@/ai/flows/generate-metabolic-insights.ts';