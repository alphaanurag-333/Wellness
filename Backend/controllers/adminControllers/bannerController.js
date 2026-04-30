const Banner = require("../../models/other/banner");
const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const { assertObjectId } = require("../../utils/assertObjectId");
const { getPagination, searchFilter } = require("../../utils/listQuery");
const { deleteUploadFileByPublicUrl } = require("../../utils/deleteUploadFile");
const { publicUploadPathFromFile } = require("../../utils/publicUploadPath");

const ALLOWED_STATUS = new Set(["active", "inactive"]);
const ALLOWED_MODE = new Set(["global", "city"]);
const UPLOAD_FOLDER = "banner";

function normalizeRequired(value) {
  return String(value ?? "").trim();
}

function normalizeOptional(value) {
  if (value === undefined || value === null) return undefined;
  return String(value).trim();
}

function normalizeCities(input) {
  if (input === undefined || input === null) return undefined;
  const values = Array.isArray(input) ? input : String(input).split(",");
  return values
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function parseDateOrThrow(value, fieldName) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${fieldName} is invalid`, 400);
  }
  return date;
}

function assertDateRange(startDate, endDate) {
  if (startDate > endDate) {
    throw new AppError("Start date cannot be after end date", 400);
  }
}

exports.listBanners = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { status, search, mode, city } = req.query;

  const filter = {};
  if (status) {
    if (!ALLOWED_STATUS.has(String(status))) throw new AppError("Invalid status filter", 400);
    filter.status = String(status);
  }
  if (mode && String(mode).trim()) {
    const normalizedMode = String(mode).trim();
    if (!ALLOWED_MODE.has(normalizedMode)) throw new AppError("Invalid mode filter", 400);
    filter.mode = normalizedMode;
  }
  if (city && String(city).trim()) {
    filter.cities = String(city).trim();
  }

  const searchOr = searchFilter(search, ["title", "mode", "cities"]);
  if (searchOr) Object.assign(filter, searchOr);

  const [banners, total] = await Promise.all([
    Banner.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Banner.countDocuments(filter),
  ]);

  res.json({
    banners,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  });
});

exports.getBannerById = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const banner = await Banner.findById(req.params.id).lean();
  if (!banner) throw new AppError("Banner not found", 404);
  res.json({ banner });
});

exports.createBanner = asyncHandler(async (req, res) => {
  const mode = normalizeRequired(req.body.mode);
  const title = normalizeRequired(req.body.title);
  const imageFromFile = publicUploadPathFromFile(req, UPLOAD_FOLDER);
  const image = normalizeRequired(imageFromFile ?? req.body.image);
  const status = normalizeOptional(req.body.status) || "active";
  const startDateRaw = normalizeOptional(req.body.startDate);
  const endDateRaw = normalizeOptional(req.body.endDate);
  const cities = normalizeCities(req.body.cities) || [];

  if (!mode || !title || !image) {
    deleteUploadFileByPublicUrl(imageFromFile);
    throw new AppError("Mode, title, and image are required", 400);
  }
  if (!ALLOWED_MODE.has(mode)) {
    deleteUploadFileByPublicUrl(imageFromFile);
    throw new AppError("Invalid mode", 400);
  }
  if (!ALLOWED_STATUS.has(status)) {
    deleteUploadFileByPublicUrl(imageFromFile);
    throw new AppError("Invalid status", 400);
  }

  try {
    const startDate = startDateRaw ? parseDateOrThrow(startDateRaw, "Start date") : undefined;
    const endDate = endDateRaw ? parseDateOrThrow(endDateRaw, "End date") : undefined;
    if (startDate && endDate) {
      assertDateRange(startDate, endDate);
    }

    const banner = await Banner.create({
      mode,
      title,
      image,
      startDate,
      endDate,
      cities,
      status,
    });

    res.status(201).json({ message: "Banner created", banner });
  } catch (error) {
    deleteUploadFileByPublicUrl(imageFromFile);
    throw error;
  }
});

exports.updateBanner = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const banner = await Banner.findById(req.params.id);
  if (!banner) throw new AppError("Banner not found", 404);

  if (Object.prototype.hasOwnProperty.call(req.body, "mode")) {
    const mode = normalizeRequired(req.body.mode);
    if (!mode) throw new AppError("Mode cannot be empty", 400);
    if (!ALLOWED_MODE.has(mode)) throw new AppError("Invalid mode", 400);
    banner.mode = mode;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "title")) {
    const title = normalizeRequired(req.body.title);
    if (!title) throw new AppError("Title cannot be empty", 400);
    banner.title = title;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "image")) {
    const image = normalizeRequired(req.body.image);
    if (!image) {
      deleteUploadFileByPublicUrl(publicUploadPathFromFile(req, UPLOAD_FOLDER));
      throw new AppError("Image cannot be empty", 400);
    }
    banner.image = image;
  }

  if (req.file) {
    const uploadedImage = publicUploadPathFromFile(req, UPLOAD_FOLDER);
    deleteUploadFileByPublicUrl(banner.image);
    banner.image = uploadedImage;
  }

  let nextStartDate = banner.startDate;
  let nextEndDate = banner.endDate;

  if (Object.prototype.hasOwnProperty.call(req.body, "startDate")) {
    const startDateRaw = normalizeOptional(req.body.startDate);
    nextStartDate = startDateRaw ? parseDateOrThrow(startDateRaw, "Start date") : undefined;
    banner.startDate = nextStartDate;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "endDate")) {
    const endDateRaw = normalizeOptional(req.body.endDate);
    nextEndDate = endDateRaw ? parseDateOrThrow(endDateRaw, "End date") : undefined;
    banner.endDate = nextEndDate;
  }

  if (nextStartDate && nextEndDate) {
    assertDateRange(nextStartDate, nextEndDate);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "cities")) {
    banner.cities = normalizeCities(req.body.cities) || [];
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "status")) {
    const status = normalizeRequired(req.body.status);
    if (!ALLOWED_STATUS.has(status)) {
      deleteUploadFileByPublicUrl(publicUploadPathFromFile(req, UPLOAD_FOLDER));
      throw new AppError("Invalid status", 400);
    }
    banner.status = status;
  }

  await banner.save();
  res.json({ message: "Banner updated", banner });
});

exports.deleteBanner = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const banner = await Banner.findById(req.params.id);
  if (!banner) throw new AppError("Banner not found", 404);

  deleteUploadFileByPublicUrl(banner.image);
  await Banner.findByIdAndDelete(banner._id);
  res.json({ message: "Banner deleted" });
});
