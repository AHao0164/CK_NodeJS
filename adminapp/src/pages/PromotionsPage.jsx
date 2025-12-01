import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  Alert,
  LinearProgress,
  Snackbar,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { Add, Edit, Delete, LocalOffer, DeleteSweep, Schedule, CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import { useAuth } from '../state/AuthContext.jsx';

export default function PromotionsPage() {
  const { api } = useAuth();
  const [promotions, setPromotions] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [valueDisplay, setValueDisplay] = useState('');
  const [searchCode, setSearchCode] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    loadPromotions();
    
    // Auto-refresh every 5 seconds to show deleted expired coupons in real-time
    const interval = setInterval(() => {
      loadPromotions();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const loadPromotions = async () => {
    try {
      const { data } = await api.get('/admin/coupons');
      setPromotions(data || []);
    } catch (error) {
      console.error('Failed to load promotions:', error);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      // Format datetime properly for MySQL
      const formatForAPI = (datetimeLocal) => {
        if (!datetimeLocal) return null;
        const date = new Date(datetimeLocal);
        return date.toISOString().slice(0, 19).replace('T', ' ');
      };
      
      const payload = {
        code: form.code,
        type: form.type,
        value: form.type === 'freeship' ? 0 : (form.type === 'fixed' ? Math.round((form.value || 0) * 100) : (form.value || 0)),
        active: form.active ? 1 : 0,
        startDate: formatForAPI(form.start_date),
        endDate: formatForAPI(form.end_date),
        maxUsage: form.maxUsage || null,
      };

      if (form.id) {
        await api.put(`/admin/coupons/${form.id}`, payload);
      } else {
        await api.post('/admin/coupons', payload);
      }
      setOpen(false);
      setForm({});
      setValueDisplay('');
      await loadPromotions();
      setSnackbar({ open: true, message: form.id ? '✓ Cập nhật mã giảm giá thành công!' : '✓ Thêm mã giảm giá thành công!', severity: 'success' });
    } catch (error) {
      console.error('Failed to save promotion:', error);
      setSnackbar({ open: true, message: '✗ Lưu thất bại: ' + (error.response?.data?.error || error.message), severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      setLoading(true);
      await api.delete(`/admin/coupons/${id}`);
      await loadPromotions();
      setSnackbar({ open: true, message: '✓ Đã xóa mã giảm giá!', severity: 'success' });
    } catch (error) {
      console.error('Failed to delete promotion:', error);
      setSnackbar({ open: true, message: '✗ Xóa thất bại!', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDeleteExpired = async () => {
    try {
      setLoading(true);
      const { data } = await api.delete('/admin/coupons/expired/bulk');
      await loadPromotions();
      setSnackbar({ open: true, message: `✓ Đã xóa ${data.deleted} mã giảm giá hết hạn!`, severity: 'success' });
    } catch (error) {
      console.error('Failed to bulk delete:', error);
      setSnackbar({ open: true, message: '✗ Xóa hàng loạt thất bại!', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAutoDisable = async () => {
    try {
      setLoading(true);
      const { data } = await api.post('/admin/coupons/auto-disable');
      await loadPromotions();
      setSnackbar({ open: true, message: `✓ Đã vô hiệu hóa ${data.disabled} mã hết hạn!`, severity: 'success' });
    } catch (error) {
      console.error('Failed to auto-disable:', error);
      setSnackbar({ open: true, message: '✗ Vô hiệu hóa thất bại!', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (promo) => {
    const now = new Date();
    const endDate = promo.end_date ? new Date(promo.end_date) : null;
    const isExpired = endDate && endDate.getTime() < now.getTime();
    
    if (!promo.active || isExpired) return 'error';
    if (endDate) {
      const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 3) return 'warning';
    }
    return 'success';
  };

  const getStatusLabel = (promo) => {
    const now = new Date();
    const endDate = promo.end_date ? new Date(promo.end_date) : null;
    const isExpired = endDate && endDate.getTime() < now.getTime();
    
    if (isExpired) return 'Đã hết hạn';
    if (!promo.active) return 'Đã tắt';
    if (endDate) {
      const timeLeft = endDate.getTime() - now.getTime();
      const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
      const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hoursLeft < 1) {
        return `Còn ${minutesLeft} phút`;
      } else if (hoursLeft < 24) {
        return `Còn ${hoursLeft} giờ ${minutesLeft} phút`;
      } else {
        const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));
        return `Còn ${daysLeft} ngày`;
      }
    }
    return 'Đang hoạt động';
  };

  const getTypeLabel = (type, value) => {
    if (type === 'percentage') return `Giảm ${value}%`;
    if (type === 'fixed') return `Giảm ${(value / 100).toLocaleString('vi-VN')}₫`;
    if (type === 'freeship') return 'Miễn phí vận chuyển';
    return '';
  };

  const filteredPromotions = promotions.filter(promo => {
    const matchSearch = promo.code.toLowerCase().includes(searchCode.toLowerCase());
    if (!matchSearch) return false;
    
    if (filterStatus === 'active') return promo.active && !getStatusLabel(promo).includes('hết');
    if (filterStatus === 'inactive') return !promo.active;
    if (filterStatus === 'expired') return getStatusLabel(promo).includes('hết hạn');
    return true;
  });

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      setLoading(true);
      for (const id of selectedIds) {
        await api.delete(`/admin/coupons/${id}`);
      }
      const deletedCount = selectedIds.length;
      setSelectedIds([]);
      await loadPromotions();
      setSnackbar({ open: true, message: `✓ Đã xóa ${deletedCount} mã giảm giá!`, severity: 'success' });
    } catch (error) {
      console.error('Failed to bulk delete:', error);
      setSnackbar({ open: true, message: '✗ Xóa hàng loạt thất bại!', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredPromotions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPromotions.map(p => p.id));
    }
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
          Quản lý Khuyến mãi
        </Typography>
        <Stack direction="row" spacing={1}>
          {selectedIds.length > 0 && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteSweep />}
              onClick={handleBulkDelete}
              disabled={loading}
            >
              Xóa {selectedIds.length} mục
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              setForm({ active: 1, type: 'percentage', maxUsage: null });
              setValueDisplay('');
              setOpen(true);
            }}
            disabled={loading}
            sx={{ 
              fontSize: { xs: '0.875rem', sm: '1rem' },
              py: { xs: 1, sm: 1.5 }
            }}
          >
            Thêm khuyến mãi
          </Button>
        </Stack>
      </Stack>

      <Card sx={{ mb: 3, p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <Button
            variant="outlined"
            size="small"
            startIcon={<Checkbox checked={selectedIds.length === filteredPromotions.length && filteredPromotions.length > 0} />}
            onClick={toggleSelectAll}
            sx={{ minWidth: 130 }}
          >
            {selectedIds.length === filteredPromotions.length && filteredPromotions.length > 0 ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
          </Button>
          <TextField
            size="small"
            placeholder="Tìm theo mã khuyến mãi..."
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            sx={{ flexGrow: 1 }}
          />
          <Select
            size="small"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="all">Tất cả</MenuItem>
            <MenuItem value="active">Đang hoạt động</MenuItem>
            <MenuItem value="inactive">Đã tắt</MenuItem>
            <MenuItem value="expired">Đã hết hạn</MenuItem>
          </Select>
        </Stack>
      </Card>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Grid container spacing={{ xs: 2, sm: 2.5, lg: 3 }}>
        {filteredPromotions.length === 0 ? (
          <Grid item xs={12}>
            <Typography color="text.secondary" variant="body2" sx={{ py: 4, textAlign: 'center' }}>
              {searchCode || filterStatus !== 'all' ? 'Không tìm thấy kết quả' : 'Chưa có khuyến mãi nào. Hãy thêm khuyến mãi mới!'}
            </Typography>
          </Grid>
        ) : (
          filteredPromotions.map((promo, index) => (
            <Grid item xs={12} md={6} lg={4} key={promo.id}>
              <Card sx={{ 
                height: '100%', 
                borderRadius: { xs: 2, lg: 3 }, 
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'all 0.3s ease',
                border: selectedIds.includes(promo.id) ? '2px solid #2563eb' : '1px solid rgba(0,0,0,0.05)',
                '&:hover': { 
                  boxShadow: { xs: '0 1px 3px rgba(0,0,0,0.05)', sm: '0 4px 12px rgba(0,0,0,0.1)' },
                  transform: { xs: 'none', sm: 'translateY(-2px)' }
                }
              }}>
                <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Checkbox
                        checked={selectedIds.includes(promo.id)}
                        onChange={() => {
                          if (selectedIds.includes(promo.id)) {
                            setSelectedIds(selectedIds.filter(id => id !== promo.id));
                          } else {
                            setSelectedIds([...selectedIds, promo.id]);
                          }
                        }}
                        size="small"
                      />
                      <Chip label={`#${index + 1}`} size="small" color="primary" variant="outlined" />
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 2,
                          bgcolor: '#eff6ff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <LocalOffer sx={{ color: '#2563eb' }} />
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      <IconButton
                        size="small"
                        onClick={() => {
                          const val = promo.type === 'fixed' ? promo.value / 100 : promo.value;
                          
                          // Format datetime cho datetime-local input (YYYY-MM-DDTHH:mm)
                          const formatDatetimeLocal = (dateStr) => {
                            if (!dateStr) return '';
                            const date = new Date(dateStr);
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            const hours = String(date.getHours()).padStart(2, '0');
                            const minutes = String(date.getMinutes()).padStart(2, '0');
                            return `${year}-${month}-${day}T${hours}:${minutes}`;
                          };

                          setForm({
                            id: promo.id,
                            code: promo.code,
                            type: promo.type,
                            value: val,
                            active: promo.active,
                            start_date: formatDatetimeLocal(promo.start_date),
                            end_date: formatDatetimeLocal(promo.end_date),
                            maxUsage: promo.max_usage || null,
                          });
                          setValueDisplay(val === '' ? '' : (promo.type === 'fixed' ? val.toLocaleString('vi-VN') : val.toString()));
                          setOpen(true);
                        }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(promo.id)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>

                  <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
                    <Chip
                      label={promo.code}
                      size="small"
                      sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 600 }}
                    />
                    <Chip label={getStatusLabel(promo)} color={getStatusColor(promo)} size="small" />
                  </Stack>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {getTypeLabel(promo.type, promo.value)}
                  </Typography>

                  {/* Usage information */}
                  {promo.max_usage !== null && promo.max_usage !== undefined && (
                    <Box sx={{ mb: 1, p: 1, bgcolor: '#f3f4f6', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        Số lần sử dụng: <strong>{promo.times_used || 0}</strong> / <strong>{promo.max_usage}</strong>
                      </Typography>
                      {promo.max_usage > 0 && (
                        <Box sx={{ position: 'relative', width: '100%', height: 6, bgcolor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                          <Box
                            sx={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              height: '100%',
                              width: `${Math.min(100, ((promo.times_used || 0) / promo.max_usage) * 100)}%`,
                              bgcolor: promo.times_used >= promo.max_usage ? '#ef4444' : '#10b981',
                              transition: 'width 0.3s ease'
                            }}
                          />
                        </Box>
                      )}
                    </Box>
                  )}

                  <Typography variant="caption" color="text.secondary">
                    {promo.start_date && promo.end_date ? (
                      <>
                        Từ {new Date(promo.start_date).toLocaleString('vi-VN', { 
                          day: '2-digit', month: '2-digit', year: 'numeric', 
                          hour: '2-digit', minute: '2-digit' 
                        })} đến{' '}
                        {new Date(promo.end_date).toLocaleString('vi-VN', { 
                          day: '2-digit', month: '2-digit', year: 'numeric', 
                          hour: '2-digit', minute: '2-digit' 
                        })}
                      </>
                    ) : (
                      'Không giới hạn thời gian'
                    )}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>{form.id ? 'Sửa khuyến mãi' : 'Thêm khuyến mãi'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Mã khuyến mãi"
              value={form.code || ''}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              fullWidth
              required
              placeholder="VD: SUMMER2024"
            />
            <Select
              fullWidth
              displayEmpty
              value={form.type || 'percentage'}
              onChange={(e) => {
                const newType = e.target.value;
                setForm({ ...form, type: newType, value: '' });
                setValueDisplay('');
              }}
            >
              <MenuItem value="percentage">Giảm theo %</MenuItem>
              <MenuItem value="fixed">Giảm cố định</MenuItem>
              <MenuItem value="freeship">Freeship</MenuItem>
            </Select>
            {form.type !== 'freeship' && (
              <TextField
                label={form.type === 'percentage' ? 'Giá trị giảm (%)' : 'Giá trị giảm (VNĐ)'}
                value={valueDisplay}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  const num = val === '' ? '' : parseFloat(val);
                  setForm({ ...form, value: num === '' ? '' : num });
                  setValueDisplay(val === '' ? '' : (form.type === 'fixed' ? parseFloat(val).toLocaleString('vi-VN') : val));
                }}
                fullWidth
                required
                helperText={form.type === 'percentage' ? 'VD: 15 = giảm 15%' : 'VD: 100,000 = giảm 100k₫'}
              />
            )}
            <TextField
              label="Số lần sử dụng tối đa"
              type="number"
              value={form.maxUsage || ''}
              onChange={(e) => {
                const val = e.target.value === '' ? null : parseInt(e.target.value);
                if (val === null || (val >= 1 && val <= 10)) {
                  setForm({ ...form, maxUsage: val });
                }
              }}
              fullWidth
              inputProps={{ min: 1, max: 10 }}
              helperText="Từ 1 đến 10 lần. Để trống = không giới hạn"
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Ngày giờ bắt đầu"
                  type="datetime-local"
                  value={form.start_date || ''}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  helperText="Để trống = bắt đầu ngay"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Ngày giờ kết thúc"
                  type="datetime-local"
                  value={form.end_date || ''}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  helperText="Để trống = không giới hạn"
                />
              </Grid>
            </Grid>
            {form.end_date && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                ⚠️ Mã sẽ tự động vô hiệu hóa và XÓA NGAY khi hết hạn!
              </Alert>
            )}
            <FormControlLabel
              control={
                <Switch
                  checked={form.active === 1 || form.active === true}
                  onChange={(e) => setForm({ ...form, active: e.target.checked ? 1 : 0 })}
                  color="success"
                />
              }
              label={form.active ? "Đang hoạt động" : "Đã tắt"}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.code || !form.type}>
            {form.id ? 'Cập nhật' : 'Thêm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          icon={snackbar.severity === 'success' ? <CheckCircle /> : <ErrorIcon />}
          sx={{ width: '100%', boxShadow: 3 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}


