import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { listOrders } from '../services/orders'
import { Card, CardBody } from '../components/ui/Card'
import { motion } from 'framer-motion'
import VI from '../constants/vi'

const statusColors = {
  PENDING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
  SHIPPING: 'bg-purple-50 text-purple-700 border-purple-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200'
}

const statusLabels = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  SHIPPING: 'Đang giao',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy'
}

const paymentMethodLabels = {
  COD: 'Thanh toán khi nhận hàng',
  VNPAY: 'Thanh toán VNPay'
}

export default function Orders() {
	const { api } = useAuth()
	const [orders, setOrders] = useState([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		document.title = 'Đơn hàng của tôi - GearUp';
	}, []);

	useEffect(() => {
		listOrders(api).then(setOrders).finally(() => setLoading(false))
	}, [api])

  if (loading) return <main className="mx-auto max-w-7xl px-4 py-10"><p className="text-slate-600">{VI.common.loading}</p></main>

	return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <motion.h1 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-bitcount"
      >
        {VI.orders.title}
      </motion.h1>
      {orders.length === 0 ? (
        <p className="text-slate-600 dark:text-slate-400">{VI.orders.noOrdersMessage}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orders.map((o, idx) => (
            <motion.div
              key={o.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card>
                <CardBody>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-sm text-slate-500">{VI.orders.orderNumber}</div>
                      <div className="font-semibold text-lg">#{o.id}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs border ${statusColors[o.status] || 'bg-slate-100 text-slate-700'}`}>
                      {statusLabels[o.status] || o.status}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Tổng tiền:</span>
                      <span className="font-semibold">{(o.total_cents || 0).toLocaleString('vi-VN')} ₫</span>
                    </div>
                    
                    {o.discount_cents > 0 && (
                      <div className="flex justify-between text-sm text-emerald-600">
                        <span>Giảm giá:</span>
                        <span>-{(o.discount_cents || 0).toLocaleString('vi-VN')} ₫</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Phương thức:</span>
                      <span className="text-xs">{paymentMethodLabels[o.payment_method] || o.payment_method}</span>
                    </div>
                  </div>
                  
                  <div className="pt-3 border-t border-slate-200">
                    <div className="text-xs text-slate-500 mb-2">
                      {new Date(o.created_at || Date.now()).toLocaleString('vi-VN')}
                    </div>
                    <a 
                      href={`/orders/${o.id}`} 
                      className="inline-flex items-center text-sm text-primary hover:underline transition-colors"
                    >
                      {VI.orders.viewDetails} →
                    </a>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </main>
	)
}

