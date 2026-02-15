FROM node:20-alpine

WORKDIR /app

# 依存パッケージを先にコピー（キャッシュ活用）
COPY package.json package-lock.json* ./
RUN npm install

# アプリケーションコードをコピー
COPY . .

# 開発用: Vite dev server（ホットリロード付き）
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
