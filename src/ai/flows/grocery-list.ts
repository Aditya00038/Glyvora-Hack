'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GroceryMealSchema = z.object({
  name: z.string().optional(),
  ingredients: z.array(z.string()).default([]),
});

const GroceryDaySchema = z.object({
  dayName: z.string(),
  meals: z.array(GroceryMealSchema).default([]),
});

const GroceryPlanSchema = z.object({
  title: z.string().optional(),
  days: z.array(GroceryDaySchema).default([]),
});

const GroceryItemSchema = z.object({
  item: z.string(),
  quantity: z.string(),
});

const GrocerySectionSchema = z.object({
  category: z.string(),
  items: z.array(GroceryItemSchema),
});

const GroceryOutputSchema = z.object({
  sections: z.array(GrocerySectionSchema),
});

export type GroceryPlanInput = z.infer<typeof GroceryPlanSchema>;
export type GroceryListOutput = z.infer<typeof GroceryOutputSchema>;

function categoryForItem(name: string): string {
  const value = name.toLowerCase();

  if (/spinach|broccoli|capsicum|pepper|tomato|onion|carrot|lettuce|cucumber|beans|cauliflower|potato|avocado|fruit|apple|banana|mango|mushroom|mint|coriander/.test(value)) {
    return 'Vegetables & Produce';
  }

  if (/rice|quinoa|oats|bread|roti|flour|oil|olive|seed|almond|walnut|peanut|chickpea|pasta|noodle|dal|lentil|rajma|chana|bean/.test(value)) {
    return 'Grains & Pantry';
  }

  if (/paneer|tofu|chicken|fish|egg|eggs|tuna|meat|turkey|soya|soy|curd|yogurt|milk|cheese/.test(value)) {
    return 'Proteins & Dairy';
  }

  if (/salt|pepper|masala|turmeric|cumin|mustard|garlic|ginger|chili|spice|hing/.test(value)) {
    return 'Spices';
  }

  return 'Other';
}

function parseIngredient(raw: string): { item: string; quantity: string } {
  const text = raw.trim();
  const quantityMatch = text.match(/^(.*?)(\d+(?:\.\d+)?\s*(?:kg|g|mg|ml|l|cup|cups|tsp|tbsp|slice|slices|piece|pieces)?)$/i);

  if (quantityMatch) {
    return {
      item: quantityMatch[1].trim().replace(/[,-]$/, ''),
      quantity: quantityMatch[2].trim(),
    };
  }

  return { item: text, quantity: '1 item' };
}

function mergeQuantities(values: string[]): string {
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  if (!normalized.length) return '1 item';

  const parsed = normalized.map((value) => {
    const match = value.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)$/);
    if (!match) return null;
    return { num: Number(match[1]), unit: match[2].toLowerCase() };
  });

  if (parsed.every(Boolean)) {
    const entries = parsed as Array<{ num: number; unit: string }>;
    const firstUnit = entries[0].unit;
    if (entries.every((entry) => entry.unit === firstUnit)) {
      const sum = entries.reduce((acc, entry) => acc + entry.num, 0);
      return `${Number.isInteger(sum) ? sum : sum.toFixed(1)} ${firstUnit}`;
    }
  }

  return Array.from(new Set(normalized)).slice(0, 3).join(' + ');
}

function buildFallbackSections(plan: GroceryPlanInput): GroceryListOutput {
  const grouped = new Map<string, Map<string, string[]>>();

  for (const day of plan.days || []) {
    for (const meal of day.meals || []) {
      for (const ingredient of meal.ingredients || []) {
        const parsed = parseIngredient(ingredient);
        const category = categoryForItem(parsed.item);
        if (!grouped.has(category)) {
          grouped.set(category, new Map());
        }

        const items = grouped.get(category)!;
        const key = parsed.item.toLowerCase();
        const existing = items.get(key) || [];
        existing.push(parsed.quantity);
        items.set(key, existing);
      }
    }
  }

  const sections = Array.from(grouped.entries())
    .map(([category, items]) => ({
      category,
      items: Array.from(items.entries())
        .map(([item, quantities]) => ({
          item: item.charAt(0).toUpperCase() + item.slice(1),
          quantity: mergeQuantities(quantities),
        }))
        .sort((left, right) => left.item.localeCompare(right.item)),
    }))
    .filter((section) => section.items.length > 0)
    .sort((left, right) => left.category.localeCompare(right.category));

  return { sections };
}

const groceryPrompt = ai.definePrompt({
  name: 'groceryPrompt',
  input: { schema: GroceryPlanSchema },
  output: { schema: GroceryOutputSchema },
  model: 'googleai/gemini-2.5-flash',
  prompt: `You are the Glyvora Grocery Extractor.

From this meal plan, extract a grocery list grouped by category.
Use exactly these groups when relevant: Vegetables & Produce, Grains & Pantry, Proteins & Dairy, Spices, Other.
Aggregate repeated ingredients across the full week.
Return JSON only with the shape:
{
  "sections": [
    {
      "category": "Vegetables & Produce",
      "items": [
        { "item": "Spinach", "quantity": "500 g" }
      ]
    }
  ]
}

Meal plan:
{{{jsonString}}}`,
});

const groceryListFlow = ai.defineFlow(
  {
    name: 'groceryListFlow',
    inputSchema: GroceryPlanSchema,
    outputSchema: GroceryOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await groceryPrompt({
        ...input,
        jsonString: JSON.stringify(input, null, 2),
      } as GroceryPlanInput & { jsonString: string });

      if (!output) {
        throw new Error('No grocery output returned');
      }

      return output;
    } catch (error) {
      console.warn('Grocery extraction fell back to deterministic grouping:', error);
      return buildFallbackSections(input);
    }
  }
);

export async function generateGroceryListFromMealPlan(plan: GroceryPlanInput): Promise<GroceryListOutput> {
  return groceryListFlow(plan);
}
