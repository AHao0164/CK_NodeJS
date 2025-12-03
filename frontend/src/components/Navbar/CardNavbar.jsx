import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { GoArrowUpRight } from 'react-icons/go';
import { SlArrowRight } from 'react-icons/sl';
import { FaSearch, FaBars, FaUser, FaBell, FaShoppingCart } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { listCategories } from '../../services/catalog';

const CardNav = ({
  items,
  className = '',
  ease = 'power3.out'
}) => {
  const [setIsHamburgerOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categories, setCategories] = useState([]);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const navigate = useNavigate();
  const { token } = useAuth();
  const { cartCount, dismissBadge } = useCart();
  const navRef = useRef(null);
  const cardsRef = useRef([]);
  const tlRef = useRef(null);
  const categoryButtonRef = useRef(null);
  const categoryDropdownRef = useRef(null);

  const calculateHeight = () => {
    const navEl = navRef.current;
    if (!navEl) return 80;

    const contentEl = navEl.querySelector('.card-nav-content');
    if (contentEl) {
      const wasVisible = contentEl.style.visibility;
      const wasPointerEvents = contentEl.style.pointerEvents;
      const wasPosition = contentEl.style.position;
      const wasHeight = contentEl.style.height;

      contentEl.style.visibility = 'visible';
      contentEl.style.pointerEvents = 'auto';
      contentEl.style.position = 'static';
      contentEl.style.height = 'auto';

      contentEl.offsetHeight;

      const topBar = 80;
      const padding = 16;
      const contentHeight = contentEl.scrollHeight;

      contentEl.style.visibility = wasVisible;
      contentEl.style.pointerEvents = wasPointerEvents;
      contentEl.style.position = wasPosition;
      contentEl.style.height = wasHeight;

      return topBar + contentHeight + padding;
    }
    return 80;
  };

  const collapseMenu = () => {
    if (!isExpanded) return;
    const tl = tlRef.current;
    setIsHamburgerOpen(false);
    setIsCategoryOpen(false);
    if (tl) {
      tl.eventCallback('onReverseComplete', () => setIsExpanded(false));
      tl.reverse();
    } else {
      setIsExpanded(false);
    }
  };

  const handleLinkNavigation = (href) => {
    if (!href) return;
    if (/^https?:\/\//i.test(href)) {
      window.location.href = href;
      return;
    }
    navigate(href);
    collapseMenu();
  };

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    const trimmed = searchTerm.trim();
    const target = trimmed ? `/products?q=${encodeURIComponent(trimmed)}` : '/products';
    navigate(target);
    setIsSearchOpen(false);
    setIsCategoryOpen(false);
    if (window.matchMedia('(max-width: 768px)').matches) {
      collapseMenu();
    }
  };

  const createTimeline = () => {
    const navEl = navRef.current;
    if (!navEl) return null;

    gsap.set(navEl, { height: 80, overflow: 'hidden' });
    gsap.set(cardsRef.current, { y: 50, opacity: 0 });

    const tl = gsap.timeline({ paused: true });

    tl.to(navEl, {
      height: calculateHeight,
      duration: 0.4,
      ease
    });

    tl.to(cardsRef.current, { y: 0, opacity: 1, duration: 0.4, ease, stagger: 0.08 }, '-=0.1');

    return tl;
  };

  useLayoutEffect(() => {
    const tl = createTimeline();
    tlRef.current = tl;

    return () => {
      tl?.kill();
      tlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ease, items]);

  useLayoutEffect(() => {
    const handleResize = () => {
      if (!tlRef.current) return;

      if (isExpanded) {
        const newHeight = calculateHeight();
        gsap.set(navRef.current, { height: newHeight });

        tlRef.current.kill();
        const newTl = createTimeline();
        if (newTl) {
          newTl.progress(1);
          tlRef.current = newTl;
        }
      } else {
        tlRef.current.kill();
        const newTl = createTimeline();
        if (newTl) {
          tlRef.current = newTl;
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  const setCardRef = i => el => {
    if (el) cardsRef.current[i] = el;
  };

  const handleCartClick = () => {
    dismissBadge();
    navigate('/cart');
    collapseMenu();
    setIsCategoryOpen(false);
  };

  const handleUserClick = () => {
    if (token) {
      navigate('/profile');
    } else {
      navigate('/login');
    }
    collapseMenu();
    setIsCategoryOpen(false);
  };

  const handleNotificationClick = () => {
    navigate('/notifications');
    collapseMenu();
    setIsCategoryOpen(false);
  };

  const handleCategoryClick = async () => {
    // Toggle category filter panel
    const next = !isCategoryOpen;
    setIsCategoryOpen(next);

    // Lazy-load categories when opening the panel for the first time
    if (next && categories.length === 0) {
      try {
        setLoadingCategories(true);
        const data = await listCategories({ limit: 24 });
        setCategories(data);
      } catch (e) {
        console.error('Failed to load categories for navbar:', e);
      } finally {
        setLoadingCategories(false);
      }
    }
  };

  const handleSelectCategory = (cat) => {
    if (!cat) {
      navigate('/products');
    } else {
      navigate(`/products?categoryId=${encodeURIComponent(cat.id)}`);
    }
    setIsCategoryOpen(false);
  };

  // Close category dropdown when clicking outside
  useEffect(() => {
    if (!isCategoryOpen) return;

    const handleClickOutside = (event) => {
      const btn = categoryButtonRef.current;
      const panel = categoryDropdownRef.current;
      if (
        btn &&
        panel &&
        !btn.contains(event.target) &&
        !panel.contains(event.target)
      ) {
        setIsCategoryOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCategoryOpen]);

  return (
    <>
      <div
        className={`card-nav-container fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[1400px] z-[99] px-4 pt-3 pb-2 transition-all duration-300 ease-in-out bg-white/80 dark:bg-gray-900/80 backdrop-blur-md ${className}`}
      >
        <nav
          ref={navRef}
          className={`card-nav ${isExpanded ? 'open' : ''} ${isSearchOpen ? 'search-mode' : ''} block h-auto min-h-[80px] p-0 rounded-xl shadow-lg relative overflow-visible will-change-[height] bg-white dark:bg-gray-900 transition-all duration-150 ease-in-out border border-gray-200 dark:border-gray-800`}
        >
          {/* Main Header Bar */}
          <div className={`card-nav-top w-full h-[80px] flex items-center justify-between px-4 py-2 z-[2] transition-all duration-150 ease-in-out ${
            isSearchOpen ? 'opacity-0 scale-95 pointer-events-none absolute' : 'opacity-100 scale-100 relative'
          }`}>
            {/* Left Section: Logo */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                onClick={() => {
                  navigate('/');
                  collapseMenu();
                }}
                className="flex items-center gap-2 group"
                aria-label="Trang chủ"
              >
                <img 
                  src="/images/logo-main.jpg" 
                  alt="GearUp Logo" 
                  className="h-10 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
                  onError={(e) => {
                    // Fallback to logo.jpg if logo-main.png doesn't exist
                    e.target.src = '/images/logo.jpg';
                  }}
                />
              </button>
            </div>

            {/* Center Section: Category Button and Search */}
            <div className="flex-1 flex items-center gap-3 mx-4">
              {/* Category Button */}
              <button
                ref={categoryButtonRef}
                onClick={handleCategoryClick}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 ${
                  isCategoryOpen 
                    ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600' 
                    : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
                aria-label={isCategoryOpen ? 'Đóng danh mục sản phẩm' : 'Mở danh mục sản phẩm'}
              >
                <FaBars className="text-gray-700 dark:text-gray-300" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:inline">
                  Danh mục sản phẩm
                </span>
              </button>

              {/* Search Bar */}
              <div className="flex-1 relative">
                <form onSubmit={handleSearchSubmit} className="w-full">
                  <div className="relative">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Bạn muốn mua gì hôm nay..."
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </form>
              </div>
            </div>

            {/* Right Section: User, Notifications, Cart */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* User Account */}
              <button
                onClick={handleUserClick}
                className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
                aria-label={token ? 'Tài khoản' : 'Đăng nhập'}
              >
                <FaUser className="text-xl" />
              </button>

              {/* Orders - Always visible for logged in users */}
              {token && (
                <button
                  onClick={() => {
                    navigate('/orders');
                    collapseMenu();
                    setIsCategoryOpen(false);
                  }}
                  className="relative p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
                  aria-label="Đơn hàng"
                  title="Đơn hàng"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </button>
              )}

              {/* Notifications */}
              {token && (
                <button
                  onClick={handleNotificationClick}
                  className="relative p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
                  aria-label="Thông báo"
                >
                  <FaBell className="text-xl" />
                </button>
              )}

              {/* Shopping Cart - Always visible */}
              <button
                onClick={handleCartClick}
                className="relative p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
                aria-label="Giỏ hàng"
              >
                <FaShoppingCart className="text-xl" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Expanded Menu Content */}
          <div
            className={`card-nav-content absolute left-0 right-0 top-[80px] bottom-0 p-4 flex flex-col items-stretch gap-3 justify-start z-[1] bg-white dark:bg-gray-900 ${
              isExpanded ? 'visible pointer-events-auto' : 'invisible pointer-events-none'
            } md:flex-row md:items-start md:gap-4`}
            aria-hidden={!isExpanded}
          >
            {(items || []).slice(0, 3).map((item, idx) => (
              <div
                key={`${item.label}-${idx}`}
                className="nav-card select-none relative flex flex-col gap-2 p-4 rounded-lg min-w-0 flex-1 h-auto min-h-[120px] shadow-sm border border-gray-200 dark:border-gray-700"
                ref={setCardRef(idx)}
                style={{ backgroundColor: item.bgColor || 'white', color: item.textColor || '#000' }}
              >
                <div className="nav-card-label font-semibold tracking-tight text-lg md:text-xl mb-2">
                  {item.label}
                </div>
                <div className="nav-card-links mt-auto flex flex-col gap-2">
                  {item.links?.map((lnk, i) => (
                    <button
                      type="button"
                      key={`${lnk.label}-${i}`}
                      className="nav-card-link inline-flex items-center gap-2 no-underline cursor-pointer transition-opacity duration-300 hover:opacity-75 text-left text-sm md:text-base"
                      onClick={() => handleLinkNavigation(lnk.href)}
                      aria-label={lnk.ariaLabel || lnk.label}
                    >
                      <GoArrowUpRight className="nav-card-link-icon shrink-0" aria-hidden="true" />
                      {lnk.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>
      </div>

      {/* Global category dropdown overlay - always on top of content */}
      {isCategoryOpen && (
        <div className="fixed inset-x-0 top-[100px] z-[120] flex justify-center pointer-events-none">
          <div className="w-[90%] max-w-[1400px] flex justify-start px-4">
            <div
              ref={categoryDropdownRef}
              className="w-72 max-h-[420px] rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl overflow-y-auto pointer-events-auto"
            >
            {loadingCategories ? (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                <span className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-primary animate-spin" />
                <span>Đang tải danh mục...</span>
              </div>
            ) : (
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => handleSelectCategory(null)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 text-xs font-semibold">
                      All
                    </span>
                    <span className="text-left">Tất cả sản phẩm</span>
                  </span>
                  <SlArrowRight className="text-xs opacity-60" />
                </button>
                <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectCategory(cat)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 text-xs font-semibold">
                        {(cat.name || '').charAt(0) || '•'}
                      </span>
                      <span className="text-left line-clamp-1">{cat.name}</span>
                    </span>
                    <SlArrowRight className="text-xs opacity-60" />
                  </button>
                ))}
              </div>
            )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CardNav;
