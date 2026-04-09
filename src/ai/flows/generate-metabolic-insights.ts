'use server';
/**
 * @fileOverview AI Metabolic Insights Engine with Quota resilience.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const MetabolicInsightsInputSchema = z.object({
  mealHistory: z.array(z.object({
    mealName: z.string(),
    items: z.array(z.string()),
    spike: z.number(),
    risk: z.string(),
  })).describe('Recent meals and their glucose impact.'),
  userSensitivity: z.string(),
});

const MetabolicInsightsOutputSchema = z.object({
  overallSummary: z.string().describe('A 2-sentence metabolic state summary.'),
  topTriggers: z.array(z.object({
    food: z.string(),
    impact: z.string().describe('e.g., "Causes +40mg/dL average spike"'),
    reason: z.string().describe('Metabolic explanation.'),
  })).describe('Top 3 foods causing the most instability.'),
  positivePatterns: z.array(z.string()).describe('Things the user is doing right.'),
  actionableAdvice: z.array(z.string()).describe('Exactly 3 concrete changes to make.'),
  isSimulation: z.boolean().optional().default(false),
});

export async function generateMetabolicInsights(input: z.infer<typeof MetabolicInsightsInputSchema>) {
  return generateMetabolicInsightsFlow(input);
}

const insightsPrompt = ai.definePrompt({
  name: 'insightsPrompt',
  input: { schema: MetabolicInsightsInputSchema },
  output: { schema: MetabolicInsightsOutputSchema },
  model: 'googleai/gemini-2.5-flash',
  prompt: `You are the Glyvora Metabolic Scientist. Analyze the following meal history to identify patterns.
  
  User Sensitivity: {{{userSensitivity}}}
  History:
  {{#each mealHistory}}
  - {{{mealName}}}: Spike of +{{{spike}}} (Risk: {{{risk}}}). Items: {{#each items}}{{{this}}}, {{/each}}
  {{/each}}
  
  Your goal is to find common ingredients across high-spike meals and explain the science of why they are triggers for THIS specific user. 
  Be scientific, concise, and proactive.`,
});

const generateMetabolicInsightsFlow = ai.defineFlow(
  {
    name: 'generateMetabolicInsightsFlow',
    inputSchema: MetabolicInsightsInputSchema,
    outputSchema: MetabolicInsightsOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await insightsPrompt(input);
      if (!output) throw new Error("Insights generation failed.");
      return { ...output, isSimulation: false };
    } catch (error: any) {
      if (error.message?.includes('429') || error.message?.includes('Quota') || !process.env.GEMINI_API_KEY) {
        return {
          overallSummary: "Metabolic Engine simulating patterns. Your data suggests sensitivity to refined grains during evening periods.",
          topTriggers: [
            { food: "White Rice", impact: "Causes +38mg/dL average spike", reason: "Simple starch without sufficient fiber buffer." },
            { food: "Sugary Drinks", impact: "Causes +52mg/dL instant spike", reason: "Liquid glucose bypasses digestive slowing." }
          ],
          positivePatterns: ["Consistent meal timing recorded", "Protein pairing detected in 60% of meals"],
          actionableAdvice: [
            "Walk for 10 minutes after dinner to flatten evening curves.",
            "Replace white rice with brown rice or millets.",
            "Always eat fiber/salad 5 minutes before the main course."
          ],
          isSimulation: true
        };
      }
      throw error;
    }
  }
);
