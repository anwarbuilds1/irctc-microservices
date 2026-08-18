import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import { requireAuth } from '../middlewares/auth.middleware';
import {
  signupSchema,
  verifyOtpSchema,
  resendOtpSchema,
  loginSchema,
  refreshTokenSchema,
  googleLoginSchema,
} from '../validators/auth.validator';

const router = Router();

router.post('/signup', validate(signupSchema), authController.signup);
router.post('/verify-otp', validate(verifyOtpSchema), authController.verifyOtp);
router.post('/resend-otp', validate(resendOtpSchema), authController.resendOtp);
router.post('/login', validate(loginSchema), authController.login);
router.post('/google', validate(googleLoginSchema), authController.googleLogin);
router.post('/logout', requireAuth, authController.logout);
router.post('/refresh', validate(refreshTokenSchema), authController.refresh);

// Device/Session Management Routes
router.get('/sessions', requireAuth, authController.getActiveSessions);
router.delete('/sessions/:sessionId', requireAuth, authController.revokeSession);

export default router;
