"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { Navigation } from '@/components/Navigation';
import { MetabolicSimulator } from '@/components/dashboard/metabolic-simulator';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { type UserProfile, getGlucosePredictorInstance } from '@/lib/ml/glucose-predictor';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import {
  Activity,
  Barcode,
  ChevronRight,
  Clock3,
  HeartPulse,
  MessageCircle,
  TrendingUp,
  Utensils,
} from 'lucide-react';

const quickCards = [
  {
    title: 'My Menu',
    description: 'See what is on the menu.',
    icon: Utensils,
    accent: 'bg-orange-100 text-orange-500',
    href: '/my-menu',
  },
  {
    title: 'Glucose Insights',
    description: 'See how your choices are affecting your health.',
    icon: TrendingUp,
    accent: 'bg-blue-100 text-blue-600',
    href: '/health-patterns',
  },
  {
    title: 'Logbook',
    description: 'Log your vitals, food, and meds in seconds.',
    icon: Activity,
    accent: 'bg-rose-100 text-rose-500',
    href: '/logbook',
  },
];

// Mock user profile - In production, fetch from user onboarding data
const DEFAULT_USER_PROFILE: UserProfile = {
  baselineGlucose: 95,
  diabetesType: 'PreDiabetic',
  activityLevel: 'ModeratelyActive',
  sensitivity: 1.0,
};

type LogbookEntry = {
  id: string;
  entryType: 'glucose' | 'food' | 'insulin' | 'meds' | 'vitals' | 'exercise';
  recordedAt: string;
  glucoseValue?: string;
};

type DashboardMetrics = {
  glucoseStability: number;
  stabilityDelta: number | null;
  mealsLogged3d: number;
  coachContextPoints7d: number;
  nextCheckInLabel: string;
  nextCheckInHint: string;
};

const DEFAULT_METRICS: DashboardMetrics = {
  glucoseStability: 0,
  stabilityDelta: null,
  mealsLogged3d: 0,
  coachContextPoints7d: 0,
  nextCheckInLabel: 'Not Set',
  nextCheckInHint: 'Configure alerts in Notifications',
};

function toMgDl(value?: string): number | null {
  const parsed = Number.parseFloat(value || '');
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed <= 25 ? parsed * 18 : parsed;
}

function inRangePercent(values: number[]): number {
  if (!values.length) return 0;
  const inRange = values.filter((v) => v >= 72 && v <= 126).length;
  return Math.round((inRange / values.length) * 100);
}

function computeDashboardMetrics(entries: LogbookEntry[], userData: Record<string, any>): DashboardMetrics {
  const now = new Date();
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(now.getDate() - 3);

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(now.getDate() - 14);

  const mealsLogged3d = entries.filter((entry) => {
    return entry.entryType === 'food' && new Date(entry.recordedAt) >= threeDaysAgo;
  }).length;

  const recentGlucose = entries.filter((entry) => {
    return entry.entryType === 'glucose' && new Date(entry.recordedAt) >= sevenDaysAgo;
  });
  const previousGlucose = entries.filter((entry) => {
    const at = new Date(entry.recordedAt);
    return entry.entryType === 'glucose' && at >= fourteenDaysAgo && at < sevenDaysAgo;
  });

  const recentValues = recentGlucose.map((entry) => toMgDl(entry.glucoseValue)).filter((v): v is number => v !== null);
  const previousValues = previousGlucose.map((entry) => toMgDl(entry.glucoseValue)).filter((v): v is number => v !== null);

  const glucoseStability = inRangePercent(recentValues);
  const previousStability = inRangePercent(previousValues);
  const stabilityDelta = previousValues.length ? glucoseStability - previousStability : null;

  const coachContextPoints7d = entries.filter((entry) => {
    return new Date(entry.recordedAt) >= sevenDaysAgo;
  }).length;

  const smsEnabled = Boolean(userData.smsEnabled);
  const low = Number(userData.glucoseLowThreshold || 70);
  const high = Number(userData.glucoseHighThreshold || 140);

  return {
    glucoseStability,
    stabilityDelta,
    mealsLogged3d,
    coachContextPoints7d,
    nextCheckInLabel: smsEnabled ? 'Alerts On' : 'Alerts Off',
    nextCheckInHint: smsEnabled
      ? `Thresholds ${low}-${high} mg/dL`
      : 'Enable SMS alerts in Notifications',
  };
}

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [userData, setUserData] = useState<Record<string, any>>({});
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [learningStats, setLearningStats] = useState<{ totalDataPoints: number; uniqueFoods: number; averageConfidence: string } | null>(null);

  // Poll learning stats once predictor is ready (set by MetabolicSimulator)
  useEffect(() => {
    const timer = setTimeout(() => {
      const predictor = getGlucosePredictorInstance();
      if (predictor) {
        setLearningStats(predictor.getLearningStats());
      }
    }, 3000); // delay to let MetabolicSimulator init
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [isUserLoading, router, user]);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user || !firestore) {
        setMetricsLoading(false);
        return;
      }

      try {
        const [userSnap, logsSnap] = await Promise.all([
          getDoc(doc(firestore, 'users', user.uid)),
          getDocs(collection(firestore, 'users', user.uid, 'logbookEntries')),
        ]);

        const logs = logsSnap.docs.map((docItem) => ({
          id: docItem.id,
          ...(docItem.data() as Omit<LogbookEntry, 'id'>),
        }));
        logs.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());

        setEntries(logs);
        setUserData(userSnap.exists() ? userSnap.data() : {});
      } catch (error) {
        console.error('Failed to load dashboard metrics:', error);
        setEntries([]);
        setUserData({});
      } finally {
        setMetricsLoading(false);
      }
    };

    loadDashboardData();
  }, [user, firestore]);

  const metrics = useMemo(() => computeDashboardMetrics(entries, userData), [entries, userData]);

  if (isUserLoading || !user) {
    return <div className="min-h-screen bg-[#F5F3F0]" />;
  }

  return (
    <div className="min-h-screen bg-[#F5F3F0] text-slate-900">
      <Navigation />

      <main className="px-4 py-4 lg:ml-48 xl:ml-52 lg:px-5 lg:py-3.5">
        <div className="mx-auto max-w-[1240px] space-y-5">
          <div className="flex items-center gap-3 lg:hidden">
            <div>
              <p className="text-xl font-semibold">Home</p>
              <p className="text-sm text-slate-500">Your daily metabolic summary</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">Glucose Stability</p>
                <HeartPulse className="h-4 w-4 text-rose-500" />
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{metrics.glucoseStability}%</p>
              <p className={`mt-1 text-xs ${metrics.stabilityDelta !== null && metrics.stabilityDelta >= 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                {metricsLoading
                  ? 'Loading from recent logs...'
                  : metrics.stabilityDelta === null
                    ? 'Need 2 weeks of glucose logs for trend'
                    : `${metrics.stabilityDelta >= 0 ? '+' : ''}${metrics.stabilityDelta}% vs previous 7 days`}
              </p>
            </Card>

            <Card className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">Meals Logged</p>
                <Utensils className="h-4 w-4 text-orange-500" />
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{metrics.mealsLogged3d}</p>
              <p className="mt-1 text-xs text-slate-500">In the last 3 days</p>
            </Card>

            <Card className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">Coach Context</p>
                <MessageCircle className="h-4 w-4 text-blue-500" />
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{metrics.coachContextPoints7d}</p>
              <p className="mt-1 text-xs text-slate-500">Recent log points available to AI</p>
            </Card>

            <Card className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">Next Check-in</p>
                <Clock3 className="h-4 w-4 text-violet-500" />
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{metrics.nextCheckInLabel}</p>
              <p className="mt-1 text-xs text-slate-500">{metrics.nextCheckInHint}</p>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-3 lg:items-stretch">
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex h-full min-h-[205px] flex-col rounded-2xl border-t-4 border-emerald-400 bg-white p-3.5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:min-h-[220px] lg:col-span-1">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-emerald-100">
                    <Image
                      src="/chatbot-home.png"
                      alt="Parivartan"
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  </div>
                  <div>
                    <h2 className="text-[17px] font-semibold leading-tight text-slate-900">Meet Parivartan</h2>
                    <div className="mt-1 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">24/7 Available</div>
                  </div>
                </div>
                <Activity className="h-5 w-5 text-slate-400" />
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-600">
                Your personal AI health coach for diabetes management, nutrition advice, and daily wellness support.
              </p>

              <div className="mt-auto pt-3">
                <Link href="/parivartan">
                  <Button className="h-10 w-full rounded-xl bg-emerald-500 text-xs text-white shadow-[0_12px_35px_rgba(16,185,129,0.3)] hover:bg-emerald-600">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Chat with Parivartan
                  </Button>
                </Link>
              </div>
            </motion.section>

            <Link href="/settings" className="block">
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex h-full min-h-[205px] flex-col rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] transition-transform hover:-translate-y-0.5 hover:shadow-[0_14px_35px_rgba(15,23,42,0.08)] md:min-h-[220px]">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-600">Beta</span>
              </div>
              <h3 className="mt-5 text-[15px] font-semibold leading-tight tracking-tight text-slate-900">Instant advice. Just text.</h3>
              <p className="mt-2 max-w-sm text-xs text-slate-600">Open messaging integrations, household, and alerts from one settings page.</p>
              <span className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-blue-600 hover:text-blue-700">
                Manage app <ChevronRight className="h-4 w-4" />
              </span>
            </motion.section>
            </Link>

            <Link href="/barcode" className="block">
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex h-full min-h-[205px] flex-col rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] transition-transform hover:-translate-y-0.5 hover:shadow-[0_14px_35px_rgba(15,23,42,0.08)] md:min-h-[220px]">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                <Barcode className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-[15px] font-semibold leading-tight tracking-tight text-slate-900">Barcode Scanner</h3>
              <p className="mt-2 max-w-sm text-xs text-slate-600">Open scanner page to click or upload food image, view details, save history, and generate weekly meal plan.</p>
              <span className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-violet-600 hover:text-violet-700">
                Open scanner <ChevronRight className="h-4 w-4" />
              </span>
            </motion.section>
            </Link>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {quickCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.href} href={card.href}>
                  <Card className="group min-h-[118px] rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(15,23,42,0.09)]">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.accent}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="mt-4 flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-base font-semibold text-slate-900">{card.title}</h4>
                        <p className="mt-1 text-xs text-slate-600">{card.description}</p>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1" />
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* #9 — Learning Stats Widget */}
          {learningStats && learningStats.totalDataPoints > 0 && (
            <Card className="rounded-2xl border border-violet-200 bg-violet-50 p-3.5">
              <p className="text-xs font-medium text-violet-700">🧠 System Learning</p>
              <p className="mt-1 text-sm text-violet-900">
                Personalised model has <strong>{learningStats.totalDataPoints} data points</strong> across{' '}
                <strong>{learningStats.uniqueFoods} foods</strong>. Confidence: {learningStats.averageConfidence}.
              </p>
            </Card>
          )}

          {/* Metabolic Simulator - Dedicated Full-Width Container */}
          <motion.section 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.3 }}
            className="col-span-full w-full mt-6 pb-12"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                <HeartPulse className="h-4 w-4" />
                Type 2 Diabetes Profile Active
              </div>
            </div>
            <MetabolicSimulator userProfile={DEFAULT_USER_PROFILE} />
          </motion.section>
          </div>
        </main>
    </div>
  );
}
