var path = require('path');
const puppeteer = require('puppeteer');
var azure = require('azure-storage');
var https = require('https');
const variables = require('dotenv').config();
if (variables.error) {
    throw variables.error
  }

function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

//the chart might take a few seconds to load after the page is ready
//I use a timeout of 5000 ms
const timeoutPeriod = process.env.TIMEOUT; 
(async () => {
  var options = {
     defaultViewport: {
      width: 2000, //we don't need a big image, this will do just fine
      height: 1820
    },
    args: ['--no-sandbox', '--disable-setuid-sandbox'], //without these settings puppeteer won't start
     shotSize: {
      width: 'all',
      height: 'all'
    },
    javascriptEnabled: true,
    phantomConfig: { "ssl-protocol": "ANY", 'ignore-ssl-errors': 'true' }
  };
  const browser = await puppeteer.launch(options);
  var charts = JSON.parse(process.env.charts);
  var time = new Date().toLocaleDateString();//Date.now(); //I'll use the current timestamp in the image name
  console.log(`started at ${new Date().toString()}`);
  
  //if you don't specify a parameter, it will load the env variable AZURE_STORAGE_CONNECTION_STRING
  //which I set when I start the container
  var blobService = azure.createBlobService();
  //next I'll create a container for the images
  blobService.createContainerIfNotExists(variables.parsed.BLOB_NAME, { publicAccessLevel: 'blob' }, async function (error, result, response) {
    if (!error) {
      await Promise.all(charts.map(function (chart) {
        return downloadImage(browser, chart, time, blobService);
      }));
      /* const imageName = `/${charts.market}-${time}.png`;
      //when all images are downloaded and stored in blobs, open the saved file using path
      https.get(process.env.BLOB_URL + process.env.BLOB_NAME + imageName, function () {
        console.log('request done');
        
      }); */
      browser.close();
      console.log(`ended at ${new Date().toString()}`);
      process.exit(1);
    }
  });
 
  return;
})();



//the chart object has two fields, chartUrl and market(BTCUSD, ETHUSD, etc.)
async function downloadImage(browser, chart, timestamp, blobService) {
  //console.log("In Download Image");
  const waitUntil = process.env.WAIT_UNTIL;
  //console.log(waitUntil);
  const baseURL = "https://stocktwits.com/symbol/"
  var chartURL = `${baseURL}${chart.market}`
  //I'm not sure, but I decided to use the same browser instance for each chart thinking that it will use less resources
  //and each chart has it's separate page
  const page = await browser.newPage();
  await page.goto(chartURL, {
      waitUntil,
      timeout: 3600000
  });
  await timeout(timeoutPeriod);
  //as I said, the timestamp is used in a combination with the market name, so we'll have an unique name for each image
  const tempImage = `${chart.market}-${timestamp}.png`;
  //take a screenshot and save it in the images folder
  //await page.screenshot({ path: path.join(__dirname, 'images', tempImage) });
  const tempImagePath = path.join(__dirname, 'images', tempImage);
  
  await screenshotDOMElement(page, tempImagePath,  {
    selector: process.env.SCREENSHOT_ELEMENT,
    padding: 0
  }); 
  return new Promise(function (resolve, reject) {
    //here I create a blob for the screenshot and upload it to the container
    blobService.createBlockBlobFromLocalFile(variables.parsed.BLOB_NAME, tempImage, path.join(__dirname, '/images', tempImage), function (error, result, response) {
      if (!error) {
        console.log(`Image ${tempImage} uploaded to azure storage`);
        resolve(tempImage);
      }
      else {
        console.log(error);
        reject(error);
      }
    });
  });
}


/**
 * Takes a screenshot of a DOM element on the page, with optional padding.
 *
 * @param {!{path:string, selector:string, padding:(number|undefined)}=} opts
 * @return {!Promise<!Buffer>}
 */
const screenshotDOMElement = async(page, imagePath, opts = {}) => {
  const padding = 'padding' in opts ? opts.padding : 0;
  const selector = opts.selector;
  //console.log(selector);
  if (!selector)
      throw Error('Please provide a selector.');
  /* const html = await page.$eval(selector, e => [e.offsetWidth,e.offsetHeight,e.offsetTop,e.offsetLeft] );
  console.log(html); */
  const rect = await page.evaluate(selector => {
      const element = document.querySelector(selector);
      if (!element)
          return null;
      const {
          x,
          y,
          width,
          height
      } = element.getBoundingClientRect();
      return {
          left: x,
          top: y,
          width,
          height,
          id: element.id
      };
  }, selector);

  if (!rect)
      throw Error(`Could not find element that matches selector: ${selector}.`);

  //console.log(rect);
  //console.log(imagePath);

  await page.screenshot({
         path: imagePath,
         clip: {
          x: rect.left - padding,
          y: rect.top - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2
         }       
  });
  //console.log("Saved image locally");
}