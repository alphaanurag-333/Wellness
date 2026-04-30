const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },

    email: { type: String, required: true, unique: true, lowercase: true, trim: true },

    passwordHash: { type: String, default: null },

    phone: { type: String, required: true, trim: true },

    dob: { type: Date },

    gender: {
        type: String,
        enum: ["male", "female", "other"],
        default: "male"
    },

    profileImage: { type: String, default: null },

    fcm_id: { type: String, default: null },

    otp: String,
    otpExpire: Date,
    resetPasswordToken: String,
    resetPasswordExpire: Date,

    status: {
        type: String,
        enum: ["active", "inactive", "blocked"],
        default: "active"
    }

}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);