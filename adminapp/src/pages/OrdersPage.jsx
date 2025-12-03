import { useEffect, useState } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Divider,
  Grid,
  Checkbox,
  Button,
  Snackbar,
  Alert,
  Pagination,
  TableContainer,
  Tooltip,
} from '@mui/material';
import { Search, Visibility, Close, DeleteOutline, FileDownload } from '@mui/icons-material';
import { useAuth } from '../state/AuthContext.jsx';
import { exportToExcel, formatOrdersForExport } from '../utils/exportExcel';

export default function OrdersPage() {
  const { api } = useAuth();
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [detailDialog, setDetailDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const params = {
        page: page.toString(),
        pageSize: pageSize.toString()
      };
      if (statusFilter && statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      if (search && search.trim()) {
        params.search = search.trim();
      }
      const { data } = await api.get('/admin/orders', { params });
      
      // Handle both old format (array) and new format (object with items and pagination)
      if (Array.isArray(data)) {
        setOrders(data);
        setTotal(data.length);
        setTotalPages(1);
      } else {
        setOrders(data?.items || []);
        setTotal(data?.pagination?.total || 0);
        setTotalPages(data?.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
      setOrders([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter, page]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) {
        load();
      } else {
        setPage(1);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [search]);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/admin/orders/${id}/status`, { status });
      await load();
      if (status === 'DELIVERED') {
        localStorage.setItem('dashboard_refresh', Date.now().toString());
      }
      showNotification('Cập nhật trạng thái thành công', 'success');
    } catch (error) {
      console.error('Failed to update status:', error);
      showNotification('Cập nhật trạng thái thất bại', 'error');
    }
  };

  const deleteOrders = async (ids) => {
    if (!ids || ids.length === 0) return;
    if (!window.confirm(`Bạn có chắc muốn xóa ${ids.length} đơn hàng đã chọn?`)) return;
    
    try {
      await Promise.all(ids.map(id => api.delete(`/admin/orders/${id}`)));
      setSelectedIds([]);
      await load();
      showNotification(`Đã xóa ${ids.length} đơn hàng thành công`, 'success');
    } catch (error) {
      console.error('Failed to delete orders:', error);
      showNotification('Xóa đơn hàng thất bại', 'error');
    }
  };

  const deleteAllOrders = async () => {
    if (orders.length === 0) return;
    if (!window.confirm(`Bạn có chắc muốn xóa TẤT CẢ ${orders.length} đơn hàng trên trang này?`)) return;
    
    try {
      await Promise.all(orders.map(o => api.delete(`/admin/orders/${o.id}`)));
      setSelectedIds([]);
      await load();
      showNotification(`Đã xóa tất cả ${orders.length} đơn hàng`, 'success');
    } catch (error) {
      console.error('Failed to delete all orders:', error);
      showNotification('Xóa tất cả đơn hàng thất bại', 'error');
    }
  };

  const showNotification = (message, severity = 'success') => {
    setNotification({ open: true, message, severity });
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelectedIds(orders.map(o => o.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const viewOrderDetail = async (order) => {
    try {
      const { data } = await api.get(`/admin/orders/${order.id}`);
      setSelectedOrder(data);
      setDetailDialog(true);
    } catch (error) {
      console.error('Failed to load order details:', error);
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
      case 'PENDING':
        return 'warning';
      case 'CONFIRMED':
        return 'info';
      case 'SHIPPING':
        return 'primary';
      case 'DELIVERED':
        return 'success';
      case 'CANCELLED':
        return 'error';
      case 'PAID':
        return 'success';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'PENDING':
        return 'Chờ xác nhận';
      case 'CONFIRMED':
        return 'Đã xác nhận';
      case 'SHIPPING':
        return 'Đang giao hàng';
      case 'DELIVERED':
        return 'Đã giao hàng';
      case 'CANCELLED':
        return 'Đã hủy';
      case 'PAID':
        return 'Đã thanh toán';
      default:
        return status;
    }
  };

  const getPaymentMethodLabel = (method) => {
    switch (method) {
      case 'COD':
        return 'Thanh toán khi nhận hàng';
      case 'VNPAY':
        return 'Thanh toán VNPay';
      default:
        return method || 'N/A';
    }
  };

  // Status counts need to be fetched separately or calculated from all orders
  const statusCounts = {
    ALL: total,
    PENDING: orders.filter((o) => o.status === 'PENDING').length,
    CONFIRMED: orders.filter((o) => o.status === 'CONFIRMED').length,
    SHIPPING: orders.filter((o) => o.status === 'SHIPPING').length,
    DELIVERED: orders.filter((o) => o.status === 'DELIVERED').length,
    CANCELLED: orders.filter((o) => o.status === 'CANCELLED').length,
  };

  const handlePageChange = (event, value) => {
    setPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Box>
      <Stack 
        direction={{ xs: 'column', sm: 'row' }} 
        justifyContent="space-between" 
        alignItems={{ xs: 'stretch', sm: 'center' }} 
        sx={{ mb: { xs: 2, sm: 3 }, gap: 2 }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700, fontSize: { xs: '1.25rem', md: '1.5rem' } }}>
          Quản lý Đơn hàng
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
          <Button
            variant="contained"
            color="success"
            startIcon={<FileDownload />}
            onClick={() => exportToExcel(formatOrdersForExport(orders), 'DonHang', 'Đơn hàng')}
            sx={{ 
              borderRadius: 2,
              fontSize: { xs: '0.875rem', sm: '1rem' },
              py: { xs: 1, sm: 1.5 }
            }}
          >
            Xuất Excel
          </Button>
          {selectedIds.length > 0 && (
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteOutline />}
              onClick={() => deleteOrders(selectedIds)}
              sx={{ 
                borderRadius: 2,
                fontSize: { xs: '0.875rem', sm: '1rem' },
                py: { xs: 1, sm: 1.5 }
              }}
            >
              Xóa đã chọn ({selectedIds.length})
            </Button>
          )}
          {orders.length > 0 && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteOutline />}
              onClick={deleteAllOrders}
              sx={{ 
                borderRadius: 2,
                fontSize: { xs: '0.875rem', sm: '1rem' },
                py: { xs: 1, sm: 1.5 }
              }}
            >
              Xóa tất cả
            </Button>
          )}
        </Stack>
      </Stack>

      <Paper sx={{ mb: { xs: 2, sm: 3 }, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <Tabs
          value={statusFilter}
          onChange={(_, v) => setStatusFilter(v)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label={`Tất cả (${statusCounts.ALL})`} value="ALL" />
          <Tab label={`Chờ xác nhận (${statusCounts.PENDING})`} value="PENDING" />
          <Tab label={`Đã xác nhận (${statusCounts.CONFIRMED})`} value="CONFIRMED" />
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

      <Paper sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell padding="checkbox" sx={{ color: 'white', fontWeight: 600 }}>
                  <Checkbox
                    checked={orders.length > 0 && selectedIds.length === orders.length}
                    indeterminate={selectedIds.length > 0 && selectedIds.length < orders.length}
                    onChange={handleSelectAll}
                    sx={{ color: 'white', '&.Mui-checked': { color: 'white' } }}
                  />
                </TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>STT</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Mã đơn</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Khách hàng</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Phương thức</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <span>Ngày đặt</span>
                  </Stack>
                </TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">
                  Tổng tiền
                </TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Trạng thái</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Cập nhật</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }} align="center">
                  Thao tác
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <Typography color="text.secondary" variant="body2" sx={{ py: 4 }}>
                      Đang tải...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <Typography color="text.secondary" variant="body2" sx={{ py: 4 }}>
                      Không tìm thấy đơn hàng nào
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((o, index) => {
                  const rowNumber = (page - 1) * pageSize + index + 1;
                  const isNewOrder = new Date(o.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000); // Within 24 hours
                  
                  return (
                    <TableRow 
                      key={o.id} 
                      hover
                      selected={selectedIds.includes(o.id)}
                      sx={{ 
                        '&.Mui-selected': { bgcolor: 'action.selected' },
                        bgcolor: isNewOrder ? 'action.hover' : 'transparent',
                        borderLeft: isNewOrder ? '3px solid' : 'none',
                        borderLeftColor: isNewOrder ? 'success.main' : 'transparent',
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedIds.includes(o.id)}
                          onChange={() => handleSelectOne(o.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                          {rowNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          #{o.id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: 'text.primary' }}>
                          User #{o.user_id}
                        </Typography>
                        {o.shipping_name && (
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                            {o.shipping_name}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={getPaymentMethodLabel(o.payment_method)} 
                          size="small" 
                          variant="outlined"
                          sx={{ 
                            fontSize: '0.75rem',
                            borderColor: o.payment_method === 'VNPAY' ? 'info.main' : 'default.main'
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>
                          {formatDate(o.created_at)}
                        </Typography>
                        {isNewOrder && (
                          <Chip 
                            label="Mới" 
                            size="small" 
                            color="success"
                            sx={{ mt: 0.5, fontSize: '0.65rem', height: '18px' }}
                          />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main', fontSize: '0.95rem' }}>
                          {formatCurrency(o.total_cents)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={getStatusLabel(o.status)} 
                          color={getStatusColor(o.status)} 
                          size="small"
                          sx={{ 
                            fontWeight: 600,
                            minWidth: '100px'
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          size="small"
                          value={o.status}
                          onChange={(e) => updateStatus(o.id, e.target.value)}
                          disabled={o.status === 'DELIVERED' || o.status === 'CANCELLED'}
                          sx={{ 
                            minWidth: 150,
                            '& .MuiSelect-select': {
                              py: 1
                            },
                            '&.Mui-disabled': {
                              opacity: 0.6,
                              cursor: 'not-allowed'
                            }
                          }}
                        >
                          <MenuItem value="PENDING">Chờ xác nhận</MenuItem>
                          <MenuItem value="CONFIRMED">Đã xác nhận</MenuItem>
                          <MenuItem value="SHIPPING">Đang giao hàng</MenuItem>
                          <MenuItem value="DELIVERED">Đã giao hàng</MenuItem>
                          <MenuItem value="CANCELLED">Đã hủy</MenuItem>
                        </Select>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Xem chi tiết">
                          <IconButton 
                            size="small" 
                            onClick={() => viewOrderDetail(o)}
                            sx={{ 
                              color: 'primary.main',
                              '&:hover': { bgcolor: 'primary.light', color: 'white' }
                            }}
                          >
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 3, borderTop: 1, borderColor: 'divider' }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Trang {page} / {totalPages} ({total} đơn hàng)
              </Typography>
              <Pagination
                count={totalPages}
                page={page}
                onChange={handlePageChange}
                color="primary"
                size="large"
                showFirstButton
                showLastButton
                sx={{
                  '& .MuiPaginationItem-root': {
                    fontSize: '0.95rem',
                    fontWeight: 500
                  }
                }}
              />
            </Stack>
          </Box>
        )}
      </Paper>

      {/* Order Detail Dialog */}
      <Dialog open={detailDialog} onClose={() => setDetailDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Chi tiết đơn hàng #{selectedOrder?.id}
          <IconButton onClick={() => setDetailDialog(false)} size="small">
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedOrder && (
            <Stack spacing={3}>
              {/* Order Info */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                  Thông tin đơn hàng
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Mã đơn hàng
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      #{selectedOrder.id}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Trạng thái
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Chip
                        label={getStatusLabel(selectedOrder.status)}
                        color={getStatusColor(selectedOrder.status)}
                        size="small"
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Ngày đặt
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {formatDate(selectedOrder.created_at)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Khách hàng
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      User #{selectedOrder.user_id}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Phương thức thanh toán
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {getPaymentMethodLabel(selectedOrder.payment_method)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Trạng thái thanh toán
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {selectedOrder.payment_status === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>

              <Divider />

              {/* Shipping Info */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                  Địa chỉ giao hàng
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Người nhận
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {selectedOrder.shipping_name || '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Điện thoại
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {selectedOrder.shipping_phone || '-'}
                    </Typography>
                  </Grid>
                  {selectedOrder.shipping_email && (
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">
                        Email
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {selectedOrder.shipping_email}
                      </Typography>
                    </Grid>
                  )}
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">
                      Địa chỉ
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {[selectedOrder.shipping_address, selectedOrder.shipping_ward, selectedOrder.shipping_district, selectedOrder.shipping_province].filter(Boolean).join(', ') || '-'}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>

              <Divider />

              {/* Order Items */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                  Sản phẩm
                </Typography>
                {selectedOrder.items?.map((item, idx) => (
                  <Stack
                    key={idx}
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9' }}
                  >
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {item.product_name || `Product #${item.product_id}`}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Số lượng: {item.quantity}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatCurrency(item.price_cents * item.quantity)}
                    </Typography>
                  </Stack>
                ))}
              </Box>

              <Divider />

              {/* Total */}
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Tổng cộng
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  {formatCurrency(selectedOrder.total_cents)}
                </Typography>
              </Stack>
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={() => setNotification({ ...notification, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setNotification({ ...notification, open: false })}
          severity={notification.severity}
          variant="filled"
          sx={{
            borderRadius: 2,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            minWidth: '300px',
            '& .MuiAlert-message': {
              fontSize: '0.95rem',
              fontWeight: 500,
            },
          }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}