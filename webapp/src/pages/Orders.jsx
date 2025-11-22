import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { listOrders } from '../services/orders'
import { Card, CardBody } from '../components/ui/Card'
import { Link } from 'react-router-dom'
import { resolveImageUrl } from '../api/client'

export default function Orders() {
	const { api } = useAuth()
	const [orders, setOrders] = useState([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		listOrders(api).then(setOrders).finally(() => setLoading(false))
	}, [api])

  if (loading) return <main className="container-page py-10"><p className="text-muted">Loading...</p></main>

	return (
    <main className="container-page py-10">
      <h1 className="heading-section mb-6">Đơn hàng của bạn</h1>
      {orders.length === 0 ? (
        <p className="text-slate-600">Chưa có đơn hàng nào.</p>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => {
            const total = (o.total_cents || 0) - (o.discount_cents || 0) - (o.loyalty_cents_used || 0)
            return (
              <Card key={o.id}>
                <CardBody>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="text-sm text-slate-500">Mã đơn hàng</div>
                      <div className="text-xl font-semibold">#{o.id}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {new Date(o.created_at || Date.now()).toLocaleString('vi-VN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                        o.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        o.status === 'SHIPPING' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        o.status === 'DELIVERED' ? 'bg-green-50 text-green-700 border border-green-200' :
                        'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {o.status}
                      </span>
                      <div className="mt-2 text-lg font-semibold text-slate-900">
                        {(total/100).toLocaleString()} ₫
                      </div>
                    </div>
                  </div>

                  {/* Danh sách sản phẩm */}
                  {o.items && o.items.length > 0 && (
                    <div className="border-t border-slate-200 pt-4 mt-4">
                      <div className="text-sm font-medium text-slate-700 mb-3">Sản phẩm ({o.items.length})</div>
                      <div className="space-y-2">
                        {o.items.slice(0, 3).map((item) => (
                          <div key={item.id} className="flex items-center gap-3 text-sm">
                            <div className="h-12 w-12 overflow-hidden rounded bg-slate-100 flex-shrink-0">
                              {item.product?.image_url ? (
                                <img 
                                  src={resolveImageUrl(item.product.image_url)} 
                                  alt={item.product?.name || `SP #${item.product_id}`} 
                                  className="h-full w-full object-cover" 
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-slate-400 text-xs">No img</div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-slate-900 truncate">
                                {item.product?.name || `Sản phẩm #${item.product_id}`}
                              </div>
                              <div className="text-xs text-slate-500">
                                {item.product?.brand && `${item.product.brand} • `}
                                Số lượng: {item.quantity} × {(item.price_cents/100).toLocaleString()} ₫
                              </div>
                            </div>
                            <div className="text-sm font-medium text-slate-900">
                              {((item.price_cents * item.quantity)/100).toLocaleString()} ₫
                            </div>
                          </div>
                        ))}
                        {o.items.length > 3 && (
                          <div className="text-xs text-slate-500 pt-2">
                            + {o.items.length - 3} sản phẩm khác
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <Link 
                      to={`/orders/${o.id}`} 
                      className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Xem chi tiết đơn hàng
                    </Link>
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}
    </main>
	)
}


