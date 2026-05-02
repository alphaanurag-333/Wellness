const createUploader = require("../utils/fileUploader");

function optionalMultipart(uploadMiddleware) {
  return (req, res, next) => {
    if (req.is("multipart/form-data")) {
      return uploadMiddleware(req, res, next);
    }
    next();
  };
}

const userUpload = createUploader("user").single("file");
const adminUpload = createUploader("admin").single("file");
const categoryUpload = createUploader("category").single("file");
const subCategoryUpload = createUploader("sub-category").single("file");
const bannerUpload = createUploader("banner").single("file");
const promotionUpload = createUploader("promotion").single("file");
const notificationUpload = createUploader("notification").single("file");
const healthConcernUpload = createUploader("health-concern").single("file");
const transformationUpload = createUploader("transformation").fields([
  { name: "oldImage", maxCount: 1 },
  { name: "newImage", maxCount: 1 },
]);

exports.optionalUserFile = optionalMultipart(userUpload);
exports.optionalAdminFile = optionalMultipart(adminUpload);
exports.optionalCategoryFile = optionalMultipart(categoryUpload);
exports.optionalSubCategoryFile = optionalMultipart(subCategoryUpload);
exports.optionalBannerFile = optionalMultipart(bannerUpload);
exports.optionalPromotionFile = optionalMultipart(promotionUpload);
exports.optionalNotificationFile = optionalMultipart(notificationUpload);
exports.optionalHealthConcernFile = optionalMultipart(healthConcernUpload);
exports.optionalTransformationFiles = optionalMultipart(transformationUpload);
