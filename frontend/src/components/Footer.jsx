import React from 'react'
import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white/60 py-10 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <div className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100 font-bitcount">Gear<span className="text-primary">Up</span></div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Premium gaming gear store. Authentic products, best prices, fast delivery.</p>
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Company</div>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li><a className="hover:text-primary transition-colors" href="#">About Us</a></li>
            <li><a className="hover:text-primary transition-colors" href="#">News</a></li>
            <li><a className="hover:text-primary transition-colors" href="#">Careers</a></li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Support</div>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li><Link className="hover:text-primary transition-colors" to="/orders">Track Orders</Link></li>
            <li><a className="hover:text-primary transition-colors" href="#">Warranty & Returns</a></li>
            <li><a className="hover:text-primary transition-colors" href="#">Contact</a></li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Connect</div>
          <div className="mt-3 flex items-center gap-3 text-slate-600 dark:text-slate-300">
            <a className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" href="#" aria-label="Facebook">f</a>
            <a className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" href="#" aria-label="Instagram">■</a>
            <a className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" href="#" aria-label="YouTube">▶</a>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-8 max-w-7xl px-4 text-xs text-slate-500">© {new Date().getFullYear()} GearUp. All rights reserved.</div>
    </footer>
  )
}

