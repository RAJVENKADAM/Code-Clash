import { body, param, query, validationResult } from "express-validator";

export function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Validation failed",
      details: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
      })),
      requestId: req.requestId,
    });
  }
  next();
}

export const validateEmail = body("email")
  .isEmail()
  .normalizeEmail()
  .withMessage("Valid email is required");

export const validateOTP = body("otp")
  .isString()
  .isLength({ min: 6, max: 6 })
  .matches(/^\d{6}$/)
  .withMessage("OTP must be a 6-digit number");

export const validateUserId = body("userId")
  .isMongoId()
  .withMessage("Valid userId is required");

export const validateOrganization = body("organization")
  .optional({ values: "falsy" })
  .isString()
  .trim()
  .isLength({ min: 1, max: 120 })
  .withMessage("Organization must be between 1 and 120 characters");

export const validateChallengeId = param("challengeId")
  .isMongoId()
  .withMessage("Valid challengeId is required");

export const validateSubmissionId = param("submissionId")
  .isMongoId()
  .withMessage("Valid submissionId is required");

export const validateChallengeCreate = [
  body("title")
    .isString()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage("Title must be between 3 and 200 characters"),
  body("description")
    .isString()
    .trim()
    .isLength({ min: 10 })
    .withMessage("Description must be at least 10 characters"),
  body("testCases")
    .isArray({ min: 1 })
    .withMessage("At least one test case is required"),
  body("testCases.*.input")
    .isString()
    .notEmpty()
    .withMessage("Test case input is required"),
  body("testCases.*.expectedOutput")
    .isString()
    .notEmpty()
    .withMessage("Test case expected output is required"),
  body("difficulty")
    .optional()
    .isIn(["EASY", "MEDIUM", "HARD"])
    .withMessage("Difficulty must be EASY, MEDIUM, or HARD"),
];

export const validateCode = body("code")
  .isString()
  .isLength({ min: 1, max: 50000 })
  .withMessage("Code must be between 1 and 50000 characters");

export const validatePagination = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .toInt()
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .toInt()
    .withMessage("Limit must be between 1 and 100"),
];
