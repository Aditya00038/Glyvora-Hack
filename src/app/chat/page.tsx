"use client";

import { useMemo, useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Loader2, SendHorizontal } from 'lucide-react';
import { useUser } from '@/firebase';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export default function ChatPage() {
  const { user } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const userContext = useMemo(() => {
    return `Name: ${user?.displayName || 'User'}, Email: ${user?.email || 'unknown'}`;
  }, [user?.displayName, user?.email]);

  const sendMessage = async () => {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    const nextMessages = [...messages, { role: 'user', content: trimmed } as ChatMessage];
    setMessages(nextMessages);
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: nextMessages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', content: m.content })),
          userContext,
        }),
      });

      const data = await res.json();
      const reply = data?.reply || 'I can help with meal plans, logbook, and quick nutrition advice.';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Please try again. I can answer quickly in short text.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F3F0] text-slate-900 pb-8 lg:ml-48 xl:ml-52">
      <Navigation />
      <main className="mx-auto max-w-5xl px-4 pt-4 lg:pt-6">
        <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <Bot className="h-5 w-5 text-emerald-600" />
            <h1 className="text-lg font-semibold">Chat (beta version)</h1>
          </div>

          <div className="min-h-[58vh] py-8">
            {messages.length === 0 ? (
              <div className="mx-auto mt-4 max-w-xl text-center">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 border-emerald-100 bg-emerald-50">
                  <Bot className="h-10 w-10 text-emerald-600" />
                </div>
                <h2 className="mt-5 text-4xl font-semibold tracking-tight">How are you feeling today?</h2>
                <p className="mt-3 text-lg text-slate-600">
                  Your personal AI health coach is here to help with nutrition, meal planning, glucose predictions, or app usage.
                </p>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-3">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`rounded-2xl px-4 py-3 text-sm ${
                      m.role === 'user' ? 'ml-auto max-w-[75%] bg-emerald-500 text-white' : 'max-w-[85%] border border-slate-200 bg-slate-50 text-slate-800'
                    }`}
                  >
                    {m.content}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mx-auto mt-2 max-w-3xl rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendMessage();
                }}
                placeholder="Ask anything"
                className="h-11 rounded-xl border-slate-300"
              />
              <Button onClick={sendMessage} disabled={loading} className="h-11 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-3 text-center text-xs text-slate-500">For informational purposes only. Not a substitute for professional medical advice.</p>
          </div>
        </Card>
      </main>
    </div>
  );
}
