"use client";

import { useState, useRef, useMemo, useEffect } from 'react';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Camera, Upload, Mic, Activity, LineChart as LineChartIcon, Bot, HeartPulse,
  Loader2, Maximize, AlertCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, doc, getDoc, setDoc } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { 
  Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid 
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

// AI Imports
import { extractGlucoseOcr } from '@/ai/flows/extract-glucose-ocr';
import { analyzeMealForGlucoseImpact } from '@/ai/flows/analyze-meal-for-glucose-impact';
import { processVoiceMeal } from '@/ai/flows/process-voice-meal';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();

  // Scanners
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanStep, setScanStep] = useState<'idle' | 'camera' | 'analyzing'>('idle');
  const [userSensitivity, setUserSensitivity] = useState<'low' | 'medium' | 'high'>('medium');

  // Auth Protection
  useEffect(() => {
    if (!isUserLoading && !user) router.push('/login');
  }, [user, isUserLoading, router]);

  useEffect(() => {
    async function fetchProfile() {
      if (user && firestore) {
        const snap = await getDoc(doc(firestore, 'users', user.uid));
        if (snap.exists()) setUserSensitivity(snap.data().sensitivitySetting || 'medium');
      }
    }
    fetchProfile();
  }, [user, firestore]);

  const mealsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users', user.uid, 'meals'), orderBy('scannedAt', 'desc'), limit(15));
  }, [firestore, user?.uid]);

  const { data: recentHistory } = useCollection(mealsQuery);

  const chartData = useMemo(() => {
    if (!recentHistory || recentHistory.length === 0) return [];
    const baseline = 100;
    return [...recentHistory].reverse().map(m => ({
      time: new Date(m.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      spike: m.initialPredictedGlucoseSpike || 0,
      total: baseline + (m.initialPredictedGlucoseSpike || 0),
      isHigh: (m.initialPredictedGlucoseSpike || 0) > 35
    }));
  }, [recentHistory]);

  const stabilityPercentage = useMemo(() => {
    if (!recentHistory || !recentHistory.length) return 100;
    const stable = recentHistory.filter(m => (m.initialPredictedGlucoseSpike || 0) < 30).length;
    return Math.round((stable / recentHistory.length) * 100);
  }, [recentHistory]);

  // --- Scanning Logic (Consolidated) ---
  const compressImage = (dataUri: string): Promise<string> => {
    if (dataUri.startsWith('http')) return Promise.resolve(dataUri);
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width, height = img.height;
        if (width > 800) { height *= 800 / width; width = 800; }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = dataUri;
    });
  };

  const processImage = async (dataUri: string) => {
    setScanStep('analyzing');
    try {
      const result = await analyzeMealForGlucoseImpact({
        photoDataUri: dataUri, userSensitivity, baselineGlucose: 100, recentPatterns: []
      });
      if (firestore && user) {
        addDocumentNonBlocking(collection(firestore, 'users', user.uid, 'meals'), {
          userId: user.uid, mealImageUrl: dataUri, mealName: result.mealName,
          detectedFoodItems: result.detectedFoodItems.map(f => f.name),
          initialPredictedGlucoseSpike: result.metrics.predictedSpikeMgDl,
          initialRiskLevel: result.metrics.riskLevel,
          scienceExplanation: result.science.physiologicalExplanation,
          isFeedbackProvided: false,
          scannedAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        });
      }
      toast({ title: `Analyzed: ${result.mealName}`, description: `Spike Profile: +${result.metrics.predictedSpikeMgDl} mg/dL` });
    } catch {
      toast({ variant: 'destructive', title: 'Analysis Failed' });
    } finally {
      setScanStep('idle');
      if (videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
  };

  const startCamera = async () => {
    setScanStep('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      toast({ variant: 'destructive', title: 'Camera Error' });
      setScanStep('idle');
    }
  };

  const capturePhoto = async () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      const uri = await compressImage(canvas.toDataURL('image/jpeg'));
      processImage(uri);
    }
  };

  const startVoice = () => {
    if (!('webkitSpeechRecognition' in window)) return toast({ variant: 'destructive', title: 'Voice not supported' });
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onresult = async (e: any) => {
      setScanStep('analyzing');
      try {
        const res = await processVoiceMeal({ transcript: e.results[0][0].transcript });
        processImage(`https://picsum.photos/seed/${res.detectedItems[0]}/800/800`);
      } catch {
        toast({ variant: 'destructive', title: 'Voice Failed' });
        setScanStep('idle');
      }
    };
    recognition.start();
  };

  if (isUserLoading || !user) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>;

  return (
    <div className="min-h-screen bg-background relative text-foreground pt-20 pb-20 font-sans">
      <Navigation />
      
      <main className="max-w-5xl mx-auto px-4 py-8 relative z-10 space-y-8">
        
        {/* Clean Dashboard Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-4">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Dashboard</h1>
            <p className="text-muted-foreground text-sm font-medium mt-1">
              Your daily metabolic summary.
            </p>
          </motion.div>
          
          {/* Quick Actions */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-3 w-full md:w-auto">
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e)=> { if(e.target.files?.[0]){ const r=new FileReader(); r.onload=()=>processImage(r.result as string); r.readAsDataURL(e.target.files[0]); } }} />
            
            <Button variant="outline" className="h-11 rounded-xl bg-card border-border text-foreground hover:bg-secondary shadow-sm" onClick={() => fileInputRef.current?.click()}>
               <Upload className="w-4 h-4 mr-2" /> <span className="text-sm font-medium">Upload</span>
            </Button>
            
            <Button variant="outline" className="h-11 rounded-xl bg-card border-border text-foreground hover:bg-secondary shadow-sm" onClick={startVoice}>
               <Mic className="w-4 h-4 mr-2" /> <span className="text-sm font-medium">Voice</span>
            </Button>
            
            <Button className="h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-md px-6" onClick={startCamera}>
              <Camera className="w-4 h-4 mr-2" /> <span className="text-sm font-medium">Log Meal</span>
            </Button>
          </motion.div>
        </header>

        {/* Dynamic Scanner Overlay */}
        <AnimatePresence>
          {scanStep !== 'idle' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="w-full bg-card rounded-3xl border border-border p-6 shadow-sm overflow-hidden text-center">
               {scanStep === 'analyzing' ? (
                 <div className="flex flex-col items-center py-12 space-y-4">
                   <div className="w-12 h-12 border-4 border-secondary border-t-emerald-500 rounded-full animate-spin" />
                   <h2 className="text-lg font-medium text-foreground">Analyzing your meal...</h2>
                 </div>
               ) : (
                 <div className="relative aspect-video max-h-[400px] w-full bg-black rounded-2xl overflow-hidden shadow-lg mx-auto">
                   <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                   <div className="absolute inset-x-0 bottom-6 flex justify-center gap-4">
                     <Button variant="secondary" className="bg-white/90 hover:bg-white text-slate-900 rounded-xl backdrop-blur-md" onClick={()=>{setScanStep('idle'); if(videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t=>t.stop());}}>Cancel</Button>
                     <Button className="bg-emerald-500 hover:bg-emerald-600 font-semibold px-8 rounded-xl shadow-lg" onClick={capturePhoto}>Capture</Button>
                   </div>
                 </div>
               )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Visualizer */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-2">
            <Card className="p-6 h-[340px] rounded-3xl border-border bg-card shadow-sm flex flex-col relative overflow-hidden">
              <div className="flex items-center justify-between z-10 mb-4">
                <span className="text-sm font-semibold text-foreground flex items-center gap-2"><LineChartIcon className="w-4 h-4 text-emerald-500"/> Glucose Curve</span>
                <span className="text-xs font-semibold px-3 py-1 bg-secondary rounded-full text-muted-foreground">Today</span>
              </div>
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="curveColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <Tooltip 
                      contentStyle={{backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', color: 'hsl(var(--foreground))', fontWeight: '500'}}
                      formatter={(value: any) => [`${value} mg/dL`, 'Total Glucose']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="total" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#curveColor)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </motion.div>

          {/* Quick Stats Column */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-6">
            <Card className="p-6 rounded-3xl border-border bg-card shadow-sm flex flex-col justify-center items-center h-[160px]">
               <div className="space-y-1 text-center">
                 <h2 className="text-5xl font-bold tracking-tight text-foreground">{stabilityPercentage}%</h2>
                 <p className="text-sm font-medium text-muted-foreground">Stability Score</p>
               </div>
            </Card>

            <Card className="p-6 rounded-3xl border-border bg-card shadow-sm flex flex-col justify-center h-[156px]">
               <div className="flex items-center gap-2 mb-2">
                 <HeartPulse className="w-5 h-5 text-emerald-500" />
                 <p className="text-sm font-semibold text-foreground">Health Overview</p>
               </div>
               <p className="text-sm text-muted-foreground leading-relaxed">
                 You are currently matching the top 10% of users in your cohort for stable glycemic variability.
               </p>
            </Card>
          </motion.div>
        </div>

        {/* Clean Activity Feed */}
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <h3 className="text-lg font-semibold text-foreground mb-4 px-1">Recent Meals</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentHistory?.slice(0, 3).map((meal, i) => (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }} key={meal.id}>
                <Card className="border-border bg-card p-4 rounded-3xl hover:shadow-md transition-shadow cursor-pointer flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-secondary overflow-hidden shrink-0">
                     <img src={meal.mealImageUrl} className="w-full h-full object-cover" alt="Meal scan" />
                  </div>
                  <div className="flex-1 min-w-0">
                     <h4 className="font-semibold text-foreground truncate">{meal.mealName}</h4>
                     <p className="text-xs text-muted-foreground mb-1">{new Date(meal.scannedAt).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}</p>
                     <div className="flex items-center gap-1">
                       <span className={cn("text-sm font-bold", (meal.initialPredictedGlucoseSpike || 0) > 35 ? 'text-amber-500' : 'text-emerald-500')}>
                         +{meal.initialPredictedGlucoseSpike} mg/dL
                       </span>
                     </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </main>
    </div>
  );
}
