import React, { useState, useMemo, useEffect } from 'react';
import { 
  Coffee, Pizza, Cake, CupSoda, 
  Plus, Minus, Trash2, ArrowLeft, 
  CheckCircle, User, Clock, Utensils,
  Receipt, Download
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot } from 'firebase/firestore';

// --- FİREBASE YAPILANDIRMASI ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- ÜRÜN VE KATEGORİ VERİLERİ ---
const CATEGORIES = [
  { id: 'sicak', name: 'Sıcak İçecekler', icon: <Coffee size={24} /> },
  { id: 'soguk', name: 'Soğuk İçecekler', icon: <CupSoda size={24} /> },
  { id: 'yiyecek', name: 'Yiyecekler', icon: <Pizza size={24} /> },
  { id: 'tatli', name: 'Tatlılar', icon: <Cake size={24} /> }
];

const PRODUCTS = [
  { id: 'p1', name: 'Filtre Kahve', price: 65, category: 'sicak', color: 'bg-amber-100' },
  { id: 'p2', name: 'Latte', price: 85, category: 'sicak', color: 'bg-amber-100' },
  { id: 'p3', name: 'Türk Kahvesi', price: 55, category: 'sicak', color: 'bg-amber-100' },
  { id: 'p4', name: 'Buzlu Americano', price: 75, category: 'soguk', color: 'bg-blue-100' },
  { id: 'p5', name: 'Limonata', price: 60, category: 'soguk', color: 'bg-blue-100' },
  { id: 'p6', name: 'Margherita Pizza', price: 210, category: 'yiyecek', color: 'bg-red-100' },
  { id: 'p7', name: 'Tost', price: 90, category: 'yiyecek', color: 'bg-red-100' },
  { id: 'p8', name: 'Cheesecake', price: 120, category: 'tatli', color: 'bg-pink-100' },
  { id: 'p9', name: 'Tiramisu', price: 110, category: 'tatli', color: 'bg-pink-100' },
];

const INITIAL_TABLES = Array.from({ length: 12 }, (_, i) => ({
  id: `masa-${i + 1}`,
  name: `Masa ${i + 1}`,
  orders: [],
  status: 'empty'
}));

export default function App() {
  const [user, setUser] = useState(null);
  const [tables, setTables] = useState(INITIAL_TABLES);
  const [activeTableId, setActiveTableId] = useState(null);
  const [activeCategory, setActiveCategory] = useState('sicak');
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);

  // PWA Manifest ve Kurulum Mantığı
  useEffect(() => {
    const manifestData = {
      name: "Cafe Adisyon POS",
      short_name: "Adisyon",
      start_url: ".",
      display: "standalone",
      background_color: "#f8fafc",
      theme_color: "#0f172a",
      icons: [{
        src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230f172a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M17 8h1a4 4 0 1 1 0 8h-1'/%3E%3Cpath d='M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z'/%3E%3Cline x1='6' y1='2' x2='6' y2='4'/%3E%3Cline x1='10' y1='2' x2='10' y2='4'/%3E%3Cline x1='14' y1='2' x2='14'/%3E%3C/svg%3E",
        sizes: "192x192 512x512",
        type: "image/svg+xml",
        purpose: "any maskable"
      }]
    };
    const manifestBlob = new Blob([JSON.stringify(manifestData)], { type: 'application/json' });
    const manifestUrl = URL.createObjectURL(manifestBlob);
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = manifestUrl;
    document.head.appendChild(link);

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstallable(false);
    setDeferredPrompt(null);
  };

  // Kimlik Doğrulama
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) { console.error("Kimlik doğrulama hatası:", error); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Veritabanı Dinleme
  useEffect(() => {
    if (!user) return;
    const tablesRef = collection(db, 'artifacts', appId, 'public', 'data', 'tables');
    const unsubscribe = onSnapshot(tablesRef, (snapshot) => {
      const dbTables = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTables(INITIAL_TABLES.map(initialTable => {
        const dbTable = dbTables.find(t => t.id === initialTable.id);
        return dbTable || initialTable;
      }));
    }, (error) => { console.error("Firestore hatası:", error); });
    return () => unsubscribe();
  }, [user]);

  const activeTable = useMemo(() => tables.find(t => t.id === activeTableId), [tables, activeTableId]);
  const filteredProducts = useMemo(() => PRODUCTS.filter(p => p.category === activeCategory), [activeCategory]);

  const handleAddProduct = async (product) => {
    if (!user) return;
    const currentTable = tables.find(t => t.id === activeTableId);
    if (!currentTable) return;
    
    let newOrders = [...currentTable.orders];
    const existingOrderIndex = newOrders.findIndex(o => o.productId === product.id);
    
    if (existingOrderIndex >= 0) {
      newOrders[existingOrderIndex] = { 
        ...newOrders[existingOrderIndex], 
        quantity: newOrders[existingOrderIndex].quantity + 1 
      };
    } else {
      newOrders.push({ 
        productId: product.id, 
        name: product.name, 
        price: product.price, 
        quantity: 1, 
        time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) 
      });
    }
    
    const tableRef = doc(db, 'artifacts', appId, 'public', 'data', 'tables', activeTableId);
    await setDoc(tableRef, { 
      id: activeTableId, 
      name: currentTable.name, 
      orders: newOrders, 
      status: 'occupied' 
    });
  };

  const handleRemoveProduct = async (productId) => {
    if (!user) return;
    const currentTable = tables.find(t => t.id === activeTableId);
    if (!currentTable) return;
    
    let newOrders = [...currentTable.orders];
    const existingOrderIndex = newOrders.findIndex(o => o.productId === productId);
    if (existingOrderIndex === -1) return;
    
    if (newOrders[existingOrderIndex].quantity > 1) {
      newOrders[existingOrderIndex] = { 
        ...newOrders[existingOrderIndex], 
        quantity: newOrders[existingOrderIndex].quantity - 1 
      };
    } else { 
      newOrders.splice(existingOrderIndex, 1); 
    }
    
    const newStatus = newOrders.length === 0 ? 'empty' : 'occupied';
    const tableRef = doc(db, 'artifacts', appId, 'public', 'data', 'tables', activeTableId);
    await setDoc(tableRef, { 
      id: activeTableId, 
      name: currentTable.name, 
      orders: newOrders, 
      status: newStatus 
    });
  };

  const handleCheckout = async () => {
    if (!user) return;
    // Özel modal yerine basit confirm (iFrame içinde çalışması için)
    if (window.confirm(`${activeTable.name} hesabı kapatılacak ve masa boşaltılacak. Onaylıyor musunuz?`)) {
      const tableRef = doc(db, 'artifacts', appId, 'public', 'data', 'tables', activeTableId);
      await setDoc(tableRef, { id: activeTableId, name: activeTable.name, orders: [], status: 'empty' });
      setActiveTableId(null);
    }
  };

  const calculateTotal = (orders) => orders.reduce((total, order) => total + (order.price * order.quantity), 0);

  // Salon Görünümü (Masa Listesi)
  if (!activeTableId) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Salon Yönetimi</h1>
            <p className="text-slate-500">Masaların doluluk durumunu takip edin</p>
          </div>
          <div className="flex items-center gap-3">
            {isInstallable && (
              <button onClick={handleInstallClick} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full shadow-md transition-all text-sm font-semibold animate-pulse">
                <Download size={16} /> Uygulamayı Yükle
              </button>
            )}
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200">
              <User size={18} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-700">Garson: Ahmet</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {tables.map(table => {
            const isOccupied = table.status === 'occupied';
            const total = calculateTotal(table.orders);
            return (
              <button 
                key={table.id} 
                onClick={() => setActiveTableId(table.id)} 
                className={`relative flex flex-col items-start p-5 rounded-2xl transition-all duration-200 border-2 text-left h-40 ${
                  isOccupied 
                  ? 'bg-white border-emerald-500 shadow-md hover:shadow-lg' 
                  : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between w-full mb-auto">
                  <span className={`text-lg font-bold ${isOccupied ? 'text-slate-800' : 'text-slate-400'}`}>{table.name}</span>
                  {isOccupied && <Utensils size={20} className="text-emerald-500" />}
                </div>
                {isOccupied && (
                  <div className="w-full mt-4">
                    <div className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                      <Clock size={12} /> {table.orders[table.orders.length-1]?.time || 'Şimdi'}
                    </div>
                    <div className="font-semibold text-emerald-600 text-xl">₺{total.toFixed(2)}</div>
                  </div>
                )}
                {!isOccupied && <span className="text-xs font-medium uppercase tracking-wider">Boş</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Masa Detay Görünümü (Sipariş Ekranı)
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row font-sans overflow-hidden text-slate-900">
      {/* Ürün Seçim Alanı */}
      <div className="flex-1 flex flex-col h-[60vh] lg:h-screen">
        <header className="bg-white p-4 flex items-center gap-4 shadow-sm z-10">
          <button 
            onClick={() => setActiveTableId(null)} 
            className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition"
          >
            <ArrowLeft size={24} className="text-slate-700" />
          </button>
          <h2 className="text-xl font-bold text-slate-800">
            {activeTable.name} <span className="font-normal text-slate-500 text-lg">Siparişi</span>
          </h2>
        </header>

        {/* Kategoriler */}
        <div className="bg-white border-b border-slate-200 p-3 overflow-x-auto">
          <div className="flex gap-3 min-w-max">
            {CATEGORIES.map(cat => (
              <button 
                key={cat.id} 
                onClick={() => setActiveCategory(cat.id)} 
                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition ${
                  activeCategory === cat.id 
                  ? 'bg-slate-800 text-white shadow-md' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Ürün Listesi */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filteredProducts.map(product => (
              <button 
                key={product.id} 
                onClick={() => handleAddProduct(product)} 
                className={`${product.color} p-4 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm hover:shadow-md transition active:scale-95 min-h-[130px] border border-black/5 group`}
              >
                <span className="font-semibold text-slate-800 mb-2 leading-tight group-hover:scale-105 transition-transform">{product.name}</span>
                <span className="text-slate-700 font-bold bg-white/60 px-3 py-1 rounded-lg text-sm border border-black/5">₺{product.price}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Adisyon Paneli */}
      <div className="w-full lg:w-96 bg-white flex flex-col h-[40vh] lg:h-screen border-l border-slate-200 shadow-xl z-20">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><Receipt size={20} /> Adisyon Detayı</h3>
          <span className="bg-slate-200 text-slate-700 px-3 py-1 rounded-full text-xs font-bold">
            {activeTable.orders.reduce((acc, curr) => acc + curr.quantity, 0)} Kalem
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {activeTable.orders.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
              <Utensils size={48} className="mb-3" />
              <p className="font-medium">Masa şu an boş</p>
              <p className="text-xs">Ürün ekleyerek başlayın</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {activeTable.orders.map(order => (
                <div key={order.productId} className="flex flex-col p-4 border border-slate-100 bg-slate-50 rounded-2xl shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-slate-800">{order.name}</span>
                    <span className="font-bold text-slate-900">₺{(order.price * order.quantity).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-slate-500 font-medium">Birim: ₺{order.price}</span>
                    <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-1 shadow-inner">
                      <button 
                        onClick={() => handleRemoveProduct(order.productId)} 
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                      >
                        {order.quantity === 1 ? <Trash2 size={18} /> : <Minus size={18} />}
                      </button>
                      <span className="w-6 text-center font-bold text-slate-800">{order.quantity}</span>
                      <button 
                        onClick={() => handleAddProduct({id: order.productId, name: order.name, price: order.price})} 
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 bg-white border-t border-slate-200">
          <div className="flex justify-between items-end mb-6">
            <span className="text-slate-500 font-bold text-sm uppercase tracking-wider">Ödenecek Tutar</span>
            <span className="text-4xl font-black text-slate-900 tracking-tighter">₺{calculateTotal(activeTable.orders).toFixed(2)}</span>
          </div>
          <div className="flex gap-3">
            <button className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-4 rounded-2xl font-bold transition active:scale-95 shadow-lg text-sm">
              MUTFAĞA GÖNDER
            </button>
            <button 
              onClick={handleCheckout} 
              disabled={activeTable.orders.length === 0} 
              className={`flex-1 py-4 rounded-2xl font-bold transition active:scale-95 flex items-center justify-center gap-2 shadow-lg text-sm ${
                activeTable.orders.length === 0 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <CheckCircle size={20} /> HESABI KAPAT
            </button>
          </div>
        </div>
      </div>
      
      {/* Global Stil Enjeksiyonu (iFrame Preview Uyumluluğu İçin) */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        body { font-family: 'Inter', sans-serif; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </div>
  );
}