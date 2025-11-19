import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Card, CardBody } from '../components/ui/Card'

export default function OrderDetail() {
  const { id } = useParams()
  const { api } = useAuth()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/orders/${id}`).then(r => setOrder(r.data)).finally(() => setLoading(false))
  }, [api, id])

  if (loading) return <main className="container-page py-10"><p>Loading...</p></main>
  if (!order) return <main className="container-page py-10"><p>Không tìm thấy đơn hàng.</p></main>

  const total = Number(order.total_cents || 0)
  return (
    <main className="container-page py-10">
      <div className="mb-4 text-sm text-slate-500"><Link className="hover:underline" to="/orders">← Quay lại danh sách</Link></div>
      <h1 className="heading-section mb-4">Đơn hàng #{order.id}</h1>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardBody>
            <div className="mb-3 text-sm text-slate-500">Sản phẩm</div>
            <div className="divide-y divide-slate-200">
              {order.items.map(it => (
                <div key={it.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded bg-slate-100">
                      {it.product?.image_url ? (
                        <img src={it.product.image_url.startsWith('/') ? `${import.meta.env.VITE_API_BASE || 'http://localhost:8080'}${it.product.image_url}` : it.product.image_url} alt={it.product?.name || `SP #${it.product_id}`} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div>
                      <div className="font-medium">{it.product?.name || `SP #${it.product_id}`}</div>
                      <div className="text-xs text-slate-500">{[it.product?.brand, it.product?.category].filter(Boolean).join(' • ')}</div>
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-6">
                    <div className="text-slate-500">x{it.quantity}</div>
                    <div className="font-medium">{(it.price_cents/100).toLocaleString()} ₫</div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="mb-2 text-sm text-slate-500">Trạng thái</div>
            <div className="mb-4"><span className={`rounded-full px-2.5 py-1 text-xs ${order.status==='PAID'?'bg-emerald-50 text-emerald-700 border border-emerald-200':'bg-slate-100 text-slate-700'}`}>{order.status}</span></div>
            <div className="flex justify-between text-sm"><span>Tạm tính</span><span>{(total/100).toLocaleString()} ₫</span></div>
            <div className="flex justify-between text-sm"><span>Phí vận chuyển</span><span>0 ₫</span></div>
            <div className="mt-2 flex justify-between text-sm font-semibold"><span>Tổng cộng</span><span>{(total/100).toLocaleString()} ₫</span></div>
            <div className="mt-6 text-sm">
              <div className="mb-2 text-slate-500">Địa chỉ giao hàng</div>
              <div className="space-y-1">
                <div><span className="text-slate-500">Người nhận:</span> <span className="font-medium">{order.shipping_name || '-'}</span></div>
                <div><span className="text-slate-500">SĐT:</span> <span className="font-medium">{order.shipping_phone || '-'}</span></div>
                <div><span className="text-slate-500">Địa chỉ:</span> <span className="font-medium">{[order.shipping_address, order.shipping_ward, order.shipping_district, order.shipping_city].filter(Boolean).join(', ') || '-'}</span></div>
              </div>
              <div className="mt-4 mb-2 text-slate-500">Thông tin thanh toán</div>
              <div className="space-y-1">
                <div><span className="text-slate-500">Người thanh toán:</span> <span className="font-medium">{order.billing_name || '-'}</span></div>
                <div><span className="text-slate-500">SĐT:</span> <span className="font-medium">{order.billing_phone || '-'}</span></div>
                <div><span className="text-slate-500">Địa chỉ hóa đơn:</span> <span className="font-medium">{order.billing_address || '-'}</span></div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </main>
  )
}


