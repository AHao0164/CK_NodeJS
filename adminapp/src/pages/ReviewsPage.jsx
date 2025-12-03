import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Rating, Button, Select, MenuItem, FormControl, InputLabel, IconButton,
  Stack, Alert, Snackbar
} from '@mui/material';
import { Delete as DeleteIcon, Refresh as RefreshIcon } from '@mui/icons-material';

import { useAuth } from '../state/AuthContext';

export default function ReviewsPage() {
  const { api } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [ratingFilter, setRatingFilter] = useState('');
  const [replyFilter, setReplyFilter] = useState('');
  
  // Toast notification
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  const showToast = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const loadReviews = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (ratingFilter) params.append('rating', ratingFilter);
      if (replyFilter) params.append('hasReply', replyFilter);
      params.append('limit', '100');

      const res = await api.get(`/admin/reviews?${params.toString()}`);
      setReviews(res.data.reviews || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Load reviews error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (api) {
      loadReviews();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratingFilter, replyFilter, api]);

  const handleDeleteReview = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa đánh giá này?')) return;

    try {
      await api.delete(`/admin/reviews/${id}`);
      showToast('Đã xóa đánh giá', 'success');
      loadReviews();
    } catch (err) {
      console.error('Delete error:', err);
      showToast(err.response?.data?.error || 'Không thể xóa đánh giá', 'error');
    }
  };

  // Calculate statistics
  const stats = {
    average: reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : 0,
    byRating: [5, 4, 3, 2, 1].map(star => ({
      star,
      count: reviews.filter(r => r.rating === star).length
    })),
    withReply: reviews.filter(r => r.admin_reply).length,
    withoutReply: reviews.filter(r => !r.admin_reply).length
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 2.5, lg: 3 } }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, mb: { xs: 2, sm: 3 }, fontSize: { xs: '1.25rem', md: '1.5rem' } }}>
        Quản lý Đánh giá
      </Typography>

      {/* Statistics Cards */}
      <Stack 
        direction={{ xs: 'column', sm: 'row' }} 
        spacing={2} 
        sx={{ mb: { xs: 2, sm: 3 } }}
      >
        <Card sx={{ flex: 1, borderRadius: { xs: 2, lg: 3 } }}>
          <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
            <Typography variant="h3" color="primary" sx={{ fontWeight: 'bold', fontSize: { xs: '2rem', sm: '3rem' } }}>
              {stats.average} ⭐
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
              Đánh giá trung bình
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, borderRadius: { xs: 2, lg: 3 } }}>
          <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
            <Typography variant="h3" color="primary" sx={{ fontWeight: 'bold', fontSize: { xs: '2rem', sm: '3rem' } }}>
              {total}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
              Tổng số đánh giá
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, borderRadius: { xs: 2, lg: 3 } }}>
          <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
            <Typography variant="h3" color="success.main" sx={{ fontWeight: 'bold', fontSize: { xs: '2rem', sm: '3rem' } }}>
              {stats.withReply}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
              Đã phản hồi
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, borderRadius: { xs: 2, lg: 3 } }}>
          <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
            <Typography variant="h3" color="warning.main" sx={{ fontWeight: 'bold', fontSize: { xs: '2rem', sm: '3rem' } }}>
              {stats.withoutReply}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
              Chưa phản hồi
            </Typography>
          </CardContent>
        </Card>
      </Stack>

      {/* Filters */}
      <Card sx={{ 
        mb: { xs: 2, sm: 3 }, 
        p: { xs: 2, sm: 2.5 }, 
        borderRadius: { xs: 2, lg: 3 },
        overflow: 'hidden'
      }}>
        <Stack 
          direction={{ xs: 'column', sm: 'row' }} 
          spacing={2} 
          alignItems={{ xs: 'stretch', sm: 'center' }}
        >
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Lọc theo sao</InputLabel>
            <Select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              label="Lọc theo sao"
            >
              <MenuItem value="">Tất cả</MenuItem>
              <MenuItem value="5">5 sao</MenuItem>
              <MenuItem value="4">4 sao</MenuItem>
              <MenuItem value="3">3 sao</MenuItem>
              <MenuItem value="2">2 sao</MenuItem>
              <MenuItem value="1">1 sao</MenuItem>
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Trạng thái</InputLabel>
            <Select
              value={replyFilter}
              onChange={(e) => setReplyFilter(e.target.value)}
              label="Trạng thái"
            >
              <MenuItem value="">Tất cả</MenuItem>
              <MenuItem value="false">Chưa phản hồi</MenuItem>
              <MenuItem value="true">Đã phản hồi</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadReviews}
            sx={{ 
              fontSize: { xs: '0.875rem', sm: '1rem' },
              py: { xs: 1, sm: 1.5 }
            }}
          >
            Làm mới
          </Button>
        </Stack>
      </Card>

      {/* Rating Distribution */}
      <Card sx={{ 
        mb: { xs: 2, sm: 3 }, 
        p: { xs: 2, sm: 2.5 }, 
        borderRadius: { xs: 2, lg: 3 },
        overflow: 'hidden'
      }}>
        <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
          Phân bố đánh giá
        </Typography>
        <Stack spacing={1}>
          {stats.byRating.map(({ star, count }) => (
            <Box key={star} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography sx={{ minWidth: 60 }}>{star} ⭐</Typography>
              <Box sx={{ flex: 1, height: 20, bgcolor: 'grey.200', borderRadius: 1, overflow: 'hidden' }}>
                <Box
                  sx={{
                    height: '100%',
                    bgcolor: 'warning.main',
                    width: `${total > 0 ? (count / total) * 100 : 0}%`
                  }}
                />
              </Box>
              <Typography sx={{ minWidth: 50, textAlign: 'right' }}>{count}</Typography>
            </Box>
          ))}
        </Stack>
      </Card>

      {/* Reviews Table */}
      <TableContainer component={Paper} sx={{ 
        borderRadius: { xs: 2, lg: 3 }, 
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        overflow: 'hidden'
      }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Sản phẩm</TableCell>
              <TableCell>User ID</TableCell>
              <TableCell>Đánh giá</TableCell>
              <TableCell>Bình luận</TableCell>
              <TableCell>Phản hồi</TableCell>
              <TableCell>Ngày tạo</TableCell>
              <TableCell align="center">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center">Đang tải...</TableCell>
              </TableRow>
            ) : reviews.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  Không có đánh giá nào
                </TableCell>
              </TableRow>
            ) : (
              reviews.map((review) => (
                <TableRow key={review.id}>
                  <TableCell>{review.id}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 200 }} noWrap>
                      {review.product_name || `Product #${review.product_id}`}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap>
                      {review.user_name || review.user_email || `User #${review.user_id}`}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Rating value={review.rating} readOnly size="small" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 250 }} noWrap>
                      {review.comment || '(Không có bình luận)'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {review.comments && review.comments.length > 0 ? (
                      <Chip label={`${review.comments.length} phản hồi`} color="success" size="small" />
                    ) : review.admin_reply ? (
                      <Chip label="1 phản hồi (cũ)" color="success" size="small" />
                    ) : (
                      <Chip label="Chưa phản hồi" color="warning" size="small" />
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(review.created_at).toLocaleDateString('vi-VN')}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      color="error"
                      size="small"
                      onClick={() => handleDeleteReview(review.id)}
                      title="Xóa"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
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
