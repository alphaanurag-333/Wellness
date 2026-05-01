# Wellness API — User authentication
 
Base URL (local default): `http://localhost:5000/api`
 
All user-auth routes are under **`/api/user/auth`**.
 
Protected routes expect a JWT in the header:
 
```http
Authorization: Bearer <access_token>
```
 
Errors use JSON bodies with a `message` field (and optional `statusCode` from the global error handler).
 
---
 
## Registration flow (OTP required)
 
Registration is two steps: request a code, then complete signup with the same `email` + `phone` (+ optional `phoneCountryCode`) and the **`otp`** from step 1. Codes expire after **10 minutes** (`OTP_TTL_MS` in code) and are **single-use** (the record is deleted after a successful register).
 
### 1. Send registration OTP
 
`POST /user/auth/send-register-otp`
 
**Body (JSON)**
 
| Field | Type | Required | Notes |
|--------|------|----------|--------|
| `email` | string | yes | Normalized to lowercase |
| `phone` | string | yes | National number (e.g. 10 digits) |
| `phoneCountryCode` | string | no | Default `"+91"` |
 
**Success `200`**
 
```json
{
  "message": "Registration code sent.",
  "otp": "123456"
}
```
 
> **Note:** `otp` is returned in the API response for development/testing. Replace with SMS/email delivery in production.
 
**Errors**
 
| Status | When |
|--------|------|
| `400` | `Email and phone are required to send a registration code.` |
| `409` | Email or phone already registered |
 
```bash
curl -s -X POST "http://localhost:5000/api/user/auth/send-register-otp" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"user@example.com\",\"phone\":\"9876543210\",\"phoneCountryCode\":\"+91\"}"
```
 
---
 
### 2. Register
 
`POST /user/auth/register`
 
Accepts **`application/json`** or **`multipart/form-data`** (optional profile image).
 
**Multipart:** use field name **`file`** for the image; other fields as form fields.
 
**Body (main fields)**
 
| Field | Type | Required | Notes |
|--------|------|----------|--------|
| `name` | string | yes | |
| `email` | string | yes | Must match OTP request |
| `phone` | string | yes | Must match OTP request |
| `phoneCountryCode` | string | no | Default `+91`; must match OTP request |
| `otp` | string | yes | 6-digit code from `send-register-otp` |
| `password` | string | no | If omitted, user can sign in with OTP only until they set a password |
| `termsAccepted` | boolean/string | yes | Must be truthy (`true`, `"true"`, `1`, etc.) |
| `termsAcceptedAt` | string (ISO date) | no | Server defaults to “now” if omitted |
| `whatsappSameAsMobile` | boolean/string | no | Default `false` |
| `whatsappCountryCode` | string | no | |
| `whatsappPhone` | string | no | |
| `dob` | string | no | Date string |
| `gender` | string | no | One of: `male`, `female`, `other`, `boy`, `girl`, `guess` |
| `country`, `state`, `city` | string | no | |
| `primaryHealthConcern` | string (ObjectId) | no | |
| `fcm_id` | string | no | |
| `profileImage` | string | no | URL/path when not uploading a file |
 
**Additional errors (register)**
 
| Status | `message` (from controller) |
|--------|-----------------------------|
| `400` | `Name, email, and phone are required` |
| `400` | `Terms and conditions must be accepted to register.` |
| `400` | `Invalid terms acceptance date.` |
| `400` | `Invalid gender` |
| `400` | `A valid 6-digit registration code is required.` |
| `400` | `Invalid primary health concern id` (bad ObjectId) |
| `400` | `Invalid or expired registration code.` |
| `409` | `Email is already registered` / `Phone number is already registered` |
 
**Success `201`**
 
```json
{
  "message": "Registered successfully",
  "user": { },
  "token": "<jwt>"
}
```
 
```bash
curl -s -X POST "http://localhost:5000/api/user/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Jane Doe\",
    \"email\": \"user@example.com\",
    \"phone\": \"9876543210\",
    \"phoneCountryCode\": \"+91\",
    \"otp\": \"123456\",
    \"password\": \"SecretPass1\",
    \"termsAccepted\": true,
    \"whatsappSameAsMobile\": true
  }"
```
 
**Register with profile image (multipart)**
 
```bash
curl -s -X POST "http://localhost:5000/api/user/auth/register" \
  -F "name=Jane Doe" \
  -F "email=user@example.com" \
  -F "phone=9876543210" \
  -F "phoneCountryCode=+91" \
  -F "otp=123456" \
  -F "termsAccepted=true" \
  -F "file=@/path/to/photo.jpg"
```
 
---
 
## Login
 
Identify the user with **`email`** **or** **`phone` + `phoneCountryCode`** (default `+91`). If both are sent, lookup uses **`email` first** (see `findUserByLoginIdentifier` in `authController.js`).
 
### Send login OTP
 
`POST /user/auth/send-login-otp`
 
Resolves the account with **`email`** if provided (non-empty), otherwise with **`phone` + `phoneCountryCode`** (default `+91`). Sending both uses **email first**.
 
**Body**
 
| Field | Type | Required |
|--------|------|----------|
| `email` | string | one of email or phone |
| `phone` | string | one of email or phone |
| `phoneCountryCode` | string | no (required with `phone` lookup) |
 
**Errors**
 
| Status | When |
|--------|------|
| `400` | Neither email nor phone provided (`Email or phone is required`) |
 
**Success `200` — user found**
 
Stores a new 6-digit OTP on the user; expires in **10 minutes**.
 
```json
{
  "message": "Login code sent.",
  "otp": "654321"
}
```
 
> **Note:** `otp` is returned in the JSON for now (`TODO` in code: SMS/email). Do not rely on this in production.
 
**Success `200` — user not found**
 
```json
{
  "message": "User not found"
}
```
 
No `otp` field. (This differs from a fully generic response; clients can treat both `200` shapes as final.)
 
```bash
curl -s -X POST "http://localhost:5000/api/user/auth/send-login-otp" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"user@example.com\"}"
```
 
```bash
curl -s -X POST "http://localhost:5000/api/user/auth/send-login-otp" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"9876543210\",\"phoneCountryCode\":\"+91\"}"
```
 
---
 
### Login (password or OTP)
 
`POST /user/auth/login`
 
**Body**
 
| Field | Type | Required |
|--------|------|----------|
| `email` or `phone` + `phoneCountryCode` | | yes |
| `password` | string | one of password or `otp` |
| `otp` | string | one of password or `otp` (6 digits; call `send-login-otp` first) |
 
**Behaviour (matches `authController.login`)**
 
- If **`otp`** is non-empty after trim, it is checked **first** (even if `password` is also sent). It must match the stored login OTP and `otpExpire` must be in the future. On success, `otp` / `otpExpire` are cleared on the user document.
- Else if **`password`** is non-empty: compared with `passwordHash` when present.
- Else: **`400`** `Provide a password or a 6-digit login code (OTP).`
- Missing identifier (no email and no phone): **`400`** `Email or phone is required` (from `findUserByLoginIdentifier`).
 
**Errors**
 
| Status | `message` |
|--------|-----------|
| `400` | `Email or phone is required` |
| `400` | `Provide a password or a 6-digit login code (OTP).` |
| `401` | `Invalid credentials` (user not found) |
| `401` | `Invalid or expired login code` |
| `401` | `No password on file. Request a login code instead.` |
| `403` | `Account is blocked` / `Account is inactive` |
 
Blocked / inactive are enforced **after** a successful password or OTP check (`assertUserCanLogin`).
 
**Success `200`**
 
```json
{
  "message": "Login successful",
  "user": { },
  "token": "<jwt>"
}
```
 
```bash
curl -s -X POST "http://localhost:5000/api/user/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"user@example.com\",\"password\":\"SecretPass1\"}"
```
 
```bash
curl -s -X POST "http://localhost:5000/api/user/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"user@example.com\",\"otp\":\"654321\"}"
```
 
---
 
## Forgot password
 
`POST /user/auth/forgot-password`
 
**Body:** `{ "email": "user@example.com" }`
 
**Errors:** `400` `Email is required` if `email` is missing.
 
**Success `200`:** Same generic message whether or not the user exists. If a user exists, a reset token is stored (1 hour TTL). In **`NODE_ENV=development`**, the JSON may include **`resetToken`** for testing.
 
```bash
curl -s -X POST "http://localhost:5000/api/user/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"user@example.com\"}"
```
 
---
 
## Reset password
 
`POST /user/auth/reset-password`
 
**Body:** `{ "token": "<from forgot-password>", "password": "NewSecret1" }`
 
**Errors:** `400` `Token and new password are required`, or `Invalid or expired reset token`.
 
```bash
curl -s -X POST "http://localhost:5000/api/user/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"YOUR_RESET_TOKEN\",\"password\":\"NewSecret1\"}"
```
 
---
 
## Current user (protected)
 
### Get profile
 
`GET /user/auth/me`
 
```bash
curl -s "http://localhost:5000/api/user/auth/me" \
  -H "Authorization: Bearer YOUR_JWT"
```
 
---
 
### Update profile
 
`PATCH /user/auth/me`
 
JSON or multipart (`file` for new avatar). Updatable fields include: `name`, `phoneCountryCode`, `phone`, `whatsappSameAsMobile`, `whatsappCountryCode`, `whatsappPhone`, `dob`, `gender`, `country`, `state`, `city`, `primaryHealthConcern`, `fcm_id`, `profileImage`. **Terms acceptance cannot be changed** here.
 
```bash
curl -s -X PATCH "http://localhost:5000/api/user/auth/me" \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Jane Q. Doe\",\"city\":\"Mumbai\"}"
```
 
---
 
### Delete account
 
`DELETE /user/auth/me`
 
```bash
curl -s -X DELETE "http://localhost:5000/api/user/auth/me" \
  -H "Authorization: Bearer YOUR_JWT"
```
 
---
 
## Quick reference
 
| Method | Path | Auth |
|--------|------|------|
| `POST` | `/api/user/auth/send-register-otp` | No |
| `POST` | `/api/user/auth/register` | No |
| `POST` | `/api/user/auth/send-login-otp` | No |
| `POST` | `/api/user/auth/login` | No |
| `POST` | `/api/user/auth/forgot-password` | No |
| `POST` | `/api/user/auth/reset-password` | No |
| `GET` | `/api/user/auth/me` | Bearer |
| `PATCH` | `/api/user/auth/me` | Bearer |
| `DELETE` | `/api/user/auth/me` | Bearer |
 
Port defaults to **`5000`** unless `PORT` is set in the environment.