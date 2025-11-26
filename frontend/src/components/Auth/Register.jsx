import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaEye, FaEyeSlash, FaHouse } from 'react-icons/fa6';
import { FaInfoCircle } from 'react-icons/fa';
import { useToast } from '../../ui/Toast';
import VI from '../../constants/vi';
import TermsModal from './TermsModal';
import AddressSelector from './AddressSelector';

const Register = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    province: '',
    ward: '',
    addressDetail: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsType, setTermsType] = useState('terms');
  const [fieldErrors, setFieldErrors] = useState({
    email: '',
    phone: '',
    password: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });

    // Real-time validation
    validateField(name, value);
  };

  const validateField = (name, value) => {
    let error = '';

    switch (name) {
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (value && !emailRegex.test(value)) {
          error = 'Email không hợp lệ (ví dụ: example@domain.com)';
        }
        break;

      case 'phone':
        const phoneRegex = /^\d{10}$/;
        if (value && !phoneRegex.test(value.replace(/\s/g, ''))) {
          error = 'Số điện thoại phải có đúng 10 chữ số';
        }
        break;

      case 'password':
        if (value) {
          const hasUpperCase = /[A-Z]/.test(value);
          const hasLowerCase = /[a-z]/.test(value);
          const hasNumber = /\d/.test(value);
          const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);
          const isLongEnough = value.length >= 8;

          if (!isLongEnough) {
            error = 'Mật khẩu phải có ít nhất 8 ký tự';
          } else if (!hasUpperCase) {
            error = 'Mật khẩu phải có ít nhất 1 chữ cái viết hoa';
          } else if (!hasLowerCase) {
            error = 'Mật khẩu phải có ít nhất 1 chữ cái viết thường';
          } else if (!hasNumber) {
            error = 'Mật khẩu phải có ít nhất 1 chữ số';
          } else if (!hasSpecialChar) {
            error = 'Mật khẩu phải có ít nhất 1 ký tự đặc biệt (!@#$%^&*...)';
          }
        }
        break;

      default:
        break;
    }

    setFieldErrors(prev => ({
      ...prev,
      [name]: error
    }));
  };

  const handleAddressChange = (addressData) => {
    setFormData({
      ...formData,
      province: addressData.province,
      ward: addressData.ward,
      addressDetail: addressData.addressDetail
    });
  };

  const openTermsModal = (type) => {
    setTermsType(type);
    setShowTermsModal(true);
  };

  const validateForm = () => {
    // Check if there are any field errors
    if (fieldErrors.email || fieldErrors.phone || fieldErrors.password) {
      setError('Vui lòng sửa các lỗi trước khi tiếp tục');
      return false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Email không hợp lệ');
      return false;
    }

    // Phone validation (10 digits)
    if (formData.phone) {
      const phoneRegex = /^\d{10}$/;
      if (!phoneRegex.test(formData.phone.replace(/\s/g, ''))) {
        setError('Số điện thoại phải có đúng 10 chữ số');
        return false;
      }
    }

    // Password validation - Strong password
    const hasUpperCase = /[A-Z]/.test(formData.password);
    const hasLowerCase = /[a-z]/.test(formData.password);
    const hasNumber = /\d/.test(formData.password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(formData.password);
    const isLongEnough = formData.password.length >= 8;

    if (!isLongEnough || !hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
      setError('Mật khẩu không đủ mạnh. Vui lòng kiểm tra các yêu cầu bên dưới');
      return false;
    }

    // Address validation (optional but if started, must complete)
    if (formData.province || formData.ward || formData.addressDetail) {
      if (!formData.province || !formData.ward || !formData.addressDetail) {
        setError('Vui lòng điền đầy đủ thông tin địa chỉ (Tỉnh/Phường/Địa chỉ chi tiết)');
        return false;
      }
    }

    // Terms agreement validation
    if (!agreedToTerms) {
      setError('Bạn phải đồng ý với Điều khoản và Chính sách Bảo mật để tiếp tục');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
      
      // Send OTP to email
      const response = await fetch(`${apiUrl}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          fullName: formData.fullName,
          phone: formData.phone,
          province: formData.province,
          ward: formData.ward,
          addressDetail: formData.addressDetail
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      toast.show('✉️ Mã OTP đã được gửi đến email của bạn!', { type: 'success', duration: 3000 });
      
      // Navigate to OTP verification page with form data
      navigate('/verify-otp', { state: formData });
    } catch (err) {
      const errorMsg = err.message || 'Không thể gửi mã xác thực. Vui lòng thử lại.';
      setError(errorMsg);
      toast.show(`❌ ${errorMsg}`, { type: 'error', duration: 3500 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 py-4 sm:py-8 px-3 sm:px-6 lg:px-8">
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

      <div className="max-w-2xl mx-auto pt-16 sm:pt-12">
        {/* Logo */}
        <div className="text-center mb-4 sm:mb-6">
          <Link to="/" className="text-primary tracking-widest text-3xl sm:text-4xl uppercase font-bitcount font-semibold">
            GearUp
          </Link>
          <h2 className="mt-3 sm:mt-4 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            {VI.auth.createAccount}
          </h2>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            {VI.auth.joinToday}
          </p>
        </div>

        {/* Register Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-4 sm:p-6 lg:p-8">
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

          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {VI.auth.fullName} *
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                value={formData.fullName}
                onChange={handleChange}
                required
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                placeholder="Nguyễn Văn A"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {VI.auth.emailAddress} *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border ${fieldErrors.email ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white transition-all`}
                placeholder="email@example.com"
              />
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {VI.auth.password} *
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={8}
                  className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pr-10 sm:pr-12 text-sm sm:text-base border ${fieldErrors.password ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white transition-all`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.password}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {VI.auth.phoneNumber} *
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                required
                maxLength={10}
                className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border ${fieldErrors.phone ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white transition-all`}
                placeholder="0123456789"
              />
              {fieldErrors.phone ? (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.phone}</p>
              ) : (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Số điện thoại phải có đúng 10 chữ số
                </p>
              )}
            </div>

            {/* Address Selector */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Địa chỉ giao hàng
              </h3>
              <AddressSelector
                value={{
                  province: formData.province,
                  ward: formData.ward,
                  addressDetail: formData.addressDetail
                }}
                onChange={handleAddressChange}
                required={false}
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                * Thông tin địa chỉ sẽ được lưu để sử dụng cho các đơn hàng tiếp theo
              </p>
            </div>

            {/* Terms Checkbox */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3 sm:pt-4">
              <div className="flex items-start gap-2">
                <input
                  id="terms"
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  required
                  className="h-4 w-4 mt-0.5 text-primary border-gray-300 rounded focus:ring-primary flex-shrink-0"
                />
                <label htmlFor="terms" className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                  {VI.auth.agreeToTerms}{' '}
                  <button
                    type="button"
                    onClick={() => openTermsModal('terms')}
                    className="text-primary hover:text-primary/80 font-semibold underline"
                  >
                    {VI.auth.termsAndConditions}
                  </button>
                  {' '}{VI.auth.and}{' '}
                  <button
                    type="button"
                    onClick={() => openTermsModal('privacy')}
                    className="text-primary hover:text-primary/80 font-semibold underline"
                  >
                    {VI.auth.privacyPolicy}
                  </button>
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !agreedToTerms}
              className="w-full bg-primary text-white py-2.5 sm:py-3 text-sm sm:text-base rounded-lg font-semibold hover:bg-primary/90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang xử lý...
                </span>
              ) : (
                'Đăng ký tài khoản'
              )}
            </button>
          </form>
        </div>

        {/* Sign In Link */}
        <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          {VI.auth.alreadyHaveAccount}{' '}
          <Link to="/login" className="text-primary hover:text-primary/80 font-semibold transition-colors">
            {VI.auth.signInHere}
          </Link>
        </p>
      </div>

      {/* Terms Modal */}
      <TermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        type={termsType}
      />
    </div>
  );
};

export default Register;
