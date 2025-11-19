import React from 'react'
import Button from './ui/Button'

export default function Banner() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="absolute inset-0 -z-10 opacity-40" aria-hidden>
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-brand-600 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-brand-400 blur-3xl" />
      </div>
      <div className="mx-auto max-w-7xl px-4 py-16 sm:py-20">
        <div className="flex flex-col items-start gap-10 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-slate-200 backdrop-blur">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              Deal sốc cuối tuần
            </span>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              Nâng cấp hiệu năng. Tối giản trải nghiệm.Ok index nhé.
            </h1>
            <p className="mt-3 text-slate-300 sm:text-lg">
              Laptop cho game thủ, nhà sáng tạo và doanh nghiệp. Giao nhanh, trả góp 0%, bảo hành chính hãng.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a href="#featured"><Button className="px-5 py-2.5">Khám phá ngay</Button></a>
              <a href="#deals"><Button variant="outline" className="px-5 py-2.5 text-white border-white/30 hover:bg-white/10">Khuyến mãi</Button></a>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-md md:max-w-lg">
            <img
              src="https://images.unsplash.com/photo-1491472253230-a044054ca35f?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8bGFwdG9wJTIwY29tcHV0ZXJ8ZW58MHx8MHx8fDA%3D&fm=jpg&q=60&w=3000"
              alt="Premium gaming laptop hero"
              className="h-auto w-full rounded-xl border border-white/10 shadow-2xl shadow-slate-900/40"
            />
          </div>
        </div>
      </div>
    </section>
  )
}









