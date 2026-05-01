const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: { type: String, default: null },

    phoneCountryCode: { type: String, trim: true, default: "+91" },
    phone: { type: String, required: true, trim: true },

    whatsappSameAsMobile: { type: Boolean, default: false },
    whatsappCountryCode: { type: String, trim: true, default: null },
    whatsappPhone: { type: String, trim: true, default: null },

    dob: { type: Date, default: null },

    gender: {
      type: String,
      enum: ["male", "female", "other", "boy", "girl", "guess"],
      default: "boy",
    },

    country: { type: String, trim: true, default: null },
    state: { type: String, trim: true, default: null },
    city: { type: String, trim: true, default: null },

    primaryHealthConcern: { type: String, trim: true, default: null },

    termsAccepted: { type: Boolean, default: false },
    termsAcceptedAt: { type: Date, default: null },

    phoneVerified: { type: Boolean, default: false },

    profileImage: { type: String, default: null },

    fcm_id: { type: String, default: null },

    otp: String,
    otpExpire: Date,
    resetPasswordToken: String,
    resetPasswordExpire: Date,

    status: {
      type: String,
      enum: ["active", "inactive", "blocked"],
      default: "active",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
