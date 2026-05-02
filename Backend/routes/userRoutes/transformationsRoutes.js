const express = require("express");
const { protectUser } = require("../../middleware/auth");
const { optionalTransformationFiles } = require("../../middleware/authMultipart");
const transformationController = require("../../controllers/userControllers/transformationController");

const router = express.Router();

router.get("/", transformationController.listActiveTransformations);

router.get("/my", protectUser, transformationController.listMyTransformations);
router.get("/my/:id", protectUser, transformationController.getMyTransformationById);
router.post("/my", protectUser, optionalTransformationFiles, transformationController.createMyTransformation);
router.patch("/my/:id", protectUser, optionalTransformationFiles, transformationController.updateMyTransformation);
router.delete("/my/:id", protectUser, transformationController.deleteMyTransformation);

router.get("/:id", transformationController.getActiveTransformationById);

module.exports = router;
