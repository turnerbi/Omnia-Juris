FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy Prisma files first
COPY apps/api-server/prisma ./prisma/

# Copy package.json and install only production dependencies
COPY apps/api-server/package*.json ./
RUN npm ci --omit=dev

# Generate Prisma client
RUN npx prisma generate

# Copy the rest of the app
COPY apps/api-server ./

# Expose app port
EXPOSE 3000

# Run the app
CMD ["node", "src/index.js"]