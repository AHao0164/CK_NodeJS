import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useTheme } from '../ui/ThemeProvider'
import Button from './ui/Button'
import VI from '../constants/vi'

export default function Header() {
  const { token, logout } = useAuth()
  const { cartCount, showBadge, dismissBadge } = useCart()
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  function onLogout() { logout(); navigate('/') }
  
  const handleCartClick = () => {
    dismissBadge()
    navigate('/cart')
  }
  
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50 dark:bg-slate-900/70 dark:border-slate-800">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100 font-bitcount">Gear<span className="text-primary">Up</span></Link>
        <nav className="hidden items-center gap-6 text-sm text-slate-700 md:flex dark:text-slate-200">
          <Link className="transition hover:text-primary" to="/">{VI.common.home}</Link>
          <Link className="transition hover:text-primary" to="/products">{VI.common.products}</Link>
          <button onClick={handleCartClick} className="relative transition hover:text-primary">
            {VI.common.cart}
            {cartCount > 0 && (
              <span className={`absolute -top-2 -right-3 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ${showBadge ? 'animate-bounce' : ''}`}>
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </button>
          <Link className="transition hover:text-primary" to="/orders">{VI.common.orders}</Link>
        </nav>
        <div className="flex items-center gap-2">
          {token ? (
            <>
              <Link to="/profile" className="hidden text-sm text-slate-700 underline-offset-4 hover:underline md:inline dark:text-slate-200">{VI.common.profile}</Link>
              <Button variant="outline" onClick={onLogout}>{VI.auth.logout}</Button>
            </>
          ) : (
            <>
              <Link to="/login" className="hidden text-sm text-slate-700 underline-offset-4 hover:underline md:inline dark:text-slate-200">{VI.auth.login}</Link>
              <Link to="/signup"><Button>{VI.auth.signUp}</Button></Link>
            </>
          )}
          <Button variant="ghost" onClick={toggle} aria-label="Toggle theme">{theme === 'light' ? '🌙' : '☀️'}</Button>
        </div>
      </div>
    </header>
  )
}

