import { useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  TextField,
  Typography,
  Stack,
  Paper,
  Chip,
  Grid,
  Divider,
} from '@mui/material';
import {
  Add,
  Delete,
  Settings,
} from '@mui/icons-material';


export default function SpecsEditor({ specs, onChange }) {
  const [sections, setSections] = useState(() => {
    if (specs && typeof specs === 'object') {
      return Object.entries(specs).map(([sectionKey, sectionValue]) => {
        // Check if nested or flat
        if (typeof sectionValue === 'object' && sectionValue !== null) {
          // Nested structure
          return {
            key: sectionKey,
            fields: Object.entries(sectionValue).map(([fieldKey, fieldValue]) => ({
              key: fieldKey,
              value: String(fieldValue || '')
            }))
          };
        } else {
          // Flat fallback - convert to nested with single field
          return {
            key: sectionKey,
            fields: [{ key: 'value', value: String(sectionValue || '') }]
          };
        }
      });
    }
    return [];
  });

  const sectionTranslations = {
    'performance': 'Hiệu năng',
    'display': 'Màn hình',
    'battery': 'Pin',
    'connectivity': 'Kết nối',
    'design': 'Thiết kế',
    'audio': 'Âm thanh',
    'camera': 'Camera',
    'keyboard': 'Bàn phím'
  };

  const updateParentSpecs = (newSections) => {
    const specsObject = {};
    newSections.forEach(section => {
      if (section.key.trim() && section.fields.length > 0) {
        const sectionObj = {};
        section.fields.forEach(field => {
          if (field.key.trim()) {
            sectionObj[field.key.trim()] = field.value;
          }
        });
        if (Object.keys(sectionObj).length > 0) {
          specsObject[section.key.trim()] = sectionObj;
        }
      }
    });
    onChange(specsObject);
  };

  // Add new empty section
  const addSection = () => {
    const newSections = [...sections, { key: '', fields: [{ key: '', value: '' }] }];
    setSections(newSections);
    updateParentSpecs(newSections);
  };

  // Delete section by index
  const deleteSection = (sectionIndex) => {
    const newSections = sections.filter((_, idx) => idx !== sectionIndex);
    setSections(newSections);
    updateParentSpecs(newSections);
  };

  // Update section key
  const updateSectionKey = (sectionIndex, newKey) => {
    const newSections = [...sections];
    newSections[sectionIndex].key = newKey;
    setSections(newSections);
    updateParentSpecs(newSections);
  };

  // Add field to section
  const addFieldToSection = (sectionIndex) => {
    const newSections = [...sections];
    newSections[sectionIndex].fields.push({ key: '', value: '' });
    setSections(newSections);
    updateParentSpecs(newSections);
  };

  // Delete field from section
  const deleteFieldFromSection = (sectionIndex, fieldIndex) => {
    const newSections = [...sections];
    newSections[sectionIndex].fields = newSections[sectionIndex].fields.filter((_, idx) => idx !== fieldIndex);
    setSections(newSections);
    updateParentSpecs(newSections);
  };

  // Update field key/value
  const updateField = (sectionIndex, fieldIndex, field, value) => {
    const newSections = [...sections];
    newSections[sectionIndex].fields[fieldIndex][field] = value;
    setSections(newSections);
    updateParentSpecs(newSections);
  };

  // Template buttons for common laptop specs
  const addTemplateSection = (templateName) => {
    const templates = {
      performance: {
        key: 'performance',
        fields: [
          { key: 'cpu', value: '' },
          { key: 'gpu', value: '' },
          { key: 'ram', value: '' },
          { key: 'storage', value: '' }
        ]
      },
      display: {
        key: 'display',
        fields: [
          { key: 'size', value: '' },
          { key: 'resolution', value: '' },
          { key: 'refresh_rate', value: '' },
          { key: 'panel_type', value: '' }
        ]
      },
      battery: {
        key: 'battery',
        fields: [
          { key: 'capacity', value: '' },
          { key: 'life', value: '' }
        ]
      },
      audio: {
        key: 'audio',
        fields: [
          { key: 'speakers', value: '' },
          { key: 'technology', value: '' }
        ]
      },
      camera: {
        key: 'camera',
        fields: [
          { key: 'resolution', value: '' },
          { key: 'features', value: '' }
        ]
      },
      connectivity: {
        key: 'connectivity',
        fields: [
          { key: 'wifi', value: '' },
          { key: 'bluetooth', value: '' },
          { key: 'ports', value: '' }
        ]
      },
      design: {
        key: 'design',
        fields: [
          { key: 'weight', value: '' },
          { key: 'thickness', value: '' },
          { key: 'os', value: '' }
        ]
      },
      keyboard: {
        key: 'keyboard',
        fields: [
          { key: 'type', value: '' },
          { key: 'backlight', value: '' }
        ]
      }
    };

    if (templates[templateName]) {
      const newSections = [...sections, templates[templateName]];
      setSections(newSections);
      updateParentSpecs(newSections);
    }
  };

  return (
    <Box>
      <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
        <Typography variant="subtitle2" sx={{ width: '100%', mb: 1 }}>
          Templates nhanh (Laptop):
        </Typography>
        {['performance', 'display', 'battery', 'audio', 'camera', 'connectivity', 'design', 'keyboard'].map(template => (
          <Chip
            key={template}
            label={sectionTranslations[template] || template}
            onClick={() => addTemplateSection(template)}
            color="primary"
            size="small"
          />
        ))}
      </Stack>

      <Divider sx={{ my: 2 }} />

      {sections.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
          <Typography variant="body2" color="text.secondary">
            Chưa có section nào. Click template hoặc nút bên dưới để thêm.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={3}>
          {sections.map((section, sectionIndex) => (
            <Paper key={sectionIndex} variant="outlined" sx={{ p: 2 }}>
              {/* Section Header */}
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Settings fontSize="small" color="primary" />
                <TextField
                  label="Section Name (e.g., performance, display)"
                  value={section.key}
                  onChange={(e) => updateSectionKey(sectionIndex, e.target.value)}
                  size="small"
                  fullWidth
                  placeholder="performance"
                />
                <IconButton
                  onClick={() => deleteSection(sectionIndex)}
                  size="small"
                  color="error"
                >
                  <Delete />
                </IconButton>
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Fields within section */}
              <Stack spacing={2}>
                {section.fields.map((field, fieldIndex) => (
                  <Grid container spacing={1} key={fieldIndex} alignItems="center">
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Field Key"
                        value={field.key}
                        onChange={(e) => updateField(sectionIndex, fieldIndex, 'key', e.target.value)}
                        size="small"
                        fullWidth
                        placeholder="cpu, gpu, size, resolution..."
                      />
                    </Grid>
                    <Grid item xs={12} sm={7}>
                      <TextField
                        label="Field Value"
                        value={field.value}
                        onChange={(e) => updateField(sectionIndex, fieldIndex, 'value', e.target.value)}
                        size="small"
                        fullWidth
                        placeholder="Intel Core i7-13620H..."
                      />
                    </Grid>
                    <Grid item xs={12} sm={1}>
                      <IconButton
                        onClick={() => deleteFieldFromSection(sectionIndex, fieldIndex)}
                        size="small"
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </Grid>
                  </Grid>
                ))}
              </Stack>

              <Button
                startIcon={<Add />}
                onClick={() => addFieldToSection(sectionIndex)}
                size="small"
                sx={{ mt: 2 }}
              >
                Thêm field trong section này
              </Button>
            </Paper>
          ))}
        </Stack>
      )}

      <Button
        startIcon={<Add />}
        onClick={addSection}
        variant="outlined"
        fullWidth
        sx={{ mt: 2 }}
      >
        Thêm Section mới
      </Button>
    </Box>
  );
}
