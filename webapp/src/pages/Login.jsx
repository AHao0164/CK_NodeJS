import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { loginRequest } from '../services/auth'
import { useAuth } from '../context/AuthContext'

export default function Login() {
	const navigate = useNavigate()
	const { login } = useAuth()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)

	async function onSubmit(e) {
		e.preventDefault()
		setError('')
		setLoading(true)
		try {
			const { token } = await loginRequest({ email, password })
			login(token)
			navigate('/')
		} catch (e) {
			setError('Invalid credentials')
		} finally {
			setLoading(false)
		}
	}

	return (
		<main className="container-page py-10">
			<div className="mx-auto w-full max-w-md">
				<h1 className="heading-section mb-6">Sign in</h1>
				<form onSubmit={onSubmit} className="card space-y-4 p-6">
					{error && <p className="text-sm text-red-600">{error}</p>}
					<input className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
					<input className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
					<button disabled={loading} className="btn btn-primary w-full rounded-xl" type="submit">{loading ? 'Signing in...' : 'Sign in'}</button>
					<p className="text-sm text-slate-600">No account? <Link to="/signup" className="text-brand-700 hover:text-brand-800">Create one</Link></p>
				</form>
			</div>
		</main>
	)
}


