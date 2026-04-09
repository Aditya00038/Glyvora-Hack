"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Heart, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase';
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: 'Welcome back!', description: 'You are signed in.' });
      router.push('/dashboard');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Login failed',
        description: error.message || 'Invalid credentials.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      toast({ title: 'Welcome to GLYVORA!', description: 'Google sign-in completed.' });
      router.push('/dashboard');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Google sign-in failed',
        description: error.message || 'Could not sign in with Google.',
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F3F0] via-[#FBFAF8] to-[#F6F2EC] px-4 py-8 flex items-center justify-center">
      <Link href="/" className="absolute left-6 top-6 flex items-center gap-2 text-slate-500 transition-colors hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Back Home
      </Link>

      <Card className="w-full max-w-[520px] rounded-[28px] border border-slate-200 bg-white/95 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-md">
            <Heart className="h-7 w-7 text-white" fill="currentColor" />
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Log in to your GLYVORA account</h1>
          <p className="mt-3 text-sm text-slate-600">Enter your email and password below to continue.</p>
        </div>

        <div className="mt-8 space-y-5">
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="h-12 w-full rounded-xl border-slate-200 bg-white text-slate-900 shadow-sm hover:bg-slate-50"
          >
            {googleLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <span className="mr-3 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[14px] font-semibold leading-none text-[#4285F4] shadow-sm ring-1 ring-slate-200">
                G
              </span>
            )}
            Continue with Google
          </Button>

          <div className="flex items-center gap-3 text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-sm font-medium uppercase tracking-[0.2em]">or</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-800">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="password" className="text-slate-800">
                  Password
                </Label>
                <Link href="#" className="text-sm text-slate-700 underline-offset-4 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <label className="flex items-center gap-3 text-sm font-medium text-slate-800">
              <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500" />
              Remember me
            </label>

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-xl bg-emerald-500 text-base font-semibold text-white shadow-[0_12px_35px_rgba(16,185,129,0.35)] hover:bg-emerald-600"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Log in
            </Button>
          </form>

          <p className="text-center text-sm text-slate-600">
            Don’t have an account?{' '}
            <Link href="/register" className="font-semibold text-slate-900 underline-offset-4 hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
