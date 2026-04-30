const mongoose = require("mongoose");

const STATUS = ["active", "inactive"];

const bannerSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      required: true,
      enum: ["global", "city"],
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      required: true,
      trim: true,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    cities: [
      {
        type: String,
        trim: true,
      },
    ],
    status: {
      type: String,
      enum: STATUS,
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Banner", bannerSchema);
