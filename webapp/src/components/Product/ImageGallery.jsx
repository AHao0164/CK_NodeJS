import React, { useState } from 'react'

export default function ImageGallery({ images = [], productName }) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  
  const displayImages = images.length > 0 ? images : [
    { url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800' },
    { url: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800' },
    { url: 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=800' }
  ]
  
  const resolveUrl = (url) => {
    if (!url) return displayImages[0].url
    if (/^https?:\/\//.test(url)) return url
    return (import.meta.env.VITE_API_BASE || 'http://localhost:8080') + url
  }
  
  return (
    <div className="space-y-4">
      {/* Main Image */}
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-100">
        <img
          src={resolveUrl(displayImages[selectedIndex]?.url)}
          alt={`${productName} - ${selectedIndex + 1}`}
          className="h-full w-full object-cover"
        />
      </div>
      
      {/* Thumbnail Grid */}
      {displayImages.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {displayImages.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedIndex(idx)}
              className={`relative aspect-square overflow-hidden rounded-lg transition-all ${
                idx === selectedIndex
                  ? 'ring-2 ring-blue-600 ring-offset-2'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              <img
                src={resolveUrl(img.url)}
                alt={`${productName} thumbnail ${idx + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
