import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";

function App() {
  const [page, setPage] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [costs, setCosts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("Tüm Ürünler");
  const [searchText, setSearchText] = useState("");

  const [editingProductId, setEditingProductId] = useState(null);
  const [stockAmount, setStockAmount] = useState({});

  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [authMode, setAuthMode] = useState("login");

  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
  });

  const emptyProductForm = {
    name: "",
    category: "",
    material: "",
    color: "",
    stock: "",
    productionTime: "",
    description: "",
  };

  const emptyCostForm = {
    productId: "",
    filament: "",
    electricity: "",
    labor: "",
    packaging: "",
    extra: "",
    profitRate: "",
  };

  const [form, setForm] = useState(emptyProductForm);
  const [costForm, setCostForm] = useState(emptyCostForm);

  useEffect(() => {
    const getCurrentSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setAuthLoading(false);
    };

    getCurrentSession();

    const { data } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession);
      }
    );

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session?.user) {
      fetchProfile();
      fetchProducts();
      fetchCosts();
    }
  }, [session]);

  const fetchProfile = async () => {
    if (!session?.user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (error) {
      const { data: createdProfile } = await supabase
        .from("profiles")
        .insert([
          {
            id: session.user.id,
            email: session.user.email,
            plan: "free",
          },
        ])
        .select()
        .single();

      setProfile(createdProfile);
    } else {
      setProfile(data);
    }
  };

  const signIn = async () => {
    if (!authForm.email || !authForm.password) {
      alert("Mail ve şifre boş bırakılamaz.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: authForm.email,
      password: authForm.password,
    });

    if (error) {
      alert("Giriş yapılamadı: " + error.message);
    }
  };

  const signUp = async () => {
    if (!authForm.email || !authForm.password) {
      alert("Mail ve şifre boş bırakılamaz.");
      return;
    }

    if (authForm.password.length < 6) {
      alert("Şifre en az 6 karakter olmalı.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: authForm.email,
      password: authForm.password,
    });

    if (error) {
      alert("Kayıt oluşturulamadı: " + error.message);
      return;
    }

    alert(
      "Kayıt oluşturuldu. Eğer mail doğrulama açıksa mailini kontrol et. Sonra giriş yapabilirsin."
    );

    setAuthMode("login");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProducts([]);
    setCosts([]);
    setProfile(null);
    setPage("dashboard");
    setShowLogin(false);
  };

  const fetchProducts = async () => {
    if (!session?.user) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      alert("Ürünler alınırken hata oluştu: " + error.message);
    } else {
      setProducts(data || []);
    }

    setLoading(false);
  };

  const fetchCosts = async () => {
    if (!session?.user) return;

    const { data, error } = await supabase
      .from("costs")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      alert("Maliyetler alınırken hata oluştu: " + error.message);
    } else {
      setCosts(data || []);
    }
  };

  const totalStock = products.reduce((sum, p) => sum + Number(p.stock || 0), 0);
  const lowStock = products.filter((p) => Number(p.stock) <= 5).length;
  const totalCost = costs.reduce((sum, c) => sum + Number(c.total_cost || 0), 0);
  const totalSale = costs.reduce((sum, c) => sum + Number(c.sale_price || 0), 0);

  const categories = [
    "Tüm Ürünler",
    ...Array.from(
      new Set(
        products.map((p) => {
          const category = (p.category || "").trim();
          return category === "" ? "Kategorisiz" : category;
        })
      )
    ),
  ];

  const filteredProducts = products.filter((p) => {
    const category = (p.category || "").trim();
    const cleanCategory = category === "" ? "Kategorisiz" : category;

    const categoryMatch =
      selectedCategory === "Tüm Ürünler" || cleanCategory === selectedCategory;

    const search = searchText.toLowerCase();

    const searchMatch =
      (p.name || "").toLowerCase().includes(search) ||
      (p.category || "").toLowerCase().includes(search) ||
      (p.material || "").toLowerCase().includes(search) ||
      (p.color || "").toLowerCase().includes(search) ||
      (p.description || "").toLowerCase().includes(search);

    return categoryMatch && searchMatch;
  });

  const getCategoryCount = (categoryName) => {
    if (categoryName === "Tüm Ürünler") {
      return products.length;
    }

    return products.filter((p) => {
      const category = (p.category || "").trim();
      const cleanCategory = category === "" ? "Kategorisiz" : category;
      return cleanCategory === categoryName;
    }).length;
  };

  const resetProductForm = () => {
    setEditingProductId(null);
    setForm(emptyProductForm);
  };

  const addProduct = async () => {
    if (!session?.user) return;

    if (!form.name || !form.stock) {
      alert("Ürün adı ve stok adedi boş bırakılamaz.");
      return;
    }

    const newProduct = {
      id: Date.now(),
      user_id: session.user.id,
      name: form.name,
      category: form.category,
      material: form.material,
      color: form.color,
      stock: Number(form.stock),
      production_time: form.productionTime,
      description: form.description,
    };

    const { error } = await supabase.from("products").insert([newProduct]);

    if (error) {
      alert("Ürün eklenirken hata oluştu: " + error.message);
      return;
    }

    resetProductForm();
    await fetchProducts();
  };

  const updateProduct = async () => {
    if (!editingProductId) return;

    if (!form.name || form.stock === "") {
      alert("Ürün adı ve stok adedi boş bırakılamaz.");
      return;
    }

    const updatedProduct = {
      name: form.name,
      category: form.category,
      material: form.material,
      color: form.color,
      stock: Number(form.stock),
      production_time: form.productionTime,
      description: form.description,
    };

    const { error } = await supabase
      .from("products")
      .update(updatedProduct)
      .eq("id", editingProductId);

    if (error) {
      alert("Ürün güncellenirken hata oluştu: " + error.message);
      return;
    }

    alert("Ürün başarıyla güncellendi.");
    resetProductForm();
    await fetchProducts();
  };

  const deleteProduct = async (id) => {
    if (!confirm("Bu ürün silinsin mi?")) return;

    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      alert("Ürün silinirken hata oluştu: " + error.message);
      return;
    }

    await fetchProducts();
    await fetchCosts();
  };

  const changeStock = async (id, amount) => {
    const product = products.find((p) => p.id === id);

    if (!product) return;

    if (!amount || Number(amount) === 0) {
      alert("Lütfen geçerli bir stok miktarı giriniz.");
      return;
    }

    const newStock = Math.max(0, Number(product.stock) + Number(amount));

    const { error } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", id);

    if (error) {
      alert("Stok güncellenirken hata oluştu: " + error.message);
      return;
    }

    setStockAmount({
      ...stockAmount,
      [id]: "",
    });

    await fetchProducts();
  };

  const calculateCost = () => {
    const filament = Number(costForm.filament || 0);
    const electricity = Number(costForm.electricity || 0);
    const labor = Number(costForm.labor || 0);
    const packaging = Number(costForm.packaging || 0);
    const extra = Number(costForm.extra || 0);
    const profitRate = Number(costForm.profitRate || 0);

    const total = filament + electricity + labor + packaging + extra;
    const sale = total + (total * profitRate) / 100;

    return {
      totalCost: total,
      salePrice: sale,
    };
  };

  const saveCost = async () => {
    if (!session?.user) return;

    if (!costForm.productId) {
      alert("Lütfen ürün seçiniz.");
      return;
    }

    const selectedProduct = products.find(
      (p) => p.id === Number(costForm.productId)
    );

    const calculated = calculateCost();

    const newCost = {
      id: Date.now(),
      user_id: session.user.id,
      product_id: Number(costForm.productId),
      product_name: selectedProduct?.name || "",
      filament: Number(costForm.filament || 0),
      electricity: Number(costForm.electricity || 0),
      labor: Number(costForm.labor || 0),
      packaging: Number(costForm.packaging || 0),
      extra: Number(costForm.extra || 0),
      profit_rate: Number(costForm.profitRate || 0),
      total_cost: calculated.totalCost,
      sale_price: calculated.salePrice,
    };

    const { error } = await supabase.from("costs").insert([newCost]);

    if (error) {
      alert("Maliyet kaydedilirken hata oluştu: " + error.message);
      return;
    }

    setCostForm(emptyCostForm);
    await fetchCosts();
  };

  const costResult = calculateCost();

  const landingCss = `
    .landing-page {
      min-height: 100vh;
      background:
        radial-gradient(circle at top right, rgba(0, 173, 181, 0.3), transparent 34%),
        linear-gradient(135deg, #111827, #0f172a);
      color: white;
      padding: 28px;
      font-family: Arial, Helvetica, sans-serif;
    }

    .landing-header {
      max-width: 1180px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }

    .landing-logo h1 {
      margin: 0;
      font-size: 28px;
      letter-spacing: 3px;
      color: white;
    }

    .landing-logo span {
      display: block;
      margin-top: 6px;
      color: #00adb5;
      font-weight: 800;
      letter-spacing: 2px;
    }

    .landing-nav {
      display: flex;
      align-items: center;
      gap: 18px;
    }

    .landing-nav a {
      color: #cbd5e1;
      text-decoration: none;
      font-weight: 800;
    }

    .landing-nav button,
    .hero-buttons button {
      border: 0;
      background: linear-gradient(135deg, #00adb5, #14b8a6);
      color: white;
      padding: 13px 22px;
      border-radius: 999px;
      font-weight: 900;
      cursor: pointer;
      box-shadow: 0 15px 35px rgba(0, 173, 181, 0.25);
    }

    .hero-section {
      max-width: 1180px;
      margin: 90px auto 70px;
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 42px;
      align-items: center;
    }

    .hero-badge {
      display: inline-block;
      background: rgba(0, 173, 181, 0.15);
      border: 1px solid rgba(0, 173, 181, 0.35);
      color: #67e8f9;
      padding: 9px 14px;
      border-radius: 999px;
      font-weight: 900;
      margin-bottom: 20px;
    }

    .hero-text h2 {
      margin: 0;
      font-size: 58px;
      line-height: 1.05;
      letter-spacing: -2px;
      color: white;
      text-align: left;
    }

    .hero-text p {
      color: #cbd5e1;
      font-size: 18px;
      line-height: 1.7;
      max-width: 620px;
      margin: 24px 0;
      text-align: left;
    }

    .hero-buttons {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
    }

    .hero-buttons a {
      text-decoration: none;
      padding: 15px 22px;
      border-radius: 16px;
      font-weight: 900;
      background: rgba(255, 255, 255, 0.09);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.14);
    }

    .hero-mini-stats {
      display: flex;
      gap: 14px;
      margin-top: 28px;
      flex-wrap: wrap;
    }

    .hero-mini-stats div,
    .dashboard-grid div,
    .dashboard-product,
    .feature-card,
    .workflow-section div {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.13);
      border-radius: 22px;
      padding: 18px;
      color: white;
    }

    .hero-mini-stats strong {
      display: block;
      color: white;
      font-size: 18px;
    }

    .hero-mini-stats span {
      display: block;
      color: #cbd5e1;
      font-size: 13px;
      margin-top: 4px;
    }

    .hero-dashboard {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 34px;
      padding: 28px;
      backdrop-filter: blur(16px);
      box-shadow: 0 30px 90px rgba(0, 0, 0, 0.32);
    }

    .dashboard-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 22px;
    }

    .dashboard-top span {
      color: #94a3b8;
      font-weight: 800;
      font-size: 13px;
    }

    .dashboard-top h3 {
      margin: 6px 0 0;
      font-size: 28px;
      color: white;
    }

    .dashboard-top strong {
      background: rgba(34, 197, 94, 0.18);
      color: #86efac;
      padding: 8px 13px;
      border-radius: 999px;
      font-size: 13px;
    }

    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 18px;
    }

    .dashboard-grid span {
      display: block;
      color: #cbd5e1;
      font-size: 13px;
      margin-bottom: 8px;
    }

    .dashboard-grid strong {
      font-size: 24px;
      color: white;
    }

    .dashboard-product {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      margin-top: 12px;
      align-items: center;
    }

    .dashboard-product h4 {
      margin: 0;
      font-size: 17px;
      color: white;
    }

    .dashboard-product p {
      margin: 6px 0 0;
      color: #cbd5e1;
      font-size: 13px;
    }

    .dashboard-product span {
      background: linear-gradient(135deg, #00adb5, #14b8a6);
      padding: 7px 11px;
      border-radius: 999px;
      font-weight: 900;
      white-space: nowrap;
      font-size: 13px;
      color: white;
    }

    .features-section {
      max-width: 1180px;
      margin: 0 auto 50px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 18px;
    }

    .feature-card div {
      font-size: 32px;
      margin-bottom: 14px;
    }

    .feature-card h3 {
      margin: 0 0 10px;
      font-size: 20px;
      color: white;
    }

    .feature-card p {
      margin: 0;
      color: #cbd5e1;
      line-height: 1.6;
    }

    .workflow-section {
      max-width: 1180px;
      margin: 28px auto 70px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 18px;
    }

    .workflow-section span {
      color: #67e8f9;
      font-weight: 900;
      letter-spacing: 2px;
    }

    .workflow-section h3 {
      margin: 12px 0 8px;
      font-size: 22px;
      color: white;
    }

    .workflow-section p {
      margin: 0;
      color: #cbd5e1;
      line-height: 1.6;
    }

    @media (max-width: 900px) {
      .hero-section {
        grid-template-columns: 1fr;
        margin-top: 55px;
      }

      .hero-text h2 {
        font-size: 42px;
      }

      .features-section {
        grid-template-columns: repeat(2, 1fr);
      }

      .workflow-section {
        grid-template-columns: 1fr;
      }

      .landing-nav {
        width: 100%;
        justify-content: space-between;
        flex-wrap: wrap;
      }
    }

    @media (max-width: 560px) {
      .landing-page {
        padding: 20px;
      }

      .landing-header {
        align-items: flex-start;
        gap: 16px;
        flex-direction: column;
      }

      .hero-text h2 {
        font-size: 36px;
      }

      .features-section {
        grid-template-columns: 1fr;
      }

      .hero-buttons {
        flex-direction: column;
      }

      .hero-buttons button,
      .hero-buttons a {
        text-align: center;
      }

      .dashboard-grid {
        grid-template-columns: 1fr;
      }

      .dashboard-product {
        flex-direction: column;
        align-items: flex-start;
      }

      .hero-mini-stats {
        flex-direction: column;
      }
    }
  `;

  if (authLoading) {
    return <div className="auth-screen">Yükleniyor...</div>;
  }

  if (!session && !showLogin) {
    return (
      <div className="landing-page">
        <style>{landingCss}</style>

        <header className="landing-header">
          <div className="landing-logo">
            <h1>3D STOK TAKİP</h1>
            <span>Akıllı stok ve maliyet yönetimi</span>
          </div>

          <nav className="landing-nav">
            <a href="#features">Özellikler</a>
            <a href="#workflow">Nasıl Çalışır?</a>
            <button onClick={() => setShowLogin(true)}>Giriş Yap</button>
          </nav>
        </header>

        <section className="hero-section">
          <div className="hero-text">
            <span className="hero-badge">
              3D Ürünler İçin Web Tabanlı Takip Sistemi
            </span>

            <h2>Stok, maliyet ve satış fiyatı tek panelde.</h2>

            <p>
              3D baskı ürünlerinizi kategori, malzeme, renk ve stok bilgileriyle
              yönetin. Maliyetleri hesaplayın, satış fiyatını belirleyin ve tüm
              verilerinize telefon ya da bilgisayardan ulaşın.
            </p>

            <div className="hero-buttons">
              <button onClick={() => setShowLogin(true)}>Panele Giriş Yap</button>
              <a href="#features">Sistemi İncele</a>
            </div>

            <div className="hero-mini-stats">
              <div>
                <strong>Online</strong>
                <span>Senkron veri</span>
              </div>
              <div>
                <strong>Mobil</strong>
                <span>Telefon uyumlu</span>
              </div>
              <div>
                <strong>Hızlı</strong>
                <span>Kolay stok işlemi</span>
              </div>
            </div>
          </div>

          <div className="hero-dashboard">
            <div className="dashboard-top">
              <div>
                <span>Örnek Önizleme</span>
                <h3>Stok Paneli</h3>
              </div>
              <strong>Demo</strong>
            </div>

            <div className="dashboard-grid">
              <div>
                <span>Ürün Yönetimi</span>
                <strong>Kolay</strong>
              </div>
              <div>
                <span>Stok Takibi</span>
                <strong>Senkron</strong>
              </div>
              <div>
                <span>Maliyet</span>
                <strong>Hesapla</strong>
              </div>
              <div>
                <span>Raporlama</span>
                <strong>Hazır</strong>
              </div>
            </div>

            <div className="dashboard-product">
              <div>
                <h4>Demo Ürün</h4>
                <p>PLA • Beyaz • Aydınlatma</p>
              </div>
              <span>Stok Takibi</span>
            </div>

            <div className="dashboard-product">
              <div>
                <h4>Demo Maliyet</h4>
                <p>Filament • İşçilik • Kâr Oranı</p>
              </div>
              <span>Hesaplama</span>
            </div>
          </div>
        </section>

        <section className="features-section" id="features">
          <div className="feature-card">
            <div>📦</div>
            <h3>Ürün Yönetimi</h3>
            <p>
              Ürün adı, kategori, malzeme, renk, açıklama ve stok bilgilerini
              düzenli şekilde kaydedin.
            </p>
          </div>

          <div className="feature-card">
            <div>📊</div>
            <h3>Stok Takibi</h3>
            <p>
              Stok artırma, azaltma, düşük stok kontrolü ve ürün arama
              işlemlerini hızlıca yapın.
            </p>
          </div>

          <div className="feature-card">
            <div>💰</div>
            <h3>Maliyet Hesabı</h3>
            <p>
              Filament, elektrik, işçilik, paketleme ve kâr oranına göre satış
              fiyatı hesaplayın.
            </p>
          </div>

          <div className="feature-card">
            <div>☁️</div>
            <h3>Cihazlar Arası Senkron</h3>
            <p>
              Telefon ve bilgisayardan aynı hesaba girerek kayıtlı verilere
              ulaşın.
            </p>
          </div>
        </section>

        <section className="workflow-section" id="workflow">
          <div>
            <span>01</span>
            <h3>Ürünleri Ekle</h3>
            <p>3D ürünlerini kategori ve stok bilgileriyle sisteme kaydet.</p>
          </div>

          <div>
            <span>02</span>
            <h3>Stokları Yönet</h3>
            <p>Gelen veya çıkan ürün miktarını hızlıca artır ya da azalt.</p>
          </div>

          <div>
            <span>03</span>
            <h3>Maliyeti Hesapla</h3>
            <p>Ürün maliyetini ve tahmini satış fiyatını panelden takip et.</p>
          </div>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-brand">
            <h1>3D STOK</h1>
            <span>TAKİP SİSTEMİ</span>
          </div>

          <h2>{authMode === "login" ? "Giriş Yap" : "Kayıt Ol"}</h2>

          <p>
            {authMode === "login"
              ? "Stok sistemine erişmek için mail ve şifrenizi girin."
              : "7 gün ücretsiz deneme için hesap oluşturun."}
          </p>

          <button
            className="back-to-landing"
            onClick={() => setShowLogin(false)}
          >
            ← Tanıtım Sayfasına Dön
          </button>

          <input
            type="email"
            placeholder="Mail adresi"
            value={authForm.email}
            onChange={(e) =>
              setAuthForm({ ...authForm, email: e.target.value })
            }
          />

          <input
            type="password"
            placeholder="Şifre"
            value={authForm.password}
            onChange={(e) =>
              setAuthForm({ ...authForm, password: e.target.value })
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                authMode === "login" ? signIn() : signUp();
              }
            }}
          />

          <button
            className="primary"
            onClick={authMode === "login" ? signIn : signUp}
          >
            {authMode === "login" ? "Giriş Yap" : "Kayıt Ol"}
          </button>

          <button
            className="secondary-button"
            onClick={() =>
              setAuthMode(authMode === "login" ? "signup" : "login")
            }
          >
            {authMode === "login"
              ? "Hesabın yok mu? Kayıt Ol"
              : "Zaten hesabın var mı? Giriş Yap"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <button
        className="category-toggle"
        onClick={() => setCategoryMenuOpen(true)}
      >
        ⋯
      </button>

      {categoryMenuOpen && (
        <div
          className="category-overlay"
          onClick={() => setCategoryMenuOpen(false)}
        >
          <div className="category-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="category-drawer-header">
              <h3>Kategoriler</h3>
              <button onClick={() => setCategoryMenuOpen(false)}>×</button>
            </div>

            <div className="category-list">
              {categories.map((category) => (
                <button
                  key={category}
                  className={
                    selectedCategory === category ? "active-category" : ""
                  }
                  onClick={() => {
                    setSelectedCategory(category);
                    setPage("products");
                    setCategoryMenuOpen(false);
                  }}
                >
                  <span>{category}</span>
                  <strong>{getCategoryCount(category)}</strong>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <aside className="sidebar">
        <div className="brand">
          <h1>3D STOK</h1>
          <span>TAKİP SİSTEMİ</span>
        </div>

        <nav>
          <button
            className={page === "dashboard" ? "nav-active" : ""}
            onClick={() => setPage("dashboard")}
          >
            📊 Ana Panel
          </button>

          <button
            className={page === "products" ? "nav-active" : ""}
            onClick={() => setPage("products")}
          >
            📦 Ürünler
          </button>

          <button
            className={page === "costs" ? "nav-active" : ""}
            onClick={() => setPage("costs")}
          >
            💰 Maliyet
          </button>

          <button
            className={page === "reports" ? "nav-active" : ""}
            onClick={() => setPage("reports")}
          >
            📈 Raporlar
          </button>

          <button
            className={page === "settings" ? "nav-active" : ""}
            onClick={() => setPage("settings")}
          >
            ⚙️ Ayarlar
          </button>

          <button onClick={signOut}>🚪 Çıkış Yap</button>
        </nav>

        <p className="side-note">
          {session.user.email}
          <br />
          <br />
          Supabase senkron aktif
        </p>
      </aside>

      <main className="content">
        {page === "dashboard" && (
          <>
            <header className="page-header">
              <div>
                <h2>Ana Panel</h2>
                <p>Ürün, stok, maliyet ve satış durumunu buradan takip edin.</p>
              </div>

              <span className="badge">
                {loading ? "Yükleniyor..." : "Online Senkron"}
              </span>
            </header>

            <section className="stats">
              <div className="stat-card">
                <div className="stat-icon">📦</div>
                <div>
                  <span>Toplam Ürün</span>
                  <strong>{products.length}</strong>
                </div>
              </div>

              <div className="stat-card green">
                <div className="stat-icon">📊</div>
                <div>
                  <span>Toplam Stok</span>
                  <strong>{totalStock}</strong>
                </div>
              </div>

              <div className="stat-card yellow">
                <div className="stat-icon">⚠️</div>
                <div>
                  <span>Düşük Stok</span>
                  <strong>{lowStock}</strong>
                </div>
              </div>

              <div className="stat-card red">
                <div className="stat-icon">💸</div>
                <div>
                  <span>Tahmini Kâr</span>
                  <strong>{(totalSale - totalCost).toFixed(2)} TL</strong>
                </div>
              </div>
            </section>

            <section className="panel">
              <h3>Genel Finans Özeti</h3>

              <div className="finance-row">
                <div>
                  <span>Toplam Maliyet</span>
                  <strong>{totalCost.toFixed(2)} TL</strong>
                </div>

                <div>
                  <span>Tahmini Satış</span>
                  <strong>{totalSale.toFixed(2)} TL</strong>
                </div>

                <div>
                  <span>Tahmini Kâr</span>
                  <strong>{(totalSale - totalCost).toFixed(2)} TL</strong>
                </div>
              </div>
            </section>
          </>
        )}

        {page === "products" && (
          <>
            <header className="page-header">
              <div>
                <h2>Ürünler</h2>
                <p>
                  3D ürünleri ekleyin ve stokları yönetin. Seçili kategori:{" "}
                  <strong>{selectedCategory}</strong>
                </p>
              </div>
            </header>

            <div className="search-box">
              <input
                type="text"
                placeholder="Ürün adı, kategori, malzeme, renk veya açıklama ara..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />

              {searchText && (
                <button onClick={() => setSearchText("")}>Temizle</button>
              )}
            </div>

            <section className="grid">
              <div className="panel form-panel">
                <h3>{editingProductId ? "Ürün Düzenle" : "Ürün Ekle"}</h3>

                <input
                  placeholder="Ürün adı"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />

                <input
                  placeholder="Kategori"
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                />

                <input
                  placeholder="Malzeme"
                  value={form.material}
                  onChange={(e) =>
                    setForm({ ...form, material: e.target.value })
                  }
                />

                <input
                  placeholder="Renk"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                />

                <input
                  placeholder="Stok adedi"
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />

                <input
                  placeholder="Üretim süresi"
                  value={form.productionTime}
                  onChange={(e) =>
                    setForm({ ...form, productionTime: e.target.value })
                  }
                />

                <textarea
                  placeholder="Açıklama"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />

                <button
                  className="primary"
                  onClick={editingProductId ? updateProduct : addProduct}
                >
                  {editingProductId ? "Ürünü Güncelle" : "Ürün Ekle"}
                </button>

                {editingProductId && (
                  <button
                    className="secondary-button"
                    onClick={resetProductForm}
                  >
                    Düzenlemeyi İptal Et
                  </button>
                )}
              </div>

              <div className="panel list-panel">
                <h3>Ürün Listesi</h3>

                <div className="product-list">
                  {filteredProducts.length === 0 && (
                    <p className="empty">
                      Bu kategoride veya aramada ürün yok.
                    </p>
                  )}

                  {filteredProducts.map((product) => (
                    <div className="product-card" key={product.id}>
                      <div className="product-info">
                        <h4>{product.name}</h4>

                        <div className="product-tags">
                          <span>{product.category || "Kategorisiz"}</span>
                          <span>{product.material || "Malzeme yok"}</span>
                          <span>{product.color || "Renk yok"}</span>
                        </div>

                        <span>Stok: {product.stock}</span>

                        <small>{product.description}</small>

                        <div className="stock-actions">
                          <input
                            type="number"
                            placeholder="Miktar"
                            value={stockAmount[product.id] || ""}
                            onChange={(e) =>
                              setStockAmount({
                                ...stockAmount,
                                [product.id]: e.target.value,
                              })
                            }
                          />

                          <button onClick={() => changeStock(product.id, 1)}>
                            +1
                          </button>

                          <button onClick={() => changeStock(product.id, -1)}>
                            -1
                          </button>

                          <button
                            onClick={() =>
                              changeStock(
                                product.id,
                                Number(stockAmount[product.id] || 0)
                              )
                            }
                          >
                            Stok Artır
                          </button>

                          <button
                            onClick={() =>
                              changeStock(
                                product.id,
                                -Number(stockAmount[product.id] || 0)
                              )
                            }
                          >
                            Stok Azalt
                          </button>

                          <button
                            onClick={() => {
                              setEditingProductId(product.id);

                              setForm({
                                name: product.name || "",
                                category: product.category || "",
                                material: product.material || "",
                                color: product.color || "",
                                stock: product.stock || "",
                                productionTime: product.production_time || "",
                                description: product.description || "",
                              });

                              window.scrollTo({
                                top: 0,
                                behavior: "smooth",
                              });
                            }}
                          >
                            Düzenle
                          </button>

                          <button
                            className="danger"
                            onClick={() => deleteProduct(product.id)}
                          >
                            Sil
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}

        {page === "costs" && (
          <>
            <header className="page-header">
              <div>
                <h2>Maliyet Hesabı</h2>
                <p>Ürün maliyetini ve satış fiyatını hesaplayın.</p>
              </div>
            </header>

            <section className="grid">
              <div className="panel form-panel">
                <h3>Maliyet Bilgileri</h3>

                <select
                  value={costForm.productId}
                  onChange={(e) =>
                    setCostForm({ ...costForm, productId: e.target.value })
                  }
                >
                  <option value="">Ürün seç</option>

                  {products.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  placeholder="Filament maliyeti"
                  value={costForm.filament}
                  onChange={(e) =>
                    setCostForm({ ...costForm, filament: e.target.value })
                  }
                />

                <input
                  type="number"
                  placeholder="Elektrik maliyeti"
                  value={costForm.electricity}
                  onChange={(e) =>
                    setCostForm({ ...costForm, electricity: e.target.value })
                  }
                />

                <input
                  type="number"
                  placeholder="İşçilik maliyeti"
                  value={costForm.labor}
                  onChange={(e) =>
                    setCostForm({ ...costForm, labor: e.target.value })
                  }
                />

                <input
                  type="number"
                  placeholder="Paketleme maliyeti"
                  value={costForm.packaging}
                  onChange={(e) =>
                    setCostForm({ ...costForm, packaging: e.target.value })
                  }
                />

                <input
                  type="number"
                  placeholder="Ekstra maliyet"
                  value={costForm.extra}
                  onChange={(e) =>
                    setCostForm({ ...costForm, extra: e.target.value })
                  }
                />

                <input
                  type="number"
                  placeholder="Kâr oranı (%)"
                  value={costForm.profitRate}
                  onChange={(e) =>
                    setCostForm({ ...costForm, profitRate: e.target.value })
                  }
                />

                <div className="result-box">
                  <p>Toplam Maliyet: {costResult.totalCost.toFixed(2)} TL</p>

                  <strong>
                    Satış Fiyatı: {costResult.salePrice.toFixed(2)} TL
                  </strong>
                </div>

                <button className="primary" onClick={saveCost}>
                  Maliyeti Kaydet
                </button>
              </div>

              <div className="panel list-panel">
                <h3>Kayıtlı Maliyetler</h3>

                {costs.length === 0 && (
                  <p className="empty">Henüz maliyet kaydı yok.</p>
                )}

                <div className="cost-list">
                  {costs.map((cost) => (
                    <div className="cost-card" key={cost.id}>
                      <h4>{cost.product_name}</h4>

                      <p>
                        Toplam Maliyet:{" "}
                        {Number(cost.total_cost).toFixed(2)} TL
                      </p>

                      <strong>
                        Satış Fiyatı: {Number(cost.sale_price).toFixed(2)} TL
                      </strong>

                      <span>Kâr Oranı: %{cost.profit_rate}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}

        {page === "reports" && (
          <>
            <header className="page-header">
              <div>
                <h2>Raporlar</h2>
                <p>Stok ve finans durumunu özet olarak görüntüleyin.</p>
              </div>
            </header>

            <section className="stats">
              <div className="stat-card">
                <span>Ürün Sayısı</span>
                <strong>{products.length}</strong>
              </div>

              <div className="stat-card green">
                <span>Toplam Stok</span>
                <strong>{totalStock}</strong>
              </div>

              <div className="stat-card yellow">
                <span>Düşük Stok</span>
                <strong>{lowStock}</strong>
              </div>

              <div className="stat-card red">
                <span>Kayıtlı Maliyet</span>
                <strong>{costs.length}</strong>
              </div>
            </section>

            <section className="panel">
              <h3>Düşük Stoklu Ürünler</h3>

              {products.filter((p) => Number(p.stock) <= 5).length === 0 ? (
                <p className="empty">Düşük stoklu ürün yok.</p>
              ) : (
                products
                  .filter((p) => Number(p.stock) <= 5)
                  .map((p) => (
                    <div className="report-row" key={p.id}>
                      <span>{p.name}</span>
                      <strong>{p.stock} adet</strong>
                    </div>
                  ))
              )}
            </section>
          </>
        )}

        {page === "settings" && (
          <>
            <header className="page-header">
              <div>
                <h2>Ayarlar</h2>
                <p>Hesap, plan ve abonelik bilgilerinizi buradan yönetin.</p>
              </div>
            </header>

            <section className="settings-grid">
              <div className="panel settings-card">
                <h3>Hesap Bilgileri</h3>

                <div className="settings-row">
                  <span>E-posta</span>
                  <strong>{session.user.email}</strong>
                </div>

                <div className="settings-row">
                  <span>Hesap Durumu</span>
                  <strong>Aktif</strong>
                </div>

                <div className="settings-row">
                  <span>Veri Senkronizasyonu</span>
                  <strong>Supabase Aktif</strong>
                </div>
              </div>

              <div className="panel settings-card premium-card">
                <h3>Abonelik Planı</h3>

                <div className="plan-badge">
                  {profile?.plan === "pro" ? "Pro Plan" : "Free Plan"}
                </div>

                <p>
                  Şu anda 7 günlük ücretsiz deneme sürümündesiniz. Deneme
                  süresi sonunda plan yükseltme alanı aktif edilebilir.
                </p>

                <div className="settings-row">
                  <span>Plan</span>
                  <strong>{profile?.plan || "free"}</strong>
                </div>

                <div className="settings-row">
                  <span>Deneme Süresi</span>
                  <strong>7 Gün</strong>
                </div>

                <div className="settings-row">
                  <span>Ödeme Durumu</span>
                  <strong>Demo / Pasif</strong>
                </div>

                <button className="primary" disabled>
                  Plan Yükseltme Yakında
                </button>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;