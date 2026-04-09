"use client";

import { useMemo, useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpayScript() {
  return new Promise<boolean>((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function UpgradePage() {
  const { toast } = useToast();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');

  const amount = useMemo(() => (billing === 'monthly' ? 90000 : 900000), [billing]);
  const displayAmount = billing === 'monthly' ? 900 : 9000;

  const startPayment = async () => {
    const loaded = await loadRazorpayScript();
    if (!loaded) {
      toast({ variant: 'destructive', title: 'Razorpay failed to load' });
      return;
    }

    const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!key) {
      toast({ variant: 'destructive', title: 'Missing Razorpay key', description: 'Set NEXT_PUBLIC_RAZORPAY_KEY_ID in .env' });
      return;
    }

    const orderResponse = await fetch('/api/razorpay/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, currency: 'INR', receipt: `glyvora-${billing}` }),
    });

    if (!orderResponse.ok) {
      toast({ variant: 'destructive', title: 'Unable to create Razorpay order' });
      return;
    }

    const orderData = await orderResponse.json();
    const orderId = orderData?.order?.id;

    const options = {
      key,
      name: 'GLYVORA',
      description: 'Personal Plan Subscription',
      amount,
      order_id: orderId,
      currency: 'INR',
      prefill: {
        name: 'GLYVORA User',
      },
      theme: { color: '#10b981' },
      handler: function () {
        toast({ title: 'Payment successful', description: 'Your premium access is now active.' });
      },
    };

    const paymentObject = new window.Razorpay(options);
    paymentObject.open();
  };

  return (
    <div className="min-h-screen bg-[#F5F3F0] text-slate-900 pb-10 lg:ml-48 xl:ml-52">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 pt-4 lg:pt-6">
        <Card className="rounded-2xl border border-slate-200 bg-white p-0 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h1 className="text-2xl font-semibold">Choose Your Plan</h1>
            <div className="rounded-xl bg-slate-100 p-1 text-sm">
              <button
                onClick={() => setBilling('monthly')}
                className={`rounded-lg px-4 py-1.5 ${billing === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling('yearly')}
                className={`rounded-lg px-4 py-1.5 ${billing === 'yearly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
              >
                Yearly <span className="text-emerald-600 font-semibold">Save 17%</span>
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="max-w-md rounded-2xl border-2 border-blue-500 p-6">
              <div className="mx-auto -mt-10 w-fit rounded-full bg-blue-500 px-4 py-1 text-sm font-semibold text-white">Most Popular</div>
              <h2 className="mt-2 text-4xl font-semibold">Personal</h2>
              <p className="mt-2 text-5xl font-bold">₹{displayAmount}<span className="text-2xl font-normal text-slate-500">/{billing === 'monthly' ? 'month' : 'year'}</span></p>
              <p className="mt-4 text-lg text-slate-700">AI-powered meal plans personalized to your goals and lifestyle.</p>

              <ul className="mt-4 space-y-2 text-lg text-slate-700">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" /> 7-day free trial</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" /> Personalized weekly meal plans</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" /> Tailored to your dietary preferences</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" /> Recipes that match your goals</li>
              </ul>

              <Button onClick={startPayment} className="mt-5 h-11 w-full rounded-xl bg-emerald-500 text-lg font-semibold text-white hover:bg-emerald-600 shadow-[0_12px_30px_rgba(16,185,129,0.35)]">
                Choose Plan
              </Button>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
