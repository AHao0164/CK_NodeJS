import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
} from '@mui/material';
import { Add, Edit, Delete, LocalOffer } from '@mui/icons-material';
import { useAuth } from '../state/AuthContext';

export default function PromotionsPage() {
  const { api } = useAuth();
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPromotions();
  }, []);

  const loadPromotions = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/coupons');
      setPromotions(data);
    } catch (e) {
      setError('Không thể tải danh sách khuyến mãi');
      console.error('Load coupons error:', e);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    if (!form.code) return 'Vui lòng nhập mã khuyến mãi';
    if (!/^[A-Z0-9]{5}$/i.test(form.code)) {
      return 'Mã khuyến mãi phải là chuỗi 5 ký tự chữ và số';
    }
    if (!form.type) return 'Vui lòng chọn loại khuyến mãi';
    if (form.type !== 'freeship' && (!form.value || form.value <= 0)) {
      return 'Giá trị giảm phải lớn hơn 0';
    }
    const usageLimit = parseInt(form.usage_limit) || 10;
    if (usageLimit < 1 || usageLimit > 10) {
      return 'Giới hạn sử dụng phải từ 1 đến 10';
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        code: form.code.toUpperCase(),
        type: form.type,
        value: form.type === 'freeship' ? 0 : (form.type === 'fixed' ? form.value * 100 : form.value),
        active: form.active ? 1 : 0,
        usageLimit: Math.min(Math.max(1, parseInt(form.usage_limit) || 10), 10),
        startDate: form.start_date || null,
        endDate: form.end_date || null,
      };

      if (form.id) {
        await api.put(`/admin/coupons/${form.id}`, payload);
      } else {
        await api.post('/admin/coupons', payload);
      }
      
      await loadPromotions();
      setOpen(false);
      setForm({});
    } catch (e) {
      const msg = e?.response?.data?.error || 'Không thể lưu khuyến mãi';
      setError(msg);
      console.error('Save coupon error:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Xóa khuyến mãi này?')) return;
    
    setError('');
    try {
      await api.delete(`/admin/coupons/${id}`);
      await loadPromotions();
    } catch (e) {
      setError('Không thể xóa khuyến mãi');
      console.error('Delete coupon error:', e);
    }
  };

  const getStatusColor = (status) => {
    return status === 1 ? 'success' : 'default';
  };

  const getStatusLabel = (status) => {
    return status === 1 ? 'Đang hoạt động' : 'Ngừng hoạt động';
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Mã giảm giá
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            onClick={loadPromotions}
            disabled={loading}
          >
            {loading ? 'Đang tải...' : '🔄 Làm mới'}
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              setForm({ active: 1, type: 'percentage', usage_limit: 10, value: 0 });
              setOpen(true);
              setError('');
            }}
          >
            Thêm mã giảm giá
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {loading && <LinearProgress sx={{ mb: 3 }} />}

      <Grid container spacing={3}>
        {!loading && promotions.length === 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <LocalOffer sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  Chưa có mã giảm giá nào
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Tạo mã giảm giá đầu tiên để bắt đầu
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
        {promotions.map((promo) => (
          <Grid item xs={12} md={6} lg={4} key={promo.id}>
            <Card sx={{ height: '100%', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
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
                  <Stack direction="row" spacing={1}>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setForm({
                          ...promo,
                          value: promo.type === 'fixed' ? promo.value / 100 : promo.value
                        });
                        setOpen(true);
                        setError('');
                      }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(promo.id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>

                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <Chip
                    label={promo.code}
                    size="small"
                    sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 600, fontSize: '0.875rem' }}
                  />
                  <Chip label={getStatusLabel(promo.active)} color={getStatusColor(promo.active)} size="small" />
                </Stack>

                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 600, minHeight: '40px', display: 'flex', alignItems: 'center' }}>
                    {promo.type === 'percentage' && `Giảm ${promo.value}%`}
                    {promo.type === 'fixed' && `Giảm ${(promo.value/100).toLocaleString('vi-VN')} VNĐ`}
                    {promo.type === 'freeship' && 'Miễn phí vận chuyển'}
                  </Typography>

                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                    📊 Đã dùng: {promo.usage_count}/{promo.usage_limit} lượt
                  </Typography>

                  {promo.start_date && promo.end_date && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      📅 {new Date(promo.start_date).toLocaleDateString('vi-VN')} - {new Date(promo.end_date).toLocaleDateString('vi-VN')}
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{form.id ? 'Sửa mã giảm giá' : 'Thêm mã giảm giá'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Mã giảm giá (5 ký tự chữ & số)"
              value={form.code || ''}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().slice(0, 5) })}
              fullWidth
              required
              inputProps={{ maxLength: 5, style: { textTransform: 'uppercase' } }}
              helperText={`${(form.code || '').length}/5 ký tự`}
            />
            <TextField
              select
              label="Loại giảm giá"
              value={form.type || 'percentage'}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              fullWidth
              required
            >
              <MenuItem value="percentage">Giảm theo phần trăm (%)</MenuItem>
              <MenuItem value="fixed">Giảm số tiền cố định (VNĐ)</MenuItem>
              <MenuItem value="freeship">Miễn phí vận chuyển</MenuItem>
            </TextField>
            {form.type !== 'freeship' && (
              <TextField
                label={form.type === 'percentage' ? 'Giá trị giảm (%)' : 'Giá trị giảm (VNĐ)'}
                type="number"
                value={form.value || 0}
                onChange={(e) => setForm({ ...form, value: parseFloat(e.target.value) || 0 })}
                fullWidth
                required
                inputProps={{ min: 0, max: form.type === 'percentage' ? 100 : undefined }}
              />
            )}
            <TextField
              label="Giới hạn sử dụng (tối đa 10)"
              type="number"
              value={form.usage_limit || 10}
              onChange={(e) => {
                const val = Math.min(Math.max(1, parseInt(e.target.value) || 1), 10);
                setForm({ ...form, usage_limit: val });
              }}
              fullWidth
              required
              inputProps={{ min: 1, max: 10 }}
              helperText="Mỗi mã giảm giá có thể dùng tối đa 10 lần"
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Ngày bắt đầu"
                  type="date"
                  value={form.start_date || ''}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Ngày kết thúc"
                  type="date"
                  value={form.end_date || ''}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
            <TextField
              select
              label="Trạng thái"
              value={form.active !== undefined ? form.active : 1}
              onChange={(e) => setForm({ ...form, active: parseInt(e.target.value) })}
              fullWidth
            >
              <MenuItem value={1}>Đang hoạt động</MenuItem>
              <MenuItem value={0}>Ngừng hoạt động</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpen(false); setError(''); }} disabled={saving}>
            Hủy
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


