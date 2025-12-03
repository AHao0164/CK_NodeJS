import { useEffect, useMemo, useState } from 'react';
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
  Divider,
  Checkbox,
  Snackbar,
  Alert,
} from '@mui/material';
import { Edit, Delete, Add, Search, Image as ImageIcon, DeleteSweep, ArrowUpward, ArrowDownward, FileDownload } from '@mui/icons-material';
import { useAuth } from '../state/AuthContext.jsx';
import { exportToExcel, formatProductsForExport } from '../utils/exportExcel';
import SpecsEditor from '../components/SpecsEditor';
import FeaturesEditor from '../components/FeaturesEditor';

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
  const [brandFilter, setBrandFilter] = useState('');
  const [priceDisplay, setPriceDisplay] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  const load = async () => {
    const params = { q, sort, page, pageSize };
    if (brandFilter) params.brandId = brandFilter;
    if (categoryFilter) params.categoryId = categoryFilter;
    
    const [p, b, c] = await Promise.all([
      api.get('/admin/catalog/products', { params }),
      api.get('/admin/catalog/brands'),
      api.get('/admin/catalog/categories'),
    ]);
    setRows(p.data.items);
    setTotal(p.data.total);
    setBrands(b.data);
    setCategories(c.data);
    setSelectedIds([]); 
  };

  useEffect(() => { load(); }, [q, sort, page, pageSize, brandFilter, categoryFilter]);

  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Validate all files
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        alert('Vui lòng chỉ chọn file ảnh');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert(`File ${file.name} quá lớn. Kích thước tối đa 5MB`);
        return;
      }
    }

    try {
      setUploading(true);
      const uploadedUrls = [];

      // Upload each file
      for (const file of files) {
        const formData = new FormData();
        formData.append('image', file);

        const response = await api.post('/admin/catalog/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        uploadedUrls.push(response.data.imageUrl);
      }

      // Set first image as main imageUrl, rest in images array
      const [mainImage, ...otherImages] = uploadedUrls;
      const existingImages = form.images || [];
      
      setForm({ 
        ...form, 
        imageUrl: mainImage,
        images: [...existingImages, ...uploadedUrls]
      });
      setImagePreview(mainImage);
      
      setSnackbar({ 
        open: true, 
        message: `✓ Đã upload ${uploadedUrls.length} ảnh thành công!`, 
        severity: 'success' 
      });
    } catch (error) {
      console.error('Upload error:', error);
      setSnackbar({ 
        open: true, 
        message: '✗ Upload ảnh thất bại. Vui lòng thử lại!', 
        severity: 'error' 
      });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const onSave = async () => {
    try {
      // Ensure discountPercent is a number and features is an array
      const payload = {
        ...form,
        discountPercent: parseInt(form.discountPercent || '0', 10),
        features: Array.isArray(form.features) ? form.features : [],
        images: Array.isArray(form.images) ? form.images : [],
        specs: form.specs || {}
      };
      
      console.log('Saving product with payload:', JSON.stringify(payload, null, 2));
      
      if (form.id) {
        const response = await api.put(`/admin/catalog/products/${form.id}`, payload);
        console.log('Update response:', response.data);
        setSnackbar({ open: true, message: '✓ Cập nhật sản phẩm thành công!', severity: 'success' });
      } else {
        const response = await api.post('/admin/catalog/products', payload);
        console.log('Create response:', response.data);
        setSnackbar({ open: true, message: '✓ Thêm sản phẩm mới thành công!', severity: 'success' });
      }
      setOpen(false);
      setForm({});
      setPriceDisplay('');
      setImagePreview('');
      await load();
    } catch (error) {
      console.error('Save error:', error);
      console.error('Error response:', error.response?.data);
      setSnackbar({ 
        open: true, 
        message: 'Lưu thất bại: ' + (error.response?.data?.error || error.message), 
        severity: 'error' 
      });
    }
  };

  const onDelete = async (id) => {
    if (!confirm('Xóa sản phẩm này?')) return;
    try {
      await api.delete(`/admin/catalog/products/${id}`);
      setSnackbar({ open: true, message: 'Đã xóa sản phẩm', severity: 'success' });
      await load();
    } catch (error) {
      setSnackbar({ open: true, message: 'Xóa thất bại', severity: 'error' });
    }
  };

  const onBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Xóa ${selectedIds.length} sản phẩm đã chọn?`)) return;
    
    try {
      await api.post('/admin/catalog/products/bulk-delete', { ids: selectedIds });
      setSnackbar({ open: true, message: `Đã xóa ${selectedIds.length} sản phẩm`, severity: 'success' });
      await load();
    } catch (error) {
      console.error('Bulk delete error:', error);
      setSnackbar({ open: true, message: 'Xóa thất bại', severity: 'error' });
    }
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelectedIds(rows.map(r => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id) 
        : [...prev, id]
    );
  };

  const brandNameById = useMemo(() => Object.fromEntries(brands.map(b => [b.id, b.name])), [brands]);
  const categoryNameById = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c.name])), [categories]);

  const formatCurrency = (cents) => {
    // Format with dots as thousand separators
    const formatted = Math.round(cents).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return formatted + '₫';
  };

  const formatPrice = (value) => {
    if (!value) return '';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const parsePrice = (formatted) => {
    if (!formatted) return 0;
    return parseInt(formatted.replace(/\./g, ''), 10) || 0;
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
          Quản lý Sản phẩm
        </Typography>
        <Stack 
          direction={{ xs: 'column', sm: 'row' }} 
          spacing={1}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          <Button
            variant="contained"
            color="success"
            startIcon={<FileDownload />}
            onClick={() => exportToExcel(formatProductsForExport(rows), 'SanPham', 'Sản phẩm')}
            sx={{ 
              fontSize: { xs: '0.875rem', sm: '1rem' },
              py: { xs: 1, sm: 1.5 }
            }}
          >
            Xuất Excel
          </Button>
          {selectedIds.length > 0 && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteSweep />}
              onClick={onBulkDelete}
              sx={{ 
                fontSize: { xs: '0.875rem', sm: '1rem' },
                py: { xs: 1, sm: 1.5 }
              }}
            >
              Xóa đã chọn ({selectedIds.length})
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              setForm({});
              setImagePreview('');
              setOpen(true);
            }}
            sx={{ 
              fontSize: { xs: '0.875rem', sm: '1rem' },
              py: { xs: 1, sm: 1.5 }
            }}
          >
            Thêm sản phẩm
          </Button>
        </Stack>
      </Stack>

      <Paper sx={{ 
        p: { xs: 2, sm: 2.5 }, 
        mb: { xs: 2, sm: 3 }, 
        borderRadius: { xs: 2, lg: 3 }, 
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        overflow: 'hidden'
      }}>
        <Stack spacing={2}>
          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            spacing={2} 
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
            <TextField
              size="small"
              placeholder="Tìm kiếm tên hoặc SKU..."
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
          
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 80 }}>
              Lọc theo:
            </Typography>
            <Select
              size="small"
              displayEmpty
              value={brandFilter}
              onChange={(e) => {
                setBrandFilter(e.target.value);
                setPage(1);
              }}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">
                <em>Tất cả hãng</em>
              </MenuItem>
              {brands.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.name}
                </MenuItem>
              ))}
            </Select>
            <Select
              size="small"
              displayEmpty
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">
                <em>Tất cả danh mục</em>
              </MenuItem>
              {categories.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
            {(brandFilter || categoryFilter) && (
              <Button
                size="small"
                onClick={() => {
                  setBrandFilter('');
                  setCategoryFilter('');
                  setPage(1);
                }}
              >
                Xóa bộ lọc
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ 
        borderRadius: { xs: 2, lg: 3 }, 
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        overflow: 'hidden'
      }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={rows.length > 0 && selectedIds.length === rows.length}
                  indeterminate={selectedIds.length > 0 && selectedIds.length < rows.length}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>STT</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>SKU</TableCell>
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
                <TableCell colSpan={9} align="center">
                  <Typography color="text.secondary" variant="body2" sx={{ py: 4 }}>
                    Không tìm thấy sản phẩm nào
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, idx) => (
                <TableRow 
                  key={r.id} 
                  hover
                  selected={selectedIds.includes(r.id)}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedIds.includes(r.id)}
                      onChange={() => handleSelectOne(r.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {(page - 1) * pageSize + idx + 1}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={r.sku || '-'} 
                      size="small" 
                      variant="outlined"
                      sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                    />
                  </TableCell>
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
                            src={r.image_url.startsWith('http') ? r.image_url : `${import.meta.env.VITE_API_BASE || 'http://localhost:8080'}${r.image_url}`}
                            alt={r.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.parentElement.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" style="color:#94a3b8"><rect fill="#f1f5f9" width="48" height="48"/><text fill="currentColor" x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="10">No Image</text></svg>';
                            }}
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
                    {r.discount_percent > 0 ? (
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main' }}>
                          {formatCurrency(r.price_cents * (100 - r.discount_percent) / 100)}
                        </Typography>
                        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
                          <Typography variant="caption" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>
                            {formatCurrency(r.price_cents)}
                          </Typography>
                          <Chip label={`-${r.discount_percent}%`} size="small" color="error" sx={{ height: 18, fontSize: '0.7rem' }} />
                        </Stack>
                      </Box>
                    ) : (
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatCurrency(r.price_cents)}
                      </Typography>
                    )}
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
                      onClick={async () => {
                        // Load full product detail with images
                        try {
                          const apiUrl = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
                          const response = await fetch(`${apiUrl}/catalog/products/${r.id}`);
                          const productDetail = await response.json();
                          
                          const imageUrls = Array.isArray(productDetail.images) 
                            ? productDetail.images.map(img => img.url)
                            : (r.image_url ? [r.image_url] : []);
                          
                          setForm({
                            id: r.id,
                            sku: r.sku,
                            name: r.name,
                            brandId: r.brand_id,
                            categoryId: r.category_id,
                            priceCents: r.price_cents,
                            discountPercent: r.discount_percent || 0,
                            stock: r.stock,
                            description: r.description,
                            imageUrl: imageUrls[0] || r.image_url,
                            images: imageUrls,
                            specs: r.specs || {},
                            features: r.features || [],
                          });
                          setPriceDisplay(formatPrice(r.price_cents));
                          setImagePreview(imageUrls[0] || r.image_url || '');
                          setOpen(true);
                        } catch (err) {
                          console.error('Load product detail error:', err);
                          // Fallback to row data
                          setForm({
                            id: r.id,
                            sku: r.sku,
                            name: r.name,
                            brandId: r.brand_id,
                            categoryId: r.category_id,
                            priceCents: r.price_cents,
                            discountPercent: r.discount_percent || 0,
                            stock: r.stock,
                            description: r.description,
                            imageUrl: r.image_url,
                            images: r.image_url ? [r.image_url] : [],
                            specs: r.specs || {},
                            features: r.features || [],
                          });
                          setPriceDisplay(formatPrice(r.price_cents));
                          setImagePreview(r.image_url || '');
                          setOpen(true);
                        }
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

      <Dialog open={open} onClose={() => { setOpen(false); setPriceDisplay(''); }} maxWidth="md" fullWidth>
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
                          : imagePreview || (form.imageUrl?.startsWith('http') ? form.imageUrl : `${import.meta.env.VITE_API_BASE || 'http://localhost:8080'}${form.imageUrl}`)
                      }
                      alt="Preview"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '200px',
                        borderRadius: '8px',
                      }}
                      onError={(e) => {
                        e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
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
                      Hỗ trợ: JPG, PNG, GIF, WEBP (tối đa 5MB mỗi ảnh)
                    </Typography>
                    <Typography variant="caption" color="primary.main" sx={{ display: 'block', mt: 0.5 }}>
                      Có thể chọn nhiều ảnh cùng lúc
                    </Typography>
                  </Box>
                )}
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                  disabled={uploading}
                />
              </Box>
            </Box>

            {/* Multiple Images Gallery */}
            {form.images && form.images.length > 0 && (
              <Box sx={{ mb: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, color: 'primary.main' }}>
                  Ảnh sản phẩm ({form.images.length})
                </Typography>
                <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                  {form.images.map((imgUrl, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        position: 'relative',
                        width: 100,
                        height: 100,
                        borderRadius: 2,
                        overflow: 'visible',
                        border: '3px solid',
                        borderColor: idx === 0 ? 'primary.main' : 'grey.300',
                        boxShadow: idx === 0 ? '0 4px 12px rgba(25, 118, 210, 0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
                        transition: 'all 0.2s',
                        '&:hover': {
                          transform: 'scale(1.05)',
                          boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
                        },
                      }}
                    >
                      <img
                        src={imgUrl.startsWith('http') ? imgUrl : `${import.meta.env.VITE_API_BASE || 'http://localhost:8080'}${imgUrl}`}
                        alt={`Product ${idx + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f0f0f0" width="100" height="100"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="12"%3ELỗi%3C/text%3E%3C/svg%3E';
                        }}
                      />
                      {idx === 0 && (
                        <Chip
                          label="Ảnh chính"
                          size="small"
                          color="primary"
                          sx={{
                            position: 'absolute',
                            bottom: 4,
                            left: 4,
                            height: 18,
                            fontSize: '0.7rem',
                            fontWeight: 600,
                          }}
                        />
                      )}
                      
                      {/* Control buttons */}
                      <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{
                          position: 'absolute',
                          top: -12,
                          right: -12,
                        }}
                      >
                        {/* Move Left */}
                        {idx > 0 && (
                          <IconButton
                            size="small"
                            onClick={() => {
                              const updated = [...form.images];
                              [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
                              setForm({ ...form, images: updated, imageUrl: updated[0] });
                              if (idx === 0 || idx === 1) setImagePreview(updated[0]);
                              setSnackbar({ open: true, message: 'Đã di chuyển ảnh', severity: 'info' });
                            }}
                            sx={{
                              bgcolor: 'primary.main',
                              color: 'white',
                              width: 24,
                              height: 24,
                              '&:hover': { bgcolor: 'primary.dark' },
                            }}
                          >
                            <ArrowUpward sx={{ fontSize: 14 }} />
                          </IconButton>
                        )}
                        
                        {/* Move Right */}
                        {idx < form.images.length - 1 && (
                          <IconButton
                            size="small"
                            onClick={() => {
                              const updated = [...form.images];
                              [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
                              setForm({ ...form, images: updated, imageUrl: updated[0] });
                              if (idx === 0) setImagePreview(updated[0]);
                              setSnackbar({ open: true, message: 'Đã di chuyển ảnh', severity: 'info' });
                            }}
                            sx={{
                              bgcolor: 'primary.main',
                              color: 'white',
                              width: 24,
                              height: 24,
                              '&:hover': { bgcolor: 'primary.dark' },
                            }}
                          >
                            <ArrowDownward sx={{ fontSize: 14 }} />
                          </IconButton>
                        )}
                        
                        {/* Delete */}
                        <IconButton
                          size="small"
                          onClick={() => {
                            const updated = form.images.filter((_, i) => i !== idx);
                            
                            // Reset form if no images left
                            if (updated.length === 0) {
                              setForm({ ...form, images: [], imageUrl: '' });
                              setImagePreview('');
                              setSnackbar({ open: true, message: 'Đã xóa tất cả ảnh', severity: 'info' });
                              return;
                            }
                            
                            // Update form with the first image as the main image
                            setForm({ ...form, images: updated, imageUrl: updated[0] });
                            setImagePreview(updated[0]);
                            setSnackbar({ open: true, message: 'Đã xóa ảnh', severity: 'success' });
                          }}
                          sx={{
                            bgcolor: 'error.main',
                            color: 'white',
                            width: 24,
                            height: 24,
                            '&:hover': { bgcolor: 'error.dark' },
                          }}
                        >
                          <Delete sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Dùng nút mũi tên để sắp xếp thứ tự ảnh. Ảnh đầu tiên sẽ là ảnh chính.
                </Typography>
              </Box>
            )}

            <Grid container spacing={2}>
              <Grid item xs={8}>
                <TextField
                  label="Tên sản phẩm"
                  value={form.name || ''}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  label="SKU (Mã sản phẩm)"
                  value={form.sku || ''}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  fullWidth
                  placeholder="Tự động tạo nếu để trống"
                  helperText="VD: LAP001, MSI-GF63"
                />
              </Grid>
            </Grid>
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
              <Grid item xs={4}>
                <TextField
                  label="Giá gốc (VNĐ)"
                  type="text"
                  value={priceDisplay}
                  onChange={(e) => {
                    const input = e.target.value.replace(/[^0-9]/g, '');
                    setPriceDisplay(formatPrice(input));
                    setForm({ ...form, priceCents: parseInt(input || '0', 10) });
                  }}
                  fullWidth
                  required
                  placeholder="VD: 25.990.000"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">₫</InputAdornment>,
                  }}
                  helperText="Gõ số, dấu chấm tự động thêm"
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  label="Giảm giá"
                  type="number"
                  value={form.discountPercent ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setForm({ ...form, discountPercent: '' });
                    } else {
                      const num = parseInt(val, 10);
                      if (!isNaN(num) && num >= 0 && num <= 100) {
                        setForm({ ...form, discountPercent: num });
                      }
                    }
                  }}
                  onBlur={(e) => {
                    // Khi blur, nếu rỗng thì set về 0
                    if (e.target.value === '') {
                      setForm({ ...form, discountPercent: 0 });
                    }
                  }}
                  fullWidth
                  placeholder="0"
                  inputProps={{ min: 0, max: 100, step: 1 }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  }}
                  helperText={form.discountPercent > 0 ? `Giá sau giảm: ${formatCurrency(form.priceCents * (100 - form.discountPercent) / 100)}` : 'VD: Nhập 10 = giảm 10%'}
                />
              </Grid>
              <Grid item xs={4}>
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

            {/* Divider */}
            <Divider sx={{ my: 2 }} />

            {/* Features Editor */}
            <FeaturesEditor
              features={form.features || []}
              onChange={(updatedFeatures) => setForm({ ...form, features: updatedFeatures })}
            />

            {/* Divider */}
            <Divider sx={{ my: 2 }} />

            {/* Specs Editor */}
            <SpecsEditor
              specs={form.specs || {}}
              onChange={(updatedSpecs) => setForm({ ...form, specs: updatedSpecs })}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => { setOpen(false); setPriceDisplay(''); }}>Hủy</Button>
          <Button variant="contained" onClick={onSave} disabled={!form.name || !form.priceCents}>
            {form.id ? 'Cập nhật' : 'Thêm sản phẩm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}