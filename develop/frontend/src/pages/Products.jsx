import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { listProducts } from '../services/catalog'
import { motion } from 'framer-motion'
import { VI } from '../constants/vi'
import { getCategoryVietnameseName } from '../constants/categoryMapping'

export default function Products() {
	const [params, setParams] = useSearchParams()
	const [loading, setLoading] = useState(true)
	const [data, setData] = useState({ items: [], page: 1, pageSize: 20, total: 0 })
	const [brands, setBrands] = useState([])
	const [categories, setCategories] = useState([])
	
	const q = params.get('q') || ''
	const page = parseInt(params.get('page') || '1', 10)
	const sort = params.get('sort') || 'id_desc'
	const categoryId = params.get('categoryId') || ''
	const brandId = params.get('brandId') || ''
	const minPrice = params.get('minPrice') || ''
	const maxPrice = params.get('maxPrice') || ''

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
		listProducts({ q, page, sort, categoryId, brandId, minPrice, maxPrice }).then((res) => {
			if (!ignore) setData(res)
		}).finally(() => setLoading(false))
		return () => { ignore = true }
	}, [q, page, sort, categoryId, brandId, minPrice, maxPrice])

	const totalPages = useMemo(() => Math.max(1, Math.ceil(data.total / data.pageSize)), [data])

	function updateParam(key, value) {
		const next = new URLSearchParams(params)
		if (value) next.set(key, value); else next.delete(key)
		setParams(next)
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
			<div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
				<div className="flex flex-wrap items-center gap-4">
					{/* Category Filter */}
					<div className="flex items-center gap-2">
						<span className="text-sm font-semibold text-slate-700 dark:text-slate-300">📁</span>
						<select 
							className="h-10 rounded-lg border border-slate-300 bg-white px-3 pr-8 text-sm font-medium transition-all hover:border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" 
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
					<div className="flex items-center gap-2">
						<span className="text-sm font-semibold text-slate-700 dark:text-slate-300">🏷️</span>
						<select 
							className="h-10 rounded-lg border border-slate-300 bg-white px-3 pr-8 text-sm font-medium transition-all hover:border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" 
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
					<div className="flex items-center gap-2">
						<span className="text-sm font-semibold text-slate-700 dark:text-slate-300">💰</span>
						<select 
							className="h-10 rounded-lg border border-slate-300 bg-white px-3 pr-8 text-sm font-medium transition-all hover:border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" 
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
					
					{/* Sort */}
					<div className="flex items-center gap-2 ml-auto">
						<span className="text-sm font-semibold text-slate-700 dark:text-slate-300">🔄</span>
						<select 
							className="h-10 rounded-lg border border-slate-300 bg-white px-3 pr-8 text-sm font-medium transition-all hover:border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" 
							value={sort} 
							onChange={(e) => updateParam('sort', e.target.value)}
						>
							<option value="id_desc">Mới nhất</option>
							<option value="price_asc">{VI.products.priceLowToHigh}</option>
							<option value="price_desc">{VI.products.priceHighToLow}</option>
							<option value="name_asc">{VI.products.nameAZ}</option>
							<option value="name_desc">{VI.products.nameZA}</option>
						</select>
					</div>
					
					{/* Clear Filters */}
					{(q || categoryId || brandId || minPrice) && (
						<button 
							className="h-10 rounded-lg border-2 border-red-200 bg-red-50 px-4 text-sm font-medium text-red-600 transition-all hover:bg-red-100 hover:border-red-300 dark:bg-red-900/20 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30" 
							onClick={() => setParams({})}
						>
							{VI.products.clearFilters}
						</button>
					)}
				</div>
			</div>				{/* Active Filters Display */}
				{(q || categoryId || brandId || minPrice) && (
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
					{(q || categoryId || brandId || minPrice) && (
						<button 
							className="btn btn-primary rounded-xl px-6"
							onClick={() => setParams({})}
						>
							{VI.products.clearFilters}
						</button>
					)}
				</motion.div>
			) : (
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
										<div className="flex items-baseline gap-2">
											<p className="text-lg font-bold text-primary">{finalPrice.toLocaleString('vi-VN')} ₫</p>
											{discountPercent > 0 && (
												<p className="text-xs text-slate-400 line-through">{originalPrice.toLocaleString('vi-VN')} ₫</p>
											)}
										</div>
									</div>
								</Link>
							</motion.div>
						);
					})}
				</motion.div>
			)}

			{/* Pagination */}
			{!loading && data.items.length > 0 && totalPages > 1 && (
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

