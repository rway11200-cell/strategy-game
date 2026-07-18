FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG RAILWAY_GIT_COMMIT_SHA
ARG RAILWAY_ENVIRONMENT_NAME
ARG RAILWAY_PROJECT_NAME
ARG RAILWAY_SERVICE_NAME
ARG VITE_ENABLE_GAME_TEST_API

RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copiar Vite desde la etapa builder (necesario para npm start)
COPY --from=builder /app/node_modules/.bin/vite /app/node_modules/.bin/vite
COPY --from=builder /app/node_modules/vite /app/node_modules/vite

COPY --from=builder /app/dist ./dist

ARG RAILWAY_GIT_COMMIT_SHA
ARG RAILWAY_ENVIRONMENT_NAME
ARG RAILWAY_PROJECT_NAME
ARG RAILWAY_SERVICE_NAME
ARG VITE_ENABLE_GAME_TEST_API

ENV VITE_ENABLE_GAME_TEST_API=${VITE_ENABLE_GAME_TEST_API:-false}
ENV PORT=${PORT:-4173}

EXPOSE 4173

CMD ["npm", "start"]
