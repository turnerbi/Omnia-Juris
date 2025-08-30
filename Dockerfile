FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package files and source code
COPY apps/api-server/package*.json ./
COPY apps/api-server ./

# Copy the Prisma schema (important!)
COPY apps/api-server/prisma ./prisma

# Install dependencies
RUN npm install --production || true

# Generate the Prisma client
RUN npx prisma generate

# Expose port configured in environment
EXPOSE 3000

# Start the API server
CMD ["node", "src/index.js"]
