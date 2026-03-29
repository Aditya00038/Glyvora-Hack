"use client";

import { useState, useEffect, useRef } from 'react';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { 
  User, Shield, LogOut, Activity, Target, Camera, Pencil, Check, X, Loader2,
  Heart, Link as LinkIcon, ImageIcon, Upload, FileText, Apple
} from 'lucide-react';
import { useUser, useFirestore, useFirebase } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

export default function ProfilePage() {
  const { user, isUserLoading } = useUser();
  const { firestore, auth, storage } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isPhotoDialogOpen, setIsPhotoDialogOpen] = useState(false);

  // Core Metabolic Settings
  const [sensitivity, setSensitivity] = useState('medium');
  const [dietaryPreference, setDietaryPreference] = useState('standard');
  const [targetGlucose, setTargetGlucose] = useState('110');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      if (user && firestore) {
        const docRef = doc(firestore, 'users', user.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setSensitivity(data.sensitivitySetting || 'medium');
          setDietaryPreference(data.dietaryPreference || 'standard');
          setTargetGlucose(data.targetGlucose ? data.targetGlucose.toString() : '110');
        }
        setNewName(user.displayName || '');
        setLoading(false);
      } else if (!isUserLoading && !user) {
        router.push('/login');
      }
    }
    fetchProfile();
  }, [user, firestore, isUserLoading, router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
    toast({ title: 'Logged Out', description: 'See you again soon!' });
  };

  const handleSaveName = async () => {
    if (!user || !auth.currentUser) return;
    setIsSavingName(true);
    try {
      await updateProfile(auth.currentUser, { displayName: newName });
      await setDoc(doc(firestore, 'users', user.uid), {
        firstName: newName.split(' ')[0], updatedAt: new Date().toISOString(),
      }, { merge: true });
      toast({ title: 'Name Updated', description: 'Saved successfully.' });
      setIsEditingName(false);
    } catch {
      toast({ variant: 'destructive', title: 'Update Failed' });
    } finally {
      setIsSavingName(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !auth.currentUser || !storage) return;
    setIsUploadingImage(true);
    try {
      const storageRef = ref(storage, `users/${user.uid}/profile-picture`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      await updateProfile(auth.currentUser, { photoURL: downloadURL });
      await setDoc(doc(firestore, 'users', user.uid), {
        photoURL: downloadURL, updatedAt: new Date().toISOString(),
      }, { merge: true });
      toast({ title: 'Image Uploaded' });
      setIsPhotoDialogOpen(false);
    } catch {
      toast({ variant: 'destructive', title: 'Upload Failed' });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const saveSettings = async () => {
    if (!user || !firestore) return;
    setIsSavingSettings(true);
    try {
      await setDoc(doc(firestore, 'users', user.uid), {
        sensitivitySetting: sensitivity,
        dietaryPreference: dietaryPreference,
        targetGlucose: parseInt(targetGlucose) || 110,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      toast({ title: 'Settings Saved', description: 'Metabolic profile updated gracefully.' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to save settings' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  if (isUserLoading || loading) return <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-4"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background text-foreground pt-20 pb-20">
      <Navigation />
      
      <main className="max-w-4xl mx-auto px-4 py-8 lg:py-12 space-y-8">
        <header className="relative p-6 lg:p-8 rounded-3xl bg-card border border-border flex flex-col md:flex-row items-center gap-6 shadow-sm">
            <Dialog open={isPhotoDialogOpen} onOpenChange={setIsPhotoDialogOpen}>
              <div className="relative group/avatar">
                <Avatar className="w-20 h-20 border border-primary/20 shadow-xl overflow-hidden bg-secondary">
                  <AvatarImage src={user?.photoURL || `https://picsum.photos/seed/${user?.uid}/200/200`} className="object-cover" />
                  <AvatarFallback className="text-2xl font-black bg-primary/10 text-primary">{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <DialogTrigger asChild>
                  <button className="absolute inset-x-0 -bottom-3 bg-card border border-border shadow-sm mx-auto h-6 w-16 rounded-full flex flex-row items-center justify-center gap-1 cursor-pointer hover:bg-secondary transition-colors md:opacity-0 md:group-hover/avatar:opacity-100 opacity-100 z-10">
                    <Camera className="w-3 h-3 text-foreground" /> <span className="text-[9px] text-foreground font-bold tracking-widest">EDIT</span>
                  </button>
                </DialogTrigger>
              </div>

              <DialogContent className="bg-card border-border text-foreground rounded-2xl">
                <DialogHeader><DialogTitle className="text-xl font-bold tracking-tight">Update Photo</DialogTitle></DialogHeader>
                <div className="space-y-6 py-4">
                  <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="w-full h-14 border-dashed border-2 border-border bg-secondary/50 text-foreground hover:bg-secondary">
                    {isUploadingImage ? <Loader2 className="mr-3 w-4 h-4 animate-spin" /> : <Upload className="mr-3 w-4 h-4" />}
                    <span className="text-xs font-bold uppercase">{isUploadingImage ? 'Uploading...' : 'Select Image'}</span>
                  </Button>
                  <input type="file" className="hidden" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} />
                </div>
              </DialogContent>
            </Dialog>

            <div className="text-center md:text-left space-y-1 flex-1 md:mt-0 mt-4">
              <div className="flex items-center justify-center md:justify-start gap-2">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="h-9 bg-background border-border text-lg font-bold w-48" />
                    <Button size="icon" variant="ghost" onClick={handleSaveName}>{isSavingName ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4" />}</Button>
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold tracking-tight">{user?.displayName || 'Hero'}</h1>
                    <button onClick={() => setIsEditingName(true)} className="text-muted-foreground hover:text-emerald-500 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                  </>
                )}
              </div>
              <p className="text-muted-foreground text-sm font-medium">{user?.email}</p>
            </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-8">
            
            {/* Core Settings */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2 text-foreground"><Target className="w-5 h-5 text-emerald-500" /> Metabolic Settings</h2>
                <Button onClick={saveSettings} disabled={isSavingSettings} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl h-9 text-xs font-semibold shadow-sm">
                  {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Profile'}
                </Button>
              </div>
              
              <Card className="p-6 md:p-8 rounded-3xl border-border bg-card space-y-12 shadow-sm">
                
                <div className="space-y-4">
                   <div>
                     <Label className="text-base font-bold text-foreground mb-1 block">Insulin Sensitivity</Label>
                     <p className="text-sm text-muted-foreground mb-4 font-medium">How aggressively your glucose spikes from carbohydrates.</p>
                   </div>
                   <RadioGroup value={sensitivity} onValueChange={setSensitivity} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                     {[
                       { value: 'low', label: 'Resilient', desc: 'Slow response' },
                       { value: 'medium', label: 'Standard', desc: 'Typical baseline' },
                       { value: 'high', label: 'Sensitive', desc: 'Sharp spikes' }
                     ].map((opt) => (
                       <div key={opt.value} onClick={() => setSensitivity(opt.value)} className={cn("p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-center", sensitivity === opt.value ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-secondary/30 hover:bg-secondary/60')}>
                         <p className={cn("text-sm font-bold text-center", sensitivity === opt.value ? 'text-primary' : 'text-foreground')}>{opt.label}</p>
                         <p className="text-xs text-muted-foreground mt-1 text-center font-medium">{opt.desc}</p>
                       </div>
                     ))}
                   </RadioGroup>
                </div>

                <div className="space-y-4">
                   <div>
                     <Label className="text-base font-bold text-foreground mb-1 block">Baseline Diet</Label>
                     <p className="text-sm text-muted-foreground mb-4 font-medium">Used by the AI Coach to suggest personalized meal replacements.</p>
                   </div>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                     {[
                       { id: 'standard', name: 'Standard Omni' },
                       { id: 'vegetarian', name: 'Vegetarian' },
                       { id: 'keto', name: 'Ketogenic' },
                       { id: 'mediterranean', name: 'Mediterranean' },
                     ].map(diet => (
                       <button key={diet.id} onClick={() => setDietaryPreference(diet.id)} className={cn("h-14 rounded-xl border text-sm font-bold transition-all", dietaryPreference === diet.id ? "bg-primary/10 border-primary text-primary shadow-sm" : "bg-card border-border text-muted-foreground hover:bg-secondary")}>
                         {diet.name}
                       </button>
                     ))}
                   </div>
                </div>

                <div className="space-y-4">
                   <div>
                     <Label className="text-base font-bold text-foreground mb-1 block">Target Post-Meal Range (mg/dL)</Label>
                     <p className="text-sm text-muted-foreground mb-4 font-medium">The threshold goal the AI applies to meal plans.</p>
                   </div>
                   <Input type="number" value={targetGlucose} onChange={e=>setTargetGlucose(e.target.value)} className="h-12 bg-background border-border text-lg font-bold w-full md:w-48 appearance-none shadow-sm rounded-xl focus-visible:ring-emerald-500" placeholder="110" />
                </div>

              </Card>
            </section>
          </div>

          <div className="space-y-6">
            <Card className="p-6 rounded-3xl border-border bg-card shadow-sm text-center">
               <Apple className="w-10 h-10 text-emerald-500 mx-auto mb-4 opacity-30" />
               <h3 className="font-bold text-foreground mb-2">Algorithm Ready</h3>
               <p className="text-xs text-muted-foreground leading-relaxed font-medium">Your metabolic settings are securely synced with the AI decision engine in real-time.</p>
            </Card>

            <Button onClick={handleLogout} variant="outline" className="w-full py-6 rounded-2xl border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all font-bold tracking-widest uppercase text-xs shadow-sm">
              <LogOut className="mr-2 w-4 h-4" /> Sign Out
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
