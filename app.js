/*
 * BoldCart storefront frontend.
 * Set API_URL to the deployed Apps Script web app URL ending in /exec.
 * Never place the Razorpay Key Secret in this file.
 */
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbzQ5ByeGivCgRxvqmHKqYAMFdjzrnzJJaln0OG6_1HGpgfoSpwQ-8VfOo1n60sTl-xZ/exec",
  STORE_NAME: "BoldCart",
  CURRENCY: "INR",
  // Used only when the API is unavailable for local design preview.
  DEMO_MODE: true
};

const demoProducts = [
  {productId:"BC-1001",title:"Minimal Desk Lamp",description:"A clean-lined lamp with a warm glow. An easy upgrade for your reading nook, work desk or bedside table.",category:"Home",price:799,compareAtPrice:999,stock:20,imageUrls:["https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=85","https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=85"],videoUrls:[],featured:true,active:true,shippingDays:"5–8 days"},
  {productId:"BC-1002",title:"Everyday Carry Tote",description:"A versatile carry-all for errands, books and days that turn into adventures.",category:"Accessories",price:549,compareAtPrice:699,stock:35,imageUrls:["https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=85"],videoUrls:[],featured:true,active:true,shippingDays:"4–7 days"},
  {productId:"BC-1003",title:"Ceramic Coffee Set",description:"A tactile, minimal ceramic set that makes your morning ritual feel a little more special.",category:"Home",price:899,compareAtPrice:1199,stock:12,imageUrls:["https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=900&q=85"],videoUrls:[],featured:true,active:true,shippingDays:"5–8 days"},
  {productId:"BC-1004",title:"Wireless Mini Speaker",description:"Small footprint, big everyday sound. Take your playlists from desk to weekend.",category:"Tech",price:1299,compareAtPrice:1599,stock:9,imageUrls:["https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=85"],videoUrls:[],featured:false,active:true,shippingDays:"5–9 days"},
  {productId:"BC-1005",title:"Soft Glow Night Light",description:"A soft ambient light for slow evenings, bedside tables and cosy corners.",category:"Home",price:399,compareAtPrice:499,stock:40,imageUrls:["https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=900&q=85"],videoUrls:[],featured:false,active:true,shippingDays:"4–7 days"},
  {productId:"BC-1006",title:"Daily Crossbody",description:"Keep the essentials close with a compact silhouette designed for everyday movement.",category:"Accessories",price:999,compareAtPrice:1299,stock:16,imageUrls:["https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=85"],videoUrls:[],featured:true,active:true,shippingDays:"5–8 days"},
  {productId:"BC-1007",title:"Desk Reset Organizer",description:"A simple home for the small things that usually clutter your workspace.",category:"Office",price:449,compareAtPrice:599,stock:25,imageUrls:["https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=85"],videoUrls:[],featured:false,active:true,shippingDays:"4–7 days"},
  {productId:"BC-1008",title:"Weekend Bottle",description:"A reusable bottle with a clean look that fits your commute, gym bag or weekend plan.",category:"Lifestyle",price:499,compareAtPrice:649,stock:30,imageUrls:["https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=85"],videoUrls:[],featured:false,active:true,shippingDays:"4–7 days"}
];

const state = { products: [], cart: readCart(), selectedProduct: null, config: {}, search: "", category: "all", sort: "featured", busy: false };
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const money = value => new Intl.NumberFormat("en-IN",{style:"currency",currency:state.config.currency || CONFIG.CURRENCY,maximumFractionDigits:2}).format(Number(value)||0);
const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function readCart(){try{return JSON.parse(localStorage.getItem("boldcart_cart")||"[]")}catch{return []}}
function saveCart(){localStorage.setItem("boldcart_cart",JSON.stringify(state.cart));renderCartCount()}
function imageList(product){return Array.isArray(product.imageUrls)?product.imageUrls:String(product.imageUrls||"").split(",").map(s=>s.trim()).filter(Boolean)}
function videoList(product){return Array.isArray(product.videoUrls)?product.videoUrls:String(product.videoUrls||"").split(",").map(s=>s.trim()).filter(Boolean)}
function productImage(product){return imageList(product)[0] || "https://placehold.co/700x850/e9e7e0/222?text=Product"}
function toast(message, error=false){const el=$("#toast");el.textContent=message;el.classList.toggle("error",error);el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),3200)}
async function apiGet(action){
  if(!CONFIG.API_URL || CONFIG.API_URL.includes("PASTE_YOUR")) throw new Error("API URL is not configured");
  const url=new URL(CONFIG.API_URL);url.searchParams.set("action",action);
  const res=await fetch(url.toString(),{method:"GET",redirect:"follow"});
  if(!res.ok)throw new Error("API request failed");
  return res.json();
}
async function apiPost(payload){
  if(!CONFIG.API_URL || CONFIG.API_URL.includes("PASTE_YOUR")) throw new Error("API URL is not configured");
  const body=new URLSearchParams();Object.entries(payload).forEach(([k,v])=>body.set(k,typeof v==="string"?v:JSON.stringify(v)));
  const res=await fetch(CONFIG.API_URL,{method:"POST",body,redirect:"follow"});
  if(!res.ok)throw new Error("API request failed");
  const result=await res.json();if(!result.ok)throw new Error(result.error||"Request failed");return result;
}
async function loadProducts(){
  $("#year").textContent=new Date().getFullYear();
  try{
    const [productResult, configResult]=await Promise.all([apiGet("products"),apiGet("config")]);
    state.products=(productResult.products||[]).map(normalizeProduct);
    state.config=configResult.config||{};
    if(!state.products.length)throw new Error("No active products found");
    $("#statusMessage").textContent="";
  }catch(err){
    if(CONFIG.DEMO_MODE){state.products=demoProducts.map(normalizeProduct);state.config={storeName:CONFIG.STORE_NAME,currency:"INR",shippingFlat:0,razorpayKeyId:""};$("#statusMessage").textContent="Preview mode: sample products are shown. Connect Google Sheets before accepting orders."}
    else {state.products=[];$("#statusMessage").textContent="Could not load products. Please try again later."}
  }
  populateCategories();renderProducts();renderCart();
}
function normalizeProduct(p){return {...p,productId:String(p.productId||p.id||""),title:String(p.title||"Untitled product"),description:String(p.description||""),category:String(p.category||"Other"),price:Number(p.price)||0,compareAtPrice:Number(p.compareAtPrice)||0,stock:Number(p.stock)||0,featured:p.featured===true||String(p.featured).toLowerCase()==="true",active:p.active===true||String(p.active).toLowerCase()==="true",imageUrls:imageList(p),videoUrls:videoList(p)}}
function populateCategories(){const select=$("#categoryFilter"),current=select.value;const categories=[...new Set(state.products.map(p=>p.category).filter(Boolean))].sort();select.innerHTML='<option value="all">All categories</option>'+categories.map(c=>`<option value="${safe(c)}">${safe(c)}</option>`).join("");select.value=categories.includes(current)?current:"all"}
function visibleProducts(){let list=state.products.filter(p=>p.active!==false&&p.stock>0);if(state.category!=="all")list=list.filter(p=>p.category===state.category);if(state.search){const q=state.search.toLowerCase();list=list.filter(p=>[p.title,p.description,p.category].join(" ").toLowerCase().includes(q))}if(state.sort==="price-low")list.sort((a,b)=>a.price-b.price);if(state.sort==="price-high")list.sort((a,b)=>b.price-a.price);if(state.sort==="name")list.sort((a,b)=>a.title.localeCompare(b.title));if(state.sort==="featured")list.sort((a,b)=>Number(b.featured)-Number(a.featured));return list}
function renderProducts(){const grid=$("#productGrid"),products=visibleProducts();if(!products.length){grid.innerHTML='<div class="empty-state"><h3>No products found</h3><p>Try another search or category.</p></div>';return}grid.innerHTML=products.map(p=>`<article class="product-card" data-product="${safe(p.productId)}" tabindex="0" role="button" aria-label="View ${safe(p.title)}"><div class="product-image"><img src="${safe(productImage(p))}" alt="${safe(p.title)}" loading="lazy" onerror="this.src='https://placehold.co/700x850/e9e7e0/222?text=Product'">${p.featured?'<span class="product-tag">Editor’s pick</span>':p.compareAtPrice>p.price?'<span class="product-tag">Special price</span>':''}<button class="quick-add" data-add="${safe(p.productId)}" aria-label="Add ${safe(p.title)} to bag">+</button></div><div class="product-info"><span class="product-category">${safe(p.category)}</span><div class="product-title-row"><h3 class="product-title">${safe(p.title)}</h3><div class="product-price">${money(p.price)}${p.compareAtPrice>p.price?`<span class="compare-price">${money(p.compareAtPrice)}</span>`:""}</div></div><p class="product-desc">${safe(p.description)}</p></div></article>`).join("")}
function openProduct(id){const p=state.products.find(x=>x.productId===id);if(!p)return;state.selectedProduct=p;const images=imageList(p),videos=videoList(p);$("#productDetail").innerHTML=`<div class="product-detail-layout"><div><img id="detailMainImage" class="detail-main-image" src="${safe(images[0]||productImage(p))}" alt="${safe(p.title)}">${images.length>1?`<div class="detail-thumbs">${images.map((src,i)=>`<img class="${i===0?"selected":""}" src="${safe(src)}" data-thumb="${i}" alt="${safe(p.title)} image ${i+1}">`).join("")}</div>`:""}</div><div class="detail-copy"><span class="product-category">${safe(p.category)} · ${p.stock>0?`${p.stock} in stock`:"Out of stock"}</span><h2 id="modalTitle">${safe(p.title)}</h2><div class="detail-price">${money(p.price)} ${p.compareAtPrice>p.price?`<span class="compare-price">${money(p.compareAtPrice)}</span>`:""}</div><p>${safe(p.description)}</p><p><b>Estimated dispatch / delivery:</b> ${safe(p.shippingDays||"See checkout for details")}</p><p>Secure checkout · Order confirmation by email after verified payment.</p>${videos.map(url=>videoMarkup(url)).join("")}<button class="primary-button" data-add="${safe(p.productId)}">Add to bag <span>＋</span></button></div></div>`;showModal("product")}
function videoMarkup(url){if(/youtube\.com\/embed\/|player\.vimeo\.com\/video\//i.test(url))return `<div class="detail-video"><iframe src="${safe(url)}" title="Product video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;if(/\.(mp4|webm|ogg)(\?.*)?$/i.test(url))return `<video class="detail-video" controls preload="metadata"><source src="${safe(url)}"></video>`;return `<p><a href="${safe(url)}" target="_blank" rel="noopener noreferrer">Watch product video ↗</a></p>`}
function addToCart(id){const p=state.products.find(x=>x.productId===id);if(!p)return;if(p.stock<=0){toast("This item is currently out of stock.",true);return}const item=state.cart.find(x=>x.productId===id);if(item){if(item.quantity>=p.stock){toast("Maximum available stock reached.",true);return}item.quantity++}else state.cart.push({productId:id,quantity:1});saveCart();renderCart();toast("Added to your bag.");}
function changeQty(id,delta){const item=state.cart.find(x=>x.productId===id),p=state.products.find(x=>x.productId===id);if(!item)return;item.quantity+=delta;if(item.quantity<=0)state.cart=state.cart.filter(x=>x.productId!==id);else if(p&&item.quantity>p.stock){item.quantity=p.stock;toast("Maximum available stock reached.",true)}saveCart();renderCart()}
function cartSubtotal(){return state.cart.reduce((sum,item)=>{const p=state.products.find(x=>x.productId===item.productId);return sum+(p?p.price*item.quantity:0)},0)}
function renderCartCount(){$("#cartCount").textContent=state.cart.reduce((s,i)=>s+i.quantity,0)}
function renderCart(){state.cart=state.cart.filter(i=>state.products.some(p=>p.productId===i.productId));saveCart();const el=$("#cartItems");if(!state.cart.length)el.innerHTML='<div class="empty-state"><h3>Your bag is taking a break.</h3><p>Add something good to get started.</p></div>';else el.innerHTML=state.cart.map(i=>{const p=state.products.find(x=>x.productId===i.productId);return `<div class="cart-row"><img src="${safe(productImage(p))}" alt="${safe(p.title)}"><div><h3>${safe(p.title)}</h3><small>${money(p.price)} each</small><div class="qty-controls"><button data-qty="${safe(p.productId)}" data-delta="-1" aria-label="Decrease quantity">−</button><span>${i.quantity}</span><button data-qty="${safe(p.productId)}" data-delta="1" aria-label="Increase quantity">+</button></div></div><div><b>${money(p.price*i.quantity)}</b><br><button class="remove-item" data-remove="${safe(p.productId)}">Remove</button></div></div>`}).join("");$("#cartSubtotal").textContent=money(cartSubtotal());$("#checkoutTotal").textContent=money(cartSubtotal()+Number(state.config.shippingFlat||0));renderCartCount()}
function showModal(name){$("#"+(name==="cart"?"cartDrawer":name==="checkout"?"checkoutModal":"productModal")).classList.add("open");$("#"+(name==="cart"?"cartDrawer":name==="checkout"?"checkoutModal":"productModal")).setAttribute("aria-hidden","false");document.body.classList.add("no-scroll")}
function hideModal(name){const el=$("#"+(name==="cart"?"cartDrawer":name==="checkout"?"checkoutModal":"productModal"));el.classList.remove("open");el.setAttribute("aria-hidden","true");if(!$(".modal.open")&&!$(".drawer.open"))document.body.classList.remove("no-scroll")}
function setCheckoutMessage(msg,error=false){const el=$("#checkoutMessage");el.textContent=msg;el.style.color=error?"#a62c20":"#777"}
async function handleCheckout(event){event.preventDefault();if(state.busy)return;if(!state.cart.length){toast("Your bag is empty.",true);return}if(!window.Razorpay){setCheckoutMessage("Razorpay Checkout could not load. Check your connection and try again.",true);return}
 const form=event.currentTarget;const customer=Object.fromEntries(new FormData(form).entries());const payButton=$("#payButton");state.busy=true;payButton.disabled=true;payButton.textContent="Preparing secure checkout…";setCheckoutMessage("");
 try{
   const orderResult=await apiPost({action:"createOrder",customer,items:state.cart.map(i=>({productId:i.productId,quantity:i.quantity}))});
   const rOrder=orderResult.order;const publicKey=orderResult.keyId;if(!rOrder||!rOrder.id||!publicKey)throw new Error("Payment setup is incomplete. Please contact the store.");
   const options={key:publicKey,amount:rOrder.amount,currency:rOrder.currency||"INR",name:state.config.storeName||CONFIG.STORE_NAME,description:"Store purchase",order_id:rOrder.id,prefill:{name:customer.customerName,email:customer.email,contact:customer.phone},notes:{storeOrderId:orderResult.orderId||""},theme:{color:"#141414"},
     handler:async response=>{try{setCheckoutMessage("Verifying your payment securely…");const verified=await apiPost({action:"verifyPayment",storeOrderId:orderResult.orderId,customer,items:state.cart.map(i=>({productId:i.productId,quantity:i.quantity})),razorpay_order_id:response.razorpay_order_id,razorpay_payment_id:response.razorpay_payment_id,razorpay_signature:response.razorpay_signature});state.cart=[];saveCart();renderCart();form.reset();hideModal("checkout");hideModal("cart");toast("Payment verified. Order confirmation sent by email.");alert(`Thank you! Your order ${verified.orderId||orderResult.orderId} is confirmed. A confirmation email will be sent to ${customer.email}.`)}catch(err){setCheckoutMessage("Payment was received by checkout, but server verification did not complete. Do not retry immediately. Contact support with your payment ID: "+(response.razorpay_payment_id||""),true)}finally{state.busy=false;payButton.disabled=false;payButton.innerHTML='Pay securely <span>↗</span>'}},
     modal:{ondismiss:()=>{state.busy=false;payButton.disabled=false;payButton.innerHTML='Pay securely <span>↗</span>';setCheckoutMessage("Checkout closed. Your bag is saved; you can try again.")}}
   };
   const razorpay=new Razorpay(options);razorpay.on("payment.failed",async response=>{try{await apiPost({action:"paymentFailed",storeOrderId:orderResult.orderId,razorpay_order_id:rOrder.id,reason:response.error?.description||"Payment failed"})}catch{}setCheckoutMessage("Payment did not complete. Your bag is still saved. Please try again.",true);state.busy=false;payButton.disabled=false;payButton.innerHTML='Pay securely <span>↗</span>'});razorpay.open();
 }catch(err){setCheckoutMessage(err.message||"Unable to start checkout. Please try again.",true);state.busy=false;payButton.disabled=false;payButton.innerHTML='Pay securely <span>↗</span>'}
}
document.addEventListener("click",e=>{
 const add=e.target.closest("[data-add]");if(add){e.stopPropagation();addToCart(add.dataset.add);return}
 const card=e.target.closest("[data-product]");if(card&&!e.target.closest("button")){openProduct(card.dataset.product);return}
 const qty=e.target.closest("[data-qty]");if(qty){changeQty(qty.dataset.qty,Number(qty.dataset.delta));return}
 const rem=e.target.closest("[data-remove]");if(rem){state.cart=state.cart.filter(i=>i.productId!==rem.dataset.remove);saveCart();renderCart();return}
 const thumb=e.target.closest("[data-thumb]");if(thumb&&state.selectedProduct){const imgs=imageList(state.selectedProduct);$("#detailMainImage").src=imgs[Number(thumb.dataset.thumb)];$$("[data-thumb]").forEach(el=>el.classList.toggle("selected",el===thumb));return}
 const close=e.target.closest("[data-close]");if(close){hideModal(close.dataset.close);return}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape")["product","cart","checkout"].forEach(name=>hideModal(name));if((e.key==="Enter"||e.key===" ")&&e.target.matches("[data-product]"))openProduct(e.target.dataset.product)});
$("#searchInput").addEventListener("input",e=>{state.search=e.target.value.trim();renderProducts()});
$("#categoryFilter").addEventListener("change",e=>{state.category=e.target.value;renderProducts()});
$("#sortFilter").addEventListener("change",e=>{state.sort=e.target.value;renderProducts()});
$("#cartOpen").addEventListener("click",()=>showModal("cart"));
$("#checkoutStart").addEventListener("click",()=>{if(!state.cart.length){toast("Your bag is empty.",true);return}hideModal("cart");renderCart();showModal("checkout")});
$("#checkoutForm").addEventListener("submit",handleCheckout);
loadProducts();
