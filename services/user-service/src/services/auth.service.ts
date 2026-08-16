import crypto from 'crypto';
import { UserRepository } from '../repository/user.repository';
import { redis } from '../config/redis';
import { EmailService } from './email.service';
import { hashPassword, comparePassword } from '../utils/password';
import { generateAccessToken, generateRefreshToken, verifyToken, RefreshTokenPayload } from '../utils/jwt';
import {
  ConflictError,
  BadRequestError,
  NotFoundError,
  UnauthorizedError
} from '../utils/errors';
import { logger } from '../config/logger';

export class AuthService {
  private userRepository = new UserRepository();

  // TTL constants in seconds
  private readonly OTP_TTL = 300; // 5 minutes
  private readonly COOLDOWN_TTL = 60; // 1 minute
  private readonly SESSION_TTL = 604800; // 7 days (matches refresh token lifespan)
  private readonly MAX_OTP_ATTEMPTS = 5;
  private readonly HOURLY_LIMIT_TTL = 3600; // 1 hour
  private readonly VERIFY_COOLDOWN_TTL = 60; // 1 minute

  /**
   * Helper to generate a secure 6-digit OTP, store its SHA-256 hash in Redis, 
   * set a cooldown rate-limit, and send it to the user's email.
   */
  private async generateAndSendOtp(email: string): Promise<void> {
    const cooldownKey = `auth:otp:cooldown:${email}`;
    const otpKey = `auth:otp:signup:${email}`;
    const verifyCooldownKey = `auth:otp:verify-cooldown:${email}`;

    // 1. Cooldown Check (Rate Limiting)
    const onCooldown = await redis.exists(cooldownKey);
    if (onCooldown) {
      throw new BadRequestError('Please wait 60 seconds before requesting another OTP');
    }

    // 2. Generate a secure 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // 3. Hash OTP before storing
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    // 4. Save to Redis
    await Promise.all([
      redis.set(otpKey, hashedOtp, 'EX', this.OTP_TTL),
      redis.set(cooldownKey, '1', 'EX', this.COOLDOWN_TTL),
      redis.del(verifyCooldownKey), // Clear verification cooldown on new OTP request
    ]);

    // 5. Send OTP via EmailService (never log or return in response)
    await EmailService.sendOtpEmail(email, otp);
  }

  /**
   * Registers a new user.
   */
  public async signup(data: any): Promise<{ message: string; email: string }> {
    const { name, email, password, phone } = data;

    // 1. Check if email or phone already exists
    const existingEmail = await this.userRepository.findByEmail(email);
    if (existingEmail) {
      throw new ConflictError('Email or phone number is already registered');
    }

    const existingPhone = await this.userRepository.findByPhone(phone);
    if (existingPhone) {
      throw new ConflictError('Email or phone number is already registered');
    }

    // 2. Hash Password
    const hashedPassword = await hashPassword(password);

    // 3. Create User in PostgreSQL
    await this.userRepository.create({
      name,
      email,
      password: hashedPassword,
      phone,
      emailVerified: false,
    });

    // 4. Generate, Hash, Store and Send OTP
    await this.generateAndSendOtp(email);

    return {
      message: 'Signup successful. Verification OTP sent to email.',
      email,
    };
  }

  /**
   * Verifies the signup OTP.
   */
  public async verifyOtp(email: string, otp: string): Promise<{ message: string }> {
    const otpKey = `auth:otp:signup:${email}`;
    const hourlyAttemptsKey = `auth:otp:hourly-attempts:${email}`;
    const verifyCooldownKey = `auth:otp:verify-cooldown:${email}`;

    // 1. Find user
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestError('Email is already verified');
    }

    // 2. Cooldown Check: Must wait 1 minute between attempts
    const onVerifyCooldown = await redis.exists(verifyCooldownKey);
    if (onVerifyCooldown) {
      throw new BadRequestError('Please wait 1 minute before attempting verification again');
    }

    // 3. Hourly limit check: Max 5 attempts in 1 hour
    const hourlyAttemptsStr = await redis.get(hourlyAttemptsKey);
    const hourlyAttempts = hourlyAttemptsStr ? parseInt(hourlyAttemptsStr, 10) : 0;
    if (hourlyAttempts >= this.MAX_OTP_ATTEMPTS) {
      throw new BadRequestError('Too many OTP verification attempts. Please try again after 1 hour.');
    }

    // 4. Retrieve hashed OTP
    const storedHashedOtp = await redis.get(otpKey);
    if (!storedHashedOtp) {
      await this.handleFailedVerificationAttempt(email, hourlyAttemptsKey, verifyCooldownKey);
      throw new BadRequestError('OTP has expired or is invalid');
    }

    // 5. Hash input OTP & compare securely using timingSafeEqual
    const incomingHashed = crypto.createHash('sha256').update(otp).digest('hex');
    const buffer1 = Buffer.from(incomingHashed, 'hex');
    const buffer2 = Buffer.from(storedHashedOtp, 'hex');

    const isValid = buffer1.length === buffer2.length && crypto.timingSafeEqual(buffer1, buffer2);

    if (!isValid) {
      await this.handleFailedVerificationAttempt(email, hourlyAttemptsKey, verifyCooldownKey);
      throw new BadRequestError('OTP has expired or is invalid');
    }

    // 6. Success cleanup and user verification
    await Promise.all([
      redis.del(otpKey),
      redis.del(hourlyAttemptsKey),
      redis.del(verifyCooldownKey),
      redis.del(`auth:otp:cooldown:${email}`),
    ]);

    await this.userRepository.update(user.id, {
      emailVerified: true,
      emailVerifiedAt: new Date(),
    });

    return {
      message: 'Email verified successfully. You can now log in.',
    };
  }

  /**
   * Helper to handle failed OTP verification attempts:
   * Increments the hourly counter and sets a 1-minute cooldown.
   */
  private async handleFailedVerificationAttempt(
    email: string,
    hourlyAttemptsKey: string,
    verifyCooldownKey: string
  ): Promise<void> {
    const attempts = await redis.incr(hourlyAttemptsKey);
    if (attempts === 1) {
      await redis.expire(hourlyAttemptsKey, this.HOURLY_LIMIT_TTL);
    }
    await redis.set(verifyCooldownKey, '1', 'EX', this.VERIFY_COOLDOWN_TTL);
  }

  /**
   * Resends the verification OTP.
   */
  public async resendOtp(email: string): Promise<{ message: string }> {
    // 1. Check if user exists
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // 2. Verify email is not already verified
    if (user.emailVerified) {
      throw new BadRequestError('Email is already verified');
    }

    // 3. Generate, Hash, Store and Send new OTP (handles cooldown internally)
    await this.generateAndSendOtp(email);

    return {
      message: 'A new verification OTP has been sent to your email.',
    };
  }

  /**
   * Logs in a verified user.
   */
  public async login(data: any): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; name: string; email: string; role: string };
  }> {
    const { email, password } = data;

    // 1. Find user (generic credentials error for security)
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // 2. Compare password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // 3. Ensure email is verified
    if (!user.emailVerified) {
      throw new UnauthorizedError('Email is not verified. Please verify your email first.');
    }

    // 4. Establish Session in Redis
    const sessionId = crypto.randomUUID();
    const sessionKey = `auth:session:${sessionId}`;
    const sessionData = JSON.stringify({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    await redis.set(sessionKey, sessionData, 'EX', this.SESSION_TTL);

    // 5. Generate Access & Refresh Tokens (JWT)
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      sessionId,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * Logs out an authenticated user by deleting their session from Redis.
   */
  public async logout(sessionId: string): Promise<{ message: string }> {
    await redis.del(`auth:session:${sessionId}`);
    return {
      message: 'Logged out successfully.',
    };
  }

  /**
   * Refreshes access token using a valid refresh token.
   */
  public async refresh(token: string): Promise<{ accessToken: string; refreshToken: string }> {
    // 1. Verify Refresh Token JWT signature/expiration
    const decoded = verifyToken<RefreshTokenPayload>(token);

    // 2. Verify Session exists in Redis
    const sessionKey = `auth:session:${decoded.sessionId}`;
    const sessionDataStr = await redis.get(sessionKey);
    if (!sessionDataStr) {
      throw new UnauthorizedError('Session has expired or is invalid. Please log in again.');
    }

    const sessionData = JSON.parse(sessionDataStr);

    // 3. Keep the session alive (reset TTL)
    await redis.expire(sessionKey, this.SESSION_TTL);

    // 4. Generate new Access and Refresh tokens
    const newAccessToken = generateAccessToken({
      userId: sessionData.userId,
      email: sessionData.email,
      role: sessionData.role,
      sessionId: decoded.sessionId,
    });

    const newRefreshToken = generateRefreshToken({
      userId: sessionData.userId,
      sessionId: decoded.sessionId,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }
}
