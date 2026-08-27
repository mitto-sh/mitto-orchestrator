FROM node:20-alpine AS lib-builder
WORKDIR /repo/mitto-lib-redis
COPY mitto-lib-redis/package.json mitto-lib-redis/package-lock.json ./
RUN npm ci
COPY mitto-lib-redis/ ./
RUN npm run build

FROM node:20-alpine AS builder
WORKDIR /repo/mitto-orchestrator
COPY mitto-orchestrator/package.json mitto-orchestrator/package-lock.json ./
COPY --from=lib-builder /repo/mitto-lib-redis /repo/mitto-lib-redis
RUN npm install --install-links
COPY mitto-orchestrator/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /repo/mitto-orchestrator/dist ./dist
COPY --from=builder /repo/mitto-orchestrator/node_modules ./node_modules
COPY --from=builder /repo/mitto-orchestrator/package.json ./package.json
EXPOSE 3003
CMD ["node", "dist/index.js"]
