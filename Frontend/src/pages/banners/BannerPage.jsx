import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Swal from "sweetalert2";
import { MdEditSquare } from "react-icons/md";
import { AiFillDelete, AiOutlineEye } from "react-icons/ai";
import {
  adminCreateBanner,
  adminDeleteBanner,
  adminListBanners,
  adminUpdateBanner,
} from "../../api/bannerController.js";
import { logout } from "../../store/authSlice.js";
import { mediaUrl } from "../../media.js";
import {City } from 'country-state-city'

function emptyForm() {
  return {
    mode: "global",
    title: "",
    startDate: "",
    endDate: "",
    cities: "",
    status: "active",
  };
}

const TITLE_MAX_LEN = 60;
const CITY_SEARCH_MAX_LEN = 40;
const IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const LIST_LIMIT = 10;

function sanitizeTitleInput(value) {
  return String(value ?? "")
    .replace(/[^A-Za-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .slice(0, TITLE_MAX_LEN);
}

function sanitizeCitySearchInput(value) {
  return String(value ?? "")
    .replace(/[^A-Za-z ]+/g, "")
    .replace(/\s+/g, " ")
    .slice(0, CITY_SEARCH_MAX_LEN);
}

function normalizeCitiesInput(value) {
  return String(value ?? "")
    .split(",")
    .map((city) => city.trim())
    .filter(Boolean);
}

function validateBannerForm(form) {
  const mode = form.mode.trim();
  const title = form.title.trim();
  const cities = normalizeCitiesInput(form.cities);

  if (!mode || !title) {
    return "Mode and title are required.";
  }
  if (!["global", "city"].includes(mode)) {
    return "Please select a valid mode.";
  }
  if (!/^[A-Za-z0-9 ]+$/.test(title)) {
    return "Title can contain only letters, numbers, and spaces.";
  }
  if (title.length > TITLE_MAX_LEN) {
    return `Title cannot exceed ${TITLE_MAX_LEN} characters.`;
  }
  if (form.startDate && Number.isNaN(new Date(form.startDate).getTime())) {
    return "Start date is invalid.";
  }
  if (form.endDate && Number.isNaN(new Date(form.endDate).getTime())) {
    return "End date is invalid.";
  }
  if (form.startDate && form.endDate && new Date(form.startDate) > new Date(form.endDate)) {
    return "Start date cannot be after end date.";
  }
  if (mode === "city" && cities.length === 0) {
    return "At least one city is required for city mode.";
  }
  return "";
}

export function BannerPage() {
  const dispatch = useDispatch();
  const adminToken = useSelector((s) => s.auth.adminToken);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [togglingId, setTogglingId] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [citySearch, setCitySearch] = useState("");
  const [viewRow, setViewRow] = useState(null);
  const fileInputRef = useRef(null);
  const indianCities = useMemo(() => {
    const seen = new Set();
    return City.getCitiesOfCountry("IN")
      .map((city) => city.name?.trim())
      .filter(Boolean)
      .filter((cityName) => {
        const key = cityName.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.localeCompare(b));
  }, []);

  const loadRows = useCallback(async () => {
    if (!adminToken) return;
    setLoading(true);
    try {
      const { banners, pagination } = await adminListBanners(adminToken, { page, limit: LIST_LIMIT });
      setRows(banners);
      setPages(pagination?.pages ?? 1);
      setTotal(pagination?.total ?? 0);
    } catch (e) {
      if (e?.status === 401) return dispatch(logout());
      await Swal.fire({ icon: "error", title: "Load failed", text: e.message || "Failed to load banners." });
    } finally {
      setLoading(false);
    }
  }, [adminToken, dispatch, page]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditId("");
    setImageFile(null);
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!adminToken) return;

    const validationError = validateBannerForm(form);
    if (validationError) {
      await Swal.fire({ icon: "error", title: "Validation error", text: validationError });
      return;
    }
    if (!editId && !(imageFile instanceof File)) {
      await Swal.fire({ icon: "error", title: "Validation error", text: "Banner image is required." });
      return;
    }

    const payload = {
      mode: form.mode.trim(),
      title: form.title.trim(),
      ...(form.startDate ? { startDate: form.startDate } : {}),
      ...(form.endDate ? { endDate: form.endDate } : {}),
      cities: form.mode === "city" ? normalizeCitiesInput(form.cities) : [],
      status: form.status || "active",
    };

    setSaving(true);
    try {
      if (editId) {
        await adminUpdateBanner(adminToken, editId, payload, imageFile);
        await Swal.fire({ icon: "success", title: "Banner updated", timer: 1500 });
      } else {
        await adminCreateBanner(adminToken, payload, imageFile);
        await Swal.fire({ icon: "success", title: "Banner created", timer: 1500 });
      }
      resetForm();
      await loadRows();
    } catch (e) {
      if (e?.status === 401) return dispatch(logout());
      await Swal.fire({ icon: "error", title: "Save failed", text: e.message || "Could not save banner." });
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (row) => {
    setEditId(row._id);
    setForm({
      mode: row.mode || "",
      title: row.title || "",
      startDate: row.startDate ? String(row.startDate).slice(0, 10) : "",
      endDate: row.endDate ? String(row.endDate).slice(0, 10) : "",
      cities: Array.isArray(row.cities) ? row.cities.join(", ") : "",
      status: row.status || "active",
    });
    setImageFile(null);
    setImagePreview(mediaUrl(row.image));
  };

  const onDelete = async (row) => {
    if (editId) return;
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "Delete banner?",
      text: `This will delete "${row.title}".`,
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      confirmButtonText: "Delete",
    });
    if (!isConfirmed || !adminToken) return;
    try {
      await adminDeleteBanner(adminToken, row._id);
      await Swal.fire({ icon: "success", title: "Banner deleted", timer: 1500 });
      if (editId === row._id) resetForm();
      await loadRows();
    } catch (e) {
      if (e?.status === 401) return dispatch(logout());
      await Swal.fire({ icon: "error", title: "Delete failed", text: e.message || "Could not delete banner." });
    }
  };

  const onToggleStatus = async (row) => {
    if (!adminToken) return;
    const nextStatus = row.status === "active" ? "inactive" : "active";
    setTogglingId(row._id);
    try {
      await adminUpdateBanner(adminToken, row._id, { status: nextStatus });
      await Swal.fire({
        icon: "success",
        title: nextStatus === "active" ? "Banner activated" : "Banner deactivated",
        timer: 1500,
      });
      await loadRows();
    } catch (e) {
      if (e?.status === 401) return dispatch(logout());
      await Swal.fire({ icon: "error", title: "Status update failed", text: e.message || "Could not update status." });
    } finally {
      setTogglingId("");
    }
  };

  const pageInfo = useMemo(() => `Page ${page} of ${pages} · ${total} banners`, [page, pages, total]);
  const selectedCities = useMemo(() => normalizeCitiesInput(form.cities), [form.cities]);
  const filteredIndianCities = useMemo(() => {
    const query = citySearch.trim().toLowerCase();
    if (!query) return indianCities;
    return indianCities.filter((cityName) => cityName.toLowerCase().includes(query));
  }, [citySearch, indianCities]);

  const toggleCitySelection = (cityName) => {
    const current = normalizeCitiesInput(form.cities);
    const exists = current.some((city) => city.toLowerCase() === cityName.toLowerCase());
    const next = exists ? current.filter((city) => city.toLowerCase() !== cityName.toLowerCase()) : [...current, cityName];
    setForm((p) => ({ ...p, cities: next.join(", ") }));
  };

  const clearCitySelection = () => {
    setForm((p) => ({ ...p, cities: "" }));
  };

  return (
    <div className="user-page">
      <div className="page-card">
        <div className="page-card__head">
          <h2 className="page-card__title">{editId ? "Edit Banner" : "Create Banner"}</h2>
        </div>
        <form onSubmit={onSubmit}>
          <div className="row g-3">
            <label className="user-field col-12 col-md-6">
              <span className="user-field__label">
                Mode <span className="required-dot">*</span>
              </span>
              <select
                className="user-field__input"
                value={form.mode}
                onChange={(e) => {
                  const nextMode = e.target.value;
                  setForm((p) => ({ ...p, mode: nextMode, cities: nextMode === "city" ? p.cities : "" }));
                }}
                required
              >
                {/* <option value="">Select Mode</option> */}
                <option value="global">Global</option>
                <option value="city">City</option>
              </select>
            </label>
            <label className="user-field col-12 col-md-6">
              <span className="user-field__label" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span>
                  Title <span className="required-dot">*</span>
                </span>
                <small>{form.title.length}/{TITLE_MAX_LEN}</small>
              </span>
              <input
                className="user-field__input"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: sanitizeTitleInput(e.target.value) }))}
                maxLength={TITLE_MAX_LEN}
                required
              />
            </label>
            <label className="user-field col-12 col-md-6">
              <span className="user-field__label">Start date (optional)</span>
              <input type="date" className="user-field__input" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
            </label>
            <label className="user-field col-12 col-md-6">
              <span className="user-field__label">End date (optional)</span>
              <input type="date" className="user-field__input" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} />
            </label>
            {form.mode === "city" ? (
              <div className="user-field col-12">
                <span className="user-field__label">
                  Cities (India) <span className="required-dot">*</span>
                </span>
                <input
                  className="user-field__input"
                  value={citySearch}
                  onChange={(e) => setCitySearch(sanitizeCitySearchInput(e.target.value))}
                  placeholder="Search city..."
                />
                <small className="data-table__muted">{citySearch.length}/{CITY_SEARCH_MAX_LEN}</small>
                <div
                  className="user-field__input"
                  style={{ maxHeight: 220, overflowY: "auto", padding: "8px 10px", marginTop: 8 }}
                >
                  {filteredIndianCities.length === 0 ? (
                    <div className="data-table__muted">No city found.</div>
                  ) : (
                    filteredIndianCities.map((cityName) => {
                      const checked = selectedCities.some((city) => city.toLowerCase() === cityName.toLowerCase());
                      return (
                        <label key={cityName} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, cursor: "pointer" }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleCitySelection(cityName)} />
                          <span>{cityName}</span>
                        </label>
                      );
                    })
                  )}
                </div>
                <input required value={form.cities} onChange={() => {}} style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 1, height: 1 }} />
                <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="data-table__muted">{selectedCities.length} selected</span>
                  {selectedCities.length > 0 ? (
                    <button type="button" className="btn btn--ghost" onClick={clearCitySelection}>
                      Clear cities
                    </button>
                  ) : null}
                </div>
                {selectedCities.length > 0 ? (
                  <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {selectedCities.map((cityName) => (
                      <span
                        key={cityName}
                        style={{
                          fontSize: 12,
                          padding: "4px 8px",
                          borderRadius: 999,
                          background: "#eef2ff",
                          color: "#3730a3",
                          border: "1px solid #c7d2fe",
                        }}
                      >
                        {cityName}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <label className="user-field col-12 col-md-6">
              <span className="user-field__label">Status</span>
              <select className="user-field__input" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="user-field col-12 col-md-6">
              <span className="user-field__label">Image (max 5 MB) {editId ? "" : <span className="required-dot">*</span>}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  if (file && file.size > IMAGE_MAX_SIZE_BYTES) {
                    setImageFile(null);
                    setImagePreview("");
                    e.target.value = "";
                    void Swal.fire({
                      icon: "error",
                      title: "Validation error",
                      text: "Image size must be 5 MB or less.",
                    });
                    return;
                  }
                  setImageFile(file);
                  setImagePreview(file ? URL.createObjectURL(file) : "");
                }}
              />
            </label>
          </div>
          {imagePreview ? (
            <div style={{ marginTop: 10 }}>
              <img src={imagePreview} alt="Banner preview" style={{ width: 120, height: 70, objectFit: "cover", borderRadius: 8 }} />
            </div>
          ) : null}
          <div className="user-form__actions">
            {editId ? (
              <button type="button" className="btn btn--ghost" onClick={resetForm}>
                Cancel edit
              </button>
            ) : null}
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? "Saving…" : editId ? "Update Banner" : "Create Banner"}
            </button>
          </div>
        </form>
      </div>

      <div className="page-card">
        <div className="page-card__head">
          <h2 className="page-card__title">Banners</h2>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>S No.</th>
                <th>Image</th>
                <th>Title</th>
                <th>Mode</th>
                <th>Date Range</th>
                {/* <th>Cities</th> */}
                <th>Status</th>
                <th className="data-table__actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7}>Loading…</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7}>No banners found.</td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={row._id}>
                    <td className="data-table__muted">{(page - 1) * LIST_LIMIT + idx + 1}</td>
                    <td>{row.image ? <img src={mediaUrl(row.image)} alt="" style={{ width: 56, height: 42, objectFit: "cover", borderRadius: 6 }} /> : "—"}</td>
                    <td>{row.title || "—"}</td>
                    <td>{row.mode || "—"}</td>
                    <td className="data-table__muted">
                      {row.startDate ? new Date(row.startDate).toLocaleDateString() : "—"} - {row.endDate ? new Date(row.endDate).toLocaleDateString() : "—"}
                    </td>
                    {/* <td className="data-table__muted">{Array.isArray(row.cities) && row.cities.length > 0 ? row.cities.join(", ") : "—"}</td> */}
                    <td>
                      <button
                        type="button"
                        className={`settings-switch${row.status === "active" ? " settings-switch--on" : ""}`}
                        role="switch"
                        aria-checked={row.status === "active"}
                        aria-label={`Toggle status for ${row.title}`}
                        onClick={() => onToggleStatus(row)}
                        disabled={togglingId === row._id}
                        title={row.status === "active" ? "Deactivate banner" : "Activate banner"}
                      >
                        <span className="settings-switch__knob" aria-hidden />
                      </button>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="icon-btn icon-btn--view" title="View" onClick={() => setViewRow(row)}>
                          <AiOutlineEye size={18} />
                        </button>
                        <button type="button" className="icon-btn icon-btn--edit" title="Edit" onClick={() => onEdit(row)}>
                          <MdEditSquare size={18} />
                        </button>
                        <button
                          type="button"
                          className={`icon-btn icon-btn--delete${editId ? " is-disabled" : ""}`}
                          title={editId ? "Finish/cancel edit to enable delete" : "Delete"}
                          onClick={() => onDelete(row)}
                          disabled={Boolean(editId)}
                          style={editId ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
                        >
                          <AiFillDelete size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 ? (
          <div className="user-list-pagination">
            <span className="user-list-pagination__info">{pageInfo}</span>
            <div className="user-list-pagination__btns">
              <button type="button" className="btn btn--ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </button>
              <button type="button" className="btn btn--ghost" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {viewRow ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setViewRow(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            className="page-card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}
          >
            <div className="page-card__head" style={{ marginBottom: 12 }}>
              <h2 className="page-card__title">Banner Details</h2>
              <button type="button" className="btn btn--ghost" onClick={() => setViewRow(null)}>
                Close
              </button>
            </div>
            {viewRow.image ? (
              <div style={{ marginBottom: 12 }}>
                <img
                  src={mediaUrl(viewRow.image)}
                  alt={viewRow.title || "Banner"}
                  style={{ width: "100%", maxHeight: 250, objectFit: "cover", borderRadius: 8 }}
                />
              </div>
            ) : null}
            <div className="row g-2">
              <div className="col-12"><strong>Title:</strong> {viewRow.title || "—"}</div>
              <div className="col-6"><strong>Mode:</strong> {viewRow.mode || "—"}</div>
              <div className="col-6"><strong>Status:</strong> {viewRow.status || "—"}</div>
              <div className="col-6"><strong>Start Date:</strong> {viewRow.startDate ? new Date(viewRow.startDate).toLocaleDateString() : "—"}</div>
              <div className="col-6"><strong>End Date:</strong> {viewRow.endDate ? new Date(viewRow.endDate).toLocaleDateString() : "—"}</div>
              <div className="col-12"><strong>Cities:</strong> {Array.isArray(viewRow.cities) && viewRow.cities.length > 0 ? viewRow.cities.join(", ") : "—"}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
