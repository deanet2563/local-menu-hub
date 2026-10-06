const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');
const compile = s => ts.transpileModule(s, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function harness(host, token = 'synthetic-test-token') {
  const calls = [];
  const auth = {};
  const liff = {init:async()=>{},isLoggedIn:()=>true,getIDToken:()=>token};
  const location = new URL(`https://${host}/cart`);
  vm.runInNewContext(compile(fs.readFileSync('src/lib/supabase.ts','utf8').replaceAll('import.meta.env','TEST_ENV')), {
    exports:auth,URL,URLSearchParams,TEST_ENV:{},window:{location},require(name){
      if(name==='@supabase/supabase-js') return {createClient:()=>({storage:{from:()=>({})}})};
      if(name==='@line/liff') return {default:liff};
      if(name.endsWith('/previewDebugRoute')) return {isPreviewCheckoutMapAuthBypassActive:()=>false};
      return {};
    }
  });
  const order = {};
  vm.runInNewContext(compile(fs.readFileSync('src/lib/order.ts','utf8')), {
    exports:order,fetch:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({ok:true,order_id:'synthetic'})}},
    require(name){
      if(name==='@line/liff') return {default:liff};
      if(name==='@/lib/supabase') return {...auth,initLiff:async()=>{}};
      if(name==='@/lib/cart') return {cart:{getState:()=>({items:[]})}};
      if(name==='@/lib/deliveryLocation') return {getDeliveryQuoteToken:()=>null};
      throw Error(name);
    }
  });
  return {calls,submit:()=>order.submitOrder({shopId:'synthetic-shop',items:[],fulfillment:'pickup',payment:'cash',address:null,destinationLat:null,destinationLng:null,note:null})};
}
for(const host of ['a3358cba.local-menu-hub.pages.dev','codex-reconcile-food-hub-oct.local-menu-hub.pages.dev']) {
  test(`preview order uses staging Worker: ${host}`,async()=>{
    const h=harness(host);assert.equal((await h.submit()).ok,true);
    assert.equal(h.calls.length,1);assert.equal(h.calls[0].url,'https://mytree-worker-staging.kompakorn-t.workers.dev/order');
  });
}
test('canonical Production order retains Production Worker',async()=>{
  const h=harness('mytree.cc');await h.submit();assert.equal(h.calls[0].url,'https://mytree-worker.kompakorn-t.workers.dev/order');
});
test('missing ID token prevents order transmission',async()=>{
  const h=harness('a3358cba.local-menu-hub.pages.dev',null);assert.equal((await h.submit()).ok,false);assert.equal(h.calls.length,0);
});
