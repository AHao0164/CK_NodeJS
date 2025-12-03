import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaRobot, FaTimes, FaPaperPlane, FaImage, FaSpinner } from 'react-icons/fa';
import { useToast } from '../context/ToastContext';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';

export default function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Xin chào! Tôi là AI tư vấn sản phẩm. Tôi có thể giúp bạn tìm sản phẩm phù hợp. Bạn cần gì?'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestedProducts, setSuggestedProducts] = useState([]);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const { showToast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (messageText = input) => {
    if (!messageText.trim() && !loading) return;

    const userMessage = messageText.trim();
    setInput('');
    setLoading(true);

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      const response = await fetch(`${API_BASE}/catalog/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();

      // Add AI response
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response || 'Xin lỗi, tôi không thể trả lời câu hỏi này.',
        suggestedProducts: data.suggestedProducts || [],
        searchKeywords: data.searchKeywords || []
      }]);

      if (data.suggestedProducts && data.suggestedProducts.length > 0) {
        setSuggestedProducts(data.suggestedProducts);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại sau.'
      }]);
      showToast('Không thể kết nối với AI. Vui lòng kiểm tra lại.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImageSearch = async (file) => {
    if (!file) return;

    setLoading(true);
    setMessages(prev => [...prev, {
      role: 'user',
      content: `[Đã upload hình ảnh: ${file.name}]`,
      image: URL.createObjectURL(file)
    }]);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`${API_BASE}/catalog/ai/search-by-image`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to analyze image');
      }

      const data = await response.json();

      // Kiểm tra nếu có lỗi (ví dụ: hình ảnh không liên quan đến điện tử)
      if (data.error) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.error || 'Hình ảnh không phù hợp. Vui lòng upload hình ảnh sản phẩm điện tử hoặc phụ kiện điện tử.'
        }]);
        showToast(data.error || 'Hình ảnh không phù hợp', 'warning');
        return;
      }

      // Nếu không có matches và không có error, có thể là không tìm thấy sản phẩm tương tự
      if (!data.matches || data.matches.length === 0) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.description || 'Đã phân tích hình ảnh nhưng không tìm thấy sản phẩm tương tự trong cửa hàng. Vui lòng thử với hình ảnh khác hoặc mô tả sản phẩm bạn đang tìm.'
        }]);
        if (data.searchKeywords && data.searchKeywords.length > 0) {
          showToast(`Gợi ý từ khóa: ${data.searchKeywords.join(', ')}`, 'info');
        }
        return;
      }

      // Có matches - hiển thị kết quả
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.description || 'Đã phân tích hình ảnh thành công. Dưới đây là các sản phẩm tương tự:',
        matches: data.matches || [],
        products: data.products || [],
        searchKeywords: data.searchKeywords || []
      }]);

      if (data.products && data.products.length > 0) {
        setSuggestedProducts(data.products);
        showToast(`Tìm thấy ${data.products.length} sản phẩm tương tự`, 'success');
      }
    } catch (error) {
      console.error('Image search error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Xin lỗi, không thể phân tích hình ảnh. Vui lòng thử lại hoặc kiểm tra kết nối mạng.'
      }]);
      showToast('Không thể phân tích hình ảnh. Vui lòng thử lại.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatPrice = (cents) => {
    return new Intl.NumberFormat('vi-VN').format(cents) + '₫';
  };

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-shadow"
            aria-label="Mở AI Chatbot"
          >
            <FaRobot className="text-2xl" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 w-96 h-[600px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FaRobot className="text-2xl" />
                <div>
                  <h3 className="font-semibold">AI Tư vấn</h3>
                  <p className="text-xs opacity-90">Sẵn sàng giúp đỡ</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-white/20 rounded-full p-2 transition-colors"
                aria-label="Đóng"
              >
                <FaTimes />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl p-3 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}
                  >
                    {msg.image && (
                      <img
                        src={msg.image}
                        alt="Uploaded"
                        className="max-w-full h-auto rounded-lg mb-2"
                      />
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {/* Suggested Products */}
                    {(msg.suggestedProducts || msg.products) && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-semibold mb-2">Sản phẩm đề xuất:</p>
                        {(msg.suggestedProducts || msg.products).slice(0, 3).map((product) => (
                          <a
                            key={product.id}
                            href={`/product/${product.id}`}
                            className="block p-2 bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                            onClick={() => setIsOpen(false)}
                          >
                            <p className="font-semibold text-sm">{product.name}</p>
                            <p className="text-xs opacity-75">
                              {formatPrice(product.price_cents)}
                            </p>
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Search Keywords */}
                    {msg.searchKeywords && msg.searchKeywords.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {msg.searchKeywords.map((keyword, kIdx) => (
                          <span
                            key={kIdx}
                            className="text-xs bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-gray-700 rounded-2xl p-3">
                    <FaSpinner className="animate-spin text-purple-600" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageSearch(file);
                  }}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  aria-label="Upload hình ảnh"
                >
                  <FaImage />
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Nhập câu hỏi của bạn..."
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  disabled={loading}
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={loading || !input.trim()}
                  className="p-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  aria-label="Gửi"
                >
                  <FaPaperPlane />
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                Nhấn Enter để gửi, Shift+Enter để xuống dòng
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

