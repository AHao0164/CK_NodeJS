import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  InputAdornment,
} from '@mui/material';
import { Delete, Add, Label } from '@mui/icons-material';
import { useAuth } from '../state/AuthContext.jsx';

export default function BrandsPage() {
  const { api } = useAuth();
  const [rows, setRows] = useState([]);
  const [name, setName] = useState('');

  const load = async () => {
    try {
      const { data } = await api.get('/admin/catalog/brands');
      setRows(data || []);
    } catch (error) {
      console.error('Failed to load brands:', error);
      setRows([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addBrand = async () => {
    if (!name.trim()) return;
    try {
      await api.post('/admin/catalog/brands', { name: name.trim() });
      setName('');
      await load();
    } catch (error) {
      console.error('Failed to add brand:', error);
    }
  };

  const removeBrand = async (id) => {
    if (!confirm('Xóa hãng này? Các sản phẩm liên quan sẽ không có hãng.')) return;
    try {
      await api.delete(`/admin/catalog/brands/${id}`);
      await load();
    } catch (error) {
      console.error('Failed to delete brand:', error);
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Hãng sản xuất
        </Typography>
      </Stack>

      <Paper sx={{ p: 3, mb: 3, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
          Thêm hãng mới
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            size="small"
            label="Tên hãng"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addBrand();
            }}
            sx={{ flexGrow: 1 }}
            placeholder="VD: Asus, Dell, HP..."
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Label />
                </InputAdornment>
              ),
            }}
          />
          <Button variant="contained" onClick={addBrand} startIcon={<Add />} disabled={!name.trim()}>
            Thêm hãng
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Tên hãng</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">
                Thao tác
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  <Typography color="text.secondary" variant="body2" sx={{ py: 4 }}>
                    Chưa có hãng nào. Hãy thêm hãng mới!
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>#{r.id}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {r.name}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => removeBrand(r.id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
