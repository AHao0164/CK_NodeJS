import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  Snackbar,
  CircularProgress,
  Divider,
} from '@mui/material';
import { Save, Person, Phone, LocationOn } from '@mui/icons-material';
import { useAuth } from '../state/AuthContext.jsx';

export default function AdminProfilePage() {
  const { api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    province: '',
    ward: '',
    addressDetail: '',
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/auth/me');
      setFormData({
        fullName: data.fullname || '',
        email: data.email || '',
        phone: data.phone || '',
        province: data.city || '',
        ward: data.ward || '',
        addressDetail: data.address || '',
      });
    } catch (error) {
      showNotification('Không thể tải thông tin cá nhân', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field) => (event) => {
    setFormData(prev => ({ ...prev, [field]: event.target.value }));
    // Clear error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.fullName || formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Họ tên phải có ít nhất 2 ký tự';
    }
    
    if (formData.phone && !/^\d{10,11}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Số điện thoại phải có 10-11 chữ số';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      showNotification('Vui lòng kiểm tra lại thông tin', 'error');
      return;
    }

    try {
      setSaving(true);
      await api.patch('/auth/profile', {
        fullName: formData.fullName,
        phone: formData.phone || null,
        province: formData.province || null,
        ward: formData.ward || null,
        addressDetail: formData.addressDetail || null,
      });
      showNotification('Cập nhật thông tin thành công!', 'success');
      // Reload to reflect changes
      await loadProfile();
    } catch (error) {
      const message = error.response?.data?.error || 'Không thể cập nhật thông tin';
      showNotification(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const showNotification = (message, severity = 'success') => {
    setNotification({ open: true, message, severity });
  };

  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography 
        variant="h5" 
        gutterBottom 
        sx={{ 
          fontWeight: 700,
          fontSize: { xs: '1.25rem', md: '1.5rem' }
        }}
      >
        Thông tin cá nhân
      </Typography>

      <Card sx={{ maxWidth: 800, mt: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={3}>
            {/* Email (read-only) */}
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                <Person sx={{ color: 'text.secondary', fontSize: 20 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Email (không thể thay đổi)
                </Typography>
              </Stack>
              <TextField
                fullWidth
                value={formData.email}
                disabled
                variant="outlined"
                sx={{
                  '& .MuiInputBase-input.Mui-disabled': {
                    WebkitTextFillColor: 'rgba(0, 0, 0, 0.6)',
                    backgroundColor: '#f5f5f5',
                  }
                }}
              />
            </Box>

            <Divider />

            {/* Full Name */}
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                <Person sx={{ color: 'primary.main', fontSize: 20 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Họ và tên *
                </Typography>
              </Stack>
              <TextField
                fullWidth
                value={formData.fullName}
                onChange={handleChange('fullName')}
                error={!!errors.fullName}
                helperText={errors.fullName}
                placeholder="Nhập họ và tên"
                variant="outlined"
              />
            </Box>

            {/* Phone */}
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                <Phone sx={{ color: 'primary.main', fontSize: 20 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Số điện thoại
                </Typography>
              </Stack>
              <TextField
                fullWidth
                value={formData.phone}
                onChange={handleChange('phone')}
                error={!!errors.phone}
                helperText={errors.phone}
                placeholder="Nhập số điện thoại (10-11 chữ số)"
                variant="outlined"
              />
            </Box>

            {/* Province */}
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                <LocationOn sx={{ color: 'primary.main', fontSize: 20 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Tỉnh/Thành phố
                </Typography>
              </Stack>
              <TextField
                fullWidth
                value={formData.province}
                onChange={handleChange('province')}
                placeholder="Nhập tỉnh/thành phố"
                variant="outlined"
              />
            </Box>

            {/* Ward */}
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                <LocationOn sx={{ color: 'primary.main', fontSize: 20 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Quận/Huyện/Phường
                </Typography>
              </Stack>
              <TextField
                fullWidth
                value={formData.ward}
                onChange={handleChange('ward')}
                placeholder="Nhập quận/huyện/phường"
                variant="outlined"
              />
            </Box>

            {/* Address Detail */}
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                <LocationOn sx={{ color: 'primary.main', fontSize: 20 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Địa chỉ cụ thể
                </Typography>
              </Stack>
              <TextField
                fullWidth
                multiline
                rows={2}
                value={formData.addressDetail}
                onChange={handleChange('addressDetail')}
                placeholder="Nhập số nhà, tên đường..."
                variant="outlined"
              />
            </Box>

            {/* Save Button */}
            <Box sx={{ pt: 2 }}>
              <Button
                variant="contained"
                size="large"
                startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <Save />}
                onClick={handleSave}
                disabled={saving}
                fullWidth
                sx={{
                  py: 1.5,
                  fontWeight: 600,
                  textTransform: 'none',
                  fontSize: '1rem',
                }}
              >
                {saving ? 'Đang lưu...' : 'Lưu thông tin'}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.severity}
          variant="filled"
          sx={{ borderRadius: 2 }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
