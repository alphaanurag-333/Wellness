const express = require("express");

const healthRoutes = require("./health.routes");
const userAuthRoutes = require("./userRoutes/authRoutes");
const userMiscRoutes = require("./userRoutes/miscRoutes");
const adminAuthRoutes = require("./adminRoutes/authRoutes");
const adminUsersRoutes = require("./adminRoutes/usersRoutes");
const adminMiscRoutes = require("./adminRoutes/miscRoutes");
const adminBannersRoutes = require("./adminRoutes/bannersRoutes");
const adminNotificationsRoutes = require("./adminRoutes/notificationsRoutes");
const adminFaqRoutes = require("./adminRoutes/faqRoutes");
const adminHealthConcernsRoutes = require("./adminRoutes/healthConcernsRoutes");
const adminTransformationsRoutes = require("./adminRoutes/transformationsRoutes");
const userTransformationsRoutes = require("./userRoutes/transformationsRoutes");
const publicRoutes = require("./publicRoutes");

const router = express.Router();

router.use("/health", healthRoutes);
router.use("/public", publicRoutes);
router.use("/user/auth", userAuthRoutes);
router.use("/user/misc", userMiscRoutes);
router.use("/user/transformations", userTransformationsRoutes);
router.use("/admin/auth", adminAuthRoutes);
router.use("/admin/users", adminUsersRoutes);
router.use("/admin/misc", adminMiscRoutes);
router.use("/admin/banners", adminBannersRoutes);
router.use("/admin/notifications", adminNotificationsRoutes);
router.use("/admin/faq", adminFaqRoutes);
router.use("/admin/health-concerns", adminHealthConcernsRoutes);
router.use("/admin/transformations", adminTransformationsRoutes);

module.exports = router;
