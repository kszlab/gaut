FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --chown=node:node server.mjs references.mjs reference-categories.mjs photos.mjs backup.mjs ./
COPY --chown=node:node site ./site
COPY --chown=node:node tools ./tools
COPY --chown=node:node seed ./seed
COPY --chown=node:node public ./public
RUN mkdir -p /app/data && chown node:node /app/data
ENV HOST=0.0.0.0 PORT=3000 DATA_DIR=/app/data
EXPOSE 3000
CMD ["node", "server.mjs"]
