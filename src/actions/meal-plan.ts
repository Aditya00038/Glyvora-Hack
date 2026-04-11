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

const db = firebaseApp ? getFirestore(firebaseApp) : null;

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
  entryType: 'glucose' | 'food' | 'insulin' | 'meds' | 'vitals' | 'exercise';
  recordedAt: string;
  notes?: string;
  glucoseValue?: string;
  glucoseContext?: string;
  carbs?: string;
  protein?: string;
  fat?: string;
  calories?: string;
}

interface MealHistory {
  food: string;
  glucoseDelta: number;
  frequency: number;
}

async function getUserProfile(userId: string): Promise<UserProfile> {
  if (!db) return {};
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
  if (!db) return [];
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const q = query(
      collection(db, 'users', userId, 'logbookEntries'),
      where('recordedAt', '>=', cutoffDate.toISOString()),
      orderBy('recordedAt', 'desc'),
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
  const glucoseReadings = entries
    .filter((entry) => entry.entryType === 'glucose' && entry.glucoseValue)
    .map((entry) => {
      const parsed = Number.parseFloat(entry.glucoseValue || '0');
      // Values <= 25 are assumed mmol/L and converted to mg/dL.
      return parsed <= 25 ? parsed * 18 : parsed;
    })
    .filter((value) => Number.isFinite(value) && value > 0);

  if (glucoseReadings.length < 2) return 'medium';

  const deltas: number[] = [];
  for (let i = 1; i < glucoseReadings.length; i += 1) {
    deltas.push(Math.abs(glucoseReadings[i] - glucoseReadings[i - 1]));
  }

  const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const maxDelta = Math.max(...deltas);

  // If average spike > 30 or max > 50, user is highly sensitive
  if (avgDelta > 30 || maxDelta > 50) return 'high';
  // If average spike < 15, user is low sensitivity
  if (avgDelta < 15) return 'low';
  return 'medium';
}

function findSafeFoods(entries: LogbookEntry[], threshold: number = 25): string[] {
  const foodEntries = entries.filter((entry) => entry.entryType === 'food');
  const foodCarbs = new Map<string, number[]>();

  foodEntries.forEach((entry) => {
    const label = entry.notes?.trim() || `${entry.carbs || '0'}g carb meal`;
    const carbs = Number.parseFloat(entry.carbs || '0');
    if (!foodCarbs.has(label)) {
      foodCarbs.set(label, []);
    }
    if (Number.isFinite(carbs) && carbs > 0) {
      foodCarbs.get(label)!.push(carbs);
    }
  });

  const safeFoods: string[] = [];
  foodCarbs.forEach((carbValues, label) => {
    if (!carbValues.length) return;
    const avgCarbs = carbValues.reduce((a, b) => a + b, 0) / carbValues.length;
    if (avgCarbs <= threshold) {
      safeFoods.push(label);
    }
  });

  return safeFoods;
}

function buildRecentHistory(entries: LogbookEntry[]): string[] {
  const historyMap = new Map<string, { carbs: number[]; count: number }>();

  entries.forEach((entry) => {
    if (entry.entryType !== 'food') return;
    const label = entry.notes?.trim() || `${entry.carbs || '0'}g carb meal`;
    const carbs = Number.parseFloat(entry.carbs || '0');
    const existing = historyMap.get(label) || { carbs: [], count: 0 };
    if (Number.isFinite(carbs) && carbs > 0) {
      existing.carbs.push(carbs);
    }
    existing.count += 1;
    historyMap.set(label, existing);
  });

  const history: string[] = [];
  historyMap.forEach((data, label) => {
    const avgCarbs = data.carbs.length
      ? data.carbs.reduce((a, b) => a + b, 0) / data.carbs.length
      : 0;
    const assessment = avgCarbs < 20 ? 'low carb load' : avgCarbs < 40 ? 'moderate carb load' : 'high carb load';
    history.push(`${label}: ${assessment} (~${Math.round(avgCarbs)}g carbs, logged ${data.count}x)`);
  });

  return history.slice(0, 15); // Top 15 foods
}

function detectCorrectionMode(entries: LogbookEntry[]): boolean {
  // If user had any high glucose reading in the last 24h, activate correction mode.
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  return entries.some((entry) => {
    if (entry.entryType !== 'glucose' || !entry.glucoseValue || !entry.recordedAt) {
      return false;
    }
    const entryDate = new Date(entry.recordedAt);
    if (entryDate < oneDayAgo) return false;

    const parsed = Number.parseFloat(entry.glucoseValue);
    const mgDl = parsed <= 25 ? parsed * 18 : parsed;
    return Number.isFinite(mgDl) && mgDl >= 180;
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
      diabetesType: profile.diabetesType || 'Type 2 Diabetes',
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
        if (!db) {
          return { success: false, error: 'Firestore is not initialized' };
        }
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
