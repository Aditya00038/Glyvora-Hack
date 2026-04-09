"use client";

import { useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser } from '@/firebase';
import { Users, Save } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useUser();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [theme, setTheme] = useState('light');
  const [language, setLanguage] = useState('en');
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async () => {
    setSaving(true);
    // TODO: Implement profile update logic
    setTimeout(() => setSaving(false), 1000);
  };

  return (
    <div className="min-h-screen bg-[#F5F3F0] text-slate-900 pb-10 lg:ml-48 xl:ml-52">
      <Navigation />
      <main className="mx-auto max-w-4xl px-4 pt-4 lg:pt-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Users className="h-6 w-6 text-emerald-600" />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Profile Settings</h1>
            <p className="mt-1 text-sm text-slate-500">Manage your account preferences and personal details.</p>
          </div>
        </div>

        {/* Profile Card */}
        <Card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold mb-6">Account Information</h2>

          <div className="space-y-5">
            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-sm font-medium">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your name"
                className="rounded-lg"
              />
            </div>

            {/* Email (Read-only) */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                value={user?.email || ''}
                disabled
                className="rounded-lg bg-slate-100 text-slate-500"
              />
              <p className="text-xs text-slate-500">Email cannot be changed</p>
            </div>

            {/* Theme Selection */}
            <div className="space-y-2">
              <Label htmlFor="theme" className="text-sm font-medium">Theme</Label>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="auto">Auto (System)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Language Selection */}
            <div className="space-y-2">
              <Label htmlFor="language" className="text-sm font-medium">Preferred Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                  <SelectItem value="hi">Hindi</SelectItem>
                  <SelectItem value="pt">Portuguese</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">Uses Google Translate API for multilanguage support</p>
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <Button onClick={handleSaveProfile} disabled={saving} className="bg-emerald-500 text-white hover:bg-emerald-600 rounded-lg inline-flex items-center gap-2">
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </Card>

        {/* Password Card */}
        <Card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-6">Change Password</h2>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="text-sm font-medium">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                placeholder="Enter current password"
                className="rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-sm font-medium">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Enter new password"
                className="rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                className="rounded-lg"
              />
            </div>
          </div>

          <Button className="mt-6 bg-emerald-500 text-white hover:bg-emerald-600 rounded-lg">
            Update Password
          </Button>
        </Card>
      </main>
    </div>
  );
}
