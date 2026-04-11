'use server';

import { generateGroceryListFromMealPlan, type GroceryPlanInput, type GroceryListOutput } from '@/ai/flows/grocery-list';

export async function buildGroceryListFromMealPlan(plan: GroceryPlanInput): Promise<GroceryListOutput> {
  return generateGroceryListFromMealPlan(plan);
}
