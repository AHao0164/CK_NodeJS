# Frontend - Laptop E-commerce

Frontend hiện đại cho hệ thống e-commerce bán laptop được xây dựng bằng React + Vite, với thiết kế đẹp mắt và trải nghiệm người dùng tuyệt vời.

## ✨ Tính năng

### 🛍️ Chức năng E-commerce đầy đủ
- **Trang chủ**: Hero section với hiệu ứng 3D, danh sách sản phẩm nổi bật, lọc và tìm kiếm
- **Danh sách sản phẩm**: Xem tất cả sản phẩm với phân trang và sắp xếp
- **Chi tiết sản phẩm**: Thông tin chi tiết, hình ảnh, thêm vào giỏ hàng
- **Giỏ hàng**: Quản lý sản phẩm trong giỏ hàng
- **Thanh toán**: Nhập thông tin giao hàng và thanh toán
- **Đơn hàng**: Theo dõi đơn hàng và lịch sử mua hàng
- **Hồ sơ người dùng**: Quản lý thông tin cá nhân

### 🎨 Giao diện hiện đại
- **Dark Mode**: Hỗ trợ chế độ sáng/tối với ThemeProvider
- **Responsive**: Tối ưu cho mọi kích thước màn hình
- **Animations**: Hiệu ứng mượt mà với Framer Motion và GSAP
- **3D Effects**: Hiệu ứng 3D với Three.js
- **Modern UI**: Card components, buttons, form elements với Tailwind CSS

### 🔐 Xác thực & Bảo mật
- **Login/Register**: Đăng nhập và đăng ký tài khoản
- **JWT Authentication**: Xác thực dựa trên token
- **Protected Routes**: Bảo vệ các trang yêu cầu đăng nhập

### 🚀 Hiệu năng
- **Code Splitting**: Tối ưu tải trang
- **Lazy Loading**: Tải hình ảnh và components theo yêu cầu
- **Caching**: Cache dữ liệu để giảm số lần gọi API

## 🛠️ Tech Stack

- **React 19.1.1** - UI Library
- **Vite** - Build tool và dev server
- **React Router 6** - Routing
- **Axios** - HTTP client
- **Tailwind CSS 3.4** - Utility-first CSS framework
- **Framer Motion 12** - Animation library
- **GSAP 3.13** - Animation library
- **Three.js 0.180** - 3D graphics
- **React Icons 5.5** - Icon library
- **React Slick** - Carousel component

## 📦 Cài đặt

```bash
# Di chuyển vào thư mục frontend
cd frontend

# Cài đặt dependencies
npm install

# Chạy development server
npm run dev

# Build cho production
npm run build

# Preview production build
npm run preview
```

## 🌐 Environment Variables

Tạo file `.env` trong thư mục `frontend`:

```env
VITE_API_BASE=http://localhost:8080
```

## 📁 Cấu trúc thư mục

```
frontend/
├── public/              # Static assets
│   └── images/         # Hình ảnh sản phẩm, category, hero
├── src/
│   ├── api/            # API client và helpers
│   │   ├── auth.js
│   │   ├── cart.js
│   │   ├── catalog.js
│   │   └── client.js
│   ├── components/     # React components
│   │   ├── Auth/       # Login, Register
│   │   ├── Background/ # Background effects
│   │   ├── Category/   # Category components
│   │   ├── Hero/       # Hero section
│   │   ├── Navbar/     # Navigation
│   │   ├── Product/    # Product components
│   │   ├── Shared/     # Shared components
│   │   ├── ui/         # UI primitives (Button, Card, Chip)
│   │   ├── Banner.jsx
│   │   ├── FiltersBar.jsx
│   │   ├── Footer.jsx
│   │   ├── Header.jsx
│   │   └── ProductCard.jsx
│   ├── context/        # React Context
│   │   └── AuthContext.jsx
│   ├── pages/          # Page components
│   │   ├── Cart.jsx
│   │   ├── Checkout.jsx
│   │   ├── Home.jsx
│   │   ├── OrderDetail.jsx
│   │   ├── Orders.jsx
│   │   ├── ProductDetailPage.jsx
│   │   ├── Products.jsx
│   │   └── Profile.jsx
│   ├── services/       # Business logic và API calls
│   │   ├── auth.js
│   │   ├── cart.js
│   │   ├── catalog.js
│   │   └── orders.js
│   ├── ui/             # UI utilities
│   │   ├── ThemeProvider.jsx
│   │   └── Toast.jsx
│   ├── App.jsx         # Main App component
│   ├── index.css       # Global styles
│   └── main.jsx        # Entry point
├── index.html
├── package.json
├── tailwind.config.js
└── vite.config.js
```

## 🎯 Routes

| Route | Component | Mô tả |
|-------|-----------|-------|
| `/` | Home | Trang chủ với Hero và danh sách sản phẩm |
| `/products` | Products | Danh sách tất cả sản phẩm |
| `/product/:id` | ProductDetail | Chi tiết sản phẩm |
| `/cart` | Cart | Giỏ hàng |
| `/checkout` | Checkout | Thanh toán |
| `/orders` | Orders | Danh sách đơn hàng |
| `/orders/:id` | OrderDetail | Chi tiết đơn hàng |
| `/login` | Login | Đăng nhập |
| `/register` | Register | Đăng ký |
| `/signup` | Register | Đăng ký (alias) |
| `/profile` | Profile | Hồ sơ người dùng |

## 🎨 Theme

Frontend hỗ trợ Dark Mode với ThemeProvider. Theme được lưu trong localStorage và tự động áp dụng khi người dùng quay lại.

```jsx
import { useTheme } from './ui/ThemeProvider'

function Component() {
  const { theme, toggle } = useTheme()
  return <button onClick={toggle}>{theme === 'light' ? '🌙' : '☀️'}</button>
}
```

## 🔔 Toast Notifications

Hiển thị thông báo cho người dùng với Toast Provider:

```jsx
import { useToast } from './ui/Toast'

function Component() {
  const toast = useToast()
  
  function handleSuccess() {
    toast.show('✓ Thành công!', { type: 'success' })
  }
  
  function handleError() {
    toast.show('❌ Có lỗi xảy ra', { type: 'error' })
  }
}
```

## 🔒 Authentication

Authentication được quản lý bởi AuthContext:

```jsx
import { useAuth } from './context/AuthContext'

function Component() {
  const { token, user, api, login, logout } = useAuth()
  
  // token: JWT token
  // user: User object
  // api: Axios instance với token
  // login(token, user): Đăng nhập
  // logout(): Đăng xuất
}
```

## 📝 Notes

- Tất cả các trang và components đều responsive
- Dark mode được hỗ trợ toàn bộ
- Animation và transitions mượt mà
- Code được tổ chức rõ ràng và dễ bảo trì
- Tích hợp đầy đủ với backend API

## 🤝 Contributing

Vui lòng đọc [CONTRIBUTING.md](../CONTRIBUTING.md) để biết chi tiết về quy trình đóng góp.

## 📄 License

[MIT](../LICENSE)
