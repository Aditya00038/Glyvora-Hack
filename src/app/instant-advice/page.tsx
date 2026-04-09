"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { MessageCircle, Smartphone, Bell, Users, Bot, MessagesSquare, Sparkles } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useAuth, useFirestore } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

type SettingsState = {
  telegramHandle: string;
  whatsappNumber: string;
  smsEnabled: boolean;
  lowThreshold: string;
  highThreshold: string;
  householdDescription: string;
};

const initialState: SettingsState = {
  telegramHandle: '',
  whatsappNumber: '',
  smsEnabled: true,
  lowThreshold: '70',
  highThreshold: '140',
  householdDescription: '',
};

type FeatureKey = 'integrations' | 'mobile-sync' | 'notifications' | 'household';

const featureOptions: Array<{ key: FeatureKey; label: string; icon: typeof Bot }> = [
  { key: 'integrations', label: 'Integrations', icon: MessagesSquare },
  { key: 'mobile-sync', label: 'Mobile Sync', icon: Smartphone },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'household', label: 'Household', icon: Users },
];

export default function InstantAdvicePage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [state, setState] = useState<SettingsState>(initialState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeFeature, setActiveFeature] = useState<FeatureKey>('integrations');

  useEffect(() => {
    const feature = searchParams.get('feature');
    const validFeature = featureOptions.find((option) => option.key === feature);
    if (validFeature) {
      setActiveFeature(validFeature.key);
    }
  }, [searchParams]);

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDoc(doc(firestore, 'users', user.uid));
      if (snap.exists()) {
        const data = snap.data() as any;
        setState({
          telegramHandle: data.telegramHandle || '',
          whatsappNumber: data.whatsappNumber || '',
          smsEnabled: data.smsEnabled ?? Boolean(data.phoneNumber),
          lowThreshold: String(data.glucoseLowThreshold ?? 70),
          highThreshold: String(data.glucoseHighThreshold ?? 140),
          householdDescription: data.householdDescription || '',
        });
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
        telegramHandle: state.telegramHandle,
        whatsappNumber: state.whatsappNumber,
        smsEnabled: state.smsEnabled,
        glucoseLowThreshold: Number(state.lowThreshold) || 70,
        glucoseHighThreshold: Number(state.highThreshold) || 140,
        householdDescription: state.householdDescription,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      toast({ title: 'Settings saved', description: 'Parivartan will use these app connections and alert settings.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F3F0] text-slate-900">
      <Navigation />

      <main className="px-4 py-4 lg:ml-48 xl:ml-52 lg:px-5 lg:py-6">
        <div className="mx-auto max-w-[1280px] space-y-6">
          <div className="rounded-3xl border border-blue-200 bg-gradient-to-r from-blue-50 via-cyan-50 to-slate-50 px-5 py-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Instant Advice. Just Text.</h1>
                <p className="mt-1 text-sm text-slate-600">Configure how users reach Parivartan and how alerts are delivered.</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[220px_1fr] xl:grid-cols-[240px_1fr]">
            <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="space-y-1">
                <Link href="/personal-details" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900">
                  <Bot className="h-4 w-4" />
                  <span>Profile</span>
                </Link>
                {featureOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setActiveFeature(option.key)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                        activeFeature === option.key
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="space-y-4">
              {activeFeature === 'integrations' && (
              <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-900">Connect your apps</h2>
                    <p className="mt-1 text-sm text-slate-600">Telegram and WhatsApp are where users can message Parivartan for instant advice.</p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                        <MessageCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">Telegram</h3>
                        <p className="text-xs text-slate-500">Message Parivartan on Telegram</p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-600">Add your Telegram handle so GLYVORA can connect advice and reminders to your messaging app.</p>
                    <div className="mt-4 space-y-2">
                      <Label className="text-xs text-slate-600">Telegram handle</Label>
                      <Input value={state.telegramHandle} onChange={(e) => setState((prev) => ({ ...prev, telegramHandle: e.target.value }))} placeholder="@yourhandle" className="h-10 rounded-xl bg-white" />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                        <MessagesSquare className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">WhatsApp</h3>
                        <p className="text-xs text-slate-500">Message Parivartan on WhatsApp</p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-600">Save a WhatsApp number for instant advice and notifications.</p>
                    <div className="mt-4 space-y-2">
                      <Label className="text-xs text-slate-600">WhatsApp number</Label>
                      <Input value={state.whatsappNumber} onChange={(e) => setState((prev) => ({ ...prev, whatsappNumber: e.target.value }))} placeholder="+91 98765 43210" className="h-10 rounded-xl bg-white" />
                    </div>
                  </div>
                </div>
                <div className="mt-5">
                  <Button onClick={save} disabled={saving || loading} className="rounded-xl bg-emerald-500 text-white hover:bg-emerald-600">
                    {saving ? 'Saving...' : 'Save Integrations'}
                  </Button>
                </div>
              </Card>
              )}

              {activeFeature === 'mobile-sync' && (
                <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Mobile Sync</h2>
                      <p className="mt-1 text-sm text-slate-600">Sync health data from your phone automatically.</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
                      <Smartphone className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-slate-600">Connect your phone to import steps, sleep, and glucose trends into GLYVORA.</p>
                  <div className="mt-5">
                    <Button onClick={save} disabled={saving || loading} className="rounded-xl bg-emerald-500 text-white hover:bg-emerald-600">
                      {saving ? 'Saving...' : 'Save Settings'}
                    </Button>
                  </div>
                </Card>
              )}

              {activeFeature === 'notifications' && (
                <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
                      <p className="mt-1 text-sm text-slate-600">Glucose reminders and SMS alerts.</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                      <Bell className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900">SMS alerts</p>
                      <p className="text-xs text-slate-500">Turn notifications on or off</p>
                    </div>
                    <Switch checked={state.smsEnabled} onCheckedChange={(checked) => setState((prev) => ({ ...prev, smsEnabled: checked }))} />
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="low" className="text-slate-700">Low threshold (mg/dL)</Label>
                      <Input id="low" value={state.lowThreshold} onChange={(e) => setState((prev) => ({ ...prev, lowThreshold: e.target.value }))} placeholder="70" className="h-11 rounded-xl bg-slate-50" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="high" className="text-slate-700">High threshold (mg/dL)</Label>
                      <Input id="high" value={state.highThreshold} onChange={(e) => setState((prev) => ({ ...prev, highThreshold: e.target.value }))} placeholder="140" className="h-11 rounded-xl bg-slate-50" />
                    </div>
                  </div>
                  <div className="mt-5">
                    <Button onClick={save} disabled={saving || loading} className="rounded-xl bg-emerald-500 text-white hover:bg-emerald-600">
                      {saving ? 'Saving...' : 'Save Settings'}
                    </Button>
                  </div>
                </Card>
              )}

              {activeFeature === 'household' && (
              <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Household context</h2>
                <p className="mt-1 text-sm text-slate-600">Use the household page to describe family members, allergies, and meal patterns.</p>
                <div className="mt-4 space-y-2">
                  <Label htmlFor="household-description" className="text-slate-700">Quick household notes</Label>
                  <Textarea
                    id="household-description"
                    value={state.householdDescription}
                    onChange={(e) => setState((prev) => ({ ...prev, householdDescription: e.target.value }))}
                    placeholder="Example: 2 adults, 1 child. Vegetarian dinners. Peanut allergy."
                    className="min-h-[120px] rounded-xl bg-slate-50"
                  />
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Button asChild className="rounded-xl bg-slate-900 text-white hover:bg-slate-800">
                    <Link href="/household">Open Household</Link>
                  </Button>
                  <Button onClick={save} disabled={saving || loading} className="rounded-xl bg-emerald-500 text-white hover:bg-emerald-600">
                    {saving ? 'Saving...' : 'Save All Settings'}
                  </Button>
                </div>
              </Card>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
