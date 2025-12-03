import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Stack,
  TextField,
  Typography,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { Add, Edit, Delete, Image as ImageIcon } from '@mui/icons-material';
import { useAuth } from '../state/AuthContext.jsx';
import VI from '../constants/vi';

export default function BannersPage() {
  const { api } = useAuth();
  const [banners, setBanners] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({});
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState('');

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    try {
      const { data } = await api.get('/admin/banners');
      // Sort by display_order
      const sorted = (data || []).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      setBanners(sorted);
    } catch (error) {
      console.error('Failed to load banners:', error);
      // If endpoint doesn't exist, initialize empty array
      setBanners([]);
    }
  };

  // Get recommended next display order
  const getRecommendedOrder = () => {
    if (banners.length === 0) return 1;
    const maxOrder = Math.max(...banners.map(b => b.display_order || 0));
    return maxOrder + 1;
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file ảnh');
      return;
    }

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

  const handleSave = async () => {
    try {
      const newDisplayOrder = form.displayOrder || 0;
      
      // Check if display order already exists (for other banners)
      const existingBanner = banners.find(b => 
        b.display_order === newDisplayOrder && b.id !== form.id
      );

      let updatedBanners = [];
      if (existingBanner) {
        // Shift all banners with order >= newDisplayOrder up by 1
        updatedBanners = banners
          .filter(b => b.id !== form.id && b.display_order >= newDisplayOrder)
          .map(b => ({
            id: b.id,
            displayOrder: b.display_order + 1
          }));
      }

      const payload = {
        title: form.title || '',
        subtitle: form.subtitle || '',
        imageUrl: form.imageUrl || '',
        linkUrl: form.linkUrl || '',
        active: form.active !== undefined ? form.active : true,
        displayOrder: newDisplayOrder,
      };

      // Update the current banner first
      if (form.id) {
        await api.put(`/admin/banners/${form.id}`, payload);
      } else {
        await api.post('/admin/banners', payload);
      }

      // Then update other banners' order if needed
      for (const update of updatedBanners) {
        await api.patch(`/admin/banners/${update.id}`, { displayOrder: update.displayOrder });
      }

      setOpen(false);
      setForm({});
      setImagePreview('');
      await loadBanners();
    } catch (error) {
      console.error('Failed to save banner:', error);
      alert('Lưu banner thất bại: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Xóa banner này?')) return;
    try {
      await api.delete(`/admin/banners/${id}`);
      await loadBanners();
    } catch (error) {
      console.error('Failed to delete banner:', error);
      alert('Xóa banner thất bại');
    }
  };

  const toggleActive = async (id, currentActive) => {
    try {
      await api.patch(`/admin/banners/${id}`, { active: !currentActive });
      await loadBanners();
    } catch (error) {
      console.error('Failed to toggle banner status:', error);
    }
  };

  return (
    <Box sx={{ pb: 4 }}>
      {/* Header */}
      <Stack 
        direction={{ xs: 'column', sm: 'row' }} 
        justifyContent="space-between" 
        alignItems={{ xs: 'stretch', sm: 'center' }} 
        sx={{ mb: { xs: 2, sm: 3, lg: 4 }, gap: 2 }}
      >
        <Box>
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 800, 
              color: '#0f172a',
              mb: 1,
              letterSpacing: '-0.02em',
              fontSize: { xs: '1.5rem', md: '2rem' }
            }}
          >
            Quản lý Banner
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Quản lý banner hiển thị trên trang chủ
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="large"
          startIcon={<Add />}
          onClick={() => {
            setForm({ active: true, displayOrder: getRecommendedOrder() });
            setImagePreview('');
            setOpen(true);
          }}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            px: { xs: 2, sm: 3 },
            py: { xs: 1, sm: 1.5 },
            fontSize: { xs: '0.875rem', sm: '1rem' },
            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            '&:hover': {
              boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.4)',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            }
          }}
        >
          {VI.banners.addBanner}
        </Button>
      </Stack>

      {/* Preview Section - Hiển thị tổng quan */}
      {banners.length > 0 && (
        <Card 
          sx={{ 
            mb: { xs: 2, sm: 3 },
            borderRadius: { xs: 2, lg: 3 },
            border: '1px solid',
            borderColor: 'rgba(0,0,0,0.05)',
            overflow: 'hidden'
          }}
        >
          <Box sx={{ bgcolor: '#f8fafc', px: 3, py: 2, borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a' }}>
              Xem trước Banner Layout
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Hiển thị như trên trang chủ frontend
            </Typography>
          </Box>
          <Box sx={{ p: 3, bgcolor: '#1e293b' }}>
            <Box 
              sx={{ 
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' },
                gap: 2,
                maxHeight: '400px',
                overflow: 'auto'
              }}
            >
              {banners.slice(0, 6).map((banner, idx) => {
                const getGridClass = (idx) => {
                  if (idx === 0) return { gridColumn: 'span 1' }
                  if (idx === 1) return { gridColumn: 'span 2' }
                  if (idx === 2) return { gridColumn: 'span 1' }
                  if (idx === 3) return { gridColumn: 'span 4' }
                  if (idx === 4) return { gridColumn: 'span 1' }
                  if (idx === 5) return { gridColumn: 'span 3' }
                  return { gridColumn: 'span 1' }
                }
                
                return (
                  <Box
                    key={banner.id}
                    sx={{
                      ...getGridClass(idx),
                      position: 'relative',
                      borderRadius: 2,
                      overflow: 'hidden',
                      minHeight: idx === 1 || idx === 3 || idx === 5 ? '180px' : '120px',
                      opacity: banner.active ? 1 : 0.4,
                      border: '2px solid',
                      borderColor: banner.active ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    <img
                      src={
                        banner.image_url?.startsWith('/')
                          ? `http://localhost:5173${banner.image_url}`
                          : banner.image_url
                      }
                      alt={banner.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        bgcolor: 'rgba(0,0,0,0.8)',
                        color: 'white',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 1,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      #{banner.display_order}
                    </Box>
                    {!banner.active && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          bgcolor: 'rgba(239, 68, 68, 0.9)',
                          color: 'white',
                          px: 1.5,
                          py: 0.5,
                          borderRadius: 1,
                          fontSize: '0.7rem',
                          fontWeight: 600,
                        }}
                      >
                        ẨN
                      </Box>
                    )}
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        bgcolor: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        px: 1.5,
                        py: 1,
                      }}
                    >
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          fontWeight: 600,
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {banner.title}
                      </Typography>
                    </Box>
                  </Box>
                )
              })}
            </Box>
          </Box>
        </Card>
      )}

      {/* Banner Cards - Thu nhỏ để dễ quản lý */}
      <Grid container spacing={{ xs: 2, sm: 2.5, lg: 3 }}>
        {banners.length === 0 ? (
          <Grid item xs={12}>
            <Card 
              sx={{ 
                borderRadius: { xs: 2, lg: 3 },
                border: '2px dashed',
                borderColor: 'rgba(0,0,0,0.1)',
                bgcolor: '#fafafa',
                py: { xs: 4, sm: 6, lg: 8 },
                textAlign: 'center'
              }}
            >
              <ImageIcon sx={{ fontSize: { xs: 48, sm: 64 }, color: '#cbd5e1', mb: 2 }} />
              <Typography color="text.secondary" variant="h6" sx={{ mb: 1, fontWeight: 600, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                {VI.banners.emptyMessage}
              </Typography>
              <Typography color="text.secondary" variant="body2" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                Nhấn nút "Thêm banner" để bắt đầu
              </Typography>
            </Card>
          </Grid>
        ) : (
          banners.map((banner) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={banner.id}>
              <Card 
                sx={{ 
                  borderRadius: { xs: 2, lg: 3 },
                  border: '1px solid',
                  borderColor: 'rgba(0,0,0,0.05)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: { xs: 'none', sm: 'translateY(-2px)' },
                    boxShadow: { xs: '0 2px 4px rgba(0,0,0,0.05)', sm: '0 8px 16px rgba(0,0,0,0.1)' },
                  }
                }}
              >
                <Box sx={{ position: 'relative', overflow: 'hidden' }}>
                  <CardMedia
                    component="img"
                    height="140"
                    image={
                      banner.image_url?.startsWith('/')
                        ? `http://localhost:5173${banner.image_url}`
                        : banner.image_url || 'https://via.placeholder.com/800x400?text=No+Image'
                    }
                    alt={banner.title}
                    sx={{ 
                      bgcolor: '#f1f5f9', 
                      objectFit: 'cover',
                    }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      bgcolor: 'rgba(0,0,0,0.8)',
                      color: 'white',
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 1,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}
                  >
                    #{banner.display_order}
                  </Box>
                  {!banner.active && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        bgcolor: 'rgba(239, 68, 68, 0.9)',
                        color: 'white',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 1,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                      }}
                    >
                      Đã ẩn
                    </Box>
                  )}
                </Box>
                <CardContent sx={{ p: 1.5 }}>
                  <Typography 
                    variant="subtitle2" 
                    sx={{ 
                      fontWeight: 700, 
                      mb: 0.5,
                      color: '#0f172a',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {banner.title || 'Không có tiêu đề'}
                  </Typography>
                  {banner.subtitle && (
                    <Typography 
                      variant="caption" 
                      color="text.secondary"
                      sx={{ 
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: 1.4,
                        mb: 1
                      }}
                    >
                      {banner.subtitle}
                    </Typography>
                  )}

                  <Stack 
                    direction="row" 
                    spacing={0.5} 
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ mt: 1.5 }}
                  >
                    <FormControlLabel
                      control={
                        <Switch
                          checked={banner.active}
                          onChange={() => toggleActive(banner.id, banner.active)}
                          size="small"
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': {
                              color: '#10b981',
                            },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              backgroundColor: '#10b981',
                            },
                          }}
                        />
                      }
                      label={
                        <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem' }}>
                          {banner.active ? 'Hiện' : 'Ẩn'}
                        </Typography>
                      }
                      sx={{ m: 0 }}
                    />
                    <Stack direction="row" spacing={0.5}>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setForm({
                            id: banner.id,
                            title: banner.title,
                            subtitle: banner.subtitle,
                            imageUrl: banner.image_url,
                            linkUrl: banner.link_url,
                            active: banner.active,
                            displayOrder: banner.display_order,
                          });
                          setImagePreview(banner.image_url || '');
                          setOpen(true);
                        }}
                        sx={{
                          bgcolor: '#eff6ff',
                          color: '#2563eb',
                          '&:hover': { bgcolor: '#dbeafe' },
                          width: 32,
                          height: 32
                        }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => handleDelete(banner.id)}
                        sx={{
                          bgcolor: '#fef2f2',
                          color: '#dc2626',
                          '&:hover': { bgcolor: '#fee2e2' },
                          width: 32,
                          height: 32
                        }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      <Dialog 
        open={open} 
        onClose={() => setOpen(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }
        }}
      >
        <DialogTitle 
          sx={{ 
            fontWeight: 700, 
            fontSize: '1.5rem',
            color: '#0f172a',
            pb: 1
          }}
        >
          {form.id ? VI.banners.editBanner : VI.banners.addBanner}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* Image Upload */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                {VI.banners.bannerImage}
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
                }}
                onClick={() => document.getElementById('banner-image-upload').click()}
              >
                {imagePreview || form.imageUrl ? (
                  <Box>
                    <img
                      src={
                        imagePreview?.startsWith('/')
                          ? `http://localhost:5173${imagePreview}`
                          : imagePreview ||
                            `http://localhost:5173${form.imageUrl}`
                      }
                      alt="Preview"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '300px',
                        borderRadius: '8px',
                      }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Click để thay đổi ảnh
                    </Typography>
                  </Box>
                ) : (
                  <Box>
                    <ImageIcon sx={{ fontSize: 64, color: '#94a3b8', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      {uploading ? 'Đang upload...' : 'Click để chọn ảnh banner'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Khuyến nghị: 1920x600px, tối đa 5MB
                    </Typography>
                  </Box>
                )}
                <input
                  id="banner-image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                  disabled={uploading}
                />
              </Box>
            </Box>

            <TextField
              label={VI.banners.title}
              value={form.title || ''}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              fullWidth
              required
              placeholder="VD: Giảm giá mùa hè 2024"
            />

            <TextField
              label={VI.banners.subtitle}
              value={form.subtitle || ''}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              fullWidth
              placeholder="VD: Giảm tới 50% cho tất cả sản phẩm"
            />

            <TextField
              label={VI.banners.linkUrl}
              value={form.linkUrl || ''}
              onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
              fullWidth
              placeholder="/products?sale=true"
            />

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label={VI.banners.displayOrder}
                  type="number"
                  value={form.displayOrder ?? 0}
                  onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value, 10) })}
                  fullWidth
                  helperText={`Khuyến nghị: ${getRecommendedOrder()} (tự động dời nếu trùng)`}
                />
              </Grid>
              <Grid item xs={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.active !== undefined ? form.active : true}
                      onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    />
                  }
                  label={VI.banners.active}
                  sx={{ mt: 2 }}
                />
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2, gap: 1 }}>
          <Button 
            onClick={() => setOpen(false)}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              color: '#64748b'
            }}
          >
            Hủy
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSave} 
            disabled={!form.title || !form.imageUrl}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              '&:hover': {
                boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.4)',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              },
              '&:disabled': {
                background: '#e2e8f0',
                color: '#94a3b8'
              }
            }}
          >
            {form.id ? 'Cập nhật' : VI.banners.addBanner}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
