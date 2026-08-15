# ---------- Build Stage ----------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for TypeScript compilation)
RUN npm install

# Copy source code (respecting .dockerignore)
COPY . .

# NOTE: If using Prisma, uncomment the lines below to generate the Prisma Client.
# Make sure to copy the prisma directory before running prisma generate if it exists.
# COPY prisma ./prisma/
# ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
# RUN npx prisma generate

# Build TypeScript application
RUN npm run build


# ---------- Production Stage ----------
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# NOTE: If using Prisma, uncomment the lines below to copy the schema and the generated client.
# COPY prisma ./prisma/
# COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
# COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copy built application code from builder stage
COPY --from=builder /app/dist ./dist

# Change ownership of /app to the node user for security
RUN chown -R node:node /app

# Run as non-root user
USER node

EXPOSE 3000

CMD ["npm", "start"]
