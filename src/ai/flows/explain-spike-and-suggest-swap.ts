'use server';
/**
 * @fileOverview Suggests Indian-centric meal swaps with Quota resilience.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExplainSpikeAndSuggestSwapInputSchema = z.object({
  mealName: z.string().describe('The name of the original meal.'),
  detectedItems: z.array(z.string()).describe('Items found in the original meal.'),
  predictedSpike: z.number().describe('The original predicted spike in mg/dL.'),
  userSensitivity: z.enum(['low', 'medium', 'high']).describe('User metabolic profile.'),
});
export type ExplainSpikeAndSuggestSwapInput = z.infer<typeof ExplainSpikeAndSuggestSwapInputSchema>;

const ExplainSpikeAndSuggestSwapOutputSchema = z.object({
  optimizedMealName: z.string().describe('Name of the suggested swap meal.'),
  optimizedSpikeMgDl: z.number().describe('The new predicted spike.'),
  reductionPercentage: z.number().describe('Percentage reduction in spike.'),
  suggestions: z.array(z.string()).describe('Exactly 3 practical Indian-centric swap tips.'),
  riskLevelAfter: z.enum(['low', 'medium', 'high']),
  isSimulation: z.boolean().optional().default(false),
});
export type ExplainSpikeAndSuggestSwapOutput = z.infer<typeof ExplainSpikeAndSuggestSwapOutputSchema>;

export async function explainSpikeAndSuggestSwap(
  input: ExplainSpikeAndSuggestSwapInput
): Promise<ExplainSpikeAndSuggestSwapOutput> {
  return explainSpikeAndSuggestSwapFlow(input);
}

const explainSpikeAndSuggestSwapPrompt = ai.definePrompt({
  name: 'explainSpikeAndSuggestSwapPrompt',
  input: { schema: ExplainSpikeAndSuggestSwapInputSchema },
  output: { schema: ExplainSpikeAndSuggestSwapOutputSchema },
  model: 'googleai/gemini-2.5-flash',
  prompt: `You are the Glyvora Decision Engine. Optimize Indian meals for diabetics.

Original Meal: {{{mealName}}}
Predicted Spike: +{{{predictedSpike}}} mg/dL

1. Suggest a Smart Swap (Indian context).
2. Predict the new spike (30-60% reduction usually).
3. Provide 3 specific tips (fiber, protein, portion).

Respond in JSON.`,
});

const explainSpikeAndSuggestSwapFlow = ai.defineFlow(
  {
    name: 'explainSpikeAndSuggestSwapFlow',
    inputSchema: ExplainSpikeAndSuggestSwapInputSchema,
    outputSchema: ExplainSpikeAndSuggestSwapOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await explainSpikeAndSuggestSwapPrompt(input);
      if (!output) throw new Error("AI failed to generate swap.");
      return { ...output, isSimulation: false };
    } catch (error: any) {
      if (error.message?.includes('429') || error.message?.includes('Quota') || !process.env.GEMINI_API_KEY) {
        return {
          optimizedMealName: "Cauliflower 'Rice' with Paneer Curry",
          optimizedSpikeMgDl: Math.round(input.predictedSpike * 0.45),
          reductionPercentage: 55,
          suggestions: [
            "Swap white rice for riced cauliflower to eliminate simple starches.",
            "Paneer adds high-quality protein to slow stomach emptying.",
            "Add a side of green chili and cucumber for crunch and fiber."
          ],
          riskLevelAfter: 'low' as const,
          isSimulation: true
        };
      }
      throw error;
    }
  }
);
