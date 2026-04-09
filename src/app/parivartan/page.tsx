"use client";

import { useState, useRef, useEffect } from 'react';
import { useUser } from '@/firebase';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send, Loader2, Sparkles, ChefHat, ShieldAlert, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

interface Message {
  id: string;
  type: 'user' | 'coach';
  text: string;
  timestamp: Date;
}

const quickPrompts = [
  'What should I eat tonight for steadier glucose?',
  'Suggest a meal plan for my day.',
  'How can I lower my glucose after a meal?',
  'Explain this app and what Parivartan can do.',
];

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
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [isUserLoading, router, user]);

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

    setTimeout(() => {
      const coachMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'coach',
        text: getCoachResponse(userMessage.text),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, coachMessage]);
      setIsLoading(false);
    }, 800);
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
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <Card className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-white via-emerald-50/40 to-teal-50 p-5 shadow-sm">
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-emerald-100 bg-white shadow-sm">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Sparkles className="h-7 w-7" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Parivartan AI Coach</div>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Talk to Parivartan</h1>
                  <p className="max-w-xl text-sm leading-6 text-slate-600">
                    Ask about food, glucose trends, meal suggestions, app features, reminders, or daily wellness guidance. Parivartan gives practical advice in plain language.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                  <ChefHat className="h-5 w-5 text-orange-500" />
                  <p className="mt-2 text-sm font-semibold text-slate-900">Meal ideas</p>
                  <p className="mt-1 text-xs text-slate-600">Breakfast, lunch, dinner, and snack suggestions.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                  <ShieldAlert className="h-5 w-5 text-rose-500" />
                  <p className="mt-2 text-sm font-semibold text-slate-900">Glucose advice</p>
                  <p className="mt-1 text-xs text-slate-600">Insights to help you respond to spikes or lows.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                  <Info className="h-5 w-5 text-blue-500" />
                  <p className="mt-2 text-sm font-semibold text-slate-900">App help</p>
                  <p className="mt-1 text-xs text-slate-600">Learn how logging, settings, and meal planning work.</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <Button
                    key={prompt}
                    variant="outline"
                    className="rounded-full border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
                    onClick={() => setInput(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </Card>

            <Card className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="space-y-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Parivartan is ready</h2>
                  <p className="mt-1 text-sm text-slate-600">Use the chat below to ask for personalized advice and meal suggestions.</p>
                </div>

                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Today&apos;s focus</p>
                  <p className="text-sm text-slate-700">Try asking for a meal suggestion, a glucose recovery plan, or an explanation of your app features.</p>
                  <p className="text-xs text-slate-500">Parivartan can help with general advice, but it does not replace professional medical guidance.</p>
                </div>
              </div>
            </Card>
          </div>

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
