'use server';
/**
 * @fileOverview Action Engine using stable Gemini 2.0 Flash.
 * Includes fallback logic for quota resilience.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const ProvideImmediateActionGuidanceInputSchema = z.object({
  predictedGlucoseSpike: z.number(),
  mealName: z.string(),
  riskLevel: z.enum(['low', 'medium', 'high']),
});
export type ProvideImmediateActionGuidanceInput = z.infer<typeof ProvideImmediateActionGuidanceInputSchema>;

const ProvideImmediateActionGuidanceOutputSchema = z.object({
  actions: z.array(z.object({
    icon: z.string().describe('Lucide icon name.'),
    text: z.string().describe('Instruction.'),
    priority: z.enum(['high', 'medium', 'low']),
  })),
  isSimulation: z.boolean().optional().default(false),
});
export type ProvideImmediateActionGuidanceOutput = z.infer<typeof ProvideImmediateActionGuidanceOutputSchema>;

export async function provideImmediateActionGuidance(
  input: ProvideImmediateActionGuidanceInput
): Promise<ProvideImmediateActionGuidanceOutput> {
  return provideImmediateActionGuidanceFlow(input);
}

const provideImmediateActionGuidancePrompt = ai.definePrompt({
  name: 'provideImmediateActionGuidancePrompt',
  input: {schema: ProvideImmediateActionGuidanceInputSchema},
  output: {schema: ProvideImmediateActionGuidanceOutputSchema},
  model: 'googleai/gemini-2.5-flash',
  prompt: `Provide 3 IMMEDIATE command-style actions to flatten a glucose spike.
Meal: {{{mealName}}}
Spike: +{{{predictedGlucoseSpike}}} mg/dL
Risk: {{{riskLevel}}}

Use lucide-react keywords: 'walk', 'droplets', 'clock', 'ban', 'utensils'.
Return JSON.`,
});

const provideImmediateActionGuidanceFlow = ai.defineFlow(
  {
    name: 'provideImmediateActionGuidanceFlow',
    inputSchema: ProvideImmediateActionGuidanceInputSchema,
    outputSchema: ProvideImmediateActionGuidanceOutputSchema,
  },
  async input => {
    try {
      const {output} = await provideImmediateActionGuidancePrompt(input);
      if (!output) throw new Error("Action generation failed.");
      return { ...output, isSimulation: false };
    } catch (error: any) {
      if (error.message?.includes('429') || error.message?.includes('Quota') || !process.env.GEMINI_API_KEY) {
        return {
          actions: [
            { icon: 'walk', text: '15-minute brisk walk immediately.', priority: 'high' as const },
            { icon: 'droplets', text: 'Drink 500ml of water to dilute glucose.', priority: 'medium' as const },
            { icon: 'clock', text: 'Delay your next snack by 2 hours.', priority: 'low' as const }
          ],
          isSimulation: true
        };
      }
      throw error;
    }
  }
);
