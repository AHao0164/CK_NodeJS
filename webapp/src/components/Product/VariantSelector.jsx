import React, { useState } from 'react'

export default function VariantSelector({ variants = [], onSelect }) {
  const [selected, setSelected] = useState({})
  
  // Group variants by name (e.g., Color, Size, Storage)
  const grouped = variants.reduce((acc, v) => {
    if (!acc[v.variant_name]) acc[v.variant_name] = []
    acc[v.variant_name].push(v)
    return acc
  }, {})
  
  const handleSelect = (name, value, variant) => {
    const newSelected = { ...selected, [name]: value }
    setSelected(newSelected)
    onSelect?.(variant, newSelected)
  }
  
  if (variants.length === 0) return null
  
  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([name, options]) => (
        <div key={name}>
          <div className="mb-2 text-sm font-medium text-slate-700">
            {name}: <span className="text-slate-900">{selected[name] || 'Chọn'}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {options.map((variant) => {
              const isSelected = selected[name] === variant.variant_value
              const isAvailable = variant.is_available && variant.stock > 0
              
              return (
                <button
                  key={variant.id}
                  disabled={!isAvailable}
                  onClick={() => handleSelect(name, variant.variant_value, variant)}
                  className={`min-w-[80px] rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-600 ring-offset-2'
                      : isAvailable
                      ? 'border-slate-300 bg-white text-slate-700 hover:border-blue-600 hover:bg-blue-50'
                      : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 line-through'
                  }`}
                >
                  {variant.variant_value}
                  {variant.price_adjustment_cents !== 0 && (
                    <span className="ml-1 text-xs">
                      ({variant.price_adjustment_cents > 0 ? '+' : ''}
                      {(variant.price_adjustment_cents / 100).toLocaleString()}₫)
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {options.some(v => !v.is_available || v.stock === 0) && (
            <div className="mt-1 text-xs text-slate-500">
              * Một số phiên bản đã hết hàng
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
