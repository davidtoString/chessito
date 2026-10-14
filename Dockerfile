FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN CHESSITO_TARGET=node NEXT_TELEMETRY_DISABLED=1 node node_modules/next/dist/bin/next build --webpack

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/.next-production/standalone ./
COPY --from=build /app/.next-production/static ./.next-production/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY docker ./docker
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "docker/start.mjs"]
