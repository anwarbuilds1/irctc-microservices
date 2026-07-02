# ---------- Build Stage ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Prune dev dependencies but keep production dependencies + generated prisma client
RUN npm prune --production


# ---------- Production Stage ----------
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy package files
COPY package*.json ./

# Copy node_modules from builder (includes production dependencies and generated prisma client)
COPY --from=builder /app/node_modules ./node_modules

# Copy build output
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["npm", "start"]