import React, { useState, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';

const TermsModal = ({ isOpen, onClose, type = 'terms' }) => {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadContent();
    }
  }, [isOpen, type]);

  const loadContent = async () => {
    setLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
      const endpoint = type === 'terms' ? '/auth/terms-conditions' : '/auth/privacy-policy';
      const response = await fetch(`${apiUrl}${endpoint}`);
      if (response.ok) {
        const data = await response.json();
        setContent(data);
      }
    } catch (error) {
      console.error('Failed to load content:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl transform transition-all">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {loading ? 'Đang tải...' : content?.title || (type === 'terms' ? 'Điều khoản và Điều kiện' : 'Chính sách Bảo mật')}
              </h2>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <FaTimes size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
              ) : content ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed">
                    {content.content}
                  </div>
                  {content.version && (
                    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                      <p>Phiên bản: {content.version}</p>
                      {content.created_at && (
                        <p>Cập nhật lần cuối: {new Date(content.created_at).toLocaleDateString('vi-VN')}</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                  Không thể tải nội dung. Vui lòng thử lại sau.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsModal;
