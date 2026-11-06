
/* =========================================================
   GLOBAL SHIP PARTNER — STOREFRONT APP
   Works with index.html and style.css
   ========================================================= */

(() => {
  "use strict";

  const CONFIG = window.STORE_CONFIG || {};

  const API_URL = String(CONFIG.apiBaseUrl || "")
    .trim()
    .replace(/\/+$/, "");

  const DEMO_MODE = CONFIG.demoMode !== false;

  const PRODUCT_ACTION = "products";

  let products = [];
  let cart = [];
  let selectedProduct = null;

  const $ = (id) => document.getElementById(id);

  const money = (value) => {
    const amount = Number(value || 0);
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format(amount);
  };

  const escapeHTML = (value) => String(value ?? "").replace(
    /[&<>"']/g,
    (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]
  );

  function showStatus(message, isError = false) {
    const status = $("statusMessage");
    if (!status) return;

    status.textContent = message;
    status.style.color = isError ? "#b42318" : "";
  }

  function showToast(message, isError = false) {
    const toast = $("toast");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.toggle("error", isError);
    toast.classList.add("show");

    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  }

  async function apiRequest(action, data = null) {
    if (!API_URL) {
      throw new Error("Cloudflare Worker URL is missing in config.js.");
    }

    const url = new URL(API_URL);
    url.searchParams.set("action", action);

    const options = {
      method: data ? "POST" : "GET",
      headers: {
        "Accept": "application/json"
      }
    };

    if (data) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url.toString(), options);

    const text = await response.text();

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error(
        "The server returned an invalid response. Check your Worker."
      );
    }

    if (!response.ok || result.success === false || result.error) {
      throw new Error(
        result.message || result.error || `Server error (${response.status})`
      );
    }

    return result;
  }

  function normalizeProduct(item, index) {
    const id = item.id || item.productId || item.sku || `product-${index}`;

    return {
      id: String(id),
      sku: String(item.sku || id),
      name: String(
        item.name || item.title || item.productName || "Unnamed product"
      ),
      category: String(item.category || "General"),
      description: String(item.description || item.details || ""),
      price: Number(item.price ?? item.salePrice ?? item.amount ?? 0),
      comparePrice: Number(
        item.comparePrice ?? item.originalPrice ?? item.mrp ?? 0
      ),
      image: String(
        item.image || item.imageUrl || item.photo || item.imageURL || ""
      ),
      images: Array.isArray(item.images) ? item.images : [],
      stock: item.stock ?? item.quantity ?? null,
      featured: Boolean(item.featured),
      active: item.active !== false
    };
  }

  async function loadProducts() {
    showStatus("Loading products…");

    try {
      const result = await apiRequest(PRODUCT_ACTION);

      let list = Array.isArray(result)
        ? result
        : result.products || result.data || result.items || [];

      if (!Array.isArray(list)) {
        throw new Error("The products response has an unexpected format.");
      }

      products = list
        .map(normalizeProduct)
        .filter(product => product.active);

      if (!products.length) {
        showStatus("No products are currently available.");
        renderProducts();
        return;
      }

      populateCategories();
      renderProducts();
      showStatus(`${products.length} product(s) available.`);

    } catch (error) {
      console.error("Product loading error:", error);

      showStatus(
        "Unable to load products. " + error.message,
        true
      );

      const grid = $("productGrid");
      if (grid) {
        grid.innerHTML = `
          <div class="empty-state">
            <h3>Products could not be loaded</h3>
            <p>${escapeHTML(error.message)}</p>
            <button class="primary-button" id="retryProducts">
              Try again
            </button>
          </div>
        `;

        $("retryProducts")?.addEventListener("click", loadProducts);
      }
    }
  }

  function populateCategories() {
    const select = $("categoryFilter");
    if (!select) return;

    const previous = select.value;

    const categories = [...new Set(
      products.map(p => p.category).filter(Boolean)
    )];

    select.innerHTML =
      '<option value="all">All categories</option>' +
      categories.map(category =>
        `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`
      ).join("");

    if (categories.includes(previous)) {
      select.value = previous;
    }
  }

  function getVisibleProducts() {
    const search = ($("searchInput")?.value || "").toLowerCase().trim();
    const category = $("categoryFilter")?.value || "all";
    const sort = $("sortFilter")?.value || "featured";

    let result = products.filter(product => {
      const matchesSearch = [
        product.name,
        product.category,
        product.description,
        product.sku
      ].join(" ").toLowerCase().includes(search);

      const matchesCategory =
        category === "all" || product.category === category;

      return matchesSearch && matchesCategory;
    });

    if (sort === "price-low") {
      result.sort((a, b) => a.price - b.price);
    } else if (sort === "price-high") {
      result.sort((a, b) => b.price - a.price);
    } else if (sort === "name") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      result.sort((a, b) => Number(b.featured) - Number(a.featured));
    }

    return result;
  }

  function productImage(product) {
    return product.image ||
      product.images?.[0] ||
      "https://placehold.co/700x700/f0eee8/333333?text=Product";
  }

  function renderProducts() {
    const grid = $("productGrid");
    if (!grid) return;

    const list = getVisibleProducts();

    if (!list.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <h3>No products found</h3>
          <p>Try another search or category.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = list.map(product => `
      <article class="product-card" data-product-id="${escapeHTML(product.id)}">
        <div class="product-image">
          <button class="product-image-button"
            data-view="${escapeHTML(product.id)}"
            aria-label="View ${escapeHTML(product.name)}">
            <img src="${escapeHTML(productImage(product))}"
              alt="${escapeHTML(product.name)}"
              loading="lazy">
          </button>
          ${product.featured
            ? '<span class="product-tag">Featured</span>'
            : ""}
        </div>
        <div class="product-info">
          <p class="product-category">${escapeHTML(product.category)}</p>
          <button class="product-name"
            data-view="${escapeHTML(product.id)}">
            ${escapeHTML(product.name)}
          </button>
          <div class="product-price">
            <strong>${money(product.price)}</strong>
            ${product.comparePrice > product.price
              ? `<del>${money(product.comparePrice)}</del>`
              : ""}
          </div>
          <button class="add-button" data-add="${escapeHTML(product.id)}">
            <span>Add to bag</span><span>+</span>
          </button>
        </div>
      </article>
    `).join("");
  }

  function openProduct(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;

    selectedProduct = product;

    const detail = $("productDetail");
    if (!detail) return;

    const images = [productImage(product), ...product.images]
      .filter(Boolean);

    detail.innerHTML = `
      <div class="product-detail">
        <img id="detailImage"
          src="${escapeHTML(images[0])}"
          alt="${escapeHTML(product.name)}">

        <div>
          <p class="product-category">${escapeHTML(product.category)}</p>
          <h2>${escapeHTML(product.name)}</h2>
          <div class="product-price">
            <strong>${money(product.price)}</strong>
            ${product.comparePrice > product.price
              ? `<del>${money(product.comparePrice)}</del>`
              : ""}
          </div>
          <p>${escapeHTML(product.description)}</p>
          <p><small>SKU: ${escapeHTML(product.sku)}</small></p>
          ${images.length > 1 ? `
            <div class="detail-thumbs">
              ${images.map((image, i) => `
                <img src="${escapeHTML(image)}"
                  alt="Product image ${i + 1}"
                  data-detail-image="${escapeHTML(image)}"
                  class="${i === 0 ? "selected" : ""}">
              `).join("")}
            </div>
          ` : ""}
          <button class="primary-button" id="detailAdd">
            Add to bag <span>+</span>
          </button>
        </div>
      </div>
    `;

    openModal("productModal");
  }

  function openModal(id) {
    $(id)?.classList.add("open");
    $(id)?.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
  }

  function closeModal(id) {
    $(id)?.classList.remove("open");
    $(id)?.setAttribute("aria-hidden", "true");

    if (!document.querySelector(".modal.open, .drawer.open")) {
      document.body.classList.remove("no-scroll");
    }
  }

  function addToCart(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;

    const existing = cart.find(item => item.id === id);

    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({ ...product, quantity: 1 });
    }

    renderCart();
    showToast("Product added to your bag.");
  }

  function changeQuantity(id, change) {
    const item = cart.find(p => p.id === id);
    if (!item) return;

    item.quantity += change;

    if (item.quantity <= 0) {
      cart = cart.filter(p => p.id !== id);
    }

    renderCart();
  }

  function removeFromCart(id) {
    cart = cart.filter(p => p.id !== id);
    renderCart();
  }

  function renderCart() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.reduce(
      (sum, item) => sum + item.price * item.quantity, 0
    );

    if ($("cartCount")) $("cartCount").textContent = count;
    if ($("cartSubtotal")) $("cartSubtotal").textContent = money(subtotal);
    if ($("checkoutTotal")) $("checkoutTotal").textContent = money(subtotal);

    const container = $("cartItems");
    if (!container) return;

    if (!cart.length) {
      container.innerHTML = `
        <div class="empty-cart">
          Your shopping bag is empty.
        </div>
      `;
      return;
    }

    container.innerHTML = cart.map(item => `
      <div class="cart-line">
        <img src="${escapeHTML(productImage(item))}"
          alt="${escapeHTML(item.name)}">
        <div class="cart-line-info">
          <strong>${escapeHTML(item.name)}</strong>
          <small>${money(item.price)}</small>
          <div class="qty-controls">
            <button data-qty="${escapeHTML(item.id)}" data-change="-1">−</button>
            <span>${item.quantity}</span>
            <button data-qty="${escapeHTML(item.id)}" data-change="1">+</button>
            <button class="remove-item" data-remove="${escapeHTML(item.id)}">
              Remove
            </button>
          </div>
        </div>
        <strong>${money(item.price * item.quantity)}</strong>
      </div>
    `).join("");
  }

  function openCart() {
    renderCart();
    openModal("cartDrawer");
  }

  function startCheckout() {
    if (!cart.length) {
      showToast("Your shopping bag is empty.", true);
      return;
    }

    closeModal("cartDrawer");
    openModal("checkoutModal");
  }

  async function handleCheckout(event) {
    event.preventDefault();

    if (DEMO_MODE) {
      showToast(
        "Demo mode is enabled. Live payment is not available yet.",
        true
      );
      return;
    }

    if (!API_URL) {
      showToast("Cloudflare Worker URL is missing.", true);
      return;
    }

    if (!cart.length) {
      showToast("Your shopping bag is empty.", true);
      return;
    }

    const form = $("checkoutForm");
    if (!form.reportValidity()) return;

    const button = $("payButton");
    const message = $("checkoutMessage");

    button.disabled = true;
    button.textContent = "Preparing payment…";
    if (message) message.textContent = "";

    try {
      const customer = Object.fromEntries(new FormData(form).entries());

      const result = await apiRequest("createOrder", {
        customer,
        items: cart.map(item => ({
          productId: item.id,
          sku: item.sku,
          quantity: item.quantity
        }))
      });

      const order = result.order || result;

      if (!order.id || !order.amount) {
        throw new Error("The server did not return a valid Razorpay order.");
      }

      if (!window.Razorpay) {
        throw new Error("Razorpay Checkout library is unavailable.");
      }

      const checkout = new Razorpay({
        key: result.keyId || result.key || "",
        amount: order.amount,
        currency: order.currency || "INR",
        name: CONFIG.storeName || "Global Ship Partner",
        description: "Online store purchase",
        order_id: order.id,
        prefill: {
          name: customer.customerName,
          email: customer.email,
          contact: customer.phone
        },

        handler: async function (payment) {
          try {
            const verification = await apiRequest("verifyPayment", {
              ...payment,
              customer,
              orderId: order.id
            });

            if (verification.success === false) {
              throw new Error("Payment verification failed.");
            }

            cart = [];
            renderCart();
            form.reset();
            closeModal("checkoutModal");
            showToast("Payment received. Order confirmation is being processed.");

          } catch (error) {
            console.error("Payment verification error:", error);
            if (message) {
              message.textContent =
                "Payment verification needs attention. Contact support with your payment ID.";
            }
          }
        },

        modal: {
          ondismiss: function () {
            button.disabled = false;
            button.innerHTML = 'Pay securely <span>↗</span>';
          }
        },

        theme: { color: "#171717" }
      });

      checkout.on("payment.failed", function (response) {
        console.error("Payment failed:", response.error);
        showToast("Payment failed. Please try again.", true);
        button.disabled = false;
        button.innerHTML = 'Pay securely <span>↗</span>';
      });

      checkout.open();

    } catch (error) {
      console.error("Checkout error:", error);
      if (message) message.textContent = error.message;
      showToast(error.message, true);

      button.disabled = false;
      button.innerHTML = 'Pay securely <span>↗</span>';
    }
  }

  function bindEvents() {
    $("searchInput")?.addEventListener("input", renderProducts);
    $("categoryFilter")?.addEventListener("change", renderProducts);
    $("sortFilter")?.addEventListener("change", renderProducts);

    $("productGrid")?.addEventListener("click", event => {
      const view = event.target.closest("[data-view]");
      const add = event.target.closest("[data-add]");

      if (view) openProduct(view.dataset.view);
      if (add) addToCart(add.dataset.add);
    });

    $("productDetail")?.addEventListener("click", event => {
      const image = event.target.closest("[data-detail-image]");

      if (image) {
        const main = $("detailImage");
        if (main) main.src = image.dataset.detailImage;

        $("productDetail").querySelectorAll(".detail-thumbs img")
          .forEach(img => img.classList.remove("selected"));

        image.classList.add("selected");
      }

      if (event.target.closest("#detailAdd") && selectedProduct) {
        addToCart(selectedProduct.id);
        closeModal("productModal");
      }
    });

    $("cartItems")?.addEventListener("click", event => {
      const qty = event.target.closest("[data-qty]");
      const remove = event.target.closest("[data-remove]");

      if (qty) {
        changeQuantity(qty.dataset.qty, Number(qty.dataset.change));
      }

      if (remove) removeFromCart(remove.dataset.remove);
    });

    $("cartOpen")?.addEventListener("click", openCart);
    $("checkoutStart")?.addEventListener("click", startCheckout);
    $("checkoutForm")?.addEventListener("submit", handleCheckout);

    document.addEventListener("click", event => {
      const close = event.target.closest("[data-close]");
      if (close) closeModal(
        close.dataset.close === "cart" ? "cartDrawer" :
        close.dataset.close === "checkout" ? "checkoutModal" :
        "productModal"
      );
    });

    $("year") && ($("year").textContent = new Date().getFullYear());
  }

  function init() {
    const storeName = CONFIG.storeName || "Global Ship Partner";
    document.title = `${storeName} — Shop Smart`;

    bindEvents();
    renderCart();
    loadProducts();
  }

  document.addEventListener("DOMContentLoaded", init);

})();
