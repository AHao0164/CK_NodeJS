import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getCurrentUser } from '../services/auth'
import { motion } from 'framer-motion'
import AddressManager from '../components/AddressManager'

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
  }, [api, token, navigate])

  if (loading) return <main className="mx-auto max-w-7xl px-4 py-10"><p>Loading...</p></main>

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <motion.h1 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-bitcount"
      >
        Account
      </motion.h1>
      {!me ? (
        <p className="text-slate-600">Unable to load account information.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="card p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white text-lg font-bitcount">
                {me.fullName?.[0]?.toUpperCase() || 'U'}
              </div>
              <div>
                <div className="text-sm text-slate-500">Hello</div>
                <div className="text-lg font-semibold">{me.fullName}</div>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span>Email</span><span className="font-medium">{me.email}</span></div>
              <div className="flex justify-between"><span>Role</span><span className="font-medium">{me.role}</span></div>
            </div>
            <button onClick={() => { logout(); navigate('/') }} className="btn btn-outline mt-4 w-full rounded-xl">Logout</button>
          </div>
          <div className="md:col-span-2 card p-6">
            <div className="text-sm text-slate-500">Quick Actions</div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <a href="/orders" className="rounded-xl border border-slate-200 p-4 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">View Orders</a>
              <a href="/cart" className="rounded-xl border border-slate-200 p-4 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Open Cart</a>
            </div>
            <div className="mt-6 text-sm text-slate-500">Update Profile</div>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <label className="text-xs text-slate-500">Full Name</label>
                <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700" value={fullName} onChange={(e)=>setFullName(e.target.value)} />
                <button disabled={saving || fullName.trim().length<2} onClick={async()=>{ setSaving(true); try { await api.patch('/auth/me', { fullName }); const u = await getCurrentUser(api); setMe(u) } finally { setSaving(false) } }} className="btn btn-primary mt-3 w-full rounded-lg">Save Changes</button>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <label className="text-xs text-slate-500">Change Password</label>
                <input type="password" placeholder="Current Password" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700" value={pw.current} onChange={(e)=>setPw({ ...pw, current: e.target.value })} />
                <input type="password" placeholder="New Password" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700" value={pw.next} onChange={(e)=>setPw({ ...pw, next: e.target.value })} />
                <button disabled={saving || pw.next.length<6} onClick={async()=>{ setSaving(true); try { await api.post('/auth/change-password', { currentPassword: pw.current, newPassword: pw.next }); setPw({ current:'', next:'' }) } finally { setSaving(false) } }} className="btn btn-outline mt-3 w-full rounded-lg">Update Password</button>
              </div>
            </div>
          </div>
        </div>

        {/* Address Management Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 card p-6"
        >
          <AddressManager api={api} />
        </motion.div>
      )}
    </main>
  )
}

