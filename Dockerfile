FROM node:22-alpine AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
RUN npm uninstall --ignore-scripts @vercel/blob @vercel/functions

FROM node:22-alpine

WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules

COPY index.html ./
COPY src ./src
COPY assets ./assets
COPY server.js ./

ENV NODE_ENV=production
ENV DATA_DIR=/data
EXPOSE 3000

CMD ["node", "server.js"]
