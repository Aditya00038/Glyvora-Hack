import { getFirestore, doc, collection, setDoc, getDoc, runTransaction } from 'firebase/firestore';
import { MealFeedback, MealScore } from '@/firebase/models/adaptive';
import { recalculateAdaptiveScore } from './adaptive-engine';

export async function submitMealFeedback(
  db: any,
  userId: string,
  mealLogId: string,
  mealName: string,
  feedback: Omit<MealFeedback, 'mealLogId' | 'userId' | 'recordedAt'>
) {
  const mealScoreRef = doc(db, 'users', userId, 'mealScores', mealName.toLowerCase().replace(/[^a-z0-9]/g, '-'));
  const feedbackRef = doc(collection(db, 'users', userId, 'mealFeedback'));
  const mealLogRef = doc(db, 'users', userId, 'meals', mealLogId);

  const fullFeedback: MealFeedback = {
    ...feedback,
    mealLogId,
    userId,
    recordedAt: new Date().toISOString()
  };

  await runTransaction(db, async (transaction) => {
    // 1. Get current score if it exists
    const scoreDoc = await transaction.get(mealScoreRef);
    const currentScore = scoreDoc.exists() ? (scoreDoc.data() as MealScore) : null;

    // 2. Recalculate based on the Engine
    const newScore = recalculateAdaptiveScore(currentScore, fullFeedback, mealName, userId);

    // 3. Apply updates
    transaction.set(feedbackRef, fullFeedback);
    transaction.set(mealScoreRef, newScore, { merge: true });
    transaction.update(mealLogRef, { isFeedbackProvided: true, actualSpikeMgDl: fullFeedback.actualSpikeMgDl, preference: fullFeedback.preferenceSentiment });
  });

  return fullFeedback;
}
