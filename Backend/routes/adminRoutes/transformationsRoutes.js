const express = require("express");
const { protectAdmin } = require("../../middleware/auth");
const { optionalTransformationFiles } = require("../../middleware/authMultipart");
const transformationController = require("../../controllers/adminControllers/transformationController");

const router = express.Router();

router.use(protectAdmin);

router.get("/", transformationController.listTransformations);
router.get("/:id", transformationController.getTransformationById);
router.post("/", optionalTransformationFiles, transformationController.createTransformation);
router.patch("/:id", optionalTransformationFiles, transformationController.updateTransformation);
router.delete("/:id", transformationController.deleteTransformation);

module.exports = router;
