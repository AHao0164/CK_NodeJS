import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GEMINI_API_KEY || '';

if (!API_KEY) {
  console.warn('GEMINI_API_KEY not set. AI features will be disabled.');
}

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

const MODEL_NAMES = [
  'gemini-2.5-flash' 
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
  
  // Use latest fastest model with optimized config
  const modelToUse = modelName || MODEL_NAMES[0];
  const model = genAI.getGenerativeModel({ 
    model: modelToUse,
    generationConfig: {
      temperature: 0.7,  // Balanced creativity and consistency
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 2048,  // Limit for faster responses
    }
  });
  
  // Cache it
  if (!modelName) {
    cachedModel = model;
    cachedModelName = modelToUse;
  }
  
  return model;
}

export function getGeminiVisionModel() {
  if (!genAI) {
    throw new Error('Gemini API key not configured');
  }
  
  // Only use gemini-2.5-flash
  const modelName = 'gemini-2.5-flash';
  const model = genAI.getGenerativeModel({ 
    model: modelName,
    generationConfig: {
      temperature: 0.4,  // Lower temperature for more consistent results
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 2048,  // Limit output for faster response
    }
  });
  
  console.log(`Using Gemini vision model: ${modelName} (optimized for speed)`);
  return model;
}

// Check if AI is available
export function isAIAvailable() {
  return !!API_KEY && !!genAI;
}

