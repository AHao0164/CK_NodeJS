import { useState } from 'react'
import { Link } from 'react-router-dom'
import ProductCard from '../ProductCard'
import { motion, AnimatePresence } from 'framer-motion'
import VI from '../../constants/vi'

export default function ProductCarousel({ products = [], onAdd, onBuyNow, title = 'Sản phẩm', showViewAll = false, viewAllLink = '/products' }) {
  const [currentPage, setCurrentPage] = useState(0)
  const itemsPerPage = 8 // 2 rows x 4 columns
  const totalPages = Math.ceil(products.length / itemsPerPage)
  
  const currentProducts = products.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  )

  const nextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1)
    }
  }

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1)
    }
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <svg className="h-24 w-24 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-slate-700 dark:text-slate-300">{VI.products.noProductsFound}</h3>
        <p className="mt-1 text-sm text-slate-500">Quay lại sau để xem sản phẩm mới</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Header with title and View All */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl font-bitcount">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {products.length} sản phẩm có sẵn
          </p>
        </div>
        {showViewAll && (
          <Link 
            to={viewAllLink}
            className="text-sm font-medium text-primary hover:underline transition-colors"
          >
            Xem tất cả →
          </Link>
        )}
      </div>

      {/* Carousel Container */}
      <div className="relative">
        {/* Previous Arrow */}
        {totalPages > 1 && (
          <button
            onClick={prevPage}
            disabled={currentPage === 0}
            className="absolute left-0 top-1/2 z-10 -translate-x-4 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            aria-label="Sản phẩm trước"
          >
            <svg className="h-5 w-5 text-slate-700 dark:text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Products Grid - 2 rows x 4 columns */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
          >
            {currentProducts.map((product, idx) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <ProductCard product={product} onAdd={onAdd} onBuyNow={onBuyNow} />
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Next Arrow */}
        {totalPages > 1 && (
          <button
            onClick={nextPage}
            disabled={currentPage === totalPages - 1}
            className="absolute right-0 top-1/2 z-10 translate-x-4 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            aria-label="Sản phẩm tiếp theo"
          >
            <svg className="h-5 w-5 text-slate-700 dark:text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* Page Indicators */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentPage(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === currentPage 
                  ? 'w-8 bg-primary' 
                  : 'w-2 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500'
              }`}
              aria-label={`Đến trang ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

