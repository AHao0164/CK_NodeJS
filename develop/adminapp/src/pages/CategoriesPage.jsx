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
import { Delete, Add, Category, Edit, Search, DeleteSweep, ArrowUpward, ArrowDownward, FileDownload } from '@mui/icons-material';
import { toast } from 'react-toastify';
import { useAuth } from '../state/AuthContext.jsx';
import { exportToExcel, formatCategoriesForExport } from '../utils/exportExcel';

export default function CategoriesPage() {
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
      const { data } = await api.get('/admin/catalog/categories', { params: { search: searchQuery } });
      setRows(data || []);
      setFilteredRows(data || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
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

  const addCategory = async () => {
    if (!name.trim()) return;
    try {
      const order = displayOrder !== '' ? parseInt(displayOrder, 10) : getNextDisplayOrder();
      await api.post('/admin/catalog/categories', { 
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
      toast.success('✅ Thêm danh mục thành công!');
    } catch (error) {
      console.error('Failed to add category:', error);
      toast.error('❌ Thêm danh mục thất bại: ' + (error.response?.data?.error || error.message));
    }
  };

  const updateCategory = async () => {
    if (!editForm.name.trim()) return;
    try {
      await api.put(`/admin/catalog/categories/${editForm.id}`, { 
        name: editForm.name.trim(),
        icon: editForm.icon?.trim() || null,
        description: editForm.description?.trim() || null,
        displayOrder: editForm.displayOrder
      });
      setEditDialog(false);
      setEditForm({ id: null, name: '', icon: '', description: '', displayOrder: 0 });
      await load();
      toast.success('✅ Cập nhật danh mục thành công!');
    } catch (error) {
      console.error('Failed to update category:', error);
      toast.error('❌ Cập nhật danh mục thất bại: ' + (error.response?.data?.error || error.message));
    }
  };

  const removeCategory = async (id) => {
    if (!confirm('Xóa danh mục này? Các sản phẩm liên quan sẽ không có danh mục.')) return;
    try {
      await api.delete(`/admin/catalog/categories/${id}`);
      await load();
      toast.success('✅ Xóa danh mục thành công!');
    } catch (error) {
      console.error('Failed to delete category:', error);
      toast.error('❌ Xóa danh mục thất bại: ' + (error.response?.data?.error || error.message));
    }
  };

  const bulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Xóa ${selectedIds.length} danh mục đã chọn? Các sản phẩm liên quan sẽ không có danh mục.`)) return;
    try {
      await api.post('/admin/catalog/categories/bulk-delete', { ids: selectedIds });
      setSelectedIds([]);
      await load();
      toast.success(`✅ Đã xóa ${selectedIds.length} danh mục!`);
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
          Quản lý Danh mục
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
            onClick={() => exportToExcel(formatCategoriesForExport(filteredRows), 'DanhMuc', 'Danh mục')}
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
          placeholder="Tìm kiếm danh mục..."
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
          Thêm danh mục mới
        </Typography>
        <Stack spacing={2}>
          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            spacing={2} 
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
            <TextField
              size="small"
              label="Tên danh mục *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addCategory();
              }}
              sx={{ flexGrow: 2 }}
              placeholder="VD: Gaming, Văn phòng, Ultrabook..."
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Category />
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
              placeholder="/images/icons/gaming.svg"
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
              placeholder="Mô tả ngắn về danh mục..."
              multiline
              rows={2}
            />
            <Button 
              variant="contained" 
              onClick={addCategory} 
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
              <TableCell sx={{ fontWeight: 600 }}>Tên danh mục</TableCell>
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
                    {searchQuery ? 'Không tìm thấy kết quả' : 'Chưa có danh mục nào. Hãy thêm danh mục mới!'}
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
                    <IconButton size="small" color="error" onClick={() => removeCategory(r.id)}>
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
        <DialogTitle sx={{ fontWeight: 600 }}>Sửa danh mục</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              autoFocus
              label="Tên danh mục *"
              fullWidth
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') updateCategory();
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Category />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Icon URL"
              fullWidth
              value={editForm.icon}
              onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })}
              placeholder="/images/icons/gaming.svg"
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
              placeholder="Mô tả ngắn về danh mục..."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditDialog(false)}>Hủy</Button>
          <Button variant="contained" onClick={updateCategory} disabled={!editForm.name.trim()}>
            Cập nhật
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
