FROM node:18-alpine
WORKDIR /app 
COPY package.json package-lock.json* /app/
RUN npm ci 
COPY . /app
EXPOSE 4100
CMD [ "node", "index.js" ]