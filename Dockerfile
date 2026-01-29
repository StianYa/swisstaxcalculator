FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Build Nuxt application (Nitro server)
RUN yarn build

EXPOSE 3001

# Start Nuxt server in production mode
CMD ["yarn", "start"]

