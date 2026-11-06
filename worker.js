/* Cloudflare Worker starter: Razorpay order creation + verification + Google Apps Script storage.
   Configure secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, GOOGLE_APPS_SCRIPT_URL, ADMIN_TOKEN.
   Set vars: STORE_NAME, FRONTEND_ORIGIN. Never expose secrets in browser code. */
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","access-control-allow-origin": "*","access-control-allow-headers":"content-type,authorization","access-control-allow-methods":"GET,POST,OPTIONS"}});
const enc=s=>new TextEncoder().encode(s);
async function hmac(secret,message){const key=await crypto.subtle.importKey("raw",enc(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return [...new Uint8Array(await crypto.subtle.sign("HMAC",key,enc(message)))].map(x=>x.toString(16).padStart(2,"0")).join("");}
async function sha256(s){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",enc(s)))].map(x=>x.toString(16).padStart(2,"0")).join("");}
async function sheet(env,payload){if(!env.GOOGLE_APPS_SCRIPT_URL)throw Error("Google Sheets endpoint is not configured");const r=await fetch(env.GOOGLE_APPS_SCRIPT_URL,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...payload,token:env.ADMIN_TOKEN})});const d=await r.json();if(!r.ok||d.ok===false)throw Error(d.error||"Sheet request failed");return d;}
async function getProducts(env){if(!env.GOOGLE_APPS_SCRIPT_URL)return {products:[]};const u=new URL(env.GOOGLE_APPS_SCRIPT_URL);u.searchParams.set("action","products");const r=await fetch(u);if(!r.ok)throw Error("Could not load products");return r.json();}
export default {
 async fetch(req,env){
  if(req.method==="OPTIONS")return new Response(null,{headers:{"access-control-allow-origin":"*","access-control-allow-headers":"content-type,authorization","access-control-allow-methods":"GET,POST,OPTIONS"}});
  const url=new URL(req.url);
  try{
   if (   req.method === "GET" &&   (     url.pathname === "/api/products" ||     (url.pathname === "/" && url.searchParams.get("action") === "products")   ) ) {   return json(await getProducts(env)); }
   if(req.method==="POST"&&url.pathname==="/api/checkout/create"){
    const body=await req.json();const {customer,items}=body;
    if(!customer||!Array.isArray(items)||!items.length) return json({error:"Missing order details"},400);
    const catalog=await getProducts(env);let amount=0,clean=[];
    for(const item of items){const p=(catalog.products||[]).find(x=>String(x.id)===String(item.productId)&&x.active!==false);const q=Math.max(1,Math.min(10,Number(item.quantity)||1));if(!p)return json({error:"A product is unavailable"},400);amount+=Math.round(Number(p.price)*100)*q;clean.push({productId:p.id,name:p.name,quantity:q,unitPrice:Number(p.price)});}
    if(!amount)return json({error:"Invalid order amount"},400);
    const orderId="YC"+Date.now().toString(36).toUpperCase();
    const basic=btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
    const rp=await fetch("https://api.razorpay.com/v1/orders",{method:"POST",headers:{authorization:`Basic ${basic}`,"content-type":"application/json"},body:JSON.stringify({amount,currency:"INR",receipt:orderId,notes:{storeOrderId:orderId}})});
    const rpd=await rp.json();if(!rp.ok)return json({error:rpd.error?.description||"Payment provider error"},502);
    await sheet(env,{action:"createOrder",orderId,customer,items:clean,amount:amount/100,currency:"INR",razorpayOrderId:rpd.id,status:"PAYMENT_PENDING"});
    return json({orderId,razorpayOrderId:rpd.id,amount,keyId:env.RAZORPAY_KEY_ID});
   }
   if(req.method==="POST"&&url.pathname==="/api/checkout/verify"){
    const b=await req.json();const expected=await hmac(env.RAZORPAY_KEY_SECRET,`${b.razorpay_order_id}|${b.razorpay_payment_id}`);
    if(expected!==b.razorpay_signature)return json({error:"Payment signature is invalid"},400);
    const result=await sheet(env,{action:"verifyPayment",orderId:b.orderId,paymentId:b.razorpay_payment_id,razorpayOrderId:b.razorpay_order_id,signature:b.razorpay_signature});
    return json({ok:true,...result});
   }
   if(req.method==="POST"&&url.pathname==="/api/razorpay/webhook"){
    const raw=await req.text();const signature=req.headers.get("x-razorpay-signature")||"";const expected=await hmac(env.RAZORPAY_WEBHOOK_SECRET,raw);
    if(signature!==expected)return json({error:"Invalid webhook signature"},400);
    const event=JSON.parse(raw);if(event.event==="payment.captured"){const p=event.payload.payment.entity;await sheet(env,{action:"webhookPaid",paymentId:p.id,razorpayOrderId:p.order_id});}
    return json({ok:true});
   }
   return json({error:"Not found"},404);
  }catch(e){return json({error:e.message||"Server error"},500);}
 }
};
