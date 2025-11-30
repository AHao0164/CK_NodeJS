import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Button from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { fetchCart } from '../services/cart'
import { checkoutOrder, payForOrder, validateCoupon } from '../services/orders'
import { publicApi } from '../api/client'
import { motion } from 'framer-motion'
import { useToast } from '../ui/Toast'
import VI from '../constants/vi'
import { calculateShippingFee, getShippingInfo } from '../constants/shipping'
import { getProvinces, getWards } from '../constants/vietnamLocations'
import { getCurrentUser } from '../services/auth'

export default function Checkout() {
  const { api, user, token } = useAuth()
  const location = useLocation()
  const [cart, setCart] = useState({ items: [] })
  const [catalog, setCatalog] = useState([])
  const navigate = useNavigate()
  const toast = useToast()
  const [shipping, setShipping] = useState({ name: '', phone: '', email: '', address: '', city: '', ward: '' })
  
  // Get selected items from navigation state (from Cart page)
  const selectedItemIds = location.state?.selectedItemIds || []
  const [paymentMethod, setPaymentMethod] = useState('') // 'COD' or 'VNPAY'
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [showCODOtpForm, setShowCODOtpForm] = useState(false)
  const [codOtp, setCodOtp] = useState('')
  const [otpCountdown, setOtpCountdown] = useState(180)
  const [showBill, setShowBill] = useState(false)
  const [billData, setBillData] = useState(null)
  const [couponCode, setCouponCode] = useState('')
  const [coupon, setCoupon] = useState(null)
  const [error, setError] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loyaltyPoints, setLoyaltyPoints] = useState(0)
  const [pointsToUse, setPointsToUse] = useState(0)
  
  useEffect(() => {
    document.title = 'Thanh toán - GearUp';
  }, []);

  // Load cart / guest items and (nếu có) thông tin user
  useEffect(() => { 
    let ignore = false

    const loadForAuthenticatedUser = async () => {
      try {
        const [cartData, productsData, userData, pointsData] = await Promise.all([
          fetchCart(api),
          fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:8080'}/catalog/products`).then(r => r.json()),
          getCurrentUser(api),
          api.get('/auth/loyalty-points').then(r => r.data).catch(() => ({ points: 0 }))
        ])
        if (ignore) return
        setCart(cartData)
        setCatalog(Array.isArray(productsData?.items) ? productsData.items : [])
        setLoyaltyPoints(pointsData?.points || 0)
        
        // Pre-fill shipping info from fresh user data
        if (userData) {
          console.log('User data in Checkout:', userData)
          setShipping({
            name: userData.fullname || userData.full_name || '',
            phone: userData.phone || '',
            email: userData.email || '',
            address: userData.address || userData.address_detail || '',
            city: userData.city || userData.province || '',
            ward: userData.ward || ''
          })
        }
      } catch (e) {
        console.error('Checkout load (auth) error:', e)
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    const loadForGuest = async () => {
      try {
        // Priority 1: Load from location.state?.selectedItems (from Cart page - already selected)
        // Priority 2: Load from location.state?.guestItems (from Buy Now)
        // Priority 3: Load from sessionStorage (fallback)
        let mapped = []
        
        if (Array.isArray(location.state?.selectedItems) && location.state.selectedItems.length > 0) {
          // From Cart page - use selectedItems directly (already filtered and mapped)
          mapped = location.state.selectedItems.map(it => ({
            id: it.id,
            product_id: it.product_id,
            quantity: it.quantity,
            price_cents: it.price_cents
          }))
        } else if (Array.isArray(location.state?.guestItems) && location.state.guestItems.length > 0) {
          // From Buy Now - use guestItems directly
          mapped = location.state.guestItems.map((it, idx) => ({
            id: it.id || idx + 1,
            product_id: it.productId || it.product_id,
            quantity: it.quantity || 1,
            price_cents: it.priceCents || it.price_cents
          }))
        } else {
          // Fallback: Load from sessionStorage
          const storedGuestCartItems = JSON.parse(sessionStorage.getItem('guestCartItems') || '[]')
          mapped = storedGuestCartItems.map((item, idx) => ({
            id: item.id || idx + 1,
            product_id: item.product_id || item.productId,
            quantity: item.quantity || 1,
            price_cents: item.price_cents || item.priceCents
          }))
        }
        
        if (!ignore) {
          setCart({ items: mapped })
        }
        
        // Load catalog công khai để hiển thị thông tin sản phẩm
        const productsData = await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:8080'}/catalog/products`).then(r => r.json())
        if (!ignore) {
          setCatalog(Array.isArray(productsData?.items) ? productsData.items : [])
        }
      } catch (e) {
        console.error('Checkout load (guest) error:', e)
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    setLoading(true)
    if (token) {
      loadForAuthenticatedUser()
    } else {
      loadForGuest()
    }

    return () => { ignore = true }
  }, [api, token, location.state])
  
  function detailsOf(id) { return catalog.find(x => x.id === id) }
  
  // Filter cart items to only include selected ones
  // Priority 1: Use location.state?.selectedItems (already filtered from Cart page)
  // Priority 2: Filter by selectedItemIds if provided
  // Priority 3: Fallback to all items (backward compatibility)
  const selectedCartItems = (() => {
    // If selectedItems are passed from Cart page, use them directly
    if (Array.isArray(location.state?.selectedItems) && location.state.selectedItems.length > 0) {
      return location.state.selectedItems; // Use the filtered items directly
    }
    // Otherwise, filter cart.items by selectedItemIds
    if (selectedItemIds.length > 0) {
      return cart.items.filter(it => selectedItemIds.includes(it.id));
    }
    // Fallback: use all items (backward compatibility)
    return cart.items;
  })();
  
  const subtotal = selectedCartItems.reduce((s, it) => {
    const p = detailsOf(it.product_id)
    // Use price from catalog if available, otherwise fallback to price stored in cart
    const originalPrice = p?.price_cents || it.price_cents || 0
    const discountPercent = p?.discount_percent || 0
    const finalPrice = Math.round(originalPrice * (100 - discountPercent) / 100)
    return s + finalPrice * it.quantity
  }, 0)

  // Calculate tax (VAT 10%)
  const tax = Math.round(subtotal * 0.1)

  const shippingFee = calculateShippingFee(subtotal, shipping.city)
  const shippingInfo = getShippingInfo(subtotal, shipping.city)
  
  const discount = (() => {
    if (!coupon) return 0
    
    // Backend stores coupon.value:
    // - For percentage: value is the percentage number (e.g., 10 = 10%)
    // - For fixed: value can be in two formats:
    //   1. Old format (seed data): value = actual VND amount (e.g., 10000 = 10,000 VND)
    //   2. New format (admin app): value = VND * 100 (e.g., admin enters 10,000 → DB stores 1,000,000)
    // Frontend subtotal is in the same unit as price_cents (which is actually VND, not real cents)
    let calculatedDiscount = 0
    
    if (coupon.type === 'percentage') {
      // coupon.value is percentage (10 = 10%), calculate discount
      calculatedDiscount = Math.floor(subtotal * (coupon.value / 100))
    } else if (coupon.type === 'fixed') {
      // FIX: Admin app multiplies value by 100 when saving fixed coupons
      // Check if value is likely multiplied by 100 (large number and divisible by 100)
      // Example: Admin enters 10,000 VND → saved as 1,000,000 → divide by 100 = 10,000
      let fixedDiscountAmount = coupon.value
      if (coupon.value >= 100000 && coupon.value % 100 === 0) {
        // Likely multiplied by 100 by admin app, divide by 100 to get actual VND
        fixedDiscountAmount = coupon.value / 100
      }
      calculatedDiscount = Math.min(subtotal, fixedDiscountAmount)
    }
    
    console.log('Discount calculation:', { 
      couponType: coupon.type, 
      couponValue: coupon.value, 
      subtotal, 
      calculatedDiscount 
    }) // Debug log
    
    return calculatedDiscount
  })()
  
  // Calculate points discount: 1 point = 1,000 VND
  const pointsDiscount = pointsToUse * 1000
  
  // Calculate total after all discounts
  const total = subtotal + tax + shippingFee - discount - pointsDiscount

  const handleClearInfo = (target) => {
    setDeleteTarget(target)
    setShowDeleteModal(true)
  }

  const confirmClear = () => {
    if (deleteTarget === 'shipping') {
      setShipping({ name: '', phone: '', email: '', address: '', city: 'Hà Nội', ward: '' })
      toast.show('Đã xóa thông tin giao hàng', { type: 'success' })
    }
    setShowDeleteModal(false)
    setDeleteTarget(null)
  }

  const validateShipping = () => {
    if (!shipping.name.trim()) return 'Vui lòng nhập họ tên'
    if (!shipping.phone.trim() || !/^\d{10,11}$/.test(shipping.phone.replace(/\s/g, ''))) return 'Số điện thoại không hợp lệ'
    if (!shipping.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shipping.email)) return 'Email không hợp lệ'
    if (!shipping.address.trim()) return 'Vui lòng nhập địa chỉ'
    if (!shipping.city) return 'Vui lòng chọn tỉnh/thành phố'
    if (!shipping.ward.trim()) return 'Vui lòng nhập phường/xã'
    return null
  }

  const handleConfirmPayment = () => {
    const validationError = validateShipping()
    if (validationError) {
      toast.show(`❌ ${validationError}`, { type: 'error' })
      return
    }
    if (!paymentMethod) {
      toast.show('❌ Vui lòng chọn phương thức thanh toán', { type: 'error' })
      return
    }
    if (!agreeTerms) {
      toast.show('❌ Vui lòng đồng ý với điều khoản thanh toán', { type: 'error' })
      return
    }

    // Khách chưa đăng nhập có thể dùng cả VNPay và COD
    // COD sẽ gửi OTP qua email từ form shipping

    if (paymentMethod === 'COD') {
      handleCODPayment()
    } else if (paymentMethod === 'VNPAY') {
      handleVNPayPayment()
    }
  }

  const handleVNPayPayment = async () => {
    setLoading(true)
    try {
      // Create order first
      const orderPayload = {
        items: selectedCartItems.map(it => {
          const p = detailsOf(it.product_id)
          const originalPrice = p?.price_cents || 0
          const discountPercent = p?.discount_percent || 0
          const finalPrice = Math.round(originalPrice * (100 - discountPercent) / 100)
          return {
            productId: it.product_id,
            quantity: it.quantity,
            priceCents: finalPrice
          }
        }),
        shipping: {
          name: shipping.name,
          phone: shipping.phone,
          email: shipping.email,
          province: shipping.city,
          district: shipping.city,
          ward: shipping.ward,
          address: shipping.address
        },
        paymentMethod: 'VNPAY',
        couponCode: coupon?.code || null,
        pointsToUse: pointsToUse > 0 ? pointsToUse : null
      }

      const { data: orderData } = await api.post('/orders/checkout', orderPayload)
      
      // Create VNPay payment URL
      const { data: vnpayResponse } = await api.post('/payment/vnpay/create', {
        orderId: orderData.orderId,
        amountCents: total,
        orderInfo: `Thanh_toan_don_hang_${orderData.orderId}`,
        bankCode: 'NCB' // Default bank code (can be changed at VNPay)
      })

      if (vnpayResponse.success && vnpayResponse.paymentUrl) {
        // Save order info before redirect
        sessionStorage.setItem('pendingVNPayOrder', JSON.stringify({
          orderId: orderData.orderId,
          total: total
        }))
        
        // Redirect to VNPay payment page
        window.location.href = vnpayResponse.paymentUrl
      } else {
        toast.show('❌ Không thể tạo thanh toán VNPay', { type: 'error' })
      }
    } catch (error) {
      console.error('VNPay error:', error)
      toast.show('❌ Lỗi kết nối đến VNPay', { type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleCODPayment = async () => {
    setLoading(true)
    try {
      // Prepare order items for email
      const orderItems = selectedCartItems.map(it => {
        const p = detailsOf(it.product_id)
        return {
          name: p?.name || 'Sản phẩm',
          quantity: it.quantity,
          price: p?.price_cents || 0
        }
      })

      // Create order first (for both authenticated and guest users)
      const orderPayload = {
        items: selectedCartItems.map(it => {
          const p = detailsOf(it.product_id)
          const originalPrice = p?.price_cents || 0
          const discountPercent = p?.discount_percent || 0
          const finalPrice = Math.round(originalPrice * (100 - discountPercent) / 100)
          return {
            productId: it.product_id,
            quantity: it.quantity,
            priceCents: finalPrice
          }
        }),
        shipping: {
          name: shipping.name,
          phone: shipping.phone,
          email: shipping.email,
          province: shipping.city,
          district: shipping.city,
          ward: shipping.ward,
          address: shipping.address
        },
        paymentMethod: 'COD',
        couponCode: coupon?.code || null,
        pointsToUse: pointsToUse > 0 ? pointsToUse : null
      }

      // Use publicApi for guest users, api for authenticated users
      const apiClient = token ? api : publicApi
      const { data: orderData } = await apiClient.post('/orders/checkout', orderPayload)
      
      // Store orderId for OTP verification
      sessionStorage.setItem('pendingCODOrder', JSON.stringify({
        orderId: orderData.orderId,
        email: shipping.email
      }))

      // Send OTP email (works for both authenticated and guest users)
      console.log('📧 Sending COD OTP:', {
        email: shipping.email,
        usingClient: token ? 'api (authenticated)' : 'publicApi (guest)',
        hasToken: !!token
      })
      
      await apiClient.post('/auth/send-cod-otp', {
        email: shipping.email,
        orderTotal: total,
        items: orderItems,
        orderId: orderData.orderId // Include orderId for guest users
      })

      toast.show(`✅ Đã gửi mã OTP xác nhận đơn hàng đến email ${shipping.email}`, { type: 'success' })
      setShowCODOtpForm(true)
      setOtpCountdown(180)
      
      // Start countdown
      const timer = setInterval(() => {
        setOtpCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (e) {
      console.error('COD payment error:', e)
      console.error('Error response:', e?.response?.data)
      console.error('Error status:', e?.response?.status)
      
      // Get detailed error message
      let errorMsg = 'Có lỗi khi tạo đơn hàng hoặc gửi OTP'
      if (e?.response?.data) {
        if (e.response.data.message) {
          errorMsg = e.response.data.message
        } else if (e.response.data.error) {
          errorMsg = e.response.data.error
        } else if (e.response.data.details && Array.isArray(e.response.data.details)) {
          errorMsg = e.response.data.details.join(', ')
        }
      }
      
      toast.show(`❌ ${errorMsg}`, { type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleCODOtpSubmit = async () => {
    if (!codOtp || codOtp.length !== 6) {
      toast.show('❌ Vui lòng nhập đủ 6 số OTP', { type: 'error' })
      return
    }

    if (!shipping.email) {
      toast.show('❌ Thiếu thông tin email', { type: 'error' })
      return
    }

    try {
      // Get orderId from sessionStorage (for guest) or from state
      const pendingOrder = JSON.parse(sessionStorage.getItem('pendingCODOrder') || '{}')
      const orderId = pendingOrder.orderId

      if (!orderId) {
        toast.show('❌ Không tìm thấy thông tin đơn hàng. Vui lòng thử lại.', { type: 'error' })
        return
      }

      console.log('Verifying COD OTP:', { email: shipping.email, otp: codOtp, orderId });
      
      // Use publicApi for guest users, api for authenticated users
      const apiClient = token ? api : publicApi

      // Verify OTP with backend (works for both authenticated and guest users)
      // Backend will confirm order and deduct stock automatically
      const response = await apiClient.post('/auth/verify-cod-otp', {
        email: shipping.email,
        otp: codOtp,
        orderId: orderId // Include orderId for guest users
      })

      console.log('OTP verified successfully', response.data);
      
      // Clear pending order from sessionStorage
      sessionStorage.removeItem('pendingCODOrder')
      
      // Clear cart after successful order (only for authenticated users)
      if (token) {
        for (const item of cart.items) {
          await api.delete(`/cart/items/${item.id}`).catch(() => {});
        }
      } else {
        // For guest users, clear guest cart
        sessionStorage.removeItem('guestCartItems')
        sessionStorage.removeItem('guestCartId')
      }
      
      setShowCODOtpForm(false)
      toast.show(`✓ Đặt hàng thành công! Mã đơn hàng #${orderId}`, { type: 'success' })
      
      // For guest users, navigate to home or show success message
      // For authenticated users, navigate to orders page
      if (token) {
        setTimeout(() => navigate('/orders'), 1500)
      } else {
        setTimeout(() => navigate('/'), 2000)
      }
    } catch (e) {
      console.error('COD OTP verification failed:', e.response?.data || e.message)
      const msg = e?.response?.data?.error || e?.response?.data?.message || 'Mã OTP không đúng hoặc đã hết hạn'
      toast.show(`❌ ${msg}`, { type: 'error' })
    }
  }

  const getVNPayErrorMessage = (code) => {
    const errors = {
      '00': 'Giao dịch thành công',
      '07': 'Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường)',
      '09': 'Giao dịch không thành công do: Thẻ/Tài khoản chưa đăng ký dịch vụ InternetBanking',
      '10': 'Giao dịch không thành công do: Xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
      '11': 'Giao dịch không thành công do: Đã hết hạn chờ thanh toán',
      '12': 'Giao dịch không thành công do: Thẻ/Tài khoản bị khóa',
      '13': 'Giao dịch không thành công do: Nhập sai mật khẩu xác thực giao dịch (OTP)',
      '24': 'Giao dịch không thành công do: Khách hàng hủy giao dịch',
      '51': 'Giao dịch không thành công do: Tài khoản không đủ số dư',
      '65': 'Giao dịch không thành công do: Tài khoản đã vượt quá hạn mức giao dịch trong ngày',
      '75': 'Ngân hàng thanh toán đang bảo trì',
      '79': 'Giao dịch không thành công do: Nhập sai mật khẩu thanh toán quá số lần quy định',
      '99': 'Lỗi không xác định'
    }
    return errors[code] || 'Lỗi không xác định'
  }

  const handlePrintBill = () => {
    const printContent = document.getElementById('vnpay-bill-print')
    const printWindow = window.open('', '', 'width=800,height=600')
    printWindow.document.write(`
      <html>
        <head>
          <title>Hóa đơn VNPay #${billData?.vnp_TxnRef || ''}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 20px; background: white; }
            @media print {
              body { padding: 0; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 250)
  }

  const handleCompleteBill = () => {
    setShowBill(false)
    toast.show('✓ Thanh toán thành công!', { type: 'success' })
    navigate('/orders')
  }

  async function applyCoupon() {
    if (!couponCode) return
    
    // Validate format: 5-character alphanumeric
    if (!/^[A-Z0-9]{5}$/.test(couponCode)) {
      setCoupon(null)
      setError('Mã giảm giá phải có đúng 5 ký tự chữ và số')
      return
    }
    
    try {
      // Use publicApi for guest users, api for authenticated users
      const apiClient = token ? api : publicApi
      const data = await validateCoupon(apiClient, couponCode)
      console.log('Coupon data received:', data) // Debug log
      setCoupon(data)
      setError('') // Clear previous error message
      toast.show('✓ Áp dụng mã giảm giá thành công', { type: 'success' })
    } catch (e) {
      setCoupon(null)
      const errorMsg = e?.response?.data?.message || e?.response?.data?.error || 'Mã giảm giá không hợp lệ hoặc đã hết hạn'
      setError(errorMsg)
    }
  }
  
  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <motion.h2 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 font-bitcount"
      >
        {VI.checkout.title}
      </motion.h2>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Shipping Address */}
          <Card>
            <CardBody>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold">{VI.checkout.shippingAddress}</h3>
                <button
                  onClick={() => handleClearInfo('shipping')}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 hover:text-red-700 hover:border-red-400 transition-all duration-200 active:scale-95 flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Xóa thông tin
                </button>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <input className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm dark:bg-slate-800 dark:border-slate-700" placeholder="Họ và tên *" value={shipping.name} onChange={e=>setShipping({ ...shipping, name: e.target.value })} />
                <input className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm dark:bg-slate-800 dark:border-slate-700" placeholder="Số điện thoại *" value={shipping.phone} onChange={e=>setShipping({ ...shipping, phone: e.target.value })} />
                <input className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm md:col-span-2 dark:bg-slate-800 dark:border-slate-700" placeholder="Email *" type="email" value={shipping.email} onChange={e=>setShipping({ ...shipping, email: e.target.value })} />
                <input className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm md:col-span-2 dark:bg-slate-800 dark:border-slate-700" placeholder="Địa chỉ *" value={shipping.address} onChange={e=>setShipping({ ...shipping, address: e.target.value })} />
                <select className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm dark:bg-slate-800 dark:border-slate-700 bg-white dark:bg-slate-800" value={shipping.city} onChange={e=>setShipping({ ...shipping, city: e.target.value })}>
                  <option value="">Chọn tỉnh/thành phố *</option>
                  {getProvinces().map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
                {shipping.city && getWards(shipping.city).length > 0 ? (
                  <select className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm dark:bg-slate-800 dark:border-slate-700 bg-white dark:bg-slate-800" value={shipping.ward} onChange={e=>setShipping({ ...shipping, ward: e.target.value })}>
                    <option value="">Chọn phường/xã *</option>
                    {getWards(shipping.city).map(ward => (
                      <option key={ward} value={ward}>{ward}</option>
                    ))}
                  </select>
                ) : (
                  <input className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm dark:bg-slate-800 dark:border-slate-700" placeholder="Phường/Xã *" value={shipping.ward} onChange={e=>setShipping({ ...shipping, ward: e.target.value })} />
                )}
              </div>
            </CardBody>
          </Card>

          {/* Payment Method */}
          <Card>
            <CardBody>
              <h3 className="text-base font-semibold mb-4">Phương thức thanh toán</h3>
              <div className="space-y-3">
                <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${paymentMethod === 'COD' ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-700 hover:border-primary/50'}`}>
                  <input type="radio" name="payment" value="COD" checked={paymentMethod === 'COD'} onChange={e=>setPaymentMethod(e.target.value)} className="w-4 h-4 text-primary" />
                  <div className="ml-3 flex-1">
                    <div className="font-medium">Thanh toán khi nhận hàng (COD)</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">Thanh toán bằng tiền mặt khi nhận hàng</div>
                  </div>
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </label>

                <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${paymentMethod === 'VNPAY' ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-700 hover:border-primary/50'}`}>
                  <input type="radio" name="payment" value="VNPAY" checked={paymentMethod === 'VNPAY'} onChange={e=>setPaymentMethod(e.target.value)} className="w-4 h-4 text-primary" />
                  <div className="ml-3 flex-1">
                    <div className="font-medium">Thanh toán qua VNPay</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">Thanh toán bằng thẻ ATM/Internet Banking</div>
                  </div>
                  <svg className="w-8 h-8 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
                  </svg>
                </label>
              </div>

              {/* Terms & Conditions */}
              <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <label className="flex items-start cursor-pointer">
                  <input type="checkbox" checked={agreeTerms} onChange={e=>setAgreeTerms(e.target.checked)} className="mt-1 w-4 h-4 text-primary rounded" />
                  <span className="ml-3 text-sm text-slate-600 dark:text-slate-400">
                    Tôi đã đọc và đồng ý với <a href="#" className="text-primary hover:underline">Điều khoản và Điều kiện</a> cũng như <a href="#" className="text-primary hover:underline">Chính sách Bảo mật</a> của GearUp
                  </span>
                </label>
              </div>

              <button 
                onClick={handleConfirmPayment}
                disabled={cart.items.length === 0}
                className="mt-4 w-full btn btn-primary rounded-lg py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Xác nhận phương thức thanh toán
              </button>
            </CardBody>
          </Card>
        </div>

        {/* Order Summary */}
        <div>
          <Card>
            <CardBody>
              <h3 className="text-lg font-semibold mb-4">Tóm tắt đơn hàng</h3>
              
              {/* Order Items Details */}
              <div className="mb-4 space-y-2 text-sm border-b pb-4">
                <div className="font-medium mb-2">Chi tiết sản phẩm:</div>
                {selectedCartItems.map((it, idx) => {
                  const p = detailsOf(it.product_id)
                  // Use price from catalog if available, otherwise fallback to price stored in cart
                  const originalPrice = p?.price_cents || it.price_cents || 0
                  const discountPercent = p?.discount_percent || 0
                  const finalPrice = Math.round(originalPrice * (100 - discountPercent) / 100)
                  const stock = p?.stock || 0
                  
                  return (
                    <div key={idx} className="flex justify-between items-start gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs truncate">{p?.name || `Sản phẩm #${it.product_id}`}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          SL: {it.quantity} | Tồn kho: {stock} | Giá: {finalPrice.toLocaleString('vi-VN')}₫
                        </div>
                      </div>
                      <div className="text-right text-xs font-semibold">
                        {(finalPrice * it.quantity).toLocaleString('vi-VN')}₫
                      </div>
                    </div>
                  )
                })}
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Tạm tính</span><span>{subtotal.toLocaleString('vi-VN')} ₫</span></div>
                <div className="flex justify-between">
                  <span>Thuế VAT (10%)</span>
                  <span>{tax.toLocaleString('vi-VN')} ₫</span>
                </div>
                <div className="flex justify-between">
                  <span>Phí vận chuyển</span>
                  <span className={shippingFee === 0 ? 'text-emerald-600 font-medium' : ''}>
                    {shippingFee === 0 ? 'Miễn phí' : `${shippingFee.toLocaleString('vi-VN')} ₫`}
                  </span>
                </div>
                {shippingInfo.canGetFreeShip && (
                  <div className="text-xs text-amber-600 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span>{shippingInfo.message}</span>
                  </div>
                )}
                {discount > 0 && coupon && (
                  <div className="flex justify-between text-emerald-700">
                    <span>
                      Giảm giá ({coupon.code})
                      {coupon.type === 'percentage' && ` - ${coupon.value}%`}
                      {coupon.type === 'fixed' && ` - ${(coupon.value >= 100000 && coupon.value % 100 === 0 ? coupon.value / 100 : coupon.value).toLocaleString('vi-VN')}₫`}
                    </span>
                    <span className="font-semibold">-{discount.toLocaleString('vi-VN')} ₫</span>
                  </div>
                )}
                {pointsDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Điểm thưởng ({pointsToUse} điểm = {pointsDiscount.toLocaleString('vi-VN')}₫)</span>
                    <span className="font-semibold">-{pointsDiscount.toLocaleString('vi-VN')} ₫</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-base pt-2 border-t"><span>Tổng cộng</span><span className="text-primary">{total.toLocaleString('vi-VN')} ₫</span></div>
              </div>
              {token && loyaltyPoints > 0 && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941a3.37 3.37 0 01-.448-.08 4.507 4.507 0 01-3.187-3.188C5.716 10.163 5 9.262 5 8c0-1.262.716-2.163 1.228-2.661a4.507 4.507 0 013.187-3.188A3.37 3.37 0 019 2V1a1 1 0 012 0v.092a4.535 4.535 0 001.676.662C13.398 2.766 14 3.991 14 5c0 .99-.602 1.765-1.324 2.246A4.535 4.535 0 0111 7.908v1.941a3.37 3.37 0 01.448.08 4.507 4.507 0 013.187 3.188C15.284 13.837 16 14.738 16 16c0 1.262-.716 2.163-1.228 2.661a4.507 4.507 0 01-3.187 3.188 3.37 3.37 0 01-.448.08V19a1 1 0 10-2 0v-.092a4.535 4.535 0 00-1.676-.662C6.602 17.234 6 16.009 6 15c0-.99.602-1.765 1.324-2.246A4.535 4.535 0 019 12.092v-1.941a3.37 3.37 0 01-.448-.08 4.507 4.507 0 01-3.187-3.188C4.716 6.163 4 5.262 4 4c0-1.262.716-2.163 1.228-2.661a4.507 4.507 0 013.187-3.188A3.37 3.37 0 019 1V0a1 1 0 012 0v.092a4.535 4.535 0 001.676.662C14.398 2.766 15 3.991 15 5c0 .99-.602 1.765-1.324 2.246A4.535 4.535 0 0113 7.908v1.941a3.37 3.37 0 01.448.08 4.507 4.507 0 013.187 3.188C17.284 13.837 18 14.738 18 16c0 1.262-.716 2.163-1.228 2.661a4.507 4.507 0 01-3.187 3.188 3.37 3.37 0 01-.448.08V19a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C19.398 17.234 20 16.009 20 15c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0117 12.092v-1.941a3.37 3.37 0 01.448-.08 4.507 4.507 0 013.187-3.188C21.284 6.163 22 5.262 22 4c0-1.262-.716-2.163-1.228-2.661z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Điểm thưởng: {loyaltyPoints.toLocaleString('vi-VN')} điểm
                      </span>
                    </div>
                    <span className="text-xs text-blue-600 dark:text-blue-400">1 điểm = 1,000₫</span>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="number"
                      min="0"
                      max={Math.min(loyaltyPoints, Math.floor(total / 1000))}
                      className="h-9 flex-1 rounded-lg border border-blue-300 dark:border-blue-700 px-3 text-sm dark:bg-slate-800" 
                      placeholder="Số điểm muốn dùng" 
                      value={pointsToUse || ''} 
                      onChange={e => {
                        const value = parseInt(e.target.value) || 0;
                        // Max points = min of (available points, order total before points discount / 1000)
                        const orderTotalBeforePoints = subtotal + tax + shippingFee - discount;
                        const maxPoints = Math.min(loyaltyPoints, Math.floor(orderTotalBeforePoints / 1000));
                        setPointsToUse(Math.max(0, Math.min(value, maxPoints)));
                      }}
                    />
                    <Button 
                      onClick={() => {
                        const orderTotalBeforePoints = subtotal + tax + shippingFee - discount;
                        const maxPoints = Math.min(loyaltyPoints, Math.floor(orderTotalBeforePoints / 1000));
                        setPointsToUse(maxPoints);
                      }}
                      variant="outline"
                      className="text-xs"
                    >
                      Dùng tối đa
                    </Button>
                    {pointsToUse > 0 && (
                      <Button 
                        onClick={() => setPointsToUse(0)}
                        variant="outline"
                        className="text-xs"
                      >
                        Hủy
                      </Button>
                    )}
                  </div>
                  {pointsToUse > 0 && (
                    <div className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
                      Giảm: {pointsDiscount.toLocaleString('vi-VN')}₫
                    </div>
                  )}
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <input 
                  className="h-11 flex-1 rounded-lg border border-slate-300 px-3 text-sm dark:bg-slate-800 dark:border-slate-700" 
                  placeholder="Mã giảm giá (5 ký tự)" 
                  value={couponCode} 
                  onChange={e=>{
                    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
                    setCouponCode(value);
                  }} 
                  maxLength={5}
                />
                <Button onClick={applyCoupon} variant="outline">Áp dụng</Button>
              </div>
              {error && <div className="mt-2 text-center text-xs text-red-600">{error}</div>}
              {cart.items.length===0 && (
                <div className="mt-2 text-center text-xs text-amber-600">Giỏ hàng trống</div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowDeleteModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Xác nhận xóa</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">Bạn có chắc chắn muốn xóa thông tin giao hàng không?</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 active:scale-95">Hủy</button>
                <button onClick={confirmClear} className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-all duration-200 active:scale-95 shadow-lg shadow-red-500/30">Xóa</button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* VNPay Bill/Receipt */}
      {showBill && billData && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
          onClick={() => setShowBill(false)}
        >
          <motion.div
            id="vnpay-bill-print"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-800 rounded-none sm:rounded-2xl shadow-2xl max-w-2xl w-full min-h-screen sm:min-h-0 sm:my-8 sm:max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Bill Header with VNPay Logo */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 sm:p-6 rounded-none sm:rounded-t-2xl print:bg-blue-600 sticky top-0 z-10">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
                    <div className="text-blue-600 font-black text-lg sm:text-xl tracking-tight">VNPAY</div>
                  </div>
                  <div className="text-white">
                    <h3 className="text-base sm:text-xl font-bold leading-tight">HÓA ĐƠN THANH TOÁN</h3>
                    <p className="text-blue-100 text-xs mt-0.5">Cổng thanh toán điện tử</p>
                  </div>
                </div>
                <div className="text-right text-white flex-shrink-0">
                  <div className={`inline-flex items-center justify-center px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm ${billData.vnp_ResponseCode === '00' ? 'bg-green-500' : 'bg-red-500'}`}>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      {billData.vnp_ResponseCode === '00' ? (
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      ) : (
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      )}
                    </svg>
                    <span className="hidden sm:inline">Mã: </span>{billData.vnp_ResponseCode}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {/* Transaction Status */}
              <div className={`mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg ${billData.vnp_ResponseCode === '00' ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-700' : 'bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700'}`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                  <div className="flex-1">
                    <h4 className={`font-bold text-base sm:text-lg ${billData.vnp_ResponseCode === '00' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                      {getVNPayErrorMessage(billData.vnp_ResponseCode)}
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">Mã GD: <span className="font-mono font-semibold">{billData.vnp_TransactionNo}</span></p>
                  </div>
                  <div className="text-left sm:text-right w-full sm:w-auto">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Thời gian</p>
                    <p className="font-semibold text-sm">{billData.createdAt}</p>
                  </div>
                </div>
              </div>

              {/* Transaction Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="space-y-2 sm:space-y-3">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Mã đơn hàng</p>
                    <p className="font-mono text-sm font-semibold">{billData.vnp_TxnRef}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Ngân hàng</p>
                    <p className="font-semibold text-sm">{billData.vnp_BankCode} - Ngân hàng Quốc Dân</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Loại thẻ</p>
                    <p className="font-semibold text-sm">{billData.vnp_CardType}</p>
                  </div>
                </div>
                <div className="space-y-2 sm:space-y-3">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Người nhận</p>
                    <p className="font-semibold text-sm">{billData.shipping.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Số điện thoại</p>
                    <p className="font-semibold text-sm">{billData.shipping.phone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Email</p>
                    <p className="font-semibold text-xs sm:text-sm break-all">{billData.shipping.email}</p>
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Địa chỉ giao hàng</p>
                <p className="font-medium text-sm">{billData.shipping.address}, {billData.shipping.ward}, {billData.shipping.city}</p>
              </div>

              {/* Order Items */}
              <div className="mb-4 sm:mb-6">
                <h4 className="font-semibold mb-3 text-sm sm:text-base text-slate-700 dark:text-slate-200">Chi tiết đơn hàng</h4>
                <div className="border dark:border-slate-600 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-slate-100 dark:bg-slate-700">
                        <tr>
                          <th className="text-left p-2 sm:p-3">Sản phẩm</th>
                          <th className="text-center p-2 sm:p-3 w-16 sm:w-20">SL</th>
                          <th className="text-right p-2 sm:p-3 hidden sm:table-cell">Đơn giá</th>
                          <th className="text-right p-2 sm:p-3">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billData.items.map((item, idx) => {
                          const finalPrice = Math.round(item.price * (100 - item.discount) / 100)
                          return (
                            <tr key={idx} className="border-t dark:border-slate-600">
                              <td className="p-2 sm:p-3">
                                <div className="font-medium">{item.name}</div>
                                <div className="sm:hidden text-xs text-slate-500 mt-1">
                                  {finalPrice.toLocaleString('vi-VN')}₫ x {item.quantity}
                                </div>
                              </td>
                              <td className="text-center p-2 sm:p-3">{item.quantity}</td>
                              <td className="text-right p-2 sm:p-3 hidden sm:table-cell">
                                {item.discount > 0 && (
                                  <div className="line-through text-slate-400 text-xs mb-1">
                                    {item.price.toLocaleString('vi-VN')}₫
                                  </div>
                                )}
                                <div>{finalPrice.toLocaleString('vi-VN')}₫</div>
                              </td>
                              <td className="text-right p-2 sm:p-3 font-semibold">
                                {(finalPrice * item.quantity).toLocaleString('vi-VN')}₫
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Payment Summary */}
              <div className="border-t-2 border-slate-200 dark:border-slate-600 pt-3 sm:pt-4 space-y-2">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span>Tạm tính</span>
                  <span>{billData.subtotal.toLocaleString('vi-VN')}₫</span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span>Phí vận chuyển</span>
                  <span className={billData.shippingFee === 0 ? 'text-green-600 font-medium' : ''}>
                    {billData.shippingFee === 0 ? 'Miễn phí' : `${billData.shippingFee.toLocaleString('vi-VN')}₫`}
                  </span>
                </div>
                {billData.discount > 0 && (
                  <div className="flex justify-between text-xs sm:text-sm text-green-600">
                    <span>Giảm giá</span>
                    <span>-{billData.discount.toLocaleString('vi-VN')}₫</span>
                  </div>
                )}
                <div className="flex justify-between text-base sm:text-lg font-bold pt-2 border-t border-slate-200 dark:border-slate-600">
                  <span>Tổng thanh toán</span>
                  <span className="text-blue-600">{billData.total.toLocaleString('vi-VN')}₫</span>
                </div>
              </div>

              {/* Transaction Info */}
              <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs">
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  <strong>Lưu ý:</strong> Đây là biên lai xác nhận giao dịch thanh toán qua VNPAY. 
                  Vui lòng lưu lại để đối chiếu khi cần thiết. Mọi thắc mắc xin liên hệ hotline: <span className="font-semibold">1900 55 55 77</span>
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4 sm:mt-6 no-print sticky bottom-0 bg-white dark:bg-slate-800 py-3 sm:py-0 -mx-4 px-4 sm:mx-0 sm:px-0 border-t sm:border-0 dark:border-slate-700">
                <button 
                  onClick={handlePrintBill}
                  className="flex-1 px-4 py-2.5 sm:py-3 rounded-lg border-2 border-blue-600 text-blue-600 font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  In hóa đơn
                </button>
                <button 
                  onClick={handleCompleteBill}
                  className="flex-1 px-4 py-2.5 sm:py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-all shadow-lg text-sm sm:text-base"
                >
                  Hoàn tất
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* COD OTP Modal */}
      {showCODOtpForm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-2 text-slate-800 dark:text-slate-100">Xác nhận đơn hàng</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Mã OTP đã được gửi đến</p>
              <p className="text-base font-semibold text-blue-600">{shipping.email}</p>
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  Thời gian còn lại: <span className="text-lg font-bold">{otpCountdown}s</span>
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Mã OTP (6 chữ số)</label>
                <input 
                  type="text" 
                  placeholder="Nhập mã OTP"
                  maxLength={6}
                  value={codOtp} 
                  onChange={e=>setCodOtp(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && codOtp.length === 6 && otpCountdown > 0) {
                      e.preventDefault();
                      handleCODOtpSubmit();
                    }
                  }}
                  className="w-full px-4 py-4 rounded-lg border-2 border-slate-300 dark:bg-slate-700 dark:border-slate-600 text-center text-2xl font-mono font-bold tracking-widest focus:ring-2 focus:ring-green-500 focus:border-green-500" 
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => {setShowCODOtpForm(false); setCodOtp('')}} 
                  className="flex-1 px-4 py-3 rounded-lg border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                >
                  Hủy
                </button>
                <button 
                  onClick={handleCODOtpSubmit} 
                  disabled={codOtp.length !== 6 || otpCountdown === 0}
                  className="flex-1 px-4 py-3 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Xác nhận
                </button>
              </div>
              <button 
                onClick={handleCODPayment}
                disabled={otpCountdown > 0}
                className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {otpCountdown > 0 ? `Gửi lại sau ${otpCountdown}s` : 'Gửi lại mã OTP'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </section>
  )
}
