FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data HOST=0.0.0.0
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
RUN mkdir -p /data && chown node:node /data
VOLUME /data
EXPOSE 3210
USER node
CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.ts"]
