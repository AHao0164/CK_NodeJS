import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { FaHouse, FaEnvelope } from 'react-icons/fa6';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../ui/Toast';

const OTPVerification = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const toast = useToast();
  
  const formData = location.state || {};
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(120); // 2 minutes in seconds
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!formData.email) {
      navigate('/register');
      return;
    }

    // Countdown timer
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, formData.email, navigate]);

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits
    
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Take only last digit
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    setOtp(newOtp);
  };

  const handleResendOTP = async () => {
    setResending(true);
    setError('');

    try {
      const apiUrl = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email })
      });

      if (response.ok) {
        setTimeLeft(120); // Reset timer to 2 minutes
        setOtp(['', '', '', '', '', '']); // Clear OTP
        toast.show('Mã OTP mới đã được gửi đến email của bạn', { type: 'success', duration: 3000 });
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to resend OTP');
      }
    } catch (err) {
      const errorMsg = err.message || 'Không thể gửi lại mã OTP';
      setError(errorMsg);
      toast.show(`${errorMsg}`, { type: 'error', duration: 3500 });
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const otpCode = otp.join('');
    
    if (otpCode.length !== 6) {
      setError('Vui lòng nhập đầy đủ 6 chữ số');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          code: otpCode,
          password: formData.password,
          fullName: formData.fullName,
          phone: formData.phone,
          province: formData.province,
          ward: formData.ward,
          addressDetail: formData.addressDetail
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid OTP');
      }

      // Login with the token
      login(data.token, data.user);
      toast.show(`Đăng ký thành công! Chào mừng ${data.user.fullName || data.user.email}`, { type: 'success', duration: 2500 });

      // Check if there's a return URL
      const returnUrl = localStorage.getItem('returnUrl');
      if (returnUrl) {
        localStorage.removeItem('returnUrl');
        navigate(returnUrl);
      } else {
        navigate('/');
      }
    } catch (err) {
      const errorMsg = err.message || 'Mã OTP không đúng hoặc đã hết hạn';
      setError(errorMsg);
      toast.show(`${errorMsg}`, { type: 'error', duration: 3500 });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Home Button */}
        <div className="flex justify-end mb-4">
          <Link
            to="/"
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <FaHouse size={20} />
            <span className="text-sm font-medium">Về trang chủ</span>
          </Link>
        </div>

        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="text-primary tracking-widest text-4xl uppercase font-bitcount font-semibold">
            GearUp
          </Link>
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
            Xác thực Email
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 flex items-center justify-center gap-2">
            <FaEnvelope />
            Mã OTP đã được gửi đến <strong>{formData.email}</strong>
          </p>
        </div>

        {/* OTP Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* OTP Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
                Nhập mã OTP (6 chữ số)
              </label>
              <div className="flex justify-center gap-2">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    id={`otp-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={index === 0 ? handlePaste : undefined}
                    className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                  />
                ))}
              </div>
            </div>

            {/* Timer */}
            <div className="text-center">
              <div className={`text-lg font-semibold ${timeLeft <= 60 ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>
                Thời gian còn lại: {formatTime(timeLeft)}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Mã OTP sẽ hết hạn sau 2 phút
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || timeLeft === 0 || otp.some(d => !d)}
              className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang xác thực...
                </span>
              ) : (
                'Xác thực và Đăng ký'
              )}
            </button>

            {/* Resend OTP */}
            <div className="text-center">
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={resending || timeLeft > 240} // Can resend after 1 minute
                className="text-sm text-primary hover:text-primary/80 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {resending ? 'Đang gửi lại...' : 'Gửi lại mã OTP'}
              </button>
              {timeLeft > 240 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Bạn có thể gửi lại sau {formatTime(timeLeft - 240)}
                </p>
              )}
            </div>
          </form>
        </div>

        {/* Back to Register Link */}
        <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          <Link to="/register" className="text-primary hover:text-primary/80 font-semibold transition-colors">
            ← Quay lại đăng ký
          </Link>
        </p>
      </div>
    </div>
  );
};

export default OTPVerification;
