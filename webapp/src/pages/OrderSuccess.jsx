import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Button from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { getOrder } from '../services/orders'
import { useToast } from '../ui/Toast'

export default function OrderSuccess() {
  const { api } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const guestEmail = new URLSearchParams(location.search).get('guestEmail') || ''
  const initialOrder = location.state?.orderPreview
  const [order, setOrder] = useState(initialOrder || null)
  const [loading, setLoading] = useState(!initialOrder)
  const [error, setError] = useState('')

  useEffect(() => {
    if (order) return
    setLoading(true)
    getOrder(api, id, guestEmail)
      .then((data) => setOrder(data))
      .catch(() => {
        setError('Không thể tải dữ liệu đơn hàng.')
        toast.show('Không thể tải đơn hàng vừa đặt', { type: 'error' })
      })
      .finally(() => setLoading(false))
  }, [api, guestEmail, id, order, toast])

  if (loading) {
    return <main className="container-page py-10"><p className="text-muted">Đang tải đơn hàng...</p></main>
  }
  if (error || !order) {
    return <main className="container-page py-10"><p className="text-center text-red-600">{error || 'Không tìm thấy đơn hàng.'}</p></main>
  }

  const formatPrice = (value) => (value / 100).toLocaleString() + ' ₫'
  const subtotal = (order.total_cents || 0)
  const discount = (order.discount_cents || 0)
  const loyaltyUsed = order.loyalty_cents_used || 0
  const loyaltyEarned = order.loyalty_cents_earned || 0
  const finalTotal = Math.max(subtotal - discount - loyaltyUsed, 0)

  return (
    <main className="container-page py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card className="rounded-[32px] border border-emerald-200 bg-emerald-50">
          <CardBody>
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-600">Thanh toán thành công</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Cám ơn bạn đã đặt hàng!</h1>
            <p className="mt-2 text-slate-600">
              Đơn hàng #{order.id} đang xử lý. Chúng tôi đã gửi xác nhận tới {order.user_email || order.guest_email || 'email của bạn'}.
            </p>
          </CardBody>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-500">Mã đơn hàng</div>
                  <div className="text-lg font-semibold">#{order.id}</div>
                </div>
                <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                  {order.status}
                </span>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 border-b border-slate-100 pb-3 last:border-0">
                    <div className="h-16 w-16 overflow-hidden rounded-lg bg-slate-100">
                      {item.product?.image_url ? (
                        <img
                          src={item.product.image_url.startsWith('/') ? `${import.meta.env.VITE_API_BASE || 'http://localhost:8080'}${item.product.image_url}` : item.product.image_url}
                          alt={item.product?.name}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">{item.product?.name || `SP #${item.product_id}`}</div>
                      <p className="text-xs text-slate-500">{item.quantity} × {formatPrice(item.price_cents)}</p>
                    </div>
                    <div className="text-sm font-semibold text-slate-900">{formatPrice(item.price_cents * item.quantity)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <div className="flex justify-between">
                  <span>Tổng cộng</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Giảm giá</span>
                    <span>-{formatPrice(discount)}</span>
                  </div>
                )}
                {loyaltyUsed > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span>Đã dùng điểm</span>
                    <span>-{formatPrice(loyaltyUsed)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-slate-900">
                  <span>Phải trả</span>
                  <span>{formatPrice(finalTotal)}</span>
                </div>
                {loyaltyEarned > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Điểm nhận được ({(loyaltyEarned / 1000).toLocaleString()} pts)</span>
                    <span>~{formatPrice(loyaltyEarned)}</span>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="space-y-4 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">Địa chỉ giao hàng</div>
                  <div className="text-base font-medium text-slate-900">{order.shipping_name || '—'}</div>
                  <p className="text-slate-600">{order.shipping_phone || '—'}</p>
                  <p className="text-slate-600">
                    {[order.shipping_address, order.shipping_ward, order.shipping_district, order.shipping_city].filter(Boolean).join(', ')}
                  </p>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">Thông tin thanh toán</div>
                  <div className="text-base font-medium text-slate-900">{order.billing_name || '—'}</div>
                  <p className="text-slate-600">{order.billing_phone || '—'}</p>
                  <p className="text-slate-600">{order.billing_address || '—'}</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {order.status_history?.length > 0 && (
          <Card>
            <CardBody>
              <h3 className="text-base font-semibold text-slate-900">Lịch sử trạng thái</h3>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                {order.status_history.map((entry) => (
                  <div key={`${entry.status}-${entry.created_at}`} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                    <div>
                      <div className="font-semibold text-slate-900">{entry.status}</div>
                      <div className="text-xs text-slate-500">{new Date(entry.created_at).toLocaleString('vi-VN')}</div>
                    </div>
                    <span className="text-xs uppercase tracking-wide text-slate-500">{entry.note || '—'}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        <div className="flex flex-col gap-3 text-sm sm:flex-row">
          <Button className="flex-1" onClick={() => navigate('/orders')}>Xem lịch sử đơn hàng</Button>
          <Button variant="outline" className="flex-1" onClick={() => navigate('/')}>Tiếp tục mua sắm</Button>
        </div>
      </div>
    </main>
  )
}

