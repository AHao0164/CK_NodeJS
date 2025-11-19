import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import LoginPage from './pages/LoginPage.jsx';
import DashboardLayout from './pages/DashboardLayout.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import BrandsPage from './pages/BrandsPage.jsx';
import CategoriesPage from './pages/CategoriesPage.jsx';
import CustomersPage from './pages/CustomersPage.jsx';
import PromotionsPage from './pages/PromotionsPage.jsx';
import { AuthProvider, useAuth } from './state/AuthContext.jsx';

const theme = createTheme({
  palette: {
    primary: {
      main: '#2563eb',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
});

function PrivateRoute({ children }) {
  const { token, user } = useAuth();
  if (!token || !user || user.role !== 'ADMIN') return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
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
              <Route path="customers" element={<CustomersPage />} />
              <Route path="brands" element={<BrandsPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="promotions" element={<PromotionsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')).render(<App />);


