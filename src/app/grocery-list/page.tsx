"use client";

import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { CalendarDays, Loader2, Printer, RefreshCw, ShoppingBasket } from 'lucide-react';

import { useAuth, useFirestore } from '@/firebase';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { buildGroceryListFromMealPlan } from '@/actions/grocery-list';

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

type GroceryItem = {
  item: string;
  quantity: string;
};

type GrocerySection = {
  category: string;
  items: GroceryItem[];
};

type GroceryPlan = MealPlan & {
  groceryList?: GrocerySection[];
};

type GroceryCategory = string;

type GroceryEntry = {
  item: string;
  quantity: string;
  category: GroceryCategory;
  days: string[];
  count: number;
};

type FilterMode = 'all' | 'single' | 'custom';

const STORAGE_KEY = 'glyvora_latest_meal_plan';
const CHECKED_KEY_PREFIX = 'glyvora_grocery_checked';

function getCheckedStorageKey(plan: GroceryPlan | null) {
  return `${CHECKED_KEY_PREFIX}:${plan?.title || 'default'}`;
}

function getPlanFromStorage(): GroceryPlan | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as GroceryPlan;
  } catch {
    return null;
  }
}

function buildPlanSignature(plan: GroceryPlan | null): string {
  if (!plan?.days?.length) return 'default';
  return [plan.title || 'meal-plan', ...plan.days.map((day) => day.dayName)].join('|');
}

function flattenSectionsToEntries(sections: GrocerySection[], activeDays: string[]): GroceryEntry[] {
  const entries: GroceryEntry[] = [];

  for (const section of sections) {
    for (const item of section.items) {
      entries.push({
        item: item.item,
        quantity: item.quantity,
        category: section.category,
        days: activeDays,
        count: 1,
      });
    }
  }

  return entries.sort((left, right) => left.item.localeCompare(right.item));
}

export default function GroceryListPage() {
  const auth = useAuth();
  const firestore = useFirestore();

  const [plan, setPlan] = useState<GroceryPlan | null>(null);
  const [grocerySections, setGrocerySections] = useState<GrocerySection[]>([]);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
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
      const user = auth.currentUser;

      if (user?.uid) {
        const savedSnap = await getDoc(doc(firestore, 'users', user.uid, 'mealPlans', 'current'));
        if (savedSnap.exists()) {
          const savedPlan = savedSnap.data() as GroceryPlan;
          if (savedPlan?.days?.length) {
            setPlan(savedPlan);
            return;
          }
        }
      }

      const storedPlan = getPlanFromStorage();
      if (storedPlan?.days?.length) {
        setPlan(storedPlan);
        return;
      }

      const profile = await getProfileForGeneration();
      const userId = auth.currentUser?.uid;
      const res = await fetch('/api/meal-plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'full', profile, userId }),
      });

      const data = (await res.json()) as GroceryPlan;
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

  useEffect(() => {
    if (!plan?.days?.length) return;

    const selectedDays = (() => {
      if (filterMode === 'single') return [plan.days[singleDayIndex]].filter(Boolean) as DayPlan[];
      if (filterMode === 'custom') {
        return customDayIndexes.map((index) => plan.days[index]).filter(Boolean) as DayPlan[];
      }
      return plan.days;
    })();

    const activePlan: GroceryPlan = {
      ...plan,
      days: selectedDays,
    };

    buildGroceryListFromMealPlan(activePlan)
      .then((result) => {
        setGrocerySections(result.sections);
      })
      .catch((error) => {
        console.warn('Failed to build grocery list from meal plan:', error);
        setGrocerySections([]);
      });

    if (typeof window !== 'undefined') {
      const storageKey = `${CHECKED_KEY_PREFIX}:${buildPlanSignature(activePlan)}`;
      const raw = window.localStorage.getItem(storageKey);
      setCheckedItems(raw ? JSON.parse(raw) as Record<string, boolean> : {});
    }
  }, [customDayIndexes, filterMode, plan, singleDayIndex]);

  useEffect(() => {
    if (!plan?.days?.length || typeof window === 'undefined') return;
    const activePlanSignature = buildPlanSignature({ ...plan, days: filterMode === 'single'
      ? [plan.days[singleDayIndex]].filter(Boolean) as DayPlan[]
      : filterMode === 'custom'
        ? customDayIndexes.map((index) => plan.days[index]).filter(Boolean) as DayPlan[]
        : plan.days });
    window.localStorage.setItem(`${CHECKED_KEY_PREFIX}:${activePlanSignature}`, JSON.stringify(checkedItems));
  }, [checkedItems, customDayIndexes, filterMode, plan, singleDayIndex]);

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

  const groceryEntries = useMemo(() => flattenSectionsToEntries(grocerySections, activeDays.map((day) => day.dayName)), [activeDays, grocerySections]);

  const groupedEntries = useMemo(() => {
    const groups: Record<string, GroceryEntry[]> = {};

    for (const entry of groceryEntries) {
      if (!groups[entry.category]) {
        groups[entry.category] = [];
      }
      groups[entry.category].push(entry);
    }

    return groups;
  }, [groceryEntries]);

  const toggleChecked = (itemKey: string) => {
    setCheckedItems((prev) => {
      const next = { ...prev, [itemKey]: !prev[itemKey] };
      if (typeof window !== 'undefined') {
        const storageKey = `${CHECKED_KEY_PREFIX}:${buildPlanSignature(plan ? { ...plan, days: activeDays } : null)}`;
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      }
      return next;
    });
  };

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
            {Object.entries(groupedEntries).map(([category, sectionItems]) => {
              if (!sectionItems.length) return null;

              return (
                <Card key={category} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">{category}</h3>
                    <Badge variant="outline">{sectionItems.length}</Badge>
                  </div>

                  <div className="space-y-2">
                    {sectionItems.map((entry) => (
                      <div key={`${entry.category}-${entry.item}`} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                        <Checkbox
                          checked={!!checkedItems[`${entry.category}-${entry.item}`]}
                          onCheckedChange={() => toggleChecked(`${entry.category}-${entry.item}`)}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-semibold text-slate-900 ${checkedItems[`${entry.category}-${entry.item}`] ? 'line-through opacity-60' : ''}`}>
                            {entry.item}
                          </p>
                          <p className="text-xs text-slate-600">Qty: {entry.quantity}</p>
                          <p className="text-[11px] text-slate-500">Used in: {entry.days.join(', ')}</p>
                        </div>
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
