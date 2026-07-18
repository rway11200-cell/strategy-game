FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG RAILWAY_GIT_COMMIT_SHA
ARG RAILWAY_ENVIRONMENT_NAME
ARG RAILWAY_PROJECT_NAME
ARG RAILWAY_SERVICE_NAME
ARG VITE_ENABLE_GAME_TEST_API

ENV VITE_ENABLE_GAME_TEST_API=${VITE_ENABLE_GAME_TEST_API:-false}
ENV PORT=${PORT:-4173}

EXPOSE 4173

# Dev mode: usa vite dev en vez de preview (más rápido, no requiere build)
CMD ["npm", "start"]
