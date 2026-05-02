const Transformation = require("../../models/other/transformation");
const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const { assertObjectId } = require("../../utils/assertObjectId");
const { getPagination, searchFilter } = require("../../utils/listQuery");
const { deleteUploadFileByPublicUrl } = require("../../utils/deleteUploadFile");
const { publicUploadPathFromFields } = require("../../utils/publicUploadPath");

const UPLOAD_FOLDER = "transformation";

function normalizeRequired(value) {
  return String(value ?? "").trim();
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

/** Public gallery: active transformations only. */
exports.listActiveTransformations = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { search } = req.query;

  const filter = { status: "active" };
  const searchOr = searchFilter(search, ["achievements", "description"]);
  if (searchOr) Object.assign(filter, searchOr);

  const [transformations, total] = await Promise.all([
    Transformation.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
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

exports.getActiveTransformationById = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const transformation = await Transformation.findOne({
    _id: req.params.id,
    status: "active",
  }).lean();
  if (!transformation) throw new AppError("Transformation not found", 404);
  res.json({ status: true, message: "Transformation fetched", transformation });
});

function assertOwnTransformation(doc, userId) {
  if (!doc.userId || String(doc.userId) !== String(userId)) {
    throw new AppError("Transformation not found", 404);
  }
}

exports.listMyTransformations = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { search } = req.query;
  const userId = req.user._id;

  const filter = { userId };
  const searchOr = searchFilter(search, ["achievements", "description"]);
  if (searchOr) Object.assign(filter, searchOr);

  const [transformations, total] = await Promise.all([
    Transformation.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Transformation.countDocuments(filter),
  ]);

  res.json({
    status: true,
    message: "Your transformations",
    transformations,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  });
});

exports.getMyTransformationById = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const transformation = await Transformation.findById(req.params.id).lean();
  if (!transformation) throw new AppError("Transformation not found", 404);
  assertOwnTransformation(transformation, req.user._id);
  res.json({ status: true, message: "Transformation fetched", transformation });
});

exports.createMyTransformation = asyncHandler(async (req, res) => {
  const fromUpload = pathsFromUpload(req);
  const timeTaken = parseTimeTaken(req.body.timeTaken);
  const achievements = normalizeRequired(req.body.achievements);
  const description = normalizeRequired(req.body.description);
  const oldImage = normalizeRequired(fromUpload.oldImage ?? req.body.oldImage);
  const newImage = normalizeRequired(fromUpload.newImage ?? req.body.newImage);

  if (!achievements || !description || !oldImage || !newImage) {
    deleteUploadedPair(fromUpload);
    throw new AppError("achievements, description, oldImage, and newImage are required", 400);
  }

  try {
    const transformation = await Transformation.create({
      timeTaken,
      achievements,
      description,
      oldImage,
      newImage,
      status: "active",
      userId: req.user._id,
    });
    res.status(201).json({ status: true, message: "Transformation created", transformation });
  } catch (error) {
    deleteUploadedPair(fromUpload);
    throw error;
  }
});

exports.updateMyTransformation = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const transformation = await Transformation.findById(req.params.id);
  if (!transformation) throw new AppError("Transformation not found", 404);
  assertOwnTransformation(transformation, req.user._id);

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

  await transformation.save();
  res.json({ status: true, message: "Transformation updated", transformation });
});

exports.deleteMyTransformation = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const transformation = await Transformation.findById(req.params.id);
  if (!transformation) throw new AppError("Transformation not found", 404);
  assertOwnTransformation(transformation, req.user._id);

  deleteUploadFileByPublicUrl(transformation.oldImage);
  deleteUploadFileByPublicUrl(transformation.newImage);
  await Transformation.findByIdAndDelete(transformation._id);
  res.json({ status: true, message: "Transformation deleted" });
});
