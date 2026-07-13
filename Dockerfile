FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY package.json ./
RUN pnpm install
COPY . .
RUN pnpm build

EXPOSE 4173
CMD ["pnpm", "start"]
