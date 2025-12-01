import { publicApi } from '../api/client'

export async function listProducts({ q = '', page = 1, sort = 'id_desc', categoryId = '', brandId = '', minPrice = '', maxPrice = '', minRating = '' } = {}) {
  const params = { q, page, sort }
  if (categoryId) params.categoryId = categoryId
  if (brandId) params.brandId = brandId
  if (minPrice) params.minPrice = minPrice
  if (maxPrice) params.maxPrice = maxPrice
  if (minRating) params.minRating = minRating
  const response = await publicApi.get('/catalog/products', { params })
  return response.data
}

export async function getProductById(id) {
  const { data } = await publicApi.get(`/catalog/products/${id}`)
  return data
}

export async function listCategories({ limit = 8, includeProducts = false } = {}) {
  const params = { limit };
  if (includeProducts) params.includeProducts = 'true';
  const { data } = await publicApi.get('/catalog/categories', { params });
  return Array.isArray(data?.items) ? data.items : [];
}

export async function listBrands({ limit } = {}) {
  const params = {};
  if (limit) params.limit = limit;
  const { data } = await publicApi.get('/catalog/brands', { params });
  return Array.isArray(data?.items) ? data.items : [];
}

export async function listProductsByCategory(categoryId, { limit = 8 } = {}) {
  const { data } = await publicApi.get(`/catalog/categories/${categoryId}/products`, { params: { limit } })
  return Array.isArray(data?.items) ? data.items : []
}

export async function listBanners() {
  try {
    const { data } = await publicApi.get('/catalog/banners')
    return Array.isArray(data) ? data : []
  } catch (error) {
    console.error('Failed to load banners:', error)
    // Return empty array if service fails - không ảnh hưởng các services khác
    return []
  }
}
