import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { listProducts } from '../services/catalog'
import FiltersBar from '../components/FiltersBar'
import Pagination from '../components/Pagination'

const DEFAULT_PAGE_SIZE = 8

export default function Products() {
	const [params, setParams] = useSearchParams()
	const [loading, setLoading] = useState(true)
	const [data, setData] = useState({ items: [], page: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0 })
	const q = params.get('q') || ''
	const page = parseInt(params.get('page') || '1', 10)
	const sort = params.get('sort') || 'name_asc'
	const brand = params.get('brand') || ''
	const category = params.get('category') || ''
	const minPrice = params.get('minPrice') ? Number(params.get('minPrice')) : null
	const maxPrice = params.get('maxPrice') ? Number(params.get('maxPrice')) : null
	const minRating = params.get('minRating') ? Number(params.get('minRating')) : null
	const pageSize = Number(params.get('pageSize')) || DEFAULT_PAGE_SIZE

	useEffect(() => {
		let ignore = false
		setLoading(true)
		listProducts({ q, page, sort, brand, category, minPrice, maxPrice, minRating, pageSize }).then((res) => {
			if (!ignore) setData(res)
		}).finally(() => setLoading(false))
		return () => { ignore = true }
	}, [q, page, sort, brand, category, minPrice, maxPrice, minRating, pageSize])

	const totalPages = useMemo(() => Math.max(1, Math.ceil(data.total / data.pageSize)), [data])

	function updateParam(key, value) {
		const next = new URLSearchParams(params)
		if (value) next.set(key, value); else next.delete(key)
		setParams(next)
	}

	return (
		<main className="container-page py-10">
			<h1 className="heading-section mb-6">All laptops</h1>
			<div className="mb-6">
				<FiltersBar
					query={q}
					onQuery={(v) => updateParam('q', v)}
					sort={sort}
					onSort={(v) => updateParam('sort', v)}
					brands={Array.from(new Set(data.items.map(i => i.brand).filter(Boolean)))}
					brandFilter={brand}
					onBrandFilter={(v) => updateParam('brand', v)}
					categories={Array.from(new Set(data.items.map(i => i.category).filter(Boolean)))}
					categoryFilter={category}
					onCategoryFilter={(v) => updateParam('category', v)}
					minPrice={minPrice ?? ''}
					maxPrice={maxPrice ?? ''}
					onPriceChange={([min, max]) => { updateParam('minPrice', String(min)); updateParam('maxPrice', String(max)); }}
					minRating={minRating}
					onMinRatingChange={(v) => updateParam('minRating', v ? String(v) : '')}
				/>
			</div>

			{loading ? (
				<p className="text-muted">Loading...</p>
			) : (
				<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
					{data.items.map((p) => (
						<Link key={p.id} to={`/product/${p.id}`} className="card block overflow-hidden">
							<div className="aspect-[4/3] bg-slate-100">
								<img src={(p.image_url && (/^https?:\/\//.test(p.image_url) ? p.image_url : (import.meta.env.VITE_API_BASE || 'http://localhost:8080') + p.image_url)) || 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=2068&auto=format&fit=crop'} alt={p.name} className="h-full w-full object-cover" />
							</div>
							<div className="p-4">
								<p className="line-clamp-1 text-sm font-semibold">{p.name}</p>
								<p className="mt-1 text-sm text-slate-600">{p.brand} • {p.category}</p>
								<p className="mt-2 text-lg font-semibold">{(p.price_cents / 100).toLocaleString()} ₫</p>
							</div>
						</Link>
					))}
				</div>
			)}

			<Pagination page={data.page || page} totalPages={Math.max(1, Math.ceil((data.total || 0) / (data.pageSize || 20)))} onChange={(p) => updateParam('page', String(p))} />
		</main>
	)
}


