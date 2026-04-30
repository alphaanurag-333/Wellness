const { User } = require("../../models");
const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const { hashPassword } = require("../../utils/password");
const { toPublicProfile } = require("../../utils/toPublicProfile");
const { deleteUploadFileByPublicUrl } = require("../../utils/deleteUploadFile");
const { assertObjectId } = require("../../utils/assertObjectId");
const { publicUploadPathFromFile } = require("../../utils/publicUploadPath");
const { getPagination, searchFilter } = require("../../utils/listQuery");

const UPLOAD_FOLDER = "user";
function normalizeRequired(value) {
  return String(value ?? "").trim();
}

exports.listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { status, search } = req.query;

  const filter = {};
  if (status) {
    filter.status = status;
  }
  const searchOr = searchFilter(search, ["name", "email", "phone"]);
  if (searchOr) {
    Object.assign(filter, searchOr);
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  res.json({
    users: users.map((u) => toPublicProfile(u)),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  });
});

exports.getUserById = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const user = await User.findById(req.params.id).select("-passwordHash");
  if (!user) {
    throw new AppError("User not found", 404);
  }
  res.json({ user: toPublicProfile(user) });
});

exports.createUser = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    phone,
    dob,
    gender,
    fcm_id,
    profileImage,
    status,
  } = req.body;

  const nameNorm = normalizeRequired(name);
  const emailNorm = normalizeRequired(email).toLowerCase();
  const phoneNorm = normalizeRequired(phone);

  if (!nameNorm || !emailNorm || !phoneNorm) {
    deleteUploadFileByPublicUrl(publicUploadPathFromFile(req, UPLOAD_FOLDER));
    throw new AppError("Name, email, and phone are required", 400);
  }

  const existing = await User.findOne({ email: emailNorm });
  if (existing) {
    deleteUploadFileByPublicUrl(publicUploadPathFromFile(req, UPLOAD_FOLDER));
    throw new AppError("Email is already in use", 409);
  }
  const existingPhone = await User.findOne({ phone: phoneNorm });
  if (existingPhone) {
    deleteUploadFileByPublicUrl(publicUploadPathFromFile(req, UPLOAD_FOLDER));
    throw new AppError("Phone number is already in use", 409);
  }


  const fromFile = publicUploadPathFromFile(req, UPLOAD_FOLDER);
  const passwordNorm = String(password ?? "").trim();
  const passwordHash = passwordNorm ? await hashPassword(passwordNorm) : undefined;
  let user;
  try {
    user = await User.create({
      name: nameNorm,
      email: emailNorm,
      ...(passwordHash ? { passwordHash } : {}),
      phone: phoneNorm,
      dob: dob === "" ? undefined : dob,
      gender,
      fcm_id,
      status: status || "active",
      profileImage: fromFile ?? profileImage ?? null,
    });
  } catch (err) {
    deleteUploadFileByPublicUrl(fromFile);
    throw err;
  }

  res.status(201).json({
    message: "User created",
    user: toPublicProfile(
      await User.findById(user._id).select("-passwordHash")
    ),
  });
});

exports.updateUser = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const {
    name,
    email,
    password,
    phone,
    dob,
    gender,
    fcm_id,
    profileImage,
    status,
  } = req.body;

  if (email !== undefined) {
    const emailNorm = normalizeRequired(email).toLowerCase();
    const taken = await User.findOne({
      email: emailNorm,
      _id: { $ne: user._id },
    });
    if (taken) {
      deleteUploadFileByPublicUrl(publicUploadPathFromFile(req, UPLOAD_FOLDER));
      throw new AppError("Email is already in use", 409);
    }
    user.email = emailNorm;
  }
  if (phone !== undefined) {
    const phoneNorm = normalizeRequired(phone);
    const existingPhone = await User.findOne({
      phone: phoneNorm,
      _id: { $ne: user._id },
    });
    if (existingPhone) {
      deleteUploadFileByPublicUrl(publicUploadPathFromFile(req, UPLOAD_FOLDER));
      throw new AppError("Phone number is already in use", 409);
    }
    user.phone = phoneNorm;
  }

  if (req.file) {
    deleteUploadFileByPublicUrl(user.profileImage);
    user.profileImage = publicUploadPathFromFile(req, UPLOAD_FOLDER);
  } else if (Object.prototype.hasOwnProperty.call(req.body, "profileImage")) {
    if (profileImage === "" || profileImage === null) {
      deleteUploadFileByPublicUrl(user.profileImage);
      user.profileImage = null;
    } else if (profileImage !== user.profileImage) {
      deleteUploadFileByPublicUrl(user.profileImage);
      user.profileImage = profileImage;
    }
  }

  if (name !== undefined) {
    user.name = normalizeRequired(name);
  }
  if (dob !== undefined) {
    user.dob = dob === "" ? null : dob;
  }
  if (gender !== undefined) {
    user.gender = gender;
  }
  if (fcm_id !== undefined) {
    user.fcm_id = fcm_id;
  }
  if (status !== undefined) {
    user.status = status;
  }
  if (password) {
    user.passwordHash = await hashPassword(password);
  }

  await user.save();
  res.json({
    message: "User updated",
    user: toPublicProfile(await User.findById(user._id).select("-passwordHash")),
  });
});

exports.deleteUser = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new AppError("User not found", 404);
  }
  deleteUploadFileByPublicUrl(user.profileImage);
  await User.findByIdAndDelete(req.params.id);
  res.json({ message: "User deleted" });
});
