import React, { useEffect, useState } from 'react'
import { IoClose } from 'react-icons/io5'
import { FaCartShopping, FaTrash } from 'react-icons/fa6'
import { FaUser } from 'react-icons/fa'
import Button from './Button'
import { useAuth } from '../../context/AuthContext.jsx'
import { fetchCart, removeCartItem } from '../../services/cart'

const SideCart = ({ isOpen, onClose }) => {
  const { user, api, token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cart, setCart] = useState({ id: null, items: [] });

  useEffect(() => {
    const load = async () => {
      if (!isOpen || !token) return;
      try {
        setError('');
        setLoading(true);
        const data = await fetchCart(api);
        setCart({ id: data.id, items: data.items || [] });
      } catch (e) {
        setError(e.message || 'Lỗi tải giỏ hàng');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, token, api]);

  const handleRemove = async (itemId) => {
    if (!token) return;
    try {
      await removeCartItem(api, { itemId });
      setCart((c) => ({ ...c, items: c.items.filter(it => it.id !== itemId) }));
    } catch (e) {
      alert(e.message || 'Không thể xóa');
    }
  };

  const totalPrice = (cart.items || []).reduce((total, item) => total + (item.price_cents_snapshot * item.quantity), 0)

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[100] transition-opacity duration-300"
          onClick={onClose}
        />
      )}
      
      {/* Side Cart */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl z-[101] transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <h2 className="text-5xl font-normal font-bitcount">Shopping Cart</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors duration-200"
          >
            <IoClose className="text-xl text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!user ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <FaUser className="text-5xl text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-2">Vui lòng đăng nhập để xem giỏ hàng</h3>
              <a href="/login" className="text-primary font-semibold hover:underline">Đăng nhập</a>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-center text-gray-500 dark:text-gray-400">Đang tải giỏ hàng...</div>
          ) : (cart.items || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <FaCartShopping className="text-6xl text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-2">Your cart is empty</h3>
              <p className="text-gray-400 dark:text-gray-500">Add some items to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(cart.items || []).map((item) => (
                <div key={item.id} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="w-16 h-16 bg-white dark:bg-gray-900 rounded-md flex items-center justify-center text-sm text-gray-400">#{item.product_id}</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Product {item.product_id}</h3>
                    <p className="text-primary font-bold">{(item.price_cents_snapshot/100).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2">x{item.quantity}</span>
                    </div>
                  </div>
                  <button className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors" onClick={() => handleRemove(item.id)}>
                    <FaTrash className="text-sm" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {user && (cart.items || []).length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold text-gray-900 dark:text-white">Total:</span>
              <span className="text-2xl font-normal text-primary font-bitcount">{(totalPrice/100).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}</span>
            </div>
            <div className="space-y-3">
              <Button 
                text="Checkout" 
                bgColor="bg-primary" 
                textColor="text-white" 
                handler={() => {}} 
              />
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default SideCart
