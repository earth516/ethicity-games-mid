// Run after all five map-front PNGs are ready. Uses the existing test server.
// PLAYWRIGHT_PATH may point to the shared runtime's playwright package.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs');
const path=require('node:path');
const names=['hayun','seoa','dohyun','minjun','teacher'].map(id=>id+'-map-front');

(async()=>{
  const {startServer}=await import('../../tests/serve.mjs');
  const server=await startServer(0);
  let browser;
  try{
    browser=await chromium.launch({channel:'msedge',headless:true});
    const page=await browser.newPage({viewport:{width:1200,height:1000},deviceScaleFactor:1});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    page.on('requestfailed',request=>errors.push(request.url()+': '+request.failure()?.errorText));
    page.on('response',response=>{if(response.status()>=400)errors.push(response.status()+' '+response.url());});
    await page.goto('http://127.0.0.1:'+server.address().port+'/privacy/assets/characters-v3/map-cast-preview.html');
    await page.waitForFunction(()=>Array.isArray(window.assetChecks)&&window.assetChecks.length===5,{},{timeout:30000});
    const results=await page.evaluate(()=>window.assetChecks);
    const ordered=names.map(name=>results.find(result=>result.name===name));
    if(errors.length)throw Error('Browser errors: '+errors.join('\n'));
    if(new Set(results.map(result=>result.name)).size!==5||ordered.some(result=>
      !result||result.error||!(result.transparent>0)||!result.box||result.box[2]<=0||result.box[3]<=0
    ))throw Error('Missing, empty, failed, or non-transparent asset: '+JSON.stringify(results));
    const samples=await page.locator('.samples canvas').evaluateAll(canvases=>canvases.map(canvas=>({
      width:canvas.width,height:canvas.height,displayWidth:canvas.getBoundingClientRect().width,displayHeight:canvas.getBoundingClientRect().height
    })));
    if(samples.length!==10||samples.some((sample,index)=>{
      const scale=index%2+1;
      return sample.width!==48*scale||sample.height!==72*scale||sample.displayWidth!==sample.width||sample.displayHeight!==sample.height;
    }))throw Error('Expected five pairs of actual-size 48x72 and 96x144 samples');
    await page.screenshot({path:path.join(__dirname,'map-cast-preview.png'),fullPage:true});
    fs.writeFileSync(path.join(__dirname,'map-cast-metadata.json'),JSON.stringify(ordered,null,2)+'\n');
    console.log('PASS: 5 transparent map-front designs and 10 actual-size samples. Metadata and preview saved.');
  }finally{
    try{if(browser)await browser.close();}finally{await new Promise(resolve=>server.close(resolve));}
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
