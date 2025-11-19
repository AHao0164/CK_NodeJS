import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Button from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { fetchCart } from '../services/cart'
import { checkoutOrder, payForOrder, validateCoupon } from '../services/orders'

export default function Checkout() {
  const { api } = useAuth()
  const [cart, setCart] = useState({ items: [] })
  const navigate = useNavigate()
  const [shipping, setShipping] = useState({ name: '', phone: '', address: '', city: '', district: '', ward: '' })
  const [billing, setBilling] = useState({ name: '', phone: '', address: '' })
  const [couponCode, setCouponCode] = useState('')
  const [coupon, setCoupon] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { fetchCart(api).then(setCart) }, [api])
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
      const data = await checkoutOrder(api, { items, shipping, billing, couponCode: coupon?.code || couponCode || undefined })
      if (data.qrUrl) {
        window.open(data.qrUrl, '_blank')
      }
      // Với demo QR: người dùng chuyển khoản xong, nhấn nút xác nhận để gọi confirm
      await payForOrder(api, { orderId: data.orderId, intentId: data.paymentIntentId })
      alert('Thanh toán thành công')
      navigate('/orders')
    } catch (e) {
      const msg = e?.response?.data?.details?.join(', ') || e?.response?.data?.error || 'Có lỗi khi thanh toán, vui lòng thử lại'
      setError(String(msg))
    }
  }

  async function applyCoupon() {
    if (!couponCode) return
    try {
      const data = await validateCoupon(api, couponCode)
      setCoupon(data)
    } catch (_) {
      setCoupon(null)
      setError('Mã giảm giá không hợp lệ hoặc đã hết hạn')
    }
  }
  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <h2 className="text-2xl font-semibold tracking-tight">Thanh toán</h2>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardBody>
              <h3 className="text-base font-semibold">Địa chỉ giao hàng</h3>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <input className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="Họ tên người nhận" value={shipping.name} onChange={e=>setShipping({ ...shipping, name: e.target.value })} />
                <input className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="Số điện thoại" value={shipping.phone} onChange={e=>setShipping({ ...shipping, phone: e.target.value })} />
                <input className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm md:col-span-2" placeholder="Địa chỉ" value={shipping.address} onChange={e=>setShipping({ ...shipping, address: e.target.value })} />
                <input className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="Tỉnh/Thành" value={shipping.city} onChange={e=>setShipping({ ...shipping, city: e.target.value })} />
                <input className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="Quận/Huyện" value={shipping.district} onChange={e=>setShipping({ ...shipping, district: e.target.value })} />
                <input className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="Phường/Xã" value={shipping.ward} onChange={e=>setShipping({ ...shipping, ward: e.target.value })} />
              </div>
              <h3 className="mt-6 text-base font-semibold">Thông tin thanh toán</h3>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <input className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="Tên người thanh toán" value={billing.name} onChange={e=>setBilling({ ...billing, name: e.target.value })} />
                <input className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="Số điện thoại" value={billing.phone} onChange={e=>setBilling({ ...billing, phone: e.target.value })} />
                <input className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm md:col-span-2" placeholder="Địa chỉ hóa đơn" value={billing.address} onChange={e=>setBilling({ ...billing, address: e.target.value })} />
              </div>
            </CardBody>
          </Card>
        </div>
        <div>
          <Card>
            <CardBody>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Tạm tính</span><span>{(total/100).toLocaleString()} ₫</span></div>
                <div className="flex justify-between"><span>Phí vận chuyển</span><span>0 ₫</span></div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-700"><span>Giảm giá ({coupon?.code})</span><span>-{(discount/100).toLocaleString()} ₫</span></div>
                )}
                <div className="flex justify-between font-semibold"><span>Tổng thanh toán</span><span>{((total-discount)/100).toLocaleString()} ₫</span></div>
              </div>
              <div className="mt-3 flex gap-2">
                <input className="h-11 flex-1 rounded-lg border border-slate-300 px-3 text-sm" placeholder="Mã giảm giá" value={couponCode} onChange={e=>setCouponCode(e.target.value.toUpperCase())} />
                <Button onClick={applyCoupon} variant="outline">Áp dụng</Button>
              </div>
              {error && <div className="mt-2 text-center text-xs text-red-600">{error}</div>}
              <Button onClick={pay} className="mt-4 w-full" disabled={cart.items.length===0}>Xác nhận thanh toán</Button>
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


