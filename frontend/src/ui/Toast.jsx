import React, { createContext, useContext, useCallback, useMemo, useState } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => setToasts(ts => ts.filter(t => t.id !== id)), [])
  const show = useCallback((message, { type = 'info', duration = 3000 } = {}) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(ts => [...ts, { id, message, type }])
    setTimeout(() => remove(id), duration)
  }, [remove])

  const value = useMemo(() => ({ show }), [show])
  
  const getToastStyles = (type) => {
    const baseStyles = "flex items-center gap-3 min-w-[320px] max-w-md rounded-xl px-5 py-4 shadow-lg backdrop-blur-sm border transform transition-all duration-300 ease-out animate-slide-up"
    
    switch(type) {
      case 'success':
        return `${baseStyles} bg-gradient-to-r from-emerald-500 to-green-600 text-white border-emerald-400/50`
      case 'error':
        return `${baseStyles} bg-gradient-to-r from-red-500 to-rose-600 text-white border-red-400/50`
      case 'warning':
        return `${baseStyles} bg-gradient-to-r from-amber-500 to-orange-600 text-white border-amber-400/50`
      case 'info':
      default:
        return `${baseStyles} bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-blue-400/50`
    }
  }

  const getIcon = (type) => {
    switch(type) {
      case 'success':
        return (
          <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'error':
        return (
          <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'warning':
        return (
          <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        )
      case 'info':
      default:
        return (
          <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 space-y-3">
        {toasts.map(t => (
          <div key={t.id} className={getToastStyles(t.type)}>
            {getIcon(t.type)}
            <span className="font-medium text-sm leading-snug">{t.message}</span>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </ToastContext.Provider>
  )
}

export function useToast() { return useContext(ToastContext) }

