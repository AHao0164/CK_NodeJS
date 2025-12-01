import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import ProductCard from '../components/ProductCard'
import { listProducts, listCategories, listProductsByCategory } from '../services/catalog'
import { addItemToCart, addGuestItemToCart } from '../services/cart'
import ProductCarousel from '../components/ui/ProductCarousel'
import { useToast } from '../ui/Toast'
import Banner from '../components/Banner'
import Category from '../components/Category/Categoty'
import Footer from '../components/Footer'
import { useNavigate } from 'react-router-dom'
import VI from '../constants/vi'

export default function Home() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [featuredCategories, setFeaturedCategories] = useState([])
  const [categoryProducts, setCategoryProducts] = useState({})
  const { api, token } = useAuth()
  const { refreshCart } = useCart()
  const toast = useToast()
  const navigate = useNavigate()
  
  useEffect(() => {
    document.title = 'Trang chủ - GearUp';
  }, []);
  
  useEffect(() => { 
    let ignore = false
    setLoading(true)
    Promise.all([
      // Lấy danh sách sản phẩm mới nhất (dùng cho New Products + Best Sellers + Featured)
      listProducts({ sort: 'id_desc', page: 1 }),
      listCategories({ limit: 8 })
    ]).then(async ([resProducts, cats]) => {
      if (ignore) return
      setProducts(Array.isArray(resProducts?.items) ? resProducts.items : [])
      setFeaturedCategories(cats)
      // fetch products per category in parallel
      const entries = await Promise.all(
        cats.map(async (c) => [c.id, await listProductsByCategory(c.id, { limit: 4 })])
      )
      if (!ignore) setCategoryProducts(Object.fromEntries(entries))
    }).finally(() => setLoading(false))
    return () => { ignore = true }
  }, [])
  
  async function add(p) {
    // Calculate final price with discount (same as displayed price)
    const originalPrice = Number(p.price_cents || 0);
    const discountPercent = Number(p.discount_percent || 0);
    const finalPrice = Math.round(originalPrice * (100 - discountPercent) / 100);
    
    // ✅ Frontend validation: Chỉ check số lượng đang thêm, KHÔNG tính số lượng đã có trong giỏ
    // Stock sẽ được check lại khi checkout và chỉ trừ khi thanh toán xong
    const availableStock = p.stock || 0;
    const quantityToAdd = 1;
    
    if (availableStock === 0) {
      toast.show('Sản phẩm đã hết hàng', { type: 'error' });
      return;
    }
    
    // Chỉ check số lượng đang thêm có <= stock hiện tại không
    if (quantityToAdd > availableStock) {
      toast.show(`Không đủ hàng trong kho. Chỉ còn ${availableStock} sản phẩm`, { type: 'error' });
      return;
    }
    
    // Đã đăng nhập: thêm vào giỏ hàng của user
    if (token) {
      try {
        await addItemToCart(api, { productId: p.id, quantity: quantityToAdd, priceCents: finalPrice })
        await refreshCart()
        toast.show(VI.products.addedToCart, { type: 'success' })
      } catch (e) {
        const errorMsg = e?.response?.data?.error || e?.message || VI.errors.somethingWentWrong;
        toast.show(errorMsg, { type: 'error' })
      }
      return
    }

    // Khách chưa đăng nhập: thêm vào guest cart
    try {
      let guestCartId = sessionStorage.getItem('guestCartId')
      const { guestCartId: newGuestCartId, items } = await addGuestItemToCart({
        guestCartId,
        productId: p.id,
        quantity: quantityToAdd,
        priceCents: finalPrice
      })
      sessionStorage.setItem('guestCartId', newGuestCartId)
      sessionStorage.setItem('guestCartItems', JSON.stringify(items))
      await refreshCart() // Refresh cart count (sẽ load từ sessionStorage)
      toast.show('✓ Đã thêm vào giỏ hàng (khách)', { type: 'success' })
    } catch (e) {
      const errorMsg = e?.response?.data?.error || e?.message || 'Lỗi khi thêm vào giỏ hàng khách';
      toast.show(errorMsg, { type: 'error' })
    }
  }

  async function buyNow(p) {
    // Calculate final price with discount (same as displayed price)
    const originalPrice = Number(p.price_cents || 0);
    const discountPercent = Number(p.discount_percent || 0);
    const finalPrice = Math.round(originalPrice * (100 - discountPercent) / 100);
    
    // ✅ Frontend validation: Check stock before buy now
    const availableStock = p.stock || 0;
    const quantityToBuy = 1;
    
    if (availableStock === 0) {
      toast.show('Sản phẩm đã hết hàng', { type: 'error' });
      return;
    }
    
    // Check current cart quantity + quantity to buy
    let currentQuantityInCart = 0;
    if (token) {
      try {
        const cartData = await api.get('/cart').then(r => r.data);
        const existingItem = cartData?.items?.find(item => item.product_id === p.id);
        currentQuantityInCart = existingItem ? existingItem.quantity : 0;
      } catch (e) {
        // If cart fetch fails, continue (backend will validate)
        console.warn('Could not fetch cart for validation:', e);
      }
    } else {
      // Guest cart: check sessionStorage
      const storedGuestCartItems = JSON.parse(sessionStorage.getItem('guestCartItems') || '[]');
      const existingItem = storedGuestCartItems.find(item => (item.product_id || item.productId) === p.id);
      currentQuantityInCart = existingItem ? (existingItem.quantity || 0) : 0;
    }
    
    const requestedTotalQuantity = currentQuantityInCart + quantityToBuy;
    if (requestedTotalQuantity > availableStock) {
      toast.show(`Không đủ hàng trong kho. Chỉ còn ${availableStock} sản phẩm${currentQuantityInCart > 0 ? ` (bạn đã có ${currentQuantityInCart} trong giỏ)` : ''}`, { type: 'error' });
      return;
    }
    
    // ✅ Mua ngay: Chuyển thẳng đến checkout, không qua giỏ hàng
    // Đã đăng nhập: Thêm vào giỏ tạm thời rồi chuyển đến checkout với selectedItems
    if (token) {
      try {
        // Thêm vào giỏ để có item trong cart
        await addItemToCart(api, { productId: p.id, quantity: quantityToBuy, priceCents: finalPrice })
        await refreshCart()
        
        // Lấy cart mới để có item vừa thêm
        const cartData = await api.get('/cart').then(r => r.data)
        const addedItem = cartData?.items?.find(item => item.product_id === p.id)
        
        if (addedItem) {
          // Chuyển đến checkout với item vừa thêm được chọn
          navigate('/checkout', {
            state: {
              selectedItems: [addedItem],
              selectedItemIds: [addedItem.id]
            }
          })
        } else {
          // Fallback: chuyển đến cart nếu không tìm thấy item
          navigate('/cart')
        }
      } catch (e) {
        const errorMsg = e?.response?.data?.error || e?.message || VI.errors.somethingWentWrong;
        toast.show(errorMsg, { type: 'error' })
      }
      return
    }

    // Khách chưa đăng nhập: chuyển thẳng tới trang thanh toán với thông tin sản phẩm
    navigate('/checkout', {
      state: {
        guestItems: [
          {
            productId: p.id,
            quantity: quantityToBuy,
            priceCents: finalPrice
          }
        ]
      }
    })
  }
  
  // Phân loại dữ liệu cho các block:
  // - Sản phẩm mới: 8 sản phẩm mới nhất
  const newProducts = products.slice(0, 8)

  // - Bán chạy: ưu tiên sản phẩm có giảm giá cao, nếu bằng nhau thì giá cao hơn trước
  const bestSellerProducts = [...products]
    .sort((a, b) => {
      const da = a.discount_percent || 0
      const db = b.discount_percent || 0
      if (db !== da) return db - da
      const pa = a.price_cents || 0
      const pb = b.price_cents || 0
      return pb - pa
    })
    .slice(0, 8)

  return (
    <>
      {/* Banner Section - Managed from AdminApp */}
      <div className="pt-16 sm:pt-20">
        <Banner />
      </div>
      
      {/* Divider */}
      <div className="w-full border-t border-slate-200 dark:border-slate-800 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-50"></div>
      
      {/* New Products */}
      <section id="new-products" className="w-full flex items-center justify-center py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 w-full">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-primary" />
            </div>
          ) : (
            <ProductCarousel
              products={newProducts}
              title="Sản phẩm mới"
              showViewAll
              viewAllLink="/products?sort=newest"
              onAdd={add}
              onBuyNow={buyNow}
            />
          )}
        </div>
      </section>

      {/* Divider */}
      <div className="w-full border-t border-slate-200 dark:border-slate-800 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-50"></div>

      {/* Best Sellers */}
      <section id="best-sellers" className="w-full flex items-center justify-center py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 w-full">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-primary" />
            </div>
          ) : (
            <ProductCarousel
              products={bestSellerProducts}
              title="Bán chạy"
              showViewAll
              viewAllLink="/products?sort=best-seller"
              onAdd={add}
              onBuyNow={buyNow}
            />
          )}
        </div>
      </section>

      {/* Divider */}
      <div className="w-full border-t border-slate-200 dark:border-slate-800 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-50"></div>

      {/* Featured products (giữ lại block cũ làm “Gợi ý cho bạn”) */}
      <section id="featured" className="w-full flex items-center justify-center py-20">
        <div className="mx-auto max-w-7xl px-4 w-full">
          {/* Product Info Header - Fixed at top */}
          <div className="mb-8 flex items-end justify-between border-b-2 border-slate-200 dark:border-slate-700 pb-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-bitcount text-gray-900 dark:text-white">
                {VI.products.featuredProducts}
              </h2>
              <p className="mt-2 text-base text-slate-600 dark:text-slate-400">
                {loading ? 'Đang tải...' : `${products.length} ${VI.units.items}`}
              </p>
            </div>
            <a 
              href="/products"
              className="text-base text-primary hover:text-primary/80 font-semibold underline transition-colors"
            >
              Xem tất cả →
            </a>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-primary"></div>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <svg className="h-24 w-24 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-slate-700 dark:text-slate-300">{VI.products.noProductsFound}</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map(p => (
                <ProductCard key={p.id} product={p} onAdd={add} onBuyNow={buyNow} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Category - Moved below Featured Products */}
      <section className="w-full flex items-center justify-center py-20">
        <div className="mx-auto max-w-7xl px-4 w-full">
          <div className="mb-8 text-center">
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bitcount font-bold text-gray-900 dark:text-white mb-2">
              {VI.footer.categories}
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              {VI.home.categoriesDescription}
            </p>
          </div>
          <Category onNavigateToProduct={(id) => navigate(`/product/${id}`)} />
        </div>
      </section>

      {/* Divider */}
      <div className="w-full border-t border-slate-200 dark:border-slate-800 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-50"></div>

      {/* Footer */}
      <footer className="w-full flex items-end pb-8">
        <div className="w-full">
          <Footer />
        </div>
      </footer>
    </>
  )
}

