import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { listProducts } from '../services/catalog'
import { motion } from 'framer-motion'
import { VI } from '../constants/vi'
import { getCategoryVietnameseName } from '../constants/categoryMapping'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useToast } from '../ui/Toast'
import { addItemToCart, addGuestItemToCart } from '../services/cart'

export default function Products() {
	const [params, setParams] = useSearchParams()
	const navigate = useNavigate()
	const { api, token } = useAuth()
	const { refreshCart } = useCart()
	const toast = useToast()
	const [loading, setLoading] = useState(true)
	const [data, setData] = useState({ items: [], page: 1, pageSize: 20, total: 0 })
	const [brands, setBrands] = useState([])
	const [categories, setCategories] = useState([])
	const [viewMode, setViewMode] = useState(() => {
		// Load from localStorage or default to 'grid'
		return localStorage.getItem('productViewMode') || 'grid'
	})
	const [addingToCart, setAddingToCart] = useState(new Set())
	
	const q = params.get('q') || ''
	const page = parseInt(params.get('page') || '1', 10)
	const sort = params.get('sort') || 'id_desc'
	const categoryId = params.get('categoryId') || ''
	const brandId = params.get('brandId') || ''
	const minPrice = params.get('minPrice') || ''
	const maxPrice = params.get('maxPrice') || ''
	const minRating = params.get('minRating') || ''

	useEffect(() => {
		document.title = 'Sản phẩm - GearUp';
	}, []);

	// Load brands và categories
	useEffect(() => {
		fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:8080'}/catalog/brands`)
			.then(r => r.json())
			.then(data => setBrands(Array.isArray(data) ? data : (data.items || [])))
			.catch(() => setBrands([]))
		
		fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:8080'}/catalog/categories`)
			.then(r => r.json())
			.then(data => setCategories(Array.isArray(data) ? data : (data.items || [])))
			.catch(() => setCategories([]))
	}, [])

	useEffect(() => {
		let ignore = false
		setLoading(true)
		listProducts({ q, page, sort, categoryId, brandId, minPrice, maxPrice, minRating }).then((res) => {
			if (!ignore) setData(res)
		}).finally(() => setLoading(false))
		return () => { ignore = true }
	}, [q, page, sort, categoryId, brandId, minPrice, maxPrice, minRating])

	const totalPages = useMemo(() => Math.max(1, Math.ceil(data.total / data.pageSize)), [data])

	function updateParam(key, value) {
		const next = new URLSearchParams(params)
		if (value) next.set(key, value); else next.delete(key)
		setParams(next)
	}

	function handleViewModeChange(mode) {
		setViewMode(mode)
		localStorage.setItem('productViewMode', mode)
	}

	async function handleAddToCart(p) {
		if (addingToCart.has(p.id)) return
		
		setAddingToCart(prev => new Set(prev).add(p.id))
		
		try {
			// Calculate final price with discount (same as displayed price)
			const originalPrice = Number(p.price_cents || 0);
			const discountPercent = Number(p.discount_percent || 0);
			const finalPrice = Math.round(originalPrice * (100 - discountPercent) / 100);
			
			if (token) {
				await addItemToCart(api, { 
					productId: p.id, 
					quantity: 1, 
					priceCents: finalPrice // Use discounted price
				})
				await refreshCart()
				toast.show('✓ Đã thêm vào giỏ hàng', { type: 'success' })
			} else {
				let guestCartId = sessionStorage.getItem('guestCartId')
				const { guestCartId: newGuestCartId, items } = await addGuestItemToCart({
					guestCartId,
					productId: p.id,
					quantity: 1,
					priceCents: finalPrice // Use discounted price
				})
				sessionStorage.setItem('guestCartId', newGuestCartId)
				sessionStorage.setItem('guestCartItems', JSON.stringify(items))
				await refreshCart()
				toast.show('✓ Đã thêm vào giỏ hàng', { type: 'success' })
			}
		} catch (e) {
			toast.show('❌ Lỗi khi thêm vào giỏ hàng', { type: 'error' })
		} finally {
			setAddingToCart(prev => {
				const next = new Set(prev)
				next.delete(p.id)
				return next
			})
		}
	}

	async function handleBuyNow(p) {
		// Calculate final price with discount (same as displayed price)
		const originalPrice = Number(p.price_cents || 0);
		const discountPercent = Number(p.discount_percent || 0);
		const finalPrice = Math.round(originalPrice * (100 - discountPercent) / 100);
		
		// ✅ Mua ngay: Chuyển thẳng đến checkout, không qua giỏ hàng
		if (token) {
			try {
				// Thêm vào giỏ để có item trong cart
				await addItemToCart(api, { 
					productId: p.id, 
					quantity: 1, 
					priceCents: finalPrice // Use discounted price
				})
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
				toast.show('❌ Lỗi khi thêm vào giỏ hàng', { type: 'error' })
			}
		} else {
			navigate('/checkout', {
				state: {
					guestItems: [{
						productId: p.id,
						quantity: 1,
						priceCents: finalPrice // Use discounted price
					}]
				}
			})
		}
	}

	return (
		<main className="mx-auto max-w-7xl px-4 py-10">
			<motion.h1 
				initial={{ opacity: 0, y: -20 }}
				animate={{ opacity: 1, y: 0 }}
				className="mb-8 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-bitcount"
			>
				{VI.products.allProducts}
			</motion.h1>
			
			{/* Smart Search & Filters */}
			<div className="mb-8 space-y-4">
				{/* Search Bar */}
				<div className="relative">
					<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
						<svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
						</svg>
					</div>
					<input
						className="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-300 bg-white text-sm placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
						placeholder={VI.products.searchPlaceholder}
						value={q}
						onChange={(e) => updateParam('q', e.target.value)}
					/>
				</div>

			{/* Filters Row */}
			<div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
				<div className="flex flex-wrap items-center gap-3">
					{/* Category Filter */}
					<div className="flex items-center gap-2 flex-shrink-0">
						<div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30">
							<svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
							</svg>
						</div>
						<select 
							className="h-10 min-w-[160px] rounded-xl border-2 border-slate-200 bg-white px-4 pr-9 text-sm font-medium transition-all hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:border-blue-600 dark:focus:border-blue-500 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpolyline points=%226 9 12 15 18 9%22%3E%3C/polyline%3E%3C/svg%3E')] bg-no-repeat bg-right-2 bg-[length:20px]" 
							value={categoryId} 
							onChange={(e) => updateParam('categoryId', e.target.value)}
						>
							<option value="">Tất cả danh mục</option>
							{categories.map(cat => (
								<option key={cat.id} value={cat.id}>{getCategoryVietnameseName(cat.name)}</option>
							))}
						</select>
					</div>
					
					{/* Brand Filter */}
					<div className="flex items-center gap-2 flex-shrink-0">
						<div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30">
							<svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
							</svg>
						</div>
						<select 
							className="h-10 min-w-[160px] rounded-xl border-2 border-slate-200 bg-white px-4 pr-9 text-sm font-medium transition-all hover:border-purple-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:border-purple-600 dark:focus:border-purple-500 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpolyline points=%226 9 12 15 18 9%22%3E%3C/polyline%3E%3C/svg%3E')] bg-no-repeat bg-right-2 bg-[length:20px]" 
							value={brandId} 
							onChange={(e) => updateParam('brandId', e.target.value)}
						>
							<option value="">Tất cả hãng</option>
							{brands.map(brand => (
								<option key={brand.id} value={brand.id}>{brand.name}</option>
							))}
						</select>
					</div>
					
					{/* Price Filter */}
					<div className="flex items-center gap-2 flex-shrink-0">
						<div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30">
							<svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
						</div>
						<select 
							className="h-10 min-w-[160px] rounded-xl border-2 border-slate-200 bg-white px-4 pr-9 text-sm font-medium transition-all hover:border-green-300 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:border-green-600 dark:focus:border-green-500 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpolyline points=%226 9 12 15 18 9%22%3E%3C/polyline%3E%3C/svg%3E')] bg-no-repeat bg-right-2 bg-[length:20px]" 
							value={minPrice ? `${minPrice}-${maxPrice}` : ''} 
							onChange={(e) => {
								const [min, max] = e.target.value.split('-')
								updateParam('minPrice', min)
								updateParam('maxPrice', max)
							}}
						>
							<option value="">Tất cả mức giá</option>
							<option value="0-10000000">Dưới 10 triệu</option>
							<option value="10000000-20000000">10 - 20 triệu</option>
							<option value="20000000-30000000">20 - 30 triệu</option>
							<option value="30000000-40000000">30 - 40 triệu</option>
							<option value="40000000-50000000">40 - 50 triệu</option>
							<option value="50000000-999999999">Trên 50 triệu</option>
						</select>
					</div>
					
					{/* Rating Filter */}
					<div className="flex items-center gap-2 flex-shrink-0">
						<div className="flex items-center justify-center w-8 h-8 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
							<svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
								<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
							</svg>
						</div>
						<select 
							className="h-10 min-w-[160px] rounded-xl border-2 border-slate-200 bg-white px-4 pr-9 text-sm font-medium transition-all hover:border-yellow-300 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:border-yellow-600 dark:focus:border-yellow-500 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpolyline points=%226 9 12 15 18 9%22%3E%3C/polyline%3E%3C/svg%3E')] bg-no-repeat bg-right-2 bg-[length:20px]" 
							value={minRating} 
							onChange={(e) => updateParam('minRating', e.target.value)}
						>
							<option value="">Tất cả đánh giá</option>
							<option value="4.5">4.5 sao trở lên</option>
							<option value="4.0">4.0 sao trở lên</option>
							<option value="3.5">3.5 sao trở lên</option>
							<option value="3.0">3.0 sao trở lên</option>
							<option value="2.0">2.0 sao trở lên</option>
							<option value="1.0">1.0 sao trở lên</option>
						</select>
					</div>
					
					{/* View Mode Toggle */}
					<div className="flex items-center gap-2 flex-shrink-0">
						<div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
							<svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
							</svg>
						</div>
						<div className="flex items-center border-2 border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm">
							<button
								onClick={() => handleViewModeChange('grid')}
								className={`px-4 py-2.5 transition-all ${
									viewMode === 'grid'
										? 'bg-gradient-to-r from-primary to-primary/90 text-white shadow-md'
										: 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
								}`}
								title="Grid View"
							>
								<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
								</svg>
							</button>
							<button
								onClick={() => handleViewModeChange('list')}
								className={`px-4 py-2.5 transition-all border-l-2 border-slate-200 dark:border-slate-700 ${
									viewMode === 'list'
										? 'bg-gradient-to-r from-primary to-primary/90 text-white shadow-md'
										: 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
								}`}
								title="List View"
							>
								<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
								</svg>
							</button>
						</div>
					</div>
					
					{/* Sort */}
					<div className="flex items-center gap-2 flex-shrink-0 ml-auto">
						<div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
							<svg className="w-4 h-4 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
							</svg>
						</div>
						<select 
							className="h-10 min-w-[180px] rounded-xl border-2 border-slate-200 bg-white px-4 pr-9 text-sm font-medium transition-all hover:border-cyan-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:border-cyan-600 dark:focus:border-cyan-500 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpolyline points=%226 9 12 15 18 9%22%3E%3C/polyline%3E%3C/svg%3E')] bg-no-repeat bg-right-2 bg-[length:20px]" 
							value={sort} 
							onChange={(e) => updateParam('sort', e.target.value)}
						>
							<option value="id_desc">Mới nhất</option>
							<option value="price_asc">Giá: Thấp đến Cao</option>
							<option value="price_desc">Giá: Cao đến Thấp</option>
							<option value="name_asc">Tên: A-Z</option>
							<option value="name_desc">Tên: Z-A</option>
						</select>
					</div>
					
					{/* Clear Filters */}
					{(q || categoryId || brandId || minPrice || minRating) && (
						<button 
							className="h-10 rounded-xl border-2 border-red-300 bg-gradient-to-r from-red-50 to-red-100 px-4 text-sm font-semibold text-red-700 transition-all hover:from-red-100 hover:to-red-200 hover:border-red-400 hover:shadow-md dark:from-red-900/20 dark:to-red-900/30 dark:border-red-700 dark:text-red-400 dark:hover:from-red-900/30 dark:hover:to-red-900/40 flex items-center gap-2" 
							onClick={() => setParams({})}
						>
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
							{VI.products.clearFilters}
						</button>
					)}
				</div>
			</div>				{/* Active Filters Display */}
				{(q || categoryId || brandId || minPrice || minRating) && (
					<div className="flex flex-wrap items-center gap-2 text-sm">
						<span className="text-slate-600 dark:text-slate-400">Đang lọc:</span>
						{q && (
							<span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1 text-primary font-medium">
								Tìm kiếm: "{q}"
								<button onClick={() => updateParam('q', '')} className="hover:text-primary-dark">×</button>
							</span>
						)}
						{categoryId && (
							<span className="inline-flex items-center gap-1 rounded-lg bg-blue-100 px-3 py-1 text-blue-700 font-medium dark:bg-blue-900/30 dark:text-blue-400">
								{getCategoryVietnameseName(categories.find(c => c.id == categoryId)?.name || '')}
								<button onClick={() => updateParam('categoryId', '')} className="hover:text-blue-900">×</button>
							</span>
						)}
						{brandId && (
							<span className="inline-flex items-center gap-1 rounded-lg bg-green-100 px-3 py-1 text-green-700 font-medium dark:bg-green-900/30 dark:text-green-400">
								{brands.find(b => b.id == brandId)?.name || ''}
								<button onClick={() => updateParam('brandId', '')} className="hover:text-green-900">×</button>
							</span>
						)}
						{minPrice && (
							<span className="inline-flex items-center gap-1 rounded-lg bg-orange-100 px-3 py-1 text-orange-700 font-medium dark:bg-orange-900/30 dark:text-orange-400">
								{parseInt(minPrice) === 0 ? `Dưới ${(parseInt(maxPrice)/1000000).toFixed(0)} triệu` :
								 parseInt(maxPrice) > 50000000 ? `Trên ${(parseInt(minPrice)/1000000).toFixed(0)} triệu` :
								 `${(parseInt(minPrice)/1000000).toFixed(0)} - ${(parseInt(maxPrice)/1000000).toFixed(0)} triệu`}
								<button onClick={() => { updateParam('minPrice', ''); updateParam('maxPrice', ''); }} className="hover:text-orange-900">×</button>
							</span>
						)}
						{minRating && (
							<span className="inline-flex items-center gap-1 rounded-lg bg-yellow-100 px-3 py-1 text-yellow-700 font-medium dark:bg-yellow-900/30 dark:text-yellow-400">
								⭐ {parseFloat(minRating).toFixed(1)}+ sao
								<button onClick={() => updateParam('minRating', '')} className="hover:text-yellow-900">×</button>
							</span>
						)}
					</div>
				)}
			</div>

			{/* Results Count */}
			{!loading && (
				<div className="mb-4 text-sm text-slate-600 dark:text-slate-400">
					{data.total > 0 ? (
						<>Tìm thấy <span className="font-semibold text-slate-900 dark:text-slate-100">{data.total}</span> sản phẩm</>
					) : (
						<span className="text-red-600 dark:text-red-400">{VI.products.noProductsFound}</span>
					)}
				</div>
			)}

			{loading ? (
				<div className="flex items-center justify-center py-20">
					<div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-primary"></div>
				</div>
			) : data.items.length === 0 ? (
				<motion.div 
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					className="flex flex-col items-center justify-center py-20 text-center"
				>
					<svg className="w-24 h-24 text-slate-300 dark:text-slate-700 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
						{VI.products.noProductsFound}
					</h3>
					<p className="text-slate-600 dark:text-slate-400 mb-6">
						{VI.products.tryAdjustingFilters}
					</p>
					{(q || categoryId || brandId || minPrice || minRating) && (
						<button 
							className="btn btn-primary rounded-xl px-6"
							onClick={() => setParams({})}
						>
							{VI.products.clearFilters}
						</button>
					)}
				</motion.div>
			) : viewMode === 'grid' ? (
				// Grid View
                <motion.div 
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
				>
                    {data.items.map((p, idx) => {
						const originalPrice = Number(p.price_cents || 0);
						const discountPercent = Number(p.discount_percent || 0);
						const finalPrice = Math.round(originalPrice * (100 - discountPercent) / 100);
						
						return (
							<motion.div
								key={p.id}
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: idx * 0.05 }}
							>
								<Link to={`/product/${p.id}`} className="card block overflow-hidden group relative hover:shadow-xl transition-shadow duration-300">
									<div className="aspect-[4/3] bg-slate-100 overflow-hidden relative">
										{discountPercent > 0 && (
											<div className="absolute top-3 left-3 z-10 bg-gradient-to-r from-red-500 to-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg">
												-{discountPercent}%
											</div>
										)}
										{p.stock === 0 && (
											<div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
												<span className="bg-white text-slate-900 px-4 py-2 rounded-lg font-semibold text-sm">
													Hết hàng
												</span>
											</div>
										)}
										<img 
											src={(p.image_url && (/^https?:\/\//.test(p.image_url) ? p.image_url : (import.meta.env.VITE_API_BASE || 'http://localhost:8080') + p.image_url)) || 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=2068&auto=format&fit=crop'} 
											alt={p.name} 
											className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" 
										/>
									</div>
									<div className="p-4">
										<p className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2 min-h-[40px]">
											{p.name}
										</p>
										<p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
											{p.brand} • {getCategoryVietnameseName(p.category)}
										</p>
										<div className="flex items-baseline gap-2 mb-3">
											<p className="text-lg font-bold text-primary">{finalPrice.toLocaleString('vi-VN')} ₫</p>
											{discountPercent > 0 && (
												<p className="text-xs text-slate-400 line-through">{originalPrice.toLocaleString('vi-VN')} ₫</p>
											)}
										</div>
										{p.stock > 0 ? (
											<div className="flex gap-2">
												<button
													onClick={(e) => {
														e.preventDefault()
														e.stopPropagation()
														handleAddToCart(p)
													}}
													disabled={addingToCart.has(p.id)}
													className="flex-1 btn btn-outline text-xs py-2 rounded-xl hover:bg-primary hover:text-white hover:border-primary transition-all duration-200 hover:shadow-md active:scale-95 disabled:opacity-50"
												>
													{addingToCart.has(p.id) ? 'Đang thêm...' : 'Thêm vào giỏ'}
												</button>
												<button
													onClick={(e) => {
														e.preventDefault()
														e.stopPropagation()
														handleBuyNow(p)
													}}
													className="flex-1 btn btn-primary text-xs py-2 rounded-xl hover:bg-primary/90 hover:shadow-lg transition-all duration-200 active:scale-95"
												>
													Mua ngay
												</button>
											</div>
										) : (
											<div className="text-center py-2 text-xs text-red-500 font-semibold bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
												Sản phẩm tạm hết hàng
											</div>
										)}
									</div>
								</Link>
							</motion.div>
						);
					})}
				</motion.div>
			) : (
				// List View
				<motion.div 
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					className="space-y-4"
				>
					{data.items.map((p, idx) => {
						const originalPrice = Number(p.price_cents || 0);
						const discountPercent = Number(p.discount_percent || 0);
						const finalPrice = Math.round(originalPrice * (100 - discountPercent) / 100);
						
						return (
							<motion.div
								key={p.id}
								initial={{ opacity: 0, x: -20 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ delay: idx * 0.03 }}
							>
								<Link to={`/product/${p.id}`} className="card block overflow-hidden group relative hover:shadow-xl transition-shadow duration-300">
									<div className="flex flex-col sm:flex-row gap-4 p-4">
										{/* Image */}
										<div className="w-full sm:w-48 h-48 bg-slate-100 overflow-hidden relative flex-shrink-0 rounded-lg">
											{discountPercent > 0 && (
												<div className="absolute top-3 left-3 z-10 bg-gradient-to-r from-red-500 to-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg">
													-{discountPercent}%
												</div>
											)}
											{p.stock === 0 && (
												<div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
													<span className="bg-white text-slate-900 px-4 py-2 rounded-lg font-semibold text-sm">
														Hết hàng
													</span>
												</div>
											)}
											<img 
												src={(p.image_url && (/^https?:\/\//.test(p.image_url) ? p.image_url : (import.meta.env.VITE_API_BASE || 'http://localhost:8080') + p.image_url)) || 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=2068&auto=format&fit=crop'} 
												alt={p.name} 
												className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" 
											/>
										</div>
										
										{/* Content */}
										<div className="flex-1 flex flex-col justify-between">
											<div>
												<h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
													{p.name}
												</h3>
												<p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
													{p.brand} • {getCategoryVietnameseName(p.category)}
												</p>
												{p.description && (
													<p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">
														{p.description}
													</p>
												)}
											</div>
											<div className="flex flex-col gap-3">
												<div className="flex items-baseline gap-2">
													<p className="text-xl font-bold text-primary">{finalPrice.toLocaleString('vi-VN')} ₫</p>
													{discountPercent > 0 && (
														<p className="text-sm text-slate-400 line-through">{originalPrice.toLocaleString('vi-VN')} ₫</p>
													)}
												</div>
												{p.stock > 0 ? (
													<div className="flex gap-2">
														<button
															onClick={(e) => {
																e.preventDefault()
																e.stopPropagation()
																handleAddToCart(p)
															}}
															disabled={addingToCart.has(p.id)}
															className="flex-1 btn btn-outline text-xs py-2 rounded-xl hover:bg-primary hover:text-white hover:border-primary transition-all duration-200 hover:shadow-md active:scale-95 disabled:opacity-50"
														>
															{addingToCart.has(p.id) ? 'Đang thêm...' : 'Thêm vào giỏ'}
														</button>
														<button
															onClick={(e) => {
																e.preventDefault()
																e.stopPropagation()
																handleBuyNow(p)
															}}
															className="flex-1 btn btn-primary text-xs py-2 rounded-xl hover:bg-primary/90 hover:shadow-lg transition-all duration-200 active:scale-95"
														>
															Mua ngay
														</button>
													</div>
												) : (
													<div className="text-center py-2 text-xs text-red-500 font-semibold bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
														Sản phẩm tạm hết hàng
													</div>
												)}
											</div>
										</div>
									</div>
								</Link>
							</motion.div>
						);
					})}
				</motion.div>
			)}

			{/* Pagination - Always show page numbers, even if only 1 page */}
			{!loading && data.items.length > 0 && totalPages >= 1 && (
				<div className="mt-12 flex items-center justify-center gap-2">
					<button 
						className="btn btn-outline rounded-xl px-4 h-11 disabled:opacity-50 disabled:cursor-not-allowed" 
						disabled={page <= 1} 
						onClick={() => updateParam('page', String(page - 1))}
					>
						← Trước
					</button>
					<div className="flex items-center gap-1">
						{[...Array(Math.min(totalPages, 5))].map((_, i) => {
							let pageNum;
							if (totalPages <= 5) {
								pageNum = i + 1;
							} else if (page <= 3) {
								pageNum = i + 1;
							} else if (page >= totalPages - 2) {
								pageNum = totalPages - 4 + i;
							} else {
								pageNum = page - 2 + i;
							}
							return (
								<button
									key={pageNum}
									className={`h-11 w-11 rounded-xl text-sm font-medium transition-all ${
										page === pageNum 
											? 'bg-primary text-white shadow-lg shadow-primary/30' 
											: 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
									}`}
									onClick={() => updateParam('page', String(pageNum))}
								>
									{pageNum}
								</button>
							);
						})}
					</div>
					<button 
						className="btn btn-outline rounded-xl px-4 h-11 disabled:opacity-50 disabled:cursor-not-allowed" 
						disabled={page >= totalPages} 
						onClick={() => updateParam('page', String(page + 1))}
					>
						Sau →
					</button>
				</div>
			)}
		</main>
	)
}

