import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Button from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { fetchCart } from '../services/cart'
import { checkoutOrder, payForOrder, validateCoupon } from '../services/orders'
import { motion } from 'framer-motion'
import { useToast } from '../ui/Toast'

export default function Checkout() {
  const { api, token } = useAuth()
  const [cart, setCart] = useState({ items: [] })
  const navigate = useNavigate()
  const toast = useToast()
  const [shipping, setShipping] = useState({ name: '', phone: '', address: '', city: '', district: '', ward: '' })
  const [billing, setBilling] = useState({ name: '', phone: '', address: '' })
  const [guestEmail, setGuestEmail] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [coupon, setCoupon] = useState(null)
  const [error, setError] = useState('')
  const [couponError, setCouponError] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [user, setUser] = useState(null)
  const [saveAsDefault, setSaveAsDefault] = useState(false)
  const [savedAddresses, setSavedAddresses] = useState([])
  const [showAddressSelect, setShowAddressSelect] = useState(false)
  
  useEffect(() => { 
    fetchCart(api).then(setCart) 
    
    // Fetch user profile and saved addresses for logged-in users
    if (token) {
      api.get('/auth/me').then(({ data }) => {
        setUser(data)
        if (data.defaultAddress) {
          setShipping({
            name: data.fullName || '',
            phone: data.defaultPhone || '',
            address: data.defaultAddress || '',
            city: data.defaultCity || '',
            district: data.defaultDistrict || '',
            ward: data.defaultWard || ''
          })
          setBilling({
            name: data.fullName || '',
            phone: data.defaultPhone || '',
            address: data.defaultAddress || ''
          })
        }
      }).catch(() => {})
      
      // Load saved addresses
      api.get('/auth/addresses').then(({ data }) => {
        setSavedAddresses(data.addresses || [])
      }).catch(() => {})
    }
  }, [api, token])
  
  const total = cart.items.reduce((s, it) => s + it.price_cents_snapshot * it.quantity, 0)
  const discount = (() => {
    if (!coupon) return 0
    if (coupon.type === 'percentage') return Math.floor(total * (coupon.value / 100))
    if (coupon.type === 'fixed') return Math.min(total, coupon.value)
    return 0
  })()
  
  async function pay() {
    try {
      const items = cart.items.map(it => ({ productId: it.product_id, quantity: it.quantity, priceCents: it.price_cents_snapshot }))
      setError('')
      
      // For guest checkout, include email
      const checkoutData = { 
        items, 
        shipping, 
        billing
      }
      
      // Only send coupon code if it's been validated
      if (coupon && coupon.code) {
        checkoutData.couponCode = coupon.code
      }
      
      if (!token && guestEmail) {
        checkoutData.guestEmail = guestEmail
      }
      
      const data = await checkoutOrder(api, checkoutData)
      if (data.qrUrl) {
        window.open(data.qrUrl, '_blank')
      }
      // Với demo QR: người dùng chuyển khoản xong, nhấn nút xác nhận để gọi confirm
      await payForOrder(api, { orderId: data.orderId, intentId: data.paymentIntentId })
      
      // Save address as default if user opted in
      if (token && saveAsDefault) {
        try {
          await api.patch('/auth/me', {
            defaultAddress: shipping.address,
            defaultCity: shipping.city,
            defaultDistrict: shipping.district,
            defaultWard: shipping.ward,
            defaultPhone: shipping.phone
          })
        } catch (e) {
          // Silently fail
        }
      }
      
      toast.show('✓ Thanh toán thành công', { type: 'success' })
      
      if (!token) {
        toast.show('Tài khoản đã được tạo với email: ' + guestEmail, { type: 'info' })
        setTimeout(() => navigate('/login'), 2000)
      } else {
        navigate('/orders')
      }
    } catch (e) {
      const msg = e?.response?.data?.details?.join(', ') || e?.response?.data?.error || 'Có lỗi khi thanh toán, vui lòng thử lại'
      setError(String(msg))
    }
  }

  async function applyCoupon() {
    if (!couponCode) {
      setCouponError('Vui lòng nhập mã giảm giá')
      return
    }
    
    // Validate format: 5 alphanumeric characters
    if (!/^[A-Z0-9]{5}$/i.test(couponCode)) {
      setCouponError('Mã giảm giá phải là chuỗi 5 ký tự chữ và số')
      setCoupon(null)
      return
    }
    
    setCouponLoading(true)
    setCouponError('')
    try {
      const data = await validateCoupon(api, couponCode)
      setCoupon(data)
      setCouponError('')
      toast.show(`✓ Áp dụng mã ${data.code} thành công! Còn ${data.remaining} lượt sử dụng`, { type: 'success' })
    } catch (e) {
      setCoupon(null)
      const msg = e?.response?.data?.message || e?.response?.data?.error || 'Mã giảm giá không hợp lệ hoặc đã hết hạn'
      setCouponError(msg)
    } finally {
      setCouponLoading(false)
    }
  }
  
  const removeCoupon = () => {
    setCoupon(null)
    setCouponCode('')
    setCouponError('')
    toast.show('Đã xóa mã giảm giá', { type: 'info' })
  }
  
  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <motion.h2 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 font-bitcount"
      >
        Checkout
      </motion.h2>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardBody>
              {!token && (
                <>
                  <h3 className="text-base font-semibold">Guest Checkout</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Nhập email để tạo tài khoản và theo dõi đơn hàng</p>
                  <div className="mt-4">
                    <input 
                      className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm dark:bg-slate-800 dark:border-slate-700" 
                      placeholder="Email Address *" 
                      type="email"
                      value={guestEmail} 
                      onChange={e=>setGuestEmail(e.target.value)} 
                      required
                    />
                  </div>
                  <div className="mt-4 mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      💡 Tài khoản sẽ được tự động tạo với email này. Bạn có thể đăng nhập sau để xem lịch sử đơn hàng.
                    </p>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center">
                <h3 className="text-base font-semibold">Shipping Address</h3>
                {token && savedAddresses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAddressSelect(!showAddressSelect)}
                    className="text-sm text-primary hover:text-primary/80 font-semibold"
                  >
                    {showAddressSelect ? 'Nhập thủ công' : 'Chọn địa chỉ đã lưu'}
                  </button>
                )}
              </div>

              {/* Saved Address Selection */}
              {token && showAddressSelect && savedAddresses.length > 0 && (
                <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                  {savedAddresses.map((addr) => (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => {
                        setShipping({
                          name: addr.recipient_name,
                          phone: addr.phone,
                          address: addr.address,
                          city: addr.city,
                          district: addr.district || '',
                          ward: addr.ward || ''
                        })
                        setBilling({
                          name: addr.recipient_name,
                          phone: addr.phone,
                          address: addr.address
                        })
                        setShowAddressSelect(false)
                      }}
                      className="w-full text-left p-3 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {addr.label && (
                          <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-semibold rounded">
                            {addr.label}
                          </span>
                        )}
                        {addr.is_default === 1 && (
                          <span className="text-xs text-green-600 dark:text-green-400">★ Mặc định</span>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {addr.recipient_name} - {addr.phone}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        {addr.address}, {addr.ward && `${addr.ward}, `}{addr.district && `${addr.district}, `}{addr.city}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <input className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm dark:bg-slate-800 dark:border-slate-700" placeholder="Full Name" value={shipping.name} onChange={e=>setShipping({ ...shipping, name: e.target.value })} />
                <input className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm dark:bg-slate-800 dark:border-slate-700" placeholder="Phone Number" value={shipping.phone} onChange={e=>setShipping({ ...shipping, phone: e.target.value })} />
                <input className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm md:col-span-2 dark:bg-slate-800 dark:border-slate-700" placeholder="Address" value={shipping.address} onChange={e=>setShipping({ ...shipping, address: e.target.value })} />
                <input className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm dark:bg-slate-800 dark:border-slate-700" placeholder="City" value={shipping.city} onChange={e=>setShipping({ ...shipping, city: e.target.value })} />
                <input className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm dark:bg-slate-800 dark:border-slate-700" placeholder="District" value={shipping.district} onChange={e=>setShipping({ ...shipping, district: e.target.value })} />
                <input className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm dark:bg-slate-800 dark:border-slate-700" placeholder="Ward" value={shipping.ward} onChange={e=>setShipping({ ...shipping, ward: e.target.value })} />
              </div>
              {token && (
                <div className="mt-4 flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="saveAddress" 
                    checked={saveAsDefault}
                    onChange={(e) => setSaveAsDefault(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="saveAddress" className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                    Lưu làm địa chỉ mặc định
                  </label>
                </div>
              )}
              <h3 className="mt-6 text-base font-semibold">Billing Information</h3>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <input className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm dark:bg-slate-800 dark:border-slate-700" placeholder="Billing Name" value={billing.name} onChange={e=>setBilling({ ...billing, name: e.target.value })} />
                <input className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm dark:bg-slate-800 dark:border-slate-700" placeholder="Phone Number" value={billing.phone} onChange={e=>setBilling({ ...billing, phone: e.target.value })} />
                <input className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm md:col-span-2 dark:bg-slate-800 dark:border-slate-700" placeholder="Billing Address" value={billing.address} onChange={e=>setBilling({ ...billing, address: e.target.value })} />
              </div>
            </CardBody>
          </Card>
        </div>
        <div>
          <Card>
            <CardBody>
              <h3 className="text-base font-semibold mb-4 text-slate-900 dark:text-slate-100">Tóm tắt đơn hàng</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span>Tạm tính</span>
                  <span>{(total/100).toLocaleString()} ₫</span>
                </div>
                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span>Phí vận chuyển</span>
                  <span>0 ₫</span>
                </div>
                {discount > 0 && coupon && (
                  <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                    <span className="flex items-center gap-1">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Giảm giá ({coupon.code})
                    </span>
                    <span>-{(discount/100).toLocaleString()} ₫</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700"></div>
                <div className="flex justify-between font-semibold text-base text-slate-900 dark:text-slate-100">
                  <span>Tổng cộng</span>
                  <span className="text-primary">{((total-discount)/100).toLocaleString()} ₫</span>
                </div>
              </div>
              
              {/* Coupon Section */}
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                  Mã giảm giá
                </label>
                {!coupon ? (
                  <>
                    <div className="flex gap-2">
                      <input 
                        className="h-11 flex-1 rounded-lg border border-slate-300 px-3 text-sm dark:bg-slate-800 dark:border-slate-700 uppercase" 
                        placeholder="Nhập mã (5 ký tự)" 
                        maxLength={5}
                        value={couponCode} 
                        onChange={e=>setCouponCode(e.target.value.toUpperCase())}
                        onKeyPress={e => e.key === 'Enter' && applyCoupon()}
                      />
                      <Button 
                        onClick={applyCoupon} 
                        variant="outline"
                        disabled={couponLoading || !couponCode}
                      >
                        {couponLoading ? 'Kiểm tra...' : 'Áp dụng'}
                      </Button>
                    </div>
                    {couponError && (
                      <div className="mt-2 flex items-start gap-1 text-xs text-red-600 dark:text-red-400">
                        <svg className="h-4 w-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{couponError}</span>
                      </div>
                    )}
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      💡 Mã giảm giá gồm 5 ký tự chữ và số
                    </div>
                  </>
                ) : (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-emerald-800 dark:text-emerald-200">
                            {coupon.code}
                          </span>
                          <span className="px-2 py-0.5 text-xs bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300 rounded">
                            {coupon.type === 'percentage' ? `${coupon.value}%` : 
                             coupon.type === 'fixed' ? `${(coupon.value/100).toLocaleString()}₫` : 
                             'Miễn phí ship'}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                          ✓ Giảm {(discount/100).toLocaleString()} ₫ • Còn {coupon.remaining} lượt
                        </div>
                      </div>
                      <button 
                        onClick={removeCoupon}
                        className="ml-2 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {error && <div className="mt-3 text-center text-xs text-red-600 dark:text-red-400">{error}</div>}
              <Button onClick={pay} className="mt-4 w-full" disabled={cart.items.length===0}>
                Xác nhận thanh toán
              </Button>
              {cart.items.length===0 && (
                <div className="mt-2 text-center text-xs text-amber-600">Giỏ hàng trống — vui lòng thêm sản phẩm trước khi thanh toán</div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </section>
  )
}

