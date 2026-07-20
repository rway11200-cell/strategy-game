FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG RAILWAY_GIT_COMMIT_SHA
ARG RAILWAY_ENVIRONMENT_NAME
ARG RAILWAY_PROJECT_NAME
ARG RAILWAY_SERVICE_NAME

RUN npm run build

FROM busybox:1.37

WORKDIR /app

COPY --from=build /app/dist .

EXPOSE 3000

CMD ["sh", "-c", "httpd -f -p ${PORT:-3000}"]
