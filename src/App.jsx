import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";

const ADMIN_EMAIL = "emir93716@gmail.com";
const FREE_PRODUCT_LIMIT = 20;

function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [activePage, setActivePage] = useState("dashboard");

  const [products, setProducts] = useState([]);
  const [costs, setCosts] = useState([]);

  const [productForm, setProductForm] = useState({
    name: "",
    category: "",
    material: "",
    stock: "",
    unit_cost: "",
    sale_price: "",
  });

  const [costForm, setCostForm] = useState({
    title: "",
    amount: "",
    note: "",
  });

  const isAdmin =
    user?.email === ADMIN_EMAIL || profile?.is_admin === true;

  const currentPlan = isAdmin ? "Admin Plan" : profile?.plan === "pro" ? "Pro Plan" : "Free Plan";
  const productLimit = isAdmin || profile?.plan === "pro" ? "Sınırsız" : FREE_PRODUCT_LIMIT;

  const totalStock = useMemo(() => {
    return products.reduce((total, item) => total + Number(item.stock || 0), 0);
  }, [products]);

  const totalCost = useMemo(() => {
    return costs.reduce((total, item) => total + Number(item.amount || 0), 0);
  }, [costs]);

  const averageProductCost = useMemo(() => {
    if (products.length === 0) return 0;
    const total = products.reduce((sum, item) => sum + Number(item.unit_cost || 0), 0);
    return total / products.length;
  }, [products]);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const currentUser = data?.session?.user || null;

      setUser(currentUser);

      if (currentUser) {
        await prepareUser(currentUser);
        await loadData(currentUser.id);
      }

      setLoading(false);
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);

      if (currentUser) {
        await prepareUser(currentUser);
        await loadData(currentUser.id);
      } else {
        setProfile(null);
        setProducts([]);
        setCosts([]);
        setActivePage("dashboard");
      }
    });

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const prepareUser = async (currentUser) => {
    const fallbackProfile = {
      id: currentUser.id,
      email: currentUser.email,
      plan: "free",
      is_admin: currentUser.email === ADMIN_EMAIL,
    };

    const { data: existingProfile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (error) {
      setProfile(fallbackProfile);
      return;
    }

    if (!existingProfile) {
      const { data: newProfile } = await supabase
        .from("profiles")
        .insert([
          {
            id: currentUser.id,
            email: currentUser.email,
            plan: "free",
            is_admin: currentUser.email === ADMIN_EMAIL,
          },
        ])
        .select()
        .single();

      setProfile(newProfile || fallbackProfile);
      return;
    }

    setProfile(existingProfile);
  };

  const loadData = async (userId) => {
    setDataLoading(true);

    const { data: productData } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    const { data: costData } = await supabase
      .from("costs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    setProducts(productData || []);
    setCosts(costData || []);

    setDataLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setAuthLoading(false);

    if (error) {
      alert("Giriş yapılamadı: " + error.message);
      return;
    }

    setEmail("");
    setPassword("");
    setShowAuth(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setAuthLoading(false);

    if (error) {
      alert("Kayıt oluşturulamadı: " + error.message);
      return;
    }

    alert("Kayıt başarılı. Şimdi giriş yapabilirsin.");
    setAuthMode("login");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleProductChange = (e) => {
    const { name, value } = e.target;
    setProductForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCostChange = (e) => {
    const { name, value } = e.target;
    setCostForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const addProduct = async (e) => {
    e.preventDefault();

    if (!user) return;

    if (!isAdmin && profile?.plan !== "pro" && products.length >= FREE_PRODUCT_LIMIT) {
      alert("Free Plan ürün limiti doldu. Pro Plan ile sınırsız ürün ekleyebilirsin.");
      return;
    }

    if (!productForm.name.trim()) {
      alert("Ürün adı zorunlu.");
      return;
    }

    const { error } = await supabase.from("products").insert([
      {
        user_id: user.id,
        name: productForm.name.trim(),
        category: productForm.category.trim(),
        material: productForm.material.trim(),
        stock: Number(productForm.stock || 0),
        unit_cost: Number(productForm.unit_cost || 0),
        sale_price: Number(productForm.sale_price || 0),
      },
    ]);

    if (error) {
      alert("Ürün eklenemedi: " + error.message);
      return;
    }

    setProductForm({
      name: "",
      category: "",
      material: "",
      stock: "",
      unit_cost: "",
      sale_price: "",
    });

    await loadData(user.id);
  };

  const deleteProduct = async (id) => {
    if (!user) return;

    const confirmDelete = window.confirm("Bu ürünü silmek istiyor musun?");
    if (!confirmDelete) return;

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      alert("Ürün silinemedi: " + error.message);
      return;
    }

    await loadData(user.id);
  };

  const addCost = async (e) => {
    e.preventDefault();

    if (!user) return;

    if (!costForm.title.trim()) {
      alert("Maliyet başlığı zorunlu.");
      return;
    }

    const { error } = await supabase.from("costs").insert([
      {
        user_id: user.id,
        title: costForm.title.trim(),
        amount: Number(costForm.amount || 0),
        note: costForm.note.trim(),
      },
    ]);

    if (error) {
      alert("Maliyet eklenemedi: " + error.message);
      return;
    }

    setCostForm({
      title: "",
      amount: "",
      note: "",
    });

    await loadData(user.id);
  };

  const deleteCost = async (id) => {
    if (!user) return;

    const confirmDelete = window.confirm("Bu maliyet kaydını silmek istiyor musun?");
    if (!confirmDelete) return;

    const { error } = await supabase
      .from("costs")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      alert("Maliyet silinemedi: " + error.message);
      return;
    }

    await loadData(user.id);
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-card">
          <div className="loading-logo">N</div>
          <p>Nuvera Stock yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="landing-page">
        <header className="landing-header">
          <div className="landing-logo">
            <div className="logo-mark">N</div>
            <div>
              <strong>Nuvera Stock</strong>
              <span>3D Baskı Stok Paneli</span>
            </div>
          </div>

          <nav className="landing-nav">
            <a href="#features">Özellikler</a>
            <a href="#pricing">Fiyatlandırma</a>
            <button
              className="nav-login-button"
              onClick={() => {
                setShowAuth(true);
                setAuthMode("login");
              }}
            >
              Giriş Yap
            </button>
          </nav>
        </header>

        <main className="hero-section">
          <section className="hero-text">
            <span className="hero-badge">
              3D Baskı Üreticileri İçin Akıllı Stok Takibi
            </span>

            <h1>3D Baskı Ürünleriniz İçin Stok ve Maliyet Takip Sistemi</h1>

            <p>
              Nuvera Stock ile ürünlerinizi, malzemelerinizi, stok durumunuzu ve
              üretim maliyetlerinizi tek bir web panelinden kolayca yönetin.
            </p>

            <p className="hero-seo-text">
              3D baskı işiyle uğraşan üreticiler, tasarımcılar ve küçük
              işletmeler için geliştirilen Nuvera Stock; stok takibi, malzeme
              yönetimi, ürün takibi ve maliyet kontrolünü sade bir panelde
              birleştirir.
            </p>

            <div className="hero-actions">
              <button
                className="primary-button"
                onClick={() => {
                  setShowAuth(true);
                  setAuthMode("register");
                }}
              >
                Ücretsiz Başla
              </button>

              <a className="secondary-button" href="#pricing">
                Planları İncele
              </a>
            </div>

            <div className="hero-highlights">
              <span>✓ Kullanıcıya özel veri</span>
              <span>✓ Free Plan</span>
              <span>✓ Admin sistemi</span>
            </div>
          </section>

          <section className="hero-visual-card">
            <div className="mock-dashboard">
              <aside className="mock-sidebar">
                <div className="mock-sidebar-logo">N</div>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </aside>

              <div className="mock-content">
                <div className="mock-topbar">
                  <div>
                    <strong>Stok Paneli</strong>
                    <small>Nuvera Stock Dashboard</small>
                  </div>
                  <span>Admin</span>
                </div>

                <div className="mock-stats">
                  <div>
                    <strong>248</strong>
                    <small>Ürün</small>
                  </div>
                  <div>
                    <strong>₺58,40</strong>
                    <small>Ort. Maliyet</small>
                  </div>
                  <div>
                    <strong>92%</strong>
                    <small>Stok Takibi</small>
                  </div>
                </div>

                <div className="mock-chart">
                  <span style={{ height: "45%" }}></span>
                  <span style={{ height: "70%" }}></span>
                  <span style={{ height: "55%" }}></span>
                  <span style={{ height: "90%" }}></span>
                  <span style={{ height: "65%" }}></span>
                  <span style={{ height: "80%" }}></span>
                </div>

                <div className="mock-products">
                  <div>
                    <span className="product-dot"></span>
                    PLA Anahtarlık
                    <strong>124 adet</strong>
                  </div>
                  <div>
                    <span className="product-dot"></span>
                    PETG Telefon Standı
                    <strong>48 adet</strong>
                  </div>
                  <div>
                    <span className="product-dot"></span>
                    ABS Figür Seti
                    <strong>36 adet</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="hero-floating-card floating-card-one">
              <strong>+248</strong>
              <span>takip edilen ürün</span>
            </div>

            <div className="hero-floating-card floating-card-two">
              <strong>₺58,40</strong>
              <span>ortalama maliyet</span>
            </div>
          </section>
        </main>

        <section id="features" className="landing-features">
          <div className="section-title">
            <span>Özellikler</span>
            <h2>Stok, malzeme ve maliyet yönetimi tek panelde</h2>
          </div>

          <div className="feature-grid">
            <div className="feature-card">
              <h3>Ürün Takibi</h3>
              <p>3D baskı ürünlerinizi stok miktarı, kategori ve satış fiyatı ile kaydedin.</p>
            </div>

            <div className="feature-card">
              <h3>Maliyet Kontrolü</h3>
              <p>Malzeme, üretim ve operasyon maliyetlerinizi düzenli şekilde takip edin.</p>
            </div>

            <div className="feature-card">
              <h3>Kullanıcıya Özel Veri</h3>
              <p>Her kullanıcı yalnızca kendi ürünlerini ve maliyet kayıtlarını görür.</p>
            </div>

            <div className="feature-card">
              <h3>Plan Sistemi</h3>
              <p>Free Plan ile başlayın, Pro Plan ile sınırsız ürün yönetimine geçin.</p>
            </div>
          </div>
        </section>

        <section id="pricing" className="landing-pricing">
          <div className="section-title">
            <span>Fiyatlandırma</span>
            <h2>İhtiyacınıza göre plan seçin</h2>
          </div>

          <div className="app-pricing-grid">
            <div className="pricing-card">
              <h3>Free Plan</h3>
              <strong>0 TL / ay</strong>
              <p>Başlangıç için ideal.</p>
              <ul>
                <li>20 ürün limiti</li>
                <li>Stok takibi</li>
                <li>Maliyet kaydı</li>
              </ul>
            </div>

            <div className="pricing-card highlighted">
              <h3>Pro Plan</h3>
              <strong>149 TL / ay</strong>
              <p>Büyüyen üreticiler için.</p>
              <ul>
                <li>Sınırsız ürün</li>
                <li>Sınırsız maliyet kaydı</li>
                <li>Gelişmiş takip paneli</li>
              </ul>
            </div>

            <div className="pricing-card">
              <h3>Business Plan</h3>
              <strong>299 TL / ay</strong>
              <p>Profesyonel işletmeler için.</p>
              <ul>
                <li>Ekip kullanımı</li>
                <li>Öncelikli destek</li>
                <li>Gelişmiş yönetim</li>
              </ul>
            </div>
          </div>
        </section>

        {showAuth && (
          <div className="auth-overlay">
            <div className="auth-card">
              <button className="auth-close" onClick={() => setShowAuth(false)}>
                ×
              </button>

              <h2>{authMode === "login" ? "Giriş Yap" : "Ücretsiz Kayıt Ol"}</h2>
              <p>
                {authMode === "login"
                  ? "Nuvera Stock panelinize giriş yapın."
                  : "Mail ve şifre ile hesabınızı oluşturun."}
              </p>

              <form onSubmit={authMode === "login" ? handleLogin : handleRegister}>
                <input
                  type="email"
                  placeholder="E-posta"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <input
                  type="password"
                  placeholder="Şifre"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />

                <button className="primary-button full-button" disabled={authLoading}>
                  {authLoading
                    ? "İşleniyor..."
                    : authMode === "login"
                    ? "Giriş Yap"
                    : "Kayıt Ol"}
                </button>
              </form>

              <button
                className="switch-auth-button"
                onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
              >
                {authMode === "login"
                  ? "Hesabın yok mu? Kayıt ol"
                  : "Zaten hesabın var mı? Giriş yap"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <div className="logo-mark">N</div>
          <div>
            <strong>Nuvera Stock</strong>
            <span>{currentPlan}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={activePage === "dashboard" ? "active" : ""}
            onClick={() => setActivePage("dashboard")}
          >
            Dashboard
          </button>

          <button
            className={activePage === "products" ? "active" : ""}
            onClick={() => setActivePage("products")}
          >
            Ürünler
          </button>

          <button
            className={activePage === "costs" ? "active" : ""}
            onClick={() => setActivePage("costs")}
          >
            Maliyetler
          </button>

          <button
            className={activePage === "settings" ? "active" : ""}
            onClick={() => setActivePage("settings")}
          >
            Ayarlar
          </button>
        </nav>

        <button className="logout-button" onClick={handleLogout}>
          Çıkış Yap
        </button>
      </aside>

      <main className="app-main">
        <header className="app-topbar">
          <div>
            <h1>
              {activePage === "dashboard" && "Dashboard"}
              {activePage === "products" && "Ürünler"}
              {activePage === "costs" && "Maliyetler"}
              {activePage === "settings" && "Ayarlar"}
            </h1>
            <p>{user.email}</p>
          </div>

          <div className="plan-pill">
            {isAdmin ? "Admin • Sınırsız" : `${currentPlan} • Limit: ${productLimit}`}
          </div>
        </header>

        {dataLoading && <div className="info-banner">Veriler yükleniyor...</div>}

        {activePage === "dashboard" && (
          <section className="dashboard-page">
            <div className="stats-grid">
              <div className="stat-card">
                <span>Toplam Ürün</span>
                <strong>{products.length}</strong>
                <small>Limit: {productLimit}</small>
              </div>

              <div className="stat-card">
                <span>Toplam Stok</span>
                <strong>{totalStock}</strong>
                <small>Adet ürün stoğu</small>
              </div>

              <div className="stat-card">
                <span>Ortalama Maliyet</span>
                <strong>₺{averageProductCost.toFixed(2)}</strong>
                <small>Ürün başına</small>
              </div>

              <div className="stat-card">
                <span>Ek Maliyetler</span>
                <strong>₺{totalCost.toFixed(2)}</strong>
                <small>Kayıtlı maliyet toplamı</small>
              </div>
            </div>

            <div className="panel-card">
              <h2>Son Eklenen Ürünler</h2>

              {products.length === 0 ? (
                <p className="empty-text">Henüz ürün eklenmedi.</p>
              ) : (
                <div className="simple-list">
                  {products.slice(0, 5).map((item) => (
                    <div key={item.id}>
                      <span>{item.name}</span>
                      <strong>{item.stock || 0} adet</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {activePage === "products" && (
          <section className="products-page">
            <div className="panel-card">
              <h2>Yeni Ürün Ekle</h2>

              {!isAdmin && profile?.plan !== "pro" && (
                <p className="limit-text">
                  Free Plan kullanıyorsun. Ürün limitin: {products.length}/{FREE_PRODUCT_LIMIT}
                </p>
              )}

              <form className="form-grid" onSubmit={addProduct}>
                <input
                  name="name"
                  placeholder="Ürün adı"
                  value={productForm.name}
                  onChange={handleProductChange}
                  required
                />

                <input
                  name="category"
                  placeholder="Kategori"
                  value={productForm.category}
                  onChange={handleProductChange}
                />

                <input
                  name="material"
                  placeholder="Malzeme"
                  value={productForm.material}
                  onChange={handleProductChange}
                />

                <input
                  name="stock"
                  type="number"
                  placeholder="Stok adedi"
                  value={productForm.stock}
                  onChange={handleProductChange}
                />

                <input
                  name="unit_cost"
                  type="number"
                  step="0.01"
                  placeholder="Birim maliyet"
                  value={productForm.unit_cost}
                  onChange={handleProductChange}
                />

                <input
                  name="sale_price"
                  type="number"
                  step="0.01"
                  placeholder="Satış fiyatı"
                  value={productForm.sale_price}
                  onChange={handleProductChange}
                />

                <button className="primary-button">Ürün Ekle</button>
              </form>
            </div>

            <div className="panel-card">
              <h2>Ürün Listesi</h2>

              {products.length === 0 ? (
                <p className="empty-text">Henüz ürün yok.</p>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Ürün</th>
                        <th>Kategori</th>
                        <th>Malzeme</th>
                        <th>Stok</th>
                        <th>Maliyet</th>
                        <th>Satış</th>
                        <th></th>
                      </tr>
                    </thead>

                    <tbody>
                      {products.map((item) => (
                        <tr key={item.id}>
                          <td>{item.name}</td>
                          <td>{item.category || "-"}</td>
                          <td>{item.material || "-"}</td>
                          <td>{item.stock || 0}</td>
                          <td>₺{Number(item.unit_cost || 0).toFixed(2)}</td>
                          <td>₺{Number(item.sale_price || 0).toFixed(2)}</td>
                          <td>
                            <button
                              className="delete-button"
                              onClick={() => deleteProduct(item.id)}
                            >
                              Sil
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {activePage === "costs" && (
          <section className="costs-page">
            <div className="panel-card">
              <h2>Maliyet Ekle</h2>

              <form className="form-grid" onSubmit={addCost}>
                <input
                  name="title"
                  placeholder="Maliyet başlığı"
                  value={costForm.title}
                  onChange={handleCostChange}
                  required
                />

                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  placeholder="Tutar"
                  value={costForm.amount}
                  onChange={handleCostChange}
                />

                <input
                  name="note"
                  placeholder="Not"
                  value={costForm.note}
                  onChange={handleCostChange}
                />

                <button className="primary-button">Maliyet Ekle</button>
              </form>
            </div>

            <div className="panel-card">
              <h2>Maliyet Kayıtları</h2>

              {costs.length === 0 ? (
                <p className="empty-text">Henüz maliyet kaydı yok.</p>
              ) : (
                <div className="simple-list">
                  {costs.map((item) => (
                    <div key={item.id}>
                      <span>
                        {item.title}
                        {item.note ? <small> — {item.note}</small> : null}
                      </span>

                      <strong>₺{Number(item.amount || 0).toFixed(2)}</strong>

                      <button
                        className="delete-button"
                        onClick={() => deleteCost(item.id)}
                      >
                        Sil
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {activePage === "settings" && (
          <section className="settings-page">
            <div className="settings-grid">
              <div className="panel-card">
                <h2>Hesap Bilgileri</h2>

                <div className="settings-list">
                  <div>
                    <span>E-posta</span>
                    <strong>{user.email}</strong>
                  </div>

                  <div>
                    <span>Mevcut Plan</span>
                    <strong>{currentPlan}</strong>
                  </div>

                  <div>
                    <span>Ürün Limiti</span>
                    <strong>{productLimit}</strong>
                  </div>

                  <div>
                    <span>Admin Yetkisi</span>
                    <strong>{isAdmin ? "Var" : "Yok"}</strong>
                  </div>
                </div>
              </div>

              <div className="panel-card plans-panel">
                <h2>Plan Seçenekleri</h2>

                <div className="app-pricing-grid">
                  <div className="pricing-card">
                    <h3>Free Plan</h3>
                    <strong>0 TL / ay</strong>
                    <p>20 ürün limiti</p>
                  </div>

                  <div className="pricing-card highlighted">
                    <h3>Pro Plan</h3>
                    <strong>149 TL / ay</strong>
                    <p>Sınırsız ürün</p>
                  </div>

                  <div className="pricing-card">
                    <h3>Business Plan</h3>
                    <strong>299 TL / ay</strong>
                    <p>İşletmeler için gelişmiş kullanım</p>
                  </div>
                </div>

                <p className="settings-note">
                  Ödeme sistemi sonraki aşamada eklenecek. Şu anda admin hesap
                  sınırsız kullanım yetkisine sahiptir.
                </p>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;