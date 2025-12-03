import { useEffect, useState } from 'react';
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
  Button,
} from '@mui/material';
import { Search, Person, FileDownload } from '@mui/icons-material';
import { useAuth } from '../state/AuthContext.jsx';
import { exportToExcel, formatCustomersForExport } from '../utils/exportExcel';

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
      <Stack 
        direction={{ xs: 'column', sm: 'row' }} 
        justifyContent="space-between" 
        alignItems={{ xs: 'stretch', sm: 'center' }} 
        sx={{ mb: { xs: 2, sm: 3 }, gap: 2 }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700, fontSize: { xs: '1.25rem', md: '1.5rem' } }}>
          Quản lý Khách hàng
        </Typography>
        <Button
          variant="contained"
          color="success"
          startIcon={<FileDownload />}
          onClick={() => exportToExcel(formatCustomersForExport(filteredCustomers), 'KhachHang', 'Khách hàng')}
          sx={{ 
            fontSize: { xs: '0.875rem', sm: '1rem' },
            py: { xs: 1, sm: 1.5 }
          }}
        >
          Xuất Excel
        </Button>
      </Stack>

      <Paper sx={{ 
        p: { xs: 2, sm: 2.5 }, 
        mb: { xs: 2, sm: 3 }, 
        borderRadius: { xs: 2, lg: 3 }, 
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        overflow: 'hidden'
      }}>
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

      <Paper sx={{ 
        borderRadius: { xs: 2, lg: 3 }, 
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        overflow: 'hidden'
      }}>
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


