FROM node:22.19.0-bookworm-slim

ENV NODE_ENV=production \
    PORT=8080 \
    TESSERACT_PATH=/app

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && npm cache clean --force

COPY --chown=node:node . .

USER node
EXPOSE 8080

CMD ["node", "app.js"]
