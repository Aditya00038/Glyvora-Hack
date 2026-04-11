"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Heart, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth, useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface ProfileData {
  age: number | '';
  gender: string;
  height: string;
  weight: string;
  activityLevel: string;
  healthGoal: string[];
  dietaryPreference: string;
  region: string;
  foodAllergies: string;
  mealTiming: string;
  medicalConditions: string;
}

const steps = [
  { id: 'age', title: 'What\'s your age?', description: 'This helps us personalize your metabolic profile' },
  { id: 'gender', title: 'What\'s your gender?', description: 'This helps us provide better health insights' },
  { id: 'height', title: 'What\'s your height?', description: 'Enter in centimeters - we\'ll use this to calculate your BMI' },
  { id: 'weight', title: 'What\'s your weight?', description: 'Enter in kilograms - helps us track your progress' },
  { id: 'activityLevel', title: 'What\'s your activity level?', description: 'This helps us calculate your calorie needs' },
  { id: 'healthGoal', title: 'What are your health goals?', description: 'Select all that apply to you' },
  { id: 'dietaryPreference', title: 'What\'s your dietary preference?', description: 'Help us suggest appropriate meal plans' },
  { id: 'region', title: 'What region is your food from?', description: 'We use this to personalise your meal plans with regional cuisine' },
  { id: 'foodAllergies', title: 'Do you have any food allergies or restrictions?', description: 'Keep your meals safe and enjoyable' },
  { id: 'mealTiming', title: 'What\'s your typical meal timing?', description: 'This helps us customize your meal plan' },
  { id: 'medicalConditions', title: 'Do you have any medical conditions?', description: 'Especially important if you have diabetes' },
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<ProfileData>({
    age: '',
    gender: '',
    height: '',
    weight: '',
    activityLevel: '',
    healthGoal: [],
    dietaryPreference: '',
    region: '',
    foodAllergies: '',
    mealTiming: '',
    medicalConditions: '',
  });
  const [loading, setLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleNext = () => {
    const step = steps[currentStep].id;
    
    // Validation
    if (step === 'age' && (!data.age || data.age < 13 || data.age > 120)) {
      toast({ variant: "destructive", title: "Invalid age", description: "Please enter a valid age between 13 and 120" });
      return;
    }
    if (step === 'gender' && !data.gender) {
      toast({ variant: "destructive", title: "Please select", description: "Select your gender to continue" });
      return;
    }
    if (step === 'height' && (!data.height || Number(data.height) < 100 || Number(data.height) > 250)) {
      toast({ variant: "destructive", title: "Invalid height", description: "Please enter height between 100-250 cm" });
      return;
    }
    if (step === 'weight' && (!data.weight || Number(data.weight) < 30 || Number(data.weight) > 200)) {
      toast({ variant: "destructive", title: "Invalid weight", description: "Please enter weight between 30-200 kg" });
      return;
    }
    if (step === 'activityLevel' && !data.activityLevel) {
      toast({ variant: "destructive", title: "Please select", description: "Select your activity level to continue" });
      return;
    }
    if (step === 'healthGoal' && data.healthGoal.length === 0) {
      toast({ variant: "destructive", title: "Please select", description: "Select at least one health goal to continue" });
      return;
    }
    if (step === 'dietaryPreference' && !data.dietaryPreference) {
      toast({ variant: "destructive", title: "Please select", description: "Select your dietary preference to continue" });
      return;
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not found');
      }

      const profileData = {
        age: Number(data.age),
        gender: data.gender,
        height: data.height,
        weight: data.weight,
        activityLevel: data.activityLevel,
        healthGoals: data.healthGoal,
        dietaryPreference: data.dietaryPreference,
        region: data.region || 'Other',
        foodAllergies: data.foodAllergies || 'None',
        mealTiming: data.mealTiming || 'Standard (3 meals)',
        medicalConditions: data.medicalConditions || 'None',
        profileCompletedAt: new Date().toISOString(),
      };

      await updateDoc(doc(firestore, 'users', user.uid), profileData);

      toast({ title: "Profile complete!", description: "Welcome to your personalized health journey!" });
      router.push('/dashboard');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save profile",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleHealthGoal = (goal: string) => {
    setData(prev => ({
      ...prev,
      healthGoal: prev.healthGoal.includes(goal)
        ? prev.healthGoal.filter(g => g !== goal)
        : [...prev.healthGoal, goal]
    }));
  };

  if (!isClient) return null;

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F3F0] to-[#FAF9F7] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-700">Step {currentStep + 1} of {steps.length}</h2>
            <span className="text-sm text-slate-600">{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <Card className="p-8 rounded-2xl bg-white border border-slate-200 shadow-lg">
          {/* Header */}
          <div className="flex flex-col items-center gap-2 mb-8">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-md">
              <Heart className="text-white w-6 h-6" fill="currentColor" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 text-center">{step.title}</h1>
            <p className="text-center text-slate-600">{step.description}</p>
          </div>

          {/* Content */}
          <div className="mb-8">
            {step.id === 'age' && (
              <div className="space-y-4">
                <Input 
                  type="number" 
                  min="13" 
                  max="120"
                  placeholder="Enter your age" 
                  value={data.age}
                  onChange={(e) => setData({ ...data, age: e.target.value ? Number(e.target.value) : '' })}
                  className="bg-slate-50 border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 text-lg py-3"
                  autoFocus
                />
              </div>
            )}

            {step.id === 'gender' && (
              <div className="space-y-3">
                {['Male', 'Female', 'Other'].map(option => (
                  <button
                    key={option}
                    onClick={() => setData({ ...data, gender: option })}
                    className={`w-full p-4 rounded-lg border-2 transition-colors text-left font-medium ${
                      data.gender === option
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                        : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {step.id === 'height' && (
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Input 
                      type="number" 
                      min="100" 
                      max="250"
                      placeholder="e.g., 170" 
                      value={data.height}
                      onChange={(e) => setData({ ...data, height: e.target.value })}
                      className="bg-slate-50 border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400"
                      autoFocus
                    />
                  </div>
                  <div className="flex items-center px-4 bg-slate-50 rounded-lg border border-slate-300 font-medium text-slate-700">
                    cm
                  </div>
                </div>
                <p className="text-xs text-slate-500">Typical range: 140-220 cm</p>
              </div>
            )}

            {step.id === 'weight' && (
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Input 
                      type="number" 
                      min="30" 
                      max="200"
                      placeholder="e.g., 65" 
                      value={data.weight}
                      onChange={(e) => setData({ ...data, weight: e.target.value })}
                      className="bg-slate-50 border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400"
                      autoFocus
                    />
                  </div>
                  <div className="flex items-center px-4 bg-slate-50 rounded-lg border border-slate-300 font-medium text-slate-700">
                    kg
                  </div>
                </div>
                <p className="text-xs text-slate-500">Typical range: 40-150 kg</p>
              </div>
            )}

            {step.id === 'activityLevel' && (
              <div className="space-y-3">
                {[
                  { value: 'low', label: 'Low', description: 'Sedentary, little to no exercise' },
                  { value: 'moderate', label: 'Moderate', description: 'Exercise 3-5 days per week' },
                  { value: 'high', label: 'High', description: 'Exercise 6-7 days per week or intense workouts' }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setData({ ...data, activityLevel: option.value })}
                    className={`w-full p-4 rounded-lg border-2 transition-colors text-left ${
                      data.activityLevel === option.value
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className={`font-medium ${data.activityLevel === option.value ? 'text-emerald-900' : 'text-slate-900'}`}>{option.label}</div>
                    <div className="text-sm text-slate-600">{option.description}</div>
                  </button>
                ))}
              </div>
            )}

            {step.id === 'healthGoal' && (
              <div className="space-y-3">
                {[
                  'Weight loss', 'Muscle gain', 'Diabetes control', 'General health', 'Energy boost', 'Better digestion'
                ].map(goal => (
                  <button
                    key={goal}
                    onClick={() => toggleHealthGoal(goal)}
                    className={`w-full p-4 rounded-lg border-2 transition-colors text-left font-medium ${
                      data.healthGoal.includes(goal)
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                        : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{goal}</span>
                      {data.healthGoal.includes(goal) && <span className="text-emerald-600">✓</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {step.id === 'dietaryPreference' && (
              <div className="space-y-3">
                {[
                  'Non-vegetarian',
                  'Vegetarian',
                  'Vegan',
                  'Keto',
                  'Gluten-free',
                  'No preference'
                ].map(option => (
                  <button
                    key={option}
                    onClick={() => setData({ ...data, dietaryPreference: option })}
                    className={`w-full p-4 rounded-lg border-2 transition-colors text-left font-medium ${
                      data.dietaryPreference === option
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                        : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {step.id === 'region' && (
              <div className="grid grid-cols-2 gap-3">
                {['Maharashtrian', 'South Indian', 'North Indian', 'Bengali', 'Gujarati', 'Other'].map(region => (
                  <button
                    key={region}
                    onClick={() => setData(p => ({...p, region}))}
                    className={`p-4 rounded-lg border-2 transition-colors text-left font-medium ${
                      data.region === region
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                        : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300'
                    }`}
                  >
                    {region}
                  </button>
                ))}
              </div>
            )}

            {step.id === 'foodAllergies' && (
              <div className="space-y-4">
                <Input 
                  placeholder="e.g., Peanuts, Dairy, Shellfish (or leave empty if none)" 
                  value={data.foodAllergies}
                  onChange={(e) => setData({ ...data, foodAllergies: e.target.value })}
                  className="bg-slate-50 border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 py-3"
                />
                <p className="text-sm text-slate-600">Leave empty if you have no food allergies</p>
              </div>
            )}

            {step.id === 'mealTiming' && (
              <div className="space-y-3">
                {[
                  'Standard (Breakfast, Lunch, Dinner)',
                  'Intermediate (2 large meals)',
                  'Frequent (5-6 small meals)',
                  'Flexible'
                ].map(option => (
                  <button
                    key={option}
                    onClick={() => setData({ ...data, mealTiming: option })}
                    className={`w-full p-4 rounded-lg border-2 transition-colors text-left font-medium ${
                      data.mealTiming === option
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                        : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {step.id === 'medicalConditions' && (
              <div className="space-y-4">
                <Input 
                  placeholder="e.g., Diabetes, Hypertension, PCOS (or leave empty if none)" 
                  value={data.medicalConditions}
                  onChange={(e) => setData({ ...data, medicalConditions: e.target.value })}
                  className="bg-slate-50 border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 py-3"
                />
                <p className="text-sm text-slate-600">This helps us personalize your health guidance. Leave empty if none.</p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-4">
            <Button 
              onClick={handlePrev}
              variant="outline"
              className="px-6 py-2 rounded-lg border-slate-300 text-slate-700 hover:bg-slate-100"
              disabled={currentStep === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-2" /> Back
            </Button>

            <div className="text-sm text-slate-600">
              {currentStep + 1} / {steps.length}
            </div>

            <Button 
              onClick={handleNext}
              className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {currentStep === steps.length - 1 ? 'Complete' : 'Next'} 
              {!loading && currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4 ml-2" />}
            </Button>
          </div>
        </Card>

        {/* Summary Preview Hint */}
        {currentStep === steps.length - 1 && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Next step:</strong> After completing this, you'll see a summary of your profile and can start your personalized health journey with GLYVORA!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
