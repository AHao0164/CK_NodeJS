import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useToast } from '../ui/Toast';
import { FaEye, FaEyeSlash, FaLock, FaHome } from 'react-icons/fa';
import { motion } from 'framer-motion';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  useEffect(() => {
    document.title = 'Đặt lại mật khẩu - GearUp';
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
      verifyToken(tokenParam);
    } else {
      setValidating(false);
      setTokenValid(false);
    }
  }, [searchParams]);

  const verifyToken = async (tokenToVerify) => {
    try {
      const response = await fetch(`http://localhost:8080/auth/verify-reset-token?token=${tokenToVerify}`);
      const data = await response.json();
      
      if (data.valid) {
        setTokenValid(true);
      } else {
        toast.show('❌ Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn', { type: 'error' });
      }
    } catch (error) {
      toast.show('❌ Lỗi kết nối đến server', { type: 'error' });
    } finally {
      setValidating(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (!newPassword || !confirmPassword) {
      toast.show('Vui lòng nhập đầy đủ thông tin', { type: 'error' });
      return;
    }

    if (newPassword.length < 8) {
      toast.show('Mật khẩu phải có ít nhất 8 ký tự', { type: 'error' });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.show('Mật khẩu xác nhận không khớp', { type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:8080/auth/reset-password-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });

      const data = await response.json();

      if (response.ok) {
        toast.show('✅ Đặt lại mật khẩu thành công! Đang chuyển đến trang đăng nhập...', { type: 'success', duration: 3000 });
        setTimeout(() => navigate('/login'), 2000);
      } else {
        toast.show(`❌ ${data.error || 'Không thể đặt lại mật khẩu'}`, { type: 'error' });
      }
    } catch (error) {
      toast.show('❌ Lỗi kết nối đến server', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Đang xác thực link...</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl text-center"
        >
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Link không hợp lệ
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu link mới.
          </p>
          <Link
            to="/forgot-password"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Yêu cầu link mới
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl"
      >
        {/* Header */}
        <div className="text-center">
          <Link to="/" className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mb-4 hover:scale-110 transition-transform">
            <FaHome className="text-white text-2xl" />
          </Link>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Đặt lại mật khẩu
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Nhập mật khẩu mới cho tài khoản của bạn
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleResetPassword} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Mật khẩu mới
            </label>
            <div className="relative">
              <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Ít nhất 8 ký tự"
                required
                minLength={8}
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Xác nhận mật khẩu
            </label>
            <div className="relative">
              <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Nhập lại mật khẩu"
                required
                minLength={8}
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
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
          </button>

          <div className="text-center">
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
              ← Quay lại đăng nhập
            </Link>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default ResetPassword;

