"use client";

import { useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function PersonalDetailsPage() {
  const [step, setStep] = useState(1);

  const next = () => setStep((s) => Math.min(3, s + 1));
  const prev = () => setStep((s) => Math.max(1, s - 1));

  const progress = step * 33;

  return (
    <div className="min-h-screen bg-[#F5F3F0] text-slate-900 pb-10 lg:ml-48 xl:ml-52">
      <Navigation />
      <main className="mx-auto max-w-2xl px-4 pt-4 lg:pt-6">
        <div className="mb-3 flex items-center justify-between text-xs text-slate-600">
          <span>Step {step} of 3</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 mb-4">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
        </div>

        <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {step === 1 && (
            <div className="space-y-4">
              <h1 className="text-xl font-semibold">Tell us about yourself</h1>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Age</Label>
                  <Input placeholder="26" className="h-10" />
                </div>
                <div className="space-y-1">
                  <Label>Gender</Label>
                  <Input placeholder="Male" className="h-10" />
                </div>
                <div className="space-y-1">
                  <Label>Height (cm)</Label>
                  <Input placeholder="165" className="h-10" />
                </div>
                <div className="space-y-1">
                  <Label>Weight (kg)</Label>
                  <Input placeholder="62" className="h-10" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h1 className="text-xl font-semibold">Lifestyle & goals</h1>
              <div className="grid gap-3">
                <div className="space-y-1">
                  <Label>Activity level</Label>
                  <Input placeholder="Moderate" className="h-10" />
                </div>
                <div className="space-y-1">
                  <Label>Health goal</Label>
                  <Input placeholder="Diabetes control" className="h-10" />
                </div>
                <div className="space-y-1">
                  <Label>Typical meal timing</Label>
                  <Input placeholder="Breakfast 8 AM, Lunch 1 PM, Dinner 8 PM" className="h-10" />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h1 className="text-xl font-semibold">Diet & medical details</h1>
              <div className="grid gap-3">
                <div className="space-y-1">
                  <Label>Dietary preference</Label>
                  <Input placeholder="Vegetarian" className="h-10" />
                </div>
                <div className="space-y-1">
                  <Label>Allergies or restrictions</Label>
                  <Input placeholder="Peanuts" className="h-10" />
                </div>
                <div className="space-y-1">
                  <Label>Medical conditions</Label>
                  <Input placeholder="Type 2 Diabetes" className="h-10" />
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between">
            <Button variant="outline" onClick={prev} disabled={step === 1} className="h-9">Back</Button>
            <Button onClick={next} className="h-9 bg-emerald-500 hover:bg-emerald-600 text-white">
              {step === 3 ? 'Complete' : 'Continue'}
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
