import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getCurrentUser } from '../services/auth'

export default function Profile() {
  const { api, token, logout } = useAuth()
  const navigate = useNavigate()
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fullName, setFullName] = useState('')
  const [pw, setPw] = useState({ current: '', next: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!token) { navigate('/login'); return }
    getCurrentUser(api).then((u) => { setMe(u); setFullName(u?.fullName || '') }).finally(() => setLoading(false))
  }, [api, token])

  if (loading) return <main className="container-page py-10"><p>Loading...</p></main>

  return (
    <main className="container-page py-10">
      <h1 className="heading-section mb-6">Tài khoản</h1>
      {!me ? (
        <p className="text-slate-600">Không tải được thông tin tài khoản.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="card p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white text-lg">
                {me.fullName?.[0]?.toUpperCase() || 'U'}
              </div>
              <div>
                <div className="text-sm text-slate-500">Xin chào</div>
                <div className="text-lg font-semibold">{me.fullName}</div>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span>Email</span><span className="font-medium">{me.email}</span></div>
              <div className="flex justify-between"><span>Quyền</span><span className="font-medium">{me.role}</span></div>
            </div>
            <button onClick={() => { logout(); navigate('/') }} className="btn btn-outline mt-4 w-full rounded-xl">Đăng xuất</button>
          </div>
          <div className="md:col-span-2 card p-6">
            <div className="text-sm text-slate-500">Hành động nhanh</div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <a href="/orders" className="rounded-xl border border-slate-200 p-4 hover:bg-slate-50">Xem đơn hàng</a>
              <a href="/cart" className="rounded-xl border border-slate-200 p-4 hover:bg-slate-50">Mở giỏ hàng</a>
            </div>
            <div className="mt-6 text-sm text-slate-500">Cập nhật hồ sơ</div>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <label className="text-xs text-slate-500">Họ và tên</label>
                <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={fullName} onChange={(e)=>setFullName(e.target.value)} />
                <button disabled={saving || fullName.trim().length<2} onClick={async()=>{ setSaving(true); try { await api.patch('/auth/me', { fullName }); const u = await getCurrentUser(api); setMe(u) } finally { setSaving(false) } }} className="btn btn-primary mt-3 w-full rounded-lg">Lưu thay đổi</button>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <label className="text-xs text-slate-500">Đổi mật khẩu</label>
                <input type="password" placeholder="Mật khẩu hiện tại" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={pw.current} onChange={(e)=>setPw({ ...pw, current: e.target.value })} />
                <input type="password" placeholder="Mật khẩu mới" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={pw.next} onChange={(e)=>setPw({ ...pw, next: e.target.value })} />
                <button disabled={saving || pw.next.length<6} onClick={async()=>{ setSaving(true); try { await api.post('/auth/change-password', { currentPassword: pw.current, newPassword: pw.next }); setPw({ current:'', next:'' }) } finally { setSaving(false) } }} className="btn btn-outline mt-3 w-full rounded-lg">Cập nhật mật khẩu</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}


