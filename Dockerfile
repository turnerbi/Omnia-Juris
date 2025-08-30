FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy Prisma files first
COPY apps/api-server/prisma ./prisma/

# Copy package files and install dependencies
COPY apps/api-server/package*.json ./
RUN npm install --production

# Generate Prisma client
RUN npx prisma generate

# Copy the rest of the app
COPY apps/api-server ./

# Expose port configured in environment
EXPOSE 3000

# Start the API server
CMD ["node", "src/index.js"]
