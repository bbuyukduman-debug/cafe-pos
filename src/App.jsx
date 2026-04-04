import React, { useState, useMemo, useEffect } from 'react';
import { 
  Coffee, Pizza, Cake, CupSoda, 
  Plus, Minus, Trash2, ArrowLeft, 
  CheckCircle, User, Clock, Utensils,
  Receipt, Download, Wifi, WifiOff, AlertTriangle, Key
} from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot } from 'firebase/firestore';

/**
 * @description KRİTİK YAPILANDIRMA ALANI
 * Firebase Console > Proje Ayarları > General > Your Apps altındaki nesneyi buraya yapıştırın.
 */
const firebaseConfig = {
  apiKey: "AIzaSyCa_Rc0476-6E1La4J1XoopNU3bYzeJV1M",
  authDomain: "my-cafe-f8ee7.firebaseapp.com",
  projectId: "my-cafe-f8ee7",
  storageBucket: "my-cafe-f8ee7.firebasestorage.app",
  messagingSenderId: "408851040899",
  appId: "1:408851040899:web:a9378e8345356cbf3129b6",
  measurementId: "G-E5KRT2E8B2"
};

// Firebase Servislerinin Başlatılması
const getFirebase = () => {
  try {
    const config = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : firebaseConfig;
    
    // Güvenlik Kontrolü: Eğer anahtar girilmemişse veya yer tutucu metin duruyorsa
    const isUnconfigured = !config.apiKey || 
                           config.apiKey === "" || 
                           config.apiKey.includes("GELECEK") || 
                           config.apiKey.includes("SİZİN");

    if (isUnconfigured) {
      return { app: null, auth: null, db: null, isConfigured: false };
    }

    const app = getApps().length > 0 ? getApp() : initializeApp(config);
    return { 
      app, 
      auth: getAuth(app), 
      db: getFirestore(app), 
      isConfigured: true 
    };
  } catch (e) {
    console.error("Firebase başlatma hatası:", e);
    return { app: null, auth: null, db: null, isConfigured: false };
  }
};

const { auth, db, isConfigured } = getFirebase();
const appId = typeof __app_id !== 'undefined' ? __app_id : 'anil-cafe-v1-prod';

// --- STATİK VERİ SETLERİ ---
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
  const [connState, setConnState] = useState('checking'); 

  // 1. Kimlik Doğrulama
  useEffect(() => {
    if (!isConfigured) {
      setConnState('unconfigured');
      return;
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Fail:", err);
        setConnState('auth-error');
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Senkronizasyon
  useEffect(() => {
    if (!user || !db) return;

    const tablesRef = collection(db, 'artifacts', appId, 'public', 'data', 'tables');
    
    const unsubscribe = onSnapshot(tablesRef, (snapshot) => {
      if (!snapshot.empty) {
        const dbData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTables(INITIAL_TABLES.map(t => {
          const match = dbData.find(d => d.id === t.id);
          return match || t;
        }));
      }
      setConnState('connected');
    }, (err) => {
      console.error("Firestore Error:", err);
      if (err.code === 'permission-denied') setConnState('permission-error');
    });

    return () => unsubscribe();
  }, [user]);

  const activeTable = useMemo(() => tables.find(t => t.id === activeTableId), [tables, activeTableId]);
  const filteredProducts = useMemo(() => PRODUCTS.filter(p => p.category === activeCategory), [activeCategory]);

  const handleAddProduct = async (product) => {
    if (!user || !db) return;
    const currentTable = tables.find(t => t.id === activeTableId);
    if (!currentTable) return;

    const newOrders = [...currentTable.orders];
    const idx = newOrders.findIndex(o => o.productId === product.id);
    if (idx >= 0) {
      newOrders[idx] = { ...newOrders[idx], quantity: newOrders[idx].quantity + 1 };
    } else {
      newOrders.push({ productId: product.id, name: product.name, price: product.price, quantity: 1, time: new Date().toLocaleTimeString('tr-TR') });
    }

    const tableRef = doc(db, 'artifacts', appId, 'public', 'data', 'tables', activeTableId);
    await setDoc(tableRef, { ...currentTable, orders: newOrders, status: 'occupied' });
  };

  const handleRemoveProduct = async (productId) => {
    if (!user || !db) return;
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
    const tableRef = doc(db, 'artifacts', appId, 'public', 'data', 'tables', activeTableId);
    await setDoc(tableRef, { ...currentTable, orders: newOrders, status });
  };

  const calculateTotal = (orders) => orders.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);

  // --- RENDER DÖNGÜSÜ ---

  if (connState === 'unconfigured') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white font-sans">
        <div className="max-w-md w-full bg-slate-800 p-10 rounded-[3rem] shadow-2xl border border-slate-700 text-center">
          <div className="w-20 h-20 bg-amber-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 text-amber-500 border border-amber-500/30">
            <Key size={40} />
          </div>
          <h1 className="text-3xl font-black mb-4 tracking-tight">Konfigürasyon Gerekli</h1>
          <p className="text-slate-400 font-bold mb-8 leading-relaxed">
            Lütfen <code className="bg-slate-950 px-2 py-1 rounded text-amber-400">App.jsx</code> dosyasındaki <code className="text-white">firebaseConfig</code> alanına gerçek anahtarlarınızı yapıştırın.
          </p>
          <div className="bg-slate-950 p-4 rounded-2xl text-left text-sm font-mono border border-slate-700">
            apiKey: "AIzaSy..."
          </div>
        </div>
      </div>
    );
  }

  if (!activeTableId) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-5xl font-black text-slate-800 tracking-tight">Salon Yönetimi</h1>
            <div className="mt-4 flex flex-wrap gap-2">
              {connState === 'connected' ? (
                <span className="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-xs font-black flex items-center gap-2 border border-emerald-100 shadow-sm">
                  <Wifi size={14} /> BULUT SENKRONİZASYONU AKTİF
                </span>
              ) : (
                <span className="bg-amber-50 text-amber-600 px-4 py-1.5 rounded-full text-xs font-black flex items-center gap-2 border border-amber-100">
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-ping" /> BAĞLANTI KURULUYOR...
                </span>
              )}
            </div>
          </div>
          <div className="bg-white px-6 py-4 rounded-3xl shadow-md border border-slate-100 flex items-center gap-4">
            <User size={20} className="text-indigo-600" />
            <span className="text-sm font-bold text-slate-700">Garson Modu</span>
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
                className={`flex flex-col p-8 rounded-[2.5rem] transition-all border-4 text-left h-52 shadow-sm relative group active:scale-95 ${
                  isOccupied ? 'bg-white border-emerald-500 ring-8 ring-emerald-50' : 'bg-white border-slate-100 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between w-full mb-auto items-center">
                  <span className={`text-2xl font-black ${isOccupied ? 'text-slate-800' : 'text-slate-200'}`}>{table.name}</span>
                  {isOccupied && <Utensils size={24} className="text-emerald-500" />}
                </div>
                {isOccupied ? (
                  <div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-2 font-black uppercase tracking-widest">
                      <Clock size={12} /> {table.orders[table.orders.length-1]?.time}
                    </div>
                    <div className="font-black text-emerald-600 text-3xl tracking-tighter">₺{total.toFixed(2)}</div>
                  </div>
                ) : (
                  <span className="text-[10px] font-black uppercase text-slate-300 tracking-[0.2em] mt-auto">Adisyon Aç</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row font-sans overflow-hidden">
      <div className="flex-1 flex flex-col h-[55vh] lg:h-screen">
        <header className="bg-white p-6 flex items-center gap-6 shadow-sm border-b border-slate-200">
          <button onClick={() => setActiveTableId(null)} className="p-4 bg-slate-50 rounded-2xl hover:bg-slate-200 transition text-slate-400 hover:text-slate-900">
            <ArrowLeft size={28} />
          </button>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">{activeTable.name}</h2>
        </header>
        
        <div className="bg-white border-b border-slate-200 p-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-3">
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`flex items-center gap-3 px-10 py-5 rounded-3xl font-black transition whitespace-nowrap shadow-sm ${activeCategory === cat.id ? 'bg-slate-900 text-white shadow-xl scale-105' : 'bg-slate-50 text-slate-500 hover:bg-slate-200'}`}>
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map(product => (
              <button key={product.id} onClick={() => handleAddProduct(product)} className={`${product.color} p-8 rounded-[2.5rem] flex flex-col items-center justify-center text-center shadow-sm hover:shadow-xl transition-all border border-black/5`}>
                <span className="font-black text-slate-800 mb-4 text-xl">{product.name}</span>
                <span className="text-slate-900 font-black bg-white/90 px-8 py-3 rounded-2xl text-lg shadow-sm">₺{product.price}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[450px] bg-white flex flex-col h-[45vh] lg:h-screen border-l border-slate-200 shadow-2xl relative z-20">
        <div className="p-8 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-black text-slate-800 flex items-center gap-3 text-2xl tracking-tight"><Receipt size={28} className="text-indigo-600" /> ADİSYON</h3>
          <span className="bg-slate-900 text-white px-5 py-2 rounded-2xl text-xs font-black shadow-lg">{activeTable.orders.length} KALEM</span>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTable.orders.map(order => (
            <div key={order.productId} className="flex flex-col p-6 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="flex justify-between font-black text-slate-800 mb-4 text-xl">
                <span>{order.name}</span>
                <span className="text-indigo-600">₺{(order.price * order.quantity).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-black tracking-widest">₺{order.price} x {order.quantity}</span>
                <div className="flex items-center gap-3 bg-white rounded-2xl p-2 shadow-inner border border-slate-200">
                  <button onClick={() => handleRemoveProduct(order.productId)} className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition">{order.quantity === 1 ? <Trash2 size={20} /> : <Minus size={20} />}</button>
                  <span className="w-8 text-center font-black text-slate-800 text-xl">{order.quantity}</span>
                  <button onClick={() => handleAddProduct({id: order.productId, name: order.name, price: order.price})} className="p-3 text-emerald-600 hover:bg-emerald-50 rounded-xl transition"><Plus size={20} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-10 border-t border-slate-200 bg-white">
          <div className="flex justify-between items-end mb-8">
            <span className="text-slate-400 font-black text-xs uppercase tracking-[0.3em]">Genel Toplam</span>
            <span className="text-6xl font-black text-slate-900 tracking-tighter">₺{calculateTotal(activeTable.orders).toFixed(2)}</span>
          </div>
          <div className="flex gap-4">
            <button className="flex-1 bg-slate-900 text-white py-6 rounded-[2rem] font-black text-xs tracking-[0.2em] shadow-xl uppercase">MUTFAK</button>
            <button onClick={() => { if(window.confirm('Ödeme alındı mı?')) { handleRemoveProduct(null); } }} disabled={activeTable.orders.length === 0} className={`flex-1 py-6 rounded-[2rem] font-black text-xs tracking-[0.2em] transition shadow-xl flex items-center justify-center gap-3 uppercase ${activeTable.orders.length === 0 ? 'bg-slate-100 text-slate-300' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
              <CheckCircle size={24} /> ÖDEME AL
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        body { font-family: 'Inter', sans-serif; -webkit-tap-highlight-color: transparent; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}