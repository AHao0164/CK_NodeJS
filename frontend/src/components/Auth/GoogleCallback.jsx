import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../ui/Toast';

const GoogleCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const toast = useToast();

  useEffect(() => {
    const handleCallback = async () => {
      const token = searchParams.get('token');
      const error = searchParams.get('error');

      if (error) {
        toast.show('Đăng nhập Google thất bại', { type: 'error' });
        navigate('/login');
        return;
      }

      if (token) {
        try {
          // Fetch user info with token
          const { createApiClient } = await import('../../api/client');
          const { getCurrentUser } = await import('../../services/auth');
          const tempApi = createApiClient(() => token);
          const userData = await getCurrentUser(tempApi);
          
          login(token, userData);
          toast.show(`Chào mừng ${userData.fullName || userData.email}!`, { type: 'success', duration: 2000 });
          
          // Check if there's a return URL
          const returnUrl = localStorage.getItem('returnUrl');
          if (returnUrl) {
            localStorage.removeItem('returnUrl');
            navigate(returnUrl);
          } else {
            navigate('/');
          }
        } catch (err) {
          console.error('Google callback error:', err);
          toast.show('Không thể lấy thông tin người dùng', { type: 'error' });
          navigate('/login');
        }
      } else {
        navigate('/login');
      }
    };

    handleCallback();
  }, [searchParams, login, navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-700 dark:text-gray-300 text-lg font-semibold">
          Đang xử lý đăng nhập...
        </p>
      </div>
    </div>
  );
};

export default GoogleCallback;
