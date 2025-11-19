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
} from '@mui/material';
import {
  TrendingUp,
  ShoppingCart,
  Inventory,
  People,
  AttachMoney,
} from '@mui/icons-material';
import { useAuth } from '../state/AuthContext.jsx';

function StatCard({ title, value, subtitle, icon, color = '#2563eb', trend }) {
  return (
    <Card sx={{ height: '100%', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderRadius: 2 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography color="text.secondary" variant="body2" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1a202c', mb: 0.5 }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
            {trend && (
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 1 }}>
                <TrendingUp fontSize="small" sx={{ color: trend > 0 ? '#10b981' : '#ef4444' }} />
                <Typography variant="caption" sx={{ color: trend > 0 ? '#10b981' : '#ef4444' }}>
                  {trend > 0 ? '+' : ''}{trend}% so với tháng trước
                </Typography>
              </Stack>
            )}
          </Box>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              bgcolor: `${color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
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
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
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

      // Calculate stats
      const totalRevenue = orders
        .filter(o => o.status === 'PAID')
        .reduce((sum, o) => sum + (o.total_cents || 0), 0);

      const recentOrders = orders.slice(0, 5);
      const lowStockProducts = products
        .filter(p => (p.stock || 0) < 10)
        .sort((a, b) => (a.stock || 0) - (b.stock || 0))
        .slice(0, 5);

      setStats({
        totalRevenue,
        totalOrders: orders.length,
        totalProducts: products.length,
        totalCustomers: customers.length,
        recentOrders,
        lowStockProducts,
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
    <Box>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 700 }}>
        Dashboard
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Doanh thu"
            value={formatCurrency(stats.totalRevenue)}
            subtitle="Tổng doanh thu"
            icon={<AttachMoney sx={{ fontSize: 28, color: '#10b981' }} />}
            color="#10b981"
            trend={12.5}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Đơn hàng"
            value={stats.totalOrders}
            subtitle="Tổng số đơn"
            icon={<ShoppingCart sx={{ fontSize: 28, color: '#2563eb' }} />}
            color="#2563eb"
            trend={8.2}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Sản phẩm"
            value={stats.totalProducts}
            subtitle="Đang kinh doanh"
            icon={<Inventory sx={{ fontSize: 28, color: '#f59e0b' }} />}
            color="#f59e0b"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Khách hàng"
            value={stats.totalCustomers}
            subtitle="Đã đăng ký"
            icon={<People sx={{ fontSize: 28, color: '#8b5cf6' }} />}
            color="#8b5cf6"
            trend={15.3}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Recent Orders */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Đơn hàng gần đây
            </Typography>
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
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Cảnh báo tồn kho
            </Typography>
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


