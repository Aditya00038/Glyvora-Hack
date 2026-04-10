"use client";

import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Zap, MessageCircle, Bell, Users } from 'lucide-react';
import { useState } from 'react';

type TabType = 'integrations' | 'notifications' | 'household';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('integrations');
  const [telegramHandle, setTelegramHandle] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('+91 98765 43210');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [householdMembers, setHouseholdMembers] = useState<string[]>([]);

  return (
    <div className="min-h-screen bg-[#F5F3F0] text-slate-900 pb-10 lg:ml-48 xl:ml-52">
      <Navigation />
      <main className="mx-auto max-w-6xl px-4 pt-4 lg:pt-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Zap className="h-6 w-6 text-emerald-600" />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Instant Advice. Just Text.</h1>
            <p className="mt-1 text-sm text-slate-500">Configure how users reach Parivartan and how alerts are delivered.</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-slate-200 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('integrations')}
            className={`px-4 py-3 text-[13px] font-medium whitespace-nowrap transition-colors ${
              activeTab === 'integrations'
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-slate-600 hover:text-slate-900 border-b-2 border-transparent'
            }`}
          >
            Integrations
          </button>
          <button 
            onClick={() => setActiveTab('notifications')}
            className={`px-4 py-3 text-[13px] font-medium whitespace-nowrap transition-colors ${
              activeTab === 'notifications'
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-slate-600 hover:text-slate-900 border-b-2 border-transparent'
            }`}
          >
            Notifications
          </button>
          <button 
            onClick={() => setActiveTab('household')}
            className={`px-4 py-3 text-[13px] font-medium whitespace-nowrap transition-colors ${
              activeTab === 'household'
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-slate-600 hover:text-slate-900 border-b-2 border-transparent'
            }`}
          >
            Household
          </button>
        </div>

        {/* Content Section */}
        <div className="space-y-6">
          {/* Integrations Tab */}
          {activeTab === 'integrations' && (
            <>
              <h2 className="text-lg font-semibold">Connect your apps</h2>
              <p className="text-sm text-slate-600">Telegram and WhatsApp are where users can message Parivartan for instant advice.</p>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <MessageCircle className="h-6 w-6 text-blue-500" />
                    <div>
                      <h3 className="text-base font-semibold">Telegram</h3>
                      <p className="text-sm text-slate-500">Message Parivartan on Telegram</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                      Add your Telegram handle so GLYVORA can connect advice and reminders to your messaging app.
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="telegram" className="text-sm">Telegram handle</Label>
                      <Input
                        id="telegram"
                        value={telegramHandle}
                        onChange={(e) => setTelegramHandle(e.target.value)}
                        placeholder="@yourhandle"
                        className="rounded-lg"
                      />
                    </div>
                    <Button className="w-full bg-blue-500 text-white hover:bg-blue-600 rounded-lg">
                      Save Telegram
                    </Button>
                  </div>
                </Card>

                <Card className="rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm opacity-60">
                  <div className="flex items-center gap-3 mb-4">
                    <MessageCircle className="h-6 w-6 text-slate-400" />
                    <div>
                      <h3 className="text-base font-semibold text-slate-600">WhatsApp</h3>
                      <p className="text-sm text-slate-500">Coming soon</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                      WhatsApp integration is coming soon. Stay tuned!
                    </p>
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-600">WhatsApp number</Label>
                      <Input
                        disabled
                        value={whatsappNumber}
                        placeholder="+1 (555) 000-0000"
                        className="rounded-lg bg-slate-100"
                      />
                    </div>
                    <Button disabled className="w-full bg-slate-300 text-slate-500 rounded-lg">
                      Coming Soon
                    </Button>
                  </div>
                </Card>
              </div>

              <Button className="bg-emerald-500 text-white hover:bg-emerald-600 rounded-lg">
                Save Integrations
              </Button>
            </>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <>
              <h2 className="text-lg font-semibold">Notification Preferences</h2>
              <p className="text-sm text-slate-600">Control how and when you receive alerts from Parivartan.</p>

              <Card className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <input 
                      type="checkbox" 
                      id="notif-toggle"
                      checked={notificationsEnabled}
                      onChange={(e) => setNotificationsEnabled(e.target.checked)}
                      className="h-5 w-5 rounded accent-emerald-600"
                    />
                    <label htmlFor="notif-toggle" className="flex-1 cursor-pointer">
                      <p className="font-medium text-slate-900">Enable Notifications</p>
                      <p className="text-sm text-slate-600">Receive instant advice and glucose alerts</p>
                    </label>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-slate-200">
                    <h3 className="font-medium text-slate-900">Notification Types</h3>
                    
                    <div className="flex items-center gap-3">
                      <input type="checkbox" defaultChecked id="glucose-alerts" className="h-4 w-4 rounded accent-emerald-600" />
                      <label htmlFor="glucose-alerts" className="text-sm cursor-pointer">
                        Glucose Alerts (high/low readings)
                      </label>
                    </div>

                    <div className="flex items-center gap-3">
                      <input type="checkbox" defaultChecked id="meal-reminders" className="h-4 w-4 rounded accent-emerald-600" />
                      <label htmlFor="meal-reminders" className="text-sm cursor-pointer">
                        Meal Time Reminders
                      </label>
                    </div>

                    <div className="flex items-center gap-3">
                      <input type="checkbox" defaultChecked id="coach-tips" className="h-4 w-4 rounded accent-emerald-600" />
                      <label htmlFor="coach-tips" className="text-sm cursor-pointer">
                        Coach Tips & Recommendations
                      </label>
                    </div>

                    <div className="flex items-center gap-3">
                      <input type="checkbox" defaultChecked id="insight-updates" className="h-4 w-4 rounded accent-emerald-600" />
                      <label htmlFor="insight-updates" className="text-sm cursor-pointer">
                        Glucose Insights & Reports
                      </label>
                    </div>
                  </div>
                </div>

                <Button className="mt-6 w-full bg-emerald-500 text-white hover:bg-emerald-600 rounded-lg">
                  Save Preferences
                </Button>
              </Card>
            </>
          )}

          {/* Household Tab */}
          {activeTab === 'household' && (
            <>
              <h2 className="text-lg font-semibold">Household Members</h2>
              <p className="text-sm text-slate-600">Manage family members who can view your health data and receive alerts.</p>

              <Card className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="space-y-4">
                  {householdMembers.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-medium text-slate-900">Current Members</h3>
                      {householdMembers.map((member, idx) => (
                        <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className="text-sm text-slate-900">{member}</p>
                          <button className="text-xs text-rose-600 hover:text-rose-700 font-medium">Remove</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-3 pt-4 border-t border-slate-200">
                    <h3 className="font-medium text-slate-900">Add New Member</h3>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="family@example.com"
                        className="rounded-lg"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="relationship" className="text-sm">Relationship</Label>
                      <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <option>Spouse</option>
                        <option>Parent</option>
                        <option>Child</option>
                        <option>Sibling</option>
                        <option>Caregiver</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Permissions</Label>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id="perm-view" defaultChecked className="h-4 w-4 rounded accent-emerald-600" />
                          <label htmlFor="perm-view" className="text-sm cursor-pointer">View health data</label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id="perm-alerts" defaultChecked className="h-4 w-4 rounded accent-emerald-600" />
                          <label htmlFor="perm-alerts" className="text-sm cursor-pointer">Receive alerts for critical readings</label>
                        </div>
                      </div>
                    </div>

                    <Button className="w-full bg-emerald-500 text-white hover:bg-emerald-600 rounded-lg">
                      Send Invite
                    </Button>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
