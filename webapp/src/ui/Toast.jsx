import React, { createContext, useContext, useCallback, useMemo, useState } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => setToasts(ts => ts.filter(t => t.id !== id)), [])
  const show = useCallback((message, { type = 'info', duration = 2500 } = {}) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(ts => [...ts, { id, message, type }])
    setTimeout(() => remove(id), duration)
  }, [remove])

  const value = useMemo(() => ({ show }), [show])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`rounded-lg px-4 py-2 text-sm shadow-md ${t.type==='error' ? 'bg-red-600 text-white' : t.type==='success' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white'}`}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() { return useContext(ToastContext) }


