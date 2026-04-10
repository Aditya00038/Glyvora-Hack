"use client";

import { useEffect, useMemo, useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useUser } from '@/firebase';
import { addDoc, collection, doc, getDoc, getDocs } from 'firebase/firestore';
import {
  Activity,
  Calendar,
  Droplet,
  Flame,
  HeartPulse,
  List,
  Pill,
  Plus,
  Sparkles,
  Syringe,
  Utensils,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type EntryType = 'glucose' | 'food' | 'insulin' | 'meds' | 'vitals' | 'exercise';

type LogEntry = {
  id: string;
  entryType: EntryType;
  recordedAt: string;
  notes: string;
  glucoseValue?: string;
  glucoseContext?: string;
  carbs?: string;
  protein?: string;
  fat?: string;
  calories?: string;
  insulinUnits?: string;
  insulinType?: string;
  medicationName?: string;
  medicationDosage?: string;
  weight?: string;
  a1c?: string;
  systolic?: string;
  diastolic?: string;
  exerciseType?: string;
  durationMinutes?: string;
};

type EntryFormState = {
  recordedAt: string;
  notes: string;
  glucoseValue: string;
  glucoseContext: string;
  carbs: string;
  protein: string;
  fat: string;
  calories: string;
  insulinUnits: string;
  insulinType: string;
  medicationName: string;
  medicationDosage: string;
  weight: string;
  a1c: string;
  systolic: string;
  diastolic: string;
  exerciseType: string;
  durationMinutes: string;
};

const periodOptions = [7, 30, 90];

const tabItems: Array<{ key: EntryType; label: string; icon: typeof Droplet }> = [
  { key: 'glucose', label: 'Glucose', icon: Droplet },
  { key: 'food', label: 'Food', icon: Utensils },
  { key: 'insulin', label: 'Insulin', icon: Syringe },
  { key: 'meds', label: 'Meds', icon: Pill },
  { key: 'vitals', label: 'Vitals', icon: HeartPulse },
  { key: 'exercise', label: 'Exercise', icon: Activity },
];

function getLocalDateTimeValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function dateKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function getStreak(entries: LogEntry[]) {
  if (!entries.length) return 0;
  const keys = new Set(entries.map((entry) => dateKey(entry.recordedAt)));
  let streak = 0;
  const cursor = new Date();

  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!keys.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

const initialFormState: EntryFormState = {
  recordedAt: getLocalDateTimeValue(new Date()),
  notes: '',
  glucoseValue: '',
  glucoseContext: 'Fasting',
  carbs: '',
  protein: '',
  fat: '',
  calories: '',
  insulinUnits: '',
  insulinType: 'Rapid-acting',
  medicationName: '',
  medicationDosage: '',
  weight: '',
  a1c: '',
  systolic: '',
  diastolic: '',
  exerciseType: '',
  durationMinutes: '',
};

export default function LogbookPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<EntryType>('glucose');
  const [periodDays, setPeriodDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EntryFormState>(initialFormState);

  const loadEntries = async () => {
    if (!user) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const snapshot = await getDocs(collection(firestore, 'users', user.uid, 'logbookEntries'));
    const data = snapshot.docs.map((docItem) => ({ id: docItem.id, ...(docItem.data() as Omit<LogEntry, 'id'>) }));
    data.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
    setEntries(data);
    setLoading(false);
  };

  useEffect(() => {
    loadEntries();
  }, [user]);

  const filteredEntries = useMemo(() => {
    const now = new Date();
    const fromDate = new Date();
    fromDate.setDate(now.getDate() - periodDays);
    return entries.filter((entry) => new Date(entry.recordedAt) >= fromDate);
  }, [entries, periodDays]);

  const glucoseEntries = filteredEntries.filter((entry) => entry.entryType === 'glucose' && entry.glucoseValue);
  const avgGlucose = glucoseEntries.length
    ? Math.round(glucoseEntries.reduce((sum, item) => sum + Number(item.glucoseValue || 0), 0) / glucoseEntries.length)
    : 0;

  const streak = getStreak(entries);
  const exerciseCount = filteredEntries.filter((entry) => entry.entryType === 'exercise').length;
  const medicationCount = filteredEntries.filter((entry) => entry.entryType === 'meds').length;

  const summaryTips = useMemo(() => {
    const tips: string[] = [];

    if (streak >= 5) {
      tips.push(`Excellent streak of ${streak} days. Keep logging at the same time each day.`);
    } else if (streak > 0) {
      tips.push(`You're on a ${streak}-day streak. One entry today keeps momentum strong.`);
    } else {
      tips.push('Start a fresh streak today with one glucose or food entry.');
    }

    if (glucoseEntries.length > 0) {
      if (avgGlucose > 140) {
        tips.push('Average glucose is above target. Consider more post-meal walks and lower-carb swaps.');
      } else {
        tips.push('Average glucose looks stable in your selected period. Great consistency.');
      }
    } else {
      tips.push('No glucose entries found for this period. Add readings to unlock sharper insights.');
    }

    if (exerciseCount === 0) {
      tips.push('Add at least one short exercise entry this week to correlate activity with glucose trends.');
    }

    return tips;
  }, [streak, glucoseEntries.length, avgGlucose, exerciseCount]);

  const resetForm = () => {
    setForm({ ...initialFormState, recordedAt: getLocalDateTimeValue(new Date()) });
  };

  const updateForm = (field: keyof EntryFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const buildPayload = (): Omit<LogEntry, 'id'> => {
    const base: Omit<LogEntry, 'id'> = {
      entryType: activeTab,
      recordedAt: form.recordedAt || getLocalDateTimeValue(new Date()),
      notes: form.notes,
    };

    if (activeTab === 'glucose') {
      return { ...base, glucoseValue: form.glucoseValue, glucoseContext: form.glucoseContext };
    }
    if (activeTab === 'food') {
      return { ...base, carbs: form.carbs, protein: form.protein, fat: form.fat, calories: form.calories };
    }
    if (activeTab === 'insulin') {
      return { ...base, insulinUnits: form.insulinUnits, insulinType: form.insulinType };
    }
    if (activeTab === 'meds') {
      return { ...base, medicationName: form.medicationName, medicationDosage: form.medicationDosage };
    }
    if (activeTab === 'vitals') {
      return {
        ...base,
        weight: form.weight,
        a1c: form.a1c,
        systolic: form.systolic,
        diastolic: form.diastolic,
      };
    }

    return { ...base, exerciseType: form.exerciseType, durationMinutes: form.durationMinutes };
  };

  const handleCreate = async () => {
    if (!user) {
      toast({ title: 'Not authenticated', description: 'Please log in to add entries.' });
      return;
    }

    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not initialized.' });
      return;
    }

    if (activeTab === 'glucose' && !form.glucoseValue) {
      toast({ title: 'Glucose value required', description: 'Please enter a glucose value before creating.' });
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      const docRef = await addDoc(collection(firestore, 'users', user.uid, 'logbookEntries'), {
        ...payload,
        createdAt: new Date().toISOString(),
      });

      if (activeTab === 'glucose') {
        try {
          const profileSnap = await getDoc(doc(firestore, 'users', user.uid));
          const profile = profileSnap.exists() ? (profileSnap.data() as any) : {};
          const phoneNumber = String(profile.phoneNumber || '').trim();
          const smsEnabled = profile.smsEnabled !== false;
          const lowThreshold = Number(profile.glucoseLowThreshold ?? 70);
          const highThreshold = Number(profile.glucoseHighThreshold ?? 140);
          const glucoseReadingMgDl = Number(form.glucoseValue) * 18;

          if (phoneNumber && smsEnabled && Number.isFinite(glucoseReadingMgDl)) {
            if (glucoseReadingMgDl <= lowThreshold || glucoseReadingMgDl >= highThreshold) {
              const alertType = glucoseReadingMgDl <= lowThreshold ? 'LOW' : 'HIGH';
              const message = `GLYVORA alert: Your glucose reading is ${Math.round(glucoseReadingMgDl)} mg/dL, which is ${alertType.toLowerCase()} (${glucoseReadingMgDl <= lowThreshold ? `<= ${lowThreshold}` : `>= ${highThreshold}`} mg/dL). Please take care and monitor your levels.`;

              await fetch('/api/notifications/welcome', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: phoneNumber,
                  name: profile.displayName || profile.firstName || user.displayName || 'there',
                  message,
                }),
              });
            }
          }
        } catch (smsError) {
          console.error('Failed to send glucose alert SMS:', smsError);
        }
      }

      console.log('Entry created successfully:', docRef.id);
      toast({ title: 'Entry added', description: 'Your logbook entry has been saved.' });
      await loadEntries();
      setOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error adding entry:', error);
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to save entry. Please try again.' 
      });
    } finally {
      setSaving(false);
    }
  };

  const renderTabFields = () => {
    if (activeTab === 'glucose') {
      return (
        <>
          <div className="space-y-2">
            <Label>Glucose (mmol/L)</Label>
            <Input value={form.glucoseValue} onChange={(e) => updateForm('glucoseValue', e.target.value)} placeholder="e.g., 6.7" />
          </div>
          <div className="space-y-2">
            <Label>Reading Context</Label>
            <div className="flex flex-wrap gap-2">
              {['Fasting', 'Before Meal', 'Post Meal', 'Random'].map((context) => (
                <button
                  key={context}
                  type="button"
                  onClick={() => updateForm('glucoseContext', context)}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    form.glucoseContext === context
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  {context}
                </button>
              ))}
            </div>
          </div>
        </>
      );
    }

    if (activeTab === 'food') {
      return (
        <>
          <div className="space-y-2">
            <Label>Carbohydrates (grams)</Label>
            <Input value={form.carbs} onChange={(e) => updateForm('carbs', e.target.value)} placeholder="e.g., 45" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Protein (g)</Label>
              <Input value={form.protein} onChange={(e) => updateForm('protein', e.target.value)} placeholder="e.g., 25" />
            </div>
            <div className="space-y-2">
              <Label>Fat (g)</Label>
              <Input value={form.fat} onChange={(e) => updateForm('fat', e.target.value)} placeholder="e.g., 15" />
            </div>
            <div className="space-y-2">
              <Label>Calories</Label>
              <Input value={form.calories} onChange={(e) => updateForm('calories', e.target.value)} placeholder="e.g., 400" />
            </div>
          </div>
        </>
      );
    }

    if (activeTab === 'insulin') {
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Units</Label>
            <Input value={form.insulinUnits} onChange={(e) => updateForm('insulinUnits', e.target.value)} placeholder="e.g., 10" />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={form.insulinType} onValueChange={(value) => updateForm('insulinType', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Rapid-acting">Rapid-acting</SelectItem>
                <SelectItem value="Short-acting">Short-acting</SelectItem>
                <SelectItem value="Intermediate">Intermediate</SelectItem>
                <SelectItem value="Long-acting">Long-acting</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    if (activeTab === 'meds') {
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Medication Name</Label>
            <Input value={form.medicationName} onChange={(e) => updateForm('medicationName', e.target.value)} placeholder="e.g., Metformin" />
          </div>
          <div className="space-y-2">
            <Label>Dosage</Label>
            <Input value={form.medicationDosage} onChange={(e) => updateForm('medicationDosage', e.target.value)} placeholder="e.g., 500mg" />
          </div>
        </div>
      );
    }

    if (activeTab === 'vitals') {
      return (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Weight (lbs)</Label>
              <Input value={form.weight} onChange={(e) => updateForm('weight', e.target.value)} placeholder="e.g., 165" />
            </div>
            <div className="space-y-2">
              <Label>A1C (%)</Label>
              <Input value={form.a1c} onChange={(e) => updateForm('a1c', e.target.value)} placeholder="e.g., 6.5" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Systolic BP</Label>
              <Input value={form.systolic} onChange={(e) => updateForm('systolic', e.target.value)} placeholder="e.g., 120" />
            </div>
            <div className="space-y-2">
              <Label>Diastolic BP</Label>
              <Input value={form.diastolic} onChange={(e) => updateForm('diastolic', e.target.value)} placeholder="e.g., 80" />
            </div>
          </div>
        </>
      );
    }

    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Exercise Type</Label>
          <Input value={form.exerciseType} onChange={(e) => updateForm('exerciseType', e.target.value)} placeholder="e.g., Walking, Running" />
        </div>
        <div className="space-y-2">
          <Label>Duration (minutes)</Label>
          <Input value={form.durationMinutes} onChange={(e) => updateForm('durationMinutes', e.target.value)} placeholder="e.g., 30" />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F5F3F0] text-slate-900 pb-10 lg:ml-48 xl:ml-52">
      <Navigation />
      <main className="mx-auto max-w-6xl px-4 pt-4 lg:pt-6">
        <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-slate-700">
                <Activity className="h-4 w-4 text-emerald-600" />
                <h1 className="text-[2.2rem] font-semibold leading-none tracking-tight">Health Log</h1>
              </div>
              <p className="mt-2 text-sm text-slate-500">Comprehensive analytics and trends for your diabetes management.</p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="rounded-xl">
                <List className="h-4 w-4" />
              </Button>
              <Button onClick={() => setOpen(true)} className="rounded-xl bg-emerald-500 text-white hover:bg-emerald-600">
                <Plus className="mr-2 h-4 w-4" />
                Add Entry
              </Button>
            </div>
          </div>

          <Card className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-none">
            <h2 className="text-3xl font-semibold tracking-tight">Time Period</h2>
            <p className="mt-1 text-sm text-slate-500">Select the time range for your analytics.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {periodOptions.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setPeriodDays(days)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium ${
                    periodDays === days
                      ? 'border-emerald-300 bg-emerald-500 text-white'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <Calendar className="h-4 w-4" />
                  Last {days} Days
                </button>
              ))}
            </div>
          </Card>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-none">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">Logging Streak</h3>
                <Flame className="h-4 w-4 text-orange-500" />
              </div>
              <p className="mt-4 text-4xl font-semibold tracking-tight">{streak} days</p>
              <p className="text-sm text-slate-500">{filteredEntries.length} active logs in this period</p>
            </Card>

            <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-none">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">Glucose Readings</h3>
                <Droplet className="h-4 w-4 text-blue-500" />
              </div>
              <p className="mt-4 text-4xl font-semibold tracking-tight">{glucoseEntries.length}</p>
              <p className="text-sm text-slate-500">Avg: {avgGlucose || '-'} mmol/L</p>
            </Card>

            <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-none">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">Exercise Entries</h3>
                <Activity className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="mt-4 text-4xl font-semibold tracking-tight">{exerciseCount}</p>
              <p className="text-sm text-slate-500">Movement logs in this period</p>
            </Card>

            <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-none">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">Medications</h3>
                <Pill className="h-4 w-4 text-pink-500" />
              </div>
              <p className="mt-4 text-4xl font-semibold tracking-tight">{medicationCount}</p>
              <p className="text-sm text-slate-500">Medication logs in this period</p>
            </Card>
          </div>

          {/* Glucose Trends Section */}
          <Card className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-none">
            <h2 className="text-lg font-semibold mb-2">Glucose Trends</h2>
            <p className="text-sm text-slate-500 mb-4">Track your glucose levels (mmol/L) with context-aware target zones</p>
            
            {/* Legend */}
            <div className="mb-6 flex gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-xs text-slate-600">Fasting Normal (3.9-5.6)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-xs text-slate-600">Low (&lt;3.9)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500" />
                <span className="text-xs text-slate-600">High (&gt;7.0)</span>
              </div>
            </div>

            {/* Advanced Glucose Chart */}
            <div className="rounded-lg border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-6 overflow-x-auto">
              <svg width="100%" height="300" viewBox="0 0 800 300" className="min-w-full">
                {/* Grid lines and target zones */}
                <defs>
                  <linearGradient id="normalZone" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="50%" stopColor="#0891b2" />
                    <stop offset="100%" stopColor="#0e7490" />
                  </linearGradient>
                </defs>

                {/* Y-axis labels background (target zone) */}
                <rect x="40" y="50" width="720" height="140" fill="url(#normalZone)" />

                {/* Horizontal grid lines */}
                <line x1="40" y1="60" x2="760" y2="60" stroke="#e2e8f0" strokeWidth="1" />
                <line x1="40" y1="120" x2="760" y2="120" stroke="#e2e8f0" strokeWidth="1" />
                <line x1="40" y1="180" x2="760" y2="180" stroke="#e2e8f0" strokeWidth="1" />
                <line x1="40" y1="240" x2="760" y2="240" stroke="#e2e8f0" strokeWidth="1" />

                {/* Y-axis labels */}
                <text x="15" y="65" fontSize="11" fill="#64748b" textAnchor="end">10</text>
                <text x="15" y="125" fontSize="11" fill="#64748b" textAnchor="end">7.5</text>
                <text x="15" y="185" fontSize="11" fill="#64748b" textAnchor="end">5</text>
                <text x="15" y="245" fontSize="11" fill="#64748b" textAnchor="end">2.5</text>

                {/* Y-axis line */}
                <line x1="40" y1="50" x2="40" y2="250" stroke="#cbd5e1" strokeWidth="2" />

                {/* Normal range indicator line */}
                <line x1="35" y1="100" x2="50" y2="100" stroke="#10b981" strokeWidth="2" />
                <line x1="35" y1="140" x2="50" y2="140" stroke="#10b981" strokeWidth="2" />

                {/* Generate line chart path */}
                {glucoseEntries.slice(-14).length > 0 && (() => {
                  const data = glucoseEntries.slice(-14);
                  const maxValue = 10;
                  const minValue = 2;
                  const range = maxValue - minValue;
                  const chartWidth = 720;
                  const chartHeight = 200;
                  const pointSpacing = chartWidth / (data.length - 1 || 1);

                  let pathData = `M ${40} ${250 - ((data[0] ? Number(data[0].glucoseValue || 0) - minValue : 0) / range) * chartHeight}`;
                  for (let i = 1; i < data.length; i++) {
                    const x = 40 + i * pointSpacing;
                    const value = Number(data[i].glucoseValue || 0);
                    const y = 250 - ((value - minValue) / range) * chartHeight;
                    pathData += ` L ${x} ${y}`;
                  }

                  return (
                    <>
                      {/* Area under curve */}
                      <path
                        d={`${pathData} L 760 250 L 40 250 Z`}
                        fill="url(#lineGradient)"
                        opacity="0.15"
                      />
                      {/* Line */}
                      <path
                        d={pathData}
                        stroke="url(#lineGradient)"
                        strokeWidth="3"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* Data points */}
                      {data.map((entry, idx) => {
                        const value = Number(entry.glucoseValue || 0);
                        const x = 40 + idx * pointSpacing;
                        const y = 250 - ((value - minValue) / range) * chartHeight;
                        const isNormal = value >= 3.9 && value <= 5.6;
                        const isLow = value < 3.9;
                        const color = isLow ? '#f97316' : isNormal ? '#10b981' : '#e11d48';

                        return (
                          <circle
                            key={idx}
                            cx={x}
                            cy={y}
                            r="5"
                            fill={color}
                            stroke="white"
                            strokeWidth="2"
                            style={{ cursor: 'pointer' }}
                          />
                        );
                      })}
                    </>
                  );
                })()}

                {/* X-axis line */}
                <line x1="40" y1="250" x2="760" y2="250" stroke="#cbd5e1" strokeWidth="2" />

                {/* X-axis labels */}
                <text x="40" y="270" fontSize="11" fill="#64748b" textAnchor="middle">14d ago</text>
                <text x="400" y="270" fontSize="11" fill="#64748b" textAnchor="middle">1 week ago</text>
                <text x="760" y="270" fontSize="11" fill="#64748b" textAnchor="middle">Today</text>
              </svg>
              
              <div className="mt-4 text-xs text-slate-500">
                <p className="text-center">Last 14 glucose readings • Target range: 3.9-5.6 mmol/L (green zone)</p>
              </div>
            </div>
          </Card>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1.1fr_1fr]">
            <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-none">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                <h3 className="text-lg font-semibold">Summary & Tips</h3>
              </div>
              <div className="mt-3 space-y-2">
                {summaryTips.map((tip, idx) => (
                  <p key={idx} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {tip}
                  </p>
                ))}
              </div>
            </Card>

            <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-none">
              <h3 className="text-lg font-semibold">Recent Entries</h3>
              <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
                {loading && <p className="text-sm text-slate-500">Loading entries...</p>}
                {!loading && filteredEntries.length === 0 && <p className="text-sm text-slate-500">No entries yet. Click Add Entry to begin.</p>}
                {!loading && filteredEntries.slice(0, 12).map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-slate-200 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium capitalize text-slate-900">{entry.entryType}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(entry.recordedAt)}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      {entry.entryType === 'glucose' && `${entry.glucoseValue || '-'} mmol/L (${entry.glucoseContext || 'Context N/A'})`}
                      {entry.entryType === 'food' && `${entry.carbs || '-'}g carbs, ${entry.calories || '-'} kcal`}
                      {entry.entryType === 'insulin' && `${entry.insulinUnits || '-'} units (${entry.insulinType || '-'})`}
                      {entry.entryType === 'meds' && `${entry.medicationName || '-'} ${entry.medicationDosage || ''}`}
                      {entry.entryType === 'vitals' && `Weight ${entry.weight || '-'} lbs, BP ${entry.systolic || '-'}/${entry.diastolic || '-'}`}
                      {entry.entryType === 'exercise' && `${entry.exerciseType || '-'} for ${entry.durationMinutes || '-'} min`}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 p-6 sm:max-w-[620px]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold tracking-tight">Add Diabetes Log Entry</DialogTitle>
              <DialogDescription>Record a new entry. Use the tabs to log different types of data.</DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
              {tabItems.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${
                      activeTab === tab.key
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="space-y-4">
              {renderTabFields()}

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} placeholder="Any additional notes..." className="min-h-[90px]" />
              </div>

              <div className="space-y-2">
                <Label>Date & Time</Label>
                <Input type="datetime-local" value={form.recordedAt} onChange={(e) => updateForm('recordedAt', e.target.value)} />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={saving} className="bg-emerald-500 text-white hover:bg-emerald-600">
                  {saving ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
