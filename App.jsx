import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import api, { authHeaders } from "./api";
import "./App.css";

const readAuth = () => {
  const raw = localStorage.getItem("shop_auth");
  return raw ? JSON.parse(raw) : { token: "", user: null };
};

function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [message, setMessage] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      if (mode === "signup") {
        const { data } = await api.post("/auth/signup", form);
        setMessage(data.message);
        setMode("login");
        return;
      }

      const { data } = await api.post("/auth/login", { email: form.email, password: form.password });
      onLogin(data);
    } catch (error) {
      setMessage(error.response?.data?.message || "Request failed");
    }
  };

  return (
    <div className="auth-wrap">
      <div className="hero-card">
        <h1>Nexa Cart</h1>
        <p>Account verification, admin approval, checkout, delivery ETA, and phone notification in one flow.</p>
      </div>
      <form className="panel" onSubmit={submit}>
        <h2>{mode === "login" ? "Login" : "Create account"}</h2>
        {mode === "signup" && (
          <input
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
        )}
        <input
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          required
        />
        {mode === "signup" && (
          <input
            placeholder="Phone number"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            required
          />
        )}
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
          required
        />
        <button type="submit">{mode === "login" ? "Login" : "Sign up"}</button>
        <button type="button" className="ghost" onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}>
          {mode === "login" ? "Need account? Sign up" : "Have account? Login"}
        </button>
        {message && <p className="message">{message}</p>}
      </form>
    </div>
  );
}

function UserDashboard({ auth, onLogout }) {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [orders, setOrders] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [addressForm, setAddressForm] = useState({
    fullName: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: ""
  });
  const [selectedAddress, setSelectedAddress] = useState("");
  const [notice, setNotice] = useState("");

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [cart]
  );

  const loadData = async () => {
    const [productsRes, cartRes, addressesRes, ordersRes] = await Promise.all([
      api.get("/products"),
      api.get("/cart", authHeaders(auth.token)),
      api.get("/orders/addresses", authHeaders(auth.token)),
      api.get("/orders/my", authHeaders(auth.token))
    ]);

    setProducts(productsRes.data);
    setCart(cartRes.data);
    setAddresses(addressesRes.data);
    setOrders(ordersRes.data);
    if (addressesRes.data.length && !selectedAddress) {
      setSelectedAddress(addressesRes.data[0]._id);
    }
  };

  useEffect(() => {
    loadData().catch((err) => setNotice(err.response?.data?.message || "Failed to load dashboard"));
  }, []);

  const addToCart = async (productId) => {
    await api.post("/cart", { productId, quantity: 1 }, authHeaders(auth.token));
    await loadData();
  };

  const removeFromCart = async (productId) => {
    await api.delete(`/cart/${productId}`, authHeaders(auth.token));
    await loadData();
  };

  const addAddress = async (e) => {
    e.preventDefault();
    await api.post("/orders/addresses", addressForm, authHeaders(auth.token));
    setAddressForm({
      fullName: "",
      phone: "",
      line1: "",
      line2: "",
      city: "",
      state: "",
      postalCode: "",
      country: ""
    });
    await loadData();
  };

  const placeOrder = async () => {
    if (!selectedAddress) {
      setNotice("Please add/select address first");
      return;
    }

    const { data } = await api.post(
      "/orders",
      { addressId: selectedAddress, paymentMethod },
      authHeaders(auth.token)
    );

    setNotice(`Order placed. Expected delivery: ${new Date(data.expectedDeliveryDate).toDateString()}`);
    await loadData();
  };

  return (
    <div className="dashboard">
      <header>
        <h2>User Dashboard</h2>
        <p>{auth.user.name} ({auth.user.email})</p>
        <button onClick={onLogout}>Logout</button>
      </header>

      {notice && <p className="message">{notice}</p>}

      <section className="grid-2">
        <div className="panel">
          <h3>Products</h3>
          {products.map((p) => (
            <article className="product" key={p._id}>
              <div>
                <strong>{p.name}</strong>
                <p>{p.description}</p>
                <small>Price: {p.price} | Stock: {p.stock}</small>
              </div>
              <button onClick={() => addToCart(p._id)}>Add to cart</button>
            </article>
          ))}
        </div>

        <div className="panel">
          <h3>Cart</h3>
          {cart.length === 0 && <p>Cart is empty</p>}
          {cart.map((item) => (
            <article className="product" key={item.product._id}>
              <div>
                <strong>{item.product.name}</strong>
                <small>
                  Qty: {item.quantity} | Total: {item.quantity * item.product.price}
                </small>
              </div>
              <button className="ghost" onClick={() => removeFromCart(item.product._id)}>
                Remove
              </button>
            </article>
          ))}
          <h4>Grand total: {total}</h4>
        </div>
      </section>

      <section className="grid-2">
        <form className="panel" onSubmit={addAddress}>
          <h3>Add address</h3>
          {Object.keys(addressForm).map((field) => (
            <input
              key={field}
              placeholder={field}
              value={addressForm[field]}
              onChange={(e) => setAddressForm((prev) => ({ ...prev, [field]: e.target.value }))}
              required={field !== "line2"}
            />
          ))}
          <button type="submit">Save address</button>
        </form>

        <div className="panel">
          <h3>Checkout</h3>
          <label>Delivery address</label>
          <select value={selectedAddress} onChange={(e) => setSelectedAddress(e.target.value)}>
            <option value="">Select address</option>
            {addresses.map((a) => (
              <option key={a._id} value={a._id}>
                {a.fullName} - {a.city}
              </option>
            ))}
          </select>
          <label>Payment method</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="COD">Cash on Delivery (COD)</option>
            <option value="ONLINE">Online Payment</option>
          </select>
          <button onClick={placeOrder}>Place order</button>
        </div>
      </section>

      <section className="panel">
        <h3>My orders</h3>
        {orders.length === 0 && <p>No orders yet</p>}
        {orders.map((order) => (
          <article className="order" key={order._id}>
            <strong>Order: {order._id}</strong>
            <p>Status: {order.orderStatus}</p>
            <p>Payment: {order.paymentMethod} / {order.paymentStatus}</p>
            <p>Total: {order.totalAmount}</p>
            <p>Delivery date: {new Date(order.expectedDeliveryDate).toDateString()}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

function AdminDashboard({ auth, onLogout }) {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    price: 0,
    stock: 0,
    imageUrl: "",
    category: "General"
  });
  const [notice, setNotice] = useState("");

  const loadAdmin = async () => {
    const [pendingRes, ordersRes] = await Promise.all([
      api.get("/admin/pending-users", authHeaders(auth.token)),
      api.get("/admin/orders", authHeaders(auth.token))
    ]);

    setPendingUsers(pendingRes.data);
    setOrders(ordersRes.data);
  };

  useEffect(() => {
    loadAdmin().catch((err) => setNotice(err.response?.data?.message || "Failed to load admin dashboard"));
  }, []);

  const approve = async (userId) => {
    await api.patch(`/admin/approve-user/${userId}`, {}, authHeaders(auth.token));
    setNotice("User approved and notified by email");
    await loadAdmin();
  };

  const addProduct = async (e) => {
    e.preventDefault();
    await api.post("/products", productForm, authHeaders(auth.token));
    setNotice("Product added");
    setProductForm({ name: "", description: "", price: 0, stock: 0, imageUrl: "", category: "General" });
  };

  return (
    <div className="dashboard">
      <header>
        <h2>Admin Dashboard</h2>
        <p>{auth.user.name} ({auth.user.email})</p>
        <button onClick={onLogout}>Logout</button>
      </header>

      {notice && <p className="message">{notice}</p>}

      <section className="grid-2">
        <div className="panel">
          <h3>Pending user approvals</h3>
          {pendingUsers.length === 0 && <p>No pending users</p>}
          {pendingUsers.map((u) => (
            <article key={u._id} className="product">
              <div>
                <strong>{u.name}</strong>
                <p>{u.email}</p>
                <small>{u.phone}</small>
              </div>
              <button onClick={() => approve(u._id)}>Approve</button>
            </article>
          ))}
        </div>

        <form className="panel" onSubmit={addProduct}>
          <h3>Add product</h3>
          {Object.keys(productForm).map((field) => (
            <input
              key={field}
              placeholder={field}
              value={productForm[field]}
              onChange={(e) => setProductForm((prev) => ({ ...prev, [field]: e.target.value }))}
              required={field !== "imageUrl"}
            />
          ))}
          <button type="submit">Save product</button>
        </form>
      </section>

      <section className="panel">
        <h3>All orders</h3>
        {orders.length === 0 && <p>No orders yet</p>}
        {orders.map((order) => (
          <article className="order" key={order._id}>
            <strong>{order.user?.name} ({order.user?.email})</strong>
            <p>Order: {order._id}</p>
            <p>Amount: {order.totalAmount}</p>
            <p>Delivery date: {new Date(order.expectedDeliveryDate).toDateString()}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

function AppShell() {
  const [auth, setAuth] = useState(readAuth());

  const onLogin = (data) => {
    const next = { token: data.token, user: data.user };
    setAuth(next);
    localStorage.setItem("shop_auth", JSON.stringify(next));
  };

  const onLogout = () => {
    setAuth({ token: "", user: null });
    localStorage.removeItem("shop_auth");
  };

  if (!auth.token || !auth.user) {
    return <AuthScreen onLogin={onLogin} />;
  }

  if (auth.user.role === "admin") {
    return <AdminDashboard auth={auth} onLogout={onLogout} />;
  }

  return <UserDashboard auth={auth} onLogout={onLogout} />;
}

function App() {
  return (
    <BrowserRouter>
      <nav className="top-nav">
        <Link to="/">Platform</Link>
      </nav>
      <Routes>
        <Route path="/" element={<AppShell />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
