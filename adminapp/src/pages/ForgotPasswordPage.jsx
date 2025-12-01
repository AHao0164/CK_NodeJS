import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaEye, FaEyeSlash, FaHome, FaEnvelope, FaLock, FaKey } from 'react-icons/fa';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [countdown, setCountdown] = useState(0);

  // Countdown timer for OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Vui lòng nhập email');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch('http://localhost:8080/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('✅ Mã OTP đã được gửi đến email của bạn');
        setStep(2);
        setCountdown(120); // 2 minutes
        setError('');
      } else {
        setError(data.error || 'Không thể gửi OTP');
      }
    } catch (error) {
      setError('Lỗi kết nối đến server');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otp.trim()) {
      setError('Vui lòng nhập mã OTP');
      return;
    }
    if (otp.length !== 6) {
      setError('Mã OTP phải có 6 số');
      return;
    }
    
    if (countdown === 0) {
      setError('Mã OTP đã hết hạn. Vui lòng gửi lại mã mới');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Verify OTP with backend first
      const response = await fetch('http://localhost:8080/auth/verify-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('✅ Xác thực OTP thành công');
        setStep(3);
        setError('');
      } else {
        setError(data.error || 'Mã OTP không hợp lệ');
      }
    } catch (error) {
      setError('Lỗi kết nối đến server');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (!newPassword || !confirmPassword) {
      setError('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    if (newPassword.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch('http://localhost:8080/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('✅ Đặt lại mật khẩu thành công!');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(data.error || 'Không thể đặt lại mật khẩu');
      }
    } catch (error) {
      setError('Lỗi kết nối đến server');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    await handleSendOTP({ preventDefault: () => {} });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <Link to="/login" className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4 hover:scale-110 transition-transform shadow-lg">
            <FaHome className="text-white text-2xl" />
          </Link>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Quên mật khẩu?
          </h2>
          <p className="text-gray-600">
            {step === 1 && 'Nhập email admin để nhận mã OTP'}
            {step === 2 && 'Nhập mã OTP đã được gửi đến email'}
            {step === 3 && 'Tạo mật khẩu mới'}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-between items-center bg-white rounded-lg p-4 shadow-lg">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                s <= step 
                  ? 'bg-primary text-white shadow-lg' 
                  : 'bg-gray-200 text-gray-400'
              }`}>
                {s}
              </div>
              {s < 3 && (
                <div className={`w-16 sm:w-24 h-1 mx-2 transition-all ${
                  s < step ? 'bg-primary' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Error/Success Messages */}
          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded">
              <p className="text-sm text-red-700">❌ {error}</p>
            </div>
          )}
          {success && (
            <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4 rounded">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          {/* Step 1: Email */}
          {step === 1 && (
            <form onSubmit={handleSendOTP} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Admin
                </label>
                <div className="relative">
                  <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="admin@example.com"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {loading ? 'Đang gửi...' : 'Gửi mã OTP'}
              </button>

              <div className="text-center">
                <Link to="/login" className="text-primary hover:text-blue-700 font-medium">
                  ← Quay lại đăng nhập
                </Link>
              </div>
            </form>
          )}

          {/* Step 2: OTP */}
          {step === 2 && (
            <form onSubmit={handleVerifyOTP} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mã OTP (6 số)
                </label>
                <div className="relative">
                  <FaKey className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-center text-2xl font-mono tracking-widest"
                    placeholder="000000"
                    maxLength={6}
                    required
                  />
                </div>
              </div>

              {countdown > 0 && (
                <div className="text-center text-sm text-gray-600">
                  Mã OTP hết hạn sau: <span className="font-semibold text-red-600">{formatTime(countdown)}</span>
                </div>
              )}

              {countdown === 0 && (
                <div className="text-center text-sm text-red-600 font-semibold">
                  ⚠️ Mã OTP đã hết hạn! Vui lòng gửi lại mã mới.
                </div>
              )}

              <button
                type="submit"
                disabled={countdown === 0 || loading}
                className="w-full bg-primary hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Đang xác thực...' : 'Xác nhận OTP'}
              </button>

              <button
                type="button"
                onClick={handleResendOTP}
                disabled={countdown > 0}
                className="w-full border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {countdown > 0 ? `Gửi lại sau ${formatTime(countdown)}` : 'Gửi lại mã OTP'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-primary hover:text-blue-700 font-medium"
                >
                  ← Đổi email
                </button>
              </div>
            </form>
          )}

          {/* Step 3: New Password */}
          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mật khẩu mới
                </label>
                <div className="relative">
                  <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Ít nhất 6 ký tự"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Xác nhận mật khẩu
                </label>
                <div className="relative">
                  <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Nhập lại mật khẩu"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-red-600 text-sm">⚠️ Mật khẩu xác nhận không khớp</p>
              )}

              <button
                type="submit"
                disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                className="w-full bg-primary hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {loading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
