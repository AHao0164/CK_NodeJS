export const SHIPPING_CONFIG = {
  // Free shipping threshold
  FREE_SHIPPING_THRESHOLD: 2000000, 
  
  // City-specific thresholds
  INNER_CITY_FREE_THRESHOLD: 500000,
  
  // Base shipping fees
  INNER_CITY_FEE: 20000,    
  OTHER_CITY_FEE: 35000,   
  REMOTE_AREA_FEE: 50000,  
  
  // Reduced fee for mid-range orders
  INNER_CITY_REDUCED_FEE: 0,      
  OTHER_CITY_REDUCED_FEE: 20000,  
}

export const INNER_CITIES = ['Hà Nội', 'Hồ Chí Minh']

export const REMOTE_AREAS = [
  'Lai Châu', 'Điện Biên', 'Sơn La', 'Cao Bằng', 
  'Hà Giang', 'Bắc Kạn', 'Phú Yên', 'Kon Tum',
  'Cà Mau', 'Bạc Liêu', 'Kiên Giang'
]

export function calculateShippingFee(subtotal, city = '') {
  const {
    FREE_SHIPPING_THRESHOLD,
    INNER_CITY_FREE_THRESHOLD,
    INNER_CITY_FEE,
    OTHER_CITY_FEE,
    REMOTE_AREA_FEE,
    INNER_CITY_REDUCED_FEE,
    OTHER_CITY_REDUCED_FEE,
  } = SHIPPING_CONFIG

  // Ưu tiên 1: Đơn hàng >= 2 triệu - Miễn phí toàn quốc
  if (subtotal >= FREE_SHIPPING_THRESHOLD) {
    return 0
  }

  // Ưu tiên 2: Vùng xa/hải đảo
  if (REMOTE_AREAS.some(area => city.includes(area))) {
    return REMOTE_AREA_FEE
  }

  // Ưu tiên 3: Nội thành HN/HCM
  if (INNER_CITIES.some(innerCity => city.includes(innerCity))) {
    return subtotal >= INNER_CITY_FREE_THRESHOLD ? INNER_CITY_REDUCED_FEE : INNER_CITY_FEE
  }

  // Mặc định: Tỉnh thành khác
  return subtotal >= INNER_CITY_FREE_THRESHOLD ? OTHER_CITY_REDUCED_FEE : OTHER_CITY_FEE
}

/**
 * Lấy thông tin chi tiết về phí vận chuyển
 * @param {number} subtotal - Tổng tiền hàng
 * @param {string} city - Tỉnh/Thành phố
 * @returns {object} - { fee, message, canGetFreeShip, remainingForFreeShip }
 */
export function getShippingInfo(subtotal, city = '') {
  const fee = calculateShippingFee(subtotal, city)
  const { FREE_SHIPPING_THRESHOLD, INNER_CITY_FREE_THRESHOLD } = SHIPPING_CONFIG
  
  let message = ''
  let canGetFreeShip = false
  let remainingForFreeShip = 0

  if (fee === 0) {
    message = '🎉 Miễn phí vận chuyển'
  } else {
    // Check if can get free shipping
    const isInnerCity = INNER_CITIES.some(innerCity => city.includes(innerCity))
    
    if (subtotal < FREE_SHIPPING_THRESHOLD) {
      canGetFreeShip = true
      remainingForFreeShip = FREE_SHIPPING_THRESHOLD - subtotal
      message = `Mua thêm ${remainingForFreeShip.toLocaleString()}₫ để được freeship toàn quốc`
    } else if (isInnerCity && subtotal < INNER_CITY_FREE_THRESHOLD) {
      canGetFreeShip = true
      remainingForFreeShip = INNER_CITY_FREE_THRESHOLD - subtotal
      message = `Mua thêm ${remainingForFreeShip.toLocaleString()}₫ để được freeship nội thành`
    }
  }

  return {
    fee,
    message,
    canGetFreeShip,
    remainingForFreeShip,
  }
}

export const DISCOUNT_TYPES = {
  PERCENTAGE: 'percentage', 
  FIXED: 'fixed',           
  FREE_SHIP: 'free_ship',   
}

export function applyDiscountCode(subtotal, shippingFee, discountCode) {
  return {
    subtotalDiscount: 0,
    shippingDiscount: 0,
    finalTotal: subtotal + shippingFee,
    message: '',
  }
}
