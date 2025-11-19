import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { listProducts } from '../services/catalog'
import { motion } from 'framer-motion'

export default function Products() {
	const [params, setParams] = useSearchParams()
	const [loading, setLoading] = useState(true)
	const [data, setData] = useState({ items: [], page: 1, pageSize: 20, total: 0 })
	const q = params.get('q') || ''
	const page = parseInt(params.get('page') || '1', 10)
	const sort = params.get('sort') || 'id_desc'

	useEffect(() => {
		let ignore = false
		setLoading(true)
		listProducts({ q, page, sort }).then((res) => {
			if (!ignore) setData(res)
		}).finally(() => setLoading(false))
		return () => { ignore = true }
	}, [q, page, sort])

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
			className="mb-6 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-bitcount"
		>
			All Products
		</motion.h1>
			<div className="mb-6 flex flex-col items-stretch justify-between gap-3 sm:flex-row">
				<input
					className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm placeholder:text-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 sm:max-w-sm"
					placeholder="Search by name, brand, or category"
					value={q}
					onChange={(e) => updateParam('q', e.target.value)}
				/>
				<select className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" value={sort} onChange={(e) => updateParam('sort', e.target.value)}>
					<option value="id_desc">Newest</option>
					<option value="price_asc">Price: Low to High</option>
					<option value="price_desc">Price: High to Low</option>
					<option value="name_asc">Name A-Z</option>
					<option value="name_desc">Name Z-A</option>
				</select>
			</div>

			{loading ? (
				<div className="flex items-center justify-center py-20">
					<div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-primary"></div>
				</div>
			) : (
                <motion.div 
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
				>
                    {data.items.map((p, idx) => (
                        <motion.div
							key={p.id}
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: idx * 0.05 }}
						>
							<Link to={`/product/${p.id}`} className="card block overflow-hidden group">
								<div className="aspect-[4/3] bg-slate-100 overflow-hidden">
									<img 
										src={(p.image_url && (/^https?:\/\//.test(p.image_url) ? p.image_url : (import.meta.env.VITE_API_BASE || 'http://localhost:8080') + p.image_url)) || 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=2068&auto=format&fit=crop'} 
										alt={p.name} 
										className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" 
									/>
								</div>
								<div className="p-4">
									<p className="line-clamp-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{p.name}</p>
									<p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{p.brand} • {p.category}</p>
									<p className="mt-2 text-lg font-semibold text-primary">{(p.price_cents / 100).toLocaleString()} ₫</p>
								</div>
							</Link>
						</motion.div>
					))}
				</motion.div>
			)}

			{/* Pagination */}
			<div className="mt-8 flex items-center justify-center gap-2">
				<button className="btn btn-outline rounded-xl" disabled={page <= 1} onClick={() => updateParam('page', String(page - 1))}>Previous</button>
				<span className="text-sm text-slate-600 dark:text-slate-400">Page {page} / {totalPages}</span>
				<button className="btn btn-outline rounded-xl" disabled={page >= totalPages} onClick={() => updateParam('page', String(page + 1))}>Next</button>
			</div>
		</main>
	)
}

