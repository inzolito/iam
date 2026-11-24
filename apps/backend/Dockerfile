FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build
RUN test -f dist/main.js || (echo "ERROR: dist/main.js not found after build" && ls -la dist/ && exit 1)

RUN npm prune --omit=dev

ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "dist/main"]
