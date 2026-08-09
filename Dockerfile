# Stage 1: Build & Dependencies
FROM node:22-alpine AS builder
WORKDIR /app
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Install dependencies required for native modules & Prisma
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN cp prisma/schema.postgres.prisma prisma/schema.prisma && npx prisma generate

COPY . .
RUN mkdir -p public && npm run build

# Stage 2: Production Runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache openssl curl

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/start.sh ./start.sh
COPY --from=builder /app/openwa ./openwa

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/whatsapp/chats || exit 1

CMD ["npm", "start"]
