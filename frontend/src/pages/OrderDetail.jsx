import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Card, CardBody } from '../components/ui/Card'
import { motion } from 'framer-motion'
import { useToast } from '../ui/Toast'
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
  SHIPPING: 'Đang giao hàng',
  DELIVERED: 'Đã giao hàng',
  CANCELLED: 'Đã hủy'
}

const paymentMethodLabels = {
  COD: 'Thanh toán khi nhận hàng (COD)',
  VNPAY: 'Thanh toán VNPay'
}

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { api } = useAuth()
  const toast = useToast()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [statusHistory, setStatusHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    document.title = `Chi tiết đơn hàng #${id} - GearUp`;
  }, [id]);

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get(`/orders/${id}`).then(r => r.data),
      api.get(`/orders/${id}/status-history`).then(r => r.data).catch(() => [])
    ]).then(([orderData, historyData]) => {
      setOrder(orderData)
      setStatusHistory(historyData)
    }).finally(() => setLoading(false))
  }, [api, id])

  const handleCancelOrder = async () => {
    if (!window.confirm('Bạn có chắc muốn hủy đơn hàng này?')) return
    
    setCancelling(true)
    try {
      await api.patch(`/orders/${id}/cancel`)
      toast.show('✓ Đã hủy đơn hàng thành công', { type: 'success' })
      setTimeout(() => navigate('/orders'), 1500)
    } catch (e) {
      const msg = e?.response?.data?.error || 'Không thể hủy đơn hàng'
      toast.show(`❌ ${msg}`, { type: 'error' })
    } finally {
      setCancelling(false)
    }
  }

  if (loading) return <main className="mx-auto max-w-7xl px-4 py-10"><p>{VI.common.loading}</p></main>
  if (!order) return <main className="mx-auto max-w-7xl px-4 py-10"><p>Không tìm thấy đơn hàng.</p></main>

  const subtotal = order.total_cents - (order.shipping_fee_cents || 0) + (order.discount_cents || 0)
  const shippingFee = order.shipping_fee_cents || 0
  const discount = order.discount_cents || 0
  const total = order.total_cents || 0

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-4 text-sm text-slate-500"><Link className="hover:underline" to="/orders">← Quay lại đơn hàng</Link></div>
      <motion.h1 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-bitcount"
      >
        Đơn hàng #{order.id}
      </motion.h1>
      
      {/* Status Timeline */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500 mb-1">Trạng thái đơn hàng</div>
              <span className={`inline-flex rounded-full px-3 py-1.5 text-sm font-medium border ${statusColors[order.status] || 'bg-slate-100 text-slate-700'}`}>
                {statusLabels[order.status] || order.status}
              </span>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-500 mb-1">Ngày đặt hàng</div>
              <div className="text-sm font-medium">{new Date(order.created_at || Date.now()).toLocaleString('vi-VN')}</div>
            </div>
          </div>
          
          {/* Cancel button - only show for PENDING status */}
          {order.status === 'PENDING' && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <button
                onClick={handleCancelOrder}
                disabled={cancelling}
                className="w-full sm:w-auto px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium rounded-lg transition-all duration-200 disabled:cursor-not-allowed"
              >
                {cancelling ? 'Đang hủy...' : '✕ Hủy đơn hàng'}
              </button>
              <p className="text-xs text-slate-500 mt-2">* Chỉ có thể hủy khi đơn hàng đang chờ xác nhận</p>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Products */}
          <Card>
            <CardBody>
              <div className="mb-4 text-lg font-semibold">Sản phẩm</div>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {order.items && order.items.map(it => (
                  <div key={it.id} className="flex items-center gap-4 py-4">
                    <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded bg-slate-100">
                      {it.product_image && (
                        <img 
                          src={it.product_image.startsWith('/') ? `${import.meta.env.VITE_API_BASE || 'http://localhost:8080'}${it.product_image}` : it.product_image} 
                          alt={it.product_name || `SP #${it.product_id}`} 
                          className="h-full w-full object-cover" 
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">{it.product_name || `Sản phẩm #${it.product_id}`}</div>
                      <div className="text-sm text-slate-500 mt-1">
                        Số lượng: <span className="font-medium">{it.quantity}</span>
                        {it.product_stock !== undefined && (
                          <> | Tồn kho: <span className="font-medium">{it.product_stock}</span></>
                        )}
                      </div>
                      <div className="text-sm text-slate-900 mt-1">
                        Đơn giá: {(it.price_cents || 0).toLocaleString('vi-VN')} ₫ × {it.quantity}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-slate-900">{(it.subtotal_cents || 0).toLocaleString('vi-VN')} ₫</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Order Status History */}
          {statusHistory.length > 0 && (
            <Card>
              <CardBody>
                <div className="mb-4 text-lg font-semibold">Lịch sử trạng thái đơn hàng</div>
                <div className="space-y-3">
                  {statusHistory.map((history, idx) => (
                    <div key={history.id} className="flex items-start gap-4 pb-3 border-b border-slate-200 dark:border-slate-700 last:border-0">
                      <div className="flex-shrink-0 mt-1">
                        <div className={`w-3 h-3 rounded-full ${idx === 0 ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium border ${statusColors[history.new_status] || 'bg-slate-100 text-slate-700'}`}>
                            {statusLabels[history.new_status] || history.new_status}
                          </span>
                          {history.old_status && (
                            <>
                              <span className="text-slate-400">←</span>
                              <span className="text-xs text-slate-500 line-through">
                                {statusLabels[history.old_status] || history.old_status}
                              </span>
                            </>
                          )}
                        </div>
                        {history.notes && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{history.notes}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                          <span>{new Date(history.created_at).toLocaleString('vi-VN')}</span>
                          {history.changed_by && history.changed_by !== 'SYSTEM' && (
                            <>
                              <span>•</span>
                              <span>{history.changed_by.startsWith('ADMIN_') ? 'Quản trị viên' : history.changed_by.startsWith('USER_') ? 'Người dùng' : history.changed_by}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {/* Shipping Address */}
          <Card>
            <CardBody>
              <div className="mb-4 text-lg font-semibold">Địa chỉ giao hàng</div>
              <div className="space-y-2 text-sm">
                <div className="flex">
                  <span className="text-slate-500 w-32">Người nhận:</span>
                  <span className="font-medium">{order.shipping_name || '-'}</span>
                </div>
                <div className="flex">
                  <span className="text-slate-500 w-32">Điện thoại:</span>
                  <span className="font-medium">{order.shipping_phone || '-'}</span>
                </div>
                {order.shipping_email && (
                  <div className="flex">
                    <span className="text-slate-500 w-32">Email:</span>
                    <span className="font-medium">{order.shipping_email}</span>
                  </div>
                )}
                <div className="flex">
                  <span className="text-slate-500 w-32">Địa chỉ:</span>
                  <span className="font-medium">
                    {[order.shipping_address, order.shipping_ward, order.shipping_district, order.shipping_province].filter(Boolean).join(', ') || '-'}
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Order Summary */}
        <div>
          <Card>
            <CardBody>
              <div className="mb-4 text-lg font-semibold">Chi tiết thanh toán</div>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Tạm tính:</span>
                  <span className="font-medium">{subtotal.toLocaleString('vi-VN')} ₫</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-slate-600">Phí vận chuyển:</span>
                  <span className="font-medium">{shippingFee.toLocaleString('vi-VN')} ₫</span>
                </div>
                
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Giảm giá:</span>
                    <span className="font-medium">-{discount.toLocaleString('vi-VN')} ₫</span>
                  </div>
                )}
                
                <div className="pt-3 border-t border-slate-200 flex justify-between">
                  <span className="font-semibold">Tổng cộng:</span>
                  <span className="font-bold text-lg text-primary">{total.toLocaleString('vi-VN')} ₫</span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="text-sm">
                  <div className="text-slate-500 mb-2">Phương thức thanh toán</div>
                  <div className="font-medium">{paymentMethodLabels[order.payment_method] || order.payment_method}</div>
                </div>
              </div>

              {order.tracking_number && (
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <div className="text-sm">
                    <div className="text-slate-500 mb-2">Mã vận đơn</div>
                    <div className="font-mono text-sm bg-slate-50 px-3 py-2 rounded border border-slate-200">
                      {order.tracking_number}
                    </div>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </main>
  )
}
