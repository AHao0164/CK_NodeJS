import { publicApi } from '../api/client'

export async function listProducts({ q = '', page = 1, sort = 'id_desc' } = {}) {
  const response = await publicApi.get('/catalog/products', { params: { q, page, sort } })
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









