import React from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ThemeProvider from './ui/ThemeProvider'
import { ToastProvider } from './ui/Toast'
import CardNav from './components/Navbar/CardNavbar'
import Footer from './components/Footer'
import DockMenu from './components/ui/DockMenu'
import Home from './pages/Home'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetailPage'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import Login from './components/Auth/Login'
import Register from './components/Auth/Register'
import Profile from './pages/Profile'

const App = () => {
  const location = useLocation()
  
  // Ẩn navbar, footer và dock menu ở trang đăng nhập/đăng ký
  const isAuthPage = ['/login', '/register', '/signup'].includes(location.pathname)

  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-200 min-h-screen flex flex-col">
            {!isAuthPage && (
              <CardNav
                items={[
                  { label: "Products", bgColor: "#0D0716", textColor: "#fff", links: [{ label: "All Products", href: "/products" }, { label: "Featured", href: "/#featured" }] },
                  { label: "Cart", bgColor: "#170D27", textColor: "#fff", links: [{ label: "View Cart", href: "/cart" }, { label: "Checkout", href: "/checkout" }] },
                  { label: "Account", bgColor: "#271E37", textColor: "#fff", links: [{ label: "Orders", href: "/orders" }, { label: "Profile", href: "/profile" }, { label: "Login", href: "/login" }] }
                ]}
                ease="power3.out"
              />
            )}
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/products" element={<Products />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/orders/:id" element={<OrderDetail />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/signup" element={<Register />} />
                <Route path="/profile" element={<Profile />} />
              </Routes>
            </main>
            {!isAuthPage && location.pathname !== '/' && <Footer />}
            {!isAuthPage && <DockMenu />}
          </div>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App