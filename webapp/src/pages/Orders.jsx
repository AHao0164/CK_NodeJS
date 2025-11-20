import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { listOrders } from '../services/orders'
import { Card, CardBody } from '../components/ui/Card'

export default function Orders() {
	const { api } = useAuth()
	const [orders, setOrders] = useState([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		listOrders(api).then(setOrders).finally(() => setLoading(false))
	}, [])

  if (loading) return <main className="container-page py-10"><p className="text-muted">Loading...</p></main>

	return (
    <main className="container-page py-10">
      <h1 className="heading-section mb-6">Đơn hàng của bạn</h1>
      {orders.length === 0 ? (
        <p className="text-slate-600">Chưa có đơn hàng nào.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {orders.map((o) => (
            <Card key={o.id}>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-slate-500">Mã đơn</div>
                    <div className="font-semibold">#{o.id}</div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs ${o.status==='PAID'?'bg-emerald-50 text-emerald-700 border border-emerald-200':'bg-slate-100 text-slate-700'}`}>{o.status}</span>
                </div>
                <div className="mt-3 text-lg font-semibold">{((o.total_cents - (o.discount_cents || 0))/100).toLocaleString()} ₫</div>
                <div className="mt-1 text-xs text-slate-500">{new Date(o.created_at || Date.now()).toLocaleString()}</div>
                <a href={`/orders/${o.id}`} className="mt-3 inline-flex text-sm text-brand-600 hover:underline">Xem chi tiết</a>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </main>
	)
}


