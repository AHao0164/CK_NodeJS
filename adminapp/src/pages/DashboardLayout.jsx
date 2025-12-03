import { useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { useAuth } from '../state/AuthContext.jsx';
import {
  FaChartLine,
  FaBox,
  FaShoppingCart,
  FaTags,
  FaTag,
  FaUsers,
  FaPercent,
  FaBars,
  FaTimes,
  FaSignOutAlt,
  FaUser,
  FaImage,
  FaStar
} from 'react-icons/fa';

const menuItems = [
  { text: 'Tổng Quan', icon: FaChartLine, path: '/dashboard' },
  { 
    text: 'Quản lý trang', 
    icon: FaBox, 
    path: '/page-management',
    subItems: [
      { text: 'Sản phẩm', icon: FaBox, path: '/products' },
      { text: 'Danh mục', icon: FaTags, path: '/categories' },
      { text: 'Hãng', icon: FaTag, path: '/brands' },
      { text: 'Banner trang chủ', icon: FaImage, path: '/banners' },
    ]
  },
  { text: 'Đơn hàng', icon: FaShoppingCart, path: '/orders' },
  { text: 'Đánh giá sản phẩm', icon: FaStar, path: '/reviews' },
  { text: 'Khách hàng', icon: FaUsers, path: '/customers' },
  { text: 'Khuyến mãi', icon: FaPercent, path: '/promotions' },
];

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({});
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const handleLogout = () => {
    setLogoutConfirmOpen(true);
    setDropdownOpen(false);
  };

  const confirmLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white/80 backdrop-blur-md shadow-sm fixed top-0 left-0 right-0 z-30 border-b border-gray-200/50">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 lg:h-18">
            <div className="flex items-center">
              {/* Mobile menu button */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 focus:outline-none"
              >
                {sidebarOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
              </button>

              {/* Logo */}
              <Link to="/" className="flex items-center ml-4 lg:ml-0 gap-2 group">
                <img 
                  src="/logo.jpg" 
                  alt="GearUp Logo" 
                  className="h-10 w-10 object-cover rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
                />
                <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">GearUp Admin</span>
              </Link>
            </div>

            {/* User Menu */}
            <div className="flex items-center">
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center text-white font-semibold">
                    {user?.email?.[0]?.toUpperCase() || 'A'}
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-gray-700">
                    {user?.email}
                  </span>
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setDropdownOpen(false)}
                    ></div>
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-20">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                        <p className="text-xs text-gray-400 mt-1">Quản trị viên</p>
                      </div>
                      <Link
                        to="/profile"
                        onClick={() => setDropdownOpen(false)}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <FaUser />
                        Thông tin cá nhân
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <FaSignOutAlt />
                        Đăng xuất
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-16 left-0 bottom-0 w-64 bg-white/80 backdrop-blur-md border-r border-gray-200/50 shadow-lg transform transition-transform duration-300 ease-in-out z-20 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0`}
      >
        <nav className="p-4 sm:p-6 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const hasSubItems = item.subItems && item.subItems.length > 0;
            const isExpanded = expandedMenus[item.text];
            const isActive = hasSubItems 
              ? item.subItems.some(sub => location.pathname === sub.path)
              : location.pathname === item.path;
            
            if (hasSubItems) {
              return (
                <div key={item.text}>
                  <button
                    onClick={() => setExpandedMenus(prev => ({ ...prev, [item.text]: !prev[item.text] }))}
                    className={`w-full group flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-50 to-blue-100 text-primary font-medium shadow-sm'
                        : 'text-gray-700 hover:bg-gray-50 hover:shadow-sm'
                    }`}
                  >
                    <Icon className={`text-lg transition-transform duration-200 ${isActive ? 'text-primary scale-110' : 'text-gray-500 group-hover:scale-110'}`} />
                    <span className="transition-all flex-1 text-left">{item.text}</span>
                    <svg 
                      className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isExpanded && (
                    <div className="ml-4 mt-2 space-y-1 border-l-2 border-gray-200 pl-3">
                      {item.subItems.map(subItem => {
                        const SubIcon = subItem.icon;
                        const subIsActive = location.pathname === subItem.path;
                        return (
                          <Link
                            key={subItem.path}
                            to={subItem.path}
                            onClick={() => setSidebarOpen(false)}
                            className={`group flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200 ${
                              subIsActive
                                ? 'bg-blue-50 text-primary font-medium'
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            <SubIcon className={`text-sm ${subIsActive ? 'text-primary' : 'text-gray-400'}`} />
                            <span className="text-sm">{subItem.text}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`group flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-50 to-blue-100 text-primary font-medium shadow-sm'
                    : 'text-gray-700 hover:bg-gray-50 hover:shadow-sm'
                }`}
              >
                <Icon className={`text-lg transition-transform duration-200 ${isActive ? 'text-primary scale-110' : 'text-gray-500 group-hover:scale-110'}`} />
                <span className="transition-all">{item.text}</span>
                {isActive && (
                  <div className="ml-auto w-1 h-6 bg-primary rounded-full"></div>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Logout Confirmation Dialog */}
      <Dialog open={logoutConfirmOpen} onClose={() => setLogoutConfirmOpen(false)}>
        <DialogTitle>Xác nhận đăng xuất</DialogTitle>
        <DialogContent>
          <p>Bạn có chắc chắn muốn đăng xuất khỏi hệ thống quản trị?</p>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogoutConfirmOpen(false)} color="inherit">
            Hủy
          </Button>
          <Button onClick={confirmLogout} color="error" variant="contained">
            Đăng xuất
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}


