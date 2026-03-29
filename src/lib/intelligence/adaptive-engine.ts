import { MealScore, MealFeedback } from '@/firebase/models/adaptive';

/**
 * Recalculates the Adaptive Score for a specific meal based on feedback.
 * 
 * Score = (Preference × 0.4) + (Stability × 0.4) − (SpikePenalty × 0.6)
 * Confidence = min(1.0, (interactionCount/10) + (Stability/2))
 * Rank = (Score × 0.8) + (Confidence × 0.2)
 */
export function recalculateAdaptiveScore(
  currentScore: MealScore | null,
  feedback: MealFeedback,
  mealName: string,
  userId: string
): MealScore {
  const base = currentScore || {
    mealName,
    userId,
    preferenceWeight: 0.5,
    stabilityScore: 0.5,
    spikePenalty: 0.0,
    interactionCount: 0,
    rankScore: 0,
    confidence: 0,
    lastUpdated: new Date().toISOString()
  };

  // 1. Process Preference Sentiment
  let newPref = base.preferenceWeight;
  if (feedback.preferenceSentiment === 'like') newPref = Math.min(1.0, base.preferenceWeight + 0.1);
  if (feedback.preferenceSentiment === 'dislike') newPref = Math.max(0.0, base.preferenceWeight - 0.2);

  // 2. Process Spike Penalty and Stability
  let newPenalty = base.spikePenalty;
  let newStability = base.stabilityScore;

  if (feedback.actualSpikeMgDl) {
    if (feedback.actualSpikeMgDl > 40) {
      newPenalty = Math.min(1.0, base.spikePenalty + 0.3); // High punishment for spikes
      newStability = Math.max(0.0, base.stabilityScore - 0.1); // Confidence dropping due to unexpected spike
    } else {
      newPenalty = Math.max(0.0, base.spikePenalty - 0.1); // Recovery from penalty
      newStability = Math.min(1.0, base.stabilityScore + 0.1); // Stable response increases stability
    }
  }

  // 3. Compute Adaptive Scoring Engine Equation
  const adaptiveScore = (newPref * 0.4) + (newStability * 0.4) - (newPenalty * 0.6);

  // 4. Compute Confidence Model
  const newInteractionCount = base.interactionCount + 1;
  const confidence = Math.min(1.0, (newInteractionCount / 10) + (newStability / 2));

  // 5. Compute Ranking Engine
  const rankScore = (adaptiveScore * 0.8) + (confidence * 0.2);

  return {
    mealName,
    userId,
    preferenceWeight: newPref,
    stabilityScore: newStability,
    spikePenalty: newPenalty,
    interactionCount: newInteractionCount,
    confidence,
    rankScore,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Proactive Intelligence: Correction Mode Checker
 * Returns true if the last meal spiked over 40mg/dL.
 */
export function triggersCorrectionMode(actualSpikeMgDl: number | null): boolean {
  if (!actualSpikeMgDl) return false;
  return actualSpikeMgDl > 40;
}
