FROM node:8-slim

# install chrome rather than relying on Puppeteer 
RUN apt-get update && apt-get install -y wget --no-install-recommends \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get purge --auto-remove -y curl \
    && rm -rf /src/*.deb

# copy project files and install dependencies
RUN mkdir -p /var/app/images
COPY . /var/app  
WORKDIR /var/app
RUN npm install
#for some reason puppeteer must be installed separately, although it is included in package.json
RUN npm i puppeteer

ENTRYPOINT ["node", "screenshot.js"]