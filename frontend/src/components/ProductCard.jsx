import React from 'react'
import { resolveImageUrl } from '../api/client'
import { Link } from 'react-router-dom'

export default function ProductCard({ product, onAdd }) {
    const price = Number(product.price_cents || 0) / 100
    const image = product.image_url ? resolveImageUrl(product.image_url) : 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=1200&auto=format&fit=crop'
    return (
        <div className="card group flex flex-col overflow-hidden">
            <Link to={`/product/${product.id}`} className="relative block aspect-[4/3] w-full overflow-hidden bg-slate-100">
                <img
                    src={image}
                    alt={product.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
            </Link>
            <div className="flex flex-1 flex-col gap-2 p-4">
                <Link to={`/product/${product.id}`} className="line-clamp-1 text-sm font-semibold text-slate-900 hover:underline dark:text-slate-100">
                    {product.name}
                </Link>
                {product.brand && product.category && (
                    <p className="line-clamp-2 text-xs text-slate-500">{product.brand} • {product.category}</p>
                )}
                <div className="mt-auto flex items-center justify-between">
                    <div>
                        <p className="text-lg font-semibold text-primary">
                            {price.toLocaleString()} ₫
                        </p>
                    </div>
                    <button onClick={() => onAdd?.(product)} className="btn btn-primary rounded-xl">Add</button>
                </div>
            </div>
        </div>
    )
}

