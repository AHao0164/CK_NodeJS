import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Stack,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  Button,
} from '@mui/material';
import {
  TrendingUp,
  ShoppingCart,
  Inventory,
  People,
  AttachMoney,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../state/AuthContext.jsx';
import VI from '../constants/vi';
import { exportToExcel, formatRevenueForExport } from '../utils/exportExcel';

function StatCard({ title, value, subtitle, icon, color = '#2563eb', trend, gradient }) {
  return (
    <Card 
      sx={{ 
        height: '100%', 
        borderRadius: { xs: 2, sm: 3 },
        background: gradient || 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid',
        borderColor: 'rgba(0,0,0,0.05)',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: { xs: 'none', sm: 'translateY(-4px)' },
          boxShadow: { xs: '0 4px 6px -1px rgba(0,0,0,0.05)', sm: '0 20px 25px -5px rgba(0,0,0,0.08), 0 10px 10px -5px rgba(0,0,0,0.04)' },
        }
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 2.5, lg: 3 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ flex: 1 }}>
            <Typography 
              color="text.secondary" 
              variant="body2" 
              gutterBottom
              sx={{ fontWeight: 500, fontSize: '0.875rem' }}
            >
              {title}
            </Typography>
            <Typography 
              variant="h4" 
              sx={{ 
                fontWeight: 800, 
                color: '#0f172a',
                mb: 0.5,
                fontSize: { xs: '1.75rem', md: '2rem' },
                letterSpacing: '-0.02em'
              }}
            >
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                {subtitle}
              </Typography>
            )}
            {trend && (
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 1.5 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    bgcolor: trend > 0 ? '#dcfce7' : '#fee2e2',
                  }}
                >
                  <TrendingUp 
                    fontSize="small" 
                    sx={{ 
                      color: trend > 0 ? '#16a34a' : '#dc2626',
                      fontSize: '0.875rem',
                      transform: trend > 0 ? 'none' : 'rotate(180deg)'
                    }} 
                  />
                </Box>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: trend > 0 ? '#16a34a' : '#dc2626',
                    fontWeight: 600,
                    fontSize: '0.75rem'
                  }}
                >
                  {trend > 0 ? '+' : ''}{trend}%
                </Typography>
                <Typography 
                  variant="caption" 
                  color="text.secondary"
                  sx={{ fontSize: '0.75rem' }}
                >
                  so với tháng trước
                </Typography>
              </Stack>
            )}
          </Box>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: 2.5,
              background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 8px 16px -4px ${color}40`,
              ml: { xs: 2, sm: 3 },
              flexShrink: 0
            }}
          >
            {icon}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { api } = useAuth();
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalProducts: 0,
    totalCustomers: 0,
    recentOrders: [],
    lowStockProducts: [],
    topProducts: [],
    revenueChart: [],
    ordersChart: [],
    categoryChart: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    
    // Listen for order status updates from OrdersPage
    const handleStorageChange = (e) => {
      if (e.key === 'dashboard_refresh') {
        loadDashboardData();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also check localStorage periodically (for same-tab updates)
    const interval = setInterval(() => {
      const lastUpdate = localStorage.getItem('dashboard_refresh');
      if (lastUpdate && Date.now() - parseInt(lastUpdate) < 1000) {
        loadDashboardData();
      }
    }, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [ordersRes, productsRes, customersRes] = await Promise.all([
        api.get('/admin/orders', { params: { limit: 100 } }).catch(() => ({ data: [] })),
        api.get('/admin/catalog/products', { params: { pageSize: 100 } }).catch(() => ({ data: { items: [] } })),
        api.get('/admin/users', { params: { limit: 100 } }).catch(() => ({ data: [] })),
      ]);

      const orders = ordersRes.data || [];
      const products = productsRes.data?.items || [];
      const customers = customersRes.data || [];

      // Calculate current month stats
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      // Last month
      const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
      const lastMonth = lastMonthDate.getMonth();
      const lastMonthYear = lastMonthDate.getFullYear();

      const currentMonthOrders = orders.filter(o => {
        const orderDate = new Date(o.created_at);
        return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
      });

      const lastMonthOrders = orders.filter(o => {
        const orderDate = new Date(o.created_at);
        return orderDate.getMonth() === lastMonth && orderDate.getFullYear() === lastMonthYear;
      });

      const currentMonthRevenue = currentMonthOrders
        .filter(o => o.status === 'DELIVERED')
        .reduce((sum, o) => sum + (o.total_cents || 0), 0);

      const lastMonthRevenue = lastMonthOrders
        .filter(o => o.status === 'DELIVERED')
        .reduce((sum, o) => sum + (o.total_cents || 0), 0);

      const currentMonthOrderCount = currentMonthOrders.length;
      const lastMonthOrderCount = lastMonthOrders.length;

      // Calculate trends
      const revenueTrend = lastMonthRevenue === 0 ? null : 
        ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1);
      
      const ordersTrend = lastMonthOrderCount === 0 ? null :
        ((currentMonthOrderCount - lastMonthOrderCount) / lastMonthOrderCount * 100).toFixed(1);

      // Calculate stats
      const totalRevenue = orders
        .filter(o => o.status === 'DELIVERED')
        .reduce((sum, o) => sum + (o.total_cents || 0), 0);

      const recentOrders = orders.slice(0, 5);
      const lowStockProducts = products
        .filter(p => (p.stock || 0) < 10)
        .sort((a, b) => (a.stock || 0) - (b.stock || 0))
        .slice(0, 5);

      // Generate chart data (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return date.toISOString().split('T')[0];
      });

      const revenueChart = last7Days.map(date => {
        const dayOrders = orders.filter(o => 
          o.created_at?.startsWith(date) && o.status === 'DELIVERED'
        );
        const revenue = dayOrders.reduce((sum, o) => sum + (o.total_cents || 0), 0) / 100;
        return {
          date: new Date(date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
          revenue: Math.round(revenue),
        };
      });

      const ordersChart = last7Days.map(date => {
        const dayOrders = orders.filter(o => o.created_at?.startsWith(date));
        return {
          date: new Date(date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
          orders: dayOrders.length,
        };
      });

      // Category distribution
      const categoryCount = {};
      products.forEach(p => {
        const cat = p.category || 'Khác';
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      });
      const categoryChart = Object.entries(categoryCount).map(([name, value]) => ({
        name,
        value,
      }));

      setStats({
        totalRevenue,
        totalOrders: orders.length,
        totalProducts: products.length,
        totalCustomers: customers.length,
        recentOrders,
        lowStockProducts,
        revenueChart,
        ordersChart,
        categoryChart,
        revenueTrend,
        ordersTrend,
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(cents);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PAID':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'CANCELLED':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'PAID':
        return 'Đã thanh toán';
      case 'PENDING':
        return 'Chờ xử lý';
      case 'CANCELLED':
        return 'Đã hủy';
      default:
        return status;
    }
  };

  if (loading) {
    return <LinearProgress />;
  }

  return (
    <Box sx={{ pb: { xs: 3, sm: 4, lg: 6 } }}>
      {/* Header */}
      <Stack 
        direction={{ xs: 'column', sm: 'row' }} 
        justifyContent="space-between" 
        alignItems={{ xs: 'flex-start', sm: 'center' }} 
        sx={{ mb: { xs: 3, sm: 4 }, gap: 2 }}
      >
        <Box>
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 800, 
              color: '#0f172a',
              mb: 1,
              letterSpacing: '-0.02em',
              fontSize: { xs: '1.5rem', sm: '2rem', lg: '2.25rem' }
            }}
          >
            Tổng Quan
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
            Tổng quan hoạt động kinh doanh của bạn
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="success"
          startIcon={<AttachMoney />}
          onClick={() => {
            const deliveredOrders = stats.recentOrders?.filter(o => o.status === 'DELIVERED') || [];
            exportToExcel(formatRevenueForExport(deliveredOrders), 'DoanhThu', 'Doanh thu');
          }}
          sx={{ 
            borderRadius: 2,
            px: { xs: 2, sm: 3 },
            py: { xs: 1, sm: 1.5 },
            fontSize: { xs: '0.875rem', sm: '1rem' },
            width: { xs: '100%', sm: 'auto' }
          }}
        >
          Xuất báo cáo doanh thu
        </Button>
      </Stack>

      {/* Stats Cards */}
      <Grid container spacing={{ xs: 2, sm: 3, lg: 3 }} sx={{ mb: { xs: 3, sm: 4 } }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Doanh thu"
            value={formatCurrency(stats.totalRevenue)}
            subtitle="Tổng doanh thu"
            icon={<AttachMoney sx={{ fontSize: 32, color: 'white' }} />}
            color="#10b981"
            gradient="linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)"
            trend={stats.revenueTrend}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Đơn hàng"
            value={stats.totalOrders}
            subtitle="Tổng số đơn"
            icon={<ShoppingCart sx={{ fontSize: 32, color: 'white' }} />}
            color="#3b82f6"
            gradient="linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)"
            trend={stats.ordersTrend}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Sản phẩm"
            value={stats.totalProducts}
            subtitle="Đang kinh doanh"
            icon={<Inventory sx={{ fontSize: 32, color: 'white' }} />}
            color="#f59e0b"
            gradient="linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Khách hàng"
            value={stats.totalCustomers}
            subtitle="Đã đăng ký"
            icon={<People sx={{ fontSize: 32, color: 'white' }} />}
            color="#a855f7"
            gradient="linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)"
          />
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={{ xs: 2, sm: 3, lg: 3 }} sx={{ mb: { xs: 3, sm: 4 } }}>
        {/* Revenue Chart */}
        <Grid item xs={12} lg={8}>
          <Paper 
            sx={{ 
              p: { xs: 2, sm: 3 }, 
              borderRadius: 3, 
              border: '1px solid',
              borderColor: 'rgba(0,0,0,0.05)',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: { xs: 2, sm: 3 } }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', mb: 0.5, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                  Doanh thu 7 ngày gần đây
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                  Theo dõi xu hướng doanh thu của bạn
                </Typography>
              </Box>
            </Stack>
            <Box sx={{ width: '100%', height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.revenueChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    stroke="#e2e8f0"
                  />
                  <YAxis 
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    stroke="#e2e8f0"
                    tickFormatter={(value) => `${(value / 1000)}K`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                    formatter={(value) => [`${value.toLocaleString('vi-VN')} ₫`, 'Doanh thu']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    dot={{ fill: '#10b981', r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        {/* Category Distribution */}
        <Grid item xs={12} lg={4}>
          <Paper 
            sx={{ 
              p: 3, 
              borderRadius: 3, 
              border: '1px solid',
              borderColor: 'rgba(0,0,0,0.05)',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            }}
          >
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', mb: 0.5 }}>
                Phân bổ danh mục
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Top {Math.min(stats.categoryChart.length, 8)} danh mục
              </Typography>
            </Box>
            <Box sx={{ width: '100%', height: 340 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.categoryChart.slice(0, 8)}
                    cx="50%"
                    cy="45%"
                    labelLine={false}
                    label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                    outerRadius={100}
                    innerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                    paddingAngle={3}
                  >
                    {stats.categoryChart.slice(0, 8).map((entry, index) => {
                      const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6'];
                      return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                    })}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '13px',
                      padding: '8px 12px'
                    }}
                    formatter={(value, name, props) => [`${value} SP`, props.payload.name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, mt: 1 }}>
              {stats.categoryChart.slice(0, 8).map((cat, index) => {
                const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6'];
                return (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: COLORS[index % COLORS.length], flexShrink: 0 }} />
                    <Typography variant="caption" sx={{ fontSize: '11px', color: '#64748b', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cat.name.length > 15 ? cat.name.substring(0, 15) + '...' : cat.name}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Paper>
        </Grid>

        {/* Orders Chart */}
        <Grid item xs={12}>
          <Paper 
            sx={{ 
              p: 3, 
              borderRadius: 3, 
              border: '1px solid',
              borderColor: 'rgba(0,0,0,0.05)',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            }}
          >
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', mb: 0.5 }}>
                Số lượng đơn hàng theo ngày
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Theo dõi số lượng đơn hàng trong tuần
              </Typography>
            </Box>
            <Box sx={{ width: '100%', height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.ordersChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    stroke="#e2e8f0"
                  />
                  <YAxis 
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    stroke="#e2e8f0"
                    allowDecimals={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                    formatter={(value) => [`${value}`, 'Đơn hàng']}
                  />
                  <Bar 
                    dataKey="orders" 
                    fill="#2563eb" 
                    radius={[8, 8, 0, 0]}
                    maxBarSize={60}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Recent Orders */}
        <Grid item xs={12} lg={7}>
          <Paper 
            sx={{ 
              p: 3, 
              borderRadius: 3, 
              border: '1px solid',
              borderColor: 'rgba(0,0,0,0.05)',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            }}
          >
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', mb: 0.5 }}>
                Đơn hàng gần đây
              </Typography>
              <Typography variant="caption" color="text.secondary">
                5 đơn hàng mới nhất
              </Typography>
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Khách hàng</TableCell>
                  <TableCell>Ngày</TableCell>
                  <TableCell align="right">Tổng tiền</TableCell>
                  <TableCell>Trạng thái</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stats.recentOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography color="text.secondary" variant="body2">
                        Chưa có đơn hàng nào
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  stats.recentOrders.map((order) => (
                    <TableRow key={order.id} hover>
                      <TableCell>#{order.id}</TableCell>
                      <TableCell>User #{order.user_id}</TableCell>
                      <TableCell>{formatDate(order.created_at)}</TableCell>
                      <TableCell align="right">{formatCurrency(order.total_cents)}</TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusLabel(order.status)}
                          color={getStatusColor(order.status)}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Paper>
        </Grid>

        {/* Low Stock Alert */}
        <Grid item xs={12} lg={5}>
          <Paper 
            sx={{ 
              p: 3, 
              borderRadius: 3, 
              border: '1px solid',
              borderColor: 'rgba(0,0,0,0.05)',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
              background: 'linear-gradient(135deg, #ffffff 0%, #fff7ed 100%)',
            }}
          >
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', mb: 0.5 }}>
                ⚠️ Cảnh báo tồn kho
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Sản phẩm sắp hết hàng
              </Typography>
            </Box>
            {stats.lowStockProducts.length === 0 ? (
              <Typography color="text.secondary" variant="body2" sx={{ textAlign: 'center', py: 4 }}>
                Tất cả sản phẩm đều có đủ hàng
              </Typography>
            ) : (
              <Stack spacing={2}>
                {stats.lowStockProducts.map((product) => (
                  <Box
                    key={product.id}
                    sx={{
                      p: 2,
                      borderRadius: 1,
                      bgcolor: product.stock === 0 ? '#fef2f2' : '#fffbeb',
                      border: 1,
                      borderColor: product.stock === 0 ? '#fecaca' : '#fed7aa',
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {product.name}
                      </Typography>
                      <Chip
                        label={`Còn ${product.stock || 0}`}
                        size="small"
                        color={product.stock === 0 ? 'error' : 'warning'}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {product.brand} • {formatCurrency(product.price_cents)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}


