# syntax=docker/dockerfile:1
FROM node:22-alpine AS verified
WORKDIR /source
COPY package.json package-lock.json ./
RUN npm ci
COPY scripts/build-web.mjs ./scripts/build-web.mjs
COPY packages ./packages
COPY apps ./apps
COPY assets/cabo/reference-style/cabo-atlas-v1.png ./assets/cabo/reference-style/cabo-atlas-v1.png
COPY assets/dnd/manifest.json ./assets/dnd/manifest.json
COPY tests ./tests
RUN npm test
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime
LABEL org.opencontainers.image.title="Moon Table" \
      org.opencontainers.image.description="Multiplayer board games with friends, match records and cosmetic collections" \
      org.opencontainers.image.version="0.8.11"
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATA_FILE=/data/platform.json
WORKDIR /app
COPY --from=verified --chown=node:node /source/package.json ./
COPY --from=verified --chown=node:node /source/apps ./apps
COPY --from=verified --chown=node:node /source/packages ./packages
COPY --from=verified --chown=node:node /source/node_modules ./node_modules
COPY --from=verified --chown=node:node /source/assets ./assets
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "apps/server/index.js"]
