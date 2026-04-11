"use client";

import { useState, useRef, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Bot, Loader2, MessageCircle, X } from 'lucide-react';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { aiMetabolicCoach } from '@/ai/flows/ai-metabolic-coach';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export function GlobalAssistant() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [coachOpen, setCoachOpen] = useState(false);
  const [coachMsg, setCoachMsg] = useState('');
  const [coachHistory, setCoachHistory] = useState<{role:'user'|'model', content:string}[]>([]);
  const [isCoachTyping, setIsCoachTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [dietaryPreference, setDietaryPreference] = useState('standard');
  const [targetGlucose, setTargetGlucose] = useState(110);

  useEffect(() => {
    async function fetchProfile() {
      if (user && firestore) {
        const snap = await getDoc(doc(firestore, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setDietaryPreference(data.dietaryPreference || 'standard');
          setTargetGlucose(data.targetGlucose || 110);
        }
      }
    }
    fetchProfile();
  }, [user, firestore]);

  const mealsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users', user.uid, 'meals'), orderBy('scannedAt', 'desc'), limit(15));
  }, [firestore, user?.uid]);

  const { data: recentHistory } = useCollection(mealsQuery);

  const stabilityPercentage = useMemo(() => {
    if (!recentHistory || !recentHistory.length) return 100;
    const stable = recentHistory.filter(m => (m.initialPredictedGlucoseSpike || 0) < 30).length;
    return Math.round((stable / recentHistory.length) * 100);
  }, [recentHistory]);

  const sendCoachMessage = async (msg: string = coachMsg) => {
    if (!msg.trim()) return;
    const newHistory = [...coachHistory, { role: 'user' as const, content: msg }];
    setCoachHistory(newHistory);
    setCoachMsg('');
    setIsCoachTyping(true);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

    try {
      const context = `The user's name is ${user?.displayName}. They have a ${stabilityPercentage}% stability. Target threshold: ${targetGlucose}mg/dL. Diet type: ${dietaryPreference}. Recent meal spikes: ${recentHistory?.slice(0,3).map(m=>`+${m.initialPredictedGlucoseSpike}`).join(', ')}`;
      const res = await aiMetabolicCoach({ message: msg, history: newHistory, userContext: context });
      const isOffline = res.response.includes('fat-pairing') && res.suggestions?.includes('Explain fat-pairing');
      setCoachHistory([...newHistory, { role: 'model', content: isOffline ? `⚡ Offline Mode — ${res.response}` : res.response }]);
      if (isOffline) {
        toast({ title: 'AI is in offline mode', description: 'Responses are pre-cached. Check your API key.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Assistant Disconnected' });
      setCoachHistory([...newHistory, { role: 'model', content: 'Connection to assistant lost. Please try again later.' }]);
    } finally {
      setIsCoachTyping(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  if (isUserLoading || !user) return null;

  return (
    <>
      <Sheet open={coachOpen} onOpenChange={setCoachOpen}>
        {/* Floating Button right bottom */}
        <SheetTrigger asChild>
          <motion.div 
            initial={{ scale: 0, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            className="fixed bottom-6 right-6 z-[100]"
          >
            <Button 
              size="icon" 
              className="h-16 w-16 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-2xl transition-transform hover:scale-110 active:scale-95 border-4 border-background"
            >
              <MessageCircle className="w-8 h-8" />
            </Button>
          </motion.div>
        </SheetTrigger>
        
        <SheetContent side="right" className="w-full sm:w-[400px] bg-card border-l border-border p-0 flex flex-col shadow-2xl z-[150]">
          <SheetHeader className="p-6 border-b border-border bg-card shadow-sm z-10 flex flex-row items-center justify-between">
            <SheetTitle className="text-xl font-bold flex items-center gap-2 tracking-tight m-0">
              <Bot className="text-emerald-500 w-6 h-6"/> Glyvora Coach
            </SheetTitle>
            <Button variant="ghost" size="icon" onClick={() => setCoachOpen(false)} className="h-8 w-8 rounded-full text-muted-foreground hover:bg-secondary">
              <X className="w-4 h-4" />
            </Button>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-background/50 relative">
            {coachHistory.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center opacity-40 px-6 text-center">
                <Bot className="w-16 h-16 mx-auto mb-4 text-emerald-500" />
                <h3 className="text-lg font-bold mb-1">Hey {user?.displayName?.split(' ')[0] || 'there'}!</h3>
                <p className="text-sm font-medium">I'm your personal metabolic AI. I have access to your {targetGlucose}mg/dL limits and {dietaryPreference} dietary needs.</p>
              </div>
            )}
            {coachHistory.map((m, i) => (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={i} className={cn("p-4 rounded-2xl w-[85%] shadow-sm", m.role === 'user' ? "ml-auto bg-primary text-primary-foreground rounded-tr-sm" : "bg-card border border-border text-foreground rounded-tl-sm")}>
                <p className="text-sm leading-relaxed font-medium">{m.content}</p>
              </motion.div>
            ))}
            {isCoachTyping && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-2xl bg-card border border-border w-16 shadow-sm"><Loader2 className="w-4 h-4 animate-spin text-emerald-500" /></motion.div>}
            <div ref={chatEndRef} />
          </div>
          <div className="p-4 border-t border-border bg-card flex gap-2 z-10 w-full relative pb-8 md:pb-4">
            <Input 
              value={coachMsg} 
              onChange={e=>setCoachMsg(e.target.value)} 
              onKeyDown={e=>e.key==='Enter'&&sendCoachMessage()} 
              className="bg-background border-border rounded-xl focus-visible:ring-emerald-500 h-12 shadow-sm" 
              placeholder="Ask the coach..." 
            />
            <Button onClick={()=>sendCoachMessage()} size="icon" className="h-12 w-12 bg-primary hover:bg-primary/90 rounded-xl shrink-0 shadow-sm transition-transform active:scale-95"><Bot className="w-5 h-5 text-primary-foreground" /></Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
