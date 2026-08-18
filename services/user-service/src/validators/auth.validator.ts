import { z } from 'zod';

export const signupSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').min(2, 'Name must be at least 2 characters').max(100, 'Name must not exceed 100 characters'),
    
    email: z.string().min(1, 'Email is required').email('Invalid email address'),
    
    password: z.string().min(1, 'Password is required').min(6, 'Password must be at least 6 characters'),
    
    phone: z.string().min(1, 'Phone number is required').regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format (must match E.164, e.g., +1234567890 or 1234567890)'),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    email: z.string().min(1, 'Email is required').email('Invalid email address'),
    
    otp: z.string().min(1, 'OTP is required').length(6, 'OTP must be exactly 6 digits').regex(/^\d+$/, 'OTP must contain digits only'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().min(1, 'Email is required').email('Invalid email address'),
    
    password: z.string().min(1, 'Password is required'),
    
    deviceName: z.string().optional(),
  }),
});

export const resendOtpSchema = z.object({
  body: z.object({
    email: z.string().min(1, 'Email is required').email('Invalid email address'),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional(),
  }),
});

export const googleLoginSchema = z.object({
  body: z.object({
    idToken: z.string().min(1, 'Google ID token is required'),
    deviceName: z.string().optional(),
  }),
});
