import { useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { GoArrowUpRight } from 'react-icons/go';
import { SlArrowRight } from 'react-icons/sl';
import { FaSearch, FaTimes } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const CardNav = ({
  items,
  className = '',
  ease = 'power3.out'
}) => {
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const navRef = useRef(null);
  const cardsRef = useRef([]);
  const tlRef = useRef(null);

  const calculateHeight = () => {
    const navEl = navRef.current;
    if (!navEl) return 260;

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
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

        const topBar = 60;
        const padding = 16;
        const contentHeight = contentEl.scrollHeight;

        contentEl.style.visibility = wasVisible;
        contentEl.style.pointerEvents = wasPointerEvents;
        contentEl.style.position = wasPosition;
        contentEl.style.height = wasHeight;

        return topBar + contentHeight + padding;
      }
    }
    return 260;
  };

  const collapseMenu = () => {
    if (!isExpanded) return;
    const tl = tlRef.current;
    setIsHamburgerOpen(false);
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
    if (window.matchMedia('(max-width: 768px)').matches) {
      collapseMenu();
    }
  };

  const createTimeline = () => {
    const navEl = navRef.current;
    if (!navEl) return null;

    gsap.set(navEl, { height: 60, overflow: 'hidden' });
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

  // Removed scroll behavior - navbar is always absolute

  const toggleMenu = () => {
    const tl = tlRef.current;
    if (!tl) return;
    if (!isExpanded) {
      setIsHamburgerOpen(true);
      setIsExpanded(true);
      tl.play(0);
    } else {
      setIsHamburgerOpen(false);
      tl.eventCallback('onReverseComplete', () => setIsExpanded(false));
      tl.reverse();
    }
  };


  const setCardRef = i => el => {
    if (el) cardsRef.current[i] = el;
  };

  return (
    <>
      <div
        className={`card-nav-container relative left-1/2 -translate-x-1/2 w-[90%] max-w-[800px] z-[99] my-2 pt-3 transition-all duration-300 ease-in-out ${className}`}
      >
      <nav
        ref={navRef}
        className={`card-nav ${isExpanded ? 'open' : ''} ${isSearchOpen ? 'search-mode' : ''} block h-[60px] p-0 rounded-xl shadow-md relative overflow-hidden will-change-[height] bg-primary transition-all duration-150 ease-in-out`}
      >
        <div         className={`card-nav-top absolute inset-x-0 top-0 h-[60px] flex items-center justify-between p-2 pl-[1.1rem] z-[2] transition-all duration-150 ease-in-out ${
          isSearchOpen ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
        }`}>
          <div
            className={`menu-toggle ${isHamburgerOpen ? 'open' : ''} group h-full flex items-center justify-center cursor-pointer order-1 md:order-none text-white`}
            onClick={toggleMenu}
            role="button"
            aria-label={isExpanded ? 'Close menu' : 'Open menu'}
            tabIndex={0}
          >
            <SlArrowRight 
              className={`w-6 h-6 transition-transform duration-300 ease-linear ${
                isHamburgerOpen ? 'rotate-90' : 'rotate-0'
              } group-hover:opacity-75`}
            />
          </div>

          <div className="logo-container flex items-center md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 order-2 md:order-none">
            <button
              type="button"
              onClick={() => {
                navigate('/');
                collapseMenu();
              }}
              className="text-white dark:text-white tracking-widest text-xl sm:text-2xl uppercase lg:text-3xl font-bitcount font-normal cursor-pointer hover:opacity-80 transition-opacity"
            >
              GearUp
            </button>
          </div>

          <div className="flex items-center gap-2 order-3 md:order-none">
            {/* Search Button */}
            <button 
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="p-2 hover:bg-white/20 rounded-full transition-colors duration-200"
              aria-label="Tìm kiếm"
            >
              <FaSearch className="text-lg text-white" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div
          className={`absolute left-0 right-0 top-0 h-[60px] z-[3] bg-primary transition-all duration-150 ease-in-out ${
            isSearchOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
          }`}
        >
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-3 h-full px-4 w-full">
            <div className="flex-1 relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm kiếm sản phẩm..."
                className="w-full pl-10 pr-4 py-2.5 text-base rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/30"
                autoFocus={isSearchOpen}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => setIsSearchOpen(false)}
              className="p-2 hover:bg-white/20 rounded-full transition-colors duration-200"
              aria-label="Đóng"
            >
              <FaTimes className="text-lg text-white" />
            </button>
          </form>
        </div>

        <div
          className={`card-nav-content absolute left-0 right-0 top-[60px] bottom-0 p-2 flex flex-col items-stretch gap-2 justify-start z-[1] ${
            isExpanded ? 'visible pointer-events-auto' : 'invisible pointer-events-none'
          } md:flex-row md:items-end md:gap-[12px]`}
          aria-hidden={!isExpanded}
        >
          {(items || []).slice(0, 3).map((item, idx) => (
            <div
              key={`${item.label}-${idx}`}
              className="nav-card select-none relative flex flex-col gap-2 p-[12px_16px] rounded-[calc(0.75rem-0.2rem)] min-w-0 flex-[1_1_auto] h-auto min-h-[60px] md:h-full md:min-h-0 md:flex-[1_1_0%]"
              ref={setCardRef(idx)}
              style={{ backgroundColor: item.bgColor, color: item.textColor }}
            >
              <div className="nav-card-label font-normal tracking-[-0.5px] text-[18px] md:text-[22px]">
                {item.label}
              </div>
              <div className="nav-card-links mt-auto flex flex-col gap-[2px]">
                {item.links?.map((lnk, i) => (
                  <button
                    type="button"
                    key={`${lnk.label}-${i}`}
                    className="nav-card-link inline-flex items-center gap-[6px] no-underline cursor-pointer transition-opacity duration-300 hover:opacity-75 text-left text-[15px] md:text-[16px]"
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
    </>
  );
};

export default CardNav;
