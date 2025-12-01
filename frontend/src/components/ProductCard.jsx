import React from 'react'
import { resolveImageUrl } from '../api/client'
import { Link } from 'react-router-dom'
import VI from '../constants/vi'

export default function ProductCard({ product, onAdd, onBuyNow }) {
    const originalPrice = Number(product.price_cents || 0)
    const discountPercent = Number(product.discount_percent || 0)
    const finalPrice = Math.round(originalPrice * (100 - discountPercent) / 100)
    const image = product.image_url ? resolveImageUrl(product.image_url) : 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=1200&auto=format&fit=crop'
    const stock = Number(product.stock || 0)
    const outOfStock = stock <= 0
    
    return (
        <div className="card group flex flex-col overflow-hidden relative">
            <Link to={`/product/${product.id}`} className="relative block aspect-[4/3] w-full overflow-hidden bg-slate-100">
                {outOfStock && (
                    <div className="absolute inset-0 z-10 bg-black/60 flex items-center justify-center">
                        <div className="bg-red-500 text-white px-4 py-2 rounded-md text-sm font-bold">
                            Hết hàng
                        </div>
                    </div>
                )}
                {!outOfStock && discountPercent > 0 && (
                    <div className="absolute top-2 left-2 z-10 bg-red-500 text-white px-2 py-1 rounded-md text-xs font-bold">
                        -{discountPercent}%
                    </div>
                )}
                <img
                    src={image}
                    alt={product.name}
                    className={`h-full w-full object-cover transition-transform duration-300 ${outOfStock ? 'opacity-50 grayscale' : 'group-hover:scale-105'}`}
                />
            </Link>
            <div className="flex flex-1 flex-col gap-2 p-4">
                <Link to={`/product/${product.id}`} className="line-clamp-1 text-sm font-semibold text-slate-900 hover:underline dark:text-slate-100">
                    {product.name}
                </Link>
                {product.brand && product.category && (
                    <p className="line-clamp-2 text-xs text-slate-500">{product.brand} • {product.category}</p>
                )}
                <div className="mt-auto flex flex-col gap-2">
                    <div className="flex items-baseline gap-2">
                        <p className="text-lg font-semibold text-primary">
                            {finalPrice.toLocaleString('vi-VN')} ₫
                        </p>
                        {discountPercent > 0 && (
                            <p className="text-xs text-slate-400 line-through">
                                {originalPrice.toLocaleString('vi-VN')} ₫
                            </p>
                        )}
                    </div>
                    {outOfStock ? (
                        <div className="text-center py-2 text-xs text-red-500 font-semibold bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                            Sản phẩm tạm hết hàng
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <button 
                                onClick={() => onAdd?.(product)} 
                                className="flex-1 btn btn-outline text-xs py-2 rounded-xl hover:bg-primary hover:text-white hover:border-primary transition-all duration-200 hover:shadow-md active:scale-95"
                            >
                                {VI.products.addToCart}
                            </button>
                            <button 
                                onClick={() => onBuyNow?.(product)} 
                                className="flex-1 btn btn-primary text-xs py-2 rounded-xl hover:bg-primary/90 hover:shadow-lg transition-all duration-200 active:scale-95"
                            >
                                Mua ngay
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

