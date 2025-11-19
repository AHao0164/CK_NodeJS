import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../ui/ThemeProvider'
import Button from './ui/Button'

export default function Header() {
  const { token, logout } = useAuth()
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  function onLogout() { logout(); navigate('/') }
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50 dark:bg-slate-900/70 dark:border-slate-800">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Laptop<span className="text-brand-600">Pro</span></Link>
        <nav className="hidden items-center gap-6 text-sm text-slate-700 md:flex dark:text-slate-200">
          <Link className="transition hover:text-brand-600" to="/">Trang chủ</Link>
          <Link className="transition hover:text-brand-600" to="/products">Sản phẩm</Link>
          <Link className="transition hover:text-brand-600" to="/cart">Giỏ hàng</Link>
          <Link className="transition hover:text-brand-600" to="/orders">Đơn hàng</Link>
        </nav>
        <div className="flex items-center gap-2">
          {token ? (
            <>
              <Link to="/profile" className="hidden text-sm text-slate-700 underline-offset-4 hover:underline md:inline dark:text-slate-200">Tài khoản</Link>
              <Button variant="outline" onClick={onLogout}>Đăng xuất</Button>
            </>
          ) : (
            <>
              <Link to="/login" className="hidden text-sm text-slate-700 underline-offset-4 hover:underline md:inline dark:text-slate-200">Đăng nhập</Link>
              <Link to="/signup"><Button>Đăng ký</Button></Link>
            </>
          )}
          <Button variant="ghost" onClick={toggle} aria-label="Toggle theme">{theme === 'light' ? '🌙' : '☀️'}</Button>
        </div>
      </div>
    </header>
  )
}


