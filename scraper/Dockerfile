FROM node:22-slim AS base
RUN npx playwright install --with-deps chromium

WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts

RUN npm ci --omit=dev
RUN npx prisma generate

COPY scraper/package*.json ./scraper/
RUN cd scraper && npm ci --omit=dev

COPY scraper/dist ./scraper/dist
COPY src/generated ./src/generated

CMD ["node", "scraper/dist/index.js"]
