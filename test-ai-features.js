/**
 * Test script for AI Features
 * Tests: Chatbot, Image Search, Sentiment Analysis
 * 
 * Usage: node test-ai-features.js
 * 
 * Requirements:
 * - GEMINI_API_KEY must be configured
 * - All services must be running (docker-compose up -d)
 * - At least one product in database
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE = process.env.API_BASE || 'http://localhost:8080';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log('\n' + '='.repeat(70), 'cyan');
  log(title, 'cyan');
  log('='.repeat(70), 'cyan');
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test 1: Smart Chatbot
async function testChatbot() {
  logSection('Test 1: Smart Chatbot');
  
  try {
    const testMessages = [
      'Tôi cần laptop gaming giá dưới 20 triệu',
      'Bạn có bàn phím cơ nào không?',
      'Tôi muốn mua tai nghe bluetooth'
    ];
    
    for (const message of testMessages) {
      log(`\n📤 Sending: "${message}"`, 'yellow');
      
      const response = await axios.post(`${API_BASE}/catalog/ai/chat`, {
        message: message
      });
      
      const data = response.data;
      
      log(`✅ Response received:`, 'green');
      log(`   Response: ${data.response?.substring(0, 100)}...`, 'cyan');
      log(`   Suggested Products: ${JSON.stringify(data.suggestedProducts || [])}`, 'cyan');
      log(`   Search Keywords: ${JSON.stringify(data.searchKeywords || [])}`, 'cyan');
      
      // Validate response
      if (!data.response) {
        log(`⚠️  Warning: No response text`, 'yellow');
      }
      
      if (!data.suggestedProducts || data.suggestedProducts.length === 0) {
        log(`⚠️  Warning: No suggested products`, 'yellow');
      }
      
      await sleep(2000); // Wait between requests to avoid rate limit
    }
    
    log('\n✅ Chatbot test completed!', 'green');
    return true;
  } catch (error) {
    log(`\n❌ Chatbot test failed: ${error.message}`, 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Data: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return false;
  }
}

// Test 2: Image Search
async function testImageSearch() {
  logSection('Test 2: Product Search by Image');
  
  try {
    // Check if test image exists
    const testImagePath = path.join(__dirname, 'test-image.jpg');
    
    if (!fs.existsSync(testImagePath)) {
      log(`⚠️  Test image not found: ${testImagePath}`, 'yellow');
      log(`   Please provide a test image (laptop, phone, etc.)`, 'yellow');
      log(`   Or skip this test`, 'yellow');
      return false;
    }
    
    log(`\n📤 Uploading image: ${testImagePath}`, 'yellow');
    
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('image', fs.createReadStream(testImagePath));
    
    const response = await axios.post(
      `${API_BASE}/catalog/ai/search-by-image`,
      formData,
      {
        headers: formData.getHeaders()
      }
    );
    
    const data = response.data;
    
    if (data.error) {
      log(`❌ Error: ${data.error}`, 'red');
      return false;
    }
    
    log(`✅ Image analysis completed:`, 'green');
    log(`   Description: ${data.description?.substring(0, 100)}...`, 'cyan');
    log(`   Features: ${JSON.stringify(data.features || [])}`, 'cyan');
    log(`   Matches: ${data.matches?.length || 0} products found`, 'cyan');
    
    if (data.matches && data.matches.length > 0) {
      data.matches.slice(0, 3).forEach((match, idx) => {
        log(`   ${idx + 1}. Product ID: ${match.productId}, Similarity: ${match.similarity}`, 'cyan');
        log(`      Reason: ${match.reason}`, 'cyan');
      });
    }
    
    log('\n✅ Image search test completed!', 'green');
    return true;
  } catch (error) {
    log(`\n❌ Image search test failed: ${error.message}`, 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Data: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return false;
  }
}

// Test 3: Sentiment Analysis
async function testSentimentAnalysis() {
  logSection('Test 3: Sentiment Analysis');
  
  try {
    const testReviews = [
      {
        text: 'Sản phẩm rất tốt, chất lượng cao, giao hàng nhanh! Tôi rất hài lòng.',
        expected: 'positive'
      },
      {
        text: 'Sản phẩm kém chất lượng, giao hàng chậm, không hài lòng chút nào.',
        expected: 'negative'
      },
      {
        text: 'Sản phẩm ổn, giá cả hợp lý.',
        expected: 'neutral'
      }
    ];
    
    for (const review of testReviews) {
      log(`\n📤 Analyzing: "${review.text.substring(0, 50)}..."`, 'yellow');
      
      const response = await axios.post(`${API_BASE}/catalog/ai/analyze-sentiment`, {
        reviewText: review.text
      });
      
      const data = response.data;
      
      log(`✅ Analysis result:`, 'green');
      log(`   Sentiment: ${data.sentiment} (expected: ${review.expected})`, 
          data.sentiment === review.expected ? 'green' : 'yellow');
      log(`   Score: ${data.score}`, 'cyan');
      log(`   Confidence: ${data.confidence}`, 'cyan');
      log(`   Keywords: ${JSON.stringify(data.keywords || [])}`, 'cyan');
      if (data.summary) {
        log(`   Summary: ${data.summary}`, 'cyan');
      }
      
      await sleep(2000); // Wait between requests
    }
    
    // Test with productId (if available)
    try {
      log(`\n📤 Testing batch analysis with productId...`, 'yellow');
      
      // Get first product
      const productsRes = await axios.get(`${API_BASE}/catalog/products?pageSize=1`);
      if (productsRes.data?.items?.length > 0) {
        const productId = productsRes.data.items[0].id;
        log(`   Using product ID: ${productId}`, 'cyan');
        
        const response = await axios.post(`${API_BASE}/catalog/ai/analyze-sentiment`, {
          productId: productId
        });
        
        const data = response.data;
        
        if (data.statistics) {
          log(`✅ Batch analysis result:`, 'green');
          log(`   Total reviews: ${data.statistics.total}`, 'cyan');
          log(`   Positive: ${data.statistics.positive} (${data.statistics.positivePercentage}%)`, 'cyan');
          log(`   Negative: ${data.statistics.negative} (${data.statistics.negativePercentage}%)`, 'cyan');
          log(`   Neutral: ${data.statistics.neutral}`, 'cyan');
          log(`   Average score: ${data.statistics.averageScore}`, 'cyan');
        }
      } else {
        log(`⚠️  No products available for batch analysis`, 'yellow');
      }
    } catch (error) {
      log(`⚠️  Batch analysis skipped: ${error.message}`, 'yellow');
    }
    
    log('\n✅ Sentiment analysis test completed!', 'green');
    return true;
  } catch (error) {
    log(`\n❌ Sentiment analysis test failed: ${error.message}`, 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Data: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return false;
  }
}

// Main test flow
async function runTests() {
  try {
    log('\n🤖 Starting AI Features Tests\n', 'blue');
    
    // Check API availability
    try {
      await axios.get(`${API_BASE}/health`);
      log('✅ API Gateway is accessible', 'green');
    } catch (error) {
      log('❌ API Gateway is not accessible. Please start services first.', 'red');
      log('   Run: docker-compose up -d', 'yellow');
      process.exit(1);
    }
    
    const results = {
      chatbot: false,
      imageSearch: false,
      sentimentAnalysis: false
    };
    
    // Run tests
    results.chatbot = await testChatbot();
    await sleep(1000);
    
    results.imageSearch = await testImageSearch();
    await sleep(1000);
    
    results.sentimentAnalysis = await testSentimentAnalysis();
    
    // Summary
    logSection('Test Summary');
    
    log('\nResults:', 'cyan');
    log(`  Chatbot: ${results.chatbot ? '✅ PASSED' : '❌ FAILED'}`, 
        results.chatbot ? 'green' : 'red');
    log(`  Image Search: ${results.imageSearch ? '✅ PASSED' : '⚠️  SKIPPED'}`, 
        results.imageSearch ? 'green' : 'yellow');
    log(`  Sentiment Analysis: ${results.sentimentAnalysis ? '✅ PASSED' : '❌ FAILED'}`, 
        results.sentimentAnalysis ? 'green' : 'red');
    
    const passedCount = Object.values(results).filter(r => r === true).length;
    const totalCount = Object.keys(results).length;
    
    log(`\nTotal: ${passedCount}/${totalCount} tests passed`, 'cyan');
    
    if (passedCount === totalCount) {
      log('\n🎉 All AI features tests PASSED!', 'green');
    } else if (passedCount > 0) {
      log('\n⚠️  Some tests failed or were skipped', 'yellow');
    } else {
      log('\n❌ All tests FAILED!', 'red');
      process.exit(1);
    }
    
    log('\n💡 Tips:', 'yellow');
    log('   - Ensure GEMINI_API_KEY is configured in docker-compose.yml', 'yellow');
    log('   - Check API quota if requests are failing', 'yellow');
    log('   - For image search, provide a test image file', 'yellow');
    
  } catch (error) {
    log(`\n❌ Test suite failed: ${error.message}`, 'red');
    if (error.stack) {
      log(error.stack, 'red');
    }
    process.exit(1);
  }
}

// Run tests
runTests();

