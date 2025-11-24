import React, { useEffect, useState } from 'react';
import {
  Box,
  Chip,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Pagination,
  LinearProgress,
} from '@mui/material';
import { Search, Visibility } from '@mui/icons-material';
import { useAuth } from '../state/AuthContext.jsx';

export default function OrdersPage() {
  const { api } = useAuth();
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [timeRange, setTimeRange] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (timeRange) params.timeRange = timeRange;
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }
      const { data } = await api.get('/admin/orders', { params });
      setOrders(data.items || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('Failed to load orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, timeRange, startDate, endDate]);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/admin/orders/${id}/status`, { status });
      await load();
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Cập nhật trạng thái thất bại');
    }
  };

  const loadOrderDetail = async (id) => {
    try {
      const { data } = await api.get(`/admin/orders/${id}`);
      setSelectedOrder(data);
      setDetailOpen(true);
    } catch (error) {
      console.error('Failed to load order detail:', error);
      alert('Không thể tải chi tiết đơn hàng');
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
      hour: '2-digit',
      minute: '2-digit',
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
      case 'SHIPPING':
        return 'info';
      case 'DELIVERED':
        return 'success';
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
      case 'SHIPPING':
        return 'Đang giao';
      case 'DELIVERED':
        return 'Đã giao';
      default:
        return status;
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    const matchesSearch =
      !search || o.id.toString().includes(search) || o.user_id?.toString().includes(search);
    return matchesStatus && matchesSearch;
  });

  const statusCounts = {
    ALL: orders.length,
    PENDING: orders.filter((o) => o.status === 'PENDING').length,
    PAID: orders.filter((o) => o.status === 'PAID').length,
    SHIPPING: orders.filter((o) => o.status === 'SHIPPING').length,
    DELIVERED: orders.filter((o) => o.status === 'DELIVERED').length,
    CANCELLED: orders.filter((o) => o.status === 'CANCELLED').length,
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Đơn hàng
        </Typography>
      </Stack>

      {/* Time Range Filters */}
      <Paper sx={{ mb: 3, p: 2, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Select
            size="small"
            value={timeRange}
            onChange={(e) => {
              setTimeRange(e.target.value);
              setStartDate('');
              setEndDate('');
              setPage(1);
            }}
            displayEmpty
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">Tất cả thời gian</MenuItem>
            <MenuItem value="today">Hôm nay</MenuItem>
            <MenuItem value="yesterday">Hôm qua</MenuItem>
            <MenuItem value="thisWeek">Tuần này</MenuItem>
            <MenuItem value="thisMonth">Tháng này</MenuItem>
          </Select>
          <Typography variant="body2" color="text.secondary">
            hoặc
          </Typography>
          <TextField
            size="small"
            type="date"
            label="Từ ngày"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (e.target.value) setTimeRange('');
              setPage(1);
            }}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            size="small"
            type="date"
            label="Đến ngày"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              if (e.target.value) setTimeRange('');
              setPage(1);
            }}
            InputLabelProps={{ shrink: true }}
          />
        </Stack>
      </Paper>

      <Paper sx={{ mb: 3, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <Tabs
          value={statusFilter}
          onChange={(_, v) => setStatusFilter(v)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label={`Tất cả (${statusCounts.ALL})`} value="ALL" />
          <Tab label={`Chờ xử lý (${statusCounts.PENDING})`} value="PENDING" />
          <Tab label={`Đã thanh toán (${statusCounts.PAID})`} value="PAID" />
          <Tab label={`Đang giao (${statusCounts.SHIPPING})`} value="SHIPPING" />
          <Tab label={`Đã giao (${statusCounts.DELIVERED})`} value="DELIVERED" />
          <Tab label={`Đã hủy (${statusCounts.CANCELLED})`} value="CANCELLED" />
        </Tabs>
        <Box sx={{ p: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Tìm kiếm theo mã đơn hàng hoặc ID khách hàng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </Paper>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Paper sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Mã đơn</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Khách hàng</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Ngày đặt</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">
                Tổng tiền
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Trạng thái</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="text.secondary" variant="body2" sx={{ py: 4 }}>
                    Không tìm thấy đơn hàng nào
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((o) => (
                <TableRow key={o.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      #{o.id}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {o.user?.full_name || o.guest_email || `User #${o.user_id || 'Guest'}`}
                  </TableCell>
                  <TableCell>{formatDate(o.created_at)}</TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatCurrency(o.total_cents - (o.discount_cents || 0) - (o.loyalty_cents_used || 0))}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={getStatusLabel(o.status)} color={getStatusColor(o.status)} size="small" />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        startIcon={<Visibility />}
                        onClick={() => loadOrderDetail(o.id)}
                      >
                        Chi tiết
                      </Button>
                    <Select
                      size="small"
                      value={o.status}
                      onChange={(e) => updateStatus(o.id, e.target.value)}
                      sx={{ minWidth: 150 }}
                    >
                      <MenuItem value="PENDING">Chờ xử lý</MenuItem>
                      <MenuItem value="PAID">Đã thanh toán</MenuItem>
                      <MenuItem value="SHIPPING">Đang giao</MenuItem>
                      <MenuItem value="DELIVERED">Đã giao</MenuItem>
                      <MenuItem value="CANCELLED">Đã hủy</MenuItem>
                    </Select>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, p) => setPage(p)}
              color="primary"
            />
          </Box>
        )}
      </Paper>

      {/* Order Detail Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Chi tiết đơn hàng #{selectedOrder?.id}</DialogTitle>
        <DialogContent>
          {selectedOrder && (
            <Stack spacing={2}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Khách hàng
                  </Typography>
                  <Typography variant="body1">
                    {selectedOrder.user?.full_name || selectedOrder.guest_email || 'Khách vãng lai'}
                  </Typography>
                  {selectedOrder.user?.email && (
                    <Typography variant="body2" color="text.secondary">
                      {selectedOrder.user.email}
                    </Typography>
                  )}
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Ngày đặt
                  </Typography>
                  <Typography variant="body1">{formatDate(selectedOrder.created_at)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Trạng thái
                  </Typography>
                  <Chip
                    label={getStatusLabel(selectedOrder.status)}
                    color={getStatusColor(selectedOrder.status)}
                    size="small"
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Tổng tiền
                  </Typography>
                  <Typography variant="h6">
                    {formatCurrency(
                      selectedOrder.total_cents -
                        (selectedOrder.discount_cents || 0) -
                        (selectedOrder.loyalty_cents_used || 0)
                    )}
                  </Typography>
                </Grid>
              </Grid>
              {selectedOrder.discount_cents > 0 && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Mã giảm giá
                  </Typography>
                  <Typography variant="body1">
                    {selectedOrder.coupon_code} - Giảm {formatCurrency(selectedOrder.discount_cents)}
                  </Typography>
                </Box>
              )}
              {selectedOrder.loyalty_cents_used > 0 && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Điểm tích lũy đã dùng
                  </Typography>
                  <Typography variant="body1">{formatCurrency(selectedOrder.loyalty_cents_used)}</Typography>
                </Box>
              )}
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Địa chỉ giao hàng
                </Typography>
                <Typography variant="body2">
                  {selectedOrder.shipping_name} - {selectedOrder.shipping_phone}
                  <br />
                  {selectedOrder.shipping_address}, {selectedOrder.shipping_ward || ''}{' '}
                  {selectedOrder.shipping_district || ''}, {selectedOrder.shipping_city}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Sản phẩm
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Sản phẩm</TableCell>
                      <TableCell align="right">Số lượng</TableCell>
                      <TableCell align="right">Đơn giá</TableCell>
                      <TableCell align="right">Thành tiền</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedOrder.items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.name || `Product #${item.product_id}`}</TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">{formatCurrency(item.price_cents)}</TableCell>
                        <TableCell align="right">
                          {formatCurrency(item.price_cents * item.quantity)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Đóng</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
