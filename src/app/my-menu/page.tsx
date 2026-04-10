"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth, useFirestore } from '@/firebase';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Printer, RefreshCw, ShoppingCart } from 'lucide-react';

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

type MealPlan = {
  title: string;
  days: DayPlan[];
  groceryList: Array<{ item: string; quantity: string; category: string }>;
};

const mealBadgeTone: Record<Meal['type'], string> = {
  Breakfast: 'bg-orange-100 text-orange-700',
  Lunch: 'bg-yellow-100 text-yellow-700',
  Snack: 'bg-emerald-100 text-emerald-700',
  Dinner: 'bg-indigo-100 text-indigo-700',
};

export default function MyMenuPage() {
  const auth = useAuth();
  const firestore = useFirestore();

  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [loading, setLoading] = useState(false);
  const [regeneratingDay, setRegeneratingDay] = useState(false);
  const [regeneratingMealId, setRegeneratingMealId] = useState<string | null>(null);

  const currentDay = plan?.days?.[selectedDay];

  const getProfileForGeneration = async () => {
    const user = auth.currentUser;
    if (!user) return {};
    const snap = await getDoc(doc(firestore, 'users', user.uid));
    if (!snap.exists()) return {};
    const data = snap.data() as any;
    return {
      dietaryPreference: data.dietaryPreference || 'balanced',
      activityLevel: data.activityLevel || 'moderate',
      healthGoals: data.healthGoals || [],
      foodAllergies: data.foodAllergies || 'none',
      medicalConditions: data.medicalConditions || 'none',
    };
  };

  const fetchPlan = async () => {
    setLoading(true);
    try {
      const profile = await getProfileForGeneration();
      const res = await fetch('/api/meal-plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'full', profile }),
      });
      const data = await res.json();
      setPlan(data);
      setSelectedDay(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan();
  }, []);

  useEffect(() => {
    if (!plan || typeof window === 'undefined') return;
    window.localStorage.setItem('glyvora_latest_meal_plan', JSON.stringify(plan));
  }, [plan]);

  const regenerateDay = async () => {
    if (!plan) return;
    setRegeneratingDay(true);
    try {
      const profile = await getProfileForGeneration();
      const res = await fetch('/api/meal-plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'regenerate-day', dayIndex: selectedDay, currentPlan: plan, profile }),
      });
      const regenerated = await res.json();
      const updated = { ...plan };
      updated.days[selectedDay] = regenerated.days[selectedDay] || regenerated.days[0];
      updated.groceryList = regenerated.groceryList || updated.groceryList;
      setPlan(updated);
    } finally {
      setRegeneratingDay(false);
    }
  };

  const regenerateMeal = async (mealIndex: number) => {
    if (!plan) return;
    const mealId = currentDay?.meals?.[mealIndex]?.id;
    if (!mealId) return;

    setRegeneratingMealId(mealId);
    try {
      const profile = await getProfileForGeneration();
      const res = await fetch('/api/meal-plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'regenerate-meal', dayIndex: selectedDay, mealIndex, currentPlan: plan, profile }),
      });
      const regenerated = await res.json();
      const updated = { ...plan };
      const newDay = regenerated.days[selectedDay] || regenerated.days[0];
      const nextMeal = newDay?.meals?.[mealIndex];
      if (nextMeal) {
        updated.days[selectedDay].meals[mealIndex] = nextMeal;
      }
      updated.groceryList = regenerated.groceryList || updated.groceryList;
      setPlan(updated);
    } finally {
      setRegeneratingMealId(null);
    }
  };

  const printGroceryList = () => {
    if (!plan?.groceryList?.length) return;
    const popup = window.open('', '_blank');
    if (!popup) return;
    popup.document.write(`
      <html><head><title>Grocery List - GLYVORA</title>
      <style>
      body { font-family: Arial, sans-serif; padding: 24px; }
      h1 { margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; }
      td, th { border: 1px solid #ddd; padding: 8px; }
      th { background: #f3f4f6; text-align: left; }
      </style></head><body>
      <h1>GLYVORA Grocery List</h1>
      <table><thead><tr><th>Item</th><th>Quantity</th><th>Category</th></tr></thead><tbody>
      ${plan.groceryList.map((g) => `<tr><td>${g.item}</td><td>${g.quantity}</td><td>${g.category}</td></tr>`).join('')}
      </tbody></table>
      </body></html>
    `);
    popup.document.close();
    popup.print();
  };

  const getMealDescription = (meal: Meal | null) => {
    if (!meal) return '';
    const carbsTone = meal.carbs <= 20 ? 'low-carbohydrate' : meal.carbs <= 40 ? 'moderate-carbohydrate' : 'higher-carbohydrate';
    const proteinTone = meal.protein >= 30 ? 'high-protein' : meal.protein >= 18 ? 'balanced-protein' : 'light-protein';
    return `A ${proteinTone}, ${carbsTone} ${meal.type.toLowerCase()} designed to support steadier glucose response with practical ingredients.`;
  };

  const macroPercents = selectedMeal
    ? {
        protein: Math.round((selectedMeal.protein * 4 * 100) / Math.max(1, selectedMeal.calories)),
        carbs: Math.round((selectedMeal.carbs * 4 * 100) / Math.max(1, selectedMeal.calories)),
        fat: Math.round((selectedMeal.fat * 9 * 100) / Math.max(1, selectedMeal.calories)),
      }
    : { protein: 0, carbs: 0, fat: 0 };

  return (
    <div className="min-h-screen bg-[#F5F3F0] text-slate-900 pb-10 lg:ml-48 xl:ml-52">
      <Navigation />
      <main className="mx-auto max-w-6xl px-4 pt-4 lg:pt-6">
        <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Badge className="bg-emerald-500 text-white">Weekly</Badge>
                <Badge variant="outline">{plan?.days?.length || 7} days</Badge>
              </div>
              <h1 className="text-4xl font-semibold tracking-tight">{plan?.title || '7-Day Glucose-Friendly Plan'}</h1>
              <p className="mt-1 text-sm text-slate-600">AI-generated meal plan tailored to your nutritional needs and preferences.</p>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/grocery-list">
                <Button variant="outline" className="rounded-xl">
                  <ShoppingCart className="mr-2 h-4 w-4" /> Grocery List
                </Button>
              </Link>
              <Button variant="outline" className="rounded-xl" onClick={printGroceryList}>
                <Printer className="mr-2 h-4 w-4" /> Print
              </Button>
              <Button className="rounded-xl bg-emerald-500 text-white hover:bg-emerald-600" onClick={fetchPlan} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Generate Meal Plan
              </Button>
            </div>
          </div>

          <div className="mt-4 border-b border-slate-200 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {plan?.days?.map((d, idx) => (
                  <button
                    key={d.dayName + idx}
                    className={`rounded-lg px-3 py-1.5 text-sm ${idx === selectedDay ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'}`}
                    onClick={() => setSelectedDay(idx)}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
              <Button variant="outline" className="rounded-xl" onClick={regenerateDay} disabled={regeneratingDay || !currentDay}>
                {regeneratingDay ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Regenerate Day
              </Button>
            </div>
          </div>

          <div className="mt-4">
            <h2 className="text-5xl font-semibold tracking-tight">{currentDay?.dayName || 'Day'}</h2>
            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3">
              <div className="grid gap-2 sm:grid-cols-4 text-center">
                <div><p className="text-4xl font-semibold">{currentDay?.calories || 0}</p><p className="text-sm text-slate-600">🔥 Calories</p></div>
                <div><p className="text-4xl font-semibold text-blue-600">{currentDay?.protein || 0}g</p><p className="text-sm text-slate-600">💪 Protein</p></div>
                <div><p className="text-4xl font-semibold text-emerald-600">{currentDay?.carbs || 0}g</p><p className="text-sm text-slate-600">🌾 Carbs</p></div>
                <div><p className="text-4xl font-semibold text-amber-600">{currentDay?.fat || 0}g</p><p className="text-sm text-slate-600">🥑 Fat</p></div>
              </div>
            </div>

            <h3 className="mt-6 text-3xl font-semibold tracking-tight">Today's Meals</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(currentDay?.meals || []).map((meal, idx) => (
                <Card key={meal.id + idx} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${mealBadgeTone[meal.type]}`}>{meal.type}</span>
                    <span className="text-xs text-slate-500">⏱ {meal.minutes} min</span>
                  </div>
                  <h4 className="text-2xl font-semibold leading-tight tracking-tight">{meal.name}</h4>
                  <p className="mt-1 text-lg text-slate-600">Portion: {meal.portion}</p>

                  <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div><p className="font-semibold">{meal.calories}</p><p className="text-xs text-slate-500">🔥 Calories</p></div>
                      <div><p className="font-semibold text-blue-600">{meal.protein}g</p><p className="text-xs text-slate-500">💪 Protein</p></div>
                      <div><p className="font-semibold text-emerald-600">{meal.carbs}g</p><p className="text-xs text-slate-500">🌾 Carbs</p></div>
                      <div><p className="font-semibold text-amber-600">{meal.fat}g</p><p className="text-xs text-slate-500">🥑 Fat</p></div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <button className="text-sm text-slate-600 hover:text-slate-900" onClick={() => setSelectedMeal(meal)}>
                      View recipe details →
                    </button>
                    <Button variant="outline" size="sm" onClick={() => regenerateMeal(idx)} disabled={regeneratingMealId === meal.id}>
                      {regeneratingMealId === meal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Regenerate'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </Card>

        <Dialog open={!!selectedMeal} onOpenChange={(o) => !o && setSelectedMeal(null)}>
          <DialogContent className="max-w-2xl rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl">🍽️ {selectedMeal?.name}</DialogTitle>
              <p className="text-sm text-slate-500">{selectedMeal?.type} · {selectedMeal?.minutes} minutes</p>
            </DialogHeader>

            <div className="space-y-5 text-sm">
              <div>
                <h4 className="mb-1 text-xl font-semibold text-slate-900">Description</h4>
                <p className="text-slate-600 leading-relaxed">{getMealDescription(selectedMeal)}</p>
              </div>

              <div>
                <h4 className="mb-2 text-xl font-semibold text-slate-900">Ingredients</h4>
                <ul className="list-disc pl-5 text-slate-700">
                  {(selectedMeal?.ingredients || []).map((ing, i) => (
                    <li key={ing + i}>{ing}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="mb-2 text-xl font-semibold text-slate-900">Preparation Instructions</h4>
                <ol className="list-decimal pl-5 text-slate-700">
                  {(selectedMeal?.recipe || []).map((step, i) => (
                    <li key={step + i}>{step}</li>
                  ))}
                </ol>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h4 className="mb-3 text-xl font-semibold text-slate-900">Nutrition Information</h4>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-3xl font-semibold text-slate-900">{selectedMeal?.calories || 0}</p>
                      <p className="text-sm text-slate-600">🔥 Calories</p>
                    </div>
                    <div>
                      <p className="text-3xl font-semibold text-blue-600">{selectedMeal?.protein || 0}g</p>
                      <p className="text-sm text-slate-600">💪 Protein</p>
                    </div>
                    <div>
                      <p className="text-3xl font-semibold text-emerald-600">{selectedMeal?.carbs || 0}g</p>
                      <p className="text-sm text-slate-600">🌾 Carbs</p>
                    </div>
                    <div>
                      <p className="text-3xl font-semibold text-amber-600">{selectedMeal?.fat || 0}g</p>
                      <p className="text-sm text-slate-600">🥑 Fat</p>
                    </div>
                  </div>

                  <div className="mt-3 overflow-hidden rounded-full bg-slate-200">
                    <div className="flex h-2 w-full">
                      <div className="bg-blue-500" style={{ width: `${macroPercents.protein}%` }} />
                      <div className="bg-emerald-500" style={{ width: `${macroPercents.carbs}%` }} />
                      <div className="bg-amber-500" style={{ width: `${macroPercents.fat}%` }} />
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
                    <span>🔵 Protein {macroPercents.protein}%</span>
                    <span>🟢 Carbs {macroPercents.carbs}%</span>
                    <span>🟠 Fat {macroPercents.fat}%</span>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
