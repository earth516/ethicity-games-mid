// Run from repository root; isolated browser, read-only asset validation.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs');
(async()=>{const {startServer}=await import('../../tests/serve.mjs');const server=await startServer(0);let browser;
try{browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1200,height:1000}});await page.goto('http://127.0.0.1:'+server.address().port+'/privacy/assets/characters-v3/preview.html');await page.waitForFunction(()=>window.assetChecks.length===4);const results=await page.evaluate(()=>window.assetChecks);if(results.some(x=>x.error||!x.transparent))throw Error('Missing or non-transparent asset');fs.writeFileSync(__dirname+'/asset-metadata.json',JSON.stringify(results,null,2));await page.screenshot({path:__dirname+'/preview.png',fullPage:true});console.log('PASS: 4 PNGs load with transparent pixels. Metadata and preview saved.');}finally{if(browser)await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});


