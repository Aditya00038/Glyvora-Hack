'use server';
/**
 * @fileOverview Efficient Voice Processing Engine (v4.0, 2026).
 * Standardized on Gemini 2.0 Flash.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ProcessVoiceInputSchema = z.object({
  transcript: z.string().describe('Transcript from voice.'),
});
export type ProcessVoiceInput = z.infer<typeof ProcessVoiceInputSchema>;

const ProcessVoiceOutputSchema = z.object({
  mealName: z.string().describe('Refined name.'),
  detectedItems: z.array(z.string()).describe('List of food items.'),
  confidence: z.number(),
  isSimulation: z.boolean().optional().default(false),
});
export type ProcessVoiceOutput = z.infer<typeof ProcessVoiceOutputSchema>;

export async function processVoiceMeal(input: ProcessVoiceInput): Promise<ProcessVoiceOutput> {
  return processVoiceMealFlow(input);
}

const voicePrompt = ai.definePrompt({
  name: 'voicePrompt',
  input: { schema: ProcessVoiceInputSchema },
  output: { schema: ProcessVoiceOutputSchema },
  model: 'googleai/gemini-2.5-flash',
  prompt: `Extract Indian food items and a refined meal name from: "{{{transcript}}}"
Return JSON.`,
});

const processVoiceMealFlow = ai.defineFlow(
  {
    name: 'processVoiceMealFlow',
    inputSchema: ProcessVoiceInputSchema,
    outputSchema: ProcessVoiceOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await voicePrompt(input);
      if (!output) throw new Error("Voice AI failed.");
      return { ...output, isSimulation: false };
    } catch (error: any) {
      return {
        mealName: "Detected Indian Meal (Offline)",
        detectedItems: ["Poha", "Chai"],
        confidence: 0.9,
        isSimulation: true
      };
    }
  }
);
