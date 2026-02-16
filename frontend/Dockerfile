# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# 依存パッケージを先にコピー（キャッシュ活用）
COPY package.json package-lock.json* ./
RUN npm install

# アプリケーションコードをコピー
COPY . .

# ビルド時環境変数（fly.toml の [build.args] から渡される）
ARG VITE_API_URL
ARG VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

RUN npm run build

# Serve stage
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
