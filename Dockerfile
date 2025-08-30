FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy only package.json and lock file first for better caching
COPY apps/api-server/package*.json ./

# Install dependencies
RUN npm install

# Copy the entire API server directory (including prisma/)
COPY apps/api-server ./

# 🔧 Prisma fix: Generate the client
RUN npx prisma generate

# Expose the port your app runs on
EXPOSE 3000

# Start the app
CMD ["node", "src/index.js"]
