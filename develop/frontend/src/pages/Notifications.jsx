import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaBell, FaReply, FaStar, FaBox, FaCheck } from 'react-icons/fa';
import { useToast } from '../ui/Toast';

export default function Notifications() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const toast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Thông báo - GearUp';
  }, []);

  useEffect(() => {
    if (!token || !user) {
      navigate('/login');
      return;
    }
    loadNotifications();
    
    // Auto-reload notifications mỗi 10s
    const interval = setInterval(() => {
      loadNotifications();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [token, user, navigate]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      // Lấy tất cả reviews của user
      const apiUrl = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/catalog/products/reviews/user/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to load reviews');
      }

      const reviews = await response.json();

      // Tạo danh sách thông báo từ comments admin reply
      const notifs = [];
      
      reviews.forEach((review) => {
        if (review.comments && review.comments.length > 0) {
          // Lấy timestamp cuối cùng đã xem
          const lastSeen = localStorage.getItem(`review_${review.id}_last_seen`);
          const lastSeenTime = lastSeen ? parseInt(lastSeen) : 0;

          // Tìm admin replies chưa đọc
          review.comments.forEach((comment) => {
            if (comment.is_admin) {
              const commentTime = new Date(comment.created_at).getTime();
              const isUnread = commentTime > lastSeenTime;

              notifs.push({
                id: `comment_${comment.id}`,
                type: 'admin_reply',
                productId: review.product_id,
                productName: review.product_name,
                reviewId: review.id,
                rating: review.rating,
                comment: comment.comment,
                adminName: comment.user_name || 'Admin',
                createdAt: comment.created_at,
                isUnread
              });
            }
          });
        }
      });

      // Sắp xếp theo thời gian mới nhất
      notifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setNotifications(notifs);
    } catch (error) {
      console.error('Load notifications error:', error);
      toast.show('Không thể tải thông báo', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = (notification) => {
    localStorage.setItem(`review_${notification.reviewId}_last_seen`, Date.now().toString());
    loadNotifications();
    
    // Trigger event để DockMenu reload badge
    window.dispatchEvent(new CustomEvent('notificationRead'));
    
    toast.show('Đã đánh dấu là đã đọc', { type: 'success' });
  };

  const handleNotificationClick = (notification) => {
    // Đánh dấu đã đọc
    localStorage.setItem(`review_${notification.reviewId}_last_seen`, Date.now().toString());
    
    // Trigger event để DockMenu reload badge
    window.dispatchEvent(new CustomEvent('notificationRead'));
    
    // Chuyển đến trang chi tiết sản phẩm
    navigate(`/product/${notification.productId}`);
  };

  const markAllAsRead = () => {
    notifications.forEach((notif) => {
      if (notif.isUnread) {
        localStorage.setItem(`review_${notif.reviewId}_last_seen`, Date.now().toString());
      }
    });
    loadNotifications();
    
    // Trigger event để DockMenu reload badge
    window.dispatchEvent(new CustomEvent('notificationRead'));
    
    toast.show('Đã đánh dấu tất cả là đã đọc', { type: 'success' });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString('vi-VN');
  };

  const unreadCount = notifications.filter((n) => n.isUnread).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-24 pb-12">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FaBell className="text-2xl text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Thông báo
              </h1>
              {unreadCount > 0 && (
                <span className="px-3 py-1 bg-red-500 text-white text-sm font-semibold rounded-full">
                  {unreadCount} mới
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 
                         hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg
                         transition-colors font-medium"
              >
                Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        {notifications.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center">
            <FaBell className="text-6xl text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">
              Chưa có thông báo
            </h2>
            <p className="text-gray-500 dark:text-gray-500">
              Bạn sẽ nhận được thông báo khi admin phản hồi đánh giá của bạn
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 relative
                         ${notification.isUnread ? 'ring-2 ring-blue-500' : ''}`}
              >
                {/* Unread Indicator */}
                {notification.isUnread && (
                  <div className="absolute top-6 right-6">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  </div>
                )}

                {/* Content */}
                <div className="flex gap-4 mb-3">
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full 
                                  flex items-center justify-center">
                      <FaReply className="text-xl text-blue-600" />
                    </div>
                  </div>

                  {/* Text Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {notification.adminName} đã phản hồi đánh giá của bạn
                      </h3>
                      <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatTime(notification.createdAt)}
                      </span>
                    </div>

                    {/* Product Info */}
                    <div className="flex items-center gap-2 mb-3 text-sm text-gray-600 dark:text-gray-400">
                      <FaBox className="text-gray-400" />
                      <span className="truncate">{notification.productName}</span>
                      <span className="flex items-center gap-1">
                        <FaStar className="text-yellow-400" />
                        {notification.rating}
                      </span>
                    </div>

                    {/* Reply Content */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                      <p className="text-gray-700 dark:text-gray-300 text-sm line-clamp-2">
                        {notification.comment}
                      </p>
                    </div>

                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => handleNotificationClick(notification)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 
                             hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm"
                  >
                    <FaBox className="text-sm" />
                    Xem chi tiết sản phẩm
                  </button>
                  {notification.isUnread && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notification);
                      }}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg 
                               transition-colors font-medium text-sm flex items-center gap-2"
                    >
                      <FaCheck className="text-sm" />
                      Đánh dấu đã đọc
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
