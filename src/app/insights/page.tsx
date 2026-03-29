"use client";

import { useMemo, useState, useEffect } from 'react';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { Loader2, TrendingUp, AlertTriangle, ShieldCheck, Scale } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

export default function InsightsPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const [targetGlucose, setTargetGlucose] = useState(110);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      if (user && firestore) {
        const snap = await getDoc(doc(firestore, 'users', user.uid));
        if (snap.exists()) setTargetGlucose(snap.data().targetGlucose || 110);
      }
      setProfileLoading(false);
    }
    fetchProfile();
  }, [user, firestore]);

  const mealsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users', user.uid, 'meals'), orderBy('scannedAt', 'desc'));
  }, [firestore, user?.uid]);
  
  const { data: allMeals, isLoading: mealsLoading } = useCollection(mealsQuery);

  const insights = useMemo(() => {
    if (!allMeals || allMeals.length === 0) return null;

    let dangerFoods: any[] = [];
    let safeFoods: any[] = [];
    let timeOfDaySpikes = { Breakfast: 0, Lunch: 0, Dinner: 0, Snacks: 0 };
    let timeOfDayCounts = { Breakfast: 0, Lunch: 0, Dinner: 0, Snacks: 0 };

    allMeals.forEach(meal => {
      const spike = meal.initialPredictedGlucoseSpike || 0;
      const hour = new Date(meal.scannedAt).getHours();
      let tod = 'Snacks';
      if (hour >= 5 && hour < 11) tod = 'Breakfast';
      else if (hour >= 11 && hour < 16) tod = 'Lunch';
      else if (hour >= 16 && hour < 22) tod = 'Dinner';

      timeOfDaySpikes[tod as keyof typeof timeOfDaySpikes] += spike;
      timeOfDayCounts[tod as keyof typeof timeOfDayCounts]++;

      if (spike > 35) dangerFoods.push({ name: meal.mealName, spike });
      else if (spike < 15) safeFoods.push({ name: meal.mealName, spike });
    });

    const timeChartData = Object.keys(timeOfDaySpikes).map(key => ({
      time: key,
      avgSpike: timeOfDayCounts[key as keyof typeof timeOfDayCounts] > 0 
        ? Math.round(timeOfDaySpikes[key as keyof typeof timeOfDaySpikes] / timeOfDayCounts[key as keyof typeof timeOfDayCounts]) 
        : 0
    }));

    return {
      dangerFoods: dangerFoods.sort((a,b) => b.spike - a.spike).slice(0, 5),
      safeFoods: safeFoods.sort((a,b) => a.spike - b.spike).slice(0, 5),
      timeChartData,
      totalMeals: allMeals.length
    };
  }, [allMeals]);

  if (isUserLoading || profileLoading || mealsLoading) {
    return <div className="min-h-screen bg-background flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-500"/></div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground pt-20 pb-20 font-sans">
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        
        <header className="border-b border-border pb-4">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
             <h1 className="text-3xl font-semibold tracking-tight text-foreground">Metabolic Insights</h1>
             <p className="text-muted-foreground text-sm font-medium mt-1 flex items-center">
               <TrendingUp className="w-4 h-4 mr-2" /> AI breakdown of your historical glucose behavior.
             </p>
          </motion.div>
        </header>

        {insights ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Danger Foods */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="p-6 rounded-3xl bg-card border border-border shadow-sm h-full">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Danger Foods</h2>
                      <p className="text-xs text-muted-foreground font-medium">Largest Historical Spikes</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {insights.dangerFoods.length > 0 ? insights.dangerFoods.map((f, i) => (
                      <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-background border border-border">
                        <span className="font-semibold text-sm truncate pr-4">{f.name}</span>
                        <Badge variant="destructive" className="bg-destructive text-destructive-foreground shadow-none px-3 font-bold">+{f.spike} mg/dL</Badge>
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No severe spikes detected yet!</p>}
                  </div>
                </Card>
              </motion.div>

              {/* Safe Foods */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="p-6 rounded-3xl bg-card border border-border shadow-sm h-full">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Safe Foods</h2>
                      <p className="text-xs text-muted-foreground font-medium">Lowest Historical Spikes</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {insights.safeFoods.length > 0 ? insights.safeFoods.map((f, i) => (
                      <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-background border border-border">
                        <span className="font-semibold text-sm truncate pr-4">{f.name}</span>
                        <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/10 shadow-none px-3 font-bold border-none">+{f.spike} mg/dL</Badge>
                      </div>
                    )) : <p className="text-sm text-muted-foreground">Log more safe meals to see them here.</p>}
                  </div>
                </Card>
              </motion.div>

            </div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="p-6 md:p-8 rounded-3xl bg-card border border-border flex flex-col items-center">
                <div className="w-full flex justify-between items-center mb-6">
                   <h3 className="text-lg font-bold flex items-center gap-2"><Scale className="w-5 h-5 text-emerald-500" /> Circadian Averages</h3>
                   <span className="text-xs font-semibold px-3 py-1 bg-secondary rounded-full text-muted-foreground">Target: {targetGlucose} mg/dL</span>
                </div>
                <div className="w-full h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={insights.timeChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="time" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: 'hsl(var(--secondary))' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px', color: 'hsl(var(--foreground))', fontWeight: '500' }} formatter={(val: any) => [`+${val} mg/dL Avg`, 'Spike']} />
                      <Bar dataKey="avgSpike" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} maxBarSize={60} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </motion.div>

          </div>
        ) : (
          <div className="py-20 text-center flex flex-col items-center space-y-4">
             <TrendingUp className="w-16 h-16 text-muted-foreground/30" />
             <h2 className="text-xl font-bold">Not Enough Data</h2>
             <p className="text-sm text-muted-foreground font-medium max-w-sm">Log more meals to unlock deep AI patterns, danger foods, and circadian averages.</p>
          </div>
        )}

      </main>
    </div>
  );
}
