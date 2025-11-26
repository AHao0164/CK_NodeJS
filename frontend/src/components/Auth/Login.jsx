import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../ui/Toast'
import { FaEye, FaEyeSlash, FaHouse } from 'react-icons/fa6'
import VI from '../../constants/vi'

const Login = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()

  React.useEffect(() => {
    document.title = 'Đăng nhập - GearUp';
    
    // Load saved credentials if Remember Me was checked
    const savedEmail = localStorage.getItem('rememberedEmail');
    const savedPassword = localStorage.getItem('rememberedPassword');
    if (savedEmail && savedPassword) {
      setEmail(savedEmail);
      setPassword(atob(savedPassword)); // Decode from base64
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { loginRequest, getCurrentUser } = await import('../../services/auth')
      const data = await loginRequest({ email, password })
      
      // Fetch user info sau khi login
      const { createApiClient } = await import('../../api/client')
      const tempApi = createApiClient(() => data.token)
      const userData = await getCurrentUser(tempApi)
      
      // Save credentials if Remember Me is checked
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
        localStorage.setItem('rememberedPassword', btoa(password)); // Encode to base64
      } else {
        localStorage.removeItem('rememberedEmail');
        localStorage.removeItem('rememberedPassword');
      }
      
      login(data.token, userData)
      toast.show(`🎉 Chào mừng ${userData.fullName || userData.email}!`, { type: 'success', duration: 2000 })
      
      // Check if there's a return URL
      const returnUrl = localStorage.getItem('returnUrl')
      if (returnUrl) {
        localStorage.removeItem('returnUrl')
        navigate(returnUrl)
      } else {
        navigate('/')
      }
    } catch (err) {
      const errorMsg = err?.response?.data?.error || VI.errors.loginFailed
      setError(errorMsg)
      toast.show(`❌ ${errorMsg}`, { type: 'error', duration: 3500 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 py-4 sm:py-12 px-3 sm:px-6 lg:px-8">
      {/* Home Button - Top Left */}
      <div className="fixed top-4 left-4 z-50">
        <Link
          to="/"
          className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-primary transition-colors rounded-lg shadow-lg hover:shadow-xl"
        >
          <FaHouse size={18} />
          <span className="text-sm font-medium hidden sm:inline">{VI.common.backToHome}</span>
        </Link>
      </div>

      <div className="max-w-md mx-auto pt-20 sm:pt-12 flex items-center justify-center min-h-[calc(100vh-2rem)] sm:min-h-screen">
        <div className="w-full">
          {/* Logo */}
          <div className="text-center mb-6 sm:mb-8">
            <Link to="/" className="text-primary tracking-widest text-3xl sm:text-4xl uppercase font-bitcount font-semibold">
              GearUp
            </Link>
            <h2 className="mt-4 sm:mt-6 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              {VI.auth.welcomeBack}
            </h2>
            <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
              {VI.auth.signInToAccount}
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 sm:p-8">
          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                {VI.auth.emailAddress}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                placeholder="your@email.com"
              />
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {VI.auth.password}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {showPassword ? <FaEyeSlash size={20} /> : <FaEye size={20} />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  {VI.auth.rememberMe}
                </label>
              </div>
              <Link to="/forgot-password" className="text-sm text-primary hover:text-primary/80 font-semibold">
                {VI.auth.forgotPassword}
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {VI.auth.loggingIn}
                </span>
              ) : (
                VI.auth.signIn
              )}
            </button>
          </form>

          </div>

          {/* Sign Up Link */}
          <p className="mt-6 sm:mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
            {VI.auth.dontHaveAccount}{' '}
            <Link to="/register" className="text-primary hover:text-primary/80 font-semibold transition-colors">
              {VI.auth.signUpFree}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login