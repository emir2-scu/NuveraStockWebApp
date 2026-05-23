import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";

function App() {
  const [page, setPage] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [costs, setCosts] = useState([]);
  const [loading, setLoading] = useState(false);

  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
  });

  const [form, setForm] = useState({
    name: "",
    category: "",
    material: "",
    color: "",
    stock: "",
    productionTime: "",
    description: "",
    image: "",
  });

  const [costForm, setCostForm] = useState({
    productId: "",
    filament: "",
    electricity: "",
    labor: "",
    packaging: "",
    extra: "",
    profitRate: "",
  });

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
    if (session) {
      fetchProducts();
      fetchCosts();
    }
  }, [session]);

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

  const signOut = async () => {
    await supabase.auth.signOut();

    setProducts([]);
    setCosts([]);
    setPage("dashboard");
  };

  const fetchProducts = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert("Ürünler alınırken hata oluştu: " + error.message);
    } else {
      setProducts(data || []);
    }

    setLoading(false);
  };

  const fetchCosts = async () => {
    const { data, error } = await supabase
      .from("costs")
      .select("*")
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

  const addProduct = async () => {
    if (!form.name || !form.stock) {
      alert("Ürün adı ve stok adedi boş bırakılamaz.");
      return;
    }

    const newProduct = {
      id: Date.now(),
      name: form.name,
      category: form.category,
      material: form.material,
      color: form.color,
      stock: Number(form.stock),
      production_time: form.productionTime,
      description: form.description,
      image: form.image,
    };

    const { error } = await supabase.from("products").insert([newProduct]);

    if (error) {
      alert("Ürün eklenirken hata oluştu: " + error.message);
      return;
    }

    setForm({
      name: "",
      category: "",
      material: "",
      color: "",
      stock: "",
      productionTime: "",
      description: "",
      image: "",
    });

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

    const newStock = Math.max(0, Number(product.stock) + amount);

    const { error } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", id);

    if (error) {
      alert("Stok güncellenirken hata oluştu: " + error.message);
      return;
    }

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

    setCostForm({
      productId: "",
      filament: "",
      electricity: "",
      labor: "",
      packaging: "",
      extra: "",
      profitRate: "",
    });

    await fetchCosts();
  };

  const costResult = calculateCost();

  if (authLoading) {
    return <div className="auth-screen">Yükleniyor...</div>;
  }

  if (!session) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-brand">
            <h1>NUVERA</h1>
            <span>STOCK WEB</span>
          </div>

          <h2>Giriş Yap</h2>
          <p>Stok sistemine erişmek için mail ve şifrenizi girin.</p>

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
              if (e.key === "Enter") signIn();
            }}
          />

          <button className="primary" onClick={signIn}>
            Giriş Yap
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <h1>NUVERA</h1>
          <span>STOCK WEB</span>
        </div>

        <nav>
          <button onClick={() => setPage("dashboard")}>Ana Panel</button>
          <button onClick={() => setPage("products")}>Ürünler</button>
          <button onClick={() => setPage("costs")}>Maliyet</button>
          <button onClick={() => setPage("reports")}>Raporlar</button>
          <button onClick={signOut}>Çıkış Yap</button>
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
                <span>Toplam Ürün</span>
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
                <span>Tahmini Kâr</span>
                <strong>{(totalSale - totalCost).toFixed(2)} TL</strong>
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
                <p>3D ürünleri ekleyin, görsel seçin ve stokları yönetin.</p>
              </div>
            </header>

            <section className="grid">
              <div className="panel form-panel">
                <h3>Ürün Ekle</h3>

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

                <label className="file-label">
                  Görsel Seç
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];

                      if (!file) return;

                      const reader = new FileReader();

                      reader.onload = () =>
                        setForm({ ...form, image: reader.result });

                      reader.readAsDataURL(file);
                    }}
                  />
                </label>

                {form.image && (
                  <img className="preview" src={form.image} alt="Ürün" />
                )}

                <button className="primary" onClick={addProduct}>
                  Ürün Ekle
                </button>
              </div>

              <div className="panel list-panel">
                <h3>Ürün Listesi</h3>

                <div className="product-list">
                  {products.length === 0 && (
                    <p className="empty">Henüz ürün eklenmedi.</p>
                  )}

                  {products.map((product) => (
                    <div className="product-card" key={product.id}>
                      {product.image ? (
                        <img src={product.image} alt={product.name} />
                      ) : (
                        <div className="no-image">Görsel Yok</div>
                      )}

                      <div className="product-info">
                        <h4>{product.name}</h4>

                        <p>
                          {product.category} • {product.material} •{" "}
                          {product.color}
                        </p>

                        <span>Stok: {product.stock}</span>

                        <small>{product.description}</small>

                        <div className="stock-actions">
                          <button onClick={() => changeStock(product.id, 1)}>
                            +1
                          </button>

                          <button onClick={() => changeStock(product.id, -1)}>
                            -1
                          </button>

                          <button onClick={() => changeStock(product.id, 10)}>
                            +10
                          </button>

                          <button onClick={() => changeStock(product.id, -10)}>
                            -10
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
      </main>
    </div>
  );
}

export default App;