import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import ProductCard from '../components/ProductCard'
import { listProducts, listCategories, listProductsByCategory, listNewProducts, listBestsellerProducts } from '../services/catalog'
import { addItemToCart } from '../services/cart'
import ProductCarousel from '../components/ui/ProductCarousel'
import { useToast } from '../ui/Toast'
import MagicBento from '../components/Hero/MagicBento'
import Category from '../components/Category/Categoty'
import Footer from '../components/Footer'
import { useNavigate } from 'react-router-dom'

export default function Home() {
  const [products, setProducts] = useState([])
  const [newProducts, setNewProducts] = useState([])
  const [bestsellerProducts, setBestsellerProducts] = useState([])
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('featured')
  const [brandFilter, setBrandFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [priceRange, setPriceRange] = useState([0, 100000000])
  const [loading, setLoading] = useState(false)
  const [featuredCategories, setFeaturedCategories] = useState([])
  const [categoryProducts, setCategoryProducts] = useState({})
  const { api, token } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  
  useEffect(() => { 
    let ignore = false
    setLoading(true)
    Promise.all([
      listProducts(), 
      listCategories({ limit: 8 }),
      listNewProducts({ limit: 8 }),
      listBestsellerProducts({ limit: 8 })
    ]).then(async ([resProducts, cats, newProds, bestProds]) => {
      if (ignore) return
      setProducts(Array.isArray(resProducts?.items) ? resProducts.items : [])
      setNewProducts(newProds)
      setBestsellerProducts(bestProds)
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
    if (!token) {
      // Allow guest to go to product page or checkout directly
      toast.show('Vui lòng đăng nhập để thêm vào giỏ hàng, hoặc mua ngay', { type: 'info' })
      setTimeout(() => navigate(`/product/${p.id}`), 1000)
      return
    }
    try {
      await addItemToCart(api, { productId: p.id, quantity: 1, priceCents: p.price_cents })
      toast.show('✓ Added to cart', { type: 'success' })
    } catch (e) {
      toast.show('An error occurred. Please try again', { type: 'error' })
    }
  }
  
  const brands = useMemo(() => [...new Set(products.map(p => p.brand).filter(Boolean))], [products])
  const categories = useMemo(() => [...new Set(products.map(p => p.category).filter(Boolean))], [products])
  
  const filtered = useMemo(() => (
    products
      .filter(p => {
        if (query && !p.name.toLowerCase().includes(query.toLowerCase())) return false
        if (brandFilter && p.brand !== brandFilter) return false
        if (categoryFilter && p.category !== categoryFilter) return false
        if (p.price_cents < priceRange[0] || p.price_cents > priceRange[1]) return false
        return true
      })
      .sort((a, b) => {
        if (sort === 'price_asc') return a.price_cents - b.price_cents
        if (sort === 'price_desc') return b.price_cents - a.price_cents
        if (sort === 'name_asc') return a.name.localeCompare(b.name)
        if (sort === 'name_desc') return b.name.localeCompare(a.name)
        return 0
      })
  ), [products, query, sort, brandFilter, categoryFilter, priceRange])
  
  return (
    <>
      {/* Magic Bento Hero - Full Screen Section */}
      <MagicBento 
        textAutoHide={true}
        enableStars={true}
        enableSpotlight={true}
        enableBorderGlow={true}
        enableTilt={true}
        enableMagnetism={true}
        clickEffect={true}
        spotlightRadius={300}
        particleCount={12}
        glowColor="132, 0, 255"
      />
      
      {/* Divider */}
      <div className="w-full border-t border-slate-200 dark:border-slate-800 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-50"></div>
      
      {/* New Products Section */}
      <section id="new-products" className="w-full flex items-center justify-center py-20">
        <div className="mx-auto max-w-7xl px-4 w-full">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-primary"></div>
            </div>
          ) : (
            <ProductCarousel 
              products={newProducts} 
              onAdd={add}
              title="🆕 New Products"
              showViewAll={false}
            />
          )}
        </div>
      </section>

      {/* Divider */}
      <div className="w-full border-t border-slate-200 dark:border-slate-800 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-50"></div>

      {/* Best Sellers Section */}
      <section id="bestsellers" className="w-full flex items-center justify-center py-20">
        <div className="mx-auto max-w-7xl px-4 w-full">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-primary"></div>
            </div>
          ) : (
            <ProductCarousel 
              products={bestsellerProducts} 
              onAdd={add}
              title="🔥 Best Sellers"
              showViewAll={false}
            />
          )}
        </div>
      </section>

      {/* Divider */}
      <div className="w-full border-t border-slate-200 dark:border-slate-800 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-50"></div>
      
      {/* Featured products - Carousel 2x4 with arrows */}
      <section id="featured" className="w-full flex items-center justify-center py-20">
        <div className="mx-auto max-w-7xl px-4 w-full">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-primary"></div>
          </div>
        ) : (query || brandFilter || categoryFilter) ? (
          <>
            <div className="mb-6 flex items-end justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight sm:text-2xl font-bitcount">
                  Search Results
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {filtered.length} products
                  {query && ` for "${query}"`}
                  {brandFilter && ` from ${brandFilter}`}
                  {categoryFilter && ` in ${categoryFilter}`}
                </p>
              </div>
            </div>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <svg className="h-24 w-24 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-slate-700 dark:text-slate-300">No products found</h3>
                <p className="mt-1 text-sm text-slate-500">Try adjusting your filters or search terms</p>
                <button 
                  onClick={() => {
                    setQuery('')
                    setBrandFilter('')
                    setCategoryFilter('')
                  }}
                  className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map(p => (
                  <ProductCard key={p.id} product={p} onAdd={add} />
                ))}
              </div>
            )}
          </>
        ) : (
          <ProductCarousel 
            products={filtered} 
            onAdd={add}
            title="Featured Products"
            showViewAll={true}
            viewAllLink="/products"
          />
        )}
        </div>
      </section>

      {/* Divider */}
      <div className="w-full border-t border-slate-200 dark:border-slate-800 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-50"></div>

      {/* Category - Moved below Featured Products */}
      <section className="w-full flex items-center justify-center py-20">
        <div className="mx-auto max-w-7xl px-4 w-full">
          <div className="mb-8 text-center">
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bitcount font-bold text-gray-900 dark:text-white mb-2">
              Categories
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Explore our product categories
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

