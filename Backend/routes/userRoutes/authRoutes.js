const express = require("express");
const authController = require("../../controllers/userControllers/authController");
const { protectUser } = require("../../middleware/auth");
const { optionalUserFile } = require("../../middleware/authMultipart");

const router = express.Router();

router.post("/register", optionalUserFile, authController.register);
router.post("/login", authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.get("/me", protectUser, authController.getMe);
router.patch("/me", protectUser, optionalUserFile, authController.updateMe);
router.delete("/me", protectUser, authController.deleteMe);

module.exports = router;
