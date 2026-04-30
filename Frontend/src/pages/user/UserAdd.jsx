import { useEffect, useId, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import { adminCreateUser, adminUpdateUser } from "../../api/adminUsers.js";
import { mediaUrl } from "../../media.js";
import { logout } from "../../store/authSlice.js";

function emptyUserForm() {
  return {
    name: "",
    email: "",
    password: "",
    passwordConfirm: "",
    phone: "",
    dob: "",
    gender: "male",
    fcm_id: "",
    status: "active",
  };
}

function userToFormValues(user) {
  if (!user) return emptyUserForm();
  let dob = "";
  if (user.dob) {
    const d = new Date(user.dob);
    if (!Number.isNaN(d.getTime())) dob = d.toISOString().slice(0, 10);
  }
  return {
    name: user.name != null ? String(user.name) : "",
    email: user.email != null ? String(user.email) : "",
    password: "",
    passwordConfirm: "",
    phone: user.phone != null ? String(user.phone) : "",
    dob,
    gender: ["male", "female", "other"].includes(user.gender) ? user.gender : "male",
    fcm_id: user.fcm_id != null ? String(user.fcm_id) : "",
    status: ["active", "inactive", "blocked"].includes(user.status) ? user.status : "active",
  };
}

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

function yearsAgoDate(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d;
}

function validateUserForm(values, mode) {
  const name = values.name.trim();
  const email = values.email.trim();
  const phone = values.phone.trim();

  if (!name) return "Full name is required.";
  if (!/^[A-Za-z ]+$/.test(name)) return "Name should contain only letters and spaces.";
  if (!email) return "Email is required.";
  if (!phone) return "Mobile number is required.";
  if (!values.gender) return "Gender is required.";
  if (!values.status) return "Account status is required.";

  if (!/^\d+$/.test(phone)) return "Mobile number should contain digits only.";
  if (phone.length !== 10) return "Mobile number must be exactly 10 digits.";

  if (values.dob) {
    const dob = new Date(values.dob);
    if (Number.isNaN(dob.getTime())) return "Please select a valid date of birth.";
    const latestAllowed = yearsAgoDate(5);
    const oldestAllowed = yearsAgoDate(100);
    if (dob > latestAllowed) return "User must be at least 5 years old.";
    if (dob < oldestAllowed) return "User age cannot be more than 100 years.";
  }

  // Password and confirm password are temporarily disabled in UI and validation.

  return "";
}

export function UserProfileForm({
  mode = "create",
  userId = "",
  initialUser = null,
  onCancel,
  onSuccess,
  submitLabel = "Save Changes",
}) {
  const dispatch = useDispatch();
  const adminToken = useSelector((s) => s.auth.adminToken);
  const [values, setValues] = useState(() => (initialUser ? userToFormValues(initialUser) : emptyUserForm()));
  const [profileFile, setProfileFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const fileInputId = useId();

  useEffect(() => {
    if (!initialUser) {
      setValues(emptyUserForm());
      return;
    }
    setValues(userToFormValues(initialUser));
    setProfileFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [initialUser]);

  useEffect(() => {
    if (!profileFile) return;
    const url = URL.createObjectURL(profileFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [profileFile]);

  const handleChange = (field) => (e) => {
    const v = e.target.value;
    setValues((prev) => ({ ...prev, [field]: v }));
  };

  const handleNameInput = (e) => {
    const onlyLettersAndSpaces = e.target.value.replace(/[^A-Za-z ]+/g, "");
    const removedSpaces = onlyLettersAndSpaces.replace(/\s{2,}/g, " ");
    setValues((prev) => ({ ...prev, name: removedSpaces }));
  };

  const handlePhoneInput = (e) => {
    const onlyDigits = e.target.value.replace(/\D+/g, "").slice(0, 10);
    setValues((prev) => ({ ...prev, phone: onlyDigits }));
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileFile(file);
    setFormError("");
  };

  const clearFile = () => {
    setProfileFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const avatarDisplay = previewUrl || mediaUrl(initialUser?.profileImage);
  const initial = (values.name || values.email || "?").charAt(0).toUpperCase();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!adminToken) {
      const msg = "You are not signed in.";
      setFormError(msg);
      await Swal.fire({ icon: "error", title: "Validation error", text: msg });
      return;
    }
    const validationError = validateUserForm(values, mode);
    if (validationError) {
      setFormError(validationError);
      await Swal.fire({ icon: "error", title: "Validation error", text: validationError });
      return;
    }

    const payload = {
      name: values.name.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      dob: values.dob || "",
      gender: values.gender,
      fcm_id: values.fcm_id.trim(),
      status: values.status,
    };

    setSubmitting(true);
    try {
      let user;
      if (mode === "create") {
        user = await adminCreateUser(adminToken, payload, profileFile);
      } else {
        const patchPayload = {
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
          dob: payload.dob,
          gender: payload.gender,
          fcm_id: payload.fcm_id,
          status: payload.status,
        };
        user = await adminUpdateUser(adminToken, userId, patchPayload, profileFile);
      }
      onSuccess?.(user);
    } catch (err) {
      if (err?.status === 401) {
        dispatch(logout());
        return;
      }
      const msg = err.message || "Request failed.";
      setFormError(msg);
      await Swal.fire({ icon: "error", title: "Request failed", text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="user-form" onSubmit={handleSubmit}>
      <div className="user-form__intro">
        <h2 className="user-form__section-title">Profile information</h2>
      </div>
      <div className="user-form__upload-row">
        <div className="user-upload user-upload--with-preview">
          <input
            ref={fileInputRef}
            id={fileInputId}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp"
            className="user-upload__input"
            onChange={handleFile}
          />
          <label htmlFor={fileInputId} className="user-upload__circle-wrap">
            <span className="user-upload__circle">
              {avatarDisplay ? (
                <img src={avatarDisplay} alt="" className="user-upload__preview-img" width={112} height={112} />
              ) : (
                <>
                  <span className="user-upload__initial">{initial}</span>
                  <span className="user-upload__badge">Photo</span>
                </>
              )}
            </span>
            <span className="user-upload__tap-hint">Choose image</span>
          </label>
        </div>
        <div className="user-upload__meta">
          <div className="user-upload__label">Profile image</div>
          <p className="user-upload__hint">Optional. JPEG, PNG, GIF, or WebP.</p>
          {profileFile ? (
            <button type="button" className="btn btn--ghost btn--sm" onClick={clearFile}>
              Remove new image
            </button>
          ) : null}
        </div>
      </div>

      <div className="user-form__grid">
        <label className="user-field">
          <span className="user-field__label">Full name <span className="required-dot">*</span></span>
          <input
            type="text"
            value={values.name}
            onChange={handleNameInput}
            placeholder="Full name"
            autoComplete="name"
            minLength={2}
            maxLength={40}
            required
          />
        </label>
        <label className="user-field">
          <span className="user-field__label">Email ID <span className="required-dot">*</span></span>
          <input
            type="email"
            value={values.email}
            onChange={handleChange("email")}
            placeholder="email@example.com"
            autoComplete="email"
            minLength={3}
            maxLength={50}
            required
          />
        </label>
        <label className="user-field">
          <span className="user-field__label">Mobile Number <span className="required-dot">*</span></span>
          <input
            type="tel"
            value={values.phone}
            onChange={handlePhoneInput}
            placeholder="9876543210"
            autoComplete="tel"
            inputMode="numeric"
            maxLength={10}
            minLength={10}
            required
          />
        </label>
        <label className="user-field">
          <span className="user-field__label">Date of birth</span>
          <input
            type="date"
            value={values.dob}
            onChange={handleChange("dob")}
            min={yearsAgoDate(100).toISOString().slice(0, 10)}
            max={yearsAgoDate(5).toISOString().slice(0, 10)}
          />
        </label>
        <label className="user-field">
          <span className="user-field__label">Gender <span className="required-dot">*</span></span>
          <select value={values.gender} onChange={handleChange("gender")} required>
            {GENDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {/* <label className="user-field">
          <span className="user-field__label">FCM token</span>
          <input
            type="text"
            value={values.fcm_id}
            onChange={handleChange("fcm_id")}
            placeholder="Push notification token (optional)"
            autoComplete="off"
          />
        </label> */}
        <label className="user-field user-field--full">
          <span className="user-field__label">Account status <span className="required-dot">*</span></span>
          <select value={values.status} onChange={handleChange("status")} required>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {/* <label className="user-field">
          <span className="user-field__label">
            {mode === "create" ? (
              <>Password <span className="required-dot">*</span></>
            ) : (
              "New password (optional)"
            )}
          </span>
          <input
            type="password"
            value={values.password}
            onChange={handleChange("password")}
            placeholder={mode === "create" ? "At least 8 characters" : "Leave blank to keep current"}
            autoComplete="new-password"
            required={mode === "create"}
          />
        </label>
        <label className="user-field">
          <span className="user-field__label">
            {mode === "create" ? (
              <>Confirm password <span className="required-dot">*</span></>
            ) : (
              "Confirm new password"
            )}
          </span>
          <input
            type="password"
            value={values.passwordConfirm}
            onChange={handleChange("passwordConfirm")}
            placeholder="Repeat password"
            autoComplete="new-password"
            required={mode === "create"}
          />
        </label> */}
      </div>

      <div className="user-form__actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <path d="M17 21v-8H7v8M7 3v5h8" />
          </svg>
          {submitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

export function UserAdd() {
  const navigate = useNavigate();

  return (
    <div className="user-page">
      <div className="user-page__toolbar">
        <button type="button" className="user-back-btn" aria-label="Back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18 9 12l6-6" />
          </svg>
        </button>
        <div>
          <h2 className="user-page__title">Add User</h2>
          <p className="user-page__subtitle">Create a new user account and profile.</p>
        </div>
      </div>

      <div className="user-page__card">
        <UserProfileForm
          mode="create"
          submitLabel="Create user"
          onCancel={() => navigate(-1)}
          onSuccess={async () => {
            await Swal.fire({
              icon: "success",
              title: "User created",
              timer: 1500,
            });
            navigate(-1);
          }}
        />
      </div>
    </div>
  );
}
