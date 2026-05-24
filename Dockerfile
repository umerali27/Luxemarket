# Use a lightweight Node LTS image
FROM node:18-alpine

# Create the working directory inside the container
WORKDIR /usr/src/app

# Copy dependency files first for faster caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy the rest of your Express app files
COPY . .

# Inform Docker that the container listens on port 3001
EXPOSE 3001

# Start the Express server (FIXED SYNTAX)
CMD ["npm", "start"]
