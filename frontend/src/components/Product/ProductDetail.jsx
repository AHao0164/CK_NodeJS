import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaCartPlus, FaHeadset, FaHeart, FaShare, FaStar, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { addItemToCart } from '../../services/cart';
import { getProductById } from '../../services/catalog';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const ProductDetail = () => {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { user, api, token } = useAuth();

  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [product, setProduct] = useState(null);

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

  useEffect(() => {
    const load = async (pid) => {
      setLoading(true);
      try {
        const p = await getProductById(pid);
        const mapped = {
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price_cents,
          originalPrice: p.price_cents,
          discount: 0,
          rating: 4.8,
          reviewCount: 127,
          images: Array.isArray(p.images) && p.images.length ? p.images.map(img => img.url) : fallbackProduct.images,
          techSpecs: fallbackProduct.techSpecs,
          features: fallbackProduct.features,
          relatedProducts: fallbackProduct.relatedProducts
        };
        setProduct(mapped);
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

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  };

  const handleAddToCart = async () => {
    if (!product) return;
    if (!token) {
      navigate('/login');
      return;
    }
    try {
      setError('');
      setLoading(true);
      await addItemToCart(api, { productId: product.id, quantity, priceCents: product.price_cents || product.price });
      alert('Added to cart successfully');
    } catch (e) {
      setError(e.message || 'Error adding to cart');
    } finally {
      setLoading(false);
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
        <div className="container mx-auto px-4 text-center text-gray-600 dark:text-gray-300">Loading...</div>
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
            <li><a href="/" className="hover:text-primary">Home</a></li>
            <li className="text-gray-400">/</li>
            <li><a href="/collections/laptop" className="hover:text-primary">Laptop</a></li>
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
                src={product.images[selectedImage]}
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
              <div className="absolute top-4 left-4 bg-primary text-white px-3 py-1 rounded-full text-sm font-semibold">
                -{product.discount}%
              </div>
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
                      src={image}
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
                    {product.rating} ({product.reviewCount} reviews)
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed">
              {product.description}
            </p>

            {/* Price */}
            <div className="space-y-2">
              <div className="flex items-center space-x-4">
                <span className="text-3xl font-bold text-primary">
                  {formatPrice(product.price)}
                </span>
                <span className="text-xl text-gray-500 line-through">
                  {formatPrice(product.originalPrice)}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                You save {formatPrice(product.originalPrice - product.price)}
              </p>
            </div>

            {/* Features */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Key Features:
              </h3>
              <ul className="space-y-2">
                {product.features.map((feature, index) => (
                  <li key={index} className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-gray-600 dark:text-gray-400">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Quantity & Actions */}
            <div className="space-y-4">
              {/* Quantity Selector */}
              <div className="flex items-center space-x-4">
                <span className="text-gray-700 dark:text-gray-300 font-medium">Quantity:</span>
                <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    -
                  </button>
                  <span className="px-4 py-2 border-x border-gray-300 dark:border-gray-600 min-w-[60px] text-center">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4">
                <motion.button
                  onClick={handleAddToCart}
                  disabled={loading}
                  className="flex-1 bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-colors disabled:opacity-50"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <FaCartPlus />
                  <span>{loading ? 'Adding...' : 'Add to Cart'}</span>
                </motion.button>
                
                <motion.button
                  onClick={handleConsultation}
                  className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <FaHeadset />
                  <span>Consultation</span>
                </motion.button>
              </div>

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
                  <span>{isWishlisted ? 'Wishlisted' : 'Add to Wishlist'}</span>
                </button>
                
                <button className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  <FaShare />
                  <span>Share</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Specifications */}
        <div className="mb-16">
          <h2 className="text-3xl font-bitcount font-normal text-gray-900 dark:text-white mb-8">
            Technical Specifications
          </h2>
          
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-8">
              {/* Performance */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white border-b border-primary pb-2">
                  Performance
                </h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Processor</span>
                    <p className="text-gray-900 dark:text-white">{product.techSpecs.performance.processor}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Operating System</span>
                    <p className="text-gray-900 dark:text-white">{product.techSpecs.performance.operatingSystem}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Graphics</span>
                    <p className="text-gray-900 dark:text-white">{product.techSpecs.performance.graphics}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Memory</span>
                    <p className="text-gray-900 dark:text-white">{product.techSpecs.performance.memory}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Storage</span>
                    <p className="text-gray-900 dark:text-white">{product.techSpecs.performance.storage}</p>
                  </div>
                </div>
              </div>

              {/* Connectivity */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white border-b border-primary pb-2">
                  Connectivity
                </h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Ports (Left)</span>
                    <ul className="text-gray-900 dark:text-white space-y-1">
                      {product.techSpecs.connectivity.ports.left.map((port, index) => (
                        <li key={index} className="text-sm">• {port}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Ports (Right)</span>
                    <ul className="text-gray-900 dark:text-white space-y-1">
                      {product.techSpecs.connectivity.ports.right.map((port, index) => (
                        <li key={index} className="text-sm">• {port}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Wireless</span>
                    <ul className="text-gray-900 dark:text-white space-y-1">
                      {product.techSpecs.connectivity.wireless.map((wireless, index) => (
                        <li key={index} className="text-sm">• {wireless}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Design */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white border-b border-primary pb-2">
                  Design
                </h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Display</span>
                    <p className="text-gray-900 dark:text-white text-sm">{product.techSpecs.design.display}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Dimensions</span>
                    <p className="text-gray-900 dark:text-white">{product.techSpecs.design.dimensions}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Weight</span>
                    <p className="text-gray-900 dark:text-white">{product.techSpecs.design.weight}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Color</span>
                    <p className="text-gray-900 dark:text-white">{product.techSpecs.design.color}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Related Products */}
        <div>
          <h2 className="text-3xl font-bitcount font-normal text-gray-900 dark:text-white mb-8">
            Related Products
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {product.relatedProducts.map((relatedProduct) => (
              <motion.div
                key={relatedProduct.id}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
                whileHover={{ y: -5 }}
              >
                <div className="aspect-square bg-gray-100 dark:bg-gray-700 p-4">
                  <img
                    src={relatedProduct.image}
                    alt={relatedProduct.name}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
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
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-primary">
                      {formatPrice(relatedProduct.price)}
                    </span>
                    <button className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                      View Details
                    </button>
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
