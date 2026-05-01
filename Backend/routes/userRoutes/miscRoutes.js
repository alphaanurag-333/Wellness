const express = require("express");
const miscController = require("../../controllers/userControllers/miscController");

const router = express.Router();

router.get("/banners", miscController.getActiveBanners);
router.get("/pages", miscController.getActiveStaticPages);
router.get("/pages/slug/:slug", miscController.getActivePageBySlug);
router.get("/faqs", miscController.getActiveFaqs);

module.exports = router;
