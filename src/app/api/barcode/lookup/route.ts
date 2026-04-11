import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import indianFoods from '@/lib/db/indian-foods.json';

type OpenFoodFactsProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  quantity?: string;
  serving_size?: string;
  image_front_small_url?: string;
  ingredients_text?: string;
  nutriscore_grade?: string;
  nutrition_data?: string;
  nutrition_data_per?: string;
  nutriments?: Record<string, string | number | undefined>;
};

type LookupResponse = {
  found: boolean;
  hasNutrition?: boolean;
  barcode: string;
  productName?: string;
  brand?: string;
  quantity?: string;
  servingSize?: string;
  caloriesPer100g?: number | null;
  caloriesPerServing?: number | null;
  healthScore?: number;
  healthLabel?: string;
  healthNotes?: string[];
  estimatedSpikeMgDl?: number;
  spikeLevel?: string;
  carbsPer100g?: number | null;
  sugarPer100g?: number | null;
  fiberPer100g?: number | null;
  proteinPer100g?: number | null;
  benefitNotes?: string[];
  nutriscore?: string;
  image?: string;
  ingredients?: string;
  message?: string;
  source?: string;
};

type LocalFoodRecord = Record<string, unknown>;

let firebaseApp: FirebaseApp | null = null;
try {
  const apps = getApps();
  firebaseApp = apps.length > 0 ? getApp() : initializeApp(firebaseConfig);
} catch (error) {
  console.warn('Barcode cache Firebase init warning:', error);
}

const db = firebaseApp ? getFirestore(firebaseApp) : null;

function getBarcodeCacheRef(userId: string, barcode: string) {
  if (!db) return null;
  return doc(db, 'users', userId, 'barcode_cache', barcode);
}

async function readBarcodeCache(userId: string, barcode: string): Promise<LookupResponse | null> {
  const cacheRef = getBarcodeCacheRef(userId, barcode);
  if (!cacheRef) return null;

  try {
    const snap = await getDoc(cacheRef);
    if (!snap.exists()) return null;
    const data = snap.data() as LookupResponse;
    return { ...data, source: 'cache' };
  } catch (error) {
    console.warn('Failed to read barcode cache:', error);
    return null;
  }
}

async function writeBarcodeCache(userId: string, barcode: string, payload: LookupResponse) {
  const cacheRef = getBarcodeCacheRef(userId, barcode);
  if (!cacheRef) return;

  try {
    await setDoc(cacheRef, { ...payload, cachedAt: new Date().toISOString() }, { merge: true });
  } catch (error) {
    console.warn('Failed to write barcode cache:', error);
  }
}

function getLocalFoodBarcode(food: LocalFoodRecord): string | null {
  const candidates = [food.barcode, food.code, food.upc, food.ean, food.ean13, food.barcodeNumber];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return String(candidate);
  }
  return null;
}

function findLocalFoodMatch(barcode: string): LocalFoodRecord | null {
  const foods = indianFoods.foods as LocalFoodRecord[];
  return foods.find((food) => getLocalFoodBarcode(food) === barcode) || null;
}

function estimateLocalHealthScore(food: LocalFoodRecord): number {
  const glycemicIndex = typeof food.glycemicIndex === 'number' ? food.glycemicIndex : 55;
  const fiber = typeof food.fiber === 'number' ? food.fiber : 0;
  const protein = typeof food.protein === 'number' ? food.protein : 0;
  const score = 100 - glycemicIndex * 0.7 + fiber * 4 + protein * 1.5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function estimateLocalSpike(food: LocalFoodRecord): number {
  const glycemicIndex = typeof food.glycemicIndex === 'number' ? food.glycemicIndex : 55;
  const carbs = typeof food.carbohydrates === 'number' ? food.carbohydrates : 0;
  return Math.max(5, Math.round((glycemicIndex * carbs) / 75));
}

function buildLocalFoodResponse(food: LocalFoodRecord, barcode: string): LookupResponse {
  const defaultPortion = typeof food.defaultPortion === 'number' ? food.defaultPortion : 100;
  const calories = typeof food.calories === 'number' ? food.calories : null;
  const caloriesPer100g = calories !== null ? Math.round((calories / defaultPortion) * 100) : null;

  return {
    found: true,
    hasNutrition: true,
    barcode,
    productName: String(food.name || 'Unknown product'),
    brand: String(food.region || 'Indian food database'),
    quantity: `${defaultPortion}g`,
    servingSize: `${defaultPortion}g`,
    caloriesPer100g,
    caloriesPerServing: calories,
    healthScore: estimateLocalHealthScore(food),
    healthLabel: 'Local food database',
    healthNotes: [String(food.category || 'Indian food'), String(food.description || 'Offline local match')],
    estimatedSpikeMgDl: estimateLocalSpike(food),
    spikeLevel: estimateLocalSpike(food) >= 35 ? 'High' : estimateLocalSpike(food) >= 20 ? 'Moderate' : 'Low',
    carbsPer100g: typeof food.carbohydrates === 'number' ? food.carbohydrates : null,
    sugarPer100g: null,
    fiberPer100g: typeof food.fiber === 'number' ? food.fiber : null,
    proteinPer100g: typeof food.protein === 'number' ? food.protein : null,
    benefitNotes: ['Matched from offline Indian food database.'],
    source: 'local-food-db',
  };
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getNutriment(product: OpenFoodFactsProduct, keys: string[]): number | null {
  for (const key of keys) {
    const value = toNumber(product.nutriments?.[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function getAnyNutriment(product: OpenFoodFactsProduct, keys: string[]): number | null {
  return getNutriment(product, keys);
}

function parseServingWeight(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/([0-9]+(?:[.,][0-9]+)?)/);
  if (!match) {
    return null;
  }

  const grams = Number.parseFloat(match[1].replace(',', '.'));
  return Number.isFinite(grams) ? grams : null;
}

function scoreFromNutriscore(grade: string | undefined): number {
  const normalized = grade?.trim().toLowerCase();

  switch (normalized) {
    case 'a':
      return 22;
    case 'b':
      return 14;
    case 'c':
      return 6;
    case 'd':
      return -10;
    case 'e':
      return -22;
    default:
      return 0;
  }
}

function buildHealthScore(product: OpenFoodFactsProduct) {
  let score = 100;
  const notes: string[] = [];

  const calories = getNutriment(product, ['energy-kcal_100g', 'energy-kcal_serving']);
  const sugar = getNutriment(product, ['sugars_100g', 'sugars']);
  const saturatedFat = getNutriment(product, ['saturated-fat_100g', 'saturated-fat']);
  const protein = getNutriment(product, ['proteins_100g', 'proteins']);
  const fiber = getNutriment(product, ['fiber_100g', 'fiber']);
  const sodium = getNutriment(product, ['sodium_100g', 'sodium']);

  if (typeof calories === 'number') {
    if (calories >= 500) {
      score -= 18;
      notes.push('Very calorie dense');
    } else if (calories >= 300) {
      score -= 10;
      notes.push('Moderate calorie load');
    } else if (calories <= 120) {
      score += 6;
      notes.push('Light calorie load');
    }
  }

  if (typeof sugar === 'number') {
    if (sugar >= 20) {
      score -= 22;
      notes.push('High sugar');
    } else if (sugar >= 10) {
      score -= 12;
      notes.push('Moderate sugar');
    }
  }

  if (typeof saturatedFat === 'number') {
    if (saturatedFat >= 8) {
      score -= 16;
      notes.push('High saturated fat');
    } else if (saturatedFat >= 3) {
      score -= 8;
      notes.push('Some saturated fat');
    }
  }

  if (typeof sodium === 'number') {
    const sodiumMg = sodium > 20 ? sodium : sodium * 1000;
    if (sodiumMg >= 800) {
      score -= 18;
      notes.push('High sodium');
    } else if (sodiumMg >= 400) {
      score -= 8;
      notes.push('Moderate sodium');
    }
  }

  if (typeof fiber === 'number') {
    if (fiber >= 5) {
      score += 8;
      notes.push('Good fiber');
    } else if (fiber >= 2) {
      score += 4;
      notes.push('Some fiber');
    }
  }

  if (typeof protein === 'number') {
    if (protein >= 10) {
      score += 6;
      notes.push('Protein-rich');
    } else if (protein >= 5) {
      score += 3;
    }
  }

  score += scoreFromNutriscore(product.nutriscore_grade);
  score = Math.max(0, Math.min(100, Math.round(score)));

  let label = 'Balanced';
  if (score >= 80) {
    label = 'Excellent';
  } else if (score >= 65) {
    label = 'Good';
  } else if (score >= 45) {
    label = 'Mixed';
  } else if (score >= 25) {
    label = 'Poor';
  } else {
    label = 'Very poor';
  }

  return { score, label, notes };
}

function estimateGlucoseImpact(product: OpenFoodFactsProduct) {
  const carbs = getNutriment(product, ['carbohydrates_100g', 'carbohydrates']);
  const sugar = getNutriment(product, ['sugars_100g', 'sugars']);
  const fiber = getNutriment(product, ['fiber_100g', 'fiber']) ?? 0;
  const protein = getNutriment(product, ['proteins_100g', 'proteins']) ?? 0;

  const baseFromCarbs = Math.max(0, (carbs ?? 0) * 0.75);
  const sugarPenalty = Math.max(0, (sugar ?? 0) * 0.85);
  const fiberRelief = fiber * 0.55;
  const proteinRelief = protein * 0.2;

  const estimatedSpikeMgDl = Math.max(6, Math.min(85, Math.round(baseFromCarbs + sugarPenalty - fiberRelief - proteinRelief)));

  let spikeLevel = 'Low';
  if (estimatedSpikeMgDl >= 35) {
    spikeLevel = 'High';
  } else if (estimatedSpikeMgDl >= 20) {
    spikeLevel = 'Moderate';
  }

  const benefitNotes: string[] = [];
  if (fiber >= 5) benefitNotes.push('Good fiber may soften the glucose rise.');
  if (protein >= 10) benefitNotes.push('Protein content may improve meal stability.');
  if ((sugar ?? 0) >= 12) benefitNotes.push('High sugar can increase spike risk.');
  if ((carbs ?? 0) >= 35) benefitNotes.push('High total carbs may increase post-meal spike.');

  return {
    estimatedSpikeMgDl,
    spikeLevel,
    carbsPer100g: carbs,
    sugarPer100g: sugar,
    fiberPer100g: fiber,
    proteinPer100g: protein,
    benefitNotes,
  };
}

function hasNutritionFacts(product: OpenFoodFactsProduct, caloriesPer100g: number | null, caloriesPerServing: number | null, computedServingCalories: number | null): boolean {
  const nutrimentCount = Object.keys(product.nutriments || {}).length;
  const explicitNutritionFlag = product.nutrition_data === 'on' || product.nutrition_data_per === '100g' || product.nutrition_data_per === 'serving';

  return Boolean(
    explicitNutritionFlag ||
      nutrimentCount > 0 ||
      caloriesPer100g !== null ||
      caloriesPerServing !== null ||
      computedServingCalories !== null ||
      getAnyNutriment(product, ['sugars_100g', 'sugars']) !== null ||
      getAnyNutriment(product, ['saturated-fat_100g', 'saturated-fat']) !== null ||
      getAnyNutriment(product, ['proteins_100g', 'proteins']) !== null ||
      getAnyNutriment(product, ['fiber_100g', 'fiber']) !== null ||
      getAnyNutriment(product, ['sodium_100g', 'sodium']) !== null
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const barcode = searchParams.get('barcode')?.trim();
  const userId = searchParams.get('userId')?.trim();

  if (!barcode) {
    return NextResponse.json({ error: 'Missing barcode' }, { status: 400 });
  }

  if (userId) {
    const cached = await readBarcodeCache(userId, barcode);
    if (cached) {
      return NextResponse.json(cached);
    }
  }

  const localFood = findLocalFoodMatch(barcode);
  if (localFood) {
    const localResponse = buildLocalFoodResponse(localFood, barcode);
    if (userId) {
      await writeBarcodeCache(userId, barcode, localResponse);
    }
    return NextResponse.json(localResponse);
  }

  const fields = [
    'code',
    'product_name',
    'brands',
    'quantity',
    'serving_size',
    'image_front_small_url',
    'ingredients_text',
    'nutriscore_grade',
    'energy-kcal_100g',
    'energy-kcal_serving',
    'sugars_100g',
    'saturated-fat_100g',
    'proteins_100g',
    'fiber_100g',
    'sodium_100g',
  ].join(',');

  const response = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${encodeURIComponent(fields)}`,
    { cache: 'no-store' }
  );

  if (!response.ok) {
    return NextResponse.json({ error: 'Food Facts lookup failed' }, { status: 502 });
  }

  const data = await response.json();
  const product = data?.product as OpenFoodFactsProduct | undefined;

  if (!product || data?.status !== 1) {
    const responsePayload: LookupResponse = {
      found: false,
      hasNutrition: false,
      barcode,
      message: 'Invalid barcode or product not found in Food Facts database.',
      source: 'openfoodfacts',
    };

    if (userId) {
      await writeBarcodeCache(userId, barcode, responsePayload);
    }

    return NextResponse.json(responsePayload);
  }

  const caloriesPer100g = getNutriment(product, ['energy-kcal_100g']);
  const caloriesPerServing = getNutriment(product, ['energy-kcal_serving']);
  const caloriesPer100gFromKj = getNutriment(product, ['energy-kj_100g']);
  const servingWeight = parseServingWeight(product.serving_size);
  const computedServingCalories =
    caloriesPerServing ??
    (typeof caloriesPer100g === 'number' && typeof servingWeight === 'number'
      ? Math.round((caloriesPer100g * servingWeight) / 100)
      : typeof caloriesPer100gFromKj === 'number' && typeof servingWeight === 'number'
        ? Math.round(((caloriesPer100gFromKj / 4.184) * servingWeight) / 100)
      : null);

  const hasNutrition = hasNutritionFacts(product, caloriesPer100g ?? caloriesPer100gFromKj, caloriesPerServing, computedServingCalories);

  if (!hasNutrition) {
    const responsePayload: LookupResponse = {
      found: true,
      hasNutrition: false,
      barcode: product.code || barcode,
      productName: product.product_name || 'Unknown product',
      brand: product.brands || '',
      quantity: product.quantity || '',
      servingSize: product.serving_size || '',
      image: product.image_front_small_url || '',
      message: 'Product found, but nutrition facts are not available for this barcode.',
      source: 'openfoodfacts',
    };

    if (userId) {
      await writeBarcodeCache(userId, barcode, responsePayload);
    }

    return NextResponse.json(responsePayload);
  }

  const health = buildHealthScore(product);
  const glucose = estimateGlucoseImpact(product);

  const responsePayload: LookupResponse = {
    found: true,
    hasNutrition: true,
    barcode: product.code || barcode,
    productName: product.product_name || 'Unknown product',
    brand: product.brands || '',
    quantity: product.quantity || '',
    servingSize: product.serving_size || '',
    caloriesPer100g: caloriesPer100g ?? (typeof caloriesPer100gFromKj === 'number' ? Math.round(caloriesPer100gFromKj / 4.184) : null),
    caloriesPerServing: computedServingCalories,
    healthScore: health.score,
    healthLabel: health.label,
    healthNotes: health.notes,
    estimatedSpikeMgDl: glucose.estimatedSpikeMgDl,
    spikeLevel: glucose.spikeLevel,
    carbsPer100g: glucose.carbsPer100g,
    sugarPer100g: glucose.sugarPer100g,
    fiberPer100g: glucose.fiberPer100g,
    proteinPer100g: glucose.proteinPer100g,
    benefitNotes: glucose.benefitNotes,
    nutriscore: product.nutriscore_grade || '',
    image: product.image_front_small_url || '',
    ingredients: product.ingredients_text || '',
    source: 'Open Food Facts',
  };

  if (userId) {
    await writeBarcodeCache(userId, barcode, responsePayload);
  }

  return NextResponse.json(responsePayload);
}