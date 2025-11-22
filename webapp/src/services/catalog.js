import { publicApi } from '../api/client'

export async function listProducts({ q = '', page = 1, sort = 'id_desc', brand = '', category = '', minPrice, maxPrice, minRating, pageSize = 20 } = {}) {
  const params = { q, page, sort }
  if (brand) params.brand = brand
  if (category) params.category = category
  if (minPrice !== undefined && minPrice !== null) params.minPrice = minPrice
  if (maxPrice !== undefined && maxPrice !== null) params.maxPrice = maxPrice
  if (minRating !== undefined && minRating !== null) params.minRating = minRating
  if (pageSize) params.pageSize = pageSize
  const response = await publicApi.get('/catalog/products', { params })
  return response.data
}

export async function getProductById(id) {
  const { data } = await publicApi.get(`/catalog/products/${id}`)
  return data
}

export async function listCategories({ limit = 8 } = {}) {
  const { data } = await publicApi.get('/catalog/categories', { params: { limit } })
  return Array.isArray(data?.items) ? data.items : []
}

export async function listProductsByCategory(categoryId, { limit = 8 } = {}) {
  const { data } = await publicApi.get(`/catalog/categories/${categoryId}/products`, { params: { limit } })
  return Array.isArray(data?.items) ? data.items : []
}









