"use client";

import { useEffect, useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth, useFirestore } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function NotificationsPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [smsEnabled, setSmsEnabled] = useState(true);
  const [lowThreshold, setLowThreshold] = useState('70');
  const [highThreshold, setHighThreshold] = useState('140');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDoc(doc(firestore, 'users', user.uid));
      if (snap.exists()) {
        const data = snap.data() as any;
        setSmsEnabled(data.smsEnabled ?? Boolean(data.phoneNumber));
        setLowThreshold(String(data.glucoseLowThreshold ?? 70));
        setHighThreshold(String(data.glucoseHighThreshold ?? 140));
        setPhoneNumber(data.phoneNumber || '');
      }
    };
    load();
  }, [auth, firestore]);

  const save = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(doc(firestore, 'users', user.uid), {
        smsEnabled,
        glucoseLowThreshold: Number(lowThreshold) || 70,
        glucoseHighThreshold: Number(highThreshold) || 140,
        phoneNumber,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      toast({ title: 'Notification settings saved', description: 'Your SMS and glucose thresholds are updated.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F3F0] text-slate-900 pb-10 lg:ml-48 xl:ml-52">
      <Navigation />
      <main className="mx-auto max-w-4xl px-4 pt-4 lg:pt-6">
        <Card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-slate-600">Turn off SMS or change glucose thresholds for low/high alerts.</p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-slate-700">Phone number</Label>
              <Input id="phone" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+91 98765 43210" className="h-11 rounded-xl bg-slate-50" />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="font-medium text-slate-900">SMS alerts</p>
                <p className="text-xs text-slate-500">Enable or disable Twilio notifications</p>
              </div>
              <Switch checked={smsEnabled} onCheckedChange={setSmsEnabled} />
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="low" className="text-slate-700">Low threshold (mg/dL)</Label>
              <Input id="low" value={lowThreshold} onChange={(e) => setLowThreshold(e.target.value)} placeholder="70" className="h-11 rounded-xl bg-slate-50" />
              <p className="text-xs text-slate-500">Get notified when glucose falls below this level.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="high" className="text-slate-700">High threshold (mg/dL)</Label>
              <Input id="high" value={highThreshold} onChange={(e) => setHighThreshold(e.target.value)} placeholder="140" className="h-11 rounded-xl bg-slate-50" />
              <p className="text-xs text-slate-500">Get notified when glucose rises above this level.</p>
            </div>
          </div>

          <Button onClick={save} disabled={saving} className="mt-6 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600">
            {saving ? 'Saving...' : 'Save Notification Settings'}
          </Button>
        </Card>
      </main>
    </div>
  );
}
