"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';
import { Search, TrendingUp, Clock3, AlertCircle, CheckCircle2, AlertTriangle, Zap, Upload, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import foodDatabase from '@/lib/db/indian-foods.json';
import {
  getGlucosePredictorInstance,
  initializeGlucosePredictor,
  type FoodItem,
  type UserProfile,
  type PredictionResult,
} from '@/lib/ml/glucose-predictor';

interface SimulatorState {
  selectedFood: FoodItem | null;
  portionSize: number;
  prediction: PredictionResult | null;
  loading: boolean;
  searchOpen: boolean;
  learningStats: { dataPoints: number; confidence: string } | null;
}

interface GlucoseTrendPoint {
  time: number;
  glucose: number;
  label: string;
}

const riskColors = {
  Safe: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100' },
  Moderate: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100' },
  Risk: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100' },
};

const riskEmojis = {
  Safe: '🟢',
  Moderate: '🟡',
  Risk: '🔴',
};

export function MetabolicSimulator({ userProfile }: { userProfile: UserProfile }) {
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<SimulatorState>({
    selectedFood: null,
    portionSize: 0,
    prediction: null,
    loading: false,
    searchOpen: false,
    learningStats: null,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const [swapResult, setSwapResult] = useState<any | null>(null);
  const [loadingSwap, setLoadingSwap] = useState(false);

  const handleGetSwap = async () => {
    if (!state.selectedFood || !state.prediction) return;
    setLoadingSwap(true);
    const res = await fetch('/api/suggest-swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mealName: state.selectedFood.name,
        detectedItems: [state.selectedFood.category],
        predictedSpike: state.prediction.predictedSpike,
        userSensitivity: state.prediction.riskLevel === 'Risk' ? 'high' : 'medium',
      }),
    });
    const data = await res.json();
    setSwapResult(data);
    setLoadingSwap(false);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const raw = String(reader.result || '');
        resolve(raw.split(',')[1] || '');
      };
      reader.onerror = () => reject(new Error('Failed to read selected image.'));
      reader.readAsDataURL(file);
    });
  };

  const analyzePhoto = async (file: File) => {
    setIsAnalyzingPhoto(true);
    try {
      const base64 = await fileToBase64(file);
      const response = await fetch('/api/food/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl: `data:image/jpeg;base64,${base64}`,
          contentType: file.type || 'image/jpeg',
        }),
      });

      const data = await response.json();
      const dishName = String(data?.dishName || data?.text || '').trim();
      if (!response.ok || !dishName) {
        throw new Error(data?.error || 'Could not identify the dish in this image.');
      }

      setSearchQuery(dishName);
      setState((prev) => ({ ...prev, searchOpen: true }));
    } catch (error) {
      console.error('Food photo analysis failed:', error);
    } finally {
      setIsAnalyzingPhoto(false);
    }
  };

  // Initialize ML predictor
  useEffect(() => {
    const init = async () => {
      try {
        await initializeGlucosePredictor(userProfile);
        setInitialized(true);
      } catch (error) {
        console.error('Failed to initialize predictor:', error);
      }
    };
    init();
  }, [userProfile]);

  // Generate prediction when food/portion changes
  useEffect(() => {
    if (!state.selectedFood || !initialized) return;

    const predict = async () => {
      setState((prev) => ({ ...prev, loading: true }));
      try {
        const predictor = getGlucosePredictorInstance();
        if (!predictor) throw new Error('Predictor not initialized');

        // Build food item with adjusted portion size
        const adjustedFood: FoodItem = {
          ...state.selectedFood!,
          portionSize: state.portionSize, // Set runtime portion size
        };

        const prediction = await predictor.predictSpike(adjustedFood, userProfile);
        const stats = predictor.getLearnedFoodStatus(state.selectedFood!.name);

        setState((prev) => ({
          ...prev,
          prediction,
          learningStats: stats,
          loading: false,
        }));
      } catch (error) {
        console.error('Prediction error:', error);
        setState((prev) => ({ ...prev, loading: false }));
      }
    };

    const timer = setTimeout(predict, 300); // Debounce
    return () => clearTimeout(timer);
  }, [state.selectedFood, state.portionSize, initialized, userProfile]);

  // Generate glucose trend visualization
  const glucoseTrend = useMemo(() => {
    if (!state.prediction) return [];

    const baseline = userProfile.baselineGlucose;
    const timeToPeak = state.prediction.timeToPeak;
    const spike = state.prediction.predictedSpike;

    const points: GlucoseTrendPoint[] = [
      { time: 0, glucose: baseline, label: '0 min' },
      { time: Math.floor(timeToPeak * 0.5), glucose: baseline + spike * 0.6, label: `${Math.floor(timeToPeak * 0.5)} min` },
      { time: timeToPeak, glucose: baseline + spike, label: `Peak (${timeToPeak} min)` },
      { time: Math.floor(timeToPeak * 1.5), glucose: baseline + spike * 0.4, label: `${Math.floor(timeToPeak * 1.5)} min` },
      { time: timeToPeak * 2, glucose: baseline + spike * 0.1, label: `${Math.floor(timeToPeak * 2)} min` },
    ];

    return points;
  }, [state.prediction, userProfile.baselineGlucose]);

  const filteredFoods = useMemo(() => {
    const currentDiet = userProfile.dietaryPreference?.toLowerCase() || 'no preference';
    
    return (foodDatabase.foods as FoodItem[]).filter((food) => {
      // Enforce dietary constraints
      if (currentDiet === 'vegetarian') {
        if (food.dietType === 'non-vegetarian' || food.dietType === 'eggetarian') return false;
      } else if (currentDiet === 'vegan') {
        if (food.dietType !== 'vegan') return false;
      }

      return (
        food.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        food.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [searchQuery, userProfile.dietaryPreference]);

  const handleSelectFood = (food: FoodItem) => {
    setState((prev) => ({
      ...prev,
      selectedFood: food,
      portionSize: food.defaultPortion, // Use defaultPortion
      searchOpen: false,
    }));
    setSearchQuery('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">🧬 Metabolic Simulator</h2>
        <p className="text-sm text-slate-500 mt-1">Predict your glucose response before eating</p>
      </div>

      {/* Main Card with Glassmorphism */}
      <Card className="relative overflow-hidden border border-white/20 bg-gradient-to-br from-white/90 to-blue-50/50 backdrop-blur-xl shadow-2xl rounded-3xl">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-400/5 via-transparent to-emerald-400/5 pointer-events-none" />

        <div className="relative z-10 p-8 space-y-6">
          {/* Food Selection Section */}
          <motion.div className="space-y-4">
            <label className="block text-sm font-semibold text-slate-700">Select Food Item</label>

            <div className="relative">
              <button
                onClick={() => setState((prev) => ({ ...prev, searchOpen: !prev.searchOpen }))}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-slate-200 hover:border-blue-300 bg-white/60 hover:bg-white/80 transition-all"
              >
                <Search className="w-4 h-4 text-slate-400" />
                <span className="flex-1 text-left text-slate-600">
                  {state.selectedFood ? state.selectedFood.name : 'Search 250+ Indian foods...'}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${state.searchOpen ? 'rotate-180' : ''}`} />
              </button>

              <div className="mt-3 flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={isAnalyzingPhoto}
                >
                  {isAnalyzingPhoto ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Upload Food Photo
                </Button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.currentTarget.files?.[0];
                    if (file) {
                      await analyzePhoto(file);
                    }
                    e.currentTarget.value = '';
                  }}
                />
              </div>

              {/* Search Dropdown */}
              <AnimatePresence>
                {state.searchOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full mt-2 w-full z-20 rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden"
                  >
                    <Input
                      placeholder="Search by food name or category..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="border-b border-slate-200 rounded-none px-4 py-3 text-sm"
                    />
                    <div className="max-h-64 overflow-y-auto">
                      {filteredFoods.map((food) => (
                        <motion.button
                          key={food.id}
                          onClick={() => handleSelectFood(food)}
                          whileHover={{ backgroundColor: '#f0fdf4' }}
                          className="w-full px-4 py-3 text-left hover:bg-emerald-50 transition-colors border-b border-slate-100 last:border-0"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-slate-900">{food.name}</p>
                              <p className="text-xs text-slate-500">{food.region} • GI: {food.glycemicIndex}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {food.category}
                            </Badge>
                          </div>
                        </motion.button>
                      ))}
                      {filteredFoods.length === 0 && (
                        <div className="px-4 py-8 text-center text-slate-500">No foods found</div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {state.selectedFood && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200"
              >
                <div className="text-sm">
                  <p className="text-slate-500">Glycemic Index</p>
                  <p className="font-semibold text-slate-900">{state.selectedFood.glycemicIndex}</p>
                </div>
                <div className="text-sm">
                  <p className="text-slate-500">Glycaemic Load</p>
                  <p className="font-semibold text-slate-900">
                    {Math.round((state.selectedFood.glycemicIndex * (state.selectedFood.carbohydrates * state.portionSize / state.selectedFood.defaultPortion)) / 100)}
                  </p>
                </div>
                <div className="text-sm">
                  <p className="text-slate-500">Default Portion</p>
                  <p className="font-semibold text-slate-900">{state.selectedFood.defaultPortion}g</p>
                </div>
                <div className="text-sm">
                  <p className="text-slate-500">Carbs per serving</p>
                  <p className="font-semibold text-slate-900">{state.selectedFood.carbohydrates}g</p>
                </div>
                <div className="text-sm">
                  <p className="text-slate-500">Fiber</p>
                  <p className="font-semibold text-slate-900">{state.selectedFood.fiber}g</p>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Portion Size Control */}
          {state.selectedFood && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 border-t border-slate-200 pt-6">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">Portion Size</label>
                <span className="text-lg font-bold text-blue-600">{state.portionSize}g</span>
              </div>
              <Slider
                value={[state.portionSize]}
                onValueChange={(values) => setState((prev) => ({ ...prev, portionSize: values[0] }))}
                min={Math.floor(state.selectedFood.defaultPortion * 0.5)}
                max={Math.floor(state.selectedFood.defaultPortion * 2)}
                step={10}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>{Math.floor(state.selectedFood.defaultPortion * 0.5)}g</span>
                <span>{Math.floor(state.selectedFood.defaultPortion * 2)}g</span>
              </div>
            </motion.div>
          )}

          {/* Prediction Display */}
          <AnimatePresence mode="wait">
            {state.selectedFood && state.prediction && (
              <motion.div
                key="prediction"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`mt-6 p-6 rounded-2xl border-2 transition-all ${riskColors[state.prediction.riskLevel].bg} ${riskColors[state.prediction.riskLevel].border}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex items-center justify-center w-12 h-12 rounded-full ${riskColors[state.prediction.riskLevel].badge}`}
                    >
                      {state.prediction.riskLevel === 'Safe' && <CheckCircle2 className="w-6 h-6 text-emerald-600" />}
                      {state.prediction.riskLevel === 'Moderate' && <AlertTriangle className="w-6 h-6 text-amber-600" />}
                      {state.prediction.riskLevel === 'Risk' && <AlertCircle className="w-6 h-6 text-red-600" />}
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${riskColors[state.prediction.riskLevel].text}`}>
                        {state.prediction.riskLevel} Risk
                      </p>
                      <p className="text-xs text-slate-500">Prediction confidence: {state.prediction.confidence}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={riskColors[state.prediction.riskLevel].badge}>
                    {state.learningStats?.dataPoints || 0} data points
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <motion.div
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    className="text-center bg-white/50 rounded-xl p-3"
                  >
                    <Zap className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                    <p className="text-xs text-slate-600">Glucose Rise</p>
                    <p className="text-2xl font-bold text-slate-900">+{state.prediction.predictedSpike}</p>
                    <p className="text-xs text-slate-500">mg/dL</p>
                  </motion.div>

                  <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-center bg-white/50 rounded-xl p-3">
                    <Clock3 className="w-5 h-5 mx-auto mb-1 text-purple-500" />
                    <p className="text-xs text-slate-600">Time to Peak</p>
                    <p className="text-2xl font-bold text-slate-900">{state.prediction.timeToPeak}</p>
                    <p className="text-xs text-slate-500">minutes</p>
                  </motion.div>

                  <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-center bg-white/50 rounded-xl p-3">
                    <TrendingUp className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
                    <p className="text-xs text-slate-600">Final Level</p>
                    <p className="text-2xl font-bold text-slate-900">{userProfile.baselineGlucose + state.prediction.predictedSpike}</p>
                    <p className="text-xs text-slate-500">mg/dL</p>
                  </motion.div>
                </div>

                <div className="bg-white/50 rounded-lg p-3 mb-4">
                  <p className="text-sm text-slate-700">{state.prediction.explanation}</p>
                </div>

                {/* Confidence and Learning */}
                {state.learningStats && (
                  <div className="text-xs text-slate-600 bg-white/30 rounded-lg p-2 mb-4">
                    <p>
                      <strong>System learning:</strong> {state.learningStats.dataPoints} recorded instances of this food.{' '}
                      {state.learningStats.dataPoints >= 5
                        ? '✓ Personalised predictions active'
                        : 'Log more meals to improve accuracy.'}
                    </p>
                  </div>
                )}

                {state.prediction && state.prediction.riskLevel !== 'Safe' && (
                  <div className="mt-3">
                    <Button onClick={handleGetSwap} disabled={loadingSwap} variant="outline" className="w-full rounded-xl border-amber-300 text-amber-700 hover:bg-amber-50">
                      {loadingSwap ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '🔄'} Get Safer Swap
                    </Button>
                    {swapResult && (
                      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
                        <p className="font-semibold text-emerald-800">✅ {swapResult.optimizedMealName}</p>
                        <p className="text-emerald-700">Spike reduced by {swapResult.reductionPercentage}% → ~{swapResult.optimizedSpikeMgDl} mg/dL</p>
                        <ul className="mt-2 space-y-1 text-slate-700">
                          {swapResult.suggestions.map((tip: string, i: number) => <li key={i}>• {tip}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {state.selectedFood && state.loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center h-40"
              >
                <div className="flex flex-col items-center gap-3">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full"
                  />
                  <p className="text-sm text-slate-600">Predicting your glucose response...</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>

      {/* Glucose Trend Visualization */}
      {state.prediction && glucoseTrend.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border border-slate-200 bg-white/80 backdrop-blur-sm rounded-2xl p-6">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Glucose Trend Forecast
            </h3>

            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={glucoseTrend} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="glucoseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  }}
                  formatter={(value: number) => [`${Math.round(value)} mg/dL`, 'Glucose']}
                />
                <Line
                  type="monotone"
                  dataKey="glucose"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', r: 5 }}
                  activeDot={{ r: 7 }}
                  fill="url(#glucoseGradient)"
                />
              </LineChart>
            </ResponsiveContainer>

            {/* Baseline Reference */}
            <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
              <p>
                📊 Baseline glucose: <strong>{userProfile.baselineGlucose} mg/dL</strong>
              </p>
              <p>
                Peak glucose (+{state.prediction.predictedSpike} mg/dL): <strong>{userProfile.baselineGlucose + state.prediction.predictedSpike} mg/dL</strong>
              </p>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Info Banner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 flex items-start gap-3"
      >
        <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold">Prediction runs locally 🟢</p>
          <p className="text-xs text-emerald-600">
            No internet required. Your health data stays on your device. More you log, smarter the predictions become.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Helper component for dropdown chevron
function ChevronDown(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  );
}
