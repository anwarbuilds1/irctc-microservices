import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { prisma } from '../config/prisma';
import { redis } from '../config/redis';
import { EmailService } from '../services/email.service';
import crypto from 'crypto';

describe('Authentication Flow Integration Tests', () => {
  let sendEmailSpy: any;

  beforeAll(async () => {
    // Spy on EmailService.sendOtpEmail and prevent actual mail sending
    sendEmailSpy = vi.spyOn(EmailService, 'sendOtpEmail').mockResolvedValue(undefined);
  });

  beforeEach(async () => {
    // Clear test database and Redis sessions/OTPs
    await prisma.user.deleteMany({});
    
    const keys = await redis.keys('auth:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    
    sendEmailSpy.mockClear();
  });

  afterAll(async () => {
    // Close Prisma and Redis connections after all tests finish
    await prisma.$disconnect();
    await redis.quit();
  });

  const mockUser = {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'Password123',
    phone: '9876543210',
  };

  describe('POST /api/v1/auth/signup', () => {
    it('should register a new user, generate an OTP, and send an email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/signup')
        .send(mockUser);

      if (response.status !== 201) {
        console.log('Signup error response:', response.body);
      }

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Verification OTP sent');
      expect(response.body.data.email).toBe(mockUser.email);

      // Verify user created in PostgreSQL
      const user = await prisma.user.findUnique({ where: { email: mockUser.email } });
      expect(user).toBeDefined();
      expect(user?.emailVerified).toBe(false);

      // Verify OTP is generated and sent via EmailService
      expect(sendEmailSpy).toHaveBeenCalledTimes(1);
      expect(sendEmailSpy.mock.calls[0][0]).toBe(mockUser.email);
      const sentOtp = sendEmailSpy.mock.calls[0][1];
      expect(sentOtp).toHaveLength(6);

      // Verify OTP is stored HASHED in Redis
      const storedHashedOtp = await redis.get(`auth:otp:signup:${mockUser.email}`);
      expect(storedHashedOtp).toBeDefined();
      
      const expectedHash = crypto.createHash('sha256').update(sentOtp).digest('hex');
      expect(storedHashedOtp).toBe(expectedHash);

      // Verify OTP TTL (max 300 seconds / 5 minutes)
      const ttl = await redis.ttl(`auth:otp:signup:${mockUser.email}`);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(300);
    });

    it('should reject registration if email is duplicate', async () => {
      // Create first user
      await request(app).post('/api/v1/auth/signup').send(mockUser);

      // Attempt second registration with same email
      const response = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          ...mockUser,
          phone: '9876543211', // different phone
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Email or phone number is already registered');
    });

    it('should reject registration if fields are invalid', async () => {
      const response = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          name: '',
          email: 'invalid-email',
          password: '123',
          phone: 'abc',
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/auth/verify-otp', () => {
    it('should successfully verify email with a valid OTP', async () => {
      // 1. Signup
      await request(app).post('/api/v1/auth/signup').send(mockUser);
      const sentOtp = sendEmailSpy.mock.calls[0][1];

      // 2. Verify
      const response = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({
          email: mockUser.email,
          otp: sentOtp,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('verified successfully');

      // Verify email status is updated in PostgreSQL
      const user = await prisma.user.findUnique({ where: { email: mockUser.email } });
      expect(user?.emailVerified).toBe(true);
      expect(user?.emailVerifiedAt).not.toBeNull();

      // Verify OTP is deleted from Redis
      const storedHashedOtp = await redis.get(`auth:otp:signup:${mockUser.email}`);
      expect(storedHashedOtp).toBeNull();
    });

    it('should fail verification with an invalid OTP', async () => {
      await request(app).post('/api/v1/auth/signup').send(mockUser);

      const response = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({
          email: mockUser.email,
          otp: '000000', // incorrect OTP
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('OTP has expired or is invalid');
    });

    it('should lock out after too many invalid OTP attempts', async () => {
      await request(app).post('/api/v1/auth/signup').send(mockUser);

      // Send 6 invalid OTP attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/auth/verify-otp')
          .send({ email: mockUser.email, otp: '111111' });
      }

      // 6th attempt should return rate/attempt limit error and delete OTP
      const response = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ email: mockUser.email, otp: '111111' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Too many invalid attempts');

      // Verify OTP was deleted from Redis
      const storedHashedOtp = await redis.get(`auth:otp:signup:${mockUser.email}`);
      expect(storedHashedOtp).toBeNull();
    });
  });

  describe('POST /api/v1/auth/resend-otp', () => {
    it('should invalidate old OTP, generate a new one, and reset TTL', async () => {
      // 1. Signup
      await request(app).post('/api/v1/auth/signup').send(mockUser);
      const firstOtp = sendEmailSpy.mock.calls[0][1];
      const firstOtpHash = crypto.createHash('sha256').update(firstOtp).digest('hex');

      // Delete the cooldown in Redis so we can resend immediately
      await redis.del(`auth:otp:cooldown:${mockUser.email}`);

      // 2. Resend OTP
      const response = await request(app)
        .post('/api/v1/auth/resend-otp')
        .send({ email: mockUser.email });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(sendEmailSpy).toHaveBeenCalledTimes(2);
      const secondOtp = sendEmailSpy.mock.calls[1][1];
      expect(secondOtp).not.toBe(firstOtp);

      // Verify old OTP is invalidated (new hash stored in Redis)
      const storedHash = await redis.get(`auth:otp:signup:${mockUser.email}`);
      expect(storedHash).not.toBe(firstOtpHash);
      const expectedSecondHash = crypto.createHash('sha256').update(secondOtp).digest('hex');
      expect(storedHash).toBe(expectedSecondHash);

      // Check verify with old OTP fails
      const verifyOldResponse = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ email: mockUser.email, otp: firstOtp });
      
      expect(verifyOldResponse.status).toBe(400);
    });

    it('should enforce 60-second cooldown rate limit for resending OTP', async () => {
      await request(app).post('/api/v1/auth/signup').send(mockUser);

      // Attempt to resend immediately (without deleting cooldown key)
      const response = await request(app)
        .post('/api/v1/auth/resend-otp')
        .send({ email: mockUser.email });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Please wait 60 seconds');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should allow login for verified users and establish a Redis session', async () => {
      // 1. Signup & Verify
      await request(app).post('/api/v1/auth/signup').send(mockUser);
      const sentOtp = sendEmailSpy.mock.calls[0][1];
      await request(app).post('/api/v1/auth/verify-otp').send({ email: mockUser.email, otp: sentOtp });

      // 2. Login
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: mockUser.email,
          password: mockUser.password,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.user.email).toBe(mockUser.email);
      expect(response.headers['set-cookie']).toBeDefined(); // Refresh token cookie

      // Parse accessToken payload to get sessionId
      const tokenParts = response.body.data.accessToken.split('.');
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
      const sessionId = payload.sessionId;
      expect(sessionId).toBeDefined();

      // Verify session exists in Redis
      const sessionData = await redis.get(`auth:session:${sessionId}`);
      expect(sessionData).not.toBeNull();
      expect(JSON.parse(sessionData!)).toMatchObject({
        email: mockUser.email,
        role: 'USER',
      });
    });

    it('should reject login for unverified users', async () => {
      await request(app).post('/api/v1/auth/signup').send(mockUser);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: mockUser.email,
          password: mockUser.password,
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Email is not verified');
    });

    it('should reject login with wrong password', async () => {
      await request(app).post('/api/v1/auth/signup').send(mockUser);
      const sentOtp = sendEmailSpy.mock.calls[0][1];
      await request(app).post('/api/v1/auth/verify-otp').send({ email: mockUser.email, otp: sentOtp });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: mockUser.email,
          password: 'WrongPassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid email or password');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should clear Redis session and log out the user', async () => {
      // 1. Register & Verify & Login
      await request(app).post('/api/v1/auth/signup').send(mockUser);
      const sentOtp = sendEmailSpy.mock.calls[0][1];
      await request(app).post('/api/v1/auth/verify-otp').send({ email: mockUser.email, otp: sentOtp });
      
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: mockUser.email, password: mockUser.password });

      const accessToken = loginRes.body.data.accessToken;
      const tokenParts = accessToken.split('.');
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
      const sessionId = payload.sessionId;

      // 2. Logout
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify session is deleted from Redis
      const sessionExists = await redis.exists(`auth:session:${sessionId}`);
      expect(sessionExists).toBe(0);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should issue new access and refresh tokens using valid refresh token', async () => {
      // 1. Register & Verify & Login
      await request(app).post('/api/v1/auth/signup').send(mockUser);
      const sentOtp = sendEmailSpy.mock.calls[0][1];
      await request(app).post('/api/v1/auth/verify-otp').send({ email: mockUser.email, otp: sentOtp });
      
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: mockUser.email, password: mockUser.password });

      const refreshToken = loginRes.body.data.refreshToken;

      // Wait 1 second so that JWT iat (issued at) changes
      await new Promise((resolve) => setTimeout(resolve, 1005));

      // 2. Refresh
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.accessToken).not.toBe(loginRes.body.data.accessToken);
    });
  });
});
