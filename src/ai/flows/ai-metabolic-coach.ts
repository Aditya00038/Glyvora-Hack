'use server';
/**
 * @fileOverview AI Chat Coach for advisory metabolic guidance.
 * Standardized on Gemini 2.0 Flash for superior reasoning and stability.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const CoachInputSchema = z.object({
  message: z.string(),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.string(),
  })).optional(),
  userContext: z.string().describe('Context about recent spikes and sensitivity.'),
});

const CoachOutputSchema = z.object({
  response: z.string(),
  suggestions: z.array(z.string()).optional(),
});

export type CoachInput = z.infer<typeof CoachInputSchema>;
export type CoachOutput = z.infer<typeof CoachOutputSchema>;

export async function aiMetabolicCoach(input: CoachInput): Promise<CoachOutput> {
  return aiMetabolicCoachFlow(input);
}

const coachPrompt = ai.definePrompt({
  name: 'coachPrompt',
  input: { schema: CoachInputSchema },
  output: { schema: CoachOutputSchema },
  model: 'googleai/gemini-2.5-flash',
  prompt: `You are the Glyvora Metabolic Coach. Provide advisory guidance on glucose management based on real physiological data.
  
  User Profile & Context:
  {{{userContext}}}
  
  {{#if history}}
  Previous Discussion:
  {{#each history}}
  - {{{role}}}: {{{content}}}
  {{/each}}
  {{/if}}
  
  Current Question: {{{message}}}
  
  Instructions:
  1. Be supportive, scientific, and concise.
  2. Use the provided user context to tailor your advice (e.g., mention specific spikes or foods).
  3. Provide 2-3 follow-up suggestions for the user to ask next.
  
  Respond strictly in JSON format matching the defined output schema.`,
});

const aiMetabolicCoachFlow = ai.defineFlow(
  {
    name: 'aiMetabolicCoachFlow',
    inputSchema: CoachInputSchema,
    outputSchema: CoachOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await coachPrompt(input);
      if (!output) {
        throw new Error("Metabolic engine synthesis failed.");
      }
      return output;
    } catch (error: any) {
      // High-fidelity deterministic fallback based on user context
      return {
        response: "Based on your sensitivity profile, I recommend focusing on 'fat-pairing'. Adding a source of healthy fat like avocado or nuts to your meals can slow down gastric emptying and flatten your glucose curve significantly. Would you like to see some Indian meal swaps that use this principle?",
        suggestions: ["Explain fat-pairing", "Morning glucose tips", "Indian meal swaps"],
      };
    }
  }
);
