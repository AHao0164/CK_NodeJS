import React from 'react'
import { Link } from 'react-router-dom'
import VI from '../constants/vi'

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white/60 py-10 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <div className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100 font-bitcount">Gear<span className="text-primary">Up</span></div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{VI.footer.aboutDescription}</p>
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Công ty</div>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li><a className="hover:text-primary transition-colors" href="#">{VI.footer.aboutUs}</a></li>
            <li><a className="hover:text-primary transition-colors" href="#">Tin tức</a></li>
            <li><a className="hover:text-primary transition-colors" href="#">Tuyển dụng</a></li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{VI.footer.customerService}</div>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li><Link className="hover:text-primary transition-colors" to="/orders">{VI.nav.orders}</Link></li>
            <li><a className="hover:text-primary transition-colors" href="#">{VI.footer.warrantyPolicy}</a></li>
            <li><a className="hover:text-primary transition-colors" href="#">{VI.footer.contactUs}</a></li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{VI.footer.followUs}</div>
          <div className="mt-3 flex items-center gap-3 text-slate-600 dark:text-slate-300">
            <a className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" href="#" aria-label="Facebook">f</a>
            <a className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" href="#" aria-label="Instagram">■</a>
            <a className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" href="#" aria-label="YouTube">▶</a>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-8 max-w-7xl px-4 text-xs text-slate-500">© {new Date().getFullYear()} GearUp. {VI.footer.allRightsReserved}</div>
    </footer>
  )
}

