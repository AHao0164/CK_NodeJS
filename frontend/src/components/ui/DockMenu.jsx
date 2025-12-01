import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Dock from './Dock'
import MegaMenu from './MegaMenu'
import { FaHome, FaShoppingCart, FaBox, FaUser, FaSearch, FaSun, FaMoon, FaBell } from 'react-icons/fa'
import { useTheme } from '../../ui/ThemeProvider'
import VI from '../../constants/vi'

export default function DockMenu() {
  const navigate = useNavigate()
  const { token, user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const [showMegaMenu, setShowMegaMenu] = useState(false)
  const [megaMenuItems, setMegaMenuItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [logoutConfirm, setLogoutConfirm] = useState(false)

  useEffect(() => {
    if (token && user) {
      loadUnreadCount();
    }
  }, [token, user]);

  // Auto-reload badge mỗi 5s để cập nhật gần real-time
  useEffect(() => {
    if (!token || !user) return;
    
    const interval = setInterval(() => {
      loadUnreadCount();
    }, 5000); // 5 seconds - near real-time updates
    
    return () => clearInterval(interval);
  }, [token, user]);

  // Reload badge khi user quay lại trang/tab
  useEffect(() => {
    if (!token || !user) return;
    
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadUnreadCount();
      }
    };
    
    const handleFocus = () => {
      loadUnreadCount();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [token, user]);

  const loadUnreadCount = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/catalog/products/reviews/user/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const reviews = await response.json();
        let count = 0;
        reviews.forEach((review) => {
          if (review.comments && review.comments.length > 0) {
            const lastSeen = localStorage.getItem(`review_${review.id}_last_seen`);
            const lastSeenTime = lastSeen ? parseInt(lastSeen) : 0;
            review.comments.forEach((comment) => {
              if (comment.is_admin) {
                const commentTime = new Date(comment.created_at).getTime();
                if (commentTime > lastSeenTime) count++;
              }
            });
          }
        });
        setUnreadCount(count);
      }
    } catch (error) {
      console.error('Load unread count error:', error);
    }
  };

  const handleProductsClick = () => {
    setMegaMenuItems([]) // Clear items to show full categories menu
    setShowMegaMenu(true)
  }

  const handleAccountClick = () => {
    if (!token) {
      navigate('/login')
    } else {
      setMegaMenuItems([
        { 
          label: 'Thông báo', 
          href: '/notifications', 
          icon: <FaBell />, 
          badge: unreadCount > 0 ? unreadCount : null 
        },
        { label: VI.nav.cart, href: '/cart', icon: <FaShoppingCart /> },
        { label: VI.nav.orders, href: '/orders', icon: <FaBox /> },
        { label: VI.common.profile, href: '/profile', icon: <FaUser /> },
        { label: VI.auth.logout, icon: '🚪', onClick: () => {
          setShowMegaMenu(false);
          setLogoutConfirm(true);
        }},
      ])
      setShowMegaMenu(true)
    }
  }

  const dockItems = [
    {
      icon: <FaHome />,
      label: VI.common.home,
      onClick: () => navigate('/')
    },
    {
      icon: <FaSearch />,
      label: VI.common.products,
      onClick: handleProductsClick
    },
    {
      icon: <FaUser />,
      label: token ? user?.fullName || 'Tài khoản' : VI.auth.login,
      onClick: handleAccountClick,
      badge: token && unreadCount > 0 ? unreadCount : null
    },
    {
      icon: theme === 'light' ? <FaMoon /> : <FaSun />,
      label: theme === 'light' ? 'Chế độ tối' : 'Chế độ sáng',
      onClick: toggle
    },
  ]

  const confirmLogout = () => {
    logout();
    navigate('/');
    setLogoutConfirm(false);
  };

  return (
    <>
      <Dock 
        items={dockItems}
        panelHeight={68}
        baseItemSize={50}
        magnification={70}
        distance={200}
      />
      <MegaMenu 
        isOpen={showMegaMenu}
        onClose={() => setShowMegaMenu(false)}
        position="bottom-center"
        items={megaMenuItems}
      />
      
      {/* Logout Confirmation */}
      {logoutConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm mx-4">
            <h3 className="text-xl font-bold mb-3 text-gray-800 dark:text-white">Xác nhận đăng xuất</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">Bạn có chắc chắn muốn đăng xuất?</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setLogoutConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Hủy
              </button>
              <button 
                onClick={confirmLogout}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

