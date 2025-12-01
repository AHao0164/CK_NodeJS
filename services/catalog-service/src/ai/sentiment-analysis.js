import { getGeminiModel, isAIAvailable } from './gemini-client.js';

/**
 * Analyze sentiment of a single review
 */
export async function analyzeReviewSentiment(reviewText) {
  if (!isAIAvailable()) {
    return {
      sentiment: 'neutral',
      score: 0,
      confidence: 0
    };
  }

  try {
    const model = getGeminiModel();
    
    const prompt = `Phân tích cảm xúc của đánh giá sau đây về sản phẩm:

"${reviewText}"

Hãy phân tích và trả về dưới dạng JSON:
{
  "sentiment": "positive" | "negative" | "neutral",
  "score": 0.0 đến 1.0 (1.0 là tích cực nhất, 0.0 là tiêu cực nhất),
  "confidence": 0.0 đến 1.0 (độ tin cậy của phân tích),
  "keywords": ["từ khóa tích cực/tiêu cực"],
  "summary": "Tóm tắt ngắn gọn cảm xúc"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          sentiment: parsed.sentiment || 'neutral',
          score: parseFloat(parsed.score) || 0.5,
          confidence: parseFloat(parsed.confidence) || 0.5,
          keywords: parsed.keywords || [],
          summary: parsed.summary || ''
        };
      }
    } catch (parseError) {
      console.error('Failed to parse sentiment response:', parseError);
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

  try {
    const model = getGeminiModel();
    
    const reviewsText = reviews.map((r, idx) => 
      `Review ${idx + 1}: "${r.text || r.comment || ''}"`
    ).join('\n\n');

    const prompt = `Phân tích cảm xúc của các đánh giá sau đây:

${reviewsText}

Trả về dưới dạng JSON array, mỗi phần tử tương ứng với một review:
[
  {
    "index": 0,
    "sentiment": "positive" | "negative" | "neutral",
    "score": 0.0 đến 1.0,
    "confidence": 0.0 đến 1.0
  }
]`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.map((item, idx) => ({
          reviewIndex: idx,
          sentiment: item.sentiment || 'neutral',
          score: parseFloat(item.score) || 0.5,
          confidence: parseFloat(item.confidence) || 0.5
        }));
      }
    } catch (parseError) {
      console.error('Failed to parse batch sentiment response:', parseError);
    }

    // Fallback: analyze individually
    const results = [];
    for (const review of reviews) {
      const analysis = await analyzeReviewSentiment(review.text || review.comment || '');
      results.push(analysis);
    }
    return results;
  } catch (error) {
    console.error('Batch sentiment analysis error:', error);
    return reviews.map(() => ({
      sentiment: 'neutral',
      score: 0.5,
      confidence: 0
    }));
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

