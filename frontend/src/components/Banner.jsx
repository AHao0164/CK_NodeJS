import React, { useState, useEffect } from 'react'
import { listBanners } from '../services/catalog'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

export default function Banner() {
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    listBanners().then(data => {
      console.log('Banners loaded:', data)
      if (!ignore && data && data.length > 0) {
        setBanners(data)
        console.log('Banner images:', data.map(b => b.image_url))
      }
    }).catch(err => console.error('Banner load error:', err))
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [])

  // Layout theo ảnh bạn cung cấp: 
  // Row 1: 1 nhỏ, 1 lớn, 1 nhỏ
  // Row 2: 1 rất lớn (full width)
  // Row 3: 1 nhỏ, 1 lớn
  const getGridClass = (idx) => {
    // Banner 0: nhỏ bên trái
    if (idx === 0) return 'col-span-1 row-span-1'
    // Banner 1: lớn giữa
    if (idx === 1) return 'col-span-2 row-span-1'
    // Banner 2: nhỏ bên phải
    if (idx === 2) return 'col-span-1 row-span-1'
    // Banner 3: rất lớn full width
    if (idx === 3) return 'col-span-4 row-span-1'
    // Banner 4: nhỏ bên trái
    if (idx === 4) return 'col-span-1 row-span-1'
    // Banner 5: lớn bên phải
    if (idx === 5) return 'col-span-3 row-span-1'
    return 'col-span-1 row-span-1'
  }

  const getHeightClass = (idx) => {
    // Banner lớn có chiều cao hơn
    if (idx === 1 || idx === 3 || idx === 5) return 'min-h-[280px] md:min-h-[320px]'
    return 'min-h-[200px] md:min-h-[240px]'
  }

  if (loading) {
    return (
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:py-16">
          <div className="flex items-center justify-center py-20">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white"></div>
          </div>
        </div>
      </section>
    )
  }

  if (banners.length === 0) {
    return null
  }

  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Background effects */}
      <div className="absolute inset-0 -z-10 overflow-hidden opacity-40" aria-hidden>
        <div className="absolute top-0 left-0 h-72 w-72 rounded-full bg-purple-600 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-500 blur-3xl" />
      </div>
      
      <div className="relative z-0 mx-auto max-w-7xl px-4 py-12 sm:py-16">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Khám phá công nghệ hàng đầu
          </h1>
        </div>

        {/* Banner Grid - Layout theo ảnh mẫu */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-auto">
          {banners.slice(0, 6).map((banner, idx) => {
            // Images are served from frontend's public folder, not API
            const imageUrl = banner.image_url
            
            return (
              <a 
                key={banner.id} 
                href={banner.link_url || '#'}
                className={`group relative overflow-hidden rounded-2xl bg-slate-800/50 backdrop-blur transition-all hover:scale-[1.02] ${getGridClass(idx)} ${getHeightClass(idx)}`}
              >
                {/* Image - object-cover để fill khung ảnh, không để trống */}
                <img 
                  src={imageUrl} 
                  alt={banner.title}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" 
                  loading="lazy" 
                />
                
                {/* Gradient Overlay - Ẩn mặc định, hiện khi hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                {/* Content - Ẩn mặc định, hiện khi hover */}
                <div className="absolute inset-0 flex flex-col justify-end p-4 md:p-6 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0">
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold text-white md:text-lg lg:text-xl drop-shadow-lg">
                      {banner.title}
                    </h3>
                    {banner.subtitle && (
                      <p className="text-xs text-slate-200 md:text-sm drop-shadow-md">
                        {banner.subtitle}
                      </p>
                    )}
                    <button className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg hover:bg-slate-100 transition-colors">
                      Xem thêm
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </a>
            )
          })}
        </div>
      </div>
    </section>
  )
}
