/**
 * Glucose Predictor - Local ML Engine for Pre-Meal Spike Prediction
 * ===============================================================
 * 
 * Runs entirely on-device using TensorFlow.js
 * - Synthetic baseline model trained on initialization
 * - Heuristic fallback: GI * GL * personal sensitivity
 * - Personalised refinement via user feedback loop
 * - Local storage: training data and learned coefficients
 */

import * as tf from '@tensorflow/tfjs';

export interface FoodItem {
  id: number;
  name: string;
  region: string;
  category: string;
  glycemicIndex: number;
  defaultPortion: number; // grams - default serving size
  portionSize?: number; // grams - actual/adjusted portion size (runtime)
  carbohydrates: number; // grams
  protein: number;
  fat: number;
  fiber: number;
  calories: number;
  description?: string;
  dietType?: 'vegetarian' | 'non-vegetarian' | 'eggetarian' | 'vegan';
}

export interface UserProfile {
  baselineGlucose: number; // mg/dL fasting
  diabetesType: 'Type1' | 'Type2' | 'PreDiabetic' | 'NonDiabetic';
  activityLevel: 'Sedentary' | 'LightlyActive' | 'ModeratelyActive' | 'VeryActive';
  sensitivity: number; // 0.5 - 2.0 personalisation factor
  recentGlucoseReadings?: number[]; // last 24h
  dietaryPreference?: string;
  foodAllergies?: string[];
}

export interface PredictionResult {
  predictedSpike: number; // mg/dL rise
  confidence: 'Low' | 'Medium' | 'High';
  timeToPeak: number; // minutes
  riskLevel: 'Safe' | 'Moderate' | 'Risk';
  explanation: string;
  heuristicSpike?: number; // fallback heuristic value
  modelSpike?: number; // if model available
}

export interface FoodGlucoseFeedback {
  foodName: string;
  predictedSpike: number;
  actualSpike: number;
  timestamp: number;
  userProfile: UserProfile;
}

class GlucosePredictorEngine {
  private model: tf.LayersModel | null = null;
  private isInitialized = false;
  private trainingData: FoodGlucoseFeedback[] = [];
  private personalizedCoefficients: Record<string, number> = {};
  private foodLearningCounts: Record<string, number> = {};

  constructor() {
    this.loadStoredData();
  }

  /**
   * Initialize the prediction engine with synthetic training data
   * Creates a baseline sequential neural network
   */
  async initialize(userProfile: UserProfile): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Create baseline sequential model (regression for glucose prediction)
      this.model = tf.sequential({
        layers: [
          // Input layer: 6 features
          // [glycemicIndex, glycemicLoad, carbs, protein, baseSensitivity, activityAdjustment]
          tf.layers.dense({
            inputShape: [6],
            units: 16,
            activation: 'relu',
            name: 'dense_1',
          }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({
            units: 8,
            activation: 'relu',
            name: 'dense_2',
          }),
          // Output: predicted glucose spike (mg/dL)
          tf.layers.dense({
            units: 1,
            activation: 'linear',
            name: 'glucose_spike_output',
          }),
        ],
      });

      this.model.compile({
        optimizer: tf.train.adam(0.01),
        loss: 'meanSquaredError',
        metrics: ['mae'],
      });

      // Create synthetic training data for model bootstrapping
      const syntheticData = this.generateSyntheticTrainingData(userProfile);
      await this.trainModelOnSyntheticData(syntheticData);

      this.isInitialized = true;
      console.log('✓ Glucose Predictor initialized with baseline TF.js model');
    } catch (error) {
      console.error('Failed to initialize glucose predictor:', error);
      throw error;
    }
  }

  /**
   * Predict glucose spike for a food item
   */
  async predictSpike(foodOrMeal: FoodItem | FoodItem[], userProfile: UserProfile): Promise<PredictionResult> {
    const meal = Array.isArray(foodOrMeal) ? foodOrMeal : [foodOrMeal];
    const food = meal[0];
    // Use portionSize if available, otherwise default to defaultPortion
    const portion = food.portionSize || food.defaultPortion;
    
    // Calculate simple baseline for rendering charts (used if not ML)
    const gl = (food.glycemicIndex * portion) / 100;

    let modelPrediction: number | null = null;
    let confidence: 'Low' | 'Medium' | 'High' = 'Low';

    // Use ML model if initialized and trained enough
    try {
      const prediction = (this.isInitialized && this.model)
        ? await this.runModelInference(foodOrMeal, userProfile)
        : this.calculateHeuristicPrediction(foodOrMeal, userProfile);
      
      const timeToPeak = 60 + Math.floor(Math.random() * 30);
      
      // Determine confidence based on food feedback count
      const foodNames = meal.map(f => f.name);
      const foodCount = Math.min(...foodNames.map(name => this.foodLearningCounts[name] || 0));
      confidence = foodCount >= 5 ? 'High' : foodCount >= 2 ? 'Medium' : 'Low';
      
      modelPrediction = prediction;
    } catch (error) {
      console.warn('Model inference failed, using heuristic:', error);
    }

    // Blend heuristic and model prediction
    const baseHeuristic = this.calculateHeuristicPrediction(foodOrMeal, userProfile);
    const finalPrediction = modelPrediction || baseHeuristic;

    // Determine risk level
    const riskLevel = this.getRiskLevel(finalPrediction, userProfile);

    // Estimate time to peak
    const timeToPeak = 75; // Simplified for this implementation

    return {
      predictedSpike: Math.round(finalPrediction),
      confidence,
      timeToPeak,
      riskLevel,
      explanation: this.generateExplanation(meal[0], finalPrediction, riskLevel, confidence),
      heuristicSpike: Math.round(baseHeuristic),
      modelSpike: modelPrediction ? Math.round(modelPrediction) : undefined,
    };
  }

  /**
   * Log actual glucose feedback to refine model
   */
  async logFeedback(feedback: FoodGlucoseFeedback): Promise<void> {
    this.trainingData.push(feedback);

    // Track per-food learning count
    const count = (this.foodLearningCounts[feedback.foodName] || 0) + 1;
    this.foodLearningCounts[feedback.foodName] = count;

    // Retrain if threshold reached
    if (this.trainingData.length >= 10 || count >= 10) {
      await this.retrainModel();
      this.saveStoredData();
    }

    this.saveStoredData();
  }

  /**
   * Calculate heuristic glucose spike prediction
   * Formula: BaseGI × GL × PersonalSensitivity × ActivityFactor
   */
  private calculateHeuristicPrediction(foodOrMeal: FoodItem | FoodItem[], userProfile: UserProfile): number {
    const meal = Array.isArray(foodOrMeal) ? foodOrMeal : [foodOrMeal];
    
    // Calculate composite metrics
    let totalCarbs = 0, totalProtein = 0, totalFat = 0, totalFiber = 0;
    let weightedGI = 0;
    
    for (const item of meal) {
      const portionRatio = (item.portionSize || item.defaultPortion) / 100;
      const carbs = item.carbohydrates * portionRatio;
      
      totalCarbs += carbs;
      totalProtein += item.protein * portionRatio;
      totalFat += item.fat * portionRatio;
      totalFiber += item.fiber * portionRatio;
      
      weightedGI += (item.glycemicIndex * carbs);
    }
    
    const compositeGI = totalCarbs > 0 ? weightedGI / totalCarbs : 0;
    
    // Impact calculation
    const carbImpact = totalCarbs * (compositeGI / 100) * 0.8;
    const proteinBuffer = totalProtein * 0.1;
    const fatBuffer = totalFat * 0.15;
    const fiberBuffer = totalFiber * 0.2;

    // Activity adjustment
    const activityFactors: Record<string, number> = {
      Sedentary: 1.2,
      LightlyActive: 1.0,
      ModeratelyActive: 0.9,
      VeryActive: 0.8,
    };
    const activityFactor = activityFactors[userProfile.activityLevel] || 1.0;

    // Diabetes type adjustment
    const diabetesFactors: Record<string, number> = {
      Type1: 1.1,
      Type2: 1.0,
      PreDiabetic: 0.95,
      NonDiabetic: 0.85,
    };
    const diabetesFactor = diabetesFactors[userProfile.diabetesType] || 1.0;

    const prediction =
      (carbImpact - proteinBuffer - fatBuffer - fiberBuffer) * userProfile.sensitivity * activityFactor * diabetesFactor;

    return Math.max(5, prediction); // Minimum 5 mg/dL spike
  }

  /**
   * Run TensorFlow model inference
   */
  private async runModelInference(foodOrMeal: FoodItem | FoodItem[], userProfile: UserProfile): Promise<number> {
    const meal = Array.isArray(foodOrMeal) ? foodOrMeal : [foodOrMeal];
    
    if (!this.model) {
      return this.calculateHeuristicPrediction(foodOrMeal, userProfile);
    }

    const food = meal[0];
    const portion = food.portionSize || food.defaultPortion;

    const input = tf.tensor2d([
      [
        food.glycemicIndex / 100, // Normalize to 0-1
        (food.glycemicIndex * portion) / 10000, // GL normalized
        food.carbohydrates / 100,
        food.protein / 50,
        userProfile.sensitivity,
        this.getActivityNumerical(userProfile.activityLevel),
      ],
    ]);

    const prediction = this.model.predict(input) as tf.Tensor;
    const value = (await prediction.data())[0];

    // Cleanup
    input.dispose();
    prediction.dispose();

    return Math.max(5, value); // Floor at 5 mg/dL
  }

  /**
   * Train model on synthetic + user feedback data
   */
  private async trainModelOnSyntheticData(syntheticData: Array<[number[], number]>): Promise<void> {
    if (!this.model) return;

    const xArray = syntheticData.map((d) => d[0]);
    const yArray = syntheticData.map((d) => d[1]);

    const xs = tf.tensor2d(xArray);
    const ys = tf.tensor2d(yArray, [yArray.length, 1]);

    try {
      await this.model.fit(xs, ys, {
        epochs: 30,
        batchSize: 8,
        verbose: 0,
      });
    } finally {
      xs.dispose();
      ys.dispose();
    }
  }

  /**
   * Retrain model with accumulated feedback
   */
  private async retrainModel(): Promise<void> {
    if (!this.model || this.trainingData.length === 0) return;

    const trainingInputs = this.trainingData.map((feedback) => {
      // Reconstruct food features (simplified - would need food data passed)
      return [
        feedback.userProfile.sensitivity,
        feedback.actualSpike / 100, // Normalize target
        0.5, // Placeholder for GI/GL etc
        0.5,
        0.5,
        this.getActivityNumerical(feedback.userProfile.activityLevel),
      ];
    });

    const targets = this.trainingData.map((f) => [f.actualSpike]);

    const xs = tf.tensor2d(trainingInputs);
    const ys = tf.tensor2d(targets);

    try {
      await this.model.fit(xs, ys, {
        epochs: 15,
        batchSize: 4,
        verbose: 0,
      });
    } finally {
      xs.dispose();
      ys.dispose();
    }

    console.log('✓ Model retrained with user feedback');
  }

  /**
   * Generate synthetic training data for bootstrapping
   */
  private generateSyntheticTrainingData(
    userProfile: UserProfile,
  ): Array<[number[], number]> {
    const data: Array<[number[], number]> = [];

    // Low GI foods
    for (let i = 0; i < 20; i++) {
      const giNorm = 0.3 + Math.random() * 0.2; // GI 30-50
      const glNorm = giNorm * (0.3 + Math.random() * 0.2);
      const spike = (giNorm * 30 + glNorm * 10) * userProfile.sensitivity;
      data.push([
        [giNorm, glNorm, Math.random() * 0.5, Math.random() * 0.5, userProfile.sensitivity, 0.8],
        spike,
      ]);
    }

    // Medium GI foods
    for (let i = 0; i < 20; i++) {
      const giNorm = 0.5 + Math.random() * 0.2; // GI 50-70
      const glNorm = giNorm * (0.4 + Math.random() * 0.2);
      const spike = (giNorm * 50 + glNorm * 15) * userProfile.sensitivity;
      data.push([
        [giNorm, glNorm, Math.random() * 0.7, Math.random() * 0.3, userProfile.sensitivity, 0.9],
        spike,
      ]);
    }

    // High GI foods
    for (let i = 0; i < 20; i++) {
      const giNorm = 0.7 + Math.random() * 0.3; // GI 70-100
      const glNorm = giNorm * (0.5 + Math.random() * 0.3);
      const spike = (giNorm * 70 + glNorm * 20) * userProfile.sensitivity;
      data.push([
        [giNorm, glNorm, Math.random() * 0.9, Math.random() * 0.2, userProfile.sensitivity, 1.0],
        spike,
      ]);
    }

    return data;
  }

  /**
   * Determine risk classification
   */
  private getRiskLevel(spike: number, userProfile: UserProfile): 'Safe' | 'Moderate' | 'Risk' {
    // Target ranges vary by diabetes type
    const targetRanges: Record<string, { safe: number; moderate: number }> = {
      Type1: { safe: 40, moderate: 80 },
      Type2: { safe: 50, moderate: 100 },
      PreDiabetic: { safe: 45, moderate: 90 },
      NonDiabetic: { safe: 60, moderate: 120 },
    };

    const range = targetRanges[userProfile.diabetesType] || { safe: 50, moderate: 100 };

    if (spike <= range.safe) return 'Safe';
    if (spike <= range.moderate) return 'Moderate';
    return 'Risk';
  }

  /**
   * Generate human-readable explanation
   */
  private generateExplanation(
    food: FoodItem,
    spike: number,
    riskLevel: string,
    confidence: string,
  ): string {
    const riskEmoji = { Safe: '🟢', Moderate: '🟡', Risk: '🔴' };

    return `${riskEmoji[riskLevel as keyof typeof riskEmoji]} ${food.name} may cause ~${spike}mg/dL spike (${confidence} confidence). ` +
      `Recommended portion: ${food.portionSize}g.`;
  }

  /**
   * Convert activity level to numerical
   */
  private getActivityNumerical(activityLevel: string): number {
    const map: Record<string, number> = {
      Sedentary: 0.2,
      LightlyActive: 0.5,
      ModeratelyActive: 0.75,
      VeryActive: 1.0,
    };
    return map[activityLevel] || 0.5;
  }

  /**
   * Persist training data to localStorage
   */
  private saveStoredData(): void {
    try {
      const data = {
        trainingData: this.trainingData,
        foodLearningCounts: this.foodLearningCounts,
        personalizedCoefficients: this.personalizedCoefficients,
        timestamp: Date.now(),
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem('glucose_predictor_data', JSON.stringify(data));
      }
    } catch (error) {
      console.warn('Failed to save predictor data:', error);
    }
  }

  /**
   * Load persisted training data from localStorage
   */
  private loadStoredData(): void {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('glucose_predictor_data');
        if (stored) {
          const data = JSON.parse(stored);
          this.trainingData = data.trainingData || [];
          this.foodLearningCounts = data.foodLearningCounts || {};
          this.personalizedCoefficients = data.personalizedCoefficients || {};
          console.log('✓ Loaded stored predictor data:', this.trainingData.length, 'entries');
        }
      }
    } catch (error) {
      console.warn('Failed to load predictor data:', error);
    }
  }

  /**
   * Get learning status for a specific food
   */
  getLearnedFoodStatus(foodName: string): { dataPoints: number; confidence: string } {
    const count = this.foodLearningCounts[foodName] || 0;
    let confidence = 'Not learned';
    if (count >= 5) confidence = 'High';
    else if (count >= 2) confidence = 'Medium';
    else if (count > 0) confidence = 'Low';

    return { dataPoints: count, confidence };
  }

  /**
   * Get all learning statistics
   */
  getLearningStats(): { totalDataPoints: number; uniqueFoods: number; averageConfidence: string } {
    const uniqueFoods = Object.keys(this.foodLearningCounts).length;
    const totalDataPoints = this.trainingData.length;
    const avgCount = totalDataPoints / (uniqueFoods || 1);

    let averageConfidence = 'Not learned';
    if (avgCount >= 5) averageConfidence = 'High';
    else if (avgCount >= 2) averageConfidence = 'Medium';
    else if (avgCount > 0) averageConfidence = 'Low';

    return { totalDataPoints, uniqueFoods, averageConfidence };
  }

  /**
   * Cleanup TensorFlow resources
   */
  async dispose(): Promise<void> {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      this.isInitialized = false;
    }
  }
}

// Singleton instance
let predictor: GlucosePredictorEngine | null = null;

export async function initializeGlucosePredictor(userProfile: UserProfile): Promise<GlucosePredictorEngine> {
  if (!predictor) {
    predictor = new GlucosePredictorEngine();
    await predictor.initialize(userProfile);
  }
  return predictor;
}

export function getGlucosePredictorInstance(): GlucosePredictorEngine | null {
  return predictor;
}

export async function disposeGlucosePredictor(): Promise<void> {
  if (predictor) {
    await predictor.dispose();
    predictor = null;
  }
}

export default GlucosePredictorEngine;
