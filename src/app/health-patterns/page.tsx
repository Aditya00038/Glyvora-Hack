"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFirestore, useUser } from '@/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { TrendingUp, ArrowUp, Sparkles } from 'lucide-react';

type LogEntry = {
  id: string;
  entryType: string;
  recordedAt: string;
  glucoseValue?: string;
  glucoseContext?: string;
  carbs?: string;
  calories?: string;
  exerciseType?: string;
  durationMinutes?: string;
};

export default function HealthPatternsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEntries = async () => {
      if (!user || !firestore) {
        setLoading(false);
        return;
      }

      try {
        const snapshot = await getDocs(collection(firestore, 'users', user.uid, 'logbookEntries'));
        const data = snapshot.docs.map((docItem) => ({ id: docItem.id, ...(docItem.data() as Omit<LogEntry, 'id'>) }));
        data.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
        setEntries(data);
      } catch (error) {
        console.error('Error loading entries:', error);
      } finally {
        setLoading(false);
      }
    };

    loadEntries();
  }, [user, firestore]);

  // Calculate metrics from all glucose entries
  const glucoseMetrics = useMemo(() => {
    const glucoseEntries = entries.filter(
      (entry) => entry.entryType === 'glucose' && entry.glucoseValue
    );

    if (glucoseEntries.length === 0) {
      return { avg: 144, readings: 0, inRange: 0, aboveRange: 100 };
    }

    const values = glucoseEntries.map((e) => Number(e.glucoseValue || 0) * 18); // Convert mmol/L to mg/dL
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    
    // Target range: 72-126 mg/dL
    const inRange = values.filter((v) => v >= 72 && v <= 126).length;
    const aboveRange = values.filter((v) => v > 126).length;
    const inRangePercent = values.length > 0 ? Math.round((inRange / values.length) * 100) : 0;
    const aboveRangePercent = values.length > 0 ? Math.round((aboveRange / values.length) * 100) : 0;
    
    return {
      avg,
      readings: glucoseEntries.length,
      inRange: inRangePercent,
      aboveRange: aboveRangePercent,
    };
  }, [entries]);

  const handleGoToMealPlans = () => {
    router.push('/my-menu');
  };

  const handleRegenerateplan = () => {
    router.push('/my-menu');
  };

  const recommendations = [
    'View Current Plan - Review your existing 7-day meal plan',
    'Regenerate Entire Plan - Create a new meal plan optimized for your current glucose patterns',
  ];

  const tip = 'Consistent meal timing and balanced macronutrients can help reduce glucose variability. Your personalized meal plan takes these factors into account.';

  return (
    <div className="min-h-screen bg-[#F5F3F0] text-slate-900 pb-10 lg:ml-48 xl:ml-52">
      <Navigation />
      <main className="mx-auto max-w-6xl px-4 pt-4 lg:pt-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-emerald-600" />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Your Glucose Insights</h1>
            <p className="mt-1 text-sm text-slate-500">Analysis from your past 1 days</p>
          </div>
        </div>

        {/* Glucose Overview Card */}
        <Card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold mb-4">Glucose Overview</h2>
          <p className="text-sm text-slate-500 mb-4">Based on {glucoseMetrics.readings} readings</p>
          
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">Average Glucose</p>
              <p className="mt-2 text-3xl font-semibold">{glucoseMetrics.avg} <span className="text-base font-normal text-slate-500">mg/dL</span></p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-emerald-50 p-4">
              <p className="text-sm text-emerald-700">Time in Range</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-600">{glucoseMetrics.inRange}%</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-orange-50 p-4">
              <p className="text-sm text-orange-700">Above Range</p>
              <p className="mt-2 text-3xl font-semibold text-orange-600">{glucoseMetrics.aboveRange}%</p>
            </div>
          </div>
        </Card>

        {/* Recommended Actions */}
        <Card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Recommended Actions</h2>
          
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-900">View Current Plan</h3>
              <p className="mt-2 text-sm text-slate-600">Review your existing 7-day meal plan</p>
              <Button onClick={handleGoToMealPlans} className="mt-4 w-full rounded-lg bg-slate-900 text-white hover:bg-slate-800">
                Go to Meal Plans
              </Button>
            </Card>
            
            <Card className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-900">Regenerate with Glucose Focus</h3>
              <p className="mt-2 text-sm text-slate-600">Create a new meal plan optimized for your current glucose patterns</p>
              <Button onClick={handleRegenerateplan} className="mt-4 w-full rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 flex items-center justify-center gap-2">
                <ArrowUp className="h-4 w-4" />
                Regenerate Entire Plan
              </Button>
            </Card>
          </div>

          {/* Tip Section */}
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <Sparkles className="mt-1 h-5 w-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-slate-700">
              <span className="font-medium">Tip:</span> {tip}
            </p>
          </div>
        </Card>
      </main>
    </div>
  );
}
