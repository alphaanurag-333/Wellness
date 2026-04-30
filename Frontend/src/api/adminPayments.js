import api, { authHeader, normalizeApiError } from "../api.js";

function asPagination(data, page, limit) {
  return data?.pagination ?? { page, limit, total: 0, pages: 1 };
}

function buildQuery(params) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const str = String(value).trim();
    if (!str) return;
    q.set(key, str);
  });
  return q.toString();
}

export async function adminListEcomTransactions(token, { page = 1, limit = 10, search } = {}) {
  const query = buildQuery({ page, limit, search });
  try {
    const { data } = await api.get(`/admin/ecom/transactions?${query}`, { headers: authHeader(token) });
    return {
      rows: Array.isArray(data.transactions) ? data.transactions : [],
      pagination: asPagination(data, page, limit),
    };
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function adminListVenueTransactions(token, { page = 1, limit = 10, search } = {}) {
  const query = buildQuery({ page, limit, search });
  try {
    const { data } = await api.get(`/admin/venue/transactions?${query}`, { headers: authHeader(token) });
    return {
      rows: Array.isArray(data.transactions) ? data.transactions : [],
      pagination: asPagination(data, page, limit),
    };
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function adminListRechargeTransactions(token, { page = 1, limit = 10, search } = {}) {
  const query = buildQuery({ page, limit, search });
  try {
    const { data } = await api.get(`/admin/recharges/transactions?${query}`, { headers: authHeader(token) });
    return {
      rows: Array.isArray(data.transactions) ? data.transactions : [],
      pagination: asPagination(data, page, limit),
    };
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function adminListEcomOrders(token, { page = 1, limit = 10, search } = {}) {
  const query = buildQuery({ page, limit, search });
  try {
    const { data } = await api.get(`/admin/ecom/orders?${query}`, { headers: authHeader(token) });
    return {
      rows: Array.isArray(data.orders) ? data.orders : [],
      pagination: asPagination(data, page, limit),
    };
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function adminListVenueOrders(token, { page = 1, limit = 10, search } = {}) {
  const query = buildQuery({ page, limit, search });
  try {
    const { data } = await api.get(`/admin/venue/orders?${query}`, { headers: authHeader(token) });
    return {
      rows: Array.isArray(data.orders) ? data.orders : [],
      pagination: asPagination(data, page, limit),
    };
  } catch (error) {
    normalizeApiError(error);
  }
}
