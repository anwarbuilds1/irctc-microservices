import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'IRCTC Microservices - User Service API',
    version: '1.0.0',
    description: 'Production-ready authentication and profile management API featuring OTP-based email verification, Redis sessions, and JWT rotation.',
    contact: {
      name: 'Engineering Team',
      email: 'engineering@irctc.local',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development server',
    },
  ],
  paths: {
    '/api/v1/auth/signup': {
      post: {
        summary: 'Register a new user',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SignupInput',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'User registered successfully, OTP sent to email',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiResponse',
                },
              },
            },
          },
          '409': {
            description: 'Conflict (Email or phone already registered)',
          },
          '422': {
            description: 'Validation failed',
          },
        },
      },
    },
    '/api/v1/auth/verify-otp': {
      post: {
        summary: 'Verify signup email with OTP',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/VerifyOtpInput',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Email verified successfully',
          },
          '400': {
            description: 'Invalid or expired OTP, or too many invalid attempts',
          },
          '404': {
            description: 'User not found',
          },
        },
      },
    },
    '/api/v1/auth/resend-otp': {
      post: {
        summary: 'Resend verification OTP',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ResendOtpInput',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'New OTP sent to email',
          },
          '400': {
            description: 'Resend cooldown active (wait 60 seconds)',
          },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        summary: 'Log in a verified user',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/LoginInput',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful. Session created, HTTP cookies set.',
            headers: {
              'Set-Cookie': {
                description: 'Contains secure, httpOnly refreshToken',
                schema: {
                  type: 'string',
                },
              },
            },
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Login successful' },
                    data: {
                      type: 'object',
                      properties: {
                        accessToken: { type: 'string' },
                        refreshToken: { type: 'string' },
                        user: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                            email: { type: 'string' },
                            role: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Invalid credentials or email unverified',
          },
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        summary: 'Log out user / Invalidate session',
        tags: ['Authentication'],
        security: [
          {
            bearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Logged out successfully',
          },
          '401': {
            description: 'Unauthorized (Missing or invalid access token)',
          },
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        summary: 'Rotate tokens and extend session',
        tags: ['Authentication'],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  refreshToken: { type: 'string', description: 'Can also be supplied via cookie' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Tokens rotated successfully',
            headers: {
              'Set-Cookie': {
                description: 'Contains rotated secure, httpOnly refreshToken',
                schema: {
                  type: 'string',
                },
              },
            },
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Tokens refreshed successfully' },
                    data: {
                      type: 'object',
                      properties: {
                        accessToken: { type: 'string' },
                        refreshToken: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Missing refresh token',
          },
          '401': {
            description: 'Invalid or expired session',
          },
        },
      },
    },
    '/api/v1/auth/sessions': {
      get: {
        summary: 'Get all active sessions/devices for the logged-in user',
        tags: ['Authentication'],
        security: [
          {
            bearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Active sessions retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Active sessions retrieved successfully' },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          sessionId: { type: 'string', example: '8c14f4e6-322b-4f21-90d1-7f222f397e26' },
                          deviceName: { type: 'string', example: 'Chrome on Linux' },
                          ipAddress: { type: 'string', example: '127.0.0.1' },
                          createdAt: { type: 'string', format: 'date-time', example: '2026-08-17T18:19:46.570Z' },
                          lastActiveAt: { type: 'string', format: 'date-time', example: '2026-08-17T18:19:46.570Z' },
                          isCurrent: { type: 'boolean', example: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized (Missing or invalid access token)',
          },
        },
      },
    },
    '/api/v1/auth/sessions/{sessionId}': {
      delete: {
        summary: 'Revoke (delete) a specific session/device',
        tags: ['Authentication'],
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'sessionId',
            in: 'path',
            required: true,
            description: 'The ID of the session to revoke',
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Session revoked successfully',
          },
          '400': {
            description: 'Missing session ID',
          },
          '401': {
            description: 'Unauthorized (Missing or invalid access token)',
          },
          '404': {
            description: 'Session not found or already expired',
          },
        },
      },
    },
    '/api/v1/health': {
      get: {
        summary: 'Check API and service health',
        tags: ['Utility'],
        responses: {
          '200': {
            description: 'Service is healthy',
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide your short-lived Access Token in the Authorization header: Bearer <token>',
      },
    },
    schemas: {
      SignupInput: {
        type: 'object',
        required: ['name', 'email', 'password', 'phone'],
        properties: {
          name: { type: 'string', example: 'Jane Doe' },
          email: { type: 'string', format: 'email', example: 'jane@example.com' },
          password: { type: 'string', minLength: 6, example: 'SecurePassword123' },
          phone: { type: 'string', example: '9876543210' },
        },
      },
      VerifyOtpInput: {
        type: 'object',
        required: ['email', 'otp'],
        properties: {
          email: { type: 'string', format: 'email', example: 'jane@example.com' },
          otp: { type: 'string', pattern: '^\\d{6}$', example: '123456' },
        },
      },
      ResendOtpInput: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email', example: 'jane@example.com' },
        },
      },
      LoginInput: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'jane@example.com' },
          password: { type: 'string', example: 'SecurePassword123' },
          deviceName: { type: 'string', example: 'My iPhone 14' },
        },
      },
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Success message detail' },
          data: { type: 'object' },
        },
      },
    },
  },
};

/**
 * Sets up Swagger route handler on the Express router.
 */
export const setupSwagger = (router: Router): void => {
  router.use('/docs', swaggerUi.serve);
  router.get('/docs', swaggerUi.setup(swaggerDocument));
};
