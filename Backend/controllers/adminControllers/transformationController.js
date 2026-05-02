const Transformation = require("../../models/other/transformation");
const { User } = require("../../models");
const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const { assertObjectId } = require("../../utils/assertObjectId");
const { getPagination, searchFilter } = require("../../utils/listQuery");
const { deleteUploadFileByPublicUrl } = require("../../utils/deleteUploadFile");
const { publicUploadPathFromFields } = require("../../utils/publicUploadPath");

const ALLOWED_STATUS = new Set(["active", "inactive"]);
const UPLOAD_FOLDER = "transformation";

function normalizeRequired(value) {
  return String(value ?? "").trim();
}

function normalizeOptional(value) {
  if (value === undefined || value === null) return undefined;
  return String(value).trim();
}

function parseTimeTaken(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new AppError("timeTaken must be a non-negative number", 400);
  }
  return n;
}

function pathsFromUpload(req) {
  return {
    oldImage: publicUploadPathFromFields(req, UPLOAD_FOLDER, "oldImage"),
    newImage: publicUploadPathFromFields(req, UPLOAD_FOLDER, "newImage"),
  };
}

function deleteUploadedPair(paths) {
  deleteUploadFileByPublicUrl(paths.oldImage);
  deleteUploadFileByPublicUrl(paths.newImage);
}

function parseOptionalUserId(body) {
  if (!Object.prototype.hasOwnProperty.call(body, "userId")) {
    return undefined;
  }
  const raw = body.userId;
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return null;
  }
  assertObjectId(raw);
  return raw;
}

exports.listTransformations = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { status, search, userId } = req.query;

  const filter = {};
  if (status && String(status).trim()) {
    const normalizedStatus = String(status).trim();
    if (!ALLOWED_STATUS.has(normalizedStatus)) throw new AppError("Invalid status filter", 400);
    filter.status = normalizedStatus;
  }

  if (userId && String(userId).trim()) {
    assertObjectId(userId);
    filter.userId = userId;
  }

  const searchOr = searchFilter(search, ["achievements", "description"]);
  if (searchOr) Object.assign(filter, searchOr);

  const [transformations, total] = await Promise.all([
    Transformation.find(filter)
      .populate("userId", "name email phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Transformation.countDocuments(filter),
  ]);

  res.json({
    status: true,
    message: "Transformations fetched",
    transformations,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  });
});

exports.getTransformationById = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const transformation = await Transformation.findById(req.params.id)
    .populate("userId", "name email phone")
    .lean();
  if (!transformation) throw new AppError("Transformation not found", 404);
  res.json({ status: true, message: "Transformation fetched", transformation });
});

exports.createTransformation = asyncHandler(async (req, res) => {
  const fromUpload = pathsFromUpload(req);
  const timeTaken = parseTimeTaken(req.body.timeTaken);
  const achievements = normalizeRequired(req.body.achievements);
  const description = normalizeRequired(req.body.description);
  const oldImage = normalizeRequired(fromUpload.oldImage ?? req.body.oldImage);
  const newImage = normalizeRequired(fromUpload.newImage ?? req.body.newImage);
  const status = normalizeOptional(req.body.status) || "active";
  const userId = parseOptionalUserId(req.body);

  if (!achievements || !description || !oldImage || !newImage) {
    deleteUploadedPair(fromUpload);
    throw new AppError("achievements, description, oldImage, and newImage are required", 400);
  }
  if (!ALLOWED_STATUS.has(status)) {
    deleteUploadedPair(fromUpload);
    throw new AppError("Invalid status", 400);
  }

  if (userId) {
    const userExists = await User.exists({ _id: userId });
    if (!userExists) {
      deleteUploadedPair(fromUpload);
      throw new AppError("User not found", 400);
    }
  }

  try {
    const transformation = await Transformation.create({
      timeTaken,
      achievements,
      description,
      oldImage,
      newImage,
      status,
      userId: userId === undefined ? null : userId,
    });
    res.status(201).json({ status: true, message: "Transformation created", transformation });
  } catch (error) {
    deleteUploadedPair(fromUpload);
    throw error;
  }
});

exports.updateTransformation = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const transformation = await Transformation.findById(req.params.id);
  if (!transformation) throw new AppError("Transformation not found", 404);

  const fromUpload = pathsFromUpload(req);

  if (Object.prototype.hasOwnProperty.call(req.body, "timeTaken")) {
    transformation.timeTaken = parseTimeTaken(req.body.timeTaken);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "achievements")) {
    const achievements = normalizeRequired(req.body.achievements);
    if (!achievements) throw new AppError("achievements cannot be empty", 400);
    transformation.achievements = achievements;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "description")) {
    const description = normalizeRequired(req.body.description);
    if (!description) throw new AppError("description cannot be empty", 400);
    transformation.description = description;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "oldImage")) {
    const oldImage = normalizeRequired(req.body.oldImage);
    if (!oldImage) {
      deleteUploadedPair(fromUpload);
      throw new AppError("oldImage cannot be empty", 400);
    }
    transformation.oldImage = oldImage;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "newImage")) {
    const newImage = normalizeRequired(req.body.newImage);
    if (!newImage) {
      deleteUploadedPair(fromUpload);
      throw new AppError("newImage cannot be empty", 400);
    }
    transformation.newImage = newImage;
  }

  if (fromUpload.oldImage) {
    deleteUploadFileByPublicUrl(transformation.oldImage);
    transformation.oldImage = fromUpload.oldImage;
  }

  if (fromUpload.newImage) {
    deleteUploadFileByPublicUrl(transformation.newImage);
    transformation.newImage = fromUpload.newImage;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "status")) {
    const status = normalizeRequired(req.body.status);
    if (!ALLOWED_STATUS.has(status)) {
      deleteUploadedPair(fromUpload);
      throw new AppError("Invalid status", 400);
    }
    transformation.status = status;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "userId")) {
    const userId = parseOptionalUserId(req.body);
    if (userId) {
      const userExists = await User.exists({ _id: userId });
      if (!userExists) {
        deleteUploadedPair(fromUpload);
        throw new AppError("User not found", 400);
      }
      transformation.userId = userId;
    } else {
      transformation.userId = null;
    }
  }

  await transformation.save();
  const updated = await Transformation.findById(transformation._id)
    .populate("userId", "name email phone")
    .lean();
  res.json({ status: true, message: "Transformation updated", transformation: updated });
});

exports.deleteTransformation = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const transformation = await Transformation.findById(req.params.id);
  if (!transformation) throw new AppError("Transformation not found", 404);

  deleteUploadFileByPublicUrl(transformation.oldImage);
  deleteUploadFileByPublicUrl(transformation.newImage);
  await Transformation.findByIdAndDelete(transformation._id);
  res.json({ status: true, message: "Transformation deleted" });
});
