import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

export default function ForgotPassword() {
	const [email, setEmail] = useState('')
	const [loading, setLoading] = useState(false)
	const [message, setMessage] = useState('')
	const [error, setError] = useState('')

	const handleSubmit = async (e) => {
		e.preventDefault()
		setLoading(true)
		setMessage('')
		setError('')

		try {
			await axios.post(`${API_BASE}/auth/forgot-password`, { email })
			setMessage('Email đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư của bạn.')
			setEmail('')
		} catch (err) {
			setError(err.response?.data?.error || 'Có lỗi xảy ra. Vui lòng thử lại.')
		} finally {
			setLoading(false)
		}
	}

	return (
		<main className="container-page py-10">
			<div className="mx-auto w-full max-w-md">
				<h1 className="heading-section mb-6">Forgot Password</h1>
				<div className="card space-y-4 p-6">
					<p className="text-sm text-slate-600 mb-4">
						Enter your email address and we'll send you a link to reset your password.
					</p>

					{message && (
						<div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">
							{message}
						</div>
					)}

					{error && (
						<div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
							{error}
						</div>
					)}

					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-slate-700 mb-2">
								Email Address
							</label>
							<input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
								placeholder="your@email.com"
							/>
						</div>

						<button
							type="submit"
							disabled={loading}
							className="btn btn-primary w-full rounded-xl"
						>
							{loading ? 'Sending...' : 'Send Reset Link'}
						</button>
					</form>

					<div className="text-center pt-2">
						<Link to="/login" className="text-sm text-brand-700 hover:text-brand-800">
							← Back to Sign in
						</Link>
					</div>
				</div>
			</div>
		</main>
	)
}
