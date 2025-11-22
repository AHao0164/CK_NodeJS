import React from 'react'

export default function Pagination({ page = 1, totalPages = 1, onChange }) {
  const pages = []
  for (let i = 1; i <= totalPages; i++) pages.push(i)

  const go = (p) => {
    if (p < 1 || p > totalPages || p === page) return
    onChange?.(p)
  }

  return (
    <div className="mt-6 flex items-center justify-center gap-2">
      <button className="btn btn-outline rounded-xl" disabled={page <= 1} onClick={() => go(page - 1)}>Prev</button>
      <div className="flex items-center gap-1">
        {pages.map(p => (
          <button
            key={p}
            onClick={() => go(p)}
            className={`px-3 py-1 rounded-xl text-sm ${p === page ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200'}`}
          >
            {p}
          </button>
        ))}
      </div>
      <button className="btn btn-outline rounded-xl" disabled={page >= totalPages} onClick={() => go(page + 1)}>Next</button>
    </div>
  )
}
