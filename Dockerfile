FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN node scripts/build.mjs && node scripts/build-node.mjs

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/quotes.sqlite \
    TRUST_PROXY=true
WORKDIR /app
COPY --from=build --chown=node:node /app/generated/ssg ./generated/ssg
COPY --from=build --chown=node:node /app/generated/node-server.mjs ./generated/node-server.mjs
COPY --from=build --chown=node:node /app/drizzle ./drizzle
RUN mkdir -p /app/data && chown node:node /app/data
USER node
VOLUME ["/app/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "generated/node-server.mjs"]
