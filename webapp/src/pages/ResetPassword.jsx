import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

export default function ResetPassword() {
	const [searchParams] = useSearchParams()
	const navigate = useNavigate()
	const token = searchParams.get('token')

	const [newPassword, setNewPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [loading, setLoading] = useState(false)
	const [verifying, setVerifying] = useState(true)
	const [validToken, setValidToken] = useState(false)
	const [message, setMessage] = useState('')
	const [error, setError] = useState('')

	// Verify token when component mounts
	useEffect(() => {
		if (!token) {
			setError('Token không hợp lệ')
			setVerifying(false)
			return
		}

		axios
			.get(`${API_BASE}/auth/verify-reset-token?token=${token}`)
			.then((response) => {
				setValidToken(response.data.valid)
				if (!response.data.valid) {
					setError('Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn')
				}
			})
			.catch(() => {
				setError('Không thể xác minh token')
			})
			.finally(() => {
				setVerifying(false)
			})
	}, [token])

	const handleSubmit = async (e) => {
		e.preventDefault()
		setError('')
		setMessage('')

		// Validation
		if (newPassword.length < 8) {
			setError('Password must be at least 8 characters')
			return
		}

		if (newPassword !== confirmPassword) {
			setError('Passwords do not match')
			return
		}

		setLoading(true)

		try {
			await axios.post(`${API_BASE}/auth/reset-password`, {
				token,
				newPassword,
			})

			setMessage('Password reset successfully! Redirecting to login...')

			setTimeout(() => {
				navigate('/login')
			}, 2000)
		} catch (err) {
			setError(err.response?.data?.error || 'An error occurred. Please try again.')
		} finally {
			setLoading(false)
		}
	}

	if (verifying) {
		return (
			<main className="container-page py-10">
				<div className="mx-auto w-full max-w-md text-center">
					<p className="text-slate-600">Verifying token...</p>
				</div>
			</main>
		)
	}

	if (!validToken) {
		return (
			<main className="container-page py-10">
				<div className="mx-auto w-full max-w-md">
					<h1 className="heading-section mb-6">Invalid Link</h1>
					<div className="card space-y-4 p-6">
						<div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
							{error}
						</div>
						<p className="text-slate-600">
							The password reset link may have expired or already been used.
						</p>
						<Link to="/forgot-password" className="text-brand-700 hover:text-brand-800">
							Request a new reset link
						</Link>
					</div>
				</div>
			</main>
		)
	}

	return (
		<main className="container-page py-10">
			<div className="mx-auto w-full max-w-md">
				<h1 className="heading-section mb-6">Reset Password</h1>
				<div className="card space-y-4 p-6">
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
								New Password
							</label>
							<input
								type="password"
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								required
								className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
								placeholder="At least 8 characters"
							/>
						</div>

						<div>
							<label className="block text-sm font-medium text-slate-700 mb-2">
								Confirm Password
							</label>
							<input
								type="password"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								required
								className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
								placeholder="Re-enter new password"
							/>
						</div>

						<button
							type="submit"
							disabled={loading}
							className="btn btn-primary w-full rounded-xl"
						>
							{loading ? 'Resetting...' : 'Reset Password'}
						</button>
					</form>
				</div>
			</div>
		</main>
	)
}
