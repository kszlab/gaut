FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node package.json server.mjs references.mjs ./
COPY --chown=node:node seed ./seed
COPY --chown=node:node public ./public
RUN mkdir -p /app/data && chown node:node /app/data
ENV HOST=0.0.0.0 PORT=3000 DATA_DIR=/app/data
EXPOSE 3000
CMD ["node", "server.mjs"]
