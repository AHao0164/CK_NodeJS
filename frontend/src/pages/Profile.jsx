import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getCurrentUser } from '../services/auth'
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
  const [pw, setPw] = useState({ current: '', next: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    document.title = 'Hồ sơ cá nhân - GearUp';
  }, []);

  useEffect(() => {
    if (!token) { navigate('/login'); return }
    getCurrentUser(api).then((u) => { 
      setMe(u)
      setProfile({
        fullName: u?.fullname || u?.fullName || '',
        phone: u?.phone || '',
        province: u?.city || u?.province || '',
        ward: u?.ward || '',
        address_detail: u?.address || u?.address_detail || ''
      })
    }).finally(() => setLoading(false))
  }, [api, token, navigate])

  if (loading) return <main className="mx-auto max-w-7xl px-4 py-10"><p>{VI.common.loading}</p></main>

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <motion.h1 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-bitcount"
      >
        {VI.common.profile}
      </motion.h1>
      {!me ? (
        <p className="text-slate-600 dark:text-slate-400">Không thể tải thông tin tài khoản.</p>
      ) : (
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
          <div className="lg:col-span-2 card p-6">
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

            <hr className="my-6 border-slate-200 dark:border-slate-700" />

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
                  await api.post('/auth/change-password', { currentPassword: pw.current, newPassword: pw.next })
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

            <hr className="my-6 border-slate-200 dark:border-slate-700" />

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
      )}
    </main>
  )
}

