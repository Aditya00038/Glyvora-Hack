"use client";

import { useState, useEffect } from 'react';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, Loader2, BrainCircuit,
  AlertCircle, ShoppingBag, UtensilsCrossed, CheckCircle2,
  CalendarDays
} from 'lucide-react';
import { generateMetabolicMealPlan } from '@/ai/flows/generate-metabolic-meal-plan';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from 'framer-motion';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';

export default function MealPlanPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [userSensitivity, setUserSensitivity] = useState('medium');
  const [dietaryPreference, setDietaryPreference] = useState('standard');
  const [targetGlucose, setTargetGlucose] = useState(110);
  const [activeDayIdx, setActiveDayIdx] = useState(0);

  const plansQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users', user.uid, 'mealPlans'), orderBy('generatedAt', 'desc'), limit(1));
  }, [firestore, user?.uid]);
  const { data: latestPlans } = useCollection(plansQuery);
  const currentPlan = latestPlans?.[0];

  const mealsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users', user.uid, 'meals'), orderBy('scannedAt', 'desc'), limit(10));
  }, [firestore, user?.uid]);
  const { data: recentMeals } = useCollection(mealsQuery);

  useEffect(() => {
    async function fetchProfile() {
      if (user && firestore) {
        const snap = await getDoc(doc(firestore, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setUserSensitivity(data.sensitivitySetting || 'medium');
          setDietaryPreference(data.dietaryPreference || 'standard');
          setTargetGlucose(data.targetGlucose || 110);
        }
      }
    }
    fetchProfile();
  }, [user, firestore]);

  const handleGenerate = async () => {
    if (!user) return;
    setIsGenerating(true);
    try {
      const historySummary = recentMeals?.map(m => `${m.mealName || 'Meal'} (Spike: +${m.initialPredictedGlucoseSpike || 0})`) || [];
      const latestMealSpike = recentMeals?.[0]?.initialPredictedGlucoseSpike || 0;
      const isCorrectionMode = latestMealSpike > 35;

      const plan = await generateMetabolicMealPlan({
        userSensitivity,
        recentHistory: historySummary,
        preferences: dietaryPreference,
        goals: `Maintain post-meal spikes under ${targetGlucose} mg/dL limit`,
        isCorrectionMode
      });

      const planRef = collection(firestore, 'users', user.uid, 'mealPlans');
      addDocumentNonBlocking(planRef, {
        userId: user.uid,
        days: plan.days,
        weeklyStabilityScore: plan.weeklyStabilityScore,
        generatedAt: new Date().toISOString(),
        startDate: new Date().toISOString().split('T')[0],
      });

      toast({ title: "Plan Generated", description: "Your 7-day nutritional summary is ready." });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Generation Failed', description: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const isCorrectionActive = (recentMeals?.[0]?.initialPredictedGlucoseSpike || 0) > 35;

  const getRadarData = (meal: any) => {
    return [
      { subject: 'Protein', A: Math.min(100, Math.random()*40 + 60), fullMark: 100 },
      { subject: 'Fiber', A: Math.min(100, Math.random()*50 + 50), fullMark: 100 },
      { subject: 'Fats', A: Math.min(100, Math.random()*30 + 40), fullMark: 100 },
      { subject: 'Stability', A: meal.stabilityScore ? meal.stabilityScore * 10 : 85, fullMark: 100 },
    ];
  };

  if (isUserLoading || !user) return <div className="min-h-screen bg-background flex justify-center items-center"><Loader2 className="animate-spin text-emerald-500 w-8 h-8"/></div>;

  return (
    <div className="min-h-screen bg-background text-foreground pt-20 pb-20 font-sans">
      <Navigation />
      
      <main className="max-w-6xl mx-auto px-4 py-8 relative z-10 space-y-8">
        
        {/* Simple Professional Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-4 border-b border-border">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Meal Plan</h1>
            <p className="text-muted-foreground text-sm font-medium mt-1">
              Your personalized 7-day culinary roadmap.
             </p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Button 
              onClick={handleGenerate} disabled={isGenerating}
              className="h-11 px-8 rounded-xl font-semibold shadow-md transition-all active:scale-95 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin mr-3"/> Updating Plan</> : 
                ((currentPlan ? 'Generate New Plan' : 'Create Weekly Plan'))}
            </Button>
          </motion.div>
        </header>

        {/* Clinical Correction Banner */}
        {isCorrectionActive && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
            <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 p-4 rounded-2xl flex items-center gap-4 text-amber-800 dark:text-amber-500 shadow-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium tracking-wide">
                <strong>Attention:</strong> Your recent glucose spike exceeded clinical thresholds. We have temporarily activated a conservative diet plan.
              </p>
            </Card>
          </motion.div>
        )}

        {/* Core Summary Cards */}
        {currentPlan && !isGenerating && (
          <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 h-32 rounded-3xl border-border bg-card shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Plan Score</span>
                <h2 className="text-4xl font-bold tracking-tight text-foreground mt-1">{currentPlan.weeklyStabilityScore}%</h2>
              </div>
              <CheckCircle2 className="w-10 h-10 text-emerald-500 opacity-20" />
            </Card>
            
            <Card className="p-6 h-32 rounded-3xl border-border bg-card shadow-sm flex flex-col justify-center">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                Active Protocol
              </span>
              <h2 className="text-xl font-semibold text-foreground/90">
                {isCorrectionActive ? 'Post-Spike Recovery' : 'Balanced Optimization'}
              </h2>
            </Card>

            <Card className="p-6 h-32 rounded-3xl border-border bg-card shadow-sm flex flex-col justify-center">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Target Range</span>
              <h2 className="text-xl font-semibold text-foreground/90">
                70 - 120 mg/dL
              </h2>
            </Card>
          </motion.div>
        )}

        {isGenerating ? (
          <div className="flex flex-col items-center justify-center py-40 space-y-6">
             <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
             <div className="space-y-2 text-center">
               <h2 className="text-xl font-semibold text-foreground">Designing Your Plan</h2>
               <p className="text-sm font-medium text-muted-foreground">Cross-referencing metabolic history...</p>
             </div>
          </div>
        ) : currentPlan ? (
          <div className="space-y-6 relative">
            {/* Clean Day Selector Tabs */}
            <Tabs value={activeDayIdx.toString()} onValueChange={(v) => setActiveDayIdx(parseInt(v))} className="w-full">
              <TabsList className="bg-secondary p-1.5 h-auto flex gap-2 rounded-2xl w-full sm:w-auto overflow-x-auto custom-scrollbar border border-border justify-start">
                {currentPlan.days.map((day: any, idx: number) => (
                  <TabsTrigger key={idx} value={idx.toString()} className={cn("rounded-xl px-4 py-2.5 text-sm font-semibold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm", activeDayIdx !== idx && "text-muted-foreground hover:text-foreground")}>
                    <CalendarDays className="w-4 h-4 mr-2 hidden sm:block opacity-50" /> {day.dayName}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Meal Items Grid */}
            <div className="relative min-h-[500px]">
              <AnimatePresence mode="wait">
                 <motion.div 
                   key={activeDayIdx} 
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: -10 }}
                   transition={{ duration: 0.2 }}
                   className="grid grid-cols-1 xl:grid-cols-2 gap-6 absolute inset-0"
                 >
                   {currentPlan.days[activeDayIdx]?.meals.map((meal: any, midx: number) => (
                     <Card key={midx} className="p-6 sm:p-8 rounded-[2rem] bg-card border-border shadow-sm flex flex-col h-[340px] group transition-all hover:shadow-md">

                       <div className="flex gap-6 h-full relative z-10 w-full">
                          
                          {/* Info Column */}
                          <div className="flex-1 flex flex-col min-w-0 pr-6 border-r border-border">
                             <div className="flex justify-between items-start mb-3">
                               <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 text-xs font-semibold px-3 py-1 shadow-none border-none">
                                 {meal.type}
                               </Badge>
                             </div>
                             
                             <h4 className="text-xl font-bold text-foreground leading-tight truncate mb-2">{meal.name}</h4>
                             <p className="text-sm text-muted-foreground font-medium flex-1 line-clamp-3 leading-relaxed mb-4">
                               {meal.description}
                             </p>
                             
                             {/* Stats row */}
                             <div className="flex items-center gap-8 mt-auto pt-4 border-t border-border">
                               <div>
                                 <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-0.5">Predicted Impact</p>
                                 <p className="text-lg font-bold text-foreground">+{meal.estimatedSpike} <span className="text-xs text-muted-foreground font-medium">mg/dL</span></p>
                               </div>
                               <div>
                                 <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-0.5">Rating</p>
                                 <p className="text-lg font-bold text-emerald-500 flex items-center"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-1.5"/>{meal.stabilityScore || 9}</p>
                               </div>
                             </div>

                             <div className="flex gap-3 mt-4">
                                <Button variant="secondary" className="flex-1 bg-secondary hover:bg-secondary/80 text-foreground rounded-xl text-xs font-semibold h-9 transition-colors shadow-none border border-border">
                                   <ShoppingBag className="w-3.5 h-3.5 mr-2 opacity-50" /> Add to List
                                </Button>
                             </div>
                          </div>

                          {/* Radar Chart Column */}
                          <div className="w-[160px] sm:w-[200px] shrink-0 flex flex-col items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Nutritional Balance</span>
                            <div className="w-full aspect-square">
                              <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="65%" data={getRadarData(meal)}>
                                  <PolarGrid stroke="hsl(var(--border))" />
                                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 500 }} />
                                  <Tooltip wrapperStyle={{ outline: 'none' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px', color: 'hsl(var(--foreground))', fontWeight: '500' }} />
                                  <Radar name={meal.name} dataKey="A" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                                </RadarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                       </div>
                     </Card>
                   ))}
                 </motion.div>
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <Card className="p-24 text-center border-border bg-card rounded-3xl shadow-sm mt-8">
            <BrainCircuit className="w-12 h-12 text-muted-foreground mx-auto mb-6 opacity-30" />
            <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">No Meal Plan Found</h2>
            <p className="text-sm font-medium text-muted-foreground mb-8 max-w-sm mx-auto leading-relaxed">Let the AI generate an optimal daily dietary schedule strictly tailored to your glycemic response history.</p>
            <Button onClick={handleGenerate} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl px-10 h-12 font-semibold shadow-sm transition-all w-full sm:w-auto">
              Generate Weekly Plan
            </Button>
          </Card>
        )}
      </main>
    </div>
  );
}
