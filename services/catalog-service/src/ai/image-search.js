import { getGeminiVisionModel, isAIAvailable } from './gemini-client.js';
import fs from 'fs';

/**
 * Convert image file to base64
 */
function imageToBase64(imagePath) {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    return imageBuffer.toString('base64');
  } catch (error) {
    throw new Error(`Failed to read image: ${error.message}`);
  }
}

/**
 * Convert image buffer to base64
 */
function imageBufferToBase64(imageBuffer) {
  return imageBuffer.toString('base64');
}

/**
 * Detect image MIME type
 */
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

/**
 * Search products by image using Gemini Vision
 */
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

  try {
    const model = getGeminiVisionModel();
    const imageBase64 = imageBufferToBase64(imageBuffer);

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

    return {
      description: text.substring(0, 500),
      features: [],
      matches: [],
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

