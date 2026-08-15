# ---------- Build Stage ----------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for TypeScript compilation)
RUN npm install

# Copy source code and Prisma configuration
COPY . .

# Set a dummy DATABASE_URL for build-time Prisma Client generation
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build


# ---------- Production Stage ----------
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy package files and Prisma schema
COPY package*.json ./
COPY prisma.config.js ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm install --omit=dev

# Copy generated Prisma Client from builder stage
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copy built application code from builder stage
COPY --from=builder /app/dist ./dist

# Change ownership of /app to the node user for security
RUN chown -R node:node /app

# Run as non-root user
USER node

EXPOSE 3000

CMD ["npm", "start"]