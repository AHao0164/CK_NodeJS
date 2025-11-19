import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { listOrders } from '../services/orders'
import { Card, CardBody } from '../components/ui/Card'
import { motion } from 'framer-motion'

export default function Orders() {
	const { api } = useAuth()
	const [orders, setOrders] = useState([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		listOrders(api).then(setOrders).finally(() => setLoading(false))
	}, [api])

  if (loading) return <main className="mx-auto max-w-7xl px-4 py-10"><p className="text-slate-600">Loading...</p></main>

	return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <motion.h1 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-bitcount"
      >
        Your Orders
      </motion.h1>
      {orders.length === 0 ? (
        <p className="text-slate-600 dark:text-slate-400">No orders yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {orders.map((o, idx) => (
            <motion.div
              key={o.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card>
                <CardBody>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-500">Order ID</div>
                      <div className="font-semibold">#{o.id}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs ${o.status==='PAID'?'bg-emerald-50 text-emerald-700 border border-emerald-200':'bg-slate-100 text-slate-700'}`}>{o.status}</span>
                  </div>
                  <div className="mt-3 text-lg font-semibold">{(o.total_cents/100).toLocaleString()} ₫</div>
                  <div className="mt-1 text-xs text-slate-500">{new Date(o.created_at || Date.now()).toLocaleString()}</div>
                  <a href={`/orders/${o.id}`} className="mt-3 inline-flex text-sm text-primary hover:underline transition-colors">View Details</a>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </main>
	)
}

