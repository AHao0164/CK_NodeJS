import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  Chip,
  Tooltip,
} from '@mui/material';
import { Delete, Add, Label, Edit, Search, DeleteSweep, FileDownload } from '@mui/icons-material';
import { toast } from 'react-toastify';
import { useAuth } from '../state/AuthContext.jsx';
import { exportToExcel, formatBrandsForExport } from '../utils/exportExcel';

export default function BrandsPage() {
  const { api } = useAuth();
  const [rows, setRows] = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [description, setDescription] = useState('');
  const [displayOrder, setDisplayOrder] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editDialog, setEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({ id: null, name: '', icon: '', description: '', displayOrder: 0 });
  const [selectedIds, setSelectedIds] = useState([]);

  const load = async () => {
    try {
      const { data } = await api.get('/admin/catalog/brands', { params: { search: searchQuery } });
      setRows(data || []);
      setFilteredRows(data || []);
    } catch (error) {
      console.error('Failed to load brands:', error);
      setRows([]);
      setFilteredRows([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const filtered = rows.filter(r => 
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    setFilteredRows(filtered);
  }, [searchQuery, rows]);

  // Calculate next display_order
  const getNextDisplayOrder = () => {
    if (rows.length === 0) return 0;
    const maxOrder = Math.max(...rows.map(r => r.display_order || 0));
    return maxOrder + 1;
  };

  const addBrand = async () => {
    if (!name.trim()) return;
    try {
      const order = displayOrder !== '' ? parseInt(displayOrder, 10) : getNextDisplayOrder();
      await api.post('/admin/catalog/brands', { 
        name: name.trim(),
        icon: icon.trim() || null,
        description: description.trim() || null,
        displayOrder: order
      });
      setName('');
      setIcon('');
      setDescription('');
      setDisplayOrder('');
      await load();
      toast.success('✅ Thêm hãng thành công!');
    } catch (error) {
      console.error('Failed to add brand:', error);
      toast.error('❌ Thêm hãng thất bại: ' + (error.response?.data?.error || error.message));
    }
  };

  const updateBrand = async () => {
    if (!editForm.name.trim()) return;
    try {
      await api.put(`/admin/catalog/brands/${editForm.id}`, { 
        name: editForm.name.trim(),
        icon: editForm.icon?.trim() || null,
        description: editForm.description?.trim() || null,
        displayOrder: editForm.displayOrder
      });
      setEditDialog(false);
      setEditForm({ id: null, name: '', icon: '', description: '', displayOrder: 0 });
      await load();
      toast.success('✅ Cập nhật hãng thành công!');
    } catch (error) {
      console.error('Failed to update brand:', error);
      toast.error('❌ Cập nhật hãng thất bại: ' + (error.response?.data?.error || error.message));
    }
  };

  const removeBrand = async (id) => {
    if (!confirm('Xóa hãng này? Các sản phẩm liên quan sẽ không có hãng.')) return;
    try {
      await api.delete(`/admin/catalog/brands/${id}`);
      await load();
      toast.success('✅ Xóa hãng thành công!');
    } catch (error) {
      console.error('Failed to delete brand:', error);
      toast.error('❌ Xóa hãng thất bại: ' + (error.response?.data?.error || error.message));
    }
  };

  const bulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Xóa ${selectedIds.length} hãng đã chọn? Các sản phẩm liên quan sẽ không có hãng.`)) return;
    try {
      await api.post('/admin/catalog/brands/bulk-delete', { ids: selectedIds });
      setSelectedIds([]);
      await load();
      toast.success(`✅ Đã xóa ${selectedIds.length} hãng!`);
    } catch (error) {
      console.error('Failed to bulk delete:', error);
      toast.error('❌ Xóa hàng loạt thất bại: ' + (error.response?.data?.error || error.message));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredRows.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRows.map(r => r.id));
    }
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
          Quản lý Thương hiệu
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
            onClick={() => exportToExcel(formatBrandsForExport(filteredRows), 'ThuongHieu', 'Thương hiệu')}
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
              onClick={bulkDelete}
              sx={{ 
                fontSize: { xs: '0.875rem', sm: '1rem' },
                py: { xs: 1, sm: 1.5 }
              }}
            >
              Xóa {selectedIds.length} mục
            </Button>
          )}
        </Stack>
      </Stack>

      {/* Search */}
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
          placeholder="Tìm kiếm hãng..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      {/* Add Form */}
      <Paper sx={{ 
        p: { xs: 2, sm: 2.5, lg: 3 }, 
        mb: { xs: 2, sm: 3 }, 
        borderRadius: { xs: 2, lg: 3 }, 
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        overflow: 'hidden'
      }}>
        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
          Thêm hãng mới
        </Typography>
        <Stack spacing={2}>
          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            spacing={2} 
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
            <TextField
              size="small"
              label="Tên hãng *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addBrand();
              }}
              sx={{ flexGrow: 2 }}
              placeholder="VD: Asus, Dell, HP..."
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Label />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              size="small"
              label="Icon URL"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              sx={{ flexGrow: 1 }}
              placeholder="/images/brands/asus.svg"
            />
            <TextField
              size="small"
              label="Thứ tự"
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              placeholder={`Tiếp theo: ${getNextDisplayOrder()}`}
              sx={{ width: { xs: '100%', sm: 120 } }}
            />
          </Stack>
          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            spacing={2} 
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
            <TextField
              size="small"
              label="Mô tả"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              sx={{ flexGrow: 1 }}
              placeholder="Mô tả ngắn về hãng..."
              multiline
              rows={2}
            />
            <Button 
              variant="contained" 
              onClick={addBrand} 
              startIcon={<Add />} 
              disabled={!name.trim()}
              sx={{ 
                height: 'fit-content',
                fontSize: { xs: '0.875rem', sm: '1rem' },
                py: { xs: 1, sm: 1.5 },
                width: { xs: '100%', sm: 'auto' }
              }}
            >
              Thêm
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Table */}
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
                  checked={filteredRows.length > 0 && selectedIds.length === filteredRows.length}
                  indeterminate={selectedIds.length > 0 && selectedIds.length < filteredRows.length}
                  onChange={toggleSelectAll}
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Thứ tự</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Tên hãng</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Icon</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Mô tả</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">
                Thao tác
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="text.secondary" variant="body2" sx={{ py: 4 }}>
                    {searchQuery ? 'Không tìm thấy kết quả' : 'Chưa có hãng nào. Hãy thêm hãng mới!'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((r) => (
                <TableRow key={r.id} hover selected={selectedIds.includes(r.id)}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedIds.includes(r.id)}
                      onChange={() => toggleSelect(r.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip label={r.display_order || 0} size="small" color="primary" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {r.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {r.icon ? (
                      <Tooltip title={r.icon}>
                        <img src={r.icon} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} 
                          onError={(e) => { e.target.style.display = 'none'; }} />
                      </Tooltip>
                    ) : (
                      <Typography variant="caption" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
                      {r.description || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEditForm({ 
                          id: r.id, 
                          name: r.name, 
                          icon: r.icon || '', 
                          description: r.description || '',
                          displayOrder: r.display_order || 0
                        });
                        setEditDialog(true);
                      }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
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

      {/* Edit Dialog */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Sửa hãng</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              autoFocus
              label="Tên hãng *"
              fullWidth
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') updateBrand();
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Label />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Icon URL"
              fullWidth
              value={editForm.icon}
              onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })}
              placeholder="/images/brands/asus.svg"
            />
            <TextField
              label="Thứ tự hiển thị"
              type="number"
              fullWidth
              value={editForm.displayOrder}
              onChange={(e) => setEditForm({ ...editForm, displayOrder: parseInt(e.target.value, 10) || 0 })}
            />
            <TextField
              label="Mô tả"
              fullWidth
              multiline
              rows={3}
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              placeholder="Mô tả ngắn về hãng..."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditDialog(false)}>Hủy</Button>
          <Button variant="contained" onClick={updateBrand} disabled={!editForm.name.trim()}>
            Cập nhật
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
