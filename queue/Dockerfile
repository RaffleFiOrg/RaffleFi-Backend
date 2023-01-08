FROM node:16
WORKDIR /usr/src/queue

COPY yarn.lock package.json ./

# RUN npm install 
RUN yarn install && yarn cache clean --force

# bundle app source 
COPY . .

CMD ["node", "build/index.js"]