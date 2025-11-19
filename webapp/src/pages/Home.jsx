import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import ProductCard from '../components/ProductCard'
import { listProducts, listCategories, listProductsByCategory } from '../services/catalog'
import { addItemToCart } from '../services/cart'
import Banner from '../components/Banner'
import FiltersBar from '../components/FiltersBar'
import { Card, CardBody } from '../components/ui/Card'
import Chip from '../components/ui/Chip'
import { useToast } from '../ui/Toast'

const API = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

export default function Home() {
  const [products, setProducts] = useState([])
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
  
  useEffect(() => { 
    let ignore = false
    setLoading(true)
    Promise.all([listProducts(), listCategories({ limit: 8 })]).then(async ([resProducts, cats]) => {
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
    if (!token) return alert('Vui lòng đăng nhập')
    try {
      await addItemToCart(api, { productId: p.id, quantity: 1, priceCents: p.price_cents })
      toast.show('✓ Đã thêm vào giỏ hàng', { type: 'success' })
    } catch (e) {
      toast.show('Có lỗi xảy ra. Vui lòng thử lại', { type: 'error' })
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
      <Banner />
      {/* Filters */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50 dark:bg-slate-900/70 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-4">
          <FiltersBar 
            query={query} 
            onQuery={setQuery} 
            sort={sort} 
            onSort={setSort} 
            brands={brands}
            brandFilter={brandFilter}
            onBrandFilter={setBrandFilter}
            categories={categories}
            categoryFilter={categoryFilter}
            onCategoryFilter={setCategoryFilter}
          />
        </div>
      </div>

      {/* Featured products */}
      <section id="featured" className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {query || brandFilter || categoryFilter ? 'Kết quả tìm kiếm' : 'Sản phẩm nổi bật'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {filtered.length} sản phẩm
              {query && ` cho "${query}"`}
              {brandFilter && ` từ ${brandFilter}`}
              {categoryFilter && ` danh mục ${categoryFilter}`}
            </p>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <svg className="h-24 w-24 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-slate-700">Không tìm thấy sản phẩm nào</h3>
            <p className="mt-1 text-sm text-slate-500">Hãy thử điều chỉnh bộ lọc hoặc tìm kiếm khác</p>
            <button 
              onClick={() => {
                setQuery('')
                setBrandFilter('')
                setCategoryFilter('')
              }}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Xóa bộ lọc
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map(p => (
              <ProductCard key={p.id} product={p} onAdd={add} />
            ))}
          </div>
        )}
      </section>

      {/* Deals */}
      <section id="deals" className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Ưu đãi hot</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardBody>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                🎁 Coupon 200k cho đơn từ 10 triệu
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Áp dụng cho laptop gaming — Số lượng có hạn</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/40 bg-sky-50 px-3 py-1 text-xs text-sky-700">
                🚚 Freeship toàn quốc
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">0 ₫ phí vận chuyển cho mọi đơn trong tuần này</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/40 bg-violet-50 px-3 py-1 text-xs text-violet-700">
                🛡️ Bảo hành 24 tháng
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Chính hãng, đổi mới 7 ngày nếu lỗi do NSX</p>
            </CardBody>
          </Card>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-8">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Danh mục nổi bật</h2>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {featuredCategories.length === 0 ? (
            <span className="text-sm text-slate-500">Đang tải danh mục...</span>
          ) : (
            featuredCategories.map(c => (
              <button key={c.id} onClick={() => setCategoryFilter(c.name)}>
                <Chip>{c.name}{typeof c.product_count === 'number' ? ` (${c.product_count})` : ''}</Chip>
              </button>
            ))
          )}
        </div>

        {/* Product rows by category */}
        <div className="mt-6 space-y-10">
          {featuredCategories.map(c => (
            <div key={`row-${c.id}`}>
              <div className="mb-3 flex items-end justify-between">
                <h3 className="text-lg font-semibold">{c.name}</h3>
                <button className="text-sm text-blue-600 hover:underline" onClick={() => setCategoryFilter(c.name)}>Xem tất cả</button>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {(categoryProducts[c.id] || []).map(p => (
                  <ProductCard key={`c${c.id}-p${p.id}`} product={p} onAdd={add} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}


