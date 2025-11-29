import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GEMINI_API_KEY || '';

if (!API_KEY) {
  console.warn('⚠️ GEMINI_API_KEY not set. AI features will be disabled.');
}

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// Get Gemini model instances
// Try multiple model names in order of preference
const MODEL_NAMES = [
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro'
];

// Cache for working model
let cachedModel = null;
let cachedModelName = null;

export function getGeminiModel(modelName = null) {
  if (!genAI) {
    throw new Error('Gemini API key not configured');
  }
  
  // If we have a cached working model and no specific model requested, use it
  if (!modelName && cachedModel) {
    return cachedModel;
  }
  
  // If specific model requested, try it first
  const modelsToTry = modelName ? [modelName, ...MODEL_NAMES] : MODEL_NAMES;
  
  // Try to get model (getGenerativeModel doesn't throw, but generateContent will)
  // So we'll just return the first one and let the caller handle errors
  const modelToUse = modelName || MODEL_NAMES[0];
  const model = genAI.getGenerativeModel({ model: modelToUse });
  
  // Cache it
  if (!modelName) {
    cachedModel = model;
    cachedModelName = modelToUse;
  }
  
  return model;
}

// Get Gemini Vision model for image analysis
export function getGeminiVisionModel() {
  if (!genAI) {
    throw new Error('Gemini API key not configured');
  }
  // Try vision-capable models
  const visionModels = [
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro-vision'
  ];
  
  for (const model of visionModels) {
    try {
      return genAI.getGenerativeModel({ model });
    } catch (error) {
      continue;
    }
  }
  
  // Fallback to text model
  return getGeminiModel();
}

// Check if AI is available
export function isAIAvailable() {
  return !!API_KEY && !!genAI;
}

