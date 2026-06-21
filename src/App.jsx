import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";

function App() {
  const [page, setPage] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [costs, setCosts] = useState([]);
  const [salesNotes, setSalesNotes] = useState([]);
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

  const emptySaleForm = {
    customerName: "",
    productId: "",
    quantity: "1",
    totalAmount: "",
    saleDate: new Date().toISOString().slice(0, 10),
    note: "",
  };

  const [form, setForm] = useState(emptyProductForm);
  const [costForm, setCostForm] = useState(emptyCostForm);
  const [saleForm, setSaleForm] = useState(emptySaleForm);

  useEffect(() => {
    const getCurrentSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.log("Session alınırken hata:", error.message);
          setSession(null);
          return;
        }

        setSession(data?.session || null);
      } catch (error) {
        console.log("Beklenmeyen session hatası:", error);
        setSession(null);
      } finally {
        setAuthLoading(false);
      }
    };

    getCurrentSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session?.user) {
      fetchProfile();
      fetchProducts();
      fetchCosts();
      fetchSalesNotes();
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
      const isMainAdmin = session.user.email === "emir93716@gmail.com";

      const { data: createdProfile, error: createError } = await supabase
        .from("profiles")
        .insert([
          {
            id: session.user.id,
            email: session.user.email,
            plan: isMainAdmin ? "admin" : "free",
            is_admin: isMainAdmin,
          },
        ])
        .select()
        .single();

      if (createError) {
        console.log(createError);
      } else {
        setProfile(createdProfile);
      }
    } else {
      setProfile(data);
    }
  };

  const signIn = async () => {
    const cleanEmail = authForm.email.trim();

    if (!cleanEmail || !authForm.password) {
      alert("Mail ve şifre boş bırakılamaz.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: authForm.password,
    });

    if (error) {
      alert("Giriş yapılamadı: " + error.message);
      return;
    }

    setAuthForm({
      email: "",
      password: "",
    });
  };

  const signUp = async () => {
    const cleanEmail = authForm.email.trim();

    if (!cleanEmail || !authForm.password) {
      alert("Mail ve şifre boş bırakılamaz.");
      return;
    }

    if (authForm.password.length < 6) {
      alert("Şifre en az 6 karakter olmalı.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: authForm.password,
    });

    if (error) {
      alert("Kayıt oluşturulamadı: " + error.message);
      return;
    }

    alert("Kayıt oluşturuldu. Şimdi aynı mail ve şifreyle giriş yapabilirsin.");
    setAuthMode("login");
    setAuthForm({
      email: cleanEmail,
      password: "",
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProducts([]);
    setCosts([]);
    setSalesNotes([]);
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

  const fetchSalesNotes = async () => {
    if (!session?.user) return;

    const { data, error } = await supabase
      .from("sales_notes")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("is_paid", false)
      .order("sale_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      alert("Satış defteri alınırken hata oluştu: " + error.message);
    } else {
      setSalesNotes(data || []);
    }
  };

  const totalStock = products.reduce((sum, p) => sum + Number(p.stock || 0), 0);
  const lowStock = products.filter((p) => Number(p.stock) <= 5).length;
  const totalCost = costs.reduce((sum, c) => sum + Number(c.total_cost || 0), 0);
  const totalSale = costs.reduce((sum, c) => sum + Number(c.sale_price || 0), 0);
  const actualSalesTotal = salesNotes.reduce(
    (sum, sale) => sum + Number(sale.total_amount || 0),
    0
  );
  const soldQuantityTotal = salesNotes.reduce(
    (sum, sale) => sum + Number(sale.quantity || 0),
    0
  );
  const averageSaleAmount =
    salesNotes.length > 0 ? actualSalesTotal / salesNotes.length : 0;

  const formatCurrency = (value) =>
    Number(value || 0).toLocaleString("tr-TR", {
      style: "currency",
      currency: "TRY",
    });

  const formatSaleDate = (value) => {
    if (!value) return "-";
    return new Date(`${value}T00:00:00`).toLocaleDateString("tr-TR");
  };

  const isAdmin =
    profile?.is_admin === true ||
    profile?.plan === "admin" ||
    session?.user?.email === "emir93716@gmail.com";

  const isPro = profile?.plan === "pro" || profile?.plan === "business";
  const freeProductLimit = 20;
  const canAddMoreProducts =
    isAdmin || isPro || products.length < freeProductLimit;

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

    if (!canAddMoreProducts) {
      alert(
        "Free Plan'da en fazla 20 ürün ekleyebilirsiniz. Daha fazla ürün için Pro plana geçmeniz gerekir."
      );
      return;
    }

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

  const saveSaleNote = async () => {
    if (!session?.user) return;

    const customerName = saleForm.customerName.trim();
    const selectedProduct = products.find(
      (product) => String(product.id) === String(saleForm.productId)
    );
    const quantity = Number(saleForm.quantity);
    const totalAmount = Number(saleForm.totalAmount);

    if (!customerName) {
      alert("Satış yapılan kişinin adını yazınız.");
      return;
    }

    if (!selectedProduct) {
      alert("Lütfen satılan ürünü seçiniz.");
      return;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      alert("Satış adedi 1 veya daha büyük bir tam sayı olmalıdır.");
      return;
    }

    if (!Number.isFinite(totalAmount) || totalAmount < 0) {
      alert("Lütfen geçerli bir satış tutarı giriniz.");
      return;
    }

    if (!saleForm.saleDate) {
      alert("Lütfen satış tarihini seçiniz.");
      return;
    }

    if (Number(selectedProduct.stock || 0) < quantity) {
      alert(
        `Yetersiz stok. ${selectedProduct.name} için mevcut stok: ${selectedProduct.stock}`
      );
      return;
    }

    const saleRecord = {
      user_id: session.user.id,
      customer_name: customerName,
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      quantity,
      total_amount: totalAmount,
      sale_date: saleForm.saleDate,
      note: saleForm.note.trim(),
    };

    const { data: insertedSale, error: insertError } = await supabase
      .from("sales_notes")
      .insert([saleRecord])
      .select()
      .single();

    if (insertError) {
      alert("Satış kaydedilirken hata oluştu: " + insertError.message);
      return;
    }

    const newStock = Number(selectedProduct.stock || 0) - quantity;

    const { error: stockError } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", selectedProduct.id)
      .eq("user_id", session.user.id);

    if (stockError) {
      await supabase
        .from("sales_notes")
        .delete()
        .eq("id", insertedSale.id)
        .eq("user_id", session.user.id);

      alert(
        "Satış kaydı oluşturuldu ancak stok güncellenemedi. Kayıt geri alındı: " +
          stockError.message
      );
      return;
    }

    setSaleForm({
      ...emptySaleForm,
      saleDate: new Date().toISOString().slice(0, 10),
    });

    await Promise.all([fetchSalesNotes(), fetchProducts()]);
    alert("Satış kaydedildi ve ürün stoktan düşüldü.");
  };

  const markSaleAsPaid = async (sale) => {
    const approved = confirm(
      `${sale.customer_name} isimli kişiden ${formatCurrency(
        sale.total_amount
      )} ödeme alındı mı?\n\nBorç kaydı açık listeden kaldırılacak. Ürün stoğu değişmeyecek.`
    );

    if (!approved) return;

    const { error } = await supabase
      .from("sales_notes")
      .update({
        is_paid: true,
        paid_at: new Date().toISOString(),
      })
      .eq("id", sale.id)
      .eq("user_id", session.user.id);

    if (error) {
      alert("Borç kaydı kapatılamadı: " + error.message);
      return;
    }

    await fetchSalesNotes();
    alert("Ödeme alındı. Borç kaydı kapatıldı ve stok değiştirilmedi.");
  };

  const cancelSaleNote = async (sale) => {
    if (
      !confirm(
        "Bu satış kaydı silinsin mi? Kayıtta bulunan adet ürün stoğuna geri eklenecek."
      )
    ) {
      return;
    }

    const relatedProduct = products.find(
      (product) => String(product.id) === String(sale.product_id)
    );

    let previousStock = null;

    if (relatedProduct) {
      previousStock = Number(relatedProduct.stock || 0);
      const restoredStock = previousStock + Number(sale.quantity || 0);

      const { error: restoreError } = await supabase
        .from("products")
        .update({ stock: restoredStock })
        .eq("id", relatedProduct.id)
        .eq("user_id", session.user.id);

      if (restoreError) {
        alert("Stok geri eklenemedi: " + restoreError.message);
        return;
      }
    }

    const { error: deleteError } = await supabase
      .from("sales_notes")
      .delete()
      .eq("id", sale.id)
      .eq("user_id", session.user.id);

    if (deleteError) {
      if (relatedProduct && previousStock !== null) {
        await supabase
          .from("products")
          .update({ stock: previousStock })
          .eq("id", relatedProduct.id)
          .eq("user_id", session.user.id);
      }

      alert("Satış kaydı silinemedi: " + deleteError.message);
      return;
    }

    await Promise.all([fetchSalesNotes(), fetchProducts()]);
  };

  const costResult = calculateCost();

  const landingCss = `
    .landing-page {
      width: 100vw;
      min-height: 100vh;
      box-sizing: border-box;
      background:
        radial-gradient(circle at top right, rgba(20, 184, 166, 0.22), transparent 32%),
        radial-gradient(circle at bottom left, rgba(125, 211, 252, 0.28), transparent 30%),
        linear-gradient(135deg, #f8fdff 0%, #eefcff 45%, #ffffff 100%);
      color: #0f172a;
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
      background: rgba(255, 255, 255, 0.78);
      border: 1px solid rgba(15, 23, 42, 0.08);
      box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
      backdrop-filter: blur(18px);
      border-radius: 28px;
      padding: 18px 26px;
    }

    .landing-logo h1 {
      margin: 0;
      font-size: 28px;
      letter-spacing: 3px;
      color: #0f172a;
    }

    .landing-logo span {
      display: block;
      margin-top: 6px;
      color: #0891b2;
      font-weight: 800;
      letter-spacing: 2px;
    }

    .landing-nav {
      display: flex;
      align-items: center;
      gap: 18px;
      flex-wrap: wrap;
    }

    .landing-nav a {
      color: #334155;
      text-decoration: none;
      font-weight: 800;
    }

    .landing-nav button,
    .hero-buttons button {
      border: 0;
      background: linear-gradient(135deg, #06b6d4, #14b8a6);
      color: white;
      padding: 13px 22px;
      border-radius: 999px;
      font-weight: 900;
      cursor: pointer;
      box-shadow: 0 18px 38px rgba(20, 184, 166, 0.28);
    }

    .hero-section {
      max-width: 1180px;
      margin: 90px auto 70px;
      display: grid;
      grid-template-columns: 1.05fr 0.95fr;
      gap: 42px;
      align-items: center;
    }

    .hero-badge {
      display: inline-block;
      background: rgba(20, 184, 166, 0.12);
      border: 1px solid rgba(20, 184, 166, 0.28);
      color: #0f766e;
      padding: 9px 14px;
      border-radius: 999px;
      font-weight: 900;
      margin-bottom: 20px;
      box-shadow: 0 14px 35px rgba(20, 184, 166, 0.12);
    }

    .hero-text h2 {
      margin: 0;
      font-size: 58px;
      line-height: 1.05;
      letter-spacing: -2px;
      color: #0f172a;
      text-align: left;
    }

    .hero-text p {
      color: #475569;
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
      color: #0f766e;
      background: rgba(255, 255, 255, 0.8);
      border: 1px solid rgba(20, 184, 166, 0.28);
      box-shadow: 0 14px 34px rgba(15, 23, 42, 0.06);
    }

    .hero-mini-stats {
      display: flex;
      gap: 14px;
      margin-top: 28px;
      flex-wrap: wrap;
    }

    .hero-mini-stats div {
      background: rgba(255, 255, 255, 0.86);
      border: 1px solid rgba(15, 23, 42, 0.08);
      box-shadow: 0 16px 36px rgba(15, 23, 42, 0.07);
      border-radius: 22px;
      padding: 18px;
    }

    .hero-mini-stats strong {
      display: block;
      color: #0f172a;
      font-size: 18px;
    }

    .hero-mini-stats span {
      display: block;
      color: #64748b;
      font-size: 13px;
      margin-top: 4px;
    }

    .hero-visual-card {
      position: relative;
      border-radius: 34px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.78);
      border: 1px solid rgba(15, 23, 42, 0.08);
      box-shadow: 0 30px 90px rgba(15, 23, 42, 0.16);
      padding: 14px;
      min-height: 430px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .mock-dashboard {
      width: 100%;
      min-height: 420px;
      border-radius: 28px;
      background: linear-gradient(135deg, #ffffff, #f0fdfa);
      border: 1px solid rgba(15, 23, 42, 0.08);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.8);
      display: grid;
      grid-template-columns: 90px 1fr;
      overflow: hidden;
    }

    .mock-sidebar {
      background: linear-gradient(180deg, #0f766e, #0891b2);
      padding: 26px 18px;
      display: flex;
      flex-direction: column;
      gap: 18px;
      align-items: center;
    }

    .mock-logo {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: white;
      color: #0891b2;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
    }

    .mock-sidebar span {
      width: 36px;
      height: 10px;
      border-radius: 999px;
      background: rgba(255,255,255,0.45);
    }

    .mock-content {
      padding: 28px;
    }

    .mock-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 22px;
    }

    .mock-top small {
      color: #64748b;
      font-weight: 900;
    }

    .mock-top h3 {
      margin: 5px 0 0;
      font-size: 30px;
      color: #0f172a;
    }

    .mock-user {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: linear-gradient(135deg, #06b6d4, #14b8a6);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
    }

    .mock-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      margin-bottom: 18px;
    }

    .mock-stats div,
    .mock-chart,
    .mock-products {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 18px;
      box-shadow: 0 14px 30px rgba(15, 23, 42, 0.06);
    }

    .mock-stats span {
      display: block;
      color: #64748b;
      font-weight: 800;
      font-size: 13px;
      margin-bottom: 8px;
    }

    .mock-stats strong {
      color: #0f172a;
      font-size: 24px;
    }

    .mock-bottom {
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 14px;
    }

    .mock-chart {
      height: 150px;
      display: flex;
      gap: 12px;
      align-items: end;
    }

    .mock-chart span {
      flex: 1;
      border-radius: 999px 999px 8px 8px;
      background: linear-gradient(180deg, #22d3ee, #14b8a6);
    }

    .mock-chart span:nth-child(1) { height: 45%; }
    .mock-chart span:nth-child(2) { height: 65%; }
    .mock-chart span:nth-child(3) { height: 52%; }
    .mock-chart span:nth-child(4) { height: 78%; }
    .mock-chart span:nth-child(5) { height: 92%; }

    .mock-products {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .mock-products div {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: center;
    }

    .mock-products strong {
      color: #0f172a;
      font-size: 13px;
    }

    .mock-products span {
      background: #dcfce7;
      color: #15803d;
      padding: 5px 8px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 900;
    }

    .mock-products .danger-mini {
      background: #fee2e2;
      color: #dc2626;
    }

    .hero-floating-card {
      position: absolute;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid rgba(15, 23, 42, 0.08);
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
      border-radius: 20px;
      padding: 14px 18px;
      backdrop-filter: blur(12px);
    }

    .hero-floating-card strong {
      display: block;
      color: #0f172a;
      font-size: 23px;
      font-weight: 900;
    }

    .hero-floating-card span {
      color: #64748b;
      font-size: 13px;
      font-weight: 800;
    }

    .card-one {
      top: 24px;
      left: 24px;
    }

    .card-two {
      right: 24px;
      bottom: 24px;
    }

    .landing-section-title {
      max-width: 1180px;
      margin: 0 auto 24px;
      text-align: center;
    }

    .landing-section-title span {
      color: #0891b2;
      font-weight: 900;
      letter-spacing: 2px;
    }

    .landing-section-title h2 {
      margin: 12px 0;
      font-size: 38px;
      color: #0f172a;
    }

    .landing-section-title p {
      margin: 0 auto;
      max-width: 680px;
      color: #475569;
      line-height: 1.7;
    }

    .features-section,
    .why-section,
    .workflow-section,
    .pricing-section,
    .faq-section {
      max-width: 1180px;
      margin-left: auto;
      margin-right: auto;
      display: grid;
      gap: 18px;
    }

    .why-section {
      grid-template-columns: repeat(4, 1fr);
      margin-bottom: 34px;
    }

    .why-card {
      background: rgba(255, 255, 255, 0.86);
      border: 1px solid rgba(15, 23, 42, 0.08);
      box-shadow: 0 18px 42px rgba(15, 23, 42, 0.07);
      border-radius: 22px;
      padding: 22px;
      color: #0f172a;
    }

    .why-card div {
      font-size: 34px;
      margin-bottom: 14px;
    }

    .why-card h3 {
      margin: 0 0 10px;
      color: #0f172a;
      font-size: 20px;
    }

    .why-card p {
      margin: 0;
      color: #475569;
      line-height: 1.6;
    }

    .trust-section {
      max-width: 1180px;
      margin: 0 auto 78px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 18px;
    }

    .trust-section div {
      background: linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(20, 184, 166, 0.12));
      border: 1px solid rgba(20, 184, 166, 0.22);
      border-radius: 22px;
      padding: 20px;
      text-align: center;
    }

    .trust-section strong {
      display: block;
      color: #0f766e;
      font-size: 20px;
      margin-bottom: 6px;
    }

    .trust-section span {
      color: #475569;
      font-weight: 700;
      font-size: 14px;
    }

    .features-section {
      grid-template-columns: repeat(4, 1fr);
      margin-bottom: 70px;
    }

    .workflow-section {
      grid-template-columns: repeat(3, 1fr);
      margin-top: 28px;
      margin-bottom: 80px;
    }

    .pricing-section {
      grid-template-columns: repeat(3, 1fr);
      margin-bottom: 80px;
    }

    .faq-section {
      grid-template-columns: repeat(2, 1fr);
      margin-bottom: 80px;
    }

    .feature-card,
    .workflow-section div,
    .pricing-card,
    .faq-card {
      background: rgba(255, 255, 255, 0.82);
      border: 1px solid rgba(15, 23, 42, 0.08);
      box-shadow: 0 18px 42px rgba(15, 23, 42, 0.07);
      border-radius: 22px;
      padding: 18px;
      color: #0f172a;
    }

    .feature-card div {
      font-size: 32px;
      margin-bottom: 14px;
    }

    .feature-card h3,
    .workflow-section h3,
    .pricing-card h3,
    .faq-card h3 {
      color: #0f172a;
      margin-top: 0;
    }

    .feature-card p,
    .workflow-section p,
    .faq-card p {
      margin: 0;
      color: #475569;
      line-height: 1.6;
    }

    .workflow-section span {
      color: #0891b2;
      font-weight: 900;
      letter-spacing: 2px;
    }

    .pricing-card {
      position: relative;
      padding: 26px;
    }

    .pricing-card.featured {
      background:
        radial-gradient(circle at top right, rgba(20, 184, 166, 0.18), transparent 34%),
        rgba(255, 255, 255, 0.92);
      border: 2px solid rgba(20, 184, 166, 0.35);
      transform: translateY(-10px);
    }

    .pricing-label {
      position: absolute;
      top: 18px;
      right: 18px;
      background: linear-gradient(135deg, #06b6d4, #14b8a6);
      color: white;
      padding: 7px 11px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 900;
    }

    .pricing-price {
      font-size: 38px;
      font-weight: 900;
      color: #0f172a;
      margin-bottom: 16px;
    }

    .pricing-price span {
      color: #475569;
      font-size: 15px;
      font-weight: 700;
    }

    .pricing-card ul {
      list-style: none;
      padding: 0;
      margin: 0 0 22px;
    }

    .pricing-card li {
      color: #475569;
      margin-bottom: 11px;
      line-height: 1.5;
    }

    .pricing-card button {
      width: 100%;
      border-radius: 16px;
      padding: 14px;
      font-weight: 900;
      cursor: pointer;
      color: #0f766e;
      background: rgba(240, 253, 250, 0.9);
      border: 1px solid rgba(20, 184, 166, 0.28);
    }

    .pricing-card.featured button {
      color: white;
      background: linear-gradient(135deg, #06b6d4, #14b8a6);
      border: 0;
    }

    @media (max-width: 900px) {
      .hero-section {
        grid-template-columns: 1fr;
        margin-top: 55px;
      }

      .hero-text h2 {
        font-size: 42px;
      }

      .features-section,
      .why-section,
      .pricing-section,
      .trust-section {
        grid-template-columns: repeat(2, 1fr);
      }

      .workflow-section,
      .faq-section {
        grid-template-columns: 1fr;
      }

      .pricing-card.featured {
        transform: none;
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
        border-radius: 22px;
        padding: 18px;
      }

      .hero-text h2 {
        font-size: 36px;
      }

      .features-section,
      .why-section,
      .pricing-section,
      .trust-section {
        grid-template-columns: 1fr;
      }

      .hero-buttons {
        flex-direction: column;
      }

      .hero-buttons button,
      .hero-buttons a {
        text-align: center;
      }

      .hero-mini-stats {
        flex-direction: column;
      }

      .hero-visual-card {
        padding: 10px;
      }

      .mock-dashboard {
        grid-template-columns: 1fr;
      }

      .mock-sidebar {
        display: none;
      }

      .mock-stats,
      .mock-bottom {
        grid-template-columns: 1fr;
      }

      .hero-floating-card {
        display: none;
      }
    }
      .stock-showcase {
  max-width: 1180px;
  margin: 0 auto 80px;
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  gap: 26px;
  align-items: center;
}

.stock-showcase-text {
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.07);
  border-radius: 26px;
  padding: 30px;
}

.stock-showcase-text span {
  display: inline-block;
  color: #0891b2;
  font-weight: 900;
  letter-spacing: 2px;
  margin-bottom: 14px;
}

.stock-showcase-text h3 {
  margin: 0 0 14px;
  color: #0f172a;
  font-size: 34px;
  line-height: 1.15;
}

.stock-showcase-text p {
  margin: 0 0 20px;
  color: #475569;
  line-height: 1.7;
}

.stock-showcase-list {
  display: grid;
  gap: 12px;
}

.stock-showcase-list div {
  background: rgba(240, 253, 250, 0.9);
  border: 1px solid rgba(20, 184, 166, 0.22);
  color: #0f172a;
  border-radius: 16px;
  padding: 14px 16px;
  font-weight: 800;
}

.stock-dashboard-visual {
  background:
    radial-gradient(circle at top right, rgba(20, 184, 166, 0.18), transparent 35%),
    linear-gradient(135deg, #ffffff, #ecfeff);
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 28px 70px rgba(15, 23, 42, 0.12);
  border-radius: 32px;
  padding: 24px;
  position: relative;
  overflow: hidden;
}

.stock-dashboard-top {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: center;
  margin-bottom: 20px;
}

.stock-dashboard-top h4 {
  margin: 0;
  color: #0f172a;
  font-size: 24px;
}

.stock-dashboard-top span {
  background: #dcfce7;
  color: #15803d;
  padding: 8px 12px;
  border-radius: 999px;
  font-weight: 900;
  font-size: 12px;
}

.stock-mini-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 18px;
}

.stock-mini-cards div {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #dbeafe;
  border-radius: 20px;
  padding: 18px;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06);
}

.stock-mini-cards strong {
  display: block;
  color: #0f172a;
  font-size: 28px;
  margin-bottom: 6px;
}

.stock-mini-cards small {
  color: #64748b;
  font-weight: 800;
}

.stock-product-rows {
  display: grid;
  gap: 14px;
}

.stock-product-row {
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  padding: 16px;
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.05);
}

.stock-row-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 10px;
}

.stock-row-head strong {
  color: #0f172a;
}

.stock-row-head span {
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 900;
}

.stock-status-good {
  background: #dcfce7;
  color: #15803d;
}

.stock-status-warning {
  background: #fef3c7;
  color: #b45309;
}

.stock-status-danger {
  background: #fee2e2;
  color: #dc2626;
}

.stock-progress {
  height: 10px;
  background: #e2e8f0;
  border-radius: 999px;
  overflow: hidden;
}

.stock-progress div {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #06b6d4, #14b8a6);
}

.stock-progress.high div {
  width: 88%;
}

.stock-progress.medium div {
  width: 54%;
}

.stock-progress.low div {
  width: 22%;
}

.stock-row-foot {
  margin-top: 8px;
  color: #64748b;
  font-size: 13px;
  font-weight: 800;
}

@media (max-width: 900px) {
  .stock-showcase {
    grid-template-columns: 1fr;
  }

  .stock-mini-cards {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .stock-showcase-text h3 {
    font-size: 26px;
  }

  .stock-dashboard-visual {
    padding: 18px;
  }
}
  .target-users-section {
  max-width: 1180px;
  margin: 0 auto 80px;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 18px;
}

.target-user-card {
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.07);
  border-radius: 24px;
  padding: 22px;
  color: #0f172a;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.target-user-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 26px 56px rgba(15, 23, 42, 0.12);
}

.target-user-card div {
  font-size: 34px;
  margin-bottom: 14px;
}

.target-user-card h3 {
  margin: 0 0 10px;
  color: #0f172a;
  font-size: 18px;
}

.target-user-card p {
  margin: 0;
  color: #475569;
  line-height: 1.6;
  font-size: 14px;
}

.problem-solution-section {
  max-width: 1180px;
  margin: 0 auto 80px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 22px;
}

.problem-card,
.solution-card {
  border-radius: 30px;
  padding: 32px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.1);
}

.problem-card {
  background:
    radial-gradient(circle at top left, rgba(248, 113, 113, 0.16), transparent 36%),
    rgba(255, 255, 255, 0.88);
}

.solution-card {
  background:
    radial-gradient(circle at top right, rgba(20, 184, 166, 0.2), transparent 36%),
    rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(20, 184, 166, 0.22);
}

.problem-card span,
.solution-card span {
  display: inline-block;
  font-weight: 900;
  letter-spacing: 2px;
  font-size: 13px;
  margin-bottom: 14px;
}

.problem-card span {
  color: #dc2626;
}

.solution-card span {
  color: #0f766e;
}

.problem-card h3,
.solution-card h3 {
  margin: 0 0 16px;
  color: #0f172a;
  font-size: 30px;
  line-height: 1.18;
}

.problem-card p,
.solution-card p {
  margin: 0 0 18px;
  color: #475569;
  line-height: 1.7;
}

.problem-list,
.solution-list {
  display: grid;
  gap: 12px;
}

.problem-list div,
.solution-list div {
  border-radius: 16px;
  padding: 14px 16px;
  font-weight: 800;
  color: #0f172a;
}

.problem-list div {
  background: rgba(254, 226, 226, 0.75);
  border: 1px solid rgba(248, 113, 113, 0.22);
}

.solution-list div {
  background: rgba(240, 253, 250, 0.9);
  border: 1px solid rgba(20, 184, 166, 0.22);
}

@media (max-width: 900px) {
  .target-users-section {
    grid-template-columns: repeat(2, 1fr);
  }

  .problem-solution-section {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .target-users-section {
    grid-template-columns: 1fr;
  }

  .problem-card h3,
  .solution-card h3 {
    font-size: 24px;
  }

  .problem-card,
  .solution-card {
    padding: 24px;
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
            <h1>NUVERA STOCK</h1>
            <span>3D baskı stok ve maliyet takip sistemi</span>
          </div>

    <nav className="landing-nav">
  <a href="#features">Özellikler</a>
  <a href="#why-us">Neden Nuvera?</a>
  <a href="#target-users">Kimler İçin?</a>
  <a href="#problem-solution">Çözüm</a>
  <a href="#workflow">Nasıl Çalışır?</a>
  <a href="#pricing">Fiyatlandırma</a>
  <a href="#faq">SSS</a>
  <button onClick={() => setShowLogin(true)}>Giriş Yap</button>
</nav>
        </header>

        <section className="hero-section">
          <div className="hero-text">
            <span className="hero-badge">
              3D Baskı Üreticileri İçin Web Tabanlı Takip Sistemi
            </span>

            <h2>3D Baskı Ürünleriniz İçin Stok ve Maliyet Takip Sistemi</h2>

            <p>
              Nuvera Stock ile 3D baskı ürünlerinizi kategori, malzeme, renk ve
              stok bilgileriyle yönetin. Üretim maliyetlerini hesaplayın, satış
              fiyatını belirleyin ve tüm verilerinize telefon ya da bilgisayardan
              güvenle ulaşın.
            </p>

            <div className="hero-buttons">
              <button onClick={() => setShowLogin(true)}>Ücretsiz Başla</button>
              <a href="#pricing">Planları İncele</a>
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
                <strong>Güvenli</strong>
                <span>Kullanıcıya özel veri</span>
              </div>
            </div>
          </div>

          <div className="hero-visual-card">
            <div className="mock-dashboard">
              <div className="mock-sidebar">
                <div className="mock-logo">▣</div>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </div>

              <div className="mock-content">
                <div className="mock-top">
                  <div>
                    <small>Genel Bakış</small>
                    <h3>Stok Paneli</h3>
                  </div>
                  <div className="mock-user">3D</div>
                </div>

                <div className="mock-stats">
                  <div>
                    <span>Toplam Ürün</span>
                    <strong>248</strong>
                  </div>
                  <div>
                    <span>Toplam Stok</span>
                    <strong>1.286</strong>
                  </div>
                  <div>
                    <span>Maliyet</span>
                    <strong>₺58,40</strong>
                  </div>
                </div>

                <div className="mock-bottom">
                  <div className="mock-chart">
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>

                  <div className="mock-products">
                    <div>
                      <strong>PLA • Beyaz</strong>
                      <span>Yeterli</span>
                    </div>
                    <div>
                      <strong>ABS • Gri</strong>
                      <span className="danger-mini">Azaldı</span>
                    </div>
                    <div>
                      <strong>PETG • Siyah</strong>
                      <span>Kritik</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="hero-floating-card card-one">
              <strong>+248</strong>
              <span>Takip edilen ürün</span>
            </div>

            <div className="hero-floating-card card-two">
              <strong>₺58,40</strong>
              <span>Ortalama maliyet</span>
            </div>
          </div>
        </section>

        <div className="landing-section-title" id="why-us">
          <span>NEDEN NUVERA STOCK?</span>
          <h2>3D baskı işinizi daha düzenli ve kontrollü yönetin</h2>
          <p>
            Nuvera Stock, 3D baskı ile ürün üreten kişilerin stok, malzeme,
            maliyet ve satış fiyatı süreçlerini tek bir panelden yönetebilmesi
            için geliştirildi.
          </p>
        </div>

        <section className="why-section">
          <div className="why-card">
            <div>🎯</div>
            <h3>3D baskıya özel yapı</h3>
            <p>
              Genel stok programları yerine filament, üretim maliyeti, stok
              adedi ve satış fiyatı gibi 3D baskıya özel ihtiyaçlara odaklanır.
            </p>
          </div>

          <div className="why-card">
            <div>⏱️</div>
            <h3>Zaman kazandırır</h3>
            <p>
              Ürünleri, malzemeleri ve maliyetleri ayrı ayrı not almak yerine
              hepsini tek panelde düzenli şekilde takip edebilirsiniz.
            </p>
          </div>

          <div className="why-card">
            <div>💸</div>
            <h3>Kârınızı görmenizi sağlar</h3>
            <p>
              Filament, elektrik, işçilik, paketleme ve ekstra giderleri hesaba
              katarak ürünün tahmini satış fiyatını daha doğru belirlemenize
              yardımcı olur.
            </p>
          </div>

          <div className="why-card">
            <div>📱</div>
            <h3>Her cihazdan erişim</h3>
            <p>
              Web tabanlı olduğu için stok ve maliyet bilgilerinize bilgisayar,
              tablet veya telefondan aynı hesapla ulaşabilirsiniz.
            </p>
          </div>
        </section>

        <section className="trust-section">
          <div>
            <strong>Free Plan</strong>
            <span>20 ürüne kadar ücretsiz başlangıç</span>
          </div>

          <div>
            <strong>Güvenli Veri</strong>
            <span>Her kullanıcı sadece kendi verilerini görür</span>
          </div>

          <div>
            <strong>3D Baskı Odaklı</strong>
            <span>Stok, malzeme ve maliyet aynı panelde</span>
          </div>
        </section>
<section className="stock-showcase">
  <div className="stock-showcase-text">
    <span>STOK TAKİBİ</span>
    <h3>Stok durumunu tek bakışta gör</h3>
    <p>
      Nuvera Stock ile ürünlerinin stok seviyesini daha anlaşılır şekilde
      takip edebilirsin. Hangi ürün yeterli, hangisi azalıyor, hangisi kritik
      seviyede; hepsi giriş sayfasında bile net bir görsel dille anlatılır.
    </p>

    <div className="stock-showcase-list">
      <div>✅ Düşük stoklu ürünleri hızlı fark et</div>
      <div>✅ Ürün stoklarını görsel çubuklarla takip et</div>
      <div>✅ 3D baskı üretimini daha planlı yönet</div>
    </div>
  </div>

  <div className="stock-dashboard-visual">
    <div className="stock-dashboard-top">
      <h4>Canlı Stok Görünümü</h4>
      <span>Online Takip</span>
    </div>

    <div className="stock-mini-cards">
      <div>
        <strong>248</strong>
        <small>Toplam Ürün</small>
      </div>

      <div>
        <strong>36</strong>
        <small>Düşük Stok</small>
      </div>

      <div>
        <strong>1.286</strong>
        <small>Toplam Stok</small>
      </div>
    </div>

    <div className="stock-product-rows">
      <div className="stock-product-row">
        <div className="stock-row-head">
          <strong>PLA Filament Standı</strong>
          <span className="stock-status-good">Yeterli</span>
        </div>

        <div className="stock-progress high">
          <div></div>
        </div>

        <div className="stock-row-foot">Stok seviyesi: 88 adet</div>
      </div>

      <div className="stock-product-row">
        <div className="stock-row-head">
          <strong>ABS Prototip Kutu</strong>
          <span className="stock-status-warning">Azalıyor</span>
        </div>

        <div className="stock-progress medium">
          <div></div>
        </div>

        <div className="stock-row-foot">Stok seviyesi: 24 adet</div>
      </div>

      <div className="stock-product-row">
        <div className="stock-row-head">
          <strong>PETG Teknik Parça</strong>
          <span className="stock-status-danger">Kritik</span>
        </div>

        <div className="stock-progress low">
          <div></div>
        </div>

        <div className="stock-row-foot">Stok seviyesi: 6 adet</div>
      </div>
    </div>
  </div>
</section>

<div className="landing-section-title" id="target-users">
  <span>KİMLER İÇİN?</span>
  <h2>Nuvera Stock, 3D baskı işi yapan herkes için tasarlandı</h2>
  <p>
    Hobi üretiminden satış yapan küçük işletmelere kadar, ürünlerini ve
    maliyetlerini düzenli takip etmek isteyen herkes için pratik bir sistemdir.
  </p>
</div>

<section className="target-users-section">
  <div className="target-user-card">
    <div>🧩</div>
    <h3>3D Baskı Üreticileri</h3>
    <p>
      Ürünlerini, stoklarını ve üretim detaylarını düzenli şekilde takip etmek
      isteyen üreticiler için.
    </p>
  </div>

  <div className="target-user-card">
    <div>🏪</div>
    <h3>Küçük İşletmeler</h3>
    <p>
      Sipariş, stok ve maliyet takibini Excel yerine daha sade bir panelden
      yönetmek isteyen işletmeler için.
    </p>
  </div>

  <div className="target-user-card">
    <div>🎨</div>
    <h3>Tasarımcılar</h3>
    <p>
      Farklı ürün, renk, malzeme ve prototiplerini düzenli kaydetmek isteyen
      tasarımcılar için.
    </p>
  </div>

  <div className="target-user-card">
    <div>📦</div>
    <h3>Stok Takibi Yapanlar</h3>
    <p>
      Hangi ürünün azaldığını, hangisinin yeterli olduğunu hızlıca görmek
      isteyen kullanıcılar için.
    </p>
  </div>

  <div className="target-user-card">
    <div>💰</div>
    <h3>Maliyet Hesaplayanlar</h3>
    <p>
      Filament, elektrik, işçilik ve kâr oranını hesaba katarak satış fiyatı
      belirlemek isteyenler için.
    </p>
  </div>
</section>

<div className="landing-section-title" id="problem-solution">
  <span>SORUN VE ÇÖZÜM</span>
  <h2>Dağınık notlar yerine tek panelden kontrol</h2>
  <p>
    Nuvera Stock, 3D baskı sürecinde en çok yaşanan takip karmaşasını sade ve
    anlaşılır bir sisteme dönüştürür.
  </p>
</div>

<section className="problem-solution-section">
  <div className="problem-card">
    <span>SORUN</span>
    <h3>Stok ve maliyet bilgileri farklı yerlerde dağılır</h3>
    <p>
      Ürünler bir defterde, maliyetler Excel’de, stok bilgileri ise akılda
      kalınca üretim süreci karışır ve hata yapma ihtimali artar.
    </p>

    <div className="problem-list">
      <div>❌ Hangi ürünün azaldığı net görünmez</div>
      <div>❌ Gerçek maliyet hesaplamak zorlaşır</div>
      <div>❌ Satış fiyatı tahmini yapılır</div>
      <div>❌ Telefon ve bilgisayar arasında veri dağılır</div>
    </div>
  </div>

  <div className="solution-card">
    <span>ÇÖZÜM</span>
    <h3>Nuvera Stock tüm süreci tek ekranda toplar</h3>
    <p>
      Ürünlerinizi, stok seviyelerinizi, malzeme bilgilerinizi ve maliyet
      hesaplarınızı aynı sistemde tutarak daha kontrollü ilerlemenizi sağlar.
    </p>

    <div className="solution-list">
      <div>✅ Ürün ve stok bilgileri tek panelde</div>
      <div>✅ Maliyet ve satış fiyatı hesabı aynı yerde</div>
      <div>✅ Düşük stokları hızlı fark etme</div>
      <div>✅ Telefon ve bilgisayardan senkron kullanım</div>
    </div>
  </div>
</section>



        <div className="landing-section-title" id="features">
          <span>ÖZELLİKLER</span>
          <h2>3D üreticiler için pratik yönetim paneli</h2>
          <p>
            Ürün, stok, maliyet ve satış fiyatı süreçlerini tek ekranda
            toplayarak daha düzenli bir iş akışı kurmanı sağlar.
          </p>
        </div>

        <section className="features-section">
          <div className="feature-card">
            <div>📦</div>
            <h3>Ürün Yönetimi</h3>
            <p>Ürün adı, kategori, malzeme, renk ve stok bilgilerini kaydedin.</p>
          </div>

          <div className="feature-card">
            <div>📊</div>
            <h3>Stok Takibi</h3>
            <p>Stok artırma, azaltma ve düşük stok kontrolünü hızlıca yapın.</p>
          </div>

          <div className="feature-card">
            <div>💰</div>
            <h3>Maliyet Hesabı</h3>
            <p>
              Filament, elektrik, işçilik ve kâr oranına göre fiyat hesaplayın.
            </p>
          </div>

          <div className="feature-card">
            <div>☁️</div>
            <h3>Senkron Kullanım</h3>
            <p>Telefon ve bilgisayardan aynı hesaba giriş yaparak kullanın.</p>
          </div>
        </section>

        <div className="landing-section-title" id="workflow">
          <span>İŞ AKIŞI</span>
          <h2>Üç adımda stok kontrolü</h2>
        </div>

        <section className="workflow-section">
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

        <div className="landing-section-title" id="pricing">
          <span>FİYATLANDIRMA</span>
          <h2>İhtiyacına göre plan seç</h2>
          <p>
            Şimdilik ödeme altyapısı demo durumundadır. Gerçek ödeme sistemi
            bağlandığında plan yükseltme aktif edilebilir.
          </p>
        </div>

        <section className="pricing-section">
          <div className="pricing-card">
            <h3>Free Plan</h3>
            <div className="pricing-price">
              0 TL <span>/ ay</span>
            </div>
            <ul>
              <li>✅ 20 ürün limiti</li>
              <li>✅ Temel stok takibi</li>
              <li>✅ Temel maliyet hesabı</li>
              <li>✅ Mobil ve bilgisayar erişimi</li>
            </ul>
            <button onClick={() => setShowLogin(true)}>Ücretsiz Başla</button>
          </div>

          <div className="pricing-card featured">
            <div className="pricing-label">En Popüler</div>
            <h3>Pro Plan</h3>
            <div className="pricing-price">
              149 TL <span>/ ay</span>
            </div>
            <ul>
              <li>✅ Sınırsız ürün</li>
              <li>✅ Gelişmiş stok takibi</li>
              <li>✅ Kategori yönetimi</li>
              <li>✅ Gelişmiş maliyet raporları</li>
            </ul>
            <button onClick={() => setShowLogin(true)}>Pro’ya Geç</button>
          </div>

          <div className="pricing-card">
            <h3>Business Plan</h3>
            <div className="pricing-price">
              299 TL <span>/ ay</span>
            </div>
            <ul>
              <li>✅ Firma hesabı</li>
              <li>✅ Çoklu kullanıcı desteği</li>
              <li>✅ Gelişmiş finans takibi</li>
              <li>✅ Kurumsal destek</li>
            </ul>
            <button onClick={() => setShowLogin(true)}>İletişime Geç</button>
          </div>
        </section>

        <div className="landing-section-title" id="faq">
          <span>SSS</span>
          <h2>Sık sorulan sorular</h2>
        </div>

        <section className="faq-section">
          <div className="faq-card">
            <h3>Verilerim başkasına görünür mü?</h3>
            <p>Hayır. Her kullanıcı sadece kendi kayıtlarını görür.</p>
          </div>

          <div className="faq-card">
            <h3>Telefondan kullanabilir miyim?</h3>
            <p>Evet. Web tabanlı olduğu için telefondan kullanılabilir.</p>
          </div>

          <div className="faq-card">
            <h3>Free planda sınır var mı?</h3>
            <p>Free Plan’da 20 ürün sınırı vardır.</p>
          </div>

          <div className="faq-card">
            <h3>Ödeme sistemi aktif mi?</h3>
            <p>
              Şu an demo durumundadır. Sonradan iyzico veya PayTR bağlanabilir.
            </p>
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
              : "Free Plan ile hesap oluşturun. 20 ürün limitiyle başlayın."}
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
            className={page === "sales" ? "nav-active" : ""}
            onClick={() => setPage("sales")}
          >
            📝 Satış Defteri
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
          {isAdmin ? "Admin hesap aktif" : "Supabase senkron aktif"}
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

            {!canAddMoreProducts && (
              <section className="panel">
                <h3>Free Plan Limiti</h3>
                <p className="empty">
                  Free Plan’da 20 ürün sınırına ulaştınız. Daha fazla ürün için
                  Pro plana geçmeniz gerekir.
                </p>
              </section>
            )}

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

        {page === "sales" && (
          <>
            <header className="page-header">
              <div>
                <h2>Satış Defteri</h2>
                <p>
                  Satış yapılan kişiyi, ürünü, adedi, tutarı ve teslim notunu
                  kaydedin. Satış kaydedildiğinde ürün stoğu otomatik azalır.
                </p>
              </div>

              <span className="badge">Supabase Senkron</span>
            </header>

            <section className="stats">
              <div className="stat-card">
                <div className="stat-icon">🧾</div>
                <div>
                  <span>Satış Kaydı</span>
                  <strong>{salesNotes.length}</strong>
                </div>
              </div>

              <div className="stat-card green">
                <div className="stat-icon">📦</div>
                <div>
                  <span>Satılan Adet</span>
                  <strong>{soldQuantityTotal}</strong>
                </div>
              </div>

              <div className="stat-card yellow">
                <div className="stat-icon">💳</div>
                <div>
                  <span>Toplam Satış</span>
                  <strong>{formatCurrency(actualSalesTotal)}</strong>
                </div>
              </div>

              <div className="stat-card red">
                <div className="stat-icon">📊</div>
                <div>
                  <span>Ortalama Satış</span>
                  <strong>{formatCurrency(averageSaleAmount)}</strong>
                </div>
              </div>
            </section>

            <section className="grid">
              <div className="panel form-panel">
                <h3>Yeni Satış Kaydı</h3>

                <input
                  type="text"
                  placeholder="Satış yapılan kişi / müşteri"
                  value={saleForm.customerName}
                  onChange={(e) =>
                    setSaleForm({
                      ...saleForm,
                      customerName: e.target.value,
                    })
                  }
                />

                <select
                  value={saleForm.productId}
                  onChange={(e) =>
                    setSaleForm({
                      ...saleForm,
                      productId: e.target.value,
                    })
                  }
                >
                  <option value="">Satılan ürünü seç</option>

                  {products.map((product) => (
                    <option value={product.id} key={product.id}>
                      {product.name} — Stok: {product.stock}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Satılan adet"
                  value={saleForm.quantity}
                  onChange={(e) =>
                    setSaleForm({
                      ...saleForm,
                      quantity: e.target.value,
                    })
                  }
                />

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Toplam satış tutarı"
                  value={saleForm.totalAmount}
                  onChange={(e) =>
                    setSaleForm({
                      ...saleForm,
                      totalAmount: e.target.value,
                    })
                  }
                />

                <input
                  type="date"
                  value={saleForm.saleDate}
                  onChange={(e) =>
                    setSaleForm({
                      ...saleForm,
                      saleDate: e.target.value,
                    })
                  }
                />

                <textarea
                  placeholder="Teslim, ödeme veya satış hakkında not"
                  value={saleForm.note}
                  onChange={(e) =>
                    setSaleForm({
                      ...saleForm,
                      note: e.target.value,
                    })
                  }
                />

                {saleForm.productId && (
                  <div className="result-box">
                    {(() => {
                      const selectedProduct = products.find(
                        (product) =>
                          String(product.id) === String(saleForm.productId)
                      );

                      if (!selectedProduct) {
                        return <p>Ürün bulunamadı.</p>;
                      }

                      const remainingStock =
                        Number(selectedProduct.stock || 0) -
                        Number(saleForm.quantity || 0);

                      return (
                        <>
                          <p>Mevcut stok: {selectedProduct.stock} adet</p>
                          <strong>
                            Satış sonrası stok: {Math.max(remainingStock, 0)} adet
                          </strong>
                        </>
                      );
                    })()}
                  </div>
                )}

                <button className="primary" onClick={saveSaleNote}>
                  Satışı Kaydet ve Stoktan Düş
                </button>
              </div>

              <div className="panel list-panel">
                <h3>Kayıtlı Satışlar</h3>

                {salesNotes.length === 0 && (
                  <p className="empty">Henüz satış kaydı bulunmuyor.</p>
                )}

                <div className="product-list">
                  {salesNotes.map((sale) => (
                    <div className="product-card" key={sale.id}>
                      <div className="product-info">
                        <h4>{sale.customer_name}</h4>

                        <div className="product-tags">
                          <span>{sale.product_name}</span>
                          <span>{sale.quantity} adet</span>
                          <span>{formatSaleDate(sale.sale_date)}</span>
                        </div>

                        <strong>{formatCurrency(sale.total_amount)}</strong>

                        {sale.note && <small>Not: {sale.note}</small>}

                        <div className="stock-actions">
                          <button
                            className="primary"
                            onClick={() => markSaleAsPaid(sale)}
                          >
                            ✅ Ücret Alındı — Borcu Kapat
                          </button>

                          <button
                            className="danger"
                            onClick={() => cancelSaleNote(sale)}
                          >
                            ❌ Satışı İptal Et ve Stoğu Geri Ekle
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

                <div className="settings-row">
                  <span>Yetki</span>
                  <strong>{isAdmin ? "Yönetici" : "Kullanıcı"}</strong>
                </div>
              </div>

              <div className="panel settings-card premium-card">
                <h3>Mevcut Plan</h3>

                <div className="plan-badge">
                  {isAdmin
                    ? "Admin Plan"
                    : profile?.plan === "pro"
                    ? "Pro Plan"
                    : profile?.plan === "business"
                    ? "Business Plan"
                    : "Free Plan"}
                </div>

                <p>
                  {isAdmin
                    ? "Bu hesap yönetici hesabıdır. Ürün sınırı yoktur ve tüm premium özellikler açıktır."
                    : "Şu anda Free Plan kullanıyorsunuz. Free Plan'da 20 ürün sınırı vardır. Daha fazla ürün için Pro plana geçebilirsiniz."}
                </p>

                <div className="settings-row">
                  <span>Plan</span>
                  <strong>{isAdmin ? "admin" : profile?.plan || "free"}</strong>
                </div>

                <div className="settings-row">
                  <span>Ürün Limiti</span>
                  <strong>
                    {isAdmin || isPro ? "Sınırsız" : `${products.length} / 20`}
                  </strong>
                </div>

                <div className="settings-row">
                  <span>Ödeme Durumu</span>
                  <strong>{isAdmin ? "Yönetici" : "Demo / Pasif"}</strong>
                </div>

                <button className="primary" disabled>
                  {isAdmin ? "Admin Yetkisi Aktif" : "Ödeme Altyapısı Yakında"}
                </button>
              </div>
            </section>

            <section className="panel plans-panel">
              <div className="plans-header">
                <div>
                  <h3>Plan Seçenekleri</h3>
                  <p>
                    Uygulama gerçek abonelik sistemine bağlandığında bu planlar
                    aktif kullanılabilir.
                  </p>
                </div>
              </div>

              <div className="app-pricing-grid">
                <div className="app-plan-card">
                  <span className="app-plan-label">Başlangıç</span>
                  <h4>Free Plan</h4>
                  <div className="app-plan-price">
                    0 TL <small>/ ay</small>
                  </div>

                  <ul>
                    <li>20 ürün limiti</li>
                    <li>Temel stok takibi</li>
                    <li>Temel maliyet hesabı</li>
                    <li>Mobil ve bilgisayar erişimi</li>
                  </ul>

                  <button disabled>
                    {profile?.plan === "free" && !isAdmin
                      ? "Mevcut Plan"
                      : "Free Plan"}
                  </button>
                </div>

                <div className="app-plan-card highlighted-plan">
                  <span className="app-plan-label">En Popüler</span>
                  <h4>Pro Plan</h4>
                  <div className="app-plan-price">
                    149 TL <small>/ ay</small>
                  </div>

                  <ul>
                    <li>Sınırsız ürün</li>
                    <li>Gelişmiş stok takibi</li>
                    <li>Kategori yönetimi</li>
                    <li>Gelişmiş raporlar</li>
                  </ul>

                  <button disabled>
                    {isAdmin ? "Admin İçin Açık" : "Pro’ya Geç Yakında"}
                  </button>
                </div>

                <div className="app-plan-card">
                  <span className="app-plan-label">Kurumsal</span>
                  <h4>Business Plan</h4>
                  <div className="app-plan-price">
                    299 TL <small>/ ay</small>
                  </div>

                  <ul>
                    <li>Firma hesabı</li>
                    <li>Çoklu kullanıcı desteği</li>
                    <li>Gelişmiş finans takibi</li>
                    <li>Kurumsal destek</li>
                  </ul>

                  <button disabled>
                    {isAdmin ? "Admin İçin Açık" : "İletişime Geç Yakında"}
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;