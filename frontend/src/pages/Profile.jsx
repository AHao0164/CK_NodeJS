import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getCurrentUser, getAddresses, createAddress, deleteAddress, setDefaultAddress } from '../services/auth'
import { motion } from 'framer-motion'
import { useToast } from '../ui/Toast'
import { getProvinces, getWards } from '../constants/vietnamLocations'
import VI from '../constants/vi'

export default function Profile() {
  const { api, token, logout, login } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const [profile, setProfile] = useState({
    fullName: '',
    phone: '',
    province: '',
    ward: '',
    address_detail: ''
  })
  const [addresses, setAddresses] = useState([])
  const [addrLoading, setAddrLoading] = useState(false)
  const [addrForm, setAddrForm] = useState({
    fullName: '',
    phone: '',
    province: '',
    ward: '',
    addressDetail: ''
  })
  const [isAddingAddress, setIsAddingAddress] = useState(false)
  const [pw, setPw] = useState({ current: '', next: '' })
  const [saving, setSaving] = useState(false)
  const [loyaltyPoints, setLoyaltyPoints] = useState(0)
  const [pointsHistory, setPointsHistory] = useState([])
  const [showPointsHistory, setShowPointsHistory] = useState(false)

  useEffect(() => {
    document.title = 'Hồ sơ cá nhân - GearUp';
  }, []);

  useEffect(() => {
    if (!token) { navigate('/login'); return }
    const load = async () => {
      try {
        const [u, addrList, pointsData, historyData] = await Promise.all([
          getCurrentUser(api),
          getAddresses(api).catch(() => []),
          api.get('/auth/loyalty-points').then(r => r.data).catch(() => ({ points: 0, pointsValue: 0 })),
          api.get('/auth/loyalty-points/history').then(r => r.data).catch(() => ({ history: [] }))
        ])
        setMe(u)
        setProfile({
          fullName: u?.fullname || u?.fullName || '',
          phone: u?.phone || '',
          province: u?.city || u?.province || '',
          ward: u?.ward || '',
          address_detail: u?.address || u?.address_detail || ''
        })
        setAddresses(Array.isArray(addrList) ? addrList : [])
        setLoyaltyPoints(pointsData?.points || 0)
        setPointsHistory(Array.isArray(historyData?.history) ? historyData.history : [])
      } catch (e) {
        console.error('Load profile error:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [api, token, navigate])

  const handleAddAddress = async () => {
    if (!addrForm.fullName.trim() || !addrForm.phone.trim() || !addrForm.province || !addrForm.ward || !addrForm.addressDetail.trim()) {
      toast.show('❌ Vui lòng nhập đầy đủ thông tin địa chỉ', { type: 'error' })
      return
    }
    const cleanPhone = addrForm.phone.replace(/\s+/g, '')
    if (!/^\d{10,11}$/.test(cleanPhone)) {
      toast.show('❌ Số điện thoại phải có 10-11 chữ số', { type: 'error' })
      return
    }
    setAddrLoading(true)
    try {
      const created = await createAddress(api, {
        fullName: addrForm.fullName.trim(),
        phone: cleanPhone,
        province: addrForm.province,
        ward: addrForm.ward,
        addressDetail: addrForm.addressDetail.trim(),
        isDefault: addresses.length === 0 // địa chỉ đầu tiên là mặc định
      })
      const refreshed = await getAddresses(api).catch(() => [])
      setAddresses(Array.isArray(refreshed) ? refreshed : [...addresses, created])
      // Nếu là địa chỉ mặc định mới, cập nhật profile hiển thị
      if (created.isDefault) {
        setProfile(prev => ({
          ...prev,
          fullName: created.fullName || prev.fullName,
          phone: created.phone || prev.phone,
          province: created.province || prev.province,
          ward: created.ward || prev.ward,
          address_detail: created.addressDetail || prev.address_detail
        }))
      }
      setAddrForm({
        fullName: '',
        phone: '',
        province: '',
        ward: '',
        addressDetail: ''
      })
      setIsAddingAddress(false)
      toast.show('✅ Thêm địa chỉ mới thành công', { type: 'success' })
    } catch (err) {
      console.error('Create address error:', err)
      const msg = err?.response?.data?.error || 'Không thể thêm địa chỉ mới'
      toast.show(`❌ ${msg}`, { type: 'error' })
    } finally {
      setAddrLoading(false)
    }
  }

  const handleDeleteAddress = async (id, isDefault) => {
    if (!window.confirm('Bạn có chắc muốn xóa địa chỉ này?')) return
    setAddrLoading(true)
    try {
      await deleteAddress(api, id)
      const refreshed = await getAddresses(api).catch(() => [])
      setAddresses(Array.isArray(refreshed) ? refreshed : addresses.filter(a => a.id !== id))
      // Nếu xóa địa chỉ mặc định, backend đã tự chọn địa chỉ khác, nên refetch là đủ
      toast.show('✅ Đã xóa địa chỉ', { type: 'success' })
    } catch (err) {
      console.error('Delete address error:', err)
      const msg = err?.response?.data?.error || 'Không thể xóa địa chỉ'
      toast.show(`❌ ${msg}`, { type: 'error' })
    } finally {
      setAddrLoading(false)
    }
  }

  const handleSetDefaultAddress = async (id) => {
    setAddrLoading(true)
    try {
      await setDefaultAddress(api, id)
      const refreshed = await getAddresses(api).catch(() => [])
      setAddresses(Array.isArray(refreshed) ? refreshed : addresses)
      // Đồng bộ profile từ địa chỉ mặc định mới
      const def = Array.isArray(refreshed) ? refreshed.find(a => a.isDefault) : null
      if (def) {
        setProfile(prev => ({
          ...prev,
          fullName: def.fullName || prev.fullName,
          phone: def.phone || prev.phone,
          province: def.province || prev.province,
          ward: def.ward || prev.ward,
          address_detail: def.addressDetail || prev.address_detail
        }))
      }
      toast.show('✅ Đã đặt làm địa chỉ mặc định', { type: 'success' })
    } catch (err) {
      console.error('Set default address error:', err)
      const msg = err?.response?.data?.error || 'Không thể đặt địa chỉ mặc định'
      toast.show(`❌ ${msg}`, { type: 'error' })
    } finally {
      setAddrLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10">
        <p>{VI.common.loading}</p>
      </main>
    )
  }

  if (!me) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-bitcount"
        >
          {VI.common.profile}
        </motion.h1>
        <p className="text-slate-600 dark:text-slate-400">Không thể tải thông tin tài khoản.</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <motion.h1 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-bitcount"
      >
        {VI.common.profile}
      </motion.h1>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white text-xl font-bitcount">
                {profile.fullName?.[0]?.toUpperCase() || me.fullName?.[0]?.toUpperCase() || 'U'}
              </div>
              <div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Xin chào</div>
                <div className="text-lg font-semibold dark:text-slate-100">{profile.fullName || me.fullName}</div>
              </div>
            </div>
            
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Email</div>
                <div className="font-medium dark:text-slate-200">{me.email}</div>
              </div>
              
              {profile.phone && (
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Số điện thoại</div>
                  <div className="font-medium dark:text-slate-200">{profile.phone}</div>
                </div>
              )}
              
              {(profile.address_detail || profile.ward || profile.province) && (
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Địa chỉ</div>
                  <div className="font-medium dark:text-slate-200 text-xs leading-relaxed">
                    {profile.address_detail && <div>{profile.address_detail}</div>}
                    {profile.ward && <div>{profile.ward}</div>}
                    {profile.province && <div>{profile.province}</div>}
                  </div>
                </div>
              )}
            </div>
            
            <button 
              onClick={() => setLogoutConfirm(true)} 
              className="btn btn-outline mt-6 w-full rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-300 dark:hover:bg-red-900/20 transition-colors"
            >
              {VI.auth.logout}
            </button>
            
            {/* Logout Confirmation Dialog */}
            {logoutConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm mx-4">
                  <h3 className="text-xl font-bold mb-3 text-gray-800 dark:text-white">Xác nhận đăng xuất</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-6">Bạn có chắc chắn muốn đăng xuất?</p>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setLogoutConfirm(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      Hủy
                    </button>
                    <button 
                      onClick={() => { logout(); navigate('/') }}
                      className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      Đăng xuất
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="lg:col-span-2 space-y-6">
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">Thông tin cá nhân</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Họ và tên</label>
                <input 
                  type="text"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent" 
                  value={profile.fullName} 
                  onChange={(e)=>setProfile({ ...profile, fullName: e.target.value })} 
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Số điện thoại</label>
                <input 
                  type="tel"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent" 
                  value={profile.phone} 
                  onChange={(e)=>setProfile({ ...profile, phone: e.target.value })} 
                  placeholder="0912345678"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Tỉnh/Thành phố</label>
                <select 
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-slate-800"
                  value={profile.province}
                  onChange={(e)=>setProfile({ ...profile, province: e.target.value })}
                >
                  <option value="">Chọn tỉnh/thành phố</option>
                  {getProvinces().map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Phường/Xã</label>
                {profile.province && getWards(profile.province).length > 0 ? (
                  <select 
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-slate-800"
                    value={profile.ward}
                    onChange={(e)=>setProfile({ ...profile, ward: e.target.value })}
                  >
                    <option value="">Chọn phường/xã</option>
                    {getWards(profile.province).map(ward => (
                      <option key={ward} value={ward}>{ward}</option>
                    ))}
                  </select>
                ) : (
                  <input 
                    type="text"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent" 
                    value={profile.ward} 
                    onChange={(e)=>setProfile({ ...profile, ward: e.target.value })} 
                    placeholder="Nhập phường/xã"
                  />
                )}
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Địa chỉ chi tiết</label>
                <input 
                  type="text"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent" 
                  value={profile.address_detail} 
                  onChange={(e)=>setProfile({ ...profile, address_detail: e.target.value })} 
                  placeholder="VD: Số 123, đường Nguyễn Huệ"
                />
              </div>
            </div>

            <button 
              disabled={saving || profile.fullName.trim().length < 2} 
              onClick={async()=>{ 
                setSaving(true)
                try {
                  // Clean phone number
                  const cleanPhone = profile.phone.replace(/\s+/g, '')
                  if (cleanPhone && !/^\d{10,11}$/.test(cleanPhone)) {
                    toast.show('❌ Số điện thoại phải có 10-11 chữ số', { type: 'error' })
                    setSaving(false)
                    return
                  }
                  
                  await api.patch('/auth/profile', { 
                    fullName: profile.fullName.trim(),
                    phone: cleanPhone || undefined,
                    province: profile.province || undefined,
                    ward: profile.ward || undefined,
                    addressDetail: profile.address_detail.trim() || undefined
                  })
                  const u = await getCurrentUser(api)
                  setMe(u)
                  login(token, u) // Update user in AuthContext
                  toast.show('✅ Cập nhật thông tin thành công!', { type: 'success' })
                } catch (err) {
                  console.error('Update error:', err)
                  const msg = err?.response?.data?.error || 'Có lỗi khi cập nhật thông tin'
                  toast.show(`❌ ${msg}`, { type: 'error' })
                } finally { 
                  setSaving(false) 
                } 
              }} 
              className="btn btn-primary rounded-lg px-6 py-2.5 w-full md:w-auto"
            >
              {saving ? 'Đang lưu...' : 'Lưu thông tin'}
            </button>
            </div>

            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">Đổi mật khẩu</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Mật khẩu hiện tại</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent" 
                  value={pw.current} 
                  onChange={(e)=>setPw({ ...pw, current: e.target.value })} 
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Mật khẩu mới</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent" 
                  value={pw.next} 
                  onChange={(e)=>setPw({ ...pw, next: e.target.value })} 
                />
              </div>
            </div>

            <button 
              disabled={saving || pw.next.length < 6 || !pw.current} 
              onClick={async()=>{ 
                setSaving(true)
                try { 
                  await api.post('/auth/change-password', { 
                    currentPassword: pw.current.trim(), 
                    newPassword: pw.next.trim() 
                  })
                  setPw({ current:'', next:'' })
                  toast.show('✅ Đổi mật khẩu thành công!', { type: 'success' })
                } catch (err) {
                  toast.show('❌ Mật khẩu hiện tại không đúng', { type: 'error' })
                } finally { 
                  setSaving(false) 
                } 
              }} 
              className="btn btn-outline rounded-lg px-6 py-2.5 w-full md:w-auto"
            >
              {saving ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
            </button>
            </div>

            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941a3.37 3.37 0 01-.448-.08 4.507 4.507 0 01-3.187-3.188C5.716 10.163 5 9.262 5 8c0-1.262.716-2.163 1.228-2.661a4.507 4.507 0 013.187-3.188A3.37 3.37 0 019 2V1a1 1 0 012 0v.092a4.535 4.535 0 001.676.662C13.398 2.766 14 3.991 14 5c0 .99-.602 1.765-1.324 2.246A4.535 4.535 0 0111 7.908v1.941a3.37 3.37 0 01.448.08 4.507 4.507 0 013.187 3.188C15.284 13.837 16 14.738 16 16c0 1.262-.716 2.163-1.228 2.661a4.507 4.507 0 01-3.187 3.188 3.37 3.37 0 01-.448.08V19a1 1 0 10-2 0v-.092a4.535 4.535 0 00-1.676-.662C6.602 17.234 6 16.009 6 15c0-.99.602-1.765 1.324-2.246A4.535 4.535 0 019 12.092v-1.941a3.37 3.37 0 01-.448-.08 4.507 4.507 0 01-3.187-3.188C4.716 6.163 4 5.262 4 4c0-1.262.716-2.163 1.228-2.661a4.507 4.507 0 013.187-3.188A3.37 3.37 0 019 1V0a1 1 0 012 0v.092a4.535 4.535 0 001.676.662C14.398 2.766 15 3.991 15 5c0 .99-.602 1.765-1.324 2.246A4.535 4.535 0 0113 7.908v1.941a3.37 3.37 0 01.448.08 4.507 4.507 0 013.187 3.188C17.284 13.837 18 14.738 18 16c0 1.262-.716 2.163-1.228 2.661a4.507 4.507 0 01-3.187 3.188 3.37 3.37 0 01-.448.08V19a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C19.398 17.234 20 16.009 20 15c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0117 12.092v-1.941a3.37 3.37 0 01.448-.08 4.507 4.507 0 013.187-3.188C21.284 6.163 22 5.262 22 4c0-1.262-.716-2.163-1.228-2.661z" clipRule="evenodd" />
                </svg>
                Điểm thưởng
              </h3>
              
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 mb-4 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Số điểm hiện có</div>
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {loyaltyPoints.toLocaleString('vi-VN')}
                      <span className="text-lg ml-1 text-slate-500 dark:text-slate-400">điểm</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Giá trị tương đương</div>
                    <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                      {(loyaltyPoints * 1000).toLocaleString('vi-VN')}₫
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                  <div className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                    <strong>Quy đổi:</strong> 1 điểm = 1,000₫
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    <strong>Tích lũy:</strong> 10% giá trị đơn hàng = điểm thưởng
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowPointsHistory(!showPointsHistory)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {showPointsHistory ? 'Ẩn' : 'Xem'} lịch sử điểm thưởng
              </button>

              {showPointsHistory && (
                <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                  {pointsHistory.length === 0 ? (
                    <div className="text-center py-8 text-sm text-slate-500 dark:text-slate-400">
                      Chưa có lịch sử điểm thưởng
                    </div>
                  ) : (
                    pointsHistory.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          item.type === 'EARNED'
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                            : item.type === 'USED'
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                              item.type === 'EARNED'
                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                : item.type === 'USED'
                                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                            }`}>
                              {item.type === 'EARNED' ? 'Tích lũy' : item.type === 'USED' ? 'Sử dụng' : 'Hết hạn'}
                            </span>
                            {item.order_id && (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                Đơn #{item.order_id}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            {item.description || 'Không có mô tả'}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                            {new Date(item.created_at).toLocaleString('vi-VN', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                        <div className={`text-lg font-bold ${
                          item.type === 'EARNED'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : item.type === 'USED'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}>
                          {item.type === 'EARNED' ? '+' : '-'}{Math.abs(item.points).toLocaleString('vi-VN')}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">Địa chỉ giao hàng</h3>
              {addresses.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  Bạn chưa có địa chỉ giao hàng nào. Hãy thêm ít nhất một địa chỉ để sử dụng khi đặt hàng.
                </p>
              )}
              <div className="space-y-3">
                {addresses.map(addr => (
                  <div
                    key={addr.id}
                    className={`flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
                      addr.isDefault
                        ? 'border-primary bg-primary/5 dark:border-primary/80'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold dark:text-slate-100">
                          {addr.fullName}
                        </span>
                        {addr.isDefault && (
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            Mặc định
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        <div>SĐT: {addr.phone}</div>
                        <div className="mt-0.5">
                          {[addr.addressDetail, addr.ward, addr.province].filter(Boolean).join(', ')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-start md:self-auto">
                      {!addr.isDefault && (
                        <button
                          onClick={() => handleSetDefaultAddress(addr.id)}
                          className="px-3 py-1.5 rounded-lg border border-primary text-primary text-xs font-medium hover:bg-primary/5 transition-colors"
                          disabled={addrLoading}
                        >
                          Đặt làm mặc định
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteAddress(addr.id, addr.isDefault)}
                        className="px-3 py-1.5 rounded-lg border border-red-400 text-red-500 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        disabled={addrLoading}
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-4">
                {!isAddingAddress ? (
                  <button
                    onClick={() => setIsAddingAddress(true)}
                    className="px-4 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    + Thêm địa chỉ mới
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Họ và tên</label>
                        <input
                          type="text"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                          value={addrForm.fullName}
                          onChange={(e) => setAddrForm({ ...addrForm, fullName: e.target.value })}
                          placeholder="Nguyễn Văn B"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Số điện thoại</label>
                        <input
                          type="tel"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                          value={addrForm.phone}
                          onChange={(e) => setAddrForm({ ...addrForm, phone: e.target.value })}
                          placeholder="0912345678"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Tỉnh/Thành phố</label>
                        <select
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-slate-800"
                          value={addrForm.province}
                          onChange={(e) => setAddrForm({ ...addrForm, province: e.target.value, ward: '' })}
                        >
                          <option value="">Chọn tỉnh/thành phố</option>
                          {getProvinces().map(city => (
                            <option key={city} value={city}>{city}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Phường/Xã</label>
                        {addrForm.province && getWards(addrForm.province).length > 0 ? (
                          <select
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-slate-800"
                            value={addrForm.ward}
                            onChange={(e) => setAddrForm({ ...addrForm, ward: e.target.value })}
                          >
                            <option value="">Chọn phường/xã</option>
                            {getWards(addrForm.province).map(ward => (
                              <option key={ward} value={ward}>{ward}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                            value={addrForm.ward}
                            onChange={(e) => setAddrForm({ ...addrForm, ward: e.target.value })}
                            placeholder="Nhập phường/xã"
                          />
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Địa chỉ chi tiết</label>
                      <input
                        type="text"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                        value={addrForm.addressDetail}
                        onChange={(e) => setAddrForm({ ...addrForm, addressDetail: e.target.value })}
                        placeholder="VD: Số 123, đường Nguyễn Huệ"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => { setIsAddingAddress(false); setAddrForm({ fullName: '', phone: '', province: '', ward: '', addressDetail: '' }) }}
                        className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        disabled={addrLoading}
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={handleAddAddress}
                        className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                        disabled={addrLoading}
                      >
                        {addrLoading ? 'Đang lưu...' : 'Lưu địa chỉ'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">Hành động nhanh</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <a href="/orders" className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-3">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span className="font-medium">Xem đơn hàng</span>
              </a>
              <a href="/cart" className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-3">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="font-medium">Mở giỏ hàng</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

