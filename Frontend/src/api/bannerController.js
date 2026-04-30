import api, { authHeader, normalizeApiError } from "../api.js";

function bannersBase() {
  return "/admin/banners";
}

export async function adminListBanners(token, { page = 1, limit = 50, status, search, mode, city } = {}) {
  const q = new URLSearchParams();
  q.set("page", String(page));
  q.set("limit", String(limit));
  if (status) q.set("status", status);
  if (mode) q.set("mode", mode);
  if (city) q.set("city", city);
  if (search && String(search).trim()) q.set("search", String(search).trim());
  try {
    const { data } = await api.get(`${bannersBase()}?${q}`, { headers: authHeader(token) });
    return {
      banners: Array.isArray(data.banners) ? data.banners : [],
      pagination: data.pagination ?? { page, limit, total: 0, pages: 1 },
    };
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function adminGetBannerById(token, id) {
  try {
    const { data } = await api.get(`${bannersBase()}/${encodeURIComponent(id)}`, { headers: authHeader(token) });
    return data.banner;
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function adminCreateBanner(token, fields, file) {
  if (file instanceof File) {
    const fd = new FormData();
    fd.append("mode", String(fields.mode ?? "").trim());
    fd.append("title", String(fields.title ?? "").trim());
    fd.append("status", String(fields.status || "active"));
    fd.append("startDate", String(fields.startDate ?? ""));
    fd.append("endDate", String(fields.endDate ?? ""));
    fd.append("file", file);
    const cityList = Array.isArray(fields.cities) ? fields.cities : [];
    cityList.forEach((city) => fd.append("cities", String(city).trim()));
    try {
      const { data } = await api.post(bannersBase(), fd, { headers: authHeader(token) });
      return data.banner;
    } catch (error) {
      normalizeApiError(error);
    }
  }

  try {
    const { data } = await api.post(
      bannersBase(),
      {
        mode: String(fields.mode ?? "").trim(),
        title: String(fields.title ?? "").trim(),
        image: String(fields.image ?? "").trim(),
        status: String(fields.status || "active"),
        startDate: String(fields.startDate ?? ""),
        endDate: String(fields.endDate ?? ""),
        cities: Array.isArray(fields.cities) ? fields.cities.map((city) => String(city).trim()).filter(Boolean) : [],
      },
      { headers: authHeader(token) }
    );
    return data.banner;
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function adminUpdateBanner(token, id, fields, file) {
  if (file instanceof File) {
    const fd = new FormData();
    if (fields.mode !== undefined) fd.append("mode", String(fields.mode).trim());
    if (fields.title !== undefined) fd.append("title", String(fields.title).trim());
    if (fields.status !== undefined) fd.append("status", String(fields.status));
    if (fields.startDate !== undefined) fd.append("startDate", String(fields.startDate));
    if (fields.endDate !== undefined) fd.append("endDate", String(fields.endDate));
    if (Array.isArray(fields.cities)) {
      fields.cities.forEach((city) => fd.append("cities", String(city).trim()));
    }
    fd.append("file", file);
    try {
      const { data } = await api.patch(`${bannersBase()}/${encodeURIComponent(id)}`, fd, { headers: authHeader(token) });
      return data.banner;
    } catch (error) {
      normalizeApiError(error);
    }
  }

  const payload = {};
  if (fields.mode !== undefined) payload.mode = String(fields.mode).trim();
  if (fields.title !== undefined) payload.title = String(fields.title).trim();
  if (fields.status !== undefined) payload.status = String(fields.status);
  if (fields.image !== undefined) payload.image = String(fields.image).trim();
  if (fields.startDate !== undefined) payload.startDate = String(fields.startDate);
  if (fields.endDate !== undefined) payload.endDate = String(fields.endDate);
  if (fields.cities !== undefined) {
    payload.cities = Array.isArray(fields.cities) ? fields.cities.map((city) => String(city).trim()).filter(Boolean) : [];
  }

  try {
    const { data } = await api.patch(`${bannersBase()}/${encodeURIComponent(id)}`, payload, { headers: authHeader(token) });
    return data.banner;
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function adminDeleteBanner(token, id) {
  try {
    await api.delete(`${bannersBase()}/${encodeURIComponent(id)}`, { headers: authHeader(token) });
  } catch (error) {
    normalizeApiError(error);
  }
}
