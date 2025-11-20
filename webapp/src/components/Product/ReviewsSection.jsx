import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import Button from '../ui/Button'
import { useToast } from '../../ui/Toast'

export default function ReviewsSection({ productId, initialReviews = [], avgRating = 0, reviewCount = 0 }) {
  const [reviews, setReviews] = useState(initialReviews)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { token, user, api } = useAuth()
  const toast = useToast()
  const wsRef = useRef(null)
  
  // WebSocket connection for real-time updates
  useEffect(() => {
    const catalogUrl = (import.meta.env.VITE_API_BASE || 'http://localhost:8080').replace('http', 'ws')
    const ws = new WebSocket(`${catalogUrl.replace(':8080', ':3002')}/ws/reviews`)
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', productId }))
    }
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'review_added' && data.productId === productId) {
        // Check if review already exists (to avoid duplicate when user just submitted)
        setReviews(prev => {
          const exists = prev.some(r => r.id === data.review.id)
          if (exists) return prev
          toast.show('Có đánh giá mới!', { type: 'info' })
          return [data.review, ...prev]
        })
      }
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
    
    wsRef.current = ws
    
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
    }
  }, [productId])
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!comment && !rating) {
      toast.show('Vui lòng nhập nội dung hoặc đánh giá sao', { type: 'error' })
      return
    }
    
    if (rating && !token) {
      toast.show('Bạn cần đăng nhập để đánh giá sao', { type: 'error' })
      return
    }
    
    if (!token && !authorName.trim()) {
      toast.show('Vui lòng nhập tên của bạn', { type: 'error' })
      return
    }
    
    setSubmitting(true)
    try {
      const payload = {
        rating: rating || null,
        comment: comment || null,
        authorName: token ? (user?.full_name || 'User') : authorName,
        userId: token && user ? user.id : null
      }
      
      const response = await api.post(`/catalog/products/${productId}/reviews`, payload)
      
      // Immediately add the review to the list
      if (response.data.review) {
        setReviews(prev => [response.data.review, ...prev])
      }
      
      toast.show('✓ Đã gửi đánh giá thành công!', { type: 'success' })
      setRating(0)
      setComment('')
      setAuthorName('')
    } catch (error) {
      toast.show(error.response?.data?.error || 'Có lỗi xảy ra', { type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }
  
  const StarIcon = ({ filled, half, onClick, onMouseEnter, onMouseLeave }) => (
    <svg
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="h-6 w-6 cursor-pointer transition-colors"
      fill={filled || half ? 'currentColor' : 'none'}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={filled || half ? 0 : 2}
    >
      {half ? (
        <defs>
          <linearGradient id="half">
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="transparent" stopOpacity="1" />
          </linearGradient>
        </defs>
      ) : null}
      <path
        fill={half ? 'url(#half)' : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
      />
    </svg>
  )
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Đánh giá sản phẩm</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map(star => (
              <StarIcon
                key={star}
                filled={star <= Math.floor(avgRating)}
                half={star === Math.ceil(avgRating) && avgRating % 1 !== 0}
              />
            ))}
          </div>
          <span className="text-lg font-semibold">{avgRating.toFixed(1)}</span>
          <span className="text-slate-500">({reviewCount} đánh giá)</span>
        </div>
      </div>
      
      {/* Review Form */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="mb-4 font-semibold text-slate-900">Viết đánh giá của bạn</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Rating Stars */}
          {token && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Đánh giá {rating > 0 && `(${rating} sao)`}
              </label>
              <div
                className="flex gap-1 text-yellow-400"
                onMouseLeave={() => setHoverRating(0)}
              >
                {[1, 2, 3, 4, 5].map(star => (
                  <StarIcon
                    key={star}
                    filled={star <= (hoverRating || rating)}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                  />
                ))}
              </div>
            </div>
          )}
          
          {!token && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Tên của bạn <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Nhập tên của bạn"
              />
              <p className="mt-1 text-xs text-slate-500">
                Bạn cần đăng nhập để đánh giá sao
              </p>
            </div>
          )}
          
          {/* Comment */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Nhận xét
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm này..."
            />
          </div>
          
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Đang gửi...' : 'Gửi đánh giá'}
          </Button>
        </form>
      </div>
      
      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
            Chưa có đánh giá nào. Hãy là người đầu tiên đánh giá sản phẩm này!
          </div>
        ) : (
          reviews.map(review => (
            <div key={review.id} className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {review.author_name || 'Anonymous'}
                    </span>
                    {review.rating && (
                      <div className="flex items-center gap-1 text-yellow-400">
                        {[1, 2, 3, 4, 5].map(star => (
                          <StarIcon key={star} filled={star <= review.rating} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {new Date(review.created_at).toLocaleDateString('vi-VN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
              {review.comment && (
                <p className="mt-3 text-slate-700 leading-relaxed">{review.comment}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
