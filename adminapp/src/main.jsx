import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './index.css';
import LoginPage from './pages/LoginPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import DashboardLayout from './pages/DashboardLayout.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import BrandsPage from './pages/BrandsPage.jsx';
import CategoriesPage from './pages/CategoriesPage.jsx';
import CustomersPage from './pages/CustomersPage.jsx';
import PromotionsPage from './pages/PromotionsPage.jsx';
import BannersPage from './pages/BannersPage.jsx';
import ReviewsPage from './pages/ReviewsPage.jsx';
import AdminProfilePage from './pages/AdminProfilePage.jsx';
import { AuthProvider, useAuth } from './state/AuthContext.jsx';

function PrivateRoute({ children }) {
  const { token, user } = useAuth();
  if (!token || !user || user.role !== 'ADMIN') return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ToastContainer 
          position="top-right" 
          autoClose={3000} 
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <DashboardLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="reviews" element={<ReviewsPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="brands" element={<BrandsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="promotions" element={<PromotionsPage />} />
            <Route path="banners" element={<BannersPage />} />
            <Route path="profile" element={<AdminProfilePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

createRoot(document.getElementById('root')).render(<App />);


