const fs = require('fs');
const readline = require('readline');
const path = require('path');

const CSV_PATH = path.join(__dirname, '../src/lib/db/Indian_Food_Nutrition_Processed.csv');
const EXISTING_JSON_PATH = path.join(__dirname, '../src/lib/db/indian-foods.json');

// Heuristic dictionaries for mapping
const NON_VEG_KEYWORDS = ['chicken', 'mutton', 'meat', 'beef', 'pork', 'fish', 'prawn', 'shrimp', 'keema', 'lamb', 'bacon', 'salami'];
const EGG_KEYWORDS = ['egg', 'omelette', 'omlet', 'ande', 'frittata', 'scrambled'];
const VEGAN_EXCLUSIONS = ['paneer', 'milk', 'curd', 'ghee', 'butter', 'cheese', 'dahi', 'khoya', 'malai', 'cream', 'honey', 'lassi', 'kulfi'];

const REGION_MAP = {
  'South Indian': ['dosa', 'idli', 'sambar', 'vada', 'rasam', 'appam', 'uttapam', 'rice', 'avial', 'thoran', 'lemon rice', 'sadam', 'pulihora', 'payasam', 'bisi bele bath'],
  'North Indian': ['parantha', 'paratha', 'chole', 'rajma', 'paneer', 'chicken tikka', 'butter chicken', 'naan', 'kulcha', 'bhatura', 'halwa', 'kofta', 'kebab', 'rogan josh', 'korma'],
  'Maharashtrian': ['poha', 'misal', 'pav bhaji', 'vada pav', 'thalipeeth', 'modak', 'shrikhand'],
  'Gujarati': ['dhokla', 'khandvi', 'thepla', 'fafda', 'khaman', 'undhiyu'],
  'Bengali': ['rasgulla', 'sandesh', 'mishti doi', 'machli', 'fish curry', 'malpua'],
};

function determineDietType(name) {
  const lower = name.toLowerCase();
  
  if (NON_VEG_KEYWORDS.some(k => lower.includes(k))) return 'non-vegetarian';
  if (EGG_KEYWORDS.some(k => lower.includes(k))) return 'eggetarian';
  
  // Check if vegan (no dairy/honey)
  if (!VEGAN_EXCLUSIONS.some(k => lower.includes(k))) return 'vegan';
  
  return 'vegetarian';
}

function determineRegion(name) {
  const lower = name.toLowerCase();
  for (const [region, keywords] of Object.entries(REGION_MAP)) {
    if (keywords.some(k => lower.includes(k))) return region;
  }
  return 'Pan-Indian';
}

function estimateGI(name, carbs) {
  const lower = name.toLowerCase();
  // Proteins/Fats have 0 GI
  if (NON_VEG_KEYWORDS.some(k => lower.includes(k)) || EGG_KEYWORDS.some(k => lower.includes(k)) || lower.includes('paneer')) {
    if (carbs < 5) return 0;
    if (carbs < 15) return 15;
    return 30; // Mixed gravy
  }
  
  // Sweets/Desserts
  if (lower.match(/halwa|kheer|jalebi|gulab jamun|burfi|ladoo|chikki|cake|ice cream|chocolate|pastry|pudding|custard|sweet/)) return 75;
  
  // Breads/Grains
  if (lower.match(/rice|chawal|pulao|biryani|roti|paratha|naan|poori|bhatura/)) return 70;
  if (lower.match(/dosa|idli|upma/)) return 55;
  
  // Lentils
  if (lower.match(/dal|chole|rajma|channa/)) return 30;
  
  // Snacks/Fried
  if (lower.match(/samosa|pakora|kachori|vada|cutlet|biscuit/)) return 65;
  
  // Veggies
  if (lower.match(/palak|gobhi|bhindi|karela|baingan|gajar|mooli|sabzi|mushroom/)) return 20;
  if (lower.includes('aloo') || lower.includes('potato')) return 75;
  
  // Beverages
  if (lower.match(/tea|coffee|water|soup|juice|milkshake/)) return 25;
  
  return 45; // Safe default
}

function determineCategory(name) {
  const lower = name.toLowerCase();
  if (lower.match(/chicken|mutton|fish|meat|beef|egg/)) return 'Protein';
  if (lower.match(/paneer|milk|curd|cheese|yogurt/)) return 'Dairy';
  if (lower.match(/dosa|idli|rice|roti|paratha|naan|pulao|upma/)) return 'Grains';
  if (lower.match(/dal|chole|rajma|beans|lentil/)) return 'Lentils';
  if (lower.match(/palak|aloo|gobhi|bhindi|karela|sabzi/)) return 'Vegetables';
  if (lower.match(/samosa|pakora|vada|cutlet|biscuit|snack/)) return 'Snacks';
  if (lower.match(/halwa|kheer|burfi|ladoo|cake|ice cream|sweet/)) return 'Sweets';
  if (lower.match(/tea|coffee|water|soup|juice|milkshake|drink/)) return 'Beverages';
  return 'Mixed Meal';
}

function determinePortion(category, name) {
  const lower = name.toLowerCase();
  if (lower.match(/tea|coffee|water|juice|milkshake/)) return 250;
  if (lower.match(/biscuit|cookie/)) return 30;
  if (lower.match(/burfi|ladoo/)) return 40;
  if (category === 'Grains') return 150;
  if (category === 'Lentils' || category === 'Vegetables' || category === 'Protein') return 200;
  if (category === 'Sweets') return 100;
  return 150; // default
}

function readCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  const headers = lines[0].split(',');
  
  const foods = [];
  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    // Simple CSV parser ignoring commas inside quotes isn't strictly needed here as we saw it was mostly clear
    // But let's handle basic split
    const parts = [];
    let current = ''; let inQuote = false;
    for(let char of rawLine) {
      if (char === '"') inQuote = !inQuote;
      else if (char === ',' && !inQuote) { parts.push(current); current = ''; }
      else current += char;
    }
    parts.push(current);
    
    if (parts.length < 10) continue;

    const name = parts[0].trim();
    if (!name) continue;

    const cals = parseFloat(parts[1]) || 0;
    const carbs = parseFloat(parts[2]) || 0;
    const prot = parseFloat(parts[3]) || 0;
    const fat = parseFloat(parts[4]) || 0;
    const fiber = parseFloat(parts[6]) || 0;

    foods.push({
      name,
      carbohydrates: carbs,
      protein: prot,
      fat: fat,
      fiber: fiber,
      calories: cals
    });
  }
  return foods;
}

async function mergeDBs() {
  const existingJSON = require(EXISTING_JSON_PATH);
  const existingFoods = existingJSON.foods;
  let maxId = Math.max(...existingFoods.map(f => f.id));

  // Add diet config to existing ones
  existingFoods.forEach(food => {
    if(!food.dietType) {
        food.dietType = determineDietType(food.name);
    }
  });

  const csvFoods = readCSV(CSV_PATH);
  const existingNames = new Set(existingFoods.map(f => f.name.toLowerCase()));

  const merged = [...existingFoods];

  for (const cFood of csvFoods) {
    if (existingNames.has(cFood.name.toLowerCase())) continue; // Skip identical names

    const dietType = determineDietType(cFood.name);
    const region = determineRegion(cFood.name);
    const category = determineCategory(cFood.name);
    const defaultPortion = determinePortion(category, cFood.name);
    const glycemicIndex = estimateGI(cFood.name, cFood.carbohydrates);

    // Filter out very weird entries if calories are missing or 0
    if (cFood.calories <= 0) continue;

    maxId++;
    merged.push({
      id: maxId,
      name: cFood.name,
      region,
      category,
      glycemicIndex,
      defaultPortion,
      carbohydrates: Number((cFood.carbohydrates * (defaultPortion/100)).toFixed(1)),
      protein: Number((cFood.protein * (defaultPortion/100)).toFixed(1)),
      fat: Number((cFood.fat * (defaultPortion/100)).toFixed(1)),
      fiber: Number((cFood.fiber * (defaultPortion/100)).toFixed(1)),
      calories: Number((cFood.calories * (defaultPortion/100)).toFixed(1)),
      description: `CSV Import - ${category}`,
      dietType
    });
    existingNames.add(cFood.name.toLowerCase());
  }

  // Write out
  fs.writeFileSync(EXISTING_JSON_PATH, JSON.stringify({ foods: merged }, null, 2));
  console.log(`Successfully merged! Total foods: ${merged.length}`);
}

mergeDBs();
