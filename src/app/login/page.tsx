"use client";

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2 } from 'lucide-react';
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
          <div className="relative mb-6 h-14 w-14 overflow-hidden rounded-full shadow-md">
            <Image src="/Glyvora-icon.png" alt="Glyvora logo" fill className="object-cover" sizes="56px" priority />
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
              <span className="mr-3 inline-flex h-5 w-5 items-center justify-center">
                <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.2 0 6.1 1.1 8.3 3.2l6.2-6.2C34.8 3.1 29.7 1 24 1 14.6 1 6.5 6.4 2.6 14.3l7.9 6.1C12.2 14.1 17.7 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.5 24.5c0-1.7-.1-3.3-.4-4.9H24v9.3h12.7c-.6 3-2.3 5.5-4.9 7.2l7.6 5.9c4.4-4.1 7.1-10.1 7.1-17.5z" />
                  <path fill="#FBBC05" d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6 0-1.6.3-3.1.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.6 10.7l7.9-6.1z" />
                  <path fill="#34A853" d="M24 47c6.5 0 12-2.2 16-5.9l-7.6-5.9c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.8-4.6-13.7-10.8l-7.9 6.1C6.5 41.6 14.6 47 24 47z" />
                </svg>
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
