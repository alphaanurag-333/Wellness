const mongoose = require("mongoose");
const config = require("./index");

const connectDatabase = async () => {
  if (!config.mongodbUri) {
    throw new Error(
      "MONGODB_URI is not set. Add it to your .env (see .env.example)."
    );
  }

  try {
    await mongoose.connect(config.mongodbUri);
    console.log("MongoDB connected successfully");
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
    throw err;
  }
};

module.exports = connectDatabase;
