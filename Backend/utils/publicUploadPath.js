/**
 * Build public URL path for a multer `req.file` saved under uploads/<folder>/.
 */
function publicUploadPathFromFile(req, folder) {
  if (!req.file) {
    return undefined;
  }
  return `/uploads/${folder}/${req.file.filename}`;
}

/** Multer `.fields()` — first file for `fieldName` under `uploads/<folder>/`. */
function publicUploadPathFromFields(req, folder, fieldName) {
  if (!req.files || !req.files[fieldName]) {
    return undefined;
  }
  const f = req.files[fieldName];
  const file = Array.isArray(f) ? f[0] : f;
  if (!file) {
    return undefined;
  }
  return `/uploads/${folder}/${file.filename}`;
}

module.exports = { publicUploadPathFromFile, publicUploadPathFromFields };
