import React, { useState } from 'react';
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
} from '@mui/material';
import { Add, Edit, Delete, LocalOffer } from '@mui/icons-material';

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState([
    {
      id: 1,
      name: 'Giảm giá mùa hè',
      code: 'SUMMER2024',
      discount: 15,
      type: 'percentage',
      status: 'active',
      startDate: '2024-06-01',
      endDate: '2024-08-31',
    },
    {
      id: 2,
      name: 'Freeship toàn quốc',
      code: 'FREESHIP',
      discount: 0,
      type: 'freeship',
      status: 'active',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
    },
  ]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({});

  const handleSave = () => {
    if (form.id) {
      setPromotions(promotions.map((p) => (p.id === form.id ? form : p)));
    } else {
      setPromotions([...promotions, { ...form, id: Date.now() }]);
    }
    setOpen(false);
    setForm({});
  };

  const handleDelete = (id) => {
    if (confirm('Xóa khuyến mãi này?')) {
      setPromotions(promotions.filter((p) => p.id !== id));
    }
  };

  const getStatusColor = (status) => {
    return status === 'active' ? 'success' : 'default';
  };

  const getStatusLabel = (status) => {
    return status === 'active' ? 'Đang hoạt động' : 'Đã kết thúc';
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Khuyến mãi
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setForm({ status: 'active', type: 'percentage' });
            setOpen(true);
          }}
        >
          Thêm khuyến mãi
        </Button>
      </Stack>

      <Grid container spacing={3}>
        {promotions.map((promo) => (
          <Grid item xs={12} md={6} lg={4} key={promo.id}>
            <Card sx={{ height: '100%', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <CardContent>
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
                        setForm(promo);
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

                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  {promo.name}
                </Typography>

                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <Chip
                    label={promo.code}
                    size="small"
                    sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 600 }}
                  />
                  <Chip label={getStatusLabel(promo.status)} color={getStatusColor(promo.status)} size="small" />
                </Stack>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {promo.type === 'percentage' && `Giảm ${promo.discount}%`}
                  {promo.type === 'fixed' && `Giảm ${promo.discount.toLocaleString('vi-VN')} VNĐ`}
                  {promo.type === 'freeship' && 'Miễn phí vận chuyển'}
                </Typography>

                <Typography variant="caption" color="text.secondary">
                  Từ {new Date(promo.startDate).toLocaleDateString('vi-VN')} đến{' '}
                  {new Date(promo.endDate).toLocaleDateString('vi-VN')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{form.id ? 'Sửa khuyến mãi' : 'Thêm khuyến mãi'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Tên khuyến mãi"
              value={form.name || ''}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              fullWidth
            />
            <TextField
              label="Mã khuyến mãi"
              value={form.code || ''}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              fullWidth
            />
            <Select
              fullWidth
              displayEmpty
              value={form.type || 'percentage'}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <MenuItem value="percentage">Giảm theo %</MenuItem>
              <MenuItem value="fixed">Giảm cố định</MenuItem>
              <MenuItem value="freeship">Freeship</MenuItem>
            </Select>
            {form.type !== 'freeship' && (
              <TextField
                label="Giá trị giảm"
                type="number"
                value={form.discount || 0}
                onChange={(e) => setForm({ ...form, discount: parseFloat(e.target.value) })}
                fullWidth
              />
            )}
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Ngày bắt đầu"
                  type="date"
                  value={form.startDate || ''}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Ngày kết thúc"
                  type="date"
                  value={form.endDate || ''}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
            <Select
              fullWidth
              displayEmpty
              value={form.status || 'active'}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <MenuItem value="active">Đang hoạt động</MenuItem>
              <MenuItem value="inactive">Đã kết thúc</MenuItem>
            </Select>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleSave}>
            Lưu
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


