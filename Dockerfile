# 스터디AI 운영 이미지 (Railway, Fly.io, 일반 서버 공용)
# node:sqlite를 쓰므로 Node 22.13 이상이 필요하다.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
# DB와 업로드 파일이 쌓이는 곳. 지워지지 않는 볼륨을 여기에 연결한다.
ENV DATA_DIR=/data
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
EXPOSE 3000
CMD ["node", "dist-server/index.js"]
