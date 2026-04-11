'use server';

/**
 * Server Action: Wire Genkit AI Coach to Chat UI
 * Assembles user context from Firestore and calls the metabolic coach flow
 */

import { getFirestore, doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { aiMetabolicCoach, type CoachInput } from '@/ai/flows/ai-metabolic-coach';

// Initialize Firebase in server context
let firebaseApp: FirebaseApp | null = null;
try {
  const apps = getApps();
  firebaseApp = apps.length > 0 ? getApp() : initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
} catch (error) {
  console.warn('Firebase init warning:', error);
}

/**
 * Assemble user metabolic profile from Firestore
 */
async function getUserProfile(userId: string) {
  if (!firebaseApp) return null;
  try {
    const firestore = getFirestore(firebaseApp);
    const userRef = doc(firestore, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return null;
    }

    const data = userSnap.data();
    return {
      age: data?.age || 30,
      gender: data?.gender || 'M',
      height: data?.height || 170,
      weight: data?.weight || 70,
      diabetesType: data?.medicalConditions?.includes('Type 2') ? 'Type2' : 'PreDiabetic',
      activityLevel: data?.activityLevel || 'Moderate',
      dietaryPreference: data?.dietaryPreference || 'Vegetarian',
      region: data?.region || 'Other',
      baselineGlucose: data?.baselineGlucose || 95,
    };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

/**
 * Get recent logbook entries (last 7 days) to identify patterns
 */
async function getRecentLogbookEntries(userId: string, days: number = 7) {
  if (!firebaseApp) return [];
  try {
    const firestore = getFirestore(firebaseApp);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - days);

    const logsRef = collection(firestore, 'users', userId, 'logbookEntries');
    const q = query(
      logsRef,
      where('recordedAt', '>=', sevenDaysAgo.toISOString()),
      orderBy('recordedAt', 'desc'),
      limit(100)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error fetching logbook entries:', error);
    return [];
  }
}

/**
 * Compute glucose trend from recent readings (slope)
 */
function computeGlucoseTrend(entries: any[]): string {
  const glucoseEntries = entries
    .filter((e: any) => e.entryType === 'glucose')
    .sort((a: any, b: any) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
    .slice(-7); // Last 7 readings

  if (glucoseEntries.length < 2) {
    return 'Stable (insufficient data)';
  }

  const first = parseFloat(glucoseEntries[0].glucoseValue) || 95;
  const last = parseFloat(glucoseEntries[glucoseEntries.length - 1].glucoseValue) || 95;
  const delta = last - first;

  if (delta > 10) return 'Rising';
  if (delta < -10) return 'Falling';
  return 'Stable';
}

/**
 * Identify top spike-causing foods from recent logs
 */
function findTopSpikeFoods(entries: any[]): string[] {
  const foodSpikePairs = entries
    .filter((e: any) => e.entryType === 'food' && e.foodName)
    .map((e: any) => e.foodName);

  // Count occurrences
  const foodCounts = foodSpikePairs.reduce((acc: any, food: string) => {
    acc[food] = (acc[food] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(foodCounts)
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 3)
    .map(([food]) => food);
}

/**
 * Build user context string for the AI coach
 */
function buildUserContext(
  profile: any,
  recentEntries: any[],
  glucoseTrend: string,
  topFoods: string[]
): string {
  const trend = glucoseTrend || 'Stable';
  const topFoodsStr = topFoods.length > 0 ? topFoods.join(', ') : 'rice, roti, paneer';
  
  return `
User Profile:
- Age: ${profile?.age || '?'}, Gender: ${profile?.gender || '?'}, Height: ${profile?.height}cm, Weight: ${profile?.weight}kg
- Diabetes Type: ${profile?.diabetesType || 'PreDiabetic'}
- Activity Level: ${profile?.activityLevel || 'Moderate'}
- Dietary Preference: ${profile?.dietaryPreference || 'Vegetarian'}
- Regional Cuisine: ${profile?.region || 'Other'}
- Baseline Glucose: ${profile?.baselineGlucose || 95} mg/dL

Recent Patterns (last 7 days):
- Glucose Trend: ${trend}
- Most Logged Foods: ${topFoodsStr}
- Total Entries Logged: ${recentEntries.length}

Context: User is learning their glucose response. Provide personalized advice based on these patterns.
  `.trim();
}

/**
 * Main server action - Call Genkit AI Coach with full context
 */
export async function callMetabolicCoach(
  userId: string,
  message: string,
  conversationHistory: Array<{ role: 'user' | 'model'; content: string }>
): Promise<{ response: string; source: string }> {
  try {
    // 1. Fetch user profile from Firestore
    const profile = await getUserProfile(userId);

    // 2. Fetch recent logbook entries
    const recentEntries = await getRecentLogbookEntries(userId, 7);

    // 3. Compute glucose trend
    const glucoseTrend = computeGlucoseTrend(recentEntries);

    // 4. Find top spike-causing foods
    const topSpikeFoods = findTopSpikeFoods(recentEntries);

    // 5. Build comprehensive context
    const userContext = buildUserContext(profile, recentEntries, glucoseTrend, topSpikeFoods);

    // 6. Prepare input for Genkit flow
    const coachInput: CoachInput = {
      message,
      history: conversationHistory,
      userContext,
    };

    // 7. Call the Genkit flow
    const result = await aiMetabolicCoach(coachInput);

    return {
      response: result.response,
      source: 'genkit-ai-coach',
    };
  } catch (error: any) {
    console.error('Error calling metabolic coach:', error);

    // Fallback response if Genkit fails
    return {
      response: `I'm having trouble connecting right now. For glucose guidance: try pairing carbs with protein/fiber, take a 10-15 min walk after meals, and log your readings so I can learn your patterns better.`,
      source: 'fallback',
    };
  }
}
