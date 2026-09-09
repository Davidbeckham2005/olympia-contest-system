# ---- Stage 1: build ----
FROM node:22-alpine AS build
WORKDIR /app

# Copy toàn bộ source (client phụ thuộc root package qua "cuoc-thi": "file:..")
COPY . .

# Cài dependencies root + client
RUN npm ci && npm ci --prefix client

# Build client (kết quả ở client/dist)
RUN npm run build

# ---- Stage 2: runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Chỉ copy phần cần thiết cho server → image nhỏ gọn
COPY --from=build /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/.env.example ./.env.example

# Thư mục dữ liệu & upload bền vững (mount volume từ docker-compose)
RUN mkdir -p /app/server/data /app/server/uploads

EXPOSE 3001

CMD ["node", "server/index.js"]
