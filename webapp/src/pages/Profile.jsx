import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getCurrentUser } from '../services/auth'
import { getLoyaltyPoints } from '../services/orders'

export default function Profile() {
  const { api, token, logout } = useAuth()
  const navigate = useNavigate()
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fullName, setFullName] = useState('')
  const [pw, setPw] = useState({ current: '', next: '' })
  const [saving, setSaving] = useState(false)
  const [loyalty, setLoyalty] = useState(null)
  const [activeTab, setActiveTab] = useState('info')

  useEffect(() => {
    if (!token) { navigate('/login'); return }
    getCurrentUser(api).then((u) => { setMe(u); setFullName(u?.fullName || '') }).finally(() => setLoading(false))
    getLoyaltyPoints(api).then(setLoyalty).catch(() => setLoyalty({ points_cents: 0, points_value_vnd: 0 }))
  }, [api, token])

  if (loading) return <main className="container-page py-10"><p>Loading...</p></main>

  const pointsCents = loyalty?.points_cents || 0
  const pointsValue = loyalty?.points_value_vnd || 0

  const tabs = [
    { id: 'info', label: 'Thông tin tài khoản', icon: '👤' },
    { id: 'points', label: 'Điểm tích lũy', icon: '💰' },
    { id: 'profile', label: 'Cập nhật hồ sơ', icon: '✏️' },
    { id: 'actions', label: 'Hành động nhanh', icon: '⚡' }
  ]

  return (
    <main className="container-page py-10">
      <h1 className="heading-section mb-6">Tài khoản</h1>
      {!me ? (
        <p className="text-slate-600">Không tải được thông tin tài khoản.</p>
      ) : (
        <div className="card overflow-hidden">
          {/* Tab Navigation */}
          <div className="border-b border-slate-200 bg-slate-50">
            <div className="flex flex-wrap gap-1 p-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-white text-blue-600 shadow-sm border border-blue-200'
                      : 'text-slate-600 hover:text-blue-600 hover:bg-white/50'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Tab 1: Thông tin tài khoản */}
            {activeTab === 'info' && (
              <div className="max-w-2xl">
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-200">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white text-2xl font-semibold">
                    {me.fullName?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div className="text-sm text-slate-500 mb-1">Xin chào</div>
                    <div className="text-2xl font-semibold">{me.fullName}</div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-slate-100">
                    <span className="text-slate-600">Email</span>
                    <span className="font-medium">{me.email}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-slate-100">
                    <span className="text-slate-600">Quyền</span>
                    <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium">
                      {me.role}
                    </span>
                  </div>
                  <div className="pt-4">
                    <button 
                      onClick={() => { logout(); navigate('/') }} 
                      className="btn btn-outline w-full sm:w-auto rounded-xl"
                    >
                      Đăng xuất
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Điểm tích lũy */}
            {activeTab === 'points' && (
              <div className="max-w-2xl">
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-6 mb-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-slate-900">Điểm tích lũy của bạn</h3>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-white">
                      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="mb-6">
                    <div className="text-4xl font-bold text-amber-700 mb-2">
                      {pointsCents.toLocaleString()} điểm
                    </div>
                    <div className="text-lg text-slate-700">
                      Tương đương <span className="font-semibold text-amber-700">{(pointsValue/100).toLocaleString()} ₫</span>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm text-slate-700 border-t border-amber-200 pt-4">
                    <div className="flex items-center gap-3">
                      <svg className="h-5 w-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Tích lũy 10% giá trị đơn hàng</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <svg className="h-5 w-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Dùng ngay khi thanh toán, không giới hạn</span>
                    </div>
                  </div>
                </div>
                <Link 
                  to="/orders" 
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 text-white font-medium hover:bg-amber-600 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Xem lịch sử tích điểm
                </Link>
              </div>
            )}

            {/* Tab 3: Cập nhật hồ sơ */}
            {activeTab === 'profile' && (
              <div className="max-w-2xl space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Cập nhật thông tin cá nhân</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-2 block">Họ và tên</label>
                      <input 
                        className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" 
                        value={fullName} 
                        onChange={(e)=>setFullName(e.target.value)} 
                        placeholder="Nhập họ và tên"
                      />
                      <button 
                        disabled={saving || fullName.trim().length<2} 
                        onClick={async()=>{ 
                          setSaving(true); 
                          try { 
                            await api.patch('/auth/me', { fullName }); 
                            const u = await getCurrentUser(api); 
                            setMe(u);
                            setFullName(u?.fullName || '');
                            alert('Cập nhật thành công!');
                          } catch(e) {
                            alert(e?.response?.data?.error || 'Có lỗi xảy ra');
                          } finally { 
                            setSaving(false) 
                          } 
                        }} 
                        className="btn btn-primary mt-3 w-full sm:w-auto rounded-lg"
                      >
                        {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-lg font-semibold mb-4">Đổi mật khẩu</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-2 block">Mật khẩu hiện tại</label>
                      <input 
                        type="password" 
                        placeholder="Nhập mật khẩu hiện tại" 
                        className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" 
                        value={pw.current} 
                        onChange={(e)=>setPw({ ...pw, current: e.target.value })} 
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-2 block">Mật khẩu mới</label>
                      <input 
                        type="password" 
                        placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)" 
                        className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" 
                        value={pw.next} 
                        onChange={(e)=>setPw({ ...pw, next: e.target.value })} 
                      />
                    </div>
                    <button 
                      disabled={saving || pw.next.length<6} 
                      onClick={async()=>{ 
                        setSaving(true); 
                        try { 
                          await api.post('/auth/change-password', { currentPassword: pw.current, newPassword: pw.next }); 
                          setPw({ current:'', next:'' });
                          alert('Đổi mật khẩu thành công!');
                        } catch(e) {
                          alert(e?.response?.data?.error || 'Có lỗi xảy ra');
                        } finally { 
                          setSaving(false) 
                        } 
                      }} 
                      className="btn btn-outline w-full sm:w-auto rounded-lg"
                    >
                      {saving ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Hành động nhanh */}
            {activeTab === 'actions' && (
              <div className="max-w-2xl">
                <h3 className="text-lg font-semibold mb-6">Hành động nhanh</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Link 
                    to="/orders" 
                    className="flex items-center gap-4 rounded-xl border-2 border-slate-200 p-5 hover:border-blue-300 hover:bg-blue-50 transition-all group"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600 group-hover:bg-blue-200">
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 group-hover:text-blue-600">Xem đơn hàng</div>
                      <div className="text-sm text-slate-500">Theo dõi và quản lý đơn hàng</div>
                    </div>
                  </Link>
                  <Link 
                    to="/cart" 
                    className="flex items-center gap-4 rounded-xl border-2 border-slate-200 p-5 hover:border-blue-300 hover:bg-blue-50 transition-all group"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600 group-hover:bg-blue-200">
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5 17H2m5 4a1 1 0 100-2 1 1 0 000 2zm12 0a1 1 0 100-2 1 1 0 000 2z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 group-hover:text-blue-600">Mở giỏ hàng</div>
                      <div className="text-sm text-slate-500">Xem và chỉnh sửa giỏ hàng</div>
                    </div>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}


