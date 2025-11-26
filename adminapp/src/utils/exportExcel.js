import * as XLSX from 'xlsx';

/**
 * Xuất dữ liệu ra file Excel
 * @param {Array} data - Dữ liệu cần xuất
 * @param {String} filename - Tên file (không cần đuôi .xlsx)
 * @param {String} sheetName - Tên sheet
 */
export function exportToExcel(data, filename, sheetName = 'Sheet1') {
  // Tạo workbook và worksheet
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Xuất file
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/**
 * Format dữ liệu sản phẩm để xuất Excel
 */
export function formatProductsForExport(products) {
  return products.map((p, index) => ({
    'STT': index + 1,
    'Mã SKU': p.sku || '',
    'Tên sản phẩm': p.name || '',
    'Thương hiệu': p.brand_name || '',
    'Danh mục': p.category_name || '',
    'Giá (VNĐ)': (p.price_cents / 100).toLocaleString('vi-VN'),
    'Giảm giá (%)': p.discount_percent || 0,
    'Giá sau giảm (VNĐ)': (p.final_price_cents / 100).toLocaleString('vi-VN'),
    'Tồn kho': p.stock || 0,
    'Mô tả': p.description || '',
  }));
}

/**
 * Format dữ liệu đơn hàng để xuất Excel
 */
export function formatOrdersForExport(orders) {
  return orders.map((o, index) => ({
    'STT': index + 1,
    'Mã đơn': o.id,
    'Khách hàng': o.user_email || '',
    'Tổng tiền (VNĐ)': (o.total_cents / 100).toLocaleString('vi-VN'),
    'Trạng thái': getOrderStatusText(o.status),
    'Ngày tạo': new Date(o.created_at).toLocaleString('vi-VN'),
    'Địa chỉ': `${o.shipping_address || ''}, ${o.shipping_ward || ''}, ${o.shipping_province || ''}`,
    'Số điện thoại': o.shipping_phone || '',
  }));
}

/**
 * Format dữ liệu khách hàng để xuất Excel
 */
export function formatCustomersForExport(customers) {
  return customers.map((c, index) => ({
    'STT': index + 1,
    'Email': c.email || '',
    'Họ tên': c.full_name || '',
    'Số điện thoại': c.phone || '',
    'Tỉnh/TP': c.province || '',
    'Quận/Huyện': c.ward || '',
    'Địa chỉ': c.address_detail || '',
    'Vai trò': c.role === 'ADMIN' ? 'Quản trị viên' : 'Khách hàng',
  }));
}

/**
 * Format dữ liệu thương hiệu để xuất Excel
 */
export function formatBrandsForExport(brands) {
  return brands.map((b, index) => ({
    'STT': index + 1,
    'Mã': b.id,
    'Tên thương hiệu': b.name || '',
    'Số sản phẩm': b.product_count || 0,
  }));
}

/**
 * Format dữ liệu danh mục để xuất Excel
 */
export function formatCategoriesForExport(categories) {
  return categories.map((c, index) => ({
    'STT': index + 1,
    'Mã': c.id,
    'Tên danh mục': c.name || '',
    'Số sản phẩm': c.product_count || 0,
  }));
}

/**
 * Format dữ liệu doanh thu để xuất Excel
 */
export function formatRevenueForExport(orders) {
  const deliveredOrders = orders.filter(o => o.status === 'DELIVERED');
  
  return deliveredOrders.map((o, index) => ({
    'STT': index + 1,
    'Mã đơn': o.id,
    'Ngày giao': new Date(o.updated_at || o.created_at).toLocaleString('vi-VN'),
    'Khách hàng': o.user_email || '',
    'Doanh thu (VNĐ)': (o.total_cents / 100).toLocaleString('vi-VN'),
    'Phương thức': o.payment_method || 'COD',
  }));
}

/**
 * Helper: Chuyển status code thành text tiếng Việt
 */
function getOrderStatusText(status) {
  const statusMap = {
    'PENDING': 'Chờ xác nhận',
    'CONFIRMED': 'Đã xác nhận',
    'SHIPPING': 'Đang giao',
    'DELIVERED': 'Đã giao hàng',
    'CANCELLED': 'Đã hủy',
    'PAID': 'Đã thanh toán'
  };
  return statusMap[status] || status;
}
