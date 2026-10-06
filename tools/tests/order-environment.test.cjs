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
  const delivery = {};
  const transport = async (url, options) => {
    calls.push({url, body:JSON.parse(options.body)});
    const payload = url.endsWith('/location/resolve') ? {ok:true,location:{lat:13,lng:100}} :
      url.endsWith('/location/search') ? {ok:true,results:[]} :
      url.endsWith('/delivery/quote') ? {ok:true,quote:{distanceMeters:100},quoteToken:'synthetic-quote'} : {ok:true,order_id:'synthetic'};
    return {ok:true,json:async()=>payload};
  };
  vm.runInNewContext(compile(fs.readFileSync('src/lib/deliveryLocation.ts','utf8')), {
    exports:delivery,fetch:transport,require(name){
      if(name==='@line/liff') return {default:liff};
      if(name==='@/lib/supabase') return {...auth,initLiff:async()=>{}};
      throw Error(name);
    }
  });
  const order = {};
  vm.runInNewContext(compile(fs.readFileSync('src/lib/order.ts','utf8')), {
    exports:order,fetch:transport,
    require(name){
      if(name==='@line/liff') return {default:liff};
      if(name==='@/lib/supabase') return {...auth,initLiff:async()=>{}};
      if(name==='@/lib/cart') return {cart:{getState:()=>({items:[]})}};
      if(name==='@/lib/deliveryLocation') return delivery;
      throw Error(name);
    }
  });
  return {calls,delivery,submit:(overrides={})=>order.submitOrder({shopId:'synthetic-shop',items:[],fulfillment:'pickup',payment:'cash',address:null,destinationLat:null,destinationLng:null,note:null,...overrides})};
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

for(const [host,base] of [
 ['a3358cba.local-menu-hub.pages.dev','https://mytree-worker-staging.kompakorn-t.workers.dev'],
 ['codex-reconcile-food-hub-oct.local-menu-hub.pages.dev','https://mytree-worker-staging.kompakorn-t.workers.dev'],
 ['mytree.cc','https://mytree-worker.kompakorn-t.workers.dev']]) {
 test(`delivery resolve/search/quote/order share environment: ${host}`,async()=>{
  const h=harness(host);
  const point=await h.delivery.resolveDeliveryLocation('13,100','synthetic-shop');
  await h.delivery.searchDeliveryPlaces('synthetic','synthetic-shop');
  await h.delivery.quoteDeliveryRoute('synthetic-shop',point);
  assert.equal((await h.submit({fulfillment:'delivery',destinationLat:point.lat,destinationLng:point.lng})).ok,true);
  assert.deepEqual(h.calls.map(c=>c.url),['/location/resolve','/location/search','/delivery/quote','/order'].map(path=>base+path));
  assert.equal(h.calls[3].body.order.deliveryQuoteToken,'synthetic-quote');
 });
}
test('delivery without a bound quote cannot send an order',async()=>{
 const h=harness('a3358cba.local-menu-hub.pages.dev');
 assert.equal((await h.submit({fulfillment:'delivery',destinationLat:13,destinationLng:100})).ok,false);
 assert.equal(h.calls.length,0);
});
