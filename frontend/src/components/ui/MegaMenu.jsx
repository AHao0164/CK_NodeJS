import { motion, AnimatePresence } from 'framer-motion';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listCategories, listBrands } from '../../services/catalog';
import { getCategoryVietnameseName, getCategoryIcon } from '../../constants/categoryMapping';

const MegaMenu = ({ isOpen, onClose, position = 'bottom-center', items = null }) => {
  const [activeCategory, setActiveCategory] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [dynamicCategories, setDynamicCategories] = useState([]);
  const [dynamicBrands, setDynamicBrands] = useState([]);
  const navigate = useNavigate();
  const collectionPrefix = '/collections/';

  // Fetch dynamic categories and brands on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cats, brands] = await Promise.all([
          listCategories({ includeProducts: false }),
          listBrands({})
        ]);
        setDynamicCategories(cats);
        setDynamicBrands(brands);
      } catch (error) {
        console.error('Failed to load menu data:', error);
      } finally {
      }
    };
    fetchData();
  }, []);

  const handleNavigation = (href) => {
    if (!href) return;
    if (/^https?:\/\//i.test(href)) {
      window.location.href = href;
      return;
    }
    if (href.startsWith(collectionPrefix)) {
      const slug = href.slice(collectionPrefix.length);
      const query = slug.replace(/-/g, ' ').trim();
      const target = query ? `/products?q=${encodeURIComponent(query)}` : '/products';
      navigate(target);
    } else {
      navigate(href);
    }
    if (onClose) onClose();
  };

  const handleMenuItem = (item) => {
    if (!item) return;
    if (item.onClick) item.onClick();
    if (item.href) {
      handleNavigation(item.href);
    } else if (onClose) {
      onClose();
    }
  };
  
  // If items prop is provided, show simple menu instead of categories
  const isSimpleMenu = items && items.length > 0;

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleCategory = (categoryId) => {
    if (isMobile) {
      setExpandedCategories(prev => {
        const newSet = new Set(prev);
        if (newSet.has(categoryId)) {
          newSet.delete(categoryId);
        } else {
          newSet.add(categoryId);
        }
        return newSet;
      });
    } else {
      setActiveCategory(activeCategory === categoryId ? null : categoryId);
    }
  };

  // Product categories with icons and complete structure
  const categories = [
    {
      id: 'laptop',
      name: 'Laptop',
      icon: '/images/MegaMenu/icons/laptop.svg',
      href: '/collections/laptop',
      subcategories: [
        {
          title: 'Gaming Laptops',
          items: [
            { name: 'ASUS ROG', href: '/collections/laptop-asus-gaming' },
            { name: 'MSI Gaming', href: '/collections/laptop-msi-gaming' },
            { name: 'Acer Predator', href: '/collections/laptop-acer-gaming' },
            { name: 'Lenovo Legion', href: '/collections/laptop-lenovo-gaming' },
            { name: 'Dell Alienware', href: '/collections/laptop-dell-gaming' }
          ]
        },
        {
          title: 'Business Laptops',
          items: [
            { name: 'ASUS VivoBook', href: '/collections/laptop-asus-vivobook' },
            { name: 'ASUS ZenBook', href: '/collections/laptop-asus-zenbook' },
            { name: 'Acer Aspire', href: '/collections/laptop-acer-aspire' },
            { name: 'Lenovo ThinkPad', href: '/collections/laptop-lenovo-thinkpad' },
            { name: 'Dell Inspiron', href: '/collections/laptop-dell-inspiron' },
            { name: 'HP Pavilion', href: '/collections/laptop-hp-pavilion' }
          ]
        },
        {
          title: 'By Price',
          items: [
            { name: 'Under $600', href: '/collections/laptop-under-600' },
            { name: '$600 - $1000', href: '/collections/laptop-600-1000' },
            { name: '$1000 - $1600', href: '/collections/laptop-1000-1600' },
            { name: 'Over $1600', href: '/collections/laptop-over-1600' }
          ]
        },
        {
          title: 'CPU',
          items: [
            { name: 'Intel Core i3', href: '/collections/laptop-intel-i3' },
            { name: 'Intel Core i5', href: '/collections/laptop-intel-i5' },
            { name: 'Intel Core i7', href: '/collections/laptop-intel-i7' },
            { name: 'AMD Ryzen 5', href: '/collections/laptop-amd-ryzen5' },
            { name: 'AMD Ryzen 7', href: '/collections/laptop-amd-ryzen7' }
          ]
        }
      ]
    },
    {
      id: 'pc',
      name: 'Pre-built PC',
      icon: '/images/MegaMenu/icons/pc.svg',
      href: '/collections/pre-built-pc',
      subcategories: [
        {
          title: 'GEARUP PC',
          items: [
            { name: 'PC GVN i7', href: '/collections/pc-gvn-i7' },
            { name: 'PC GVN i5', href: '/collections/pc-gvn-i5' },
            { name: 'PC GVN AMD', href: '/collections/pc-gvn-amd' },
            { name: 'PC GVN RTX', href: '/collections/pc-gvn-rtx' }
          ]
        },
        {
          title: 'Gaming PC',
          items: [
            { name: 'PC Gaming Intel', href: '/collections/pc-gaming-intel' },
            { name: 'PC Gaming AMD', href: '/collections/pc-gaming-amd' },
            { name: 'PC Gaming RTX 4060', href: '/collections/pc-gaming-rtx4060' },
            { name: 'PC Gaming RTX 4070', href: '/collections/pc-gaming-rtx4070' },
            { name: 'PC Gaming RTX 4080', href: '/collections/pc-gaming-rtx4080' }
          ]
        },
        {
          title: 'Business PC',
          items: [
            { name: 'PC Business Intel', href: '/collections/pc-business-intel' },
            { name: 'PC Business AMD', href: '/collections/pc-business-amd' },
            { name: 'PC Graphics', href: '/collections/pc-graphics' }
          ]
        },
        {
          title: 'By Price',
          items: [
            { name: 'Under $600', href: '/collections/pc-under-600' },
            { name: '$600 - $1000', href: '/collections/pc-600-1000' },
            { name: '$1000 - $1600', href: '/collections/pc-1000-1600' },
            { name: 'Over $1600', href: '/collections/pc-over-1600' }
          ]
        }
      ]
    },
    {
      id: 'components',
      name: 'Components',
      icon: '/images/MegaMenu/icons/ram.svg',
      href: '/collections/components',
      subcategories: [
        {
          title: 'Mainboard',
          items: [
            { name: 'Intel Mainboard', href: '/collections/mainboard-intel' },
            { name: 'AMD Mainboard', href: '/collections/mainboard-amd' },
            { name: 'Gaming Mainboard', href: '/collections/mainboard-gaming' },
            { name: 'Business Mainboard', href: '/collections/mainboard-business' }
          ]
        },
        {
          title: 'CPU',
          items: [
            { name: 'Intel Core i3', href: '/collections/cpu-intel-i3' },
            { name: 'Intel Core i5', href: '/collections/cpu-intel-i5' },
            { name: 'Intel Core i7', href: '/collections/cpu-intel-i7' },
            { name: 'Intel Core i9', href: '/collections/cpu-intel-i9' },
            { name: 'AMD Ryzen 5', href: '/collections/cpu-amd-ryzen5' },
            { name: 'AMD Ryzen 7', href: '/collections/cpu-amd-ryzen7' },
            { name: 'AMD Ryzen 9', href: '/collections/cpu-amd-ryzen9' }
          ]
        },
        {
          title: 'GPU',
          items: [
            { name: 'RTX 4060', href: '/collections/gpu-rtx4060' },
            { name: 'RTX 4070', href: '/collections/gpu-rtx4070' },
            { name: 'RTX 4080', href: '/collections/gpu-rtx4080' },
            { name: 'RTX 4090', href: '/collections/gpu-rtx4090' },
            { name: 'RX 7600', href: '/collections/gpu-rx7600' },
            { name: 'RX 7700', href: '/collections/gpu-rx7700' },
            { name: 'RX 7800', href: '/collections/gpu-rx7800' }
          ]
        },
        {
          title: 'RAM',
          items: [
            { name: 'DDR4 RAM', href: '/collections/ram-ddr4' },
            { name: 'DDR5 RAM', href: '/collections/ram-ddr5' },
            { name: 'Gaming RAM', href: '/collections/ram-gaming' },
            { name: 'RGB RAM', href: '/collections/ram-rgb' }
          ]
        },
        {
          title: 'SSD/HDD',
          items: [
            { name: 'M.2 NVMe SSD', href: '/collections/ssd-m2-nvme' },
            { name: 'SATA SSD', href: '/collections/ssd-sata' },
            { name: '3.5" HDD', href: '/collections/hdd-35' },
            { name: '2.5" HDD', href: '/collections/hdd-25' }
          ]
        },
        {
          title: 'PSU & Case',
          items: [
            { name: 'Gaming PSU', href: '/collections/psu-gaming' },
            { name: 'Modular PSU', href: '/collections/psu-modular' },
            { name: 'Gaming Case', href: '/collections/case-gaming' },
            { name: 'RGB Case', href: '/collections/case-rgb' },
            { name: 'Cooling', href: '/collections/cooling' }
          ]
        }
      ]
    },
    {
      id: 'monitor',
      name: 'Monitor',
      icon: '/images/MegaMenu/icons/monitor.svg',
      href: '/collections/monitor',
      subcategories: [
        {
          title: 'Gaming Monitor',
          items: [
            { name: '144Hz', href: '/collections/monitor-144hz' },
            { name: '165Hz', href: '/collections/monitor-165hz' },
            { name: '240Hz', href: '/collections/monitor-240hz' },
            { name: '360Hz', href: '/collections/monitor-360hz' },
            { name: 'Ultrawide Gaming', href: '/collections/monitor-ultrawide-gaming' }
          ]
        },
        {
          title: 'Graphics Monitor',
          items: [
            { name: '4K UHD', href: '/collections/monitor-4k' },
            { name: '5K', href: '/collections/monitor-5k' },
            { name: '8K', href: '/collections/monitor-8k' },
            { name: 'HDR', href: '/collections/monitor-hdr' },
            { name: 'Color Accurate', href: '/collections/monitor-color-accurate' }
          ]
        },
        {
          title: 'Business Monitor',
          items: [
            { name: 'Full HD', href: '/collections/monitor-fullhd' },
            { name: '2K QHD', href: '/collections/monitor-2k' },
            { name: 'Ultrawide', href: '/collections/monitor-ultrawide' },
            { name: 'Curved', href: '/collections/monitor-curved' },
            { name: 'Budget Friendly', href: '/collections/monitor-budget' }
          ]
        },
        {
          title: 'By Size',
          items: [
            { name: '24 inch', href: '/collections/monitor-24' },
            { name: '27 inch', href: '/collections/monitor-27' },
            { name: '32 inch', href: '/collections/monitor-32' },
            { name: '34 inch', href: '/collections/monitor-34' },
            { name: 'Over 40 inch', href: '/collections/monitor-over-40' }
          ]
        }
      ]
    },
    {
      id: 'gaming-gear',
      name: 'Gaming Gear',
      icon: '/images/MegaMenu/icons/gaming-gear.svg',
      href: '/collections/gaming-gear',
      subcategories: [
        {
          title: 'Keyboard',
          items: [
            { name: 'Mechanical Keyboard', href: '/collections/mechanical-keyboard' },
            { name: 'Gaming Keyboard', href: '/collections/gaming-keyboard' },
            { name: 'RGB Keyboard', href: '/collections/rgb-keyboard' },
            { name: 'Wireless Keyboard', href: '/collections/wireless-keyboard' },
            { name: 'Cherry Switch', href: '/collections/cherry-switch' },
            { name: 'Gateron Switch', href: '/collections/gateron-switch' }
          ]
        },
        {
          title: 'Mouse',
          items: [
            { name: 'Gaming Mouse', href: '/collections/gaming-mouse' },
            { name: 'Wireless Mouse', href: '/collections/wireless-mouse' },
            { name: 'RGB Mouse', href: '/collections/rgb-mouse' },
            { name: 'FPS Mouse', href: '/collections/fps-mouse' },
            { name: 'MOBA Mouse', href: '/collections/moba-mouse' },
            { name: 'Business Mouse', href: '/collections/business-mouse' }
          ]
        },
        {
          title: 'Headset',
          items: [
            { name: 'Gaming Headset', href: '/collections/gaming-headset' },
            { name: 'Wireless Headset', href: '/collections/wireless-headset' },
            { name: 'Studio Headset', href: '/collections/studio-headset' },
            { name: 'RGB Headset', href: '/collections/rgb-headset' },
            { name: 'Microphone', href: '/collections/microphone' },
            { name: 'DAC/AMP', href: '/collections/dac-amp' }
          ]
        },
        {
          title: 'Chair & Desk',
          items: [
            { name: 'Gaming Chair', href: '/collections/gaming-chair' },
            { name: 'Premium Chair', href: '/collections/premium-chair' },
            { name: 'Budget Chair', href: '/collections/budget-chair' },
            { name: 'Gaming Desk', href: '/collections/gaming-desk' },
            { name: 'Standing Desk', href: '/collections/standing-desk' },
            { name: 'L-Shape Desk', href: '/collections/lshape-desk' }
          ]
        }
      ]
    },
    {
      id: 'accessories',
      name: 'Accessories',
      icon: '/images/MegaMenu/icons/charger.svg',
      href: '/collections/accessories',
      subcategories: [
        {
          title: 'Hub & Adapter',
          items: [
            { name: 'USB Hub', href: '/collections/usb-hub' },
            { name: 'Thunderbolt Hub', href: '/collections/thunderbolt-hub' },
            { name: 'HDMI Adapter', href: '/collections/hdmi-adapter' },
            { name: 'DisplayPort Adapter', href: '/collections/displayport-adapter' },
            { name: 'USB-C Hub', href: '/collections/usb-c-hub' }
          ]
        },
        {
          title: 'Charger & Cables',
          items: [
            { name: 'Laptop Charger', href: '/collections/laptop-charger' },
            { name: 'USB-C Charger', href: '/collections/usb-c-charger' },
            { name: 'Wireless Charger', href: '/collections/wireless-charger' },
            { name: 'USB-C Cable', href: '/collections/usb-c-cable' },
            { name: 'HDMI Cable', href: '/collections/hdmi-cable' },
            { name: 'DisplayPort Cable', href: '/collections/displayport-cable' }
          ]
        },
        {
          title: 'Stands & Setup',
          items: [
            { name: 'Monitor Stand', href: '/collections/monitor-stand' },
            { name: 'Laptop Stand', href: '/collections/laptop-stand' },
            { name: 'Phone Stand', href: '/collections/phone-stand' },
            { name: 'Gaming Controller', href: '/collections/gaming-controller' },
            { name: 'Webcam', href: '/collections/webcam' },
            { name: 'Lighting Setup', href: '/collections/lighting-setup' }
          ]
        },
        {
          title: 'Others',
          items: [
            { name: 'Case Fan', href: '/collections/case-fan' },
            { name: 'Thermal Paste', href: '/collections/thermal-paste' },
            { name: 'Cable Management', href: '/collections/cable-management' },
            { name: 'Anti-Static', href: '/collections/anti-static' },
            { name: 'Tool Kit', href: '/collections/tool-kit' }
          ]
        }
      ]
    },
    {
      id: 'services',
      name: 'Services',
      icon: '/images/MegaMenu/icons/gaming-chair.svg',
      href: '/collections/services',
      subcategories: [
        {
          title: 'Installation',
          items: [
            { name: 'Gaming PC Assembly', href: '/collections/gaming-pc-assembly' },
            { name: 'Business PC Assembly', href: '/collections/business-pc-assembly' },
            { name: 'Monitor Installation', href: '/collections/monitor-installation' },
            { name: 'Gaming Room Setup', href: '/collections/gaming-room-setup' },
            { name: 'Software Installation', href: '/collections/software-installation' }
          ]
        },
        {
          title: 'Warranty',
          items: [
            { name: 'PC Warranty', href: '/collections/pc-warranty' },
            { name: 'Laptop Warranty', href: '/collections/laptop-warranty' },
            { name: 'Component Warranty', href: '/collections/component-warranty' },
            { name: 'Gaming Gear Warranty', href: '/collections/gaming-gear-warranty' },
            { name: 'Monitor Warranty', href: '/collections/monitor-warranty' }
          ]
        },
        {
          title: 'Maintenance',
          items: [
            { name: 'PC Cleaning', href: '/collections/pc-cleaning' },
            { name: 'Laptop Cleaning', href: '/collections/laptop-cleaning' },
            { name: 'Thermal Paste Replacement', href: '/collections/thermal-paste-replacement' },
            { name: 'RAM Upgrade', href: '/collections/ram-upgrade' },
            { name: 'SSD Upgrade', href: '/collections/ssd-upgrade' },
            { name: 'GPU Upgrade', href: '/collections/gpu-upgrade' }
          ]
        },
        {
          title: 'Consultation',
          items: [
            { name: 'Gaming PC Consultation', href: '/collections/gaming-pc-consultation' },
            { name: 'Laptop Consultation', href: '/collections/laptop-consultation' },
            { name: 'Setup Consultation', href: '/collections/setup-consultation' },
            { name: 'Component Consultation', href: '/collections/component-consultation' },
            { name: 'Gaming Gear Consultation', href: '/collections/gaming-gear-consultation' }
          ]
        }
      ]
    }
  ];

  // Transform dynamic categories to menu format (merge with static if needed)
  const finalCategories = React.useMemo(() => {
    if (dynamicCategories.length === 0) {
      // Fallback to static categories if dynamic data not loaded
      return categories;
    }
    
    // Transform dynamic categories to menu format with brands as subcategories
    return dynamicCategories.map(cat => {
      // Get relevant brands for this category (simplified grouping)
      const relevantBrands = dynamicBrands.slice(0, 5); // Top 5 brands
      
      const subcategories = [];
      
      // Add "Tất cả" option first
      subcategories.push({
        title: 'Xem tất cả',
        items: [
          { name: `Tất cả ${getCategoryVietnameseName(cat.name)}`, href: `/products?categoryId=${cat.id}` }
        ]
      });
      
      // Add brands section if we have brands
      if (relevantBrands.length > 0) {
        subcategories.push({
          title: 'Theo hãng',
          items: relevantBrands.map(brand => ({
            name: brand.name,
            href: `/products?categoryId=${cat.id}&brandId=${brand.id}`
          }))
        });
      }
      
      // Add price ranges
      subcategories.push({
        title: 'Theo giá',
        items: [
          { name: 'Dưới 10 triệu', href: `/products?categoryId=${cat.id}&maxPrice=10000000` },
          { name: '10-20 triệu', href: `/products?categoryId=${cat.id}&minPrice=10000000&maxPrice=20000000` },
          { name: '20-30 triệu', href: `/products?categoryId=${cat.id}&minPrice=20000000&maxPrice=30000000` },
          { name: 'Trên 30 triệu', href: `/products?categoryId=${cat.id}&minPrice=30000000` }
        ]
      });
      
      return {
        id: cat.id.toString(),
        name: getCategoryVietnameseName(cat.name),
        icon: cat.icon || getCategoryIcon(cat.name, '/images/MegaMenu/icons/laptop.svg'),
        href: `/products?categoryId=${cat.id}`,
        description: cat.description,
        subcategories
      };
    });
  }, [dynamicCategories, dynamicBrands]);

  // Position classes - bottom-center for dock
  const positionClasses = position === 'bottom-center' 
    ? 'bottom-24 left-1/2 -translate-x-1/2 w-[calc(100vw-2rem)] max-w-6xl'
    : 'top-4 right-4 h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-5xl';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={`fixed ${positionClasses} ${
            isMobile ? 'max-w-sm' : ''
          } bg-white dark:bg-gray-900 z-[9999] shadow-2xl rounded-2xl overflow-hidden`}
          initial={{ opacity: 0, y: position === 'bottom-center' ? 20 : 0, x: position === 'bottom-center' ? '-50%' : '100%' }}
          animate={{ opacity: 1, y: position === 'bottom-center' ? 0 : 0, x: position === 'bottom-center' ? '-50%' : 0 }}
          exit={{ opacity: 0, y: position === 'bottom-center' ? 20 : 0, x: position === 'bottom-center' ? '-50%' : '100%' }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        >
          {isSimpleMenu ? (
            // Simple Menu for Account/Profile
            <div className="p-6">
              <h2 className="text-2xl font-bitcount font-normal text-gray-900 dark:text-white mb-4">
                Menu tài khoản
              </h2>
              <div className="space-y-2">
                {items.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <button
                      type="button"
                      onClick={() => handleMenuItem(item)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-primary/10 hover:text-primary dark:hover:text-primary transition-all duration-200 text-left group relative"
                    >
                      {item.icon && (
                        <span className="text-xl relative">
                          {item.icon}
                          {item.badge && item.badge > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 text-white 
                                           rounded-full flex items-center justify-center font-bold text-[9px]">
                              {item.badge > 9 ? '9+' : item.badge}
                            </span>
                          )}
                        </span>
                      )}
                      <span className="font-medium">{item.label}</span>
                      {item.badge && item.badge > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs font-semibold rounded-full animate-pulse">
                          {item.badge}
                        </span>
                      )}
                      <svg className="w-4 h-4 ml-auto text-gray-400 group-hover:text-primary group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : isMobile ? (
            // Mobile Layout - Single Column with Dropdowns
            <div className="h-full max-h-[70vh] overflow-y-auto">
              <div className="p-4">
                <h2 className="text-3xl font-bitcount font-normal text-gray-900 dark:text-white mb-4">
                  Sản phẩm của chúng tôi
                </h2>
                <nav className="space-y-2">
                  {finalCategories.map((category) => (
                    <div key={category.id} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                      <motion.button
                        className={`w-full flex items-center justify-between p-4 text-left transition-all duration-300 ${
                          expandedCategories.has(category.id)
                            ? 'bg-primary text-white'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                        onClick={() => toggleCategory(category.id)}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-center">
                          <img 
                            src={category.icon} 
                            alt={category.name}
                            className={`w-5 h-5 mr-3 transition-all duration-300 ${
                              expandedCategories.has(category.id) 
                                ? 'brightness-0 invert' 
                                : 'brightness-0 invert-0 dark:brightness-0 dark:invert'
                            }`}
                          />
                          <span className="font-medium">{category.name}</span>
                        </div>
                        <motion.svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          animate={{ rotate: expandedCategories.has(category.id) ? 180 : 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </motion.svg>
                      </motion.button>
                      
                      <motion.div
                        initial={false}
                        animate={{ 
                          height: expandedCategories.has(category.id) ? 'auto' : 0,
                          opacity: expandedCategories.has(category.id) ? 1 : 0
                        }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                          <div className="space-y-4">
                            {category.subcategories.map((subcategory, index) => (
                              <div key={index} className="space-y-2">
                                <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-sm border-b border-primary pb-1">
                                  {subcategory.title}
                                </h4>
                                <ul className="space-y-1">
                                  {subcategory.items.map((item, itemIndex) => (
                                    <li key={itemIndex}>
                                      <button
                                        type="button"
                                        onClick={() => handleNavigation(item.href)}
                                        className="w-full text-left text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary-light transition-colors duration-200 block py-1 px-2 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                                      >
                                        {item.name}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  ))}
                </nav>
              </div>
            </div>
          ) : (
            // Desktop Layout - Two Column
            <div className="h-full max-h-[70vh] flex">
              {/* Categories Sidebar */}
              <div className="w-64 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
                <div className="p-6">
                  <h2 className="text-3xl font-bitcount font-normal text-gray-900 dark:text-white mb-6">
                    Sản phẩm của chúng tôi
                  </h2>
                  <nav className="space-y-2">
                    {finalCategories.map((category) => (
                      <motion.button
                        type="button"
                        key={category.id}
                        className={`w-full flex items-center p-4 rounded-xl transition-all duration-300 ${
                          activeCategory === category.id
                            ? 'bg-primary text-white shadow-lg transform scale-105'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md'
                        }`}
                        onMouseEnter={() => setActiveCategory(category.id)}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleNavigation(category.href)}
                      >
                        <img 
                          src={category.icon} 
                          alt={category.name}
                          className={`w-6 h-6 mr-4 transition-all duration-300 ${
                            activeCategory === category.id 
                              ? 'brightness-0 invert' 
                              : 'brightness-0 invert-0 dark:brightness-0 dark:invert'
                          }`}
                        />
                        <span className="font-medium text-base">{category.name}</span>
                        <svg
                          className="w-5 h-5 ml-auto"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </motion.button>
                    ))}
                  </nav>
                </div>
              </div>

              {/* Subcategories Content */}
              <div className="flex-1 overflow-y-auto bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
                <div className="p-8">
                  {activeCategory ? (
                    <motion.div
                      key={activeCategory}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="mb-8">
                        <h3 className="text-3xl font-bitcount font-normal text-gray-900 dark:text-white">
                          {finalCategories.find(cat => cat.id === activeCategory)?.name}
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {finalCategories
                          .find(cat => cat.id === activeCategory)
                          ?.subcategories.map((subcategory, index) => (
                            <motion.div 
                              key={index} 
                              className="space-y-4"
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3, delay: index * 0.1 }}
                            >
                              <h4 className="font-bold text-gray-800 dark:text-gray-200 text-lg border-b-2 border-primary pb-2">
                                {subcategory.title}
                              </h4>
                              <ul className="space-y-2">
                                {subcategory.items.map((item, itemIndex) => (
                                  <li key={itemIndex}>
                                    <button
                                      type="button"
                                      onClick={() => handleNavigation(item.href)}
                                      className="w-full text-left text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary-light transition-colors duration-200 block py-2 px-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                                    >
                                      {item.name}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </motion.div>
                          ))}
                      </div>
                    </motion.div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center">
                          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        </div>
                        <h3 className="text-2xl font-semibold text-gray-600 dark:text-gray-400 mb-2">
                          Chọn danh mục để xem sản phẩm
                        </h3>
                        <p className="text-gray-500 dark:text-gray-500">
                          Di chuột qua danh mục bên trái để xem chi tiết
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-primary hover:bg-primary/90 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl z-[130]"
          >
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MegaMenu;
