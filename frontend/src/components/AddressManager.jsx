import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FaPlus, FaEdit, FaTrash, FaStar, FaRegStar } from 'react-icons/fa'

export default function AddressManager({ api }) {
  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    label: '',
    recipientName: '',
    phone: '',
    address: '',
    city: '',
    district: '',
    ward: '',
    isDefault: false
  })

  useEffect(() => {
    loadAddresses()
  }, [])

  async function loadAddresses() {
    try {
      const { data } = await api.get('/auth/addresses')
      setAddresses(data.addresses || [])
    } catch (e) {
      console.error('Failed to load addresses:', e)
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setFormData({
      label: '',
      recipientName: '',
      phone: '',
      address: '',
      city: '',
      district: '',
      ward: '',
      isDefault: false
    })
    setEditingId(null)
    setShowForm(false)
  }

  function startEdit(addr) {
    setFormData({
      label: addr.label || '',
      recipientName: addr.recipient_name,
      phone: addr.phone,
      address: addr.address,
      city: addr.city,
      district: addr.district || '',
      ward: addr.ward || '',
      isDefault: addr.is_default === 1
    })
    setEditingId(addr.id)
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      if (editingId) {
        await api.patch(`/auth/addresses/${editingId}`, formData)
      } else {
        await api.post('/auth/addresses', formData)
      }
      await loadAddresses()
      resetForm()
    } catch (e) {
      alert('Lỗi: ' + (e.response?.data?.error || 'Không thể lưu địa chỉ'))
    }
  }

  async function handleDelete(id) {
    if (!confirm('Bạn có chắc muốn xóa địa chỉ này?')) return
    try {
      await api.delete(`/auth/addresses/${id}`)
      await loadAddresses()
    } catch (e) {
      alert('Không thể xóa địa chỉ')
    }
  }

  async function setDefault(id) {
    try {
      await api.patch(`/auth/addresses/${id}`, { isDefault: true })
      await loadAddresses()
    } catch (e) {
      alert('Không thể đặt làm mặc định')
    }
  }

  if (loading) {
    return <div className="text-center py-8">Đang tải...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Địa chỉ giao hàng
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <FaPlus /> Thêm địa chỉ mới
        </button>
      </div>

      {/* Address Form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 space-y-4"
          >
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">
              {editingId ? 'Chỉnh sửa địa chỉ' : 'Thêm địa chỉ mới'}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nhãn (tùy chọn)
                </label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                  placeholder="VD: Nhà riêng, Văn phòng"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Người nhận *
                </label>
                <input
                  type="text"
                  required
                  value={formData.recipientName}
                  onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                  placeholder="Họ tên người nhận"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Số điện thoại *
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                  placeholder="0123456789"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Thành phố *
                </label>
                <input
                  type="text"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                  placeholder="TP. Hồ Chí Minh"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Quận/Huyện
                </label>
                <input
                  type="text"
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                  placeholder="Quận 1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Phường/Xã
                </label>
                <input
                  type="text"
                  value={formData.ward}
                  onChange={(e) => setFormData({ ...formData, ward: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                  placeholder="Phường Bến Nghé"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Địa chỉ chi tiết *
                </label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                  placeholder="Số nhà, tên đường"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="h-4 w-4 text-primary border-slate-300 rounded"
              />
              <label htmlFor="isDefault" className="text-sm text-slate-700 dark:text-slate-300">
                Đặt làm địa chỉ mặc định
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                {editingId ? 'Cập nhật' : 'Thêm địa chỉ'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Hủy
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Address List */}
      <div className="space-y-3">
        {addresses.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            Chưa có địa chỉ giao hàng nào. Thêm địa chỉ mới ngay!
          </div>
        ) : (
          addresses.map((addr) => (
            <motion.div
              key={addr.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {addr.label && (
                      <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-semibold rounded">
                        {addr.label}
                      </span>
                    )}
                    {addr.is_default === 1 && (
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold rounded flex items-center gap-1">
                        <FaStar size={10} /> Mặc định
                      </span>
                    )}
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                    {addr.recipient_name}
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {addr.phone}
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-2">
                    {addr.address}
                    {addr.ward && `, ${addr.ward}`}
                    {addr.district && `, ${addr.district}`}
                    {addr.city && `, ${addr.city}`}
                  </p>
                </div>

                <div className="flex gap-2">
                  {addr.is_default !== 1 && (
                    <button
                      onClick={() => setDefault(addr.id)}
                      className="p-2 text-slate-400 hover:text-yellow-500 transition-colors"
                      title="Đặt làm mặc định"
                    >
                      <FaRegStar size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => startEdit(addr)}
                    className="p-2 text-slate-400 hover:text-blue-500 transition-colors"
                    title="Chỉnh sửa"
                  >
                    <FaEdit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(addr.id)}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    title="Xóa"
                  >
                    <FaTrash size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
