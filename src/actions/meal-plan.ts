'use server';

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { generateMetabolicMealPlan } from '@/ai/flows/generate-metabolic-meal-plan';

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

const db = getFirestore(firebaseApp as FirebaseApp);

interface UserProfile {
  age?: number;
  gender?: string;
  height?: number;
  weight?: number;
  diabetesType?: string;
  activityLevel?: string;
  dietaryPreference?: string;
  baselineGlucose?: number;
}

interface LogbookEntry {
  id: string;
  food: string;
  mealType: string;
  portionSize?: number;
  glucoseBefore?: number;
  glucoseAfter?: number;
  glucose_peak?: number;
  recorded_at?: string;
  timestamp?: Timestamp | string;
  notes?: string;
}

interface MealHistory {
  food: string;
  glucoseDelta: number;
  frequency: number;
}

async function getUserProfile(userId: string): Promise<UserProfile> {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (!snap.exists()) return {};
    const data = snap.data();
    return {
      age: data.age,
      gender: data.gender,
      height: data.height,
      weight: data.weight,
      diabetesType: data.diabetesType,
      activityLevel: data.activityLevel || 'moderate',
      dietaryPreference: data.dietaryPreference || 'vegetarian',
      baselineGlucose: data.baselineGlucose || 95,
    };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return {};
  }
}

async function getRecentLogbookEntries(userId: string, days: number = 7): Promise<LogbookEntry[]> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const q = query(
      collection(db, 'users', userId, 'logbook'),
      where('timestamp', '>=', Timestamp.fromDate(cutoffDate)),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const snap = await getDocs(q);
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as LogbookEntry[];
  } catch (error) {
    console.error('Error fetching logbook entries:', error);
    return [];
  }
}

function computeUserSensitivity(entries: LogbookEntry[]): string {
  if (entries.length === 0) return 'medium';

  const deltas = entries
    .map(e => {
      const before = e.glucoseBefore || 0;
      const after = e.glucoseAfter || e.glucose_peak || 0;
      return Math.abs(after - before);
    })
    .filter(d => d > 0);

  if (deltas.length === 0) return 'medium';

  const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const maxDelta = Math.max(...deltas);

  // If average spike > 30 or max > 50, user is highly sensitive
  if (avgDelta > 30 || maxDelta > 50) return 'high';
  // If average spike < 15, user is low sensitivity
  if (avgDelta < 15) return 'low';
  return 'medium';
}

function findSafeFoods(entries: LogbookEntry[], threshold: number = 25): string[] {
  const foodDeltas = new Map<string, number[]>();

  entries.forEach(entry => {
    if (!entry.food) return;
    const delta = Math.abs((entry.glucoseAfter || entry.glucose_peak || 0) - (entry.glucoseBefore || 0));
    if (!foodDeltas.has(entry.food)) {
      foodDeltas.set(entry.food, []);
    }
    foodDeltas.get(entry.food)!.push(delta);
  });

  const safeFoods: string[] = [];
  foodDeltas.forEach((deltas, food) => {
    const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    if (avgDelta < threshold) {
      safeFoods.push(food);
    }
  });

  return safeFoods;
}

function buildRecentHistory(entries: LogbookEntry[]): string[] {
  const historyMap = new Map<string, { deltas: number[]; count: number }>();

  entries.forEach(entry => {
    if (!entry.food) return;
    const delta = Math.abs((entry.glucoseAfter || entry.glucose_peak || 0) - (entry.glucoseBefore || 0));
    const existing = historyMap.get(entry.food) || { deltas: [], count: 0 };
    existing.deltas.push(delta);
    existing.count += 1;
    historyMap.set(entry.food, existing);
  });

  const history: string[] = [];
  historyMap.forEach((data, food) => {
    const avgDelta = data.deltas.reduce((a, b) => a + b, 0) / data.deltas.length;
    const assessment = avgDelta < 20 ? 'low spike' : avgDelta < 35 ? 'moderate spike' : 'high spike';
    history.push(`${food}: ${assessment} (~${Math.round(avgDelta)} mg/dL, eaten ${data.count}x)`);
  });

  return history.slice(0, 15); // Top 15 foods
}

function detectCorrectionMode(entries: LogbookEntry[]): boolean {
  // If user had a spike > 50 mg/dL in the last 24 hours, activate correction mode
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  return entries.some(entry => {
    const entryDate = entry.timestamp instanceof Timestamp 
      ? entry.timestamp.toDate() 
      : new Date(entry.timestamp || 0);
    
    if (entryDate < oneDayAgo) return false;

    const delta = Math.abs((entry.glucoseAfter || entry.glucose_peak || 0) - (entry.glucoseBefore || 0));
    return delta > 50;
  });
}

export async function callMealPlanGenerator(
  userId: string,
  forceRegenerationMode: boolean = false
): Promise<{ plan: any; source: string }> {
  try {
    const profile = await getUserProfile(userId);
    const recentEntries = await getRecentLogbookEntries(userId, 7);

    const userSensitivity = computeUserSensitivity(recentEntries);
    const recentHistory = buildRecentHistory(recentEntries);
    const isCorrectionMode = forceRegenerationMode || detectCorrectionMode(recentEntries);
    const safeFoods = findSafeFoods(recentEntries, 25);

    const dietaryPreference = profile.dietaryPreference || 'Indian vegetarian';
    const activityLevel = profile.activityLevel || 'moderate';
    const ageGroup = profile.age ? (profile.age > 50 ? 'senior' : profile.age > 30 ? 'adult' : 'young') : 'adult';

    const preferences = `${dietaryPreference}, ${activityLevel} activity level, ${ageGroup}`;
    const goals = isCorrectionMode
      ? 'Emergency glucose stabilization after recent spike'
      : 'Minimize post-prandial glucose excursions, maintain energy';

    const mealPlanInput = {
      userSensitivity,
      recentHistory,
      preferences,
      goals,
      isCorrectionMode,
    };

    // Call Genkit flow
    const result = await generateMetabolicMealPlan(mealPlanInput);

    return {
      plan: {
        ...result,
        metadata: {
          generatedAt: new Date().toISOString(),
          userSensitivity,
          safeFoods: safeFoods.slice(0, 10),
          correctionMode: isCorrectionMode,
        },
      },
      source: 'genkit-meal-planner',
    };
  } catch (error) {
    console.error('Genkit meal plan generation failed:', error);
    return {
      plan: null,
      source: 'error',
    };
  }
}

  export async function saveMealPlanToFirestore(
    userId: string,
    plan: any,
    planName: string = 'current'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      await setDoc(
        doc(db, 'users', userId, 'mealPlans', planName || today),
        {
          ...plan,
          savedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { merge: true }
      );
      return { success: true };
    } catch (error: any) {
      console.error('Error saving meal plan to Firestore:', error);
      return { success: false, error: error.message };
    }
  }
