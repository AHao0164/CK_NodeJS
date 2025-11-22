import React, { useState, useEffect, useMemo } from 'react'

const PRICE_MIN = 0
const PRICE_SLIDER_BASE_MAX = 64000000

const pricePresets = [
  { label: 'Dưới 2 triệu', min: 0, max: 2_000_000 },
  { label: 'Từ 2 - 4 triệu', min: 2_000_000, max: 4_000_000 },
  { label: 'Từ 4 - 7 triệu', min: 4_000_000, max: 7_000_000 },
  { label: 'Từ 7 - 13 triệu', min: 7_000_000, max: 13_000_000 },
  { label: 'Từ 13 - 20 triệu', min: 13_000_000, max: 20_000_000 },
  { label: 'Trên 20 triệu', min: 20_000_000, max: 64_000_000 }
]

const demandOptions = [
  { label: 'Chơi game / Cấu hình cao', value: 'Gaming', hint: 'Card rời, tản nhiệt tốt' },
  { label: 'Pin khủng trên 5000 mAh', value: 'Workstation', hint: 'Thời lượng dùng lâu' },
  { label: 'Chụp ảnh, quay phim', value: 'Business', hint: 'Tập trung vào camera' },
  { label: 'Livestream', value: 'Student', hint: 'Gọn nhẹ, dễ cầm' },
  { label: 'Mỏng nhẹ', value: 'Ultrabook', hint: 'Trọng lượng dưới 1.5kg' }
]

const sortOptions = [
  { key: 'name_asc', label: 'Tên A-Z' },
  { key: 'name_desc', label: 'Tên Z-A' },
  { key: 'price_asc', label: 'Giá tăng dần' },
  { key: 'price_desc', label: 'Giá giảm dần' },
  { key: 'rating_desc', label: 'Đánh giá cao' }
]

const formatCurrency = (value) =>
  new Intl.NumberFormat('vi-VN').format(Math.max(PRICE_MIN, value || 0)) + '₫'

export default function FiltersBar({
  query,
  onQuery,
  sort,
  onSort,
  brands = [],
  brandFilter,
  onBrandFilter,
  categories = [],
  categoryFilter,
  onCategoryFilter,
  minPrice,
  maxPrice,
  onPriceChange,
  minRating,
  onMinRatingChange
}) {
  const normalizePrice = (value) => {
    if (value === '' || value === null || value === undefined) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  const activeMinPrice = normalizePrice(minPrice)
  const activeMaxPrice = normalizePrice(maxPrice)
  const sliderMax = Math.max(PRICE_SLIDER_BASE_MAX, activeMaxPrice ?? PRICE_SLIDER_BASE_MAX)

  const [priceRange, setPriceRange] = useState([
    activeMinPrice ?? PRICE_MIN,
    activeMaxPrice ?? sliderMax
  ])
  const [manualMin, setManualMin] = useState(String(priceRange[0]))
  const [manualMax, setManualMax] = useState(String(priceRange[1]))
  const [panelOpen, setPanelOpen] = useState(false)
  const [exclusiveOnly, setExclusiveOnly] = useState(false)

  useEffect(() => {
    setPriceRange([activeMinPrice ?? PRICE_MIN, activeMaxPrice ?? sliderMax])
  }, [activeMinPrice, activeMaxPrice, sliderMax])

  useEffect(() => {
    setManualMin(String(priceRange[0]))
    setManualMax(String(priceRange[1]))
  }, [priceRange])

  const categoryOptions = useMemo(() => {
    const unique = Array.from(new Set(categories))
    if (!unique.length) {
      return ['Ultrabook', 'Gaming', 'Business', 'Student', 'Workstation'].map((c) => ({ label: c, value: c }))
    }
    return unique.map((c) => ({ label: c, value: c }))
  }, [categories])

  const applyPrice = (next) => {
    const [rawMin, rawMax] = next
    const clamp = (value) => Math.min(Math.max(value ?? PRICE_MIN, PRICE_MIN), sliderMax)
    const minValue = clamp(rawMin)
    const maxValue = clamp(rawMax)
    const normalized = [
      Math.min(minValue, maxValue),
      Math.max(minValue, maxValue)
    ]
    setPriceRange(normalized)
    onPriceChange?.(normalized)
  }

  const handleRangeChange = (index) => (event) => {
    const next = [...priceRange]
    const value = Number(event.target.value)
    if (index === 0) {
      next[0] = Math.min(value, next[1])
    } else {
      next[1] = Math.max(value, next[0])
    }
    setPriceRange(next)
  }

  const commitPrice = () => applyPrice(priceRange)

  const progressStart = ((priceRange[0] - PRICE_MIN) / (sliderMax - PRICE_MIN)) * 100
  const progressEnd = ((priceRange[1] - PRICE_MIN) / (sliderMax - PRICE_MIN)) * 100

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-blue-600 shadow-sm transition hover:border-blue-300"
            onClick={() => setPanelOpen(true)}
          >
            <span>🔎</span>
            <span>Lọc</span>
          </button>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {brands.slice(0, 12).map((b) => (
              <button
                key={b}
                onClick={() => onBrandFilter?.(b === brandFilter ? '' : b)}
                className={`rounded-full px-3 py-1 text-sm transition ${b === brandFilter ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'bg-slate-50 text-slate-700 border border-slate-100'}`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-sm">
          <div className="flex flex-wrap items-center gap-3 text-slate-600">
            <span className="font-semibold text-slate-500">Sắp xếp theo:</span>
            <div className="flex flex-wrap gap-2">
              {sortOptions.map((o) => (
                <button
                  key={o.key}
                  onClick={() => onSort?.(o.key)}
                  className={`rounded-2xl px-3 py-1 transition ${o.key === sort ? 'bg-blue-50 text-blue-600 font-medium' : 'text-slate-600 hover:text-blue-600'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="h-10 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 placeholder:text-slate-400 focus:border-blue-500"
              placeholder="Tìm kiếm tên, thương hiệu"
              value={query}
              onChange={(e) => onQuery?.(e.target.value)}
            />
            <select
              className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-600"
              value={minRating ?? ''}
              onChange={(e) => onMinRatingChange?.(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Đánh giá</option>
              <option value={1}>1+</option>
              <option value={2}>2+</option>
              <option value={3}>3+</option>
              <option value={4}>4+</option>
            </select>
          </div>
        </div>
      </div>

      {panelOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 px-4 py-8">
          <div className="w-full max-w-6xl rounded-[32px] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-slate-800">Tất cả bộ lọc</h2>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-500 transition hover:border-slate-300"
                onClick={() => setPanelOpen(false)}
              >
                × Đóng
              </button>
            </div>
            <div className="mt-4 space-y-6">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <input id="exclusive-toggle" type="checkbox" checked={exclusiveOnly} onChange={(e) => setExclusiveOnly(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                <label htmlFor="exclusive-toggle" className="font-medium">Đặc quyền tại Thế Giới Di Động</label>
              </div>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-base font-semibold text-slate-700">Hãng</p>
                  <span className="text-sm text-slate-500">{brands.length} lựa chọn</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {brands.slice(0, 16).map((b) => (
                    <button
                      key={b}
                      onClick={() => onBrandFilter?.(b === brandFilter ? '' : b)}
                      className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${b === brandFilter ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <p className="text-base font-semibold text-slate-700">Giá</p>
                <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                  {pricePresets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyPrice([preset.min, preset.max])}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 font-medium text-slate-700 transition hover:border-blue-300 hover:text-blue-600"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="absolute h-3 rounded-full bg-blue-500"
                      style={{
                        left: `${Math.min(progressStart, progressEnd)}%`,
                        width: `${Math.max(progressEnd - progressStart, 0)}%`
                      }}
                    />
                  </div>
                  <div className="relative -mt-3 h-10">
                    <input
                      type="range"
                      min={PRICE_MIN}
                      max={sliderMax}
                      value={priceRange[0]}
                      onChange={handleRangeChange(0)}
                      onMouseUp={commitPrice}
                      onTouchEnd={commitPrice}
                      className="pointer-events-auto absolute inset-0 h-10 w-full appearance-none bg-transparent"
                    />
                  </div>
                  <div className="relative -mt-10 h-10">
                    <input
                      type="range"
                      min={PRICE_MIN}
                      max={sliderMax}
                      value={priceRange[1]}
                      onChange={handleRangeChange(1)}
                      onMouseUp={commitPrice}
                      onTouchEnd={commitPrice}
                      className="pointer-events-auto absolute inset-0 h-10 w-full appearance-none bg-transparent"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                  <label className="flex flex-col gap-1 text-slate-500">
                    Min
                    <input
                      type="number"
                      value={manualMin}
                      onChange={(e) => setManualMin(e.target.value)}
                      onBlur={() => applyPrice([Number(manualMin), priceRange[1]])}
                      className="h-10 w-32 rounded-2xl border border-slate-200 px-3 text-sm focus:border-blue-400"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-slate-500">
                    Max
                    <input
                      type="number"
                      value={manualMax}
                      onChange={(e) => setManualMax(e.target.value)}
                      onBlur={() => applyPrice([priceRange[0], Number(manualMax)])}
                      className="h-10 w-32 rounded-2xl border border-slate-200 px-3 text-sm focus:border-blue-400"
                    />
                  </label>
                  <div className="flex flex-col gap-1 text-slate-500">
                    <span className="text-xs uppercase text-slate-500">Đã chọn</span>
                    <span className="text-sm font-semibold text-slate-800">{formatCurrency(priceRange[0])} - {formatCurrency(priceRange[1])}</span>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <p className="text-base font-semibold text-slate-700">Loại sản phẩm</p>
                <div className="flex flex-wrap gap-3">
                  {categoryOptions.map((category) => (
                    <button
                      key={category.value}
                      type="button"
                      onClick={() => onCategoryFilter?.(category.value === categoryFilter ? '' : category.value)}
                      className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${category.value === categoryFilter ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <p className="text-base font-semibold text-slate-700">Nhu cầu</p>
                <div className="flex flex-wrap gap-3 text-sm">
                  {demandOptions.map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => onCategoryFilter?.(opt.value === categoryFilter ? '' : opt.value)}
                      className={`group rounded-2xl border px-4 py-2 text-left transition ${opt.value === categoryFilter ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{opt.label}</span>
                        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-xs text-slate-400 group-hover:border-slate-400">?</span>
                      </div>
                      <p className="text-xs text-slate-500">{opt.hint}</p>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
