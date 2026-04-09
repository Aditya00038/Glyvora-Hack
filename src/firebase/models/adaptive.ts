import { z } from 'zod';

export const MealFeedbackSchema = z.object({
  mealLogId: z.string(),
  userId: z.string(),
  actualSpikeMgDl: z.number().nullable(), // Null if the user just clicked Like/Dislike without an exact measurement
  preferenceSentiment: z.enum(['dislike', 'neutral', 'like']),
  recordedAt: z.string() // ISO date
});

export type MealFeedback = z.infer<typeof MealFeedbackSchema>;

export const MealScoreSchema = z.object({
  mealName: z.string(),   // Aggregation key
  userId: z.string(),
  
  // Adaptive Scoring Engine Weights
  preferenceWeight: z.number(),  // 0 to 1 scale, derived from 'like', 'dislike'
  stabilityScore: z.number(),    // 0 to 1 scale, consistency of glucose predictions/actuals
  spikePenalty: z.number(),      // 0 to 1 scale, penalizing spikes > 40
  
  interactionCount: z.number(),
  
  // Computed on the fly via Rank Engine: (Score * 0.8) + (Confidence * 0.2)
  rankScore: z.number(),
  
  confidence: z.number(),        // derived from interactionCount and stability
  
  lastUpdated: z.string()
});

export type MealScore = z.infer<typeof MealScoreSchema>;

export const MealLogSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  mealName: z.string(),
  detectedFoodItems: z.array(z.string()),
  
  // AI Prediction Baseline
  initialPredictedGlucoseSpike: z.number(),
  initialRiskLevel: z.enum(['low', 'medium', 'high']),
  scienceExplanation: z.string(),
  
  mealImageUrl: z.string().optional(),
  scannedAt: z.string(),
  updatedAt: z.string(),
  
  // Has this meal been fed back into the closed loop system?
  isFeedbackProvided: z.boolean().default(false)
});

export type MealLog = z.infer<typeof MealLogSchema>;

export const ABTestProfileSchema = z.object({
  userId: z.string(),
  assignment: z.enum(['A', 'B']), // A = Static AI, B = Adaptive Engine
  enrolledAt: z.string(),
  averageGlucoseDaily: z.number(),
  spikeFrequencyWeekly: z.number(),
  adherencePercentage: z.number()
});

export type ABTestProfile = z.infer<typeof ABTestProfileSchema>;
