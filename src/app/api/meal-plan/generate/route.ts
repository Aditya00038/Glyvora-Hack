import { NextResponse } from 'next/server';

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

const mealVariants: Record<Meal['type'], Omit<Meal, 'id' | 'type'>[]> = {
  Breakfast: [
    {
      name: 'Spinach Omelette with Toast',
      minutes: 14,
      portion: '1 plate',
      calories: 410,
      protein: 28,
      carbs: 24,
      fat: 20,
      ingredients: ['Eggs 2', 'Spinach 1 cup', 'Whole grain toast 1 slice', 'Olive oil 1 tsp'],
      recipe: ['Whisk eggs and season.', 'Saute spinach briefly.', 'Cook omelette and serve with toast.'],
    },
    {
      name: 'Greek Yogurt Berry Bowl',
      minutes: 6,
      portion: '1 bowl',
      calories: 360,
      protein: 24,
      carbs: 26,
      fat: 16,
      ingredients: ['Greek yogurt 220g', 'Berries 80g', 'Chia seeds 10g', 'Almonds 15g'],
      recipe: ['Add yogurt to bowl.', 'Top with berries, chia, and almonds.'],
    },
  ],
  Lunch: [
    {
      name: 'Grilled Paneer Quinoa Bowl',
      minutes: 22,
      portion: '1 large bowl',
      calories: 620,
      protein: 42,
      carbs: 38,
      fat: 30,
      ingredients: ['Paneer 180g', 'Quinoa 90g', 'Bell peppers', 'Lettuce', 'Olive oil'],
      recipe: ['Cook quinoa.', 'Grill paneer and peppers.', 'Assemble bowl with greens and dressing.'],
    },
    {
      name: 'Lemon Herb Chicken Salad',
      minutes: 20,
      portion: '1 bowl',
      calories: 590,
      protein: 48,
      carbs: 24,
      fat: 30,
      ingredients: ['Chicken breast 180g', 'Lettuce', 'Cucumber', 'Cherry tomato', 'Lemon'],
      recipe: ['Season and grill chicken.', 'Prepare salad base.', 'Slice chicken and serve over salad.'],
    },
  ],
  Snack: [
    {
      name: 'Cottage Cheese and Seeds',
      minutes: 5,
      portion: '1 cup',
      calories: 280,
      protein: 20,
      carbs: 12,
      fat: 16,
      ingredients: ['Cottage cheese 200g', 'Pumpkin seeds 15g', 'Flaxseed 10g'],
      recipe: ['Add cottage cheese in bowl.', 'Top with mixed seeds.'],
    },
    {
      name: 'Roasted Chana Mix',
      minutes: 4,
      portion: '1 snack box',
      calories: 240,
      protein: 12,
      carbs: 28,
      fat: 8,
      ingredients: ['Roasted chana 45g', 'Cucumber slices', 'Lemon juice'],
      recipe: ['Mix roasted chana with lemon.', 'Serve with cucumber.'],
    },
  ],
  Dinner: [
    {
      name: 'Tofu Veg Stir Fry',
      minutes: 18,
      portion: '1 plate',
      calories: 520,
      protein: 34,
      carbs: 30,
      fat: 24,
      ingredients: ['Tofu 200g', 'Broccoli', 'Capsicum', 'Soy sauce', 'Garlic'],
      recipe: ['Pan-sear tofu cubes.', 'Stir fry vegetables.', 'Toss with sauce and serve.'],
    },
    {
      name: 'Fish with Sauteed Greens',
      minutes: 20,
      portion: '1 plate',
      calories: 540,
      protein: 44,
      carbs: 20,
      fat: 30,
      ingredients: ['Fish fillet 180g', 'Spinach', 'Beans', 'Garlic', 'Olive oil'],
      recipe: ['Season and pan-cook fish.', 'Saute greens with garlic.', 'Serve together hot.'],
    },
  ],
};

function clonePlan(plan: MealPlanResponse): MealPlanResponse {
  return JSON.parse(JSON.stringify(plan)) as MealPlanResponse;
}

function recalcDay(day: DayPlan): DayPlan {
  const calories = day.meals.reduce((s, m) => s + m.calories, 0);
  const protein = day.meals.reduce((s, m) => s + m.protein, 0);
  const carbs = day.meals.reduce((s, m) => s + m.carbs, 0);
  const fat = day.meals.reduce((s, m) => s + m.fat, 0);
  return { ...day, calories, protein, carbs, fat };
}

function buildGroceryList(days: DayPlan[]): MealPlanResponse['groceryList'] {
  const map = new Map<string, { qty: number; category: string }>();
  days.forEach((d) => {
    d.meals.forEach((meal) => {
      meal.ingredients.forEach((ing) => {
        const [itemRaw, qtyRaw] = ing.split(/\s(?=\d|\d+g|\d+ml|\d+cup|\d+tsp|\d+tbsp)/i);
        const item = (itemRaw || ing).trim();
        const qty = Number((qtyRaw || '').match(/\d+/)?.[0] || 1);
        const key = item.toLowerCase();
        const existing = map.get(key);
        if (existing) {
          existing.qty += qty;
        } else {
          map.set(key, { qty, category: 'General' });
        }
      });
    });
  });
  return Array.from(map.entries()).map(([item, value]) => ({
    item: item.replace(/(^\w)/, (m) => m.toUpperCase()),
    quantity: `${value.qty}`,
    category: value.category,
  }));
}

function replacementMeal(type: Meal['type'], seed: number): Omit<Meal, 'id' | 'type'> {
  const pool = mealVariants[type];
  return pool[seed % pool.length];
}

function regenerateSpecificMeal(currentPlan: MealPlanResponse, dayIndex: number, mealIndex: number): MealPlanResponse {
  const plan = clonePlan(currentPlan);
  const day = plan.days[dayIndex];
  if (!day || !day.meals[mealIndex]) return plan;
  const meal = day.meals[mealIndex];
  const rep = replacementMeal(meal.type, Date.now() + mealIndex + dayIndex);
  day.meals[mealIndex] = {
    ...meal,
    ...rep,
    id: `${meal.type.toLowerCase()}-${Date.now()}`,
  };
  plan.days[dayIndex] = recalcDay(day);
  plan.groceryList = buildGroceryList(plan.days);
  return plan;
}

function regenerateSpecificDay(currentPlan: MealPlanResponse, dayIndex: number): MealPlanResponse {
  const plan = clonePlan(currentPlan);
  const day = plan.days[dayIndex];
  if (!day) return plan;
  day.meals = day.meals.map((meal, idx) => {
    const rep = replacementMeal(meal.type, Date.now() + idx + dayIndex);
    return {
      ...meal,
      ...rep,
      id: `${meal.type.toLowerCase()}-${Date.now()}-${idx}`,
    };
  });
  plan.days[dayIndex] = recalcDay(day);
  plan.groceryList = buildGroceryList(plan.days);
  return plan;
}

function extractText(response: any): string {
  return response?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

function fallbackPlan(): MealPlanResponse {
  return {
    title: '3-Day Low Carb Plan',
    days: [
      {
        dayName: 'Monday',
        calories: 1880,
        protein: 122,
        carbs: 114,
        fat: 86,
        meals: [
          { id: 'm1', type: 'Breakfast', name: 'Besan Cheela with Curd', minutes: 15, portion: '2 cheela', calories: 420, protein: 24, carbs: 32, fat: 20, ingredients: ['Besan 80g', 'Curd 150g', 'Onion', 'Tomato'], recipe: ['Mix besan with water and spices.', 'Add chopped veggies.', 'Cook both sides on tawa.', 'Serve with curd.'] },
          { id: 'm2', type: 'Lunch', name: 'Grilled Chicken and Veg Bowl', minutes: 25, portion: '1 bowl', calories: 610, protein: 48, carbs: 34, fat: 28, ingredients: ['Chicken breast 180g', 'Broccoli', 'Bell peppers', 'Olive oil'], recipe: ['Season chicken and grill.', 'Saute vegetables.', 'Assemble in bowl with herbs.'] },
          { id: 'm3', type: 'Snack', name: 'Greek Yogurt with Walnuts', minutes: 5, portion: '1 cup', calories: 260, protein: 16, carbs: 14, fat: 16, ingredients: ['Greek yogurt 200g', 'Walnuts 20g'], recipe: ['Add yogurt to bowl.', 'Top with chopped walnuts.'] },
          { id: 'm4', type: 'Dinner', name: 'Paneer Stir Fry', minutes: 20, portion: '1 plate', calories: 590, protein: 34, carbs: 34, fat: 22, ingredients: ['Paneer 180g', 'Mixed veggies', 'Spices'], recipe: ['Pan-sear paneer cubes.', 'Stir fry vegetables.', 'Combine and season.'] },
        ],
      },
      {
        dayName: 'Tuesday',
        calories: 1810,
        protein: 116,
        carbs: 109,
        fat: 82,
        meals: [
          { id: 't1', type: 'Breakfast', name: 'Oats Egg Scramble Bowl', minutes: 15, portion: '1 bowl', calories: 430, protein: 26, carbs: 36, fat: 18, ingredients: ['Oats 50g', 'Eggs 2', 'Spinach', 'Milk'], recipe: ['Cook oats in milk.', 'Scramble eggs with spinach.', 'Serve together.'] },
          { id: 't2', type: 'Lunch', name: 'Dal and Quinoa Plate', minutes: 25, portion: '1 plate', calories: 560, protein: 30, carbs: 42, fat: 20, ingredients: ['Moong dal', 'Quinoa', 'Cucumber'], recipe: ['Boil dal with spices.', 'Cook quinoa separately.', 'Serve with salad.'] },
          { id: 't3', type: 'Snack', name: 'Roasted Chana and Fruit', minutes: 5, portion: '1 snack box', calories: 240, protein: 12, carbs: 28, fat: 8, ingredients: ['Roasted chana 40g', 'Apple 1'], recipe: ['Portion chana.', 'Slice apple.'] },
          { id: 't4', type: 'Dinner', name: 'Fish/Tofu with Greens', minutes: 20, portion: '1 plate', calories: 580, protein: 48, carbs: 26, fat: 36, ingredients: ['Fish or tofu', 'Leafy greens', 'Garlic'], recipe: ['Pan-cook fish/tofu.', 'Saute greens with garlic.', 'Serve warm.'] },
        ],
      },
      {
        dayName: 'Wednesday',
        calories: 1760,
        protein: 111,
        carbs: 101,
        fat: 79,
        meals: [
          { id: 'w1', type: 'Breakfast', name: 'Paneer Bhurji Toast', minutes: 15, portion: '1 plate', calories: 410, protein: 24, carbs: 28, fat: 22, ingredients: ['Paneer 120g', 'Whole grain bread 2', 'Onion', 'Tomato'], recipe: ['Make paneer bhurji.', 'Toast bread.', 'Serve together.'] },
          { id: 'w2', type: 'Lunch', name: 'Chicken Quinoa Bowl', minutes: 20, portion: '1 large bowl', calories: 620, protein: 46, carbs: 34, fat: 29, ingredients: ['Chicken 180g', 'Quinoa', 'Lettuce', 'Olive oil'], recipe: ['Cook quinoa.', 'Grill chicken.', 'Assemble bowl with dressing.'] },
          { id: 'w3', type: 'Snack', name: 'Skyr with Seeds', minutes: 5, portion: '1 cup', calories: 280, protein: 28, carbs: 13, fat: 13, ingredients: ['Skyr 200g', 'Mixed seeds 20g'], recipe: ['Add skyr in bowl.', 'Sprinkle seeds.'] },
          { id: 'w4', type: 'Dinner', name: 'Sweet Potato and Pork/Tofu', minutes: 35, portion: '1 plate', calories: 450, protein: 13, carbs: 26, fat: 15, ingredients: ['Sweet potato', 'Lean pork/tofu', 'Green beans'], recipe: ['Roast sweet potato.', 'Pan-cook protein.', 'Serve with beans.'] },
        ],
      },
    ],
    groceryList: [
      { item: 'Chicken breast', quantity: '540g', category: 'Protein' },
      { item: 'Paneer', quantity: '300g', category: 'Protein' },
      { item: 'Greek yogurt / Skyr', quantity: '600g', category: 'Dairy' },
      { item: 'Quinoa', quantity: '300g', category: 'Grains' },
      { item: 'Leafy greens', quantity: '600g', category: 'Vegetables' },
      { item: 'Sweet potato', quantity: '300g', category: 'Vegetables' },
      { item: 'Walnuts / Seeds', quantity: '120g', category: 'Nuts & Seeds' },
    ],
  };
}

export async function POST(req: Request) {
  try {
    const { mode = 'full', dayIndex = 0, mealIndex = 0, currentPlan = null, profile = {} } = await req.json();

    if (mode === 'regenerate-meal' && currentPlan?.days?.length) {
      return NextResponse.json(regenerateSpecificMeal(currentPlan, Number(dayIndex), Number(mealIndex)));
    }

    if (mode === 'regenerate-day' && currentPlan?.days?.length) {
      return NextResponse.json(regenerateSpecificDay(currentPlan, Number(dayIndex)));
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    if (!apiKey) {
      return NextResponse.json(fallbackPlan());
    }

    const prompt = `Create strict JSON for a 3-day meal plan.
User profile: ${JSON.stringify(profile)}.
Mode: ${mode}. If mode=regenerate-day regenerate only day index ${dayIndex}. If mode=regenerate-meal regenerate only day ${dayIndex} meal ${mealIndex}.
Current plan: ${JSON.stringify(currentPlan)}.
Include fields exactly:
{
  "title": "3-Day Low Carb Plan",
  "days": [{
    "dayName": "Wednesday",
    "calories": 2196,
    "protein": 220,
    "carbs": 110,
    "fat": 99,
    "meals": [{
      "id": "unique",
      "type": "Breakfast|Lunch|Snack|Dinner",
      "name": "meal name",
      "minutes": 20,
      "portion": "1 plate",
      "calories": 398,
      "protein": 48,
      "carbs": 19,
      "fat": 14,
      "ingredients": ["item with quantity"],
      "recipe": ["step 1", "step 2"]
    }]
  }],
  "groceryList": [{"item":"Paneer","quantity":"500g","category":"Protein"}]
}
Rules:
- return only JSON
- macros realistic and integers
- short recipe steps
- grocery list aggregated from all meals.`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      }),
    });

    if (!res.ok) {
      return NextResponse.json(fallbackPlan());
    }

    const data = await res.json();
    const text = extractText(data);
    const parsed = safeJsonParse<MealPlanResponse>(text);

    if (!parsed?.days?.length) {
      return NextResponse.json(fallbackPlan());
    }

    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(fallbackPlan());
  }
}
