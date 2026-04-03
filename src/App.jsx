import React, { useState, useMemo, useEffect } from 'react';
import { 
  Coffee, Pizza, Cake, CupSoda, 
  Plus, Minus, Trash2, ArrowLeft, 
  CheckCircle, User, Clock, Utensils,
  Receipt, Download
} from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot } from 'firebase/firestore';

// --- KRİTİK YAPILANDIRMA: Kendi Firebase bilgilerinizi buraya giriniz ---
// Firebase Konsolu > Proje Ayarları > Web App kısmından bu bilgileri alabilirsiniz.
const firebaseConfig = {
  apiKey: "AIzaSyCa_Rc0476-6E1La4J1XoopNU3bYzeJV1M",
  authDomain: "my-cafe-f8ee7.firebaseapp.com",
  projectId: "my-cafe-f8ee7",
  storageBucket: "my-cafe-f8ee7.firebasestorage.app",
  messagingSenderId: "408851040899",
  appId: "1:408851040899:web:a9378e8345356cbf3129b6",
  measurementId: "G-E5KRT2E8B2"
};

// --- GÜVENLİ FİREBASE BAŞLATMA PROTOKOLÜ ---
const getFirebaseInstance = () => {
  try {
    // Önce sistem tarafından sağlanan (eğer varsa) yapılandırmayı kontrol et
    let config = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
    
    // Eğer sistem yapılandırması yoksa veya geçersizse, yukarıdaki manuel yapılandırmayı kullan
    if (!config || !config.apiKey || config.apiKey === "") {
      config = MY_CUSTOM_CONFIG;
    }

    // Hala geçerli bir API Key yoksa yerel modda kal
    if (!config || !config.apiKey || config.apiKey.includes("BURAYA")) {
      console.warn("Firebase yapılandırması eksik veya varsayılan değerde. Uygulama yerel modda çalışıyor.");
      return { app: null, auth: null, db: null };
    }

    const app = getApps().length > 0 ? getApp() : initializeApp(config);
    const auth = getAuth(app);
    const db = getFirestore(app);
    return { app, auth, db };
  } catch (e) {
    console.error("Firebase başlatma hatası:", e);
    return { app: null, auth: null, db: null };
  }
};

const { auth, db } = getFirebaseInstance();
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- VERİ SETLERİ ---
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

  // Kimlik Doğrulama Dinleyicisi
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) { 
        console.error("Giriş yapılamadı:", error); 
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Veri Senkronizasyonu
  useEffect(() => {
    if (!db || !user) return;
    // Not: Artifact yolu, paylaşılan ortamda senkronizasyon sağlar.
    const tablesRef = collection(db, 'artifacts', appId, 'public', 'data', 'tables');
    const unsubscribe = onSnapshot(tablesRef, (snapshot) => {
      if (snapshot.empty) {
        setTables(INITIAL_TABLES);
        return;
      }
      const dbTables = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTables(INITIAL_TABLES.map(initialTable => {
        const dbTable = dbTables.find(t => t.id === initialTable.id);
        return dbTable || initialTable;
      }));
    }, (error) => { 
      console.error("Veri takibi hatası:", error); 
    });
    return () => unsubscribe();
  }, [user]);

  const activeTable = useMemo(() => tables.find(t => t.id === activeTableId), [tables, activeTableId]);
  const filteredProducts = useMemo(() => PRODUCTS.filter(p => p.category === activeCategory), [activeCategory]);

  const handleAddProduct = async (product) => {
    const currentTable = tables.find(t => t.id === activeTableId);
    if (!currentTable) return;

    let newOrders = [...currentTable.orders];
    const idx = newOrders.findIndex(o => o.productId === product.id);
    
    if (idx >= 0) {
      newOrders[idx] = { ...newOrders[idx], quantity: newOrders[idx].quantity + 1 };
    } else {
      newOrders.push({ 
        productId: product.id, 
        name: product.name, 
        price: product.price, 
        quantity: 1, 
        time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) 
      });
    }

    if (db && user) {
      const tableRef = doc(db, 'artifacts', appId, 'public', 'data', 'tables', activeTableId);
      await setDoc(tableRef, { ...currentTable, orders: newOrders, status: 'occupied' });
    } else {
      // Yerel Mod: Firebase bağlantısı yoksa sadece arayüzü güncelle
      setTables(prev => prev.map(t => t.id === activeTableId ? { ...t, orders: newOrders, status: 'occupied' } : t));
    }
  };

  const handleRemoveProduct = async (productId) => {
    const currentTable = tables.find(t => t.id === activeTableId);
    if (!currentTable) return;

    let newOrders = [...currentTable.orders];
    const idx = newOrders.findIndex(o => o.productId === productId);
    if (idx === -1) return;

    if (newOrders[idx].quantity > 1) {
      newOrders[idx] = { ...newOrders[idx], quantity: newOrders[idx].quantity - 1 };
    } else {
      newOrders.splice(idx, 1);
    }

    const status = newOrders.length === 0 ? 'empty' : 'occupied';
    
    if (db && user) {
      const tableRef = doc(db, 'artifacts', appId, 'public', 'data', 'tables', activeTableId);
      await setDoc(tableRef, { ...currentTable, orders: newOrders, status });
    } else {
      setTables(prev => prev.map(t => t.id === activeTableId ? { ...t, orders: newOrders, status } : t));
    }
  };

  const handleCheckout = async () => {
    if (!activeTable) return;
    if (window.confirm(`${activeTable.name} hesabı kapatılacak?`)) {
      if (db && user) {
        const tableRef = doc(db, 'artifacts', appId, 'public', 'data', 'tables', activeTableId);
        await setDoc(tableRef, { id: activeTableId, name: activeTable.name, orders: [], status: 'empty' });
      } else {
        setTables(prev => prev.map(t => t.id === activeTableId ? { ...t, orders: [], status: 'empty' } : t));
      }
      setActiveTableId(null);
    }
  };

  const calculateTotal = (orders) => orders.reduce((total, order) => total + (order.price * order.quantity), 0);

  if (!activeTableId) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-5xl font-black text-slate-800 tracking-tight">Salon Yönetimi</h1>
            <p className="text-slate-500 font-bold mt-1">
              {!db ? "⚠️ Yerel Mod (Bulut Bağlantısı Yok)" : "✅ Bulut Senkronizasyonu Aktif"}
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-full shadow-md border border-slate-200">
            <User size={22} className="text-indigo-600" />
            <span className="text-sm font-black text-slate-700">Garson: Ahmet</span>
          </div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
          {tables.map(table => {
            const isOccupied = table.status === 'occupied';
            const total = calculateTotal(table.orders);
            return (
              <button 
                key={table.id} 
                onClick={() => setActiveTableId(table.id)} 
                className={`flex flex-col p-8 rounded-[2.5rem] transition-all border-4 text-left h-52 shadow-sm relative overflow-hidden group ${
                  isOccupied 
                  ? 'bg-white border-emerald-500 ring-8 ring-emerald-50' 
                  : 'bg-white border-slate-100 hover:border-slate-300 hover:translate-y-[-4px]'
                }`}
              >
                <div className="flex justify-between w-full mb-auto items-center">
                  <span className={`text-2xl font-black ${isOccupied ? 'text-slate-800' : 'text-slate-300'}`}>{table.name}</span>
                  {isOccupied && <div className="p-2 bg-emerald-500 rounded-xl text-white shadow-lg"><Utensils size={24} /></div>}
                </div>
                {isOccupied ? (
                  <div className="w-full">
                    <div className="text-xs text-slate-400 flex items-center gap-1 mb-2 font-black uppercase tracking-wider">
                      <Clock size={14} /> {table.orders[table.orders.length-1]?.time}
                    </div>
                    <div className="font-black text-emerald-600 text-4xl tracking-tighter">₺{total.toFixed(2)}</div>
                  </div>
                ) : (
                  <div className="text-xs font-black uppercase text-slate-200 tracking-[0.3em] mt-auto">Adisyon Aç</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row font-sans overflow-hidden text-slate-900">
      <div className="flex-1 flex flex-col h-[55vh] lg:h-screen">
        <header className="bg-white p-6 flex items-center gap-6 shadow-sm border-b border-slate-200">
          <button onClick={() => setActiveTableId(null)} className="p-4 bg-slate-100 rounded-3xl hover:bg-slate-200 transition-colors shadow-inner">
            <ArrowLeft size={28} />
          </button>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight leading-none">{activeTable?.name}</h2>
            <p className="text-slate-400 font-bold text-sm mt-1 uppercase tracking-widest">Sipariş Kaydı</p>
          </div>
        </header>

        <div className="bg-white border-b border-slate-200 p-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-4">
            {CATEGORIES.map(cat => (
              <button 
                key={cat.id} 
                onClick={() => setActiveCategory(cat.id)} 
                className={`flex items-center gap-4 px-10 py-5 rounded-3xl font-black transition-all whitespace-nowrap ${
                  activeCategory === cat.id ? 'bg-slate-900 text-white shadow-2xl scale-105' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map(product => (
              <button 
                key={product.id} 
                onClick={() => handleAddProduct(product)} 
                className={`${product.color} p-8 rounded-[2.5rem] flex flex-col items-center justify-center text-center shadow-sm hover:shadow-xl hover:scale-[1.05] transition-all active:scale-95 border-b-8 border-black/10`}
              >
                <span className="font-black text-slate-800 mb-4 text-xl leading-tight">{product.name}</span>
                <span className="text-slate-900 font-black bg-white/90 px-8 py-3 rounded-2xl text-lg shadow-sm border border-white">₺{product.price}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[500px] bg-white flex flex-col h-[45vh] lg:h-screen border-l-4 border-slate-200 shadow-2xl relative z-30">
        <div className="p-8 bg-slate-50 border-b-2 border-slate-200 flex items-center justify-between">
          <h3 className="font-black text-slate-800 flex items-center gap-4 text-2xl">
            <Receipt size={32} className="text-indigo-600" /> ADİSYON
          </h3>
          <div className="bg-slate-900 text-white px-5 py-2 rounded-2xl text-sm font-black shadow-lg">
            {activeTable?.orders.length || 0} ÇEŞİT
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {activeTable?.orders.map(order => (
            <div key={order.productId} className="flex flex-col p-6 bg-slate-50 rounded-[2rem] border-2 border-slate-100 shadow-sm transition-transform hover:scale-[1.01]">
              <div className="flex justify-between font-black text-slate-800 mb-4 text-xl">
                <span>{order.name}</span>
                <span className="text-indigo-600">₺{(order.price * order.quantity).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400 font-black tracking-widest">₺{order.price} x {order.quantity}</span>
                <div className="flex items-center gap-4 bg-white rounded-2xl p-2 shadow-inner border border-slate-200">
                  <button onClick={() => handleRemoveProduct(order.productId)} className="p-3 text-red-500 hover:bg-red-50 rounded-2xl transition-colors">
                    {order.quantity === 1 ? <Trash2 size={24} /> : <Minus size={24} />}
                  </button>
                  <span className="w-10 text-center font-black text-slate-800 text-2xl">{order.quantity}</span>
                  <button onClick={() => handleAddProduct({id: order.productId, name: order.name, price: order.price})} className="p-3 text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-colors">
                    <Plus size={24} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {(!activeTable?.orders || activeTable.orders.length === 0) && (
            <div className="h-full flex flex-col items-center justify-center text-slate-200 py-12">
              <Utensils size={100} className="mb-6 opacity-10" />
              <p className="font-black uppercase tracking-[0.4em] text-sm">Sipariş Bekleniyor</p>
            </div>
          )}
        </div>

        <div className="p-10 border-t-4 border-slate-100 bg-white shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
          <div className="flex justify-between items-end mb-10">
            <span className="text-slate-400 font-black text-sm uppercase tracking-[0.3em]">Genel Toplam</span>
            <span className="text-6xl font-black text-slate-900 tracking-tighter">₺{calculateTotal(activeTable?.orders || []).toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <button className="bg-slate-900 text-white py-6 rounded-[2rem] font-black text-xs tracking-[0.2em] hover:bg-black transition-all active:scale-95 shadow-2xl uppercase">MUTFAĞA İLET</button>
            <button 
              onClick={handleCheckout} 
              disabled={!activeTable?.orders || activeTable.orders.length === 0} 
              className={`py-6 rounded-[2rem] font-black text-xs tracking-[0.2em] transition-all active:scale-95 shadow-2xl flex items-center justify-center gap-3 uppercase ${
                !activeTable?.orders || activeTable.orders.length === 0 ? 'bg-slate-100 text-slate-300' : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              <CheckCircle size={24} /> ÖDEME AL
            </button>
          </div>
        </div>
      </div>
      
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        body { 
          font-family: 'Inter', sans-serif; 
          -webkit-tap-highlight-color: transparent; 
          background-color: #f8fafc;
          overflow: hidden;
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        button:disabled { cursor: not-allowed; }
      `}</style>
    </div>
  );
}