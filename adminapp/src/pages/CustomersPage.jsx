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
} from '@mui/material';
import { Search, Person } from '@mui/icons-material';
import { useAuth } from '../state/AuthContext.jsx';

export default function CustomersPage() {
  const { api } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');

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

  const filteredCustomers = customers.filter(
    (c) =>
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.full_name.toLowerCase().includes(search.toLowerCase())
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
              <TableCell>Ngày đăng ký</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
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
                  <TableCell>{formatDate(customer.created_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}


