import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Chip,
  InputAdornment,
} from '@mui/material';
import { Edit, Delete, Add, Search, Image as ImageIcon } from '@mui/icons-material';
import { useAuth } from '../state/AuthContext.jsx';

export default function ProductsPage() {
  const { api } = useAuth();
  const [rows, setRows] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({});
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('id_desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState('');

  const load = async () => {
    const [p, b, c] = await Promise.all([
      api.get('/admin/catalog/products', { params: { q, sort, page, pageSize } }),
      api.get('/admin/catalog/brands'),
      api.get('/admin/catalog/categories'),
    ]);
    setRows(p.data.items);
    setTotal(p.data.total);
    setBrands(b.data);
    setCategories(c.data);
  };

  useEffect(() => { load(); }, [q, sort, page, pageSize]);

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file ảnh');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Kích thước file tối đa 5MB');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('image', file);

      const response = await api.post('/admin/catalog/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const imageUrl = response.data.imageUrl;
      setForm({ ...form, imageUrl });
      setImagePreview(imageUrl);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload ảnh thất bại. Vui lòng thử lại!');
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    try {
      if (form.id) {
        await api.put(`/admin/catalog/products/${form.id}`, form);
      } else {
        await api.post('/admin/catalog/products', form);
      }
      setOpen(false);
      setForm({});
      setImagePreview('');
      await load();
    } catch (error) {
      console.error('Save error:', error);
      alert('Lưu thất bại: ' + (error.response?.data?.error || error.message));
    }
  };

  const onDelete = async (id) => {
    if (!confirm('Xóa sản phẩm này?')) return;
    await api.delete(`/admin/catalog/products/${id}`);
    await load();
  };

  const brandNameById = useMemo(() => Object.fromEntries(brands.map(b => [b.id, b.name])), [brands]);
  const categoryNameById = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c.name])), [categories]);

  const formatCurrency = (cents) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(cents);
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Sản phẩm
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setForm({});
            setImagePreview('');
            setOpen(true);
          }}
        >
          Thêm sản phẩm
        </Button>
      </Stack>

      <Paper sx={{ p: 2, mb: 3, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            size="small"
            placeholder="Tìm kiếm sản phẩm..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1);
                load();
              }
            }}
            sx={{ flexGrow: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />
          <Select
            size="small"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="id_desc">Mới nhất</MenuItem>
            <MenuItem value="name_asc">Tên A-Z</MenuItem>
            <MenuItem value="name_desc">Tên Z-A</MenuItem>
            <MenuItem value="price_asc">Giá tăng</MenuItem>
            <MenuItem value="price_desc">Giá giảm</MenuItem>
          </Select>
        </Stack>
      </Paper>

      <Paper sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Sản phẩm</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Hãng</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Danh mục</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">
                Giá
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Tồn kho</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">
                Thao tác
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="text.secondary" variant="body2" sx={{ py: 4 }}>
                    Không tìm thấy sản phẩm nào
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>#{r.id}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 1,
                          bgcolor: '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        {r.image_url ? (
                          <img
                            src={`${import.meta.env.VITE_API_BASE || 'http://localhost:8080'}${r.image_url}`}
                            alt={r.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <ImageIcon sx={{ color: '#94a3b8' }} />
                        )}
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {r.name}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{r.brand || brandNameById[r.brand_id] || '-'}</TableCell>
                  <TableCell>{r.category || categoryNameById[r.category_id] || '-'}</TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatCurrency(r.price_cents)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={`Còn ${r.stock || 0}`}
                      size="small"
                      color={(r.stock || 0) === 0 ? 'error' : (r.stock || 0) < 10 ? 'warning' : 'success'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setForm({
                          id: r.id,
                          name: r.name,
                          brandId: r.brand_id,
                          categoryId: r.category_id,
                          priceCents: r.price_cents,
                          stock: r.stock,
                          description: r.description,
                          imageUrl: r.image_url,
                        });
                        setImagePreview(r.image_url || '');
                        setOpen(true);
                      }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => onDelete(r.id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2 }}>
          <Select
            size="small"
            value={pageSize}
            onChange={(e) => {
              setPageSize(parseInt(e.target.value, 10));
              setPage(1);
            }}
          >
            <MenuItem value={10}>10 / trang</MenuItem>
            <MenuItem value={20}>20 / trang</MenuItem>
            <MenuItem value={50}>50 / trang</MenuItem>
          </Select>
          <Pagination
            page={page}
            count={Math.max(1, Math.ceil(total / pageSize))}
            onChange={(_, p) => {
              setPage(p);
            }}
            color="primary"
          />
        </Stack>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          {form.id ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* Image Upload */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Ảnh sản phẩm
              </Typography>
              <Box
                sx={{
                  border: '2px dashed #e2e8f0',
                  borderRadius: 2,
                  p: 3,
                  textAlign: 'center',
                  bgcolor: '#f8fafc',
                  cursor: 'pointer',
                  '&:hover': { borderColor: '#2563eb', bgcolor: '#eff6ff' },
                  position: 'relative',
                }}
                onClick={() => document.getElementById('image-upload').click()}
              >
                {imagePreview || form.imageUrl ? (
                  <Box>
                    <img
                      src={
                        imagePreview?.startsWith('/')
                          ? `${import.meta.env.VITE_API_BASE || 'http://localhost:8080'}${imagePreview}`
                          : imagePreview || `${import.meta.env.VITE_API_BASE || 'http://localhost:8080'}${form.imageUrl}`
                      }
                      alt="Preview"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '200px',
                        borderRadius: '8px',
                      }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Click để thay đổi ảnh
                    </Typography>
                  </Box>
                ) : (
                  <Box>
                    <ImageIcon sx={{ fontSize: 48, color: '#94a3b8', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      {uploading ? 'Đang upload...' : 'Click để chọn ảnh sản phẩm'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Hỗ trợ: JPG, PNG, GIF, WEBP (tối đa 5MB)
                    </Typography>
                  </Box>
                )}
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                  disabled={uploading}
                />
              </Box>
            </Box>

            <TextField
              label="Tên sản phẩm"
              value={form.name || ''}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              fullWidth
              required
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Select
                  fullWidth
                  displayEmpty
                  value={form.brandId || ''}
                  onChange={(e) => setForm({ ...form, brandId: e.target.value })}
                >
                  <MenuItem value="">
                    <em>Chọn hãng</em>
                  </MenuItem>
                  {brands.map((b) => (
                    <MenuItem key={b.id} value={b.id}>
                      {b.name}
                    </MenuItem>
                  ))}
                </Select>
              </Grid>
              <Grid item xs={6}>
                <Select
                  fullWidth
                  displayEmpty
                  value={form.categoryId || ''}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                >
                  <MenuItem value="">
                    <em>Chọn danh mục</em>
                  </MenuItem>
                  {categories.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Giá (VNĐ)"
                  type="number"
                  value={form.priceCents || ''}
                  onChange={(e) => setForm({ ...form, priceCents: parseInt(e.target.value || '0', 10) })}
                  fullWidth
                  required
                  InputProps={{
                    endAdornment: <InputAdornment position="end">₫</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Tồn kho"
                  type="number"
                  value={form.stock ?? ''}
                  onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value || '0', 10) })}
                  fullWidth
                  required
                />
              </Grid>
            </Grid>
            <TextField
              label="Mô tả sản phẩm"
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              fullWidth
              multiline
              minRows={4}
              placeholder="Nhập mô tả chi tiết về sản phẩm..."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)}>Hủy</Button>
          <Button variant="contained" onClick={onSave} disabled={!form.name || !form.priceCents}>
            {form.id ? 'Cập nhật' : 'Thêm sản phẩm'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


