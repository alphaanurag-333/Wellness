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

const GENDERS = ["male", "female", "other", "boy", "girl", "guess"];

function normalizeRequired(value) {
  return String(value ?? "").trim();
}

function normalizeOptional(value) {
  const s = String(value ?? "").trim();
  return s === "" ? null : s;
}

function normalizeEmail(value) {
  const s = String(value ?? "").trim().toLowerCase();
  return s === "" ? null : s;
}

function assertGender(value) {
  if (value === undefined || value === null || value === "") {
    return;
  }
  if (!GENDERS.includes(value)) {
    throw new AppError("Invalid gender", 400);
  }
}

exports.listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { status, search } = req.query;

  const filter = {};
  if (status) {
    filter.status = status;
  }
  const searchOr = searchFilter(search, [
    "name",
    "email",
    "phone",
    "phoneCountryCode",
    "whatsappPhone",
    "country",
    "state",
    "city",
    "primaryHealthConcern",
  ]);
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
    phoneCountryCode,
    phone,
    whatsappSameAsMobile,
    whatsappCountryCode,
    whatsappPhone,
    dob,
    gender,
    country,
    state,
    city,
    primaryHealthConcern,
    termsAccepted,
    termsAcceptedAt,
    phoneVerified,
    fcm_id,
    profileImage,
    status,
  } = req.body;

  const nameNorm = normalizeRequired(name);
  const phoneNorm = normalizeRequired(phone);
  const emailNorm = normalizeEmail(email);
  const phoneCcNorm = normalizeOptional(phoneCountryCode) || "+91";

  if (!nameNorm || !phoneNorm) {
    deleteUploadFileByPublicUrl(publicUploadPathFromFile(req, UPLOAD_FOLDER));
    throw new AppError("Name and phone are required", 400);
  }

  assertGender(gender);

  if (emailNorm) {
    const existing = await User.findOne({ email: emailNorm });
    if (existing) {
      deleteUploadFileByPublicUrl(publicUploadPathFromFile(req, UPLOAD_FOLDER));
      throw new AppError("Email is already in use", 409);
    }
  }

  const existingPhone = await User.findOne({
    phoneCountryCode: phoneCcNorm,
    phone: phoneNorm,
  });
  if (existingPhone) {
    deleteUploadFileByPublicUrl(publicUploadPathFromFile(req, UPLOAD_FOLDER));
    throw new AppError("Phone number is already in use", 409);
  }

  const sameWa = Boolean(whatsappSameAsMobile);
  let waCc = normalizeOptional(whatsappCountryCode);
  let waPhone = normalizeOptional(whatsappPhone);
  if (sameWa) {
    waCc = phoneCcNorm;
    waPhone = phoneNorm;
  }

  const termsOn = Boolean(termsAccepted);
  const termsAt =
    termsOn && termsAcceptedAt
      ? new Date(termsAcceptedAt)
      : termsOn
        ? new Date()
        : null;

  const fromFile = publicUploadPathFromFile(req, UPLOAD_FOLDER);
  const passwordNorm = String(password ?? "").trim();
  const passwordHash = passwordNorm ? await hashPassword(passwordNorm) : undefined;
  let user;
  try {
    user = await User.create({
      name: nameNorm,
      ...(emailNorm ? { email: emailNorm } : {}),
      ...(passwordHash ? { passwordHash } : {}),
      phoneCountryCode: phoneCcNorm,
      phone: phoneNorm,
      whatsappSameAsMobile: sameWa,
      whatsappCountryCode: waCc,
      whatsappPhone: waPhone,
      dob: dob === "" || dob === undefined ? undefined : dob,
      ...(gender !== undefined && gender !== "" ? { gender } : {}),
      country: normalizeOptional(country),
      state: normalizeOptional(state),
      city: normalizeOptional(city),
      primaryHealthConcern: normalizeOptional(primaryHealthConcern),
      termsAccepted: termsOn,
      termsAcceptedAt: termsAt,
      ...(phoneVerified !== undefined ? { phoneVerified: Boolean(phoneVerified) } : {}),
      fcm_id: normalizeOptional(fcm_id),
      status: status || "active",
      profileImage: fromFile ?? normalizeOptional(profileImage),
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
    phoneCountryCode,
    phone,
    whatsappSameAsMobile,
    whatsappCountryCode,
    whatsappPhone,
    dob,
    gender,
    country,
    state,
    city,
    primaryHealthConcern,
    termsAccepted,
    termsAcceptedAt,
    phoneVerified,
    fcm_id,
    profileImage,
    status,
  } = req.body;

  if (email !== undefined) {
    const emailNorm = normalizeEmail(email);
    if (!emailNorm) {
      user.set("email", undefined);
    } else {
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
  }

  const nextCc =
    phoneCountryCode !== undefined
      ? normalizeOptional(phoneCountryCode) || "+91"
      : user.phoneCountryCode || "+91";
  const nextPhone =
    phone !== undefined ? normalizeRequired(phone) : user.phone;

  if (phone !== undefined || phoneCountryCode !== undefined) {
    if (!nextPhone) {
      deleteUploadFileByPublicUrl(publicUploadPathFromFile(req, UPLOAD_FOLDER));
      throw new AppError("Phone is required", 400);
    }
    const existingPhone = await User.findOne({
      phoneCountryCode: nextCc,
      phone: nextPhone,
      _id: { $ne: user._id },
    });
    if (existingPhone) {
      deleteUploadFileByPublicUrl(publicUploadPathFromFile(req, UPLOAD_FOLDER));
      throw new AppError("Phone number is already in use", 409);
    }
    user.phoneCountryCode = nextCc;
    user.phone = nextPhone;
  }

  if (whatsappSameAsMobile !== undefined) {
    user.whatsappSameAsMobile = Boolean(whatsappSameAsMobile);
  }
  if (user.whatsappSameAsMobile) {
    user.whatsappCountryCode = user.phoneCountryCode || "+91";
    user.whatsappPhone = user.phone;
  } else {
    if (whatsappCountryCode !== undefined) {
      user.whatsappCountryCode = normalizeOptional(whatsappCountryCode);
    }
    if (whatsappPhone !== undefined) {
      user.whatsappPhone = normalizeOptional(whatsappPhone);
    }
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
    if (!user.name) {
      throw new AppError("Name is required", 400);
    }
  }
  if (dob !== undefined) {
    user.dob = dob === "" ? null : dob;
  }
  if (gender !== undefined) {
    if (gender === "" || gender === null) {
      user.gender = "boy";
    } else {
      assertGender(gender);
      user.gender = gender;
    }
  }
  if (country !== undefined) {
    user.country = normalizeOptional(country);
  }
  if (state !== undefined) {
    user.state = normalizeOptional(state);
  }
  if (city !== undefined) {
    user.city = normalizeOptional(city);
  }
  if (primaryHealthConcern !== undefined) {
    user.primaryHealthConcern = normalizeOptional(primaryHealthConcern);
  }

  if (termsAccepted !== undefined) {
    const nextTerms = Boolean(termsAccepted);
    const wasAccepted = user.termsAccepted;
    user.termsAccepted = nextTerms;
    if (!nextTerms) {
      user.termsAcceptedAt = null;
    } else if (!wasAccepted) {
      user.termsAcceptedAt = termsAcceptedAt
        ? new Date(termsAcceptedAt)
        : new Date();
    } else if (termsAcceptedAt !== undefined) {
      user.termsAcceptedAt = termsAcceptedAt
        ? new Date(termsAcceptedAt)
        : user.termsAcceptedAt;
    }
  } else if (termsAcceptedAt !== undefined) {
    user.termsAcceptedAt = termsAcceptedAt ? new Date(termsAcceptedAt) : null;
  }

  if (phoneVerified !== undefined) {
    user.phoneVerified = Boolean(phoneVerified);
  }
  if (fcm_id !== undefined) {
    user.fcm_id = normalizeOptional(fcm_id);
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
