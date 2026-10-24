FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

# Dependencies are installed inside the image; nothing is needed on the host.
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src

USER node
EXPOSE 5000
CMD ["node", "src/server.js"]
