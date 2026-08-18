import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { prisma } from '../config/prisma';
import { redis } from '../config/redis';
import { EmailService } from '../services/email.service';
import crypto from 'crypto';

vi.mock('google-auth-library', () => {
  const verifyIdTokenMock = vi.fn().mockImplementation(async ({ idToken }) => {
    if (idToken === 'valid-google-token') {
      return {
        getPayload: () => ({
          email: 'google-user@example.com',
          name: 'Google User',
          email_verified: true,
          sub: 'google-sub-12345',
        }),
      };
    } else if (idToken === 'unverified-google-token') {
      return {
        getPayload: () => ({
          email: 'google-unverified@example.com',
          name: 'Google Unverified User',
          email_verified: false,
          sub: 'google-sub-67890',
        }),
      };
    } else {
      throw new Error('Invalid token signature');
    }
  });

  return {
    OAuth2Client: class {
      verifyIdToken = verifyIdTokenMock;
    },
  };
});

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

    it('should enforce a 1-minute cooldown between verification attempts', async () => {
      await request(app).post('/api/v1/auth/signup').send(mockUser);

      // 1. First failed attempt
      const res1 = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ email: mockUser.email, otp: '111111' });
      expect(res1.status).toBe(400);
      expect(res1.body.message).toBe('OTP has expired or is invalid');

      // 2. Second attempt immediately should hit the 1-minute cooldown lockout
      const res2 = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ email: mockUser.email, otp: '111111' });
      expect(res2.status).toBe(400);
      expect(res2.body.message).toContain('Please wait 1 minute');
    });

    it('should lock out after 5 verification attempts in 1 hour', async () => {
      await request(app).post('/api/v1/auth/signup').send(mockUser);

      // Send 5 invalid OTP attempts, manually deleting the 1-minute cooldown in Redis each time
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/api/v1/auth/verify-otp')
          .send({ email: mockUser.email, otp: '111111' });
        expect(res.status).toBe(400);
        // Clean the 1-minute verification cooldown key so we can try again
        await redis.del(`auth:otp:verify-cooldown:${mockUser.email}`);
      }

      // 6th attempt should block with "Too many OTP verification attempts"
      const response = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ email: mockUser.email, otp: '111111' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Too many OTP verification attempts');
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
      const userId = payload.userId;
      expect(sessionId).toBeDefined();
      expect(userId).toBeDefined();

      // Verify session exists in Redis
      const sessionData = await redis.get(`auth:session:${userId}:${sessionId}`);
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
      const userId = payload.userId;

      // 2. Logout
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify session is deleted from Redis
      const sessionExists = await redis.exists(`auth:session:${userId}:${sessionId}`);
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

  describe('Device Identification and Session Management', () => {
    it('should store parsed user agent and custom device name during login', async () => {
      // 1. Register & Verify
      await request(app).post('/api/v1/auth/signup').send(mockUser);
      const sentOtp = sendEmailSpy.mock.calls[0][1];
      await request(app).post('/api/v1/auth/verify-otp').send({ email: mockUser.email, otp: sentOtp });

      // 2. Login with user-agent and custom device name
      const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1';
      const customDeviceName = 'My iPhone 14';

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .set('User-Agent', userAgent)
        .send({
          email: mockUser.email,
          password: mockUser.password,
          deviceName: customDeviceName,
        });

      expect(loginRes.status).toBe(200);
      const accessToken = loginRes.body.data.accessToken;
      const tokenParts = accessToken.split('.');
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
      const sessionId = payload.sessionId;
      const userId = payload.userId;

      // 3. Verify Redis session stores user-agent & custom deviceName
      const sessionDataStr = await redis.get(`auth:session:${userId}:${sessionId}`);
      expect(sessionDataStr).not.toBeNull();
      const sessionData = JSON.parse(sessionDataStr!);
      expect(sessionData.userAgent).toBe(userAgent);
      expect(sessionData.deviceName).toBe(customDeviceName);
    });

    it('should fall back to parsed user agent if custom device name is not provided', async () => {
      await request(app).post('/api/v1/auth/signup').send(mockUser);
      const sentOtp = sendEmailSpy.mock.calls[0][1];
      await request(app).post('/api/v1/auth/verify-otp').send({ email: mockUser.email, otp: sentOtp });

      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';
      
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .set('User-Agent', userAgent)
        .send({
          email: mockUser.email,
          password: mockUser.password,
        });

      expect(loginRes.status).toBe(200);
      const accessToken = loginRes.body.data.accessToken;
      const tokenParts = accessToken.split('.');
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
      const sessionId = payload.sessionId;
      const userId = payload.userId;

      const sessionDataStr = await redis.get(`auth:session:${userId}:${sessionId}`);
      const sessionData = JSON.parse(sessionDataStr!);
      expect(sessionData.deviceName).toBe('Chrome on Windows');
    });

    it('should list all active sessions for the user and identify the current session', async () => {
      await request(app).post('/api/v1/auth/signup').send(mockUser);
      const sentOtp = sendEmailSpy.mock.calls[0][1];
      await request(app).post('/api/v1/auth/verify-otp').send({ email: mockUser.email, otp: sentOtp });

      // Login 1
      const loginRes1 = await request(app)
        .post('/api/v1/auth/login')
        .set('User-Agent', 'Mozilla/5.0 (Linux; Android 10) Chrome/114.0.0.0')
        .send({ email: mockUser.email, password: mockUser.password, deviceName: 'Android Phone' });

      // Login 2
      const loginRes2 = await request(app)
        .post('/api/v1/auth/login')
        .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15) Safari/16.5')
        .send({ email: mockUser.email, password: mockUser.password, deviceName: 'MacBook' });

      const accessToken2 = loginRes2.body.data.accessToken;

      // Get active sessions
      const sessionsRes = await request(app)
        .get('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${accessToken2}`);

      expect(sessionsRes.status).toBe(200);
      expect(sessionsRes.body.data).toHaveLength(2);

      // Verify the list has the devices and current session marked correctly
      const macSession = sessionsRes.body.data.find((s: any) => s.deviceName === 'MacBook');
      const androidSession = sessionsRes.body.data.find((s: any) => s.deviceName === 'Android Phone');
      
      expect(macSession).toBeDefined();
      expect(macSession.isCurrent).toBe(true);
      
      expect(androidSession).toBeDefined();
      expect(androidSession.isCurrent).toBe(false);
    });

    it('should allow revoking a specific session', async () => {
      await request(app).post('/api/v1/auth/signup').send(mockUser);
      const sentOtp = sendEmailSpy.mock.calls[0][1];
      await request(app).post('/api/v1/auth/verify-otp').send({ email: mockUser.email, otp: sentOtp });

      // Login 1
      const loginRes1 = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: mockUser.email, password: mockUser.password, deviceName: 'Device A' });
      const tokenParts1 = loginRes1.body.data.accessToken.split('.');
      const payload1 = JSON.parse(Buffer.from(tokenParts1[1], 'base64').toString());
      const sessionId1 = payload1.sessionId;

      // Login 2
      const loginRes2 = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: mockUser.email, password: mockUser.password, deviceName: 'Device B' });
      const accessToken2 = loginRes2.body.data.accessToken;

      // Revoke Device A using Device B's credentials
      const revokeRes = await request(app)
        .delete(`/api/v1/auth/sessions/${sessionId1}`)
        .set('Authorization', `Bearer ${accessToken2}`);

      expect(revokeRes.status).toBe(200);
      expect(revokeRes.body.message).toContain('revoked successfully');

      // Verify Device A session is deleted
      const sessionExists = await redis.exists(`auth:session:${payload1.userId}:${sessionId1}`);
      expect(sessionExists).toBe(0);
    });
  });

  describe('POST /api/v1/auth/google', () => {
    it('should successfully authenticate and register a new user using a valid Google ID token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/google')
        .send({
          idToken: 'valid-google-token',
          deviceName: 'Google Chrome Web',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Google login successful');
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.user.email).toBe('google-user@example.com');
      expect(response.body.data.user.name).toBe('Google User');

      // Verify user created in PostgreSQL
      const user = await prisma.user.findUnique({ where: { email: 'google-user@example.com' } });
      expect(user).toBeDefined();
      expect(user?.emailVerified).toBe(true);
      expect(user?.password).toBeNull();
      expect(user?.phone).toBeNull();
    });

    it('should successfully authenticate an existing user using a valid Google ID token', async () => {
      // 1. Create a user manually
      await prisma.user.create({
        data: {
          email: 'google-user@example.com',
          name: 'Google User Old Name',
          emailVerified: false,
        },
      });

      // 2. Perform Google Sign-In
      const response = await request(app)
        .post('/api/v1/auth/google')
        .send({
          idToken: 'valid-google-token',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Verify user is now verified
      const user = await prisma.user.findUnique({ where: { email: 'google-user@example.com' } });
      expect(user?.emailVerified).toBe(true);
      expect(user?.emailVerifiedAt).not.toBeNull();
    });

    it('should reject authentication if Google ID token is invalid', async () => {
      const response = await request(app)
        .post('/api/v1/auth/google')
        .send({
          idToken: 'invalid-token',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Google token verification failed');
    });

    it('should reject standard login if a Google-registered user has no password set', async () => {
      // 1. Sign up with Google to create the user
      await request(app)
        .post('/api/v1/auth/google')
        .send({
          idToken: 'valid-google-token',
        });

      // 2. Attempt standard password login
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'google-user@example.com',
          password: 'SomePassword123',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid email or password');
    });
  });
});
