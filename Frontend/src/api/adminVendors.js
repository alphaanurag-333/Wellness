import api, { authHeader, normalizeApiError } from "../api.js";

function vendorsBase() {
  return "/admin/vendors";
}

export async function adminListVendors(token, { page = 1, limit = 20, status, approvalStatus, search } = {}) {
  const q = new URLSearchParams();
  q.set("page", String(page));
  q.set("limit", String(limit));
  if (status) q.set("status", status);
  if (approvalStatus) q.set("approvalStatus", approvalStatus);
  if (search && String(search).trim()) q.set("search", String(search).trim());

  try {
    const { data: body } = await api.get(`${vendorsBase()}?${q}`, {
      headers: authHeader(token),
    });
    return {
      vendors: Array.isArray(body.vendors) ? body.vendors : [],
      pagination: body.pagination ?? { page, limit, total: 0, pages: 1 },
    };
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function adminGetVendor(token, id) {
  try {
    const { data: body } = await api.get(`${vendorsBase()}/${encodeURIComponent(id)}`, {
      headers: authHeader(token),
    });
    return body.vendor ?? null;
  } catch (error) {
    normalizeApiError(error);
  }
}

function appendVendorFields(fd, fields) {
  const keys = [
    "name",
    "email",
    "password",
    "phone",
    "businessName",
    "businessPhone",
    "gstin",
    "panCardNumber",
    "businessAddress",
    "aadhaarCardFront",
    "aadhaarCardBack",
    "panCard",
    "shopLogo",
    "shopImage",
    "shopBanner",
    "bankName",
    "branchName",
    "accountNo",
    "ifsc",
    "accountType",
    "dob",
    "gender",
    "fcm_id",
    "profileImage",
    "status",
    "approvalStatus",
  ];
  keys.forEach((k) => {
    if (fields[k] === undefined) return;
    fd.append(k, fields[k] == null ? "" : String(fields[k]));
  });
}

function appendVendorFiles(fd, files = {}) {
  const keys = ["file", "aadhaarCardFront", "aadhaarCardBack", "panCard", "shopLogo", "shopImage", "shopBanner"];
  keys.forEach((k) => {
    if (files[k] instanceof File) fd.append(k, files[k]);
  });
}

function hasAnyVendorFile(files = {}) {
  return Object.values(files).some((f) => f instanceof File);
}

export async function adminCreateVendor(token, fields, files = {}) {
  if (hasAnyVendorFile(files)) {
    const fd = new FormData();
    appendVendorFields(fd, fields);
    appendVendorFiles(fd, files);
    try {
      const { data: body } = await api.post(vendorsBase(), fd, {
        headers: authHeader(token),
      });
      return body.vendor;
    } catch (error) {
      normalizeApiError(error);
    }
  }

  try {
    const { data: body } = await api.post(vendorsBase(), fields, {
      headers: authHeader(token),
    });
    return body.vendor;
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function adminUpdateVendor(token, id, fields, files = {}) {
  if (hasAnyVendorFile(files)) {
    const fd = new FormData();
    appendVendorFields(fd, fields);
    appendVendorFiles(fd, files);
    try {
      const { data: body } = await api.patch(`${vendorsBase()}/${encodeURIComponent(id)}`, fd, {
        headers: authHeader(token),
      });
      return body.vendor;
    } catch (error) {
      normalizeApiError(error);
    }
  }

  try {
    const { data: body } = await api.patch(`${vendorsBase()}/${encodeURIComponent(id)}`, fields, {
      headers: authHeader(token),
    });
    return body.vendor;
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function adminDeleteVendor(token, id) {
  try {
    await api.delete(`${vendorsBase()}/${encodeURIComponent(id)}`, {
      headers: authHeader(token),
    });
  } catch (error) {
    normalizeApiError(error);
  }
}
