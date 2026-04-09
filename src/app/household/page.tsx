"use client";

import { useEffect, useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth, useFirestore } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function HouseholdPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDoc(doc(firestore, 'users', user.uid));
      if (snap.exists()) {
        const data = snap.data() as any;
        setDescription(data.householdDescription || '');
      }
      setLoading(false);
    };
    load();
  }, [auth, firestore]);

  const save = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(doc(firestore, 'users', user.uid), {
        householdDescription: description,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      toast({ title: 'Household saved', description: 'Parivartan will use this when suggesting meals.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F3F0] text-slate-900 pb-10 lg:ml-48 xl:ml-52">
      <Navigation />
      <main className="mx-auto max-w-4xl px-4 pt-4 lg:pt-6">
        <Card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Household</h1>
          <p className="mt-1 text-sm text-slate-600">Describe your household so your AI advisor can consider everyone when suggesting meals and nutrition advice.</p>

          <div className="mt-5 space-y-2">
            <label className="text-sm font-medium text-slate-700">Household information</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. My husband Bataa is 38, has type 2 diabetes. Kids: Tana (12, girl, peanut allergy), Nomi (8, boy), Sarnai (5, girl). We eat halal."
              className="min-h-[220px] rounded-2xl border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-400"
            />
            <p className="text-xs text-slate-500">Use this to tailor meals for family members, allergies, and dietary restrictions.</p>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <Button onClick={save} disabled={saving || loading} className="rounded-xl bg-emerald-500 text-white hover:bg-emerald-600">
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
