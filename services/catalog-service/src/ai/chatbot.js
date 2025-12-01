import { getGeminiModel, isAIAvailable } from './gemini-client.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GEMINI_API_KEY || '';
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

/**
 * Smart chatbot để suggest products dựa trên user query
 */
export async function chatWithAI(userMessage, availableProducts = []) {
  if (!isAIAvailable()) {
    return {
      error: 'AI service not available. Please configure GEMINI_API_KEY.',
      suggestions: []
    };
  }

  try {
    // Build context với danh sách products
    const productsContext = availableProducts.length > 0
      ? availableProducts.slice(0, 20).map(p => ({
          id: p.id,
          name: p.name,
          description: p.description?.substring(0, 200) || '',
          price: p.price_cents,
          category: p.category || '',
          brand: p.brand || ''
        }))
      : [];

    const prompt = `Bạn là một chatbot tư vấn sản phẩm thông minh cho một cửa hàng điện tử trực tuyến.

Danh sách sản phẩm hiện có:
${JSON.stringify(productsContext, null, 2)}

Nhiệm vụ của bạn:
1. Phân tích yêu cầu của khách hàng: "${userMessage}"
2. Đề xuất các sản phẩm phù hợp từ danh sách trên
3. Giải thích lý do tại sao sản phẩm đó phù hợp
4. Nếu không có sản phẩm phù hợp, đề xuất các tiêu chí tìm kiếm khác

Hãy trả lời bằng tiếng Việt, thân thiện và chuyên nghiệp. Format response dưới dạng JSON:
{
  "response": "Câu trả lời tư vấn",
  "suggestedProductIds": [1, 2, 3],
  "searchKeywords": ["keyword1", "keyword2"],
  "reasoning": "Lý do đề xuất"
}`;

    // Try to generate content with gemini-2.5-flash first, fallback to other models
    let result, response, text;
    const MODEL_NAMES = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
    
    for (const modelName of MODEL_NAMES) {
      try {
        const testModel = genAI.getGenerativeModel({ model: modelName });
        result = await testModel.generateContent(prompt);
        response = await result.response;
        text = response.text();
        console.log(`✅ Successfully used model: ${modelName}`);
        break;
      } catch (error) {
        console.warn(`❌ Model ${modelName} failed:`, error.message);
        if (modelName === MODEL_NAMES[MODEL_NAMES.length - 1]) {
          throw error;
        }
        continue;
      }
    }

    // Parse JSON response
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
      const parsed = JSON.parse(jsonText);
      
      return {
        response: parsed.response || text,
        suggestedProductIds: parsed.suggestedProductIds || [],
        searchKeywords: parsed.searchKeywords || [],
        reasoning: parsed.reasoning || ''
      };
    } catch (parseError) {
      // If JSON parsing fails, return raw text
      return {
        response: text,
        suggestedProductIds: [],
        searchKeywords: [],
        reasoning: ''
      };
    }
  } catch (error) {
    console.error('Chatbot error:', error);
    return {
      error: error.message || 'Failed to process chat request',
      suggestions: []
    };
  }
}

/**
 * Generate product recommendations based on user preferences
 */
export async function generateProductRecommendations(userPreferences, availableProducts = []) {
  if (!isAIAvailable()) {
    return { recommendations: [] };
  }

  try {
    const model = getGeminiModel();
    
    const productsContext = availableProducts.slice(0, 30).map(p => ({
      id: p.id,
      name: p.name,
      description: p.description?.substring(0, 150) || '',
      price: p.price_cents,
      category: p.category || '',
      brand: p.brand || '',
      rating: p.avg_rating || 0
    }));

    const prompt = `Dựa trên sở thích của khách hàng: "${userPreferences}"

Và danh sách sản phẩm:
${JSON.stringify(productsContext, null, 2)}

Hãy đề xuất 5-10 sản phẩm phù hợp nhất. Trả về dưới dạng JSON:
{
  "recommendations": [
    {
      "productId": 1,
      "reason": "Lý do đề xuất sản phẩm này"
    }
  ]
}`;

    // Try to generate content with gemini-2.5-flash first, fallback to other models
    let result, response, text;
    const MODEL_NAMES = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
    
    for (const modelName of MODEL_NAMES) {
      try {
        const testModel = genAI.getGenerativeModel({ model: modelName });
        result = await testModel.generateContent(prompt);
        response = await result.response;
        text = response.text();
        console.log(`✅ Successfully used model: ${modelName}`);
        break;
      } catch (error) {
        console.warn(`❌ Model ${modelName} failed:`, error.message);
        if (modelName === MODEL_NAMES[MODEL_NAMES.length - 1]) {
          throw error;
        }
        continue;
      }
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    }

    return { recommendations: [] };
  } catch (error) {
    console.error('Recommendation error:', error);
    return { recommendations: [] };
  }
}

