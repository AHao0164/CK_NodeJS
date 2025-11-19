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
} from '@mui/material';
import { Search } from '@mui/icons-material';
import { useAuth } from '../state/AuthContext.jsx';

export default function OrdersPage() {
  const { api } = useAuth();
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const load = async () => {
    try {
      const { data } = await api.get('/admin/orders');
      setOrders(data || []);
    } catch (error) {
      console.error('Failed to load orders:', error);
      setOrders([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/admin/orders/${id}/status`, { status });
      await load();
    } catch (error) {
      console.error('Failed to update status:', error);
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
      !search || o.id.toString().includes(search) || o.user_id.toString().includes(search);
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
              <TableCell sx={{ fontWeight: 600 }}>Cập nhật</TableCell>
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
                  <TableCell>User #{o.user_id}</TableCell>
                  <TableCell>{formatDate(o.created_at)}</TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatCurrency(o.total_cents)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={getStatusLabel(o.status)} color={getStatusColor(o.status)} size="small" />
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
