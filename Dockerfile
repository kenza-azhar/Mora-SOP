# Build stage
FROM node:20 AS build

WORKDIR /app

# Use CI=true to prevent interactive prompts and ensure a clean build
ENV CI=true

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

# Expose port 3000 (Cloud Run & container default)
EXPOSE 3000

CMD ["node", "dist/server.cjs"]
