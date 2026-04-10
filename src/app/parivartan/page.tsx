"use client";

import { useState, useRef, useEffect } from 'react';
import { useUser } from '@/firebase';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

interface Message {
  id: string;
  type: 'user' | 'coach';
  text: string;
  timestamp: Date;
}

function getCoachResponse(prompt: string) {
  const text = prompt.toLowerCase();

  if (text.includes('meal') || text.includes('eat') || text.includes('food') || text.includes('breakfast') || text.includes('lunch') || text.includes('dinner') || text.includes('snack')) {
    return 'For steadier glucose, build meals around protein, fiber, and slower carbs. A simple option is eggs or paneer with vegetables at breakfast, dal with salad at lunch, and grilled protein with vegetables at dinner. If you want, I can suggest a full day plan.';
  }

  if (text.includes('glucose') || text.includes('sugar') || text.includes('spike') || text.includes('low') || text.includes('high')) {
    return 'If your glucose is trending high after meals, try a 10 to 15 minute walk, reduce refined carbs next time, and pair carbs with protein or fiber. If you feel low, follow your care plan and recheck as needed.';
  }

  if (text.includes('app') || text.includes('web') || text.includes('settings') || text.includes('logbook') || text.includes('menu') || text.includes('feature')) {
    return 'This app helps you log meals, track glucose trends, review insights, and get meal suggestions. Settings is where integrations and sync options live, while the Logbook captures your daily readings and habits.';
  }

  if (text.includes('exercise') || text.includes('walk') || text.includes('workout')) {
    return 'Regular movement helps glucose control. A brisk 10 to 20 minute walk after meals can reduce spikes, and consistent weekly activity improves insulin sensitivity over time.';
  }

  return 'I can help with meal suggestions, glucose guidance, app questions, and daily wellness support. Try asking for a meal plan, what to do after a glucose spike, or how to use a feature in the app.';
}

export default function ParivatanPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'coach',
      text: "Hello! I'm Parivartan, your personal AI health coach. I'm here to help you manage your diabetes, optimize your nutrition, and support your daily wellness goals. What would you like to know today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [isUserLoading, router, user]);

  useEffect(() => {
    const lang = typeof window !== 'undefined' ? localStorage.getItem('glyvora_lang') : null;
    if (lang) {
      setPreferredLanguage(lang);
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      text: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.text,
          history: messages.map((m) => ({
            role: m.type === 'user' ? 'user' : 'assistant',
            content: m.text,
          })),
          userContext: `User: ${displayName}`,
          preferredLanguage,
        }),
      });

      const data = await response.json();
      const apiReply = typeof data?.reply === 'string' ? data.reply.trim() : '';

      const coachMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'coach',
        text: apiReply || getCoachResponse(userMessage.text),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, coachMessage]);
    } catch {
      const coachMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'coach',
        text: getCoachResponse(userMessage.text),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, coachMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isUserLoading || !user) {
    return <div className="min-h-screen bg-[#F5F3F0]" />;
  }

  const displayName = user.displayName?.split(' ')[0] || 'Aditya';

  return (
    <div className="min-h-screen bg-[#F5F3F0] text-slate-900">
      <Navigation />

      <main className="px-4 py-4 lg:ml-48 xl:ml-52 lg:px-5 lg:py-3.5">
        <div className="mx-auto max-w-5xl space-y-4">

          <Card className="flex min-h-[620px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Chat with Parivartan</h2>
                  <p className="text-xs text-slate-500">Advice, app info, and meal suggestions in one place</p>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`flex max-w-xs gap-3 ${message.type === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      {message.type === 'coach' && (
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
                          <Sparkles className="h-4 w-4 text-emerald-600" />
                        </div>
                      )}
                      <div
                        className={`rounded-xl px-3 py-2.5 ${
                          message.type === 'user'
                            ? 'bg-emerald-500 text-white'
                            : 'border border-slate-200 bg-slate-50 text-slate-900'
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>
                        <p
                          className={`mt-1 text-xs ${
                            message.type === 'user'
                              ? 'text-emerald-100'
                              : 'text-slate-500'
                          }`}
                        >
                          {message.timestamp.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
                        <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <p className="text-sm text-slate-500">Coach is thinking...</p>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            <div className="border-t border-slate-200 p-4">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask Parivartan anything about your health..."
                  disabled={isLoading}
                  className="rounded-xl border-slate-200 bg-slate-50 text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
                <Button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="h-10 w-10 flex-shrink-0 rounded-xl bg-emerald-500 p-0 text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
