import { NextResponse } from 'next/server';

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

  if (!barcode) {
    return NextResponse.json({ error: 'Missing barcode' }, { status: 400 });
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
    return NextResponse.json({
      found: false,
      hasNutrition: false,
      barcode,
      message: 'Invalid barcode or product not found in Food Facts database.',
    });
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
    return NextResponse.json({
      found: true,
      hasNutrition: false,
      barcode: product.code || barcode,
      productName: product.product_name || 'Unknown product',
      message: 'Product found, but nutrition facts are not available for this barcode.',
    });
  }

  const health = buildHealthScore(product);

  return NextResponse.json({
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
    nutriscore: product.nutriscore_grade || '',
    image: product.image_front_small_url || '',
    ingredients: product.ingredients_text || '',
    source: 'Open Food Facts',
  });
}