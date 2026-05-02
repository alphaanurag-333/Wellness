const mongoose = require("mongoose");

const STATUS = ["active", "inactive"];

const transformationSchema = new mongoose.Schema(
  {
    timeTaken: { type: Number, required: true },
    achievements: { type: String, required: true, trim: true },
    oldImage: { type: String, required: true, trim: true },
    newImage: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    status: { type: String, enum: STATUS, default: "active" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("Transformation", transformationSchema);
