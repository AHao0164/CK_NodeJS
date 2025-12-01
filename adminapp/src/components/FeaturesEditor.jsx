import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  IconButton,
  TextField,
  Typography,
  Stack,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
} from '@mui/material';
import {
  Add,
  Delete,
  Star,
  DragIndicator,
} from '@mui/icons-material';

/**
 * FeaturesEditor - Component để quản lý danh sách tính năng nổi bật
 * 
 * features là mảng string:
 * [
 *   "Intel® Core™ Ultra processors for handling complex tasks",
 *   "Exceptional realism & vibrant visuals on OLED display",
 *   ...
 * ]
 */
export default function FeaturesEditor({ features, onChange }) {
  const [items, setItems] = useState(() => {
    return Array.isArray(features) ? features : [];
  });
  const [newFeature, setNewFeature] = useState('');

  const handleAdd = () => {
    if (!newFeature.trim()) return;
    const updated = [...items, newFeature.trim()];
    setItems(updated);
    onChange(updated);
    setNewFeature('');
  };

  const handleDelete = (index) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
    onChange(updated);
  };

  const handleEdit = (index, value) => {
    const updated = [...items];
    updated[index] = value;
    setItems(updated);
    onChange(updated);
  };

  const moveUp = (index) => {
    if (index === 0) return;
    const updated = [...items];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setItems(updated);
    onChange(updated);
  };

  const moveDown = (index) => {
    if (index === items.length - 1) return;
    const updated = [...items];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setItems(updated);
    onChange(updated);
  };

  // Template suggestions
  const templates = [
    'Bộ xử lý Intel® Core™ thế hệ mới nhất cho hiệu năng vượt trội',
    'Màn hình OLED sắc nét với độ phân giải cao',
    'Pin dung lượng lớn, sạc nhanh tiết kiệm thời gian',
    'Thiết kế mỏng nhẹ, dễ dàng mang theo',
    'Bàn phím có đèn nền, gõ êm ái',
    'Hệ thống tản nhiệt hiệu quả, chạy mát mẻ',
    'Kết nối đa dạng: USB-C, HDMI, Thunderbolt',
    'Âm thanh Dolby Atmos® sống động',
  ];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Star sx={{ color: '#f59e0b' }} /> Tính năng nổi bật
        </Typography>
        <Chip 
          label={`${items.length} tính năng`} 
          size="small" 
          color="warning" 
          variant="outlined"
        />
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Danh sách những điểm nổi bật của sản phẩm sẽ hiển thị trên trang chi tiết
      </Typography>

      {/* Current Features */}
      {items.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center', bgcolor: '#fff7ed', border: '1px dashed #fb923c', mb: 2 }}>
          <Star sx={{ fontSize: 48, color: '#fb923c', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            Chưa có tính năng nào. Thêm tính năng đầu tiên bên dưới.
          </Typography>
        </Paper>
      ) : (
        <Paper sx={{ mb: 2, maxHeight: 400, overflow: 'auto' }}>
          <List>
            {items.map((feature, index) => (
              <ListItem
                key={index}
                sx={{
                  bgcolor: index % 2 === 0 ? '#fff' : '#fafafa',
                  borderBottom: '1px solid #e0e0e0',
                  '&:hover': { bgcolor: '#fff7ed' },
                }}
                secondaryAction={
                  <Stack direction="row" spacing={0.5}>
                    <IconButton
                      size="small"
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                    >
                      <DragIndicator fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => moveDown(index)}
                      disabled={index === items.length - 1}
                    >
                      <DragIndicator fontSize="small" sx={{ transform: 'rotate(180deg)' }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(index)}
                      sx={{ color: 'error.main' }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Stack>
                }
              >
                <ListItemText
                  primary={
                    <TextField
                      value={feature}
                      onChange={(e) => handleEdit(index, e.target.value)}
                      fullWidth
                      size="small"
                      multiline
                      variant="standard"
                      InputProps={{ disableUnderline: true }}
                    />
                  }
                  secondary={`#${index + 1}`}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* Add New Feature */}
      <Paper sx={{ p: 2, bgcolor: '#fff7ed', border: '1px dashed #fb923c', mb: 2 }}>
        <Stack spacing={2}>
          <TextField
            size="small"
            placeholder="Nhập tính năng nổi bật..."
            value={newFeature}
            onChange={(e) => setNewFeature(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleAdd();
              }
            }}
            fullWidth
            multiline
            maxRows={3}
          />
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleAdd}
            disabled={!newFeature.trim()}
            color="warning"
          >
            Thêm tính năng
          </Button>
        </Stack>
      </Paper>

      {/* Quick Templates */}
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          💡 Gợi ý nhanh (click để thêm):
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {templates.map((template, idx) => (
            <Chip
              key={idx}
              label={template}
              size="small"
              onClick={() => {
                const updated = [...items, template];
                setItems(updated);
                onChange(updated);
              }}
              sx={{ mb: 1 }}
            />
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
