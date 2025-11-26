import React from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
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
import OTPVerification from './components/Auth/OTPVerification'
import GoogleCallback from './components/Auth/GoogleCallback'
import ForgotPassword from './pages/ForgotPassword'
import Profile from './pages/Profile'
import Notifications from './pages/Notifications'
import VNPayReturn from './pages/VNPayReturn'

const App = () => {
  const location = useLocation()
  
  // Ẩn navbar, footer và dock menu ở trang đăng nhập/đăng ký
  const isAuthPage = ['/login', '/register', '/signup', '/verify-otp', '/forgot-password', '/auth/callback'].includes(location.pathname)

  return (
    <ThemeProvider>
      <ToastProvider>
          <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-200 min-h-screen flex flex-col">
            {!isAuthPage && (
              <CardNav
                items={[
                  { label: "Sản phẩm", bgColor: "#0D0716", textColor: "#fff", links: [{ label: "Tất cả sản phẩm", href: "/products" }, { label: "Nổi bật", href: "/#featured" }] },
                  { label: "Giỏ hàng", bgColor: "#170D27", textColor: "#fff", links: [{ label: "Xem giỏ hàng", href: "/cart" }, { label: "Thanh toán", href: "/checkout" }] },
                  { label: "Tài khoản", bgColor: "#271E37", textColor: "#fff", links: [{ label: "Đơn hàng", href: "/orders" }, { label: "Hồ sơ", href: "/profile" }, { label: "Đăng nhập", href: "/login" }] }
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
                <Route path="/verify-otp" element={<OTPVerification />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/auth/callback" element={<GoogleCallback />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/payment/vnpay-return" element={<VNPayReturn />} />
              </Routes>
            </main>
            {!isAuthPage && location.pathname !== '/' && <Footer />}
            {!isAuthPage && <DockMenu />}
          </div>
        </ToastProvider>
      </ThemeProvider>
  )
}

export default App