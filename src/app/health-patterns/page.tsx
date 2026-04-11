"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFirestore, useUser } from '@/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { TrendingUp, ArrowUp, ArrowDown, Sparkles, BarChart3, Shield } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

/**
 * Glycaemic Stability Score (0–100)
 * Lower coefficient of variation = more stable. CV of 0.05 → perfect, CV of 0.40 → very unstable.
 */
function computeStabilityScore(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const stddev = Math.sqrt(values.map(v => Math.pow(v - avg, 2)).reduce((a, b) => a + b, 0) / values.length);
  const cv = stddev / avg;
  return Math.round(Math.max(0, Math.min(100, (1 - cv / 0.4) * 100)));
}

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

  const [insights, setInsights] = useState<any>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // After entries load, build meal history and call the flow
  useEffect(() => {
    if (entries.length < 3) return;
    setLoadingInsights(true);
    const mealHistory = entries
      .filter(e => e.entryType === 'food' && (e as any).foodName)
      .slice(0, 10)
      .map(e => ({
        mealName: (e as any).foodName,
        items: [(e as any).foodName],
        spike: 28, // will be improved once meal-glucose pairs are linked
        risk: 'Moderate',
      }));

    fetch('/api/metabolic-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mealHistory, userSensitivity: 'medium' }),
    })
      .then(r => r.json())
      .then(setInsights)
      .finally(() => setLoadingInsights(false));
  }, [entries]);

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
      return { avg: 0, readings: 0, inRange: 0, aboveRange: 0 };
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

  // #7 — Top spike-causing foods bar chart data
  const topSpikeData = useMemo(() => {
    const foodMap = new Map<string, number[]>();
    entries.filter(e => e.entryType === 'food' && (e as any).foodName)
      .forEach(entry => {
        // Find glucose reading 1-2 hours after this food entry
        const foodTime = new Date(entry.recordedAt).getTime();
        const postMeal = entries.find(g =>
          g.entryType === 'glucose' &&
          new Date(g.recordedAt).getTime() > foodTime &&
          new Date(g.recordedAt).getTime() < foodTime + 7200000 // 2 hrs
        );
        if (!postMeal?.glucoseValue) return;
        const foodName = (entry as any).foodName as string;
        const glucoseVal = Number(postMeal.glucoseValue) * 18;
        if (!foodMap.has(foodName)) foodMap.set(foodName, []);
        foodMap.get(foodName)!.push(glucoseVal);
      });

    return Array.from(foodMap.entries())
      .map(([name, readings]) => ({
        name,
        avgGlucose: Math.round(readings.reduce((a, b) => a + b, 0) / readings.length),
      }))
      .sort((a, b) => b.avgGlucose - a.avgGlucose)
      .slice(0, 5);
  }, [entries]);

  // #8 — Computed stability score
  const stabilityScore = useMemo(() => {
    const glucoseEntries = entries.filter(e => e.entryType === 'glucose' && e.glucoseValue);
    const values = glucoseEntries.map(e => Number(e.glucoseValue || 0) * 18);
    return computeStabilityScore(values);
  }, [entries]);

  // #10 — Weekly improvement score
  const weeklyImprovement = useMemo(() => {
    const now = Date.now();
    const week1Start = now - 14 * 86400000;
    const week2Start = now - 7 * 86400000;

    const glucoseVals = entries.filter(e => e.entryType === 'glucose' && e.glucoseValue);
    const lastWeek = glucoseVals.filter(e => new Date(e.recordedAt).getTime() >= week2Start);
    const prevWeek = glucoseVals.filter(e => {
      const t = new Date(e.recordedAt).getTime();
      return t >= week1Start && t < week2Start;
    });

    if (!lastWeek.length || !prevWeek.length) return null;
    const avg = (arr: typeof glucoseVals) => arr.reduce((s, e) => s + Number(e.glucoseValue) * 18, 0) / arr.length;
    const improvement = Math.round(((avg(prevWeek) - avg(lastWeek)) / avg(prevWeek)) * 100);
    return improvement; // positive = improved (glucose came down)
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
            <p className="mt-1 text-sm text-slate-500">Analysis from your logged history</p>
          </div>
        </div>

        {(insights || loadingInsights) && (
          <Card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-violet-500" />
              <h2 className="text-lg font-semibold">AI Metabolic Analysis</h2>
              {insights?.isSimulation && <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Simulated</span>}
            </div>
            {loadingInsights ? <p className="text-sm text-slate-500">Analyzing your patterns...</p> : (
              <>
                <p className="text-sm text-slate-700 mb-4">{insights?.overallSummary}</p>
                <div className="space-y-2">
                  {insights?.actionableAdvice?.map((tip: string, i: number) => (
                    <p key={i} className="rounded-lg bg-violet-50 border border-violet-100 px-3 py-2 text-sm text-violet-800">
                      {i + 1}. {tip}
                    </p>
                  ))}
                </div>
                {insights?.topTriggers?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-slate-800 mb-2">⚠️ Top Triggers</p>
                    {insights.topTriggers.map((t: any, i: number) => (
                      <div key={i} className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm mb-1">
                        <span className="font-medium text-red-700">{t.food}</span>
                        <span className="text-slate-600"> — {t.impact}. {t.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>
        )}

        {/* Glucose Overview Card — now includes stability + weekly improvement */}
        <Card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold mb-4">Glucose Overview</h2>
          <p className="text-sm text-slate-500 mb-4">Based on {glucoseMetrics.readings} readings</p>
          
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
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
            {/* #8 — Stability Score */}
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
              <div className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-violet-600" />
                <p className="text-sm text-violet-700">Stability Score</p>
              </div>
              <p className="mt-2 text-3xl font-semibold text-violet-600">{stabilityScore}<span className="text-base font-normal">/100</span></p>
            </div>
            {/* #10 — Weekly Improvement */}
            <div className={`rounded-xl border p-4 ${weeklyImprovement !== null && weeklyImprovement > 0 ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center gap-1.5">
                {weeklyImprovement !== null && weeklyImprovement > 0 ? <ArrowDown className="h-4 w-4 text-emerald-600" /> : <ArrowUp className="h-4 w-4 text-slate-500" />}
                <p className={`text-sm ${weeklyImprovement !== null && weeklyImprovement > 0 ? 'text-emerald-700' : 'text-slate-600'}`}>Weekly Change</p>
              </div>
              <p className={`mt-2 text-3xl font-semibold ${weeklyImprovement !== null && weeklyImprovement > 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                {weeklyImprovement !== null
                  ? weeklyImprovement > 0 ? `↓ ${weeklyImprovement}%` : `↑ ${Math.abs(weeklyImprovement)}%`
                  : '—'}
              </p>
              <p className="text-xs text-slate-500 mt-1">{weeklyImprovement !== null ? (weeklyImprovement > 0 ? 'Better than last week' : 'vs last week') : 'Need 2 weeks of data'}</p>
            </div>
          </div>
        </Card>

        {/* #7 — Top Spike-Causing Foods Bar Chart */}
        {topSpikeData.length > 0 && (
          <Card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-5 w-5 text-rose-500" />
              <h2 className="text-lg font-semibold">Top Spike-Causing Foods</h2>
            </div>
            <p className="text-sm text-slate-500 mb-4">Average post-meal glucose (mg/dL) within 2 hours of eating</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topSpikeData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: '12px' }} tick={{ fill: '#475569' }} />
                <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} tick={{ fill: '#475569' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                  formatter={(value: number) => [`${value} mg/dL`, 'Avg Post-Meal Glucose']}
                />
                <Bar dataKey="avgGlucose" radius={[8, 8, 0, 0]}>
                  {topSpikeData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.avgGlucose > 140 ? '#ef4444' : entry.avgGlucose > 110 ? '#f59e0b' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

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
