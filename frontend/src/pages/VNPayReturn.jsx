import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../ui/Toast';
import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

export default function VNPayReturn() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { api } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Đang xử lý thanh toán...');

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        // 🔥 CRITICAL: Gọi backend để xác nhận thanh toán và trừ stock
        const queryString = window.location.search;
        const { data: paymentResult } = await api.get(`/payment/vnpay/return${queryString}`);
        
        console.log('Payment verification result:', paymentResult);

        if (paymentResult.success) {
          // ✅ Payment successful - BUT check order status to ensure it wasn't cancelled due to stock
          const orderId = paymentResult.data?.orderId || searchParams.get('vnp_TxnRef');
          
          // Check order status to verify it wasn't cancelled
          let orderStatus = null;
          if (orderId) {
            try {
              const { data: orderData } = await api.get(`/orders/${orderId}`);
              orderStatus = orderData?.status;
              console.log(`Order #${orderId} status after payment:`, orderStatus);
            } catch (orderErr) {
              console.warn('Could not fetch order status:', orderErr);
              // Continue with success if we can't check (non-critical)
            }
          }
          
          // If order was cancelled (likely due to stock), treat as failure
          if (orderStatus === 'CANCELLED') {
            setStatus('failed');
            setMessage('Thanh toán thành công nhưng sản phẩm đã hết hàng. Đơn hàng đã bị hủy và sẽ được hoàn tiền.');
            toast.show('⚠️ Sản phẩm đã hết hàng! Đơn hàng bị hủy, vui lòng liên hệ để hoàn tiền.', { type: 'warning', duration: 8000 });
            
            // Redirect to cart after 10 seconds
            setTimeout(() => {
              navigate('/cart');
            }, 10000);
          } else {
            // ✅ Payment successful + Order confirmed + Stock reserved
            setStatus('success');
            setMessage(paymentResult.message || 'Thanh toán thành công!');
            toast.show('✅ Thanh toán thành công!', { type: 'success' });
            
            // Clear cart
            try {
              const { data: cartData } = await api.get('/cart/items');
              for (const item of cartData.items || []) {
                await api.delete(`/cart/items/${item.id}`).catch(() => {});
              }
            } catch (err) {
              console.error('Clear cart error:', err);
            }

            // Redirect to orders page after 3 seconds
            setTimeout(() => {
              navigate('/orders');
            }, 3000);
          }
        } else {
          // ❌ Payment failed or out of stock
          setStatus('failed');
          
          // Kiểm tra nếu là lỗi hết hàng (OUT_OF_STOCK)
          if (paymentResult.code === 'OUT_OF_STOCK' && paymentResult.cancelled) {
            setMessage(paymentResult.message || 'Sản phẩm đã hết hàng. Đơn hàng đã bị hủy và sẽ được hoàn tiền.');
            toast.show('⚠️ Sản phẩm đã hết hàng! Đơn hàng bị hủy, vui lòng liên hệ để hoàn tiền.', { type: 'warning', duration: 8000 });
          } else if (paymentResult.code === '00' && paymentResult.message?.includes('hết hàng')) {
            setMessage('Thanh toán thành công nhưng sản phẩm đã hết hàng. Đơn hàng đã bị hủy và sẽ được hoàn tiền.');
            toast.show('⚠️ Sản phẩm đã hết hàng! Đơn hàng bị hủy, vui lòng liên hệ để hoàn tiền.', { type: 'warning', duration: 8000 });
          } else {
            const errorMessages = {
              '07': 'Giao dịch bị nghi ngờ (liên quan tới lừa đảo)',
              '09': 'Thẻ/Tài khoản chưa đăng ký dịch vụ InternetBanking',
              '10': 'Xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
              '11': 'Đã hết hạn chờ thanh toán',
              '12': 'Thẻ/Tài khoản bị khóa',
              '13': 'Nhập sai mật khẩu xác thực giao dịch (OTP)',
              '24': 'Khách hàng hủy giao dịch',
              '51': 'Tài khoản không đủ số dư',
              '65': 'Tài khoản đã vượt quá hạn mức giao dịch trong ngày',
              '75': 'Ngân hàng thanh toán đang bảo trì',
              '79': 'Giao dịch vượt quá số lần thất bại cho phép'
            };
            
            setMessage(paymentResult.message || errorMessages[paymentResult.code] || 'Thanh toán thất bại');
            toast.show(`❌ ${paymentResult.message || errorMessages[paymentResult.code] || 'Thanh toán thất bại'}`, { type: 'error' });
          }
          
          // Redirect to cart after 10 seconds (give user time to read and choose)
          setTimeout(() => {
            navigate('/cart');
          }, 10000);
        }
      } catch (error) {
        console.error('Verify payment error:', error);
        setStatus('failed');
        setMessage('Có lỗi xảy ra khi xác thực thanh toán');
        toast.show('❌ Có lỗi xảy ra khi xác thực thanh toán', { type: 'error' });
      }
    };

    verifyPayment();
  }, [searchParams, api, navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
        {status === 'processing' && (
          <div className="animate-pulse">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Đang xử lý thanh toán
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Vui lòng đợi...
            </p>
          </div>
        )}

        {status === 'success' && (
          <div>
            <FaCheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Thanh toán thành công!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {message}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Đang chuyển đến trang đơn hàng...
            </p>
          </div>
        )}

        {status === 'failed' && (
          <div>
            <FaTimesCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Thanh toán thất bại
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {message}
            </p>
            
            {/* Action buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => navigate('/checkout')}
                className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
              >
                Thử lại
              </button>
              <button
                onClick={() => navigate('/cart')}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Quay lại giỏ hàng
              </button>
            </div>
            
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-4">
              Tự động chuyển sau 10 giây...
            </p>
          </div>
        )}

        <div className="mt-6 text-xs text-gray-400 dark:text-gray-600">
          Mã giao dịch: {searchParams.get('vnp_TxnRef')}
        </div>
      </div>
    </div>
  );
}
