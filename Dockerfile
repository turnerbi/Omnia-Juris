FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and install dependencies
COPY apps/api-server/package*.json ./
RUN npm install

# Copy everything (including prisma/ and src/)
COPY apps/api-server ./

# ⛏️ Generate Prisma Client
RUN npx prisma generate

# Expose app port
EXPOSE 3000

# Start server
CMD ["node", "src/index.js"]
