import { NextResponse } from 'next/server';

type BarcodeLookup = {
  found?: boolean;
  hasNutrition?: boolean;
  productName?: string;
  brand?: string;
  caloriesPerServing?: number | null;
  caloriesPer100g?: number | null;
  estimatedSpikeMgDl?: number;
  spikeLevel?: string;
  healthScore?: number;
  benefitNotes?: string[];
  message?: string;
};

type TranslateResponse = any;

function normalizeLang(language: string | undefined): string {
  const value = (language || 'en').trim().toLowerCase();
  return value || 'en';
}

function isFoodSpikeQuestion(message: string): boolean {
  const text = message.toLowerCase();
  return /\beat\b|\bfood\b|\bmeal\b|\bspike\b|\bcarb\b|\bsugar\b|\bpani puri\b|\bgolgappa\b|\bchaat\b/.test(text);
}

function detectIngredients(message: string): string[] {
  const source = message.toLowerCase();
  const dictionary = [
    'rice', 'roti', 'bread', 'noodles', 'pasta', 'potato', 'banana', 'mango', 'apple',
    'paneer', 'tofu', 'egg', 'chicken', 'fish', 'dal', 'beans', 'oats', 'curd', 'yogurt',
    'sugar', 'jaggery', 'juice', 'biscuit', 'chips', 'milk'
  ];

  return dictionary.filter((item) => source.includes(item)).slice(0, 4);
}

type FoodProfile = {
  aliases: string[];
  ingredients: string;
  spikeRange: string;
  spikeLevel: 'Low' | 'Moderate' | 'High';
  reason: string;
  reduceTips: string[];
};

const FOOD_PROFILES: FoodProfile[] = [
  {
    aliases: ['pani puri', 'golgappa', 'puchka'],
    ingredients: 'suji/maida puri, potato filling, sweet/spicy water, chutneys',
    spikeRange: '35-60 mg/dL',
    spikeLevel: 'High',
    reason: 'refined carbs (puri) + potato + sweet chutney can raise glucose quickly; fiber/protein is low.',
    reduceTips: ['limit to 3-4 pieces', 'skip sweet chutney and add chana/sprouts + salad first'],
  },
  {
    aliases: ['white rice', 'plain rice'],
    ingredients: 'polished rice (high glycemic carbs)',
    spikeRange: '28-45 mg/dL',
    spikeLevel: 'Moderate',
    reason: 'high glycemic starch without enough fiber/protein digests fast.',
    reduceTips: ['reduce portion to half plate', 'pair with dal/paneer and vegetables'],
  },
  {
    aliases: ['poha'],
    ingredients: 'flattened rice, potato/peanuts, tempering',
    spikeRange: '20-35 mg/dL',
    spikeLevel: 'Moderate',
    reason: 'flattened rice is carb-heavy; spike depends on portion and protein/fiber pairing.',
    reduceTips: ['add sprouts/peanuts/curd', 'use smaller portion and include salad'],
  },
  {
    aliases: ['dosa'],
    ingredients: 'fermented rice-lentil batter',
    spikeRange: '18-32 mg/dL',
    spikeLevel: 'Moderate',
    reason: 'rice-based batter contributes carbs; fermentation helps but portion still matters.',
    reduceTips: ['prefer plain over masala dosa', 'add sambar/protein and avoid sugary beverages'],
  },
  {
    aliases: ['idli'],
    ingredients: 'fermented rice-lentil cakes',
    spikeRange: '16-28 mg/dL',
    spikeLevel: 'Moderate',
    reason: 'soft refined starch can absorb quickly without enough fiber/fat.',
    reduceTips: ['eat with sambar and chutney without sugar', 'limit count and add protein side'],
  },
];

function findFoodProfile(message: string): FoodProfile | null {
  const text = message.toLowerCase();
  for (const profile of FOOD_PROFILES) {
    if (profile.aliases.some((alias) => text.includes(alias))) {
      return profile;
    }
  }
  return null;
}

function structuredFoodReply(message: string): string {
  const profile = findFoodProfile(message);
  if (profile) {
    return `Ingredients: ${profile.ingredients}. Spike: ~${profile.spikeRange} (${profile.spikeLevel}). Why: ${profile.reason} Reduce spike: 1) ${profile.reduceTips[0]}, 2) ${profile.reduceTips[1]}.`;
  }

  const ingredients = detectIngredients(message);
  const hasHighCarb = /rice|bread|noodles|pasta|potato|sugar|juice|biscuit|chips|banana|mango/.test(message.toLowerCase());
  const hasProteinFiber = /paneer|tofu|egg|chicken|fish|dal|beans|oats|curd|yogurt/.test(message.toLowerCase());

  const spike = hasHighCarb && !hasProteinFiber ? '28-45 mg/dL (moderate-high)' : hasHighCarb ? '18-32 mg/dL (moderate)' : '10-22 mg/dL (low-moderate)';
  const reason = hasHighCarb
    ? 'Higher refined carbs/sugars can raise glucose faster; protein/fiber slows absorption.'
    : 'Lower glycemic load and better fiber/protein balance reduce post-meal rise.';
  const ingredientsLine = ingredients.length ? ingredients.join(', ') : 'main carbs, protein, and fats in this meal';

  return `Ingredients: ${ingredientsLine}. Spike: ~${spike}. Why: ${reason} Reduce spike: 1) add protein/fiber (paneer/dal/salad), 2) cut refined carbs portion and walk 10-15 min after meal.`;
}

async function translateText(text: string, targetLanguage: string): Promise<string> {
  const lang = normalizeLang(targetLanguage);
  if (!text || lang === 'en') return text;

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(lang)}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return text;

    const payload = (await response.json()) as TranslateResponse;
    const translated = Array.isArray(payload?.[0])
      ? payload[0].map((chunk: any[]) => chunk?.[0] || '').join('')
      : '';

    return translated || text;
  } catch {
    return text;
  }
}

function fallbackReply(message: string): string {
  const text = message.toLowerCase();

  if (isFoodSpikeQuestion(message)) {
    return structuredFoodReply(message);
  }

  if (text.includes('eat this') || text.includes('if i eat') || text.includes('spike if')) {
    return 'Estimated spike: 20-35 mg/dL (moderate), depending on portion and timing. Benefit: add protein/fiber to reduce spike, and walk 10-15 minutes after eating for better glucose control.';
  }

  if (text.includes('meal') || text.includes('eat') || text.includes('food')) {
    return 'For steadier glucose, combine protein + fiber + slower carbs. Typical spike is ~12-28 mg/dL for balanced meals. Profit/benefit: better satiety, fewer spikes, and steadier energy.';
  }

  if (text.includes('glucose') || text.includes('spike') || text.includes('sugar')) {
    return 'For post-meal spikes: take a 10-15 minute walk, hydrate, and reduce refined carbs next meal. Pair carbs with protein/fiber for better control.';
  }

  if (text.includes('app') || text.includes('feature') || text.includes('logbook')) {
    return 'Use Logbook for readings, My Menu for meal plans, Barcode page for food scans, and Settings for SMS/threshold controls.';
  }

  return 'I can help with meal ideas, glucose guidance, and app features. Ask a specific question like "What should I eat tonight?"';
}

function extractText(response: any): string {
  return response?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
}

function findBarcodeInMessage(message: string): string | null {
  const match = message.match(/\b\d{8,14}\b/);
  return match ? match[0] : null;
}

async function getBarcodeReply(req: Request, barcode: string): Promise<string | null> {
  try {
    const lookupUrl = new URL(`/api/barcode/lookup?barcode=${encodeURIComponent(barcode)}`, req.url).toString();
    const response = await fetch(lookupUrl, { cache: 'no-store' });
    if (!response.ok) return null;

    const data = (await response.json()) as BarcodeLookup;
    if (!data?.found) {
      return `I could not find product details for barcode ${barcode}. Please check the number and try again.`;
    }

    const product = data.productName || 'this product';
    const calories = data.caloriesPerServing ?? data.caloriesPer100g;
    const spike = data.estimatedSpikeMgDl;
    const level = data.spikeLevel || 'Unknown';
    const score = data.healthScore;
    const notes = (data.benefitNotes || []).slice(0, 2).join(' ');

    if (data.hasNutrition === false) {
      return `${product}: nutrition facts are unavailable for this barcode, so exact spike estimate is not possible yet.`;
    }

    return `${product}${data.brand ? ` by ${data.brand}` : ''}: estimated spike ${spike ?? 'N/A'} mg/dL (${level}). Calories ${calories ?? 'N/A'}. Health score ${score ?? 'N/A'}/100. ${notes}`.trim();
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const { message, history = [], userContext = '', preferredLanguage = 'en' } = await req.json();
    const targetLanguage = normalizeLang(preferredLanguage);

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const barcode = findBarcodeInMessage(message);
    if (barcode) {
      const barcodeReply = await getBarcodeReply(req, barcode);
      if (barcodeReply) {
        const translatedBarcodeReply = await translateText(barcodeReply, targetLanguage);
        return NextResponse.json({ reply: translatedBarcodeReply, source: 'barcode-lookup' });
      }
    }

    if (isFoodSpikeQuestion(message)) {
      const shortFoodReply = structuredFoodReply(message);
      const translatedShortFoodReply = await translateText(shortFoodReply, targetLanguage);
      return NextResponse.json({ reply: translatedShortFoodReply, source: 'structured-food' });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      const fallback = await translateText(fallbackReply(message), targetLanguage);
      return NextResponse.json({ reply: fallback, fallback: true });
    }

    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    const prior = history
      .slice(-8)
      .map((h: any) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
      .join('\n');

    const prompt = [
      'You are Parivartan, GLYVORA assistant.',
      'Answer in very short helpful text, maximum 70 words.',
      'Focus on webapp help (features, navigation) or nutrition/wellness guidance.',
      'When user asks about a food spike, always include in short form: 1) main ingredients, 2) estimated spike range in mg/dL and level, 3) short reason (GI, carbs, sugar, fiber/protein), 4) 1-2 ways to reduce spike.',
      'Never provide diagnosis. Be safe and practical.',
      userContext ? `User context: ${userContext}` : '',
      `Preferred response language: ${targetLanguage}`,
      prior ? `Conversation:\n${prior}` : '',
      `User question: ${message}`,
      'Return plain text only.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      }),
    });

    if (!res.ok) {
      const fallback = await translateText(fallbackReply(message), targetLanguage);
      return NextResponse.json({ reply: fallback, fallback: true });
    }

    const data = await res.json();
    const reply = extractText(data).trim();

    if (!reply) {
      const fallback = await translateText(fallbackReply(message), targetLanguage);
      return NextResponse.json({ reply: fallback, fallback: true });
    }

    const translatedReply = await translateText(reply, targetLanguage);
    return NextResponse.json({ reply: translatedReply });
  } catch (error: any) {
    return NextResponse.json({ reply: fallbackReply('help me'), fallback: true });
  }
}
