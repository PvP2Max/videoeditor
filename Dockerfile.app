FROM oven/bun:1.3.2 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.3.2 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN bun run prisma:generate
RUN bun run build

FROM oven/bun:1.3.2 AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/app/prisma ./app/prisma
COPY --from=builder /app/scripts/start-app.sh ./start-app.sh
RUN chmod +x ./start-app.sh
EXPOSE 3000
CMD ["./start-app.sh"]
