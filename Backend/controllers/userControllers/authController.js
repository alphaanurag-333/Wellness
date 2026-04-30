const crypto = require("crypto");
const { User } = require("../../models");
const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const { hashPassword, comparePassword } = require("../../utils/password");
const { signAccessToken } = require("../../utils/jwt");
const { toPublicProfile } = require("../../utils/toPublicProfile");
const { deleteUploadFileByPublicUrl } = require("../../utils/deleteUploadFile");

const USER_UPLOAD_DIR = "user";

function profilePathFromFile(req) {
  if (!req.file) {
    return undefined;
  }
  return `/uploads/${USER_UPLOAD_DIR}/${req.file.filename}`;
}

function assertUserCanLogin(user) {
  if (user.status === "blocked") {
    throw new AppError("Account is blocked", 403);
  }
  if (user.status === "inactive") {
    throw new AppError("Account is inactive", 403);
  }
}

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, dob, gender, fcm_id, profileImage } =
    req.body;

  if (!name || !email || !phone) {
    deleteUploadFileByPublicUrl(profilePathFromFile(req));
    throw new AppError("Name, email, and phone are required", 400);
  }

  const existing = await User.findOne({ email: String(email).toLowerCase() });
  if (existing) {
    deleteUploadFileByPublicUrl(profilePathFromFile(req));
    throw new AppError("Email is already registered", 409);
  }

  const passwordNorm = String(password ?? "").trim();
  const passwordHash = passwordNorm ? await hashPassword(passwordNorm) : undefined;
  const fromFile = profilePathFromFile(req);
  let user;
  try {
    user = await User.create({
      name,
      email,
      ...(passwordHash ? { passwordHash } : {}),
      phone,
      dob,
      gender,
      fcm_id,
      profileImage: fromFile ?? profileImage,
    });
  } catch (err) {
    deleteUploadFileByPublicUrl(fromFile);
    throw err;
  }

  const token = signAccessToken({ sub: user._id.toString(), role: "user" });

  res.status(201).json({
    message: "Registered successfully",
    user: toPublicProfile(user),
    token,
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
  }

  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  if (!user.passwordHash) {
    throw new AppError("Invalid email or password", 401);
  }

  const ok = await comparePassword(password, user.passwordHash);
  if (!ok) {
    throw new AppError("Invalid email or password", 401);
  }

  assertUserCanLogin(user);

  const token = signAccessToken({ sub: user._id.toString(), role: "user" });

  res.json({
    message: "Login successful",
    user: toPublicProfile(user),
    token,
  });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    throw new AppError("Email is required", 400);
  }

  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user) {
    res.json({
      message:
        "If an account exists for that email, password reset instructions have been sent.",
    });
    return;
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = resetToken;
  user.resetPasswordExpire = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  res.json({
    message:
      "If an account exists for that email, password reset instructions have been sent.",
    resetToken: process.env.NODE_ENV === "development" ? resetToken : undefined,
  });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    throw new AppError("Token and new password are required", 400);
  }

  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpire: { $gt: new Date() },
  });

  if (!user) {
    throw new AppError("Invalid or expired reset token", 400);
  }

  user.passwordHash = await hashPassword(password);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  res.json({ message: "Password has been reset" });
});

exports.getMe = asyncHandler(async (req, res) => {
  res.json({ user: toPublicProfile(req.user) });
});

exports.updateMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError("Account not found", 404);
  }

  const { name, phone, dob, gender, fcm_id, profileImage } = req.body;

  if (req.file) {
    deleteUploadFileByPublicUrl(user.profileImage);
    user.profileImage = profilePathFromFile(req);
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
    user.name = name;
  }
  if (phone !== undefined) {
    user.phone = phone;
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

  await user.save();
  const fresh = await User.findById(user._id).select("-passwordHash");
  res.json({
    message: "Profile updated",
    user: toPublicProfile(fresh),
  });
});

exports.deleteMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError("Account not found", 404);
  }
  deleteUploadFileByPublicUrl(user.profileImage);
  await User.findByIdAndDelete(req.user._id);
  res.json({ message: "Account deleted" });
});
