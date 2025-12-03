import { getGeminiModel, isAIAvailable } from './gemini-client.js';

export async function analyzeReviewSentiment(reviewText) {
  if (!isAIAvailable()) {
    return {
      sentiment: 'neutral',
      score: 0,
      confidence: 0
    };
  }

  if (!reviewText || reviewText.trim().length === 0) {
    return {
      sentiment: 'neutral',
      score: 0.5,
      confidence: 0
    };
  }

  try {
    const startTime = Date.now();
    
    const model = getGeminiModel('gemini-2.5-flash');
    
    const prompt = `Phân tích cảm xúc của đánh giá sản phẩm sau (tiếng Việt):

"${reviewText.substring(0, 500)}"  // Limit length for speed

Trả về CHỈ JSON (không có text khác):
{
  "sentiment": "positive" | "negative" | "neutral",
  "score": 0.0-1.0,
  "confidence": 0.0-1.0,
  "keywords": ["từ khóa"],
  "summary": "Tóm tắt 1 câu"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const elapsedTime = Date.now() - startTime;
    console.log(`Sentiment analysis completed in ${elapsedTime}ms`);

    try {
      // Remove markdown code blocks
      let jsonText = text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '').trim();
      }
      
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Validate sentiment value
        const validSentiment = ['positive', 'negative', 'neutral'].includes(parsed.sentiment) 
          ? parsed.sentiment 
          : 'neutral';
        
        // Clamp score and confidence to valid ranges
        const score = Math.max(0, Math.min(1, parseFloat(parsed.score) || 0.5));
        const confidence = Math.max(0, Math.min(1, parseFloat(parsed.confidence) || 0.5));
        
        return {
          sentiment: validSentiment,
          score: score,
          confidence: confidence,
          keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
          summary: parsed.summary || ''
        };
      }
    } catch (parseError) {
      console.error('Failed to parse sentiment response:', parseError);
      console.error('Response text:', text.substring(0, 200));
    }

    // Fallback: simple keyword-based analysis
    const positiveWords = ['tốt', 'tuyệt', 'hài lòng', 'đẹp', 'chất lượng', 'nhanh', 'ổn', 'ok'];
    const negativeWords = ['tệ', 'kém', 'không tốt', 'chậm', 'lỗi', 'hỏng', 'thất vọng'];
    
    const lowerText = reviewText.toLowerCase();
    const positiveCount = positiveWords.filter(w => lowerText.includes(w)).length;
    const negativeCount = negativeWords.filter(w => lowerText.includes(w)).length;

    let sentiment = 'neutral';
    let score = 0.5;

    if (positiveCount > negativeCount) {
      sentiment = 'positive';
      score = 0.5 + (positiveCount * 0.1);
    } else if (negativeCount > positiveCount) {
      sentiment = 'negative';
      score = 0.5 - (negativeCount * 0.1);
    }

    return {
      sentiment,
      score: Math.max(0, Math.min(1, score)),
      confidence: 0.6,
      keywords: [],
      summary: ''
    };
  } catch (error) {
    console.error('Sentiment analysis error:', error);
    return {
      sentiment: 'neutral',
      score: 0.5,
      confidence: 0
    };
  }
}

/**
 * Analyze sentiment of multiple reviews (batch)
 */
export async function analyzeBatchReviewSentiment(reviews) {
  if (!isAIAvailable() || !reviews || reviews.length === 0) {
    return [];
  }

  // Limit batch size for performance (max 10 reviews per batch)
  const batchSize = 10;
  const batches = [];
  for (let i = 0; i < reviews.length; i += batchSize) {
    batches.push(reviews.slice(i, i + batchSize));
  }

  const allResults = [];

  try {
    const startTime = Date.now();
    const model = getGeminiModel('gemini-2.5-flash');
    
    // Process batches in parallel for speed
    const batchPromises = batches.map(async (batch, batchIdx) => {
      const reviewsText = batch.map((r, idx) => 
        `Review ${batchIdx * batchSize + idx + 1}: "${(r.text || r.comment || '').substring(0, 300)}"`
      ).join('\n\n');

      const prompt = `Phân tích cảm xúc của ${batch.length} đánh giá sau (tiếng Việt):

${reviewsText}

Trả về CHỈ JSON array:
[
  {"index": 0, "sentiment": "positive|negative|neutral", "score": 0.0-1.0, "confidence": 0.0-1.0}
]`;

      try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Parse response
        let jsonText = text.trim();
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/```\n?/g, '').trim();
        }
        
        const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return parsed;
        }
      } catch (error) {
        console.error(`Batch ${batchIdx} analysis failed:`, error.message);
        // Fallback to individual analysis for this batch
        return batch.map((r, idx) => ({
          index: batchIdx * batchSize + idx,
          sentiment: 'neutral',
          score: 0.5,
          confidence: 0.5
        }));
      }
      
      return [];
    });

    const batchResults = await Promise.all(batchPromises);
    const elapsedTime = Date.now() - startTime;
    console.log(`Batch sentiment analysis (${reviews.length} reviews) completed in ${elapsedTime}ms`);
    
    // Flatten results
    batchResults.forEach(batch => {
      allResults.push(...batch);
    });

    return allResults.map((item, idx) => ({
      reviewIndex: idx,
      sentiment: item.sentiment || 'neutral',
      score: Math.max(0, Math.min(1, parseFloat(item.score) || 0.5)),
      confidence: Math.max(0, Math.min(1, parseFloat(item.confidence) || 0.5))
    }));
  } catch (error) {
    console.error('Batch sentiment analysis error:', error);
    // Fallback: analyze individually
    const fallbackResults = [];
    for (const review of reviews) {
      const analysis = await analyzeReviewSentiment(review.text || review.comment || '');
      fallbackResults.push({
        reviewIndex: fallbackResults.length,
        sentiment: analysis.sentiment,
        score: analysis.score,
        confidence: analysis.confidence
      });
    }
    return fallbackResults;
  }
}

/**
 * Get overall sentiment statistics from reviews
 */
export async function getSentimentStatistics(reviews) {
  if (!reviews || reviews.length === 0) {
    return {
      total: 0,
      positive: 0,
      negative: 0,
      neutral: 0,
      averageScore: 0.5,
      positivePercentage: 0,
      negativePercentage: 0
    };
  }

  const analyses = await analyzeBatchReviewSentiment(reviews);
  
  const stats = {
    total: analyses.length,
    positive: 0,
    negative: 0,
    neutral: 0,
    totalScore: 0
  };

  analyses.forEach(analysis => {
    if (analysis.sentiment === 'positive') stats.positive++;
    else if (analysis.sentiment === 'negative') stats.negative++;
    else stats.neutral++;
    
    stats.totalScore += analysis.score;
  });

  const averageScore = stats.total > 0 ? stats.totalScore / stats.total : 0.5;

  return {
    total: stats.total,
    positive: stats.positive,
    negative: stats.negative,
    neutral: stats.neutral,
    averageScore: averageScore,
    positivePercentage: (stats.positive / stats.total) * 100,
    negativePercentage: (stats.negative / stats.total) * 100
  };
}

