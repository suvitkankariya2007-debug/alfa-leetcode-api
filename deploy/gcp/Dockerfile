# Portable runtime image. Build on GitHub Actions or an approved GCP builder.
# Deliberately no embedded secrets, credentials or startup migrations.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build && npm run build:mcp && npm test && node scripts/smoke-mcp.mjs
RUN npm prune --omit=dev --ignore-scripts

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
RUN groupadd -r mcp && useradd -r -g mcp -d /app mcp
COPY --from=build --chown=mcp:mcp /app/node_modules ./node_modules
COPY --from=build --chown=mcp:mcp /app/dist ./dist
COPY --from=build --chown=mcp:mcp /app/package.json ./package.json
USER mcp
EXPOSE 8080
CMD ["node","dist/mcp/hostedServer.js"]
