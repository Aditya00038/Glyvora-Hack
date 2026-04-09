"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Heart, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
      });
      return;
    }

    if (!acceptTerms) {
      toast({
        variant: "destructive",
        title: "Terms required",
        description: "Please accept the Terms of Service and Privacy Policy.",
      });
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      await updateProfile(user, { displayName: name });
      
      // Initialize User Profile in Firestore
      await setDoc(doc(firestore, 'users', user.uid), {
        id: user.uid,
        email: email,
        phoneNumber: phone,
        smsEnabled: Boolean(phone),
        glucoseLowThreshold: 70,
        glucoseHighThreshold: 140,
        firstName: name.split(' ')[0],
        lastName: name.split(' ').slice(1).join(' '),
        displayName: name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      if (phone) {
        await fetch('/api/notifications/welcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: phone, name }),
        });
      }

      toast({ title: "Account created!", description: "Welcome to GLYVORA!" });
      router.push('/onboarding');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: error.message || "Could not create account.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F3F0] to-[#FAF9F7] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="p-8 rounded-2xl bg-white border border-slate-200 shadow-lg">
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-md">
              <Heart className="text-white w-7 h-7" fill="currentColor" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Create an account</h1>
            <p className="text-center text-slate-600">Enter your details below to create your account</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-700 font-medium">Full name</Label>
              <Input 
                id="name" 
                type="text" 
                placeholder="Jane Doe" 
                required 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-slate-50 border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700 font-medium">Email address</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="email@example.com" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-50 border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-slate-700 font-medium">Phone number</Label>
              <Input 
                id="phone" 
                type="tel" 
                placeholder="+91 98765 43210" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-slate-50 border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-50 border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400"
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-700 font-medium">Confirm password</Label>
              <Input 
                id="confirmPassword" 
                type="password" 
                required 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-slate-50 border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-start gap-3 py-2">
              <input 
                type="checkbox" 
                id="terms" 
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-emerald-500 mt-0.5 cursor-pointer"
              />
              <Label htmlFor="terms" className="text-sm text-slate-600 cursor-pointer">
                I understand that GLYVORA and its AI health coach provide wellness guidance, not medical advice. I am at least 18 years old and accept the{" "}
                <a href="#" className="text-emerald-600 font-medium hover:underline">Terms of Service</a>
                {" "}and{" "}
                <a href="#" className="text-emerald-600 font-medium hover:underline">Privacy Policy</a>
              </Label>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg py-6 font-bold text-base transition-colors"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Create account"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link href="/login" className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors">
              Log in
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}