"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Zap, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: "Welcome back!", description: "Logged in successfully." });
      router.push('/dashboard');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message || "Invalid credentials.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <Link href="/" className="absolute top-8 left-8 text-slate-400 hover:text-white flex items-center gap-2">
        <ArrowLeft className="w-4 h-4" /> Back Home
      </Link>
      
      <Card className="w-full max-w-md p-8 rounded-3xl bg-slate-900 border-slate-800 shadow-2xl">
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center">
            <Zap className="text-white w-6 h-6" fill="currentColor" />
          </div>
          <h1 className="text-2xl font-bold">Welcome back to Glyvora</h1>
          <p className="text-sm text-slate-400">Continue your metabolic journey</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="name@example.com" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-950 border-slate-800 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input 
              id="password" 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-slate-950 border-slate-800 rounded-xl"
            />
          </div>
          <Button 
            type="submit" 
            className="w-full bg-emerald-500 hover:bg-emerald-600 rounded-xl py-6 font-bold"
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Sign In"}
          </Button>
        </form>

        <div className="mt-8 text-center text-sm text-slate-400">
          Don't have an account?{" "}
          <Link href="/register" className="text-emerald-500 font-bold hover:underline">
            Register now
          </Link>
        </div>
      </Card>
    </div>
  );
}