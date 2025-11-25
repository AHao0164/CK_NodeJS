import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Stack,
  Paper,
  Chip,
  LinearProgress,
  Tabs,
  Tab,
  Select,
  MenuItem,
  TextField,
  Alert,
} from '@mui/material';
import {
  TrendingUp,
  ShoppingCart,
  Inventory,
  People,
  AttachMoney,
  ErrorOutline,
  BarChart as BarChartIcon,
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

function StatCard({ title, value, subtitle, icon, color = '#2563eb', trend }) {
  return (
    <Card 
      sx={{ 
        height: '100%', 
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
        borderRadius: 3,
        border: `1px solid ${color}20`,
        transition: 'all 0.3s ease',
        background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
        }
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ flex: 1 }}>
            <Typography 
              color="text.secondary" 
              variant="body2" 
              gutterBottom
              sx={{ 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontSize: '0.75rem',
                color: '#6b7280'
              }}
            >
              {title}
            </Typography>
            <Typography 
              variant="h4" 
              sx={{ 
                fontWeight: 800, 
                color: '#1a202c', 
                mb: 0.5,
                fontSize: { xs: '1.75rem', sm: '2.25rem' },
                lineHeight: 1.2
              }}
            >
              {value}
            </Typography>
            {subtitle && (
              <Typography 
                variant="caption" 
                color="text.secondary"
                sx={{ 
                  fontSize: '0.85rem',
                  display: 'block',
                  mt: 0.5,
                  color: '#9ca3af'
                }}
              >
                {subtitle}
              </Typography>
            )}
            {trend && (
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 1.5 }}>
                <TrendingUp fontSize="small" sx={{ color: trend > 0 ? '#10b981' : '#ef4444' }} />
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: trend > 0 ? '#10b981' : '#ef4444',
                    fontWeight: 600,
                    fontSize: '0.75rem'
                  }}
                >
                  {trend > 0 ? '+' : ''}{trend}% so với tháng trước
                </Typography>
              </Stack>
            )}
          </Box>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: 2.5,
              background: `linear-gradient(135deg, ${color}15 0%, ${color}25 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `2px solid ${color}30`,
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'scale(1.1) rotate(5deg)',
                background: `linear-gradient(135deg, ${color}25 0%, ${color}35 100%)`,
              }
            }}
          >
            {icon}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function SimpleDashboard({ api }) {
  const [stats, setStats] = useState({
    totalUsers: 0,
    newUsers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    bestSellingProducts: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading dashboard data...');
      
      let simpleData = {};
      let userData = {};
      
      try {
        const simpleRes = await api.get('/admin/dashboard/simple');
        simpleData = simpleRes.data || {};
        console.log('✅ Simple stats response:', simpleData);
        console.log('  - Total orders:', simpleData.totalOrders);
        console.log('  - Total revenue:', simpleData.totalRevenue);
        console.log('  - Best selling products count:', simpleData.bestSellingProducts?.length || 0);
        if (simpleData.bestSellingProducts?.length > 0) {
          console.log('  - Sample product:', simpleData.bestSellingProducts[0]);
        }
      } catch (err) {
        console.error('❌ Failed to load simple stats:', err.response?.data || err.message);
        setError(`Lỗi tải dữ liệu dashboard: ${err.response?.data?.error || err.message}`);
      }
      
      try {
        const userRes = await api.get('/admin/dashboard/users');
        userData = userRes.data || {};
        console.log('✅ User stats response:', userData);
      } catch (err) {
        console.error('❌ Failed to load user stats:', err.response?.data || err.message);
      }

      console.log('📊 Final parsed data:', { 
        simpleData, 
        userData,
        bestSellingProducts: simpleData.bestSellingProducts?.length || 0
      });

      setStats({
        totalUsers: userData.totalUsers ?? simpleData.totalUsers ?? 0,
        newUsers: userData.newUsers ?? simpleData.newUsers ?? 0,
        totalOrders: simpleData.totalOrders ?? 0,
        totalRevenue: simpleData.totalRevenue ?? 0,
        bestSellingProducts: simpleData.bestSellingProducts || [],
      });
    } catch (error) {
      console.error('❌ Failed to load dashboard data:', error);
      setError(`Lỗi: ${error.message}`);
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

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

  if (loading) {
    return (
      <Box>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 700 }}>
          Dashboard Tổng Quan
        </Typography>
        <LinearProgress />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Đang tải dữ liệu...
        </Typography>
      </Box>
    );
  }

  // Prepare chart data
  console.log('🔍 Preparing chart data from:', stats.bestSellingProducts);
  
  const chartData = (stats.bestSellingProducts || [])
    .slice(0, 10)
    .map((p, index) => {
      const quantity = Number(p.quantity) || 0;
      const revenue = Number(p.revenue) || 0;
      const name = p.name || `Sản phẩm #${p.product_id}`;
      return {
        name: name.length > 20 ? name.substring(0, 20) + '...' : name,
        quantity: quantity,
        revenue: revenue,
        fullName: name,
        product_id: p.product_id,
      };
    })
    .filter(item => {
      const hasData = item.quantity > 0 || item.revenue > 0;
      if (!hasData) {
        console.log('⚠️ Filtered out item with no data:', item);
      }
      return hasData;
    });

  const pieChartData = (stats.bestSellingProducts || [])
    .slice(0, 5)
    .map((p) => {
      const revenue = Number(p.revenue) || 0;
      const name = p.name || `Sản phẩm #${p.product_id}`;
      return {
        name: name.length > 30 ? name.substring(0, 30) + '...' : name,
        revenue: revenue,
        fullName: name,
        product_id: p.product_id,
      };
    })
    .filter(item => {
      const hasData = item.revenue > 0;
      if (!hasData) {
        console.log('⚠️ Filtered out pie item with no revenue:', item);
      }
      return hasData;
    });

  console.log('📊 Dashboard Stats:', {
    totalUsers: stats.totalUsers,
    totalOrders: stats.totalOrders,
    totalRevenue: stats.totalRevenue,
    bestSellingProductsCount: stats.bestSellingProducts?.length || 0,
    chartDataLength: chartData.length,
    pieChartDataLength: pieChartData.length,
    bestSellingProducts: stats.bestSellingProducts,
    chartData: chartData,
    pieChartData: pieChartData,
  });
  
  console.log('✅ Chart render conditions:', {
    'chartData.length > 0': chartData.length > 0,
    'pieChartData.length > 0': pieChartData.length > 0,
    'stats.bestSellingProducts?.length': stats.bestSellingProducts?.length,
  });

  return (
    <Box sx={{ pb: 4, width: '100%', maxWidth: '100%' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#1a202c', mb: 0.5 }}>
            Dashboard Tổng Quan
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Tổng quan về hiệu suất và hoạt động của cửa hàng
          </Typography>
        </Box>
        <Chip
          label={error ? 'Có lỗi xảy ra' : 'Đã tải xong'}
          color={error ? 'error' : 'success'}
          size="small"
          sx={{ fontWeight: 600 }}
        />
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4, width: '100%' }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Tổng số người dùng"
            value={stats.totalUsers}
            subtitle="Người dùng đã đăng ký"
            icon={<People sx={{ fontSize: 28, color: '#8b5cf6' }} />}
            color="#8b5cf6"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Người dùng mới"
            value={stats.newUsers}
            subtitle="Tháng này"
            icon={<People sx={{ fontSize: 28, color: '#10b981' }} />}
            color="#10b981"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Tổng đơn hàng"
            value={stats.totalOrders}
            subtitle="Tất cả đơn hàng"
            icon={<ShoppingCart sx={{ fontSize: 28, color: '#2563eb' }} />}
            color="#2563eb"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Tổng doanh thu"
            value={formatCurrency(stats.totalRevenue)}
            subtitle="Từ đơn đã thanh toán"
            icon={<AttachMoney sx={{ fontSize: 28, color: '#10b981' }} />}
            color="#10b981"
          />
        </Grid>
      </Grid>

      {/* Charts - Each chart on its own row */}
      <Grid container spacing={3} sx={{ width: '100%', margin: 0 }}>
        {/* Top 10 Best Selling Products - Bar Chart */}
        <Grid item xs={12} sx={{ width: '100%', padding: '0 !important', marginBottom: 3 }}>
          <Paper 
            sx={{ 
              p: 4, 
              borderRadius: 3, 
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
              border: '1px solid #e5e7eb',
              background: 'linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%)',
              width: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
              <BarChartIcon sx={{ fontSize: 28, color: '#2563eb' }} />
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 700,
                  color: '#1a202c',
                  fontSize: '1.25rem',
                }}
              >
                Top 10 Sản Phẩm Bán Chạy
              </Typography>
            </Stack>
            {chartData.length > 0 ? (
              <Box 
                sx={{ 
                  width: '100%', 
                  height: 500, 
                  flex: 1, 
                  position: 'relative',
                  minHeight: 500,
                  backgroundColor: '#fafafa'
                }}
              >
                {(() => {
                  console.log('🎨 Rendering BarChart with data:', chartData);
                  try {
                    return (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          data={chartData} 
                          margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                          onMouseEnter={() => console.log('Chart mouse enter')}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="name" 
                            angle={-45} 
                            textAnchor="end" 
                            height={120} 
                            stroke="#6b7280"
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis 
                            stroke="#6b7280"
                            tick={{ fontSize: 12 }}
                          />
                          <Tooltip 
                            formatter={(value) => value.toLocaleString('vi-VN')}
                            contentStyle={{
                              backgroundColor: '#ffffff',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                              fontSize: '14px'
                            }}
                            labelStyle={{ fontWeight: 600, marginBottom: '8px' }}
                          />
                          <Legend wrapperStyle={{ paddingTop: '20px' }} />
                          <Bar 
                            dataKey="quantity" 
                            fill="#2563eb" 
                            name="Số lượng bán"
                            radius={[8, 8, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    );
                  } catch (error) {
                    console.error('❌ Error rendering BarChart:', error);
                    return (
                      <Box sx={{ p: 3, textAlign: 'center' }}>
                        <Typography color="error">Lỗi render biểu đồ: {error.message}</Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          {error.stack}
                        </Typography>
                      </Box>
                    );
                  }
                })()}
              </Box>
            ) : (
              <Box 
                sx={{ 
                  height: 500, 
                  minHeight: 500,
                  width: '100%',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  flexDirection: 'column',
                  border: '2px dashed #e2e8f0',
                  borderRadius: 2,
                  bgcolor: '#f8fafc',
                  flex: 1
                }}
              >
                <Inventory sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                  Chưa có dữ liệu sản phẩm bán chạy
                </Typography>
                <Typography variant="body2" color="text.secondary" align="center" sx={{ maxWidth: 400 }}>
                  Dữ liệu sẽ hiển thị khi có đơn hàng đã thanh toán.
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Top 5 Products by Revenue - Pie Chart */}
        <Grid item xs={12} sx={{ width: '100%', padding: '0 !important' }}>
          <Paper 
            sx={{ 
              p: 4, 
              borderRadius: 3, 
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
              border: '1px solid #e5e7eb',
              background: 'linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%)',
              width: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
              <AttachMoney sx={{ fontSize: 28, color: '#10b981' }} />
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 700,
                  color: '#1a202c',
                  fontSize: '1.25rem',
                }}
              >
                Top 5 Sản Phẩm (Doanh Thu)
              </Typography>
            </Stack>
            {pieChartData.length > 0 ? (
              <Box 
                sx={{ 
                  width: '100%', 
                  height: 500, 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  flex: 1, 
                  position: 'relative',
                  minHeight: 500,
                  backgroundColor: '#fafafa'
                }}
              >
                {(() => {
                  console.log('🎨 Rendering PieChart with data:', pieChartData);
                  try {
                    return (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieChartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, revenue }) => {
                              const shortName = name?.length > 25 ? name.substring(0, 25) + '...' : name;
                              return `${shortName}: ${formatCurrency(revenue)}`;
                            }}
                            outerRadius={160}
                            fill="#8884d8"
                            dataKey="revenue"
                          >
                            {pieChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value) => formatCurrency(value)}
                            contentStyle={{
                              backgroundColor: '#ffffff',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                              fontSize: '14px'
                            }}
                          />
                          <Legend 
                            wrapperStyle={{ paddingTop: '20px' }}
                            formatter={(value) => {
                              const item = pieChartData.find(d => d.name === value);
                              return item ? `${value}: ${formatCurrency(item.revenue)}` : value;
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    );
                  } catch (error) {
                    console.error('❌ Error rendering PieChart:', error);
                    return (
                      <Box sx={{ p: 3, textAlign: 'center' }}>
                        <Typography color="error">Lỗi render biểu đồ: {error.message}</Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          {error.stack}
                        </Typography>
                      </Box>
                    );
                  }
                })()}
              </Box>
            ) : (
              <Box 
                sx={{ 
                  height: 500, 
                  minHeight: 500,
                  width: '100%',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  flexDirection: 'column',
                  border: '2px dashed #e2e8f0',
                  borderRadius: 2,
                  bgcolor: '#f8fafc',
                  flex: 1
                }}
              >
                <Inventory sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" align="center" sx={{ mb: 1 }}>
                  Chưa có dữ liệu
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  Sẽ hiển thị khi có đơn hàng đã thanh toán
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

function AdvancedDashboard({ api }) {
  const [interval, setInterval] = useState('year');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState({
    revenueProfit: [],
    productsSold: [],
    categoriesSold: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAdvancedData();
  }, [interval, startDate, endDate]);

  const loadAdvancedData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { interval };
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }
      
      console.log('Loading advanced dashboard with params:', params);
      
      const response = await api.get('/admin/dashboard/advanced', { params }).catch((err) => {
        console.error('❌ Failed to load advanced stats:', err.response?.data || err.message);
        throw err;
      });
      
      console.log('✅ Advanced stats response:', response.data);
      setData(response.data || { revenueProfit: [], productsSold: [], categoriesSold: [] });
    } catch (error) {
      console.error('❌ Failed to load advanced dashboard data:', error);
      setError(`Lỗi: ${error.response?.data?.error || error.message}`);
      setData({ revenueProfit: [], productsSold: [], categoriesSold: [] });
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

  const revenueProfitData = (data.revenueProfit || []).map((item) => ({
    period: item.period,
    revenue: (item.revenue || 0) / 1000000, // Convert to millions
    profit: (item.profit || 0) / 1000000,
  }));

  const productsData = (data.productsSold || []).map((item) => ({
    period: item.period,
    uniqueProducts: item.unique_products || 0,
    totalProductsSold: item.total_products_sold || 0,
  }));

  if (loading) {
    return (
      <Box>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 700 }}>
          Dashboard Nâng Cao
        </Typography>
        <LinearProgress />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Đang tải dữ liệu...
        </Typography>
      </Box>
    );
  }

  const totalOrders = (data.revenueProfit || []).reduce((sum, item) => sum + (item.orders_count || 0), 0);
  const totalRevenue = (data.revenueProfit || []).reduce((sum, item) => sum + (item.revenue || 0), 0);
  const totalProfit = (data.revenueProfit || []).reduce((sum, item) => sum + (item.profit || 0), 0);

  return (
    <Box sx={{ pb: 4, width: '100%', maxWidth: '100%' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#1a202c', mb: 0.5 }}>
            Dashboard Nâng Cao
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Phân tích chi tiết theo khoảng thời gian
          </Typography>
        </Box>
        <Chip
          label={error ? 'Có lỗi xảy ra' : 'Đã tải xong'}
          color={error ? 'error' : 'success'}
          size="small"
          sx={{ fontWeight: 600 }}
        />
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Paper 
        sx={{ 
          p: 3, 
          mb: 4, 
          borderRadius: 3, 
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
          border: '1px solid #e5e7eb',
          background: 'linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%)',
          width: '100%'
        }}
      >
        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: '#374151' }}>
          Lọc theo khoảng thời gian
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Select
            size="small"
            value={interval}
            onChange={(e) => {
              setInterval(e.target.value);
              setStartDate('');
              setEndDate('');
            }}
            sx={{ 
              minWidth: 150,
              borderRadius: 2,
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: '#d1d5db',
              }
            }}
            disabled={!!(startDate && endDate)}
          >
            <MenuItem value="year">Năm</MenuItem>
            <MenuItem value="quarter">Quý</MenuItem>
            <MenuItem value="month">Tháng</MenuItem>
            <MenuItem value="week">Tuần</MenuItem>
          </Select>
          <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
            hoặc
          </Typography>
          <TextField
            size="small"
            type="date"
            label="Từ ngày"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (e.target.value) setInterval('');
            }}
            InputLabelProps={{ shrink: true }}
            sx={{ 
              borderRadius: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              }
            }}
          />
          <TextField
            size="small"
            type="date"
            label="Đến ngày"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              if (e.target.value) setInterval('');
            }}
            InputLabelProps={{ shrink: true }}
            sx={{ 
              borderRadius: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              }
            }}
          />
        </Stack>
      </Paper>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4, width: '100%' }}>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Tổng số đơn hàng"
            value={totalOrders}
            subtitle="Trong khoảng thời gian đã chọn"
            icon={<ShoppingCart sx={{ fontSize: 28, color: '#2563eb' }} />}
            color="#2563eb"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Tổng doanh thu"
            value={formatCurrency(totalRevenue)}
            subtitle="Từ đơn đã thanh toán"
            icon={<AttachMoney sx={{ fontSize: 28, color: '#10b981' }} />}
            color="#10b981"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Tổng lợi nhuận"
            value={formatCurrency(totalProfit)}
            subtitle="Ước tính 30% doanh thu"
            icon={<TrendingUp sx={{ fontSize: 28, color: '#f59e0b' }} />}
            color="#f59e0b"
          />
        </Grid>
      </Grid>

      {/* Charts - Each chart on its own row */}
      <Grid container spacing={3} sx={{ width: '100%', margin: 0 }}>
        {/* Revenue and Profit - Line Chart */}
        <Grid item xs={12} sx={{ width: '100%', padding: '0 !important', marginBottom: 3 }}>
          <Paper 
            sx={{ 
              p: 4, 
              borderRadius: 3, 
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
              border: '1px solid #e5e7eb',
              background: 'linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%)',
              width: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
              <TrendingUp sx={{ fontSize: 28, color: '#2563eb' }} />
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 700,
                  color: '#1a202c',
                  fontSize: '1.25rem',
                }}
              >
                Doanh Thu và Lợi Nhuận
              </Typography>
            </Stack>
            {revenueProfitData.length > 0 ? (
              <Box sx={{ width: '100%', height: 500, flex: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueProfitData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="period" stroke="#6b7280" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value) => `${value.toFixed(2)}M VNĐ`}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                        fontSize: '14px'
                      }}
                      labelStyle={{ fontWeight: 600, marginBottom: '8px' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#2563eb" 
                      name="Doanh thu (triệu VNĐ)" 
                      strokeWidth={3}
                      dot={{ fill: '#2563eb', r: 5 }}
                      activeDot={{ r: 8 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="profit" 
                      stroke="#10b981" 
                      name="Lợi nhuận (triệu VNĐ)" 
                      strokeWidth={3}
                      dot={{ fill: '#10b981', r: 5 }}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            ) : (
              <Box 
                sx={{ 
                  height: 500, 
                  width: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  flexDirection: 'column',
                  border: '2px dashed #e2e8f0',
                  borderRadius: 2,
                  bgcolor: '#f8fafc',
                  flex: 1
                }}
              >
                <ErrorOutline sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                  Chưa có dữ liệu cho khoảng thời gian này
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center', maxWidth: 400 }}>
                  Vui lòng chọn khoảng thời gian khác hoặc đợi có dữ liệu đơn hàng
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Products Sold - Bar Chart */}
        <Grid item xs={12} sx={{ width: '100%', padding: '0 !important', marginBottom: 3 }}>
          <Paper 
            sx={{ 
              p: 4, 
              borderRadius: 3, 
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
              border: '1px solid #e5e7eb',
              background: 'linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%)',
              width: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
              <Inventory sx={{ fontSize: 28, color: '#f59e0b' }} />
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 700,
                  color: '#1a202c',
                  fontSize: '1.25rem',
                }}
              >
                Số Lượng Sản Phẩm Bán Ra
              </Typography>
            </Stack>
            {productsData.length > 0 ? (
              <Box sx={{ width: '100%', height: 500, flex: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productsData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="period" angle={-45} textAnchor="end" height={120} stroke="#6b7280" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                        fontSize: '14px'
                      }}
                      labelStyle={{ fontWeight: 600, marginBottom: '8px' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar 
                      dataKey="totalProductsSold" 
                      fill="#f59e0b" 
                      name="Tổng sản phẩm bán"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            ) : (
              <Box 
                sx={{ 
                  height: 500, 
                  width: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  flexDirection: 'column',
                  border: '2px dashed #e2e8f0',
                  borderRadius: 2,
                  bgcolor: '#f8fafc',
                  flex: 1
                }}
              >
                <Inventory sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                  Chưa có dữ liệu
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  Dữ liệu sẽ hiển thị khi có đơn hàng đã thanh toán
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Product Types Sold - Bar Chart */}
        <Grid item xs={12} sx={{ width: '100%', padding: '0 !important' }}>
          <Paper 
            sx={{ 
              p: 4, 
              borderRadius: 3, 
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
              border: '1px solid #e5e7eb',
              background: 'linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%)',
              width: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
              <Inventory sx={{ fontSize: 28, color: '#8b5cf6' }} />
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 700,
                  color: '#1a202c',
                  fontSize: '1.25rem',
                }}
              >
                Số Loại Sản Phẩm Bán Ra
              </Typography>
            </Stack>
            {productsData.length > 0 ? (
              <Box sx={{ width: '100%', height: 500, flex: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productsData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="period" angle={-45} textAnchor="end" height={120} stroke="#6b7280" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                        fontSize: '14px'
                      }}
                      labelStyle={{ fontWeight: 600, marginBottom: '8px' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar 
                      dataKey="uniqueProducts" 
                      fill="#8b5cf6" 
                      name="Số loại sản phẩm"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            ) : (
              <Box 
                sx={{ 
                  height: 500, 
                  width: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  flexDirection: 'column',
                  border: '2px dashed #e2e8f0',
                  borderRadius: 2,
                  bgcolor: '#f8fafc',
                  flex: 1
                }}
              >
                <Inventory sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                  Chưa có dữ liệu
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  Dữ liệu sẽ hiển thị khi có đơn hàng đã thanh toán
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default function DashboardPage() {
  const { api } = useAuth();
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ pb: 4 }}>
      <Paper 
        sx={{ 
          mb: 4, 
          borderRadius: 3, 
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
          border: '1px solid #e5e7eb',
          background: 'linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%)'
        }}
      >
        <Tabs 
          value={tab} 
          onChange={(_, v) => setTab(v)}
          sx={{
            '& .MuiTab-root': {
              fontWeight: 600,
              fontSize: '0.95rem',
              textTransform: 'none',
              minHeight: 64,
              '&.Mui-selected': {
                color: '#2563eb',
              }
            },
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
            }
          }}
        >
          <Tab label="Dashboard Tổng Quan" />
          <Tab label="Dashboard Nâng Cao" />
        </Tabs>
      </Paper>
      {tab === 0 && <SimpleDashboard api={api} />}
      {tab === 1 && <AdvancedDashboard api={api} />}
    </Box>
  );
}
