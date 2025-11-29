import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FaCartPlus, FaHeadset, FaHeart, FaShare, FaStar, FaChevronLeft, FaChevronRight, FaRegStar } from 'react-icons/fa';
import { io } from 'socket.io-client';
import { addItemToCart, addGuestItemToCart } from '../../services/cart';
import { getProductById } from '../../services/catalog';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCart } from '../../context/CartContext.jsx';
import { useToast } from '../../ui/Toast';
import VI from '../../constants/vi';

// Helper function to get full image URL
const getImageUrl = (url) => {
  if (!url) return '/images/products/ideapad.png';
  if (url.startsWith('http')) return url;
  return `http://localhost:8080${url}`;
};

const ProductDetail = () => {
  const toast = useToast();
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { user, api, token } = useAuth();
  const { refreshCart } = useCart();

  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [product, setProduct] = useState(null);
  const [availableStock, setAvailableStock] = useState(0);
  const [variants, setVariants] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [productCategory, setProductCategory] = useState(null); // Store category info for breadcrumb
  
  // Reviews state
  const [reviews, setReviews] = useState([]);
  const [guestComments, setGuestComments] = useState([]); // Guest comments (no rating)
  const [reviewsStats, setReviewsStats] = useState({ average: 0, total: 0, filtered: 0 });
  const [reviewsDistribution, setReviewsDistribution] = useState({});
  const [userRating, setUserRating] = useState(0);
  const [userComment, setUserComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [guestName, setGuestName] = useState(''); // Optional name for guest comments
  const [submittingGuestComment, setSubmittingGuestComment] = useState(false);
  
  // Pagination & Filter state
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsPerPage] = useState(5);
  const [reviewsFilter, setReviewsFilter] = useState(''); // '' = all, '5' = 5 stars, etc.
  
  // Reply state
  const [replyingTo, setReplyingTo] = useState(null); // reviewId being replied to
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [unreadReplies, setUnreadReplies] = useState(0); // Badge count
  const [autoRefreshing, setAutoRefreshing] = useState(false); // Auto-refresh indicator
  
  // WebSocket connection
  const socketRef = useRef(null);

  // Dữ liệu sản phẩm mẫu fallback
  const fallbackProduct = {
    id: 1,
    name: "IdeaPad Pro 5i (14'', Gen 9)",
    description: "Massive computing power accompanied with vivid graphics",
    price: 25990000,
    originalPrice: 29990000,
    discount: 13,
    rating: 4.8,
    reviewCount: 127,
    images: [
      "/images/products/ideapad.png",
      "/images/products/ideapad-2.png", 
      "/images/products/ideapad-3.png"
    ],
    features: [
      "Intel® Core™ Ultra processors for handling complex, professional-grade tasks",
      "Exceptional realism & vibrant visuals captured on the 14″ OLED display",
      "Highly competent for quick charging, supreme speed, & expandable storage",
      "Optimized with Lenovo AI Engine for enhanced productivity, battery life, & more"
    ],
    techSpecs: {
      performance: {
        processor: "Up to 14th Gen Intel® Core™ Ultra 9 185H",
        operatingSystem: "Up to Windows 11 Pro",
        graphics: "Intel® Arc™ Graphics",
        memory: "Up to 32GB LPDDR5X",
        storage: "Up to 1TB PCIe M.2",
        battery: "Up to 12.5hours (MM25), Up to 25hours (1080p Video Playback), 84Whr, Polymer, Supports Rapid Charge Express"
      },
      connectivity: {
        ports: {
          left: ["Thunderbolt™ 4", "USB-C 3.2 Gen 1 (power delivery, display port)", "HDMI 2.1 (supports 4096 x 2160@60Hz)"],
          right: ["2 x USB-A 3.2 Gen 1", "SD card reader", "Headphone / mic combo"]
        },
        wireless: ["WiFi 6E", "Bluetooth® 5.2"]
      },
      design: {
        display: "14″ 2.8K (2880 x 1800) OLED, 120 Hz, 16:10, 400 nits, 100% DCI-P3, TÜV Low Blue Light Certification, TÜV Eyesafe® Display Certification",
        dimensions: "312mm x 221mm x as thin as 15.99mm / 12.28″ x 8.70″ x as thin as 0.63″",
        weight: "Starting at 1.46kg / 3.22lbs",
        color: "Arctic Grey"
      },
      audio: {
        speakers: "2 x 2W speakers",
        audio: "Audio by Dolby Atmos®",
        microphone: "Dual Mic"
      },
      camera: {
        camera: "Infrared FHD camera with time-of-flight sensor",
        privacy: "Privacy shutter"
      }
    },
    relatedProducts: [
      { id: 2, name: "ThinkPad X1 Carbon Gen 12", price: 32990000, image: "/images/products/ideapad.png", rating: 4.9 },
      { id: 3, name: "Yoga 9i (14'', Gen 9)", price: 28990000, image: "/images/products/ideapad-2.png", rating: 4.7 },
      { id: 4, name: "Legion Pro 7i (16'', Gen 9)", price: 45990000, image: "/images/products/ideapad-3.png", rating: 4.8 }
    ]
  };

  // Load reviews with pagination and filter
  const loadReviews = async (pid) => {
    try {
      const apiUrl = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
      const params = new URLSearchParams();
      params.append('limit', reviewsPerPage.toString());
      params.append('offset', ((reviewsPage - 1) * reviewsPerPage).toString());
      if (reviewsFilter) params.append('rating', reviewsFilter);
      
      console.log('Loading reviews:', { pid, page: reviewsPage, filter: reviewsFilter, url: `${apiUrl}/catalog/products/${pid}/reviews?${params.toString()}` });
      
      const res = await fetch(`${apiUrl}/catalog/products/${pid}/reviews?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        console.log('Reviews loaded:', data);
        setReviews(data.reviews || []);
        setGuestComments(data.guestComments || []); // Load guest comments
        setReviewsStats(data.stats || { average: 0, total: 0, filtered: 0 });
        setReviewsDistribution(data.distribution || {});
        
        // Count unread replies for current user
        if (user) {
          let unread = 0;
          (data.reviews || []).forEach(review => {
            if (review.user_id === user.id && review.comments && review.comments.length > 0) {
              // Check if there are admin replies the user hasn't seen
              const hasAdminReply = review.comments.some(c => c.is_admin);
              if (hasAdminReply) {
                // Check localStorage for last seen timestamp
                const lastSeen = localStorage.getItem(`review_${review.id}_last_seen`);
                const latestCommentTime = new Date(review.comments[review.comments.length - 1].created_at).getTime();
                if (!lastSeen || parseInt(lastSeen) < latestCommentTime) {
                  unread++;
                }
              }
            }
          });
          setUnreadReplies(unread);
        }
        
        return data.stats || { average: 0, total: 0, filtered: 0 };
      }
    } catch (err) {
      console.error('Failed to load reviews:', err);
    }
    return { average: 0, total: 0, filtered: 0 };
  };

  useEffect(() => {
    const load = async (pid) => {
      setLoading(true);
      try {
        const p = await getProductById(pid);
        
        // Lưu category info cho breadcrumb
        if (p.category_id && p.category) {
          setProductCategory({ id: p.category_id, name: p.category });
        }
        
        // Tính giảm giá từ discount_percent
        const discountPercent = p.discount_percent || 0;
        const finalPrice = Math.round(p.price_cents * (100 - discountPercent) / 100);
        
        // Load reviews
        const reviewData = await loadReviews(pid);
        
        // Lấy sản phẩm liên quan từ API (cùng category hoặc brand)
        let relatedProds = [];
        try {
          const apiUrl = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
          const relatedRes = await fetch(`${apiUrl}/catalog/products/${pid}/related?limit=8`);
          if (relatedRes.ok) {
            const relatedData = await relatedRes.json();
            relatedProds = relatedData.products.map(rp => {
              const rpDiscountPercent = rp.discount_percent || 0;
              const rpFinalPrice = Math.round(rp.price_cents * (100 - rpDiscountPercent) / 100);
              return {
                id: rp.id,
                name: rp.name,
                price: rpFinalPrice,
                originalPrice: rp.price_cents,
                discount: rpDiscountPercent,
                image: rp.image_url || fallbackProduct.images[0],
                rating: 4.8
              };
            });
          }
        } catch (err) {
          console.error('Failed to load related products:', err);
        }
        
        // Handle variants
        const hasVariants = p.variants && Array.isArray(p.variants) && p.variants.length > 0;
        let defaultVariant = null;
        let productPrice = finalPrice;
        let productOriginalPrice = p.price_cents;
        let productDiscount = discountPercent;
        let productStock = p.stock || 0;
        
        if (hasVariants) {
          setVariants(p.variants);
          // Select first variant by default
          defaultVariant = p.variants[0];
          setSelectedVariant(defaultVariant);
          const variantDiscount = defaultVariant.discount_percent || 0;
          productPrice = Math.round(defaultVariant.price_cents * (100 - variantDiscount) / 100);
          productOriginalPrice = defaultVariant.price_cents;
          productDiscount = variantDiscount;
          productStock = defaultVariant.stock || 0;
        } else {
          setVariants([]);
          setSelectedVariant(null);
        }
        
        const mapped = {
          id: p.id,
          name: p.name,
          description: p.description,
          price: productPrice,
          originalPrice: productOriginalPrice,
          discount: productDiscount,
          rating: reviewData.average || 0,
          reviewCount: reviewData.total || 0,
          images: Array.isArray(p.images) && p.images.length ? p.images.map(img => img.url) : fallbackProduct.images,
          // Sử dụng specs từ database nếu có, fallback về hardcode
          techSpecs: p.specs && Object.keys(p.specs).length > 0 ? p.specs : fallbackProduct.techSpecs,
          // Sử dụng features từ database nếu có, fallback về hardcode
          features: Array.isArray(p.features) && p.features.length > 0 ? p.features : fallbackProduct.features,
          relatedProducts: relatedProds.length > 0 ? relatedProds : fallbackProduct.relatedProducts
        };
        console.log('Product features from API:', { 
          raw: p.features, 
          isArray: Array.isArray(p.features),
          length: p.features?.length,
          type: typeof p.features,
          mapped: mapped.features
        });
        setProduct(mapped);
        setAvailableStock(productStock);
        
        // Set document title
        document.title = `${p.name} - GearUp`;
      } catch (e) {
        setProduct(fallbackProduct);
      } finally {
        setLoading(false);
      }
    };

    if (routeId) load(Number(routeId));
    else setProduct(fallbackProduct);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  // WebSocket connection for real-time reviews (required feature)
  useEffect(() => {
    if (!routeId) return;
    
    const productId = Number(routeId);
    let pollingInterval = null;
    
    // Catalog service runs on port 3002, not 8080 (gateway)
    const catalogServicePort = import.meta.env.VITE_CATALOG_SERVICE_PORT || '3002';
    const apiUrl = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
    const wsHost = apiUrl.replace(/^https?:\/\//, '').split(':')[0] || 'localhost';
    const socketUrl = `http://${wsHost}:${catalogServicePort}`;
    
    console.log('Connecting to WebSocket at:', socketUrl);
    
    // Connect to WebSocket (required feature)
    socketRef.current = io(socketUrl, {
      transports: ['polling', 'websocket'], // Try polling first, then websocket
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 5000,
      autoConnect: true,
      forceNew: false
    });
    
    const socket = socketRef.current;
    
    // Join product room when connected
    socket.on('connect', () => {
      console.log('✅ WebSocket connected for real-time updates');
      socket.emit('join-product', productId);
      // Clear polling if WebSocket connects successfully
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    });
    
    // Listen for review updates
    socket.on('review-updated', (data) => {
      console.log('Review updated via WebSocket:', data);
      setAutoRefreshing(true);
      loadReviews(productId).finally(() => {
        setTimeout(() => setAutoRefreshing(false), 500);
      });
    });
    
    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      // Start polling fallback when disconnected
      if (!pollingInterval) {
        pollingInterval = setInterval(() => {
          loadReviews(productId).catch(() => {
            // Silently fail
          });
        }, 10000); // Poll every 10 seconds when WebSocket is down
      }
    });
    
    socket.on('connect_error', (error) => {
      // Log error but don't spam console
      console.warn('WebSocket connection error (will retry):', error.message);
      // Start polling fallback immediately
      if (!pollingInterval) {
        pollingInterval = setInterval(() => {
          loadReviews(productId).catch(() => {
            // Silently fail
          });
        }, 10000); // Poll every 10 seconds as fallback
      }
    });
    
    // Start polling as initial fallback (will be cleared if WebSocket connects)
    pollingInterval = setInterval(() => {
      if (!socket.connected) {
        loadReviews(productId).catch(() => {
          // Silently fail
        });
      } else {
        // WebSocket is connected, clear polling
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    }, 10000);
    
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      if (socket && socket.connected) {
        socket.emit('leave-product', productId);
        socket.disconnect();
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [routeId]);

  // Scroll to top when product changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [routeId]);

  // Reload reviews when page or filter changes
  useEffect(() => {
    if (routeId) {
      loadReviews(Number(routeId));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewsPage, reviewsFilter]);

  // Handle guest comment submission (no login required, no rating)
  const handleSubmitGuestComment = async () => {
    if (!userComment.trim()) {
      toast.show('Vui lòng nhập bình luận', { type: 'error' });
      return;
    }

    setSubmittingGuestComment(true);
    try {
      const apiUrl = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
      const res = await fetch(`${apiUrl}/catalog/products/${routeId}/guest-comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          comment: userComment.trim(),
          guestName: guestName.trim() || null
        })
      });

      if (res.ok) {
        toast.show('Bình luận của bạn đã được gửi!', { type: 'success' });
        setUserComment('');
        setGuestName('');
        setReviewsPage(1);
        await loadReviews(Number(routeId));
      } else {
        const errData = await res.json();
        toast.show(errData.error || 'Không thể gửi bình luận', { type: 'error' });
      }
    } catch (err) {
      console.error('Submit guest comment error:', err);
      toast.show('Lỗi khi gửi bình luận', { type: 'error' });
    } finally {
      setSubmittingGuestComment(false);
    }
  };

  const handleSubmitReview = async () => {
    // Debug: Log ra giá trị để kiểm tra
    console.log('Token:', token, 'User:', user);
    
    // Kiểm tra cả token và user object có tồn tại không
    if (!token || !user || !user.id) {
      console.log('Authentication check failed:', { token: !!token, user: !!user, userId: user?.id });
      toast.show('Vui lòng đăng nhập để đánh giá sản phẩm', { type: 'error' });
      localStorage.setItem('returnUrl', window.location.pathname);
      navigate('/login');
      return;
    }
    if (userRating === 0) {
      toast.show('Vui lòng chọn số sao đánh giá', { type: 'error' });
      return;
    }

    setSubmittingReview(true);
    try {
      const apiUrl = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
      const res = await fetch(`${apiUrl}/catalog/products/${routeId}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user.id,
          rating: userRating,
          comment: userComment.trim() || null
        })
      });

      if (res.ok) {
        toast.show('Đánh giá của bạn đã được gửi!', { type: 'success' });
        setUserRating(0);
        setUserComment('');
        // Chỉ reset về trang 1, GIỮ NGUYÊN filter hiện tại
        setReviewsPage(1);
        await loadReviews(Number(routeId));
      } else {
        const errData = await res.json();
        toast.show(errData.error || 'Không thể gửi đánh giá', { type: 'error' });
      }
    } catch (err) {
      console.error('Submit review error:', err);
      toast.show('Lỗi khi gửi đánh giá', { type: 'error' });
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleSubmitReply = async (reviewId) => {
    if (!token || !user || !user.id) {
      toast.show('Vui lòng đăng nhập để phản hồi', { type: 'error' });
      // Save current location to return after login
      localStorage.setItem('returnUrl', window.location.pathname);
      navigate('/login');
      return;
    }
    if (!replyText.trim()) {
      toast.show('Vui lòng nhập nội dung phản hồi', { type: 'error' });
      return;
    }

    setSubmittingReply(true);
    try {
      const apiUrl = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
      const res = await fetch(`${apiUrl}/catalog/reviews/${reviewId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user.id,
          comment: replyText.trim(),
          isAdmin: user.role === 'ADMIN'
        })
      });

      if (res.ok) {
        toast.show('Phản hồi đã được gửi!', { type: 'success' });
        setReplyText('');
        setReplyingTo(null);
        // Mark as seen for this review
        localStorage.setItem(`review_${reviewId}_last_seen`, Date.now().toString());
        await loadReviews(Number(routeId));
      } else {
        const errData = await res.json();
        toast.show(errData.error || 'Không thể gửi phản hồi', { type: 'error' });
      }
    } catch (err) {
      console.error('Submit reply error:', err);
      toast.show('Lỗi khi gửi phản hồi', { type: 'error' });
    } finally {
      setSubmittingReply(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  };

  const handleAddToCart = async () => {
    if (!product) return;
    
    // Check if variant is required but not selected
    if (variants.length > 0 && !selectedVariant) {
      toast.show('Vui lòng chọn phiên bản sản phẩm', { type: 'error' });
      return;
    }
    
    const priceCents = selectedVariant ? selectedVariant.price_cents : (product.price_cents || product.originalPrice || product.price);
    const variantId = selectedVariant ? selectedVariant.id : null;
    
    // Đã đăng nhập: thêm vào giỏ hàng của user
    if (token) {
      try {
        setError('');
        setLoading(true);
        await addItemToCart(api, { 
          productId: product.id, 
          variantId: variantId,
          quantity, 
          priceCents: priceCents 
        });
        await refreshCart();
        toast.show('✓ Đã thêm vào giỏ hàng', { type: 'success' });
      } catch (e) {
        setError(e.message || 'Lỗi khi thêm vào giỏ hàng');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Khách chưa đăng nhập: thêm vào guest cart
    try {
      setError('');
      setLoading(true);
      let guestCartId = sessionStorage.getItem('guestCartId');
      const { guestCartId: newGuestCartId, items } = await addGuestItemToCart({
        guestCartId,
        productId: product.id,
        variantId: variantId,
        quantity,
        priceCents: priceCents
      });
      sessionStorage.setItem('guestCartId', newGuestCartId);
      sessionStorage.setItem('guestCartItems', JSON.stringify(items));
      await refreshCart(); // Refresh cart count (sẽ load từ sessionStorage)
      toast.show('✓ Đã thêm vào giỏ hàng (khách)', { type: 'success' });
    } catch (e) {
      setError(e.message || 'Lỗi khi thêm vào giỏ hàng khách');
      toast.show(e.message || 'Lỗi khi thêm vào giỏ hàng khách', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleBuyNow = async () => {
    if (!product) return;

    // Check if variant is required but not selected
    if (variants.length > 0 && !selectedVariant) {
      toast.show('Vui lòng chọn phiên bản sản phẩm', { type: 'error' });
      return;
    }

    const priceCents = selectedVariant ? selectedVariant.price_cents : (product.price_cents || product.originalPrice || product.price);
    const variantId = selectedVariant ? selectedVariant.id : null;

    // Đã đăng nhập: hành vi cũ - thêm vào giỏ và chuyển sang trang giỏ hàng
    if (token) {
      try {
        setError('');
        setLoading(true);
        await addItemToCart(api, { 
          productId: product.id, 
          variantId: variantId,
          quantity, 
          priceCents: priceCents 
        });
        await refreshCart();
        navigate('/cart');
      } catch (e) {
        setError(e.message || 'Lỗi khi thêm vào giỏ hàng');
        setLoading(false);
      }
      return;
    }

    // Khách chưa đăng nhập: chuyển thẳng tới trang thanh toán với thông tin sản phẩm
    try {
      setError('');
      navigate('/checkout', {
        state: {
          guestItems: [
            {
              productId: product.id,
              variantId: variantId,
              quantity,
              priceCents
            }
          ]
        }
      });
    } catch (e) {
      setError(e.message || 'Không thể chuyển tới trang thanh toán');
    }
  };

  const handleConsultation = () => {
    console.log('Request consultation for', product?.name);
  };

  const nextImage = () => {
    if (!product) return;
    setSelectedImage((prev) => (prev + 1) % product.images.length);
  };

  const prevImage = () => {
    if (!product) return;
    setSelectedImage((prev) => (prev - 1 + product.images.length) % product.images.length);
  };

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 pt-28">
        <div className="container mx-auto px-4 text-center text-gray-600 dark:text-gray-300">{VI.common.loading}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 pt-28">
      <div className="container mx-auto px-4">
        {error && (
          <div className="mb-4 p-3 rounded bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</div>
        )}
        {/* Breadcrumb */}
        <nav className="mb-8">
          <ol className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <li>
              <Link to="/" className="hover:text-primary">Trang chủ</Link>
            </li>
            {productCategory && (
              <>
                <li className="text-gray-400">/</li>
                <li>
                  <Link 
                    to={`/products?categoryId=${productCategory.id}`} 
                    className="hover:text-primary"
                  >
                    {productCategory.name}
                  </Link>
                </li>
              </>
            )}
            <li className="text-gray-400">/</li>
            <li className="text-gray-900 dark:text-white">{product.name}</li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          {/* Product Images */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="relative aspect-square bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg">
              <motion.img
                key={selectedImage}
                src={getImageUrl(product.images[selectedImage])}
                alt={product.name}
                className="w-full h-full object-contain"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              />
              
              {/* Navigation Arrows */}
              {product.images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 dark:bg-gray-800/80 rounded-full flex items-center justify-center shadow-lg hover:bg-white dark:hover:bg-gray-800 transition-colors"
                  >
                    <FaChevronLeft className="text-gray-600 dark:text-gray-300" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 dark:bg-gray-800/80 rounded-full flex items-center justify-center shadow-lg hover:bg-white dark:hover:bg-gray-800 transition-colors"
                  >
                    <FaChevronRight className="text-gray-600 dark:text-gray-300" />
                  </button>
                </>
              )}

              {/* Discount Badge */}
              {product.discount > 0 && (
                <div className="absolute top-4 left-4 bg-primary text-white px-3 py-1 rounded-full text-sm font-semibold">
                  -{product.discount}%
                </div>
              )}
            </div>

            {/* Thumbnail Images */}
            {product.images.length > 1 && (
              <div className="flex space-x-3">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                      selectedImage === index
                        ? 'border-primary'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <img
                      src={getImageUrl(image)}
                      alt={`${product.name} ${index + 1}`}
                      className="w-full h-full object-contain bg-white dark:bg-gray-800"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Product Name & Rating */}
            <div>
              <h1 className="text-3xl font-bitcount font-normal text-gray-900 dark:text-white mb-3">
                {product.name}
              </h1>
              <div className="flex items-center space-x-4 mb-4">
                <div className="flex items-center space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <FaStar
                      key={i}
                      className={`w-4 h-4 ${
                        i < Math.floor(product.rating)
                          ? 'text-yellow-400'
                          : 'text-gray-300 dark:text-gray-600'
                      }`}
                    />
                  ))}
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                    {product.rating} ({product.reviewCount} đánh giá)
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed">
              {product.description}
            </p>

            {/* Variants Selector */}
            {variants.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Chọn phiên bản:
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {variants.map((variant) => {
                    const variantDiscount = variant.discount_percent || 0;
                    const variantFinalPrice = Math.round(variant.price_cents * (100 - variantDiscount) / 100);
                    const isSelected = selectedVariant && selectedVariant.id === variant.id;
                    const isOutOfStock = (variant.stock || 0) === 0;
                    
                    return (
                      <button
                        key={variant.id}
                        onClick={() => {
                          setSelectedVariant(variant);
                          // Update product price and stock
                          setProduct(prev => ({
                            ...prev,
                            price: variantFinalPrice,
                            originalPrice: variant.price_cents,
                            discount: variantDiscount
                          }));
                          setAvailableStock(variant.stock || 0);
                        }}
                        disabled={isOutOfStock}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          isSelected
                            ? 'border-primary bg-primary/5 dark:bg-primary/10'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        } ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 dark:text-white mb-1">
                              {variant.name}
                            </div>
                            {variant.attributes && typeof variant.attributes === 'object' && !Array.isArray(variant.attributes) && (
                              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                {Object.entries(variant.attributes)
                                  .filter(([key, value]) => {
                                    // Only show primitive values (string, number, boolean)
                                    return value !== null && typeof value !== 'object' && !Array.isArray(value);
                                  })
                                  .map(([key, value]) => (
                                    <div key={key}>
                                      <span className="capitalize">{key}:</span> {String(value)}
                                    </div>
                                  ))}
                              </div>
                            )}
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-lg font-bold text-primary">
                                {variantFinalPrice.toLocaleString('vi-VN')} ₫
                              </span>
                              {variantDiscount > 0 && (
                                <span className="text-sm text-gray-500 line-through">
                                  {variant.price_cents.toLocaleString('vi-VN')} ₫
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {isOutOfStock ? 'Hết hàng' : `Còn ${variant.stock} sản phẩm`}
                            </div>
                          </div>
                          {isSelected && (
                            <div className="ml-2 text-primary">
                              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Price */}
            <div className="space-y-2">
              <div className="flex items-center space-x-4">
                <span className="text-3xl font-bold text-primary">
                  {formatPrice(product.price)}
                </span>
                {product.discount > 0 && (
                  <span className="text-xl text-gray-500 line-through">
                    {formatPrice(product.originalPrice)}
                  </span>
                )}
              </div>
              {product.discount > 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Bạn tiết kiệm {formatPrice(product.originalPrice - product.price)}
                </p>
              )}
            </div>

            {/* Features */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Tính năng nổi bật:
              </h3>
              {product.features && product.features.length > 0 ? (
                <ul className="space-y-2">
                  {product.features.map((feature, index) => (
                    <li key={index} className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                      <span className="text-gray-600 dark:text-gray-400">{feature}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 italic">Không có thông tin tính năng nổi bật</p>
              )}
            </div>

            {/* Quantity & Actions */}
            <div className="space-y-4">
              {/* Stock Status */}
              <div className="flex items-center space-x-2">
                <span className="text-gray-700 dark:text-gray-300 font-medium">Tình trạng:</span>
                {availableStock > 0 ? (
                  <span className="text-green-600 dark:text-green-400 font-semibold">
                    Còn hàng ({availableStock} sản phẩm)
                  </span>
                ) : (
                  <span className="text-red-600 dark:text-red-400 font-semibold">
                    Hết hàng
                  </span>
                )}
              </div>

              {/* Quantity Selector */}
              <div className="flex items-center space-x-4">
                <span className="text-gray-700 dark:text-gray-300 font-medium">Số lượng:</span>
                <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={availableStock === 0}
                    className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    -
                  </button>
                  <span className="px-4 py-2 border-x border-gray-300 dark:border-gray-600 min-w-[60px] text-center">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(Math.min(availableStock, quantity + 1))}
                    disabled={availableStock === 0 || quantity >= availableStock}
                    className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
                {availableStock > 0 && quantity >= availableStock && (
                  <span className="text-sm text-orange-600 dark:text-orange-400">
                    Đã đạt số lượng tối đa
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4">
                <motion.button
                  onClick={handleAddToCart}
                  disabled={loading || availableStock === 0}
                  className="flex-1 bg-white dark:bg-gray-800 hover:bg-primary hover:text-white text-primary border-2 border-primary px-6 py-3 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg"
                  whileHover={availableStock > 0 ? { scale: 1.02 } : {}}
                  whileTap={availableStock > 0 ? { scale: 0.98 } : {}}
                >
                  <FaCartPlus className="text-lg" />
                  <span>{availableStock === 0 ? 'Hết hàng' : (loading ? 'Đang thêm...' : VI.products.addToCart)}</span>
                </motion.button>
                
                <motion.button
                  onClick={handleBuyNow}
                  disabled={loading || availableStock === 0}
                  className="flex-1 bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl"
                  whileHover={availableStock > 0 ? { scale: 1.02 } : {}}
                  whileTap={availableStock > 0 ? { scale: 0.98 } : {}}
                >
                  <span>{availableStock === 0 ? 'Hết hàng' : (loading ? 'Đang xử lý...' : 'Mua ngay')}</span>
                </motion.button>
              </div>

              {/* Consultation Button */}
              <motion.button
                onClick={handleConsultation}
                className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <FaHeadset />
                <span>Tư vấn miễn phí</span>
              </motion.button>

              {/* Wishlist & Share */}
              <div className="flex space-x-4">
                <button
                  onClick={() => setIsWishlisted(!isWishlisted)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    isWishlisted
                      ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <FaHeart className={isWishlisted ? 'fill-current' : ''} />
                  <span>{isWishlisted ? 'Đã yêu thích' : 'Yêu thích'}</span>
                </button>
                
                <button className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  <FaShare />
                  <span>Chia sẻ</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Specifications - Hiển thị nested structure */}
        {product.techSpecs && Object.keys(product.techSpecs).length > 0 && (
          <div className="mb-16">
            <h2 className="text-3xl font-bitcount font-normal text-gray-900 dark:text-white mb-8">
              Thông số kỹ thuật
            </h2>
            
            <div className="space-y-6">
              {Object.entries(product.techSpecs).map(([sectionKey, sectionValue]) => {
                // Bảng dịch section names (performance, display, battery, etc.)
                const sectionNameMap = {
                  'performance': 'Hiệu năng',
                  'display': 'Màn hình',
                  'battery': 'Pin',
                  'connectivity': 'Kết nối',
                  'design': 'Thiết kế',
                  'audio': 'Âm thanh',
                  'camera': 'Camera',
                  'keyboard': 'Bàn phím'
                };

                // Bảng dịch field names (cpu, gpu, ram, etc.)
                const fieldLabelMap = {
                  'cpu': 'Bộ xử lý',
                  'gpu': 'Card đồ họa',
                  'ram': 'RAM',
                  'storage': 'Ổ cứng',
                  'size': 'Kích thước',
                  'resolution': 'Độ phân giải',
                  'refresh_rate': 'Tần số quét',
                  'panel_type': 'Loại màn hình',
                  'brightness': 'Độ sáng',
                  'color_gamut': 'Gam màu',
                  'capacity': 'Dung lượng',
                  'life': 'Thời lượng',
                  'wifi': 'Wi-Fi',
                  'bluetooth': 'Bluetooth',
                  'ports': 'Cổng kết nối',
                  'weight': 'Trọng lượng',
                  'thickness': 'Độ dày',
                  'os': 'Hệ điều hành',
                  'durability': 'Độ bền',
                  'speakers': 'Loa',
                  'technology': 'Công nghệ',
                  'cores': 'Số nhân/luồng',
                  'base_clock': 'Xung nhịp cơ bản',
                  'turbo_clock': 'Xung nhịp tối đa',
                  'cache': 'Bộ nhớ đệm',
                  'socket': 'Socket',
                  'tdp': 'TDP',
                  'process': 'Tiến trình',
                  'architecture': 'Kiến trúc',
                  'vram': 'VRAM'
                };

                const sectionName = sectionNameMap[sectionKey] || sectionKey
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, (l) => l.toUpperCase());

                // Check if sectionValue is an object (nested) or primitive (flat fallback)
                const isNested = typeof sectionValue === 'object' && sectionValue !== null;

                return (
                  <div key={sectionKey} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
                    {/* Section Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                      <h3 className="text-xl font-bold text-white">
                        {sectionName}
                      </h3>
                    </div>

                    {/* Section Content - Grid layout 2-3 columns */}
                    <div className="p-6">
                      {isNested ? (
                        // Nested structure: render as 2-3 column grid cards
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {Object.entries(sectionValue).map(([fieldKey, fieldValue]) => {
                            const fieldLabel = fieldLabelMap[fieldKey] || fieldKey
                              .replace(/_/g, ' ')
                              .replace(/\b\w/g, (l) => l.toUpperCase());

                            return (
                              <div 
                                key={fieldKey} 
                                className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-700 dark:to-gray-750 rounded-xl p-4 border border-gray-200 dark:border-gray-600 hover:shadow-lg hover:scale-105 transition-all duration-200"
                              >
                                <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">
                                  {fieldLabel}
                                </div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white break-words">
                                  {fieldValue || '(không có thông tin)'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        // Flat fallback: render as single card
                        <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-700 dark:to-gray-750 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                          <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">
                            {sectionName}
                          </div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {sectionValue || '(không có thông tin)'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Reviews Section */}
        <div className="mt-16">
          <div className="flex items-center gap-3 mb-8">
            <h2 className="text-3xl font-bitcount font-normal text-gray-900 dark:text-white">
              Đánh giá sản phẩm
            </h2>
            {unreadReplies > 0 && (
              <span className="px-3 py-1 bg-red-500 text-white text-sm font-semibold rounded-full animate-pulse">
                {unreadReplies} phản hồi mới
              </span>
            )}
          </div>

          {/* Reviews Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Average Rating */}
              <div className="text-center md:border-r dark:border-gray-700">
                <div className="text-5xl font-bold text-gray-900 dark:text-white mb-2">
                  {reviewsStats.average > 0 ? reviewsStats.average.toFixed(1) : '0.0'}
                </div>
                <div className="flex justify-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <FaStar
                      key={star}
                      className={star <= Math.round(reviewsStats.average) ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}
                      size={24}
                    />
                  ))}
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  {reviewsStats.total} đánh giá
                </div>
              </div>

              {/* Rating Distribution */}
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = reviewsDistribution[star] || 0;
                  const percentage = reviewsStats.total > 0 ? (count / reviewsStats.total) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400 w-8">{star} ⭐</span>
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-400 transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400 w-12 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Submit Review/Comment Form */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 mb-8">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              {token && user && user.id ? 'Gửi đánh giá của bạn' : 'Gửi bình luận của bạn'}
            </h3>
            
            {/* Star Rating Input - Only for logged-in users */}
            {token && user && user.id ? (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Đánh giá sao (bắt buộc)
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setUserRating(star)}
                      className="focus:outline-none transition-transform hover:scale-110"
                    >
                      {star <= userRating ? (
                        <FaStar className="text-yellow-400" size={32} />
                      ) : (
                        <FaRegStar className="text-gray-300 dark:text-gray-600" size={32} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⭐ Để đánh giá bằng sao, vui lòng{' '}
                  <button
                    onClick={() => {
                      localStorage.setItem('returnUrl', window.location.pathname);
                      navigate('/login');
                    }}
                    className="underline font-medium hover:text-yellow-900 dark:hover:text-yellow-100"
                  >
                    đăng nhập
                  </button>
                </p>
              </div>
            )}

            {/* Guest Name Input - Only for non-logged-in users */}
            {!token || !user || !user.id ? (
              <div className="mb-4">
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Tên của bạn (tùy chọn)"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
            ) : null}

            {/* Comment Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Bình luận {token && user && user.id ? '(tùy chọn)' : '(bắt buộc)'}
              </label>
              <textarea
                value={userComment}
                onChange={(e) => setUserComment(e.target.value)}
                placeholder={token && user && user.id 
                  ? "Nhập bình luận của bạn (tùy chọn)" 
                  : "Nhập bình luận của bạn"}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         placeholder-gray-400 dark:placeholder-gray-500
                         resize-none"
                rows={4}
              />
            </div>

            {/* Submit Button */}
            {token && user && user.id ? (
              <button
                onClick={handleSubmitReview}
                disabled={submittingReview || userRating === 0}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors font-medium"
              >
                {submittingReview ? 'Đang gửi...' : 'Gửi đánh giá'}
              </button>
            ) : (
              <button
                onClick={handleSubmitGuestComment}
                disabled={submittingGuestComment || !userComment.trim()}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors font-medium"
              >
                {submittingGuestComment ? 'Đang gửi...' : 'Gửi bình luận'}
              </button>
            )}
          </div>

          {/* Reviews Filter */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Lọc đánh giá
                </h3>
                {autoRefreshing && (
                  <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                    <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Đang cập nhật...
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setReviewsFilter(''); setReviewsPage(1); }}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    reviewsFilter === ''
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  Tất cả ({reviewsStats.total})
                </button>
                {[5, 4, 3, 2, 1].map((star) => (
                  <button
                    key={star}
                    onClick={() => { setReviewsFilter(star.toString()); setReviewsPage(1); }}
                    className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1 ${
                      reviewsFilter === star.toString()
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {star} <FaStar className="text-yellow-400" size={14} />
                    <span className="text-xs">({reviewsDistribution[star] || 0})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Reviews List */}
          <div className="space-y-6">
            {reviews.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  Chưa có đánh giá nào. Hãy là người đầu tiên!
                </p>
              </div>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                  {/* Review Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {review.user_name ? review.user_name.charAt(0).toUpperCase() : review.user_email?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {review.user_name || review.user_email || `Người dùng #${review.user_id}`}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(review.created_at).toLocaleDateString('vi-VN')}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <FaStar
                          key={star}
                          className={star <= review.rating ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}
                          size={16}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Review Comment */}
                  {review.comment && (
                    <p className="text-gray-700 dark:text-gray-300 mb-3">
                      {review.comment}
                    </p>
                  )}

                  {/* Comments Thread */}
                  {review.comments && review.comments.length > 0 && (
                    <div className="mt-4 space-y-3 border-l-4 border-gray-300 dark:border-gray-600 pl-4">
                      {review.comments.map((comment) => (
                        <div key={comment.id} className={`p-3 rounded-lg ${comment.is_admin ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                          <div className="flex items-start gap-2 mb-1">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs ${comment.is_admin ? 'bg-red-500' : 'bg-gray-500'}`}>
                              {comment.user_name ? comment.user_name.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium ${comment.is_admin ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                                  {comment.user_name || comment.user_email || 'User'}
                                  {comment.is_admin && <span className="text-xs bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 px-2 py-0.5 rounded">Admin</span>}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {new Date(comment.created_at).toLocaleDateString('vi-VN')}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{comment.comment}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply Form */}
                  {user && replyingTo === review.id ? (
                    <div className="mt-4">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Nhập phản hồi của bạn..."
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg
                                 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        rows="3"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleSubmitReply(review.id)}
                          disabled={submittingReply || !replyText.trim()}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg
                                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {submittingReply ? 'Đang gửi...' : 'Gửi phản hồi'}
                        </button>
                        <button
                          onClick={() => { setReplyingTo(null); setReplyText(''); }}
                          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600
                                   text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        if (!user) {
                          localStorage.setItem('returnUrl', window.location.pathname);
                          navigate('/login');
                        } else {
                          setReplyingTo(review.id);
                          // Mark as seen
                          localStorage.setItem(`review_${review.id}_last_seen`, Date.now().toString());
                          setUnreadReplies(prev => Math.max(0, prev - 1));
                        }
                      }}
                      className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      💬 Phản hồi
                      {user && review.user_id === user.id && review.comments && review.comments.length > 0 && (
                        (() => {
                          const lastSeen = localStorage.getItem(`review_${review.id}_last_seen`);
                          const latestCommentTime = new Date(review.comments[review.comments.length - 1].created_at).getTime();
                          const hasUnread = !lastSeen || parseInt(lastSeen) < latestCommentTime;
                          return hasUnread && review.comments.some(c => c.is_admin) ? (
                            <span className="ml-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                          ) : null;
                        })()
                      )}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Guest Comments Section */}
          {guestComments.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Bình luận từ khách (không có đánh giá sao)
              </h3>
              <div className="space-y-4">
                {guestComments.map((comment) => (
                  <div key={comment.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {comment.guest_name || 'Khách'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(comment.created_at).toLocaleDateString('vi-VN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {comment.comment}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pagination */}
          {(reviewsStats.filtered || reviewsStats.total) > reviewsPerPage && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <button
                onClick={() => setReviewsPage(p => Math.max(1, p - 1))}
                disabled={reviewsPage === 1}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg
                         hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
              >
                ← Trước
              </button>
              
              {(() => {
                const totalItems = reviewsStats.filtered || reviewsStats.total;
                const totalPages = Math.ceil(totalItems / reviewsPerPage);
                return Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    // Hiển thị: 1 ... current-1 current current+1 ... last
                    return page === 1 || page === totalPages || Math.abs(page - reviewsPage) <= 1;
                  })
                  .map((page, idx, arr) => (
                    <React.Fragment key={page}>
                      {idx > 0 && arr[idx - 1] !== page - 1 && (
                        <span className="text-gray-500 dark:text-gray-400">...</span>
                      )}
                      <button
                        onClick={() => setReviewsPage(page)}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          reviewsPage === page
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  ));
              })()}
              
              <button
                onClick={() => {
                  const totalItems = reviewsStats.filtered || reviewsStats.total;
                  const totalPages = Math.ceil(totalItems / reviewsPerPage);
                  setReviewsPage(p => Math.min(totalPages, p + 1));
                }}
                disabled={(() => {
                  const totalItems = reviewsStats.filtered || reviewsStats.total;
                  const totalPages = Math.ceil(totalItems / reviewsPerPage);
                  return reviewsPage >= totalPages;
                })()}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg
                         hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
              >
                Sau →
              </button>
            </div>
          )}
        </div>

        {/* Related Products */}
        <div className="mt-16">
          <h2 className="text-3xl font-bitcount font-normal text-gray-900 dark:text-white mb-8">
            Sản phẩm liên quan
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {product.relatedProducts.map((relatedProduct) => (
              <motion.div
                key={relatedProduct.id}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
                whileHover={{ y: -5 }}
                onClick={() => navigate(`/product/${relatedProduct.id}`)}
              >
                <div className="aspect-square bg-gray-100 dark:bg-gray-700 p-4 relative">
                  {relatedProduct.discount > 0 && (
                    <div className="absolute top-2 left-2 z-10 bg-red-500 text-white px-2 py-1 rounded-md text-xs font-bold">
                      -{relatedProduct.discount}%
                    </div>
                  )}
                  <img
                    src={getImageUrl(relatedProduct.image)}
                    alt={relatedProduct.name}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 line-clamp-1">
                    {relatedProduct.name}
                  </h3>
                  <div className="flex items-center space-x-1 mb-3">
                    {[...Array(5)].map((_, i) => (
                      <FaStar
                        key={i}
                        className={`w-4 h-4 ${
                          i < Math.floor(relatedProduct.rating)
                            ? 'text-yellow-400'
                            : 'text-gray-300 dark:text-gray-600'
                        }`}
                      />
                    ))}
                    <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">
                      {relatedProduct.rating}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xl font-bold text-primary">
                        {formatPrice(relatedProduct.price)}
                      </span>
                      {relatedProduct.discount > 0 && (
                        <span className="text-sm text-gray-500 line-through">
                          {formatPrice(relatedProduct.originalPrice)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
