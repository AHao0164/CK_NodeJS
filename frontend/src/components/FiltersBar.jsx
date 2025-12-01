import React from 'react'

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
  onCategoryFilter
}) {
  return (
    <div className="flex flex-col items-stretch justify-between gap-3 py-3 sm:flex-row">
      <input
        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm placeholder:text-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 sm:max-w-sm"
        placeholder="Tìm theo tên, thương hiệu, danh mục"
        value={query}
        onChange={(e) => onQuery?.(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <select className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" value={sort} onChange={(e) => onSort?.(e.target.value)}>
          <option value="featured">Nổi bật</option>
          <option value="price_asc">Giá: Thấp đến Cao</option>
          <option value="price_desc">Giá: Cao đến Thấp</option>
          <option value="name_asc">Tên A-Z</option>
          <option value="name_desc">Tên Z-A</option>
        </select>
        <select className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" value={brandFilter} onChange={(e) => onBrandFilter?.(e.target.value)}>
          <option value="">Thương hiệu</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" value={categoryFilter} onChange={(e) => onCategoryFilter?.(e.target.value)}>
          <option value="">Danh mục</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </div>
  )
}

