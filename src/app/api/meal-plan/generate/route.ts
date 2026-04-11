import { NextResponse } from 'next/server';
import { callMealPlanGenerator } from '@/actions/meal-plan';

type Meal = {
  id: string;
  type: 'Breakfast' | 'Lunch' | 'Snack' | 'Dinner';
  name: string;
  minutes: number;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: string[];
  recipe: string[];
};

type DayPlan = {
  dayName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meals: Meal[];
};

type MealPlanResponse = {
  title: string;
  days: DayPlan[];
  groceryList: Array<{ item: string; quantity: string; category: string }>;
};

type ProfileInput = {
  dietaryPreference?: string;
  activityLevel?: string;
  healthGoals?: string[];
  foodAllergies?: string;
  medicalConditions?: string;
};

type BaseMeal = Omit<Meal, 'id' | 'type'> & {
  vegetarian: boolean;
  vegan?: boolean;
};

const REQUIRED_MEAL_TYPES: Meal['type'][] = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];

function asMealType(value: string | undefined): Meal['type'] {
  if (value === 'Breakfast' || value === 'Lunch' || value === 'Snack' || value === 'Dinner') {
    return value;
  }
  return 'Breakfast';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseRatio(value: string | undefined): { proteinShare: number; carbShare: number } | null {
  if (!value) return null;
  const parts = value
    .split(':')
    .map((part) => Number.parseFloat(part.trim()))
    .filter((part) => Number.isFinite(part) && part > 0);

  // Expected ratio is Fiber:Protein:Carb.
  if (parts.length < 3) return null;

  const proteinPart = parts[1];
  const carbPart = parts[2];
  const sum = proteinPart + carbPart;
  if (sum <= 0) return null;

  return {
    proteinShare: proteinPart / sum,
    carbShare: carbPart / sum,
  };
}

function baseTargetForMealType(type: Meal['type']): { calories: number; protein: number; carbs: number; fat: number } {
  if (type === 'Breakfast') return { calories: 420, protein: 28, carbs: 40, fat: 16 };
  if (type === 'Lunch') return { calories: 620, protein: 36, carbs: 62, fat: 24 };
  if (type === 'Snack') return { calories: 250, protein: 16, carbs: 22, fat: 10 };
  return { calories: 540, protein: 34, carbs: 40, fat: 22 };
}

function deriveMealNutrition(
  type: Meal['type'],
  ratio: string | undefined,
  estimatedSpike: number | undefined,
  sensitivity: string,
  correctionMode: boolean
): { calories: number; protein: number; carbs: number; fat: number } {
  const target = baseTargetForMealType(type);
  const isHighSensitivity = sensitivity === 'high' || correctionMode;
  const isLowSensitivity = sensitivity === 'low' && !correctionMode;

  let calories = target.calories;
  let protein = target.protein;
  let carbs = target.carbs;
  let fat = target.fat;

  if (isHighSensitivity) {
    protein = Math.round(protein * 1.12);
    carbs = Math.round(carbs * 0.82);
    fat = Math.round(fat * 1.05);
    calories = Math.round(calories * 0.95);
  } else if (isLowSensitivity) {
    carbs = Math.round(carbs * 1.08);
    calories = Math.round(calories * 1.04);
  }

  const ratioParsed = parseRatio(ratio);
  if (ratioParsed) {
    const proteinCarbCalories = Math.round(calories * 0.66);
    protein = Math.round((proteinCarbCalories * ratioParsed.proteinShare) / 4);
    carbs = Math.round((proteinCarbCalories * ratioParsed.carbShare) / 4);
    fat = Math.round((calories - protein * 4 - carbs * 4) / 9);
  }

  if (typeof estimatedSpike === 'number' && estimatedSpike > 35) {
    carbs = Math.round(carbs * 0.88);
    protein = Math.round(protein * 1.08);
  }

  protein = clamp(protein, 10, 60);
  carbs = clamp(carbs, 12, 85);
  fat = clamp(fat, 6, 35);
  calories = clamp(protein * 4 + carbs * 4 + fat * 9, 180, 800);

  return { calories, protein, carbs, fat };
}

function buildIngredientsFromDescription(type: Meal['type'], name: string, description: string | undefined): string[] {
  const text = (description || '').trim();
  if (text.includes(',')) {
    const parsed = text
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 6);
    if (parsed.length) return parsed;
  }

  if (text.length > 0 && text.length < 70) {
    return [text, 'Protein side', 'Seasonal vegetables'];
  }

  if (type === 'Breakfast') return [name, 'Vegetables', 'Healthy fat source'];
  if (type === 'Lunch') return [name, 'Dal or protein', 'Salad'];
  if (type === 'Snack') return [name, 'Nuts or seeds', 'Hydration option'];
  return [name, 'Protein component', 'High-fiber side'];
}

function buildRecipeSteps(description: string | undefined, estimatedSpike: number | undefined): string[] {
  const base = (description || '')
    .split(/\.|\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3);

  const steps = base.length
    ? base
    : ['Prep ingredients.', 'Cook with minimal refined carbs and balanced fats.', 'Serve warm.'];

  if (typeof estimatedSpike === 'number') {
    steps.push(`Estimated glucose spike: ${Math.round(estimatedSpike)} mg/dL.`);
  }

  return steps.slice(0, 5);
}

function fallbackMealFromVariant(type: Meal['type'], dayIndex: number): Meal {
  const pool = mealVariants[type];
  const selected = pool[dayIndex % pool.length];
  const { vegetarian: _v, vegan: _vg, ...base } = selected;
  return {
    id: `genkit-fill-${type.toLowerCase()}-${dayIndex}`,
    type,
    ...base,
  };
}

function convertGenkitToDayPlan(genkitPlan: any): MealPlanResponse {
  if (!genkitPlan || !genkitPlan.days) {
    throw new Error('Invalid Genkit meal plan format');
  }

  const sensitivity = String(genkitPlan?.metadata?.userSensitivity || 'medium').toLowerCase();
  const correctionMode = Boolean(genkitPlan?.metadata?.correctionMode);
  const title = genkitPlan.title || '7-Day Metabolic Meal Plan';
  const sourceDays: any[] = Array.isArray(genkitPlan.days) ? genkitPlan.days : [];
  const days: DayPlan[] = DAY_NAMES.map((dayName, dayIndex) => {
    const sourceDay = sourceDays[dayIndex] || sourceDays[dayIndex % Math.max(1, sourceDays.length)] || {};
    const sourceMeals = Array.isArray(sourceDay.meals) ? sourceDay.meals : [];

    const generatedMeals = sourceMeals.map((genkitMeal: any, mealIndex: number) => {
      const type = asMealType(genkitMeal?.type);
      const nutrition = deriveMealNutrition(
        type,
        genkitMeal?.macronutrientRatio,
        typeof genkitMeal?.estimatedSpike === 'number' ? genkitMeal.estimatedSpike : undefined,
        sensitivity,
        correctionMode
      );

      return {
        id: `genkit-${dayIndex}-${mealIndex}-${type.toLowerCase()}`,
        type,
        name: String(genkitMeal?.name || `${type} Meal`),
        minutes: type === 'Snack' ? 10 : 20,
        portion: '1 serving',
        ...nutrition,
        ingredients: buildIngredientsFromDescription(type, String(genkitMeal?.name || type), genkitMeal?.description),
        recipe: buildRecipeSteps(genkitMeal?.description, genkitMeal?.estimatedSpike),
      } as Meal;
    });

    const byType = new Map<Meal['type'], Meal>();
    for (const meal of generatedMeals) {
      if (!byType.has(meal.type)) {
        byType.set(meal.type, meal);
      }
    }

    const completeMeals: Meal[] = REQUIRED_MEAL_TYPES.map((type) => byType.get(type) || fallbackMealFromVariant(type, dayIndex));

    return recalcDay({
      dayName: String(sourceDay?.dayName || dayName),
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      meals: completeMeals,
    });
  });

  const groceryItems = new Map<string, { quantity: string; category: string }>();
  days.forEach(day => {
    day.meals.forEach(meal => {
      meal.ingredients.forEach(ing => {
        const key = ing.toLowerCase();
        if (!groceryItems.has(key)) {
          groceryItems.set(key, { quantity: '1 serving', category: 'Ingredients' });
        }
      });
    });
  });

  const groceryList = Array.from(groceryItems.entries()).map(([item, data]) => ({
    item: item.charAt(0).toUpperCase() + item.slice(1),
    ...data,
  }));

  return {
    title,
    days,
    groceryList,
  };
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const mealVariants: Record<Meal['type'], BaseMeal[]> = {
  Breakfast: [
    {
      name: 'Veg Oats Upma',
      minutes: 15,
      portion: '1 bowl',
      calories: 390,
      protein: 18,
      carbs: 48,
      fat: 12,
      vegetarian: true,
      vegan: true,
      ingredients: ['Oats 70g', 'Mixed vegetables 120g', 'Mustard seeds 1 tsp', 'Peanuts 10g'],
      recipe: ['Dry roast oats lightly.', 'Saute vegetables with spices.', 'Mix oats and cook with water.'],
    },
    {
      name: 'Paneer Bhurji with Multigrain Toast',
      minutes: 14,
      portion: '1 plate',
      calories: 430,
      protein: 24,
      carbs: 28,
      fat: 22,
      vegetarian: true,
      ingredients: ['Paneer 120g', 'Onion 40g', 'Tomato 40g', 'Multigrain toast 2 slices'],
      recipe: ['Crumble paneer.', 'Saute onion and tomato.', 'Cook paneer with spices and serve with toast.'],
    },
    {
      name: 'Egg and Veg Scramble Bowl',
      minutes: 12,
      portion: '1 bowl',
      calories: 410,
      protein: 28,
      carbs: 24,
      fat: 20,
      vegetarian: false,
      ingredients: ['Eggs 2', 'Spinach 60g', 'Mushrooms 80g', 'Olive oil 1 tsp'],
      recipe: ['Whisk eggs.', 'Saute vegetables.', 'Scramble eggs with vegetables until set.'],
    },
  ],
  Lunch: [
    {
      name: 'Dal, Brown Rice and Salad Plate',
      minutes: 24,
      portion: '1 plate',
      calories: 560,
      protein: 22,
      carbs: 72,
      fat: 16,
      vegetarian: true,
      vegan: true,
      ingredients: ['Moong dal 90g', 'Brown rice 80g', 'Cucumber 80g', 'Carrot 60g'],
      recipe: ['Pressure cook dal.', 'Cook rice until fluffy.', 'Serve with fresh salad.'],
    },
    {
      name: 'Grilled Paneer Quinoa Bowl',
      minutes: 22,
      portion: '1 large bowl',
      calories: 620,
      protein: 40,
      carbs: 42,
      fat: 30,
      vegetarian: true,
      ingredients: ['Paneer 170g', 'Quinoa 90g', 'Capsicum 70g', 'Lettuce 60g'],
      recipe: ['Cook quinoa.', 'Grill paneer and capsicum.', 'Assemble bowl with greens.'],
    },
    {
      name: 'Grilled Chicken and Veg Bowl',
      minutes: 24,
      portion: '1 bowl',
      calories: 610,
      protein: 48,
      carbs: 34,
      fat: 28,
      vegetarian: false,
      ingredients: ['Chicken breast 180g', 'Broccoli 100g', 'Bell peppers 90g', 'Olive oil 1 tbsp'],
      recipe: ['Season chicken and grill.', 'Saute vegetables.', 'Serve together in bowl.'],
    },
  ],
  Snack: [
    {
      name: 'Greek Yogurt with Seeds',
      minutes: 5,
      portion: '1 cup',
      calories: 260,
      protein: 16,
      carbs: 14,
      fat: 16,
      vegetarian: true,
      ingredients: ['Greek yogurt 200g', 'Pumpkin seeds 10g', 'Flaxseed 10g'],
      recipe: ['Add yogurt to bowl.', 'Top with mixed seeds.'],
    },
    {
      name: 'Roasted Chana and Apple',
      minutes: 4,
      portion: '1 snack box',
      calories: 240,
      protein: 12,
      carbs: 30,
      fat: 7,
      vegetarian: true,
      vegan: true,
      ingredients: ['Roasted chana 45g', 'Apple 1 medium'],
      recipe: ['Portion roasted chana.', 'Slice apple and serve.'],
    },
    {
      name: 'Tuna Salad Cup',
      minutes: 8,
      portion: '1 cup',
      calories: 250,
      protein: 26,
      carbs: 8,
      fat: 12,
      vegetarian: false,
      ingredients: ['Tuna 100g', 'Cucumber 60g', 'Curd 40g', 'Lemon 1 tsp'],
      recipe: ['Mix tuna and curd.', 'Fold in cucumber and lemon.'],
    },
  ],
  Dinner: [
    {
      name: 'Tofu Veg Stir Fry',
      minutes: 20,
      portion: '1 plate',
      calories: 520,
      protein: 34,
      carbs: 30,
      fat: 24,
      vegetarian: true,
      vegan: true,
      ingredients: ['Tofu 200g', 'Broccoli 100g', 'Capsicum 80g', 'Soy sauce 1 tbsp'],
      recipe: ['Pan-sear tofu cubes.', 'Stir fry vegetables.', 'Toss tofu with vegetables and sauce.'],
    },
    {
      name: 'Palak Paneer with Millet Roti',
      minutes: 28,
      portion: '1 plate',
      calories: 570,
      protein: 30,
      carbs: 42,
      fat: 28,
      vegetarian: true,
      ingredients: ['Paneer 150g', 'Spinach 180g', 'Millet flour 70g', 'Garlic 2 cloves'],
      recipe: ['Blend spinach base.', 'Cook paneer in spinach gravy.', 'Serve with fresh millet roti.'],
    },
    {
      name: 'Fish with Sauteed Greens',
      minutes: 22,
      portion: '1 plate',
      calories: 540,
      protein: 44,
      carbs: 20,
      fat: 30,
      vegetarian: false,
      ingredients: ['Fish fillet 180g', 'Spinach 120g', 'Beans 90g', 'Olive oil 1 tbsp'],
      recipe: ['Season and pan-cook fish.', 'Saute greens and beans.', 'Serve together hot.'],
    },
  ],
};

function clonePlan(plan: MealPlanResponse): MealPlanResponse {
  return JSON.parse(JSON.stringify(plan)) as MealPlanResponse;
}

function recalcDay(day: DayPlan): DayPlan {
  const calories = day.meals.reduce((sum, meal) => sum + meal.calories, 0);
  const protein = day.meals.reduce((sum, meal) => sum + meal.protein, 0);
  const carbs = day.meals.reduce((sum, meal) => sum + meal.carbs, 0);
  const fat = day.meals.reduce((sum, meal) => sum + meal.fat, 0);
  return { ...day, calories, protein, carbs, fat };
}

function buildGroceryList(days: DayPlan[]): MealPlanResponse['groceryList'] {
  const items = new Map<string, { quantity: number; category: string }>();

  for (const day of days) {
    for (const meal of day.meals) {
      for (const ingredient of meal.ingredients) {
        const [itemRaw, qtyRaw] = ingredient.split(/\s(?=\d|\d+g|\d+ml|\d+cup|\d+tsp|\d+tbsp)/i);
        const itemName = (itemRaw || ingredient).trim();
        const quantity = Number((qtyRaw || '').match(/\d+/)?.[0] || 1);
        const key = itemName.toLowerCase();
        const existing = items.get(key);

        if (existing) {
          existing.quantity += quantity;
        } else {
          items.set(key, { quantity, category: 'General' });
        }
      }
    }
  }

  return Array.from(items.entries()).map(([item, value]) => ({
    item: item.charAt(0).toUpperCase() + item.slice(1),
    quantity: String(value.quantity),
    category: value.category,
  }));
}

function extractText(response: any): string {
  return response?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('') || '';
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

function isVegetarianPreference(preference: string): boolean {
  const normalized = preference.trim().toLowerCase();
  return normalized.includes('veg') || normalized.includes('vegetarian') || normalized.includes('vegan') || normalized.includes('jain');
}

function isVeganPreference(preference: string): boolean {
  return preference.trim().toLowerCase().includes('vegan');
}

function mealPoolFor(type: Meal['type'], dietaryPreference: string): BaseMeal[] {
  const isVeg = isVegetarianPreference(dietaryPreference);
  const isVegan = isVeganPreference(dietaryPreference);

  let pool = mealVariants[type];

  if (isVeg) {
    pool = pool.filter((meal) => meal.vegetarian);
  }

  if (isVegan) {
    pool = pool.filter((meal) => meal.vegan);
  }

  return pool.length ? pool : mealVariants[type].filter((meal) => meal.vegetarian);
}

function replacementMeal(type: Meal['type'], seed: number, profile: ProfileInput): Omit<Meal, 'id' | 'type'> {
  const dietaryPreference = String(profile.dietaryPreference || 'Vegetarian');
  const pool = mealPoolFor(type, dietaryPreference);
  const selected = pool[Math.abs(seed) % pool.length];
  const { vegetarian: _v, vegan: _vegan, ...meal } = selected;
  return meal;
}

function generateFallbackWeek(profile: ProfileInput, scannedFoods: string[] = []): MealPlanResponse {
  const dietaryPreference = String(profile.dietaryPreference || 'Vegetarian');
  const titlePrefix = isVegetarianPreference(dietaryPreference) ? '7-Day Vegetarian' : '7-Day Personalized';

  const days: DayPlan[] = DAY_NAMES.map((dayName, dayIndex) => {
    const meals: Meal[] = (['Breakfast', 'Lunch', 'Snack', 'Dinner'] as Meal['type'][]).map((type, mealIndex) => {
      const base = replacementMeal(type, dayIndex * 13 + mealIndex * 7 + 3, profile);
      const inspiration = scannedFoods[dayIndex % (scannedFoods.length || 1)] || '';
      const inspiredName = inspiration ? `${base.name} (inspired by ${inspiration})` : base.name;

      return {
        id: `${type.toLowerCase()}-${dayIndex}-${mealIndex}`,
        type,
        ...base,
        name: inspiredName,
      };
    });

    return recalcDay({
      dayName,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      meals,
    });
  });

  return {
    title: `${titlePrefix} Glucose-Friendly Plan`,
    days,
    groceryList: buildGroceryList(days),
  };
}

function regenerateSpecificMeal(currentPlan: MealPlanResponse, dayIndex: number, mealIndex: number, profile: ProfileInput): MealPlanResponse {
  const plan = clonePlan(currentPlan);
  const day = plan.days[dayIndex];
  if (!day || !day.meals[mealIndex]) return plan;

  const meal = day.meals[mealIndex];
  const replacement = replacementMeal(meal.type, Date.now() + dayIndex + mealIndex, profile);
  day.meals[mealIndex] = {
    ...meal,
    ...replacement,
    id: `${meal.type.toLowerCase()}-${Date.now()}`,
  };

  plan.days[dayIndex] = recalcDay(day);
  plan.groceryList = buildGroceryList(plan.days);
  return plan;
}

function regenerateSpecificDay(currentPlan: MealPlanResponse, dayIndex: number, profile: ProfileInput): MealPlanResponse {
  const plan = clonePlan(currentPlan);
  const day = plan.days[dayIndex];
  if (!day) return plan;

  day.meals = day.meals.map((meal, mealIndex) => {
    const replacement = replacementMeal(meal.type, Date.now() + dayIndex + mealIndex, profile);
    return {
      ...meal,
      ...replacement,
      id: `${meal.type.toLowerCase()}-${Date.now()}-${mealIndex}`,
    };
  });

  plan.days[dayIndex] = recalcDay(day);
  plan.groceryList = buildGroceryList(plan.days);
  return plan;
}

function validateMealPlan(data: MealPlanResponse | null): data is MealPlanResponse {
  if (!data || !Array.isArray(data.days) || data.days.length < 7) {
    return false;
  }

  return data.days.every((day) => Array.isArray(day.meals) && day.meals.length > 0);
}

type MealDbResponse = {
  meals: Array<Record<string, string | null>> | null;
};

function normalizePreference(preference: string): string {
  return preference.trim().toLowerCase();
}

function isNonVegPreference(preference: string): boolean {
  const p = normalizePreference(preference);
  return p.includes('non') || p.includes('chicken') || p.includes('fish') || p.includes('meat');
}

function categoryForType(type: Meal['type']): string {
  if (type === 'Breakfast') return 'Breakfast';
  if (type === 'Lunch') return 'Vegetarian';
  if (type === 'Snack') return 'Side';
  return 'Vegetarian';
}

function estimateMealMacros(type: Meal['type']) {
  if (type === 'Breakfast') return { calories: 420, protein: 20, carbs: 45, fat: 14 };
  if (type === 'Lunch') return { calories: 610, protein: 30, carbs: 60, fat: 24 };
  if (type === 'Snack') return { calories: 260, protein: 10, carbs: 24, fat: 10 };
  return { calories: 560, protein: 28, carbs: 40, fat: 24 };
}

function parseIngredients(meal: Record<string, string | null>): string[] {
  const values: string[] = [];
  for (let i = 1; i <= 20; i += 1) {
    const ingredient = (meal[`strIngredient${i}`] || '').trim();
    const measure = (meal[`strMeasure${i}`] || '').trim();
    if (ingredient) {
      values.push(`${ingredient}${measure ? ` ${measure}` : ''}`.trim());
    }
  }
  return values.slice(0, 8);
}

function parseInstructions(text: string | null): string[] {
  if (!text) return ['Prepare ingredients.', 'Cook and serve warm.'];
  return text
    .split(/\r?\n|\./)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);
}

async function fetchMealDbCandidates(type: Meal['type'], profile: ProfileInput): Promise<Array<Omit<Meal, 'id' | 'type'>>> {
  const pref = String(profile.dietaryPreference || 'Vegetarian');
  const vegOnly = isVegetarianPreference(pref);
  const allowNonVeg = isNonVegPreference(pref) && !vegOnly;
  const category = allowNonVeg && type !== 'Snack' ? 'Chicken' : categoryForType(type);

  const endpoint = `https://www.themealdb.com/api/json/v1/1/filter.php?c=${encodeURIComponent(category)}`;
  const listRes = await fetch(endpoint, { cache: 'no-store' });
  if (!listRes.ok) return [];

  const listData = (await listRes.json()) as MealDbResponse;
  const shortlist = (listData.meals || []).slice(0, 8);

  const details = await Promise.all(
    shortlist.map(async (entry) => {
      const mealId = entry.idMeal;
      if (!mealId) return null;

      const detailRes = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${mealId}`, { cache: 'no-store' });
      if (!detailRes.ok) return null;
      const detailData = (await detailRes.json()) as MealDbResponse;
      const meal = detailData.meals?.[0];
      if (!meal) return null;

      const ingredients = parseIngredients(meal);
      const recipe = parseInstructions(meal.strInstructions || null);
      const macros = estimateMealMacros(type);

      return {
        name: meal.strMeal || 'Meal',
        minutes: type === 'Snack' ? 10 : 25,
        portion: '1 serving',
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        ingredients,
        recipe,
      } as Omit<Meal, 'id' | 'type'>;
    })
  );

  return details.filter(Boolean) as Array<Omit<Meal, 'id' | 'type'>>;
}

async function generateDatasetWeek(profile: ProfileInput, scannedFoods: string[] = []): Promise<MealPlanResponse | null> {
  const types: Meal['type'][] = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];
  const pools = await Promise.all(types.map((type) => fetchMealDbCandidates(type, profile)));

  if (pools.some((pool) => pool.length === 0)) {
    return null;
  }

  const days: DayPlan[] = DAY_NAMES.map((dayName, dayIndex) => {
    const meals: Meal[] = types.map((type, mealIndex) => {
      const pool = pools[mealIndex];
      const base = pool[(dayIndex + mealIndex) % pool.length];
      const inspiration = scannedFoods[dayIndex % (scannedFoods.length || 1)] || '';

      return {
        id: `${type.toLowerCase()}-${dayIndex}-${mealIndex}`,
        type,
        ...base,
        name: inspiration ? `${base.name} (inspired by ${inspiration})` : base.name,
      };
    });

    return recalcDay({ dayName, calories: 0, protein: 0, carbs: 0, fat: 0, meals });
  });

  const pref = String(profile.dietaryPreference || 'Vegetarian');
  return {
    title: `${isVegetarianPreference(pref) ? '7-Day Vegetarian' : '7-Day Personalized'} Meal Plan (Dataset)`,
    days,
    groceryList: buildGroceryList(days),
  };
}

export async function POST(req: Request) {
  try {
    const {
      mode = 'full',
      dayIndex = 0,
      mealIndex = 0,
      currentPlan = null,
      profile = {},
      scannedFoods = [],
      userId,
    } = await req.json();

    const typedProfile = (profile || {}) as ProfileInput;

    // Try Genkit meal plan first if userId and mode is 'full'
    if (mode === 'full' && userId) {
      try {
        const genkitResult = await callMealPlanGenerator(userId, false);
        if (genkitResult.plan && genkitResult.source === 'genkit-meal-planner') {
          const converted = convertGenkitToDayPlan(genkitResult.plan);
          return NextResponse.json(converted);
        }
      } catch (genkitError) {
        console.warn('Genkit meal plan generation failed, falling back to traditional approach:', genkitError);
        // Fall through to legacy paths
      }
    }

    if (mode === 'regenerate-meal' && currentPlan?.days?.length) {
      return NextResponse.json(regenerateSpecificMeal(currentPlan, Number(dayIndex), Number(mealIndex), typedProfile));
    }

    if (mode === 'regenerate-day' && currentPlan?.days?.length) {
      return NextResponse.json(regenerateSpecificDay(currentPlan, Number(dayIndex), typedProfile));
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    if (!apiKey) {
      const datasetPlan = await generateDatasetWeek(typedProfile, Array.isArray(scannedFoods) ? scannedFoods : []);
      return NextResponse.json(datasetPlan || generateFallbackWeek(typedProfile, Array.isArray(scannedFoods) ? scannedFoods : []));
    }

    const dietaryPreference = String(typedProfile.dietaryPreference || 'Vegetarian');
    const strictRule = isVegetarianPreference(dietaryPreference)
      ? '- STRICT: Every meal must be vegetarian only. Never include fish, chicken, egg, mutton, or any meat.'
      : '- Include meals matching dietary preference exactly.';

    const prompt = `Create strict JSON for a 7-day meal plan.
User profile: ${JSON.stringify(typedProfile)}.
Scanned foods history (context only): ${JSON.stringify(scannedFoods)}.
Include fields exactly:
{
  "title": "7-Day Glucose-Friendly Meal Plan",
  "days": [{
    "dayName": "Monday",
    "calories": 2000,
    "protein": 120,
    "carbs": 180,
    "fat": 70,
    "meals": [{
      "id": "unique",
      "type": "Breakfast|Lunch|Snack|Dinner",
      "name": "meal name",
      "minutes": 20,
      "portion": "1 plate",
      "calories": 400,
      "protein": 24,
      "carbs": 30,
      "fat": 14,
      "ingredients": ["item with quantity"],
      "recipe": ["step 1", "step 2"]
    }]
  }],
  "groceryList": [{"item":"Paneer","quantity":"500g","category":"Protein"}]
}
Rules:
- return only JSON
- generate exactly 7 day entries from Monday to Sunday
- exactly 4 meals per day: Breakfast, Lunch, Snack, Dinner
- macros realistic and integers
- short recipe steps
- grocery list aggregated from all 7 days
- follow dietary preference strictly
${strictRule}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      return NextResponse.json(generateFallbackWeek(typedProfile, Array.isArray(scannedFoods) ? scannedFoods : []));
    }

    const data = await response.json();
    const text = extractText(data);
    const parsed = safeJsonParse<MealPlanResponse>(text);

    if (!validateMealPlan(parsed)) {
      const datasetPlan = await generateDatasetWeek(typedProfile, Array.isArray(scannedFoods) ? scannedFoods : []);
      return NextResponse.json(datasetPlan || generateFallbackWeek(typedProfile, Array.isArray(scannedFoods) ? scannedFoods : []));
    }

    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(generateFallbackWeek({}, []));
  }
}
