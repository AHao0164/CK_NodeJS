import { getGeminiVisionModel, isAIAvailable } from './gemini-client.js';
import fs from 'fs';

function imageToBase64(imagePath) {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    return imageBuffer.toString('base64');
  } catch (error) {
    throw new Error(`Failed to read image: ${error.message}`);
  }
}

function imageBufferToBase64(imageBuffer) {
  return imageBuffer.toString('base64');
}

function getImageMimeType(imagePath) {
  const ext = imagePath.split('.').pop().toLowerCase();
  const mimeTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp'
  };
  return mimeTypes[ext] || 'image/jpeg';
}

export async function searchProductsByImage(imagePath, availableProducts = []) {
  if (!isAIAvailable()) {
    return {
      error: 'AI service not available. Please configure GEMINI_API_KEY.',
      matches: []
    };
  }

  try {
    const model = getGeminiVisionModel();
    
    // Read and encode image
    const imageBase64 = imageToBase64(imagePath);
    const mimeType = getImageMimeType(imagePath);

    // Build products context
    const productsContext = availableProducts.slice(0, 50).map(p => ({
      id: p.id,
      name: p.name,
      description: p.description?.substring(0, 200) || '',
      category: p.category || '',
      brand: p.brand || '',
      specs: p.specs || {}
    }));

    const prompt = `Phân tích hình ảnh này và tìm các sản phẩm phù hợp từ danh sách sau:

${JSON.stringify(productsContext, null, 2)}

Hãy:
1. Mô tả chi tiết sản phẩm trong hình ảnh
2. Xác định các đặc điểm chính (màu sắc, kích thước, loại sản phẩm, thương hiệu, v.v.)
3. So sánh với danh sách sản phẩm và tìm các sản phẩm tương tự nhất
4. Xếp hạng độ phù hợp từ cao đến thấp

Trả về dưới dạng JSON:
{
  "description": "Mô tả sản phẩm trong ảnh",
  "features": ["đặc điểm 1", "đặc điểm 2"],
  "matches": [
    {
      "productId": 1,
      "similarity": 0.95,
      "reason": "Lý do tại sao sản phẩm này phù hợp"
    }
  ],
  "searchKeywords": ["keyword1", "keyword2"]
}`;

    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: mimeType
      }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    // Parse JSON response
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          description: parsed.description || '',
          features: parsed.features || [],
          matches: parsed.matches || [],
          searchKeywords: parsed.searchKeywords || []
        };
      }
    } catch (parseError) {
      console.error('Failed to parse image search response:', parseError);
    }

    // Fallback: extract product IDs from text
    const productIdMatches = text.match(/productId[:\s]*(\d+)/gi) || [];
    const matches = productIdMatches.map(match => {
      const id = parseInt(match.match(/\d+/)[0]);
      return {
        productId: id,
        similarity: 0.7,
        reason: 'Detected from image analysis'
      };
    });

    return {
      description: text.substring(0, 500),
      features: [],
      matches: matches,
      searchKeywords: []
    };
  } catch (error) {
    console.error('Image search error:', error);
    return {
      error: error.message || 'Failed to analyze image',
      matches: []
    };
  }
}

/**
 * Search products by image buffer (for uploaded files)
 */
export async function searchProductsByImageBuffer(imageBuffer, mimeType, availableProducts = []) {
  if (!isAIAvailable()) {
    return {
      error: 'AI service not available. Please configure GEMINI_API_KEY.',
      matches: []
    };
  }

  // Validate image buffer
  if (!imageBuffer || imageBuffer.length === 0) {
    return {
      error: 'Invalid image buffer',
      matches: []
    };
  }

  // Validate mime type
  const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!validMimeTypes.includes(mimeType)) {
    return {
      error: `Unsupported image format: ${mimeType}. Supported formats: ${validMimeTypes.join(', ')}`,
      matches: []
    };
  }

  // Limit image size (max 4MB for Gemini)
  const maxSize = 4 * 1024 * 1024; // 4MB
  if (imageBuffer.length > maxSize) {
    return {
      error: `Image too large: ${(imageBuffer.length / 1024 / 1024).toFixed(2)}MB. Maximum size: 4MB`,
      matches: []
    };
  }

  try {
    const model = getGeminiVisionModel();
    const imageBase64 = imageBufferToBase64(imageBuffer);

    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: mimeType
      }
    };

    // Tối ưu: Gộp validation và analysis vào 1 lần gọi API để tăng tốc độ
    // Giảm số lượng products để tăng tốc độ (từ 30 xuống 20)
    const productsContext = availableProducts.slice(0, 20).map(p => ({
      id: p.id,
      name: p.name,
      description: (p.description || '').substring(0, 100), // Giảm từ 150 xuống 100
      category: p.category || '',
      brand: p.brand || ''
      // Bỏ specs để giảm token
    }));

    // Tối ưu prompt: Ngắn gọn hơn, kết hợp validation và analysis
    const optimizedPrompt = `Xem hình ảnh và trả lời CHỈ JSON:

1. Nếu KHÔNG phải sản phẩm điện tử → {"error": "not_electronics"}
2. Nếu là sản phẩm điện tử → Tìm 3-5 sản phẩm phù hợp từ danh sách:

${JSON.stringify(productsContext)}

Trả về JSON:
{
  "isElectronicsRelated": true,
  "description": "Mô tả ngắn 1 câu",
  "matches": [{"productId": 1, "similarity": 0.9, "reason": "Ngắn"}],
  "searchKeywords": ["keyword1", "keyword2"]
}`;

    console.log('🔍 Analyzing image and finding matching products...');
    const analysisStartTime = Date.now();

    // Generate content - chỉ 1 lần gọi API thay vì 2 lần
    let result, response, text;
    
    try {
      // Set timeout để tránh chờ quá lâu
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout after 30s')), 30000)
      );
      
      const apiPromise = model.generateContent([optimizedPrompt, imagePart]);
      result = await Promise.race([apiPromise, timeoutPromise]);
      
      response = await result.response;
      text = response.text();
      
      const analysisTime = Date.now() - analysisStartTime;
      console.log(`⏱️ Analysis completed in ${analysisTime}ms (${text.length} chars)`);
    } catch (apiError) {
      console.error('Gemini API error:', apiError);
      lastError = apiError;
      
      // Check for specific error types
      if (apiError.message?.includes('API_KEY') || apiError.message?.includes('401')) {
        throw new Error('Invalid Gemini API key');
      } else if (apiError.message?.includes('quota') || apiError.message?.includes('rate limit') || apiError.message?.includes('429')) {
        throw new Error('Gemini API quota exceeded. Please try again later.');
      } else if (apiError.message?.includes('safety') || apiError.message?.includes('SAFETY')) {
        throw new Error('Image was blocked by safety filters');
      } else {
        throw apiError;
      }
    }

    // Try to parse JSON response
    try {
      // Remove markdown code blocks if present
      let jsonText = text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '').trim();
      }
      
      // Find JSON object
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Check if not electronics related
        if (parsed.error === 'not_electronics' || parsed.isElectronicsRelated === false) {
          console.log('Image is not electronics-related');
          return {
            error: 'Hình ảnh không liên quan đến sản phẩm điện tử. Vui lòng upload hình ảnh sản phẩm điện tử hoặc phụ kiện điện tử.',
            matches: [],
            description: 'Hình ảnh không phù hợp với danh mục sản phẩm của cửa hàng.',
            isRelevant: false
          };
        }
        
        // Validate parsed data
        if (parsed && typeof parsed === 'object') {
          // Ensure matches is an array
          const matches = Array.isArray(parsed.matches) ? parsed.matches : [];
          
          // Filter out invalid matches
          const validMatches = matches.filter(m => 
            m && typeof m === 'object' && 
            typeof m.productId === 'number' && 
            m.productId > 0 &&
            availableProducts.some(p => p.id === m.productId) // Ensure product exists
          );
          
          console.log(`Parsed ${validMatches.length} valid matches from Gemini response`);
          
          return {
            description: parsed.description || text.substring(0, 300),
            features: Array.isArray(parsed.features) ? parsed.features : [],
            matches: validMatches,
            searchKeywords: Array.isArray(parsed.searchKeywords) ? parsed.searchKeywords : []
          };
        }
      }
      
      // If no JSON found, try to extract product IDs from text
      console.warn('No JSON found in response, trying to extract product IDs from text');
      const productIdMatches = text.match(/productId[:\s]*(\d+)/gi) || [];
      const extractedMatches = productIdMatches.map(match => {
        const id = parseInt(match.match(/\d+/)[0]);
        if (availableProducts.some(p => p.id === id)) {
          return {
            productId: id,
            similarity: 0.7,
            reason: 'Detected from image analysis'
          };
        }
        return null;
      }).filter(Boolean);
      
      if (extractedMatches.length > 0) {
        console.log(`Extracted ${extractedMatches.length} product IDs from text`);
        return {
          description: text.substring(0, 500),
          features: [],
          matches: extractedMatches,
          searchKeywords: []
        };
      }
      
    } catch (parseError) {
      console.error('Failed to parse image search response:', parseError);
      console.error('Response text (first 500 chars):', text.substring(0, 500));
      // Continue to return fallback
    }

    // Fallback: return description but no matches
    console.warn('Returning fallback response - no matches found');
    return {
      description: text.substring(0, 500),
      features: [],
      matches: [],
      searchKeywords: []
    };
    
  } catch (error) {
    console.error('Image search error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Provide more specific error messages
    let errorMessage = 'Failed to analyze image';
    if (error.message?.includes('API_KEY')) {
      errorMessage = 'Invalid Gemini API key';
    } else if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
      errorMessage = 'Gemini API quota exceeded. Please try again later.';
    } else if (error.message?.includes('safety')) {
      errorMessage = 'Image was blocked by safety filters';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      error: errorMessage,
      matches: []
    };
  }
}

