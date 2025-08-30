FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy only prisma schema first to optimize Docker cache
COPY apps/api-server/prisma ./prisma/

# Copy package.json files
COPY apps/api-server/package*.json ./

# Install dependencies
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy rest of the application
COPY apps/api-server ./

# Expose app port
EXPOSE 3000

# Run the app
CMD ["node", "src/index.js"]
