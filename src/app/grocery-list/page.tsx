"use client";

import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { CalendarDays, Loader2, Printer, RefreshCw, ShoppingBasket } from 'lucide-react';

import { useAuth, useFirestore } from '@/firebase';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Meal = {
  id: string;
  type: 'Breakfast' | 'Lunch' | 'Snack' | 'Dinner';
  name: string;
  ingredients: string[];
};

type DayPlan = {
  dayName: string;
  meals: Meal[];
};

type MealPlan = {
  title: string;
  days: DayPlan[];
};

type GroceryCategory = 'Produce' | 'Protein' | 'Dairy' | 'Pantry' | 'Spices' | 'Other';

type GroceryEntry = {
  item: string;
  quantity: string;
  category: GroceryCategory;
  days: string[];
  count: number;
};

const STORAGE_KEY = 'glyvora_latest_meal_plan';

type FilterMode = 'all' | 'single' | 'custom';

function categoryForItem(name: string): GroceryCategory {
  const value = name.toLowerCase();

  if (/spinach|broccoli|capsicum|pepper|tomato|onion|carrot|lettuce|cucumber|beans|cauliflower|potato|avocado|fruit|apple|banana|mango/.test(value)) {
    return 'Produce';
  }

  if (/paneer|tofu|chicken|fish|egg|eggs|dal|lentil|beans|chana|tuna|meat|turkey/.test(value)) {
    return 'Protein';
  }

  if (/milk|curd|yogurt|cheese|butter|ghee|skyr/.test(value)) {
    return 'Dairy';
  }

  if (/rice|quinoa|oats|bread|roti|flour|oil|olive|seed|almond|walnut|peanut|chickpea|pasta|noodle/.test(value)) {
    return 'Pantry';
  }

  if (/salt|pepper|masala|turmeric|cumin|mustard|garlic|ginger|chili|spice/.test(value)) {
    return 'Spices';
  }

  return 'Other';
}

function parseIngredient(raw: string): { item: string; qty: string } {
  const text = raw.trim();
  const quantityMatch = text.match(/^(.*?)(\d+(?:\.\d+)?\s*(?:kg|g|mg|ml|l|cup|cups|tsp|tbsp|slice|slices|piece|pieces)?)$/i);

  if (quantityMatch) {
    return {
      item: quantityMatch[1].trim().replace(/[,-]$/, ''),
      qty: quantityMatch[2].trim(),
    };
  }

  return { item: text, qty: '1 item' };
}

function mergeQuantities(values: string[]): string {
  const normalized = values.map((v) => v.trim()).filter(Boolean);
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

function buildGroceryEntries(days: DayPlan[]): GroceryEntry[] {
  const map = new Map<string, { item: string; qty: string[]; category: GroceryCategory; daySet: Set<string>; count: number }>();

  for (const day of days) {
    for (const meal of day.meals) {
      for (const ingredient of meal.ingredients || []) {
        const parsed = parseIngredient(ingredient);
        const key = parsed.item.toLowerCase();
        const category = categoryForItem(parsed.item);
        const existing = map.get(key);

        if (existing) {
          existing.qty.push(parsed.qty);
          existing.daySet.add(day.dayName);
          existing.count += 1;
        } else {
          map.set(key, {
            item: parsed.item,
            qty: [parsed.qty],
            category,
            daySet: new Set([day.dayName]),
            count: 1,
          });
        }
      }
    }
  }

  return Array.from(map.values())
    .map((entry) => ({
      item: entry.item,
      quantity: mergeQuantities(entry.qty),
      category: entry.category,
      days: Array.from(entry.daySet),
      count: entry.count,
    }))
    .sort((a, b) => a.item.localeCompare(b.item));
}

export default function GroceryListPage() {
  const auth = useAuth();
  const firestore = useFirestore();

  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [singleDayIndex, setSingleDayIndex] = useState(0);
  const [customDayIndexes, setCustomDayIndexes] = useState<number[]>([0, 1]);

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

  const loadPlan = async () => {
    setLoading(true);
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as MealPlan;
          if (parsed?.days?.length) {
            setPlan(parsed);
            setLoading(false);
            return;
          }
        }
      }

      const profile = await getProfileForGeneration();
      const res = await fetch('/api/meal-plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'full', profile }),
      });

      const data = (await res.json()) as MealPlan;
      setPlan(data);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlan();
  }, []);

  useEffect(() => {
    if (!plan?.days?.length) return;
    setSingleDayIndex((prev) => Math.min(prev, plan.days.length - 1));
    setCustomDayIndexes((prev) => {
      const filtered = prev.filter((index) => index < plan.days.length);
      return filtered.length ? filtered : [0, Math.min(1, plan.days.length - 1)];
    });
  }, [plan?.days?.length]);

  const activeDayIndexes = useMemo(() => {
    if (!plan?.days?.length) return [];

    if (filterMode === 'single') return [singleDayIndex];
    if (filterMode === 'custom') {
      const values = customDayIndexes.filter((idx) => idx >= 0 && idx < plan.days.length);
      return values.length ? values : [0];
    }

    return plan.days.map((_, idx) => idx);
  }, [customDayIndexes, filterMode, plan?.days, singleDayIndex]);

  const activeDays = useMemo(() => {
    if (!plan?.days?.length) return [];
    return activeDayIndexes.map((idx) => plan.days[idx]).filter(Boolean);
  }, [activeDayIndexes, plan?.days]);

  const groceryEntries = useMemo(() => buildGroceryEntries(activeDays), [activeDays]);

  const groupedEntries = useMemo(() => {
    const groups: Record<GroceryCategory, GroceryEntry[]> = {
      Produce: [],
      Protein: [],
      Dairy: [],
      Pantry: [],
      Spices: [],
      Other: [],
    };

    for (const entry of groceryEntries) {
      groups[entry.category].push(entry);
    }

    return groups;
  }, [groceryEntries]);

  const toggleCustomDay = (index: number) => {
    setCustomDayIndexes((prev) => {
      if (prev.includes(index)) {
        const next = prev.filter((item) => item !== index);
        return next.length ? next : [index];
      }

      return [...prev, index].sort((a, b) => a - b);
    });
  };

  const printList = () => {
    if (!groceryEntries.length) return;
    const popup = window.open('', '_blank');
    if (!popup) return;

    popup.document.write(`
      <html><head><title>Grocery List - GLYVORA</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; }
        h1 { margin-bottom: 6px; }
        p { color: #555; margin-top: 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f4f4f4; }
      </style></head><body>
      <h1>GLYVORA Grocery List</h1>
      <p>${activeDays.map((day) => day.dayName).join(', ')}</p>
      <table>
        <thead><tr><th>Item</th><th>Quantity</th><th>Category</th><th>Days</th></tr></thead>
        <tbody>
          ${groceryEntries.map((entry) => `<tr><td>${entry.item}</td><td>${entry.quantity}</td><td>${entry.category}</td><td>${entry.days.join(', ')}</td></tr>`).join('')}
        </tbody>
      </table>
      </body></html>
    `);

    popup.document.close();
    popup.print();
  };

  return (
    <div className="min-h-screen bg-[#F5F3F0] text-slate-900 pb-10 lg:ml-48 xl:ml-52">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 pt-4 lg:pt-6">
        <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Badge className="bg-emerald-500 text-white">Grocery List</Badge>
                <Badge variant="outline">{activeDays.length} day{activeDays.length === 1 ? '' : 's'} selected</Badge>
              </div>
              <h1 className="text-4xl font-semibold tracking-tight">Grocery List</h1>
              <p className="mt-1 text-sm text-slate-600">Based on your suggested meal plan. Filter by Monday/Tuesday, all meals, or combine any 1-2+ days.</p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" className="rounded-xl" onClick={loadPlan} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Regenerate
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={printList}>
                <Printer className="mr-2 h-4 w-4" /> Print
              </Button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant={filterMode === 'all' ? 'default' : 'outline'} className="rounded-xl" onClick={() => setFilterMode('all')}>
              <ShoppingBasket className="mr-2 h-4 w-4" /> All Meals
            </Button>
            <Button variant={filterMode === 'single' ? 'default' : 'outline'} className="rounded-xl" onClick={() => setFilterMode('single')}>
              <CalendarDays className="mr-2 h-4 w-4" /> Single Day
            </Button>
            <Button variant={filterMode === 'custom' ? 'default' : 'outline'} className="rounded-xl" onClick={() => setFilterMode('custom')}>
              Custom Combined Days
            </Button>
          </div>

          {filterMode === 'single' && plan?.days?.length ? (
            <div className="mt-4 max-w-xs">
              <Select value={String(singleDayIndex)} onValueChange={(value) => setSingleDayIndex(Number(value))}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Choose day" />
                </SelectTrigger>
                <SelectContent>
                  {plan.days.map((day, idx) => (
                    <SelectItem key={day.dayName + idx} value={String(idx)}>{day.dayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {filterMode === 'custom' && plan?.days?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {plan.days.map((day, idx) => {
                const active = customDayIndexes.includes(idx);
                return (
                  <Button
                    key={day.dayName + idx}
                    variant={active ? 'default' : 'outline'}
                    className="rounded-full"
                    onClick={() => toggleCustomDay(idx)}
                  >
                    {day.dayName}
                  </Button>
                );
              })}
            </div>
          ) : null}

          <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Showing {groceryEntries.length} unique items from: <span className="font-medium">{activeDays.map((day) => day.dayName).join(', ') || 'No days selected'}</span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(Object.keys(groupedEntries) as GroceryCategory[]).map((category) => {
              const items = groupedEntries[category];
              if (!items.length) return null;

              return (
                <Card key={category} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">{category}</h3>
                    <Badge variant="outline">{items.length}</Badge>
                  </div>

                  <div className="space-y-2">
                    {items.map((entry) => (
                      <div key={`${entry.category}-${entry.item}`} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                        <p className="text-sm font-semibold text-slate-900">{entry.item}</p>
                        <p className="text-xs text-slate-600">Qty: {entry.quantity}</p>
                        <p className="text-[11px] text-slate-500">Used in: {entry.days.join(', ')}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </Card>
      </main>
    </div>
  );
}
