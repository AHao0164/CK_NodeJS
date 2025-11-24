import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Stack,
  Chip,
  TextField,
  InputAdornment,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  MenuItem,
  Select,
} from '@mui/material';
import { Search, Person, Edit, Block, CheckCircle } from '@mui/icons-material';
import { useAuth } from '../state/AuthContext.jsx';

export default function CustomersPage() {
  const { api } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [form, setForm] = useState({});

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const res = await api.get('/admin/users', { params: { limit: 200 } });
      setCustomers(res.data || []);
    } catch (error) {
      console.error('Failed to load customers:', error);
    }
  };

  const handleEdit = (customer) => {
    setSelectedCustomer(customer);
    setForm({
      full_name: customer.full_name || '',
      email: customer.email || '',
      banned: customer.banned || 0,
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    try {
      await api.patch(`/admin/users/${selectedCustomer.id}`, form);
      await loadCustomers();
      setEditOpen(false);
      setSelectedCustomer(null);
      setForm({});
    } catch (error) {
      console.error('Failed to update customer:', error);
      alert('Cập nhật thất bại: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleBan = async (customer, ban) => {
    try {
      await api.patch(`/admin/users/${customer.id}`, { banned: ban ? 1 : 0 });
      await loadCustomers();
    } catch (error) {
      console.error('Failed to ban/unban customer:', error);
      alert('Thao tác thất bại');
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Khách hàng
        </Typography>
      </Stack>

      <Paper sx={{ p: 2, mb: 3, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Tìm kiếm theo email hoặc tên..."
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
      </Paper>

      <Paper sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Khách hàng</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Vai trò</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell>Ngày đăng ký</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="text.secondary" variant="body2" sx={{ py: 4 }}>
                    Không tìm thấy khách hàng nào
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredCustomers.map((customer) => (
                <TableRow key={customer.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar sx={{ bgcolor: '#2563eb', width: 36, height: 36 }}>
                        {customer.full_name?.[0]?.toUpperCase() || <Person />}
                      </Avatar>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {customer.full_name}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{customer.email}</TableCell>
                  <TableCell>
                    <Chip
                      label={customer.role === 'ADMIN' ? 'Admin' : 'Khách hàng'}
                      color={customer.role === 'ADMIN' ? 'primary' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={customer.banned ? 'Đã khóa' : 'Hoạt động'}
                      color={customer.banned ? 'error' : 'success'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{formatDate(customer.created_at)}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(customer)}
                        color="primary"
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      {customer.banned ? (
                        <IconButton
                          size="small"
                          onClick={() => handleBan(customer, false)}
                          color="success"
                        >
                          <CheckCircle fontSize="small" />
                        </IconButton>
                      ) : (
                        <IconButton
                          size="small"
                          onClick={() => handleBan(customer, true)}
                          color="error"
                        >
                          <Block fontSize="small" />
                        </IconButton>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Sửa thông tin khách hàng</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Tên đầy đủ"
              value={form.full_name || ''}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              fullWidth
            />
            <TextField
              label="Email"
              value={form.email || ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              fullWidth
              type="email"
            />
            <Select
              label="Trạng thái"
              value={form.banned || 0}
              onChange={(e) => setForm({ ...form, banned: e.target.value })}
              fullWidth
            >
              <MenuItem value={0}>Hoạt động</MenuItem>
              <MenuItem value={1}>Đã khóa</MenuItem>
            </Select>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleSave}>
            Lưu
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
