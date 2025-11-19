import React from 'react'

export default function Chip({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200 ${className}`}>
      {children}
    </span>
  )
}


