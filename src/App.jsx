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

// NOT: Vercel ortamında stil dosyanızın yüklenmesi için 
// yerel src/App.jsx dosyanızda "import './index.css';" satırını tutabilirsiniz.
// Ancak bu önizleme ortamında hata vermemesi için aşağıya dahili stil ekledim.

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "", authDomain: "", projectId: ""
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

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

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) { console.error(error); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const tablesRef = collection(db, 'artifacts', appId, 'public', 'data', 'tables');
    const unsubscribe = onSnapshot(tablesRef, (snapshot) => {
      const dbTables = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTables(INITIAL_TABLES.map(initialTable => {
        const dbTable = dbTables.find(t => t.id === initialTable.id);
        return dbTable || initialTable;
      }));
    }, (error) => { console.error(error); });
    return () => unsubscribe();
  }, [user]);

  const activeTable = useMemo(() => tables.find(t => t.id === activeTableId), [tables, activeTableId]);
  const filteredProducts = useMemo(() => PRODUCTS.filter(p => p.category === activeCategory), [activeCategory]);

  const handleAddProduct = async (product) => {
    if (!user) return;
    const currentTable = tables.find(t => t.id === activeTableId);
    if (!currentTable) return;
    let newOrders = [...currentTable.orders];
    const idx = newOrders.findIndex(o => o.productId === product.id);
    if (idx >= 0) {
      newOrders[idx] = { ...newOrders[idx], quantity: newOrders[idx].quantity + 1 };
    } else {
      newOrders.push({ productId: product.id, name: product.name, price: product.price, quantity: 1, time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) });
    }
    const tableRef = doc(db, 'artifacts', appId, 'public', 'data', 'tables', activeTableId);
    await setDoc(tableRef, { ...currentTable, orders: newOrders, status: 'occupied' });
  };

  const handleRemoveProduct = async (productId) => {
    if (!user) return;
    const currentTable = tables.find(t => t.id === activeTableId);
    if (!currentTable) return;
    let newOrders = [...currentTable.orders];
    const idx = newOrders.findIndex(o => o.productId === productId);
    if (idx === -1) return;
    if (newOrders[idx].quantity > 1) {
      newOrders[idx] = { ...newOrders[idx], quantity: newOrders[idx].quantity - 1 };
    } else { newOrders.splice(idx, 1); }
    const status = newOrders.length === 0 ? 'empty' : 'occupied';
    const tableRef = doc(db, 'artifacts', appId, 'public', 'data', 'tables', activeTableId);
    await setDoc(tableRef, { ...currentTable, orders: newOrders, status });
  };

  const handleCheckout = async () => {
    if (!user) return;
    if (window.confirm(`${activeTable.name} hesabı kapatılacak?`)) {
      const tableRef = doc(db, 'artifacts', appId, 'public', 'data', 'tables', activeTableId);
      await setDoc(tableRef, { id: activeTableId, name: activeTable.name, orders: [], status: 'empty' });
      setActiveTableId(null);
    }
  };

  const calculateTotal = (orders) => orders.reduce((total, order) => total + (order.price * order.quantity), 0);

  if (!activeTableId) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">Salon Yönetimi</h1>
            <p className="text-slate-500 font-medium">Aktif masaları ve adisyonları takip edin</p>
          </div>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200">
            <User size={18} className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-700">Ahmet</span>
          </div>
        </header>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {tables.map(table => {
            const isOccupied = table.status === 'occupied';
            return (
              <button key={table.id} onClick={() => setActiveTableId(table.id)} className={`flex flex-col p-6 rounded-3xl transition-all border-2 text-left h-44 shadow-sm ${isOccupied ? 'bg-white border-emerald-500 ring-4 ring-emerald-50' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                <div className="flex justify-between w-full mb-auto items-center">
                  <span className={`text-xl font-extrabold ${isOccupied ? 'text-slate-800' : 'text-slate-300'}`}>{table.name}</span>
                  {isOccupied && <Utensils size={20} className="text-emerald-500" />}
                </div>
                {isOccupied ? (
                  <div className="w-full">
                    <div className="text-xs text-slate-400 flex items-center gap-1 mb-1 font-bold"><Clock size={12} /> {table.orders[table.orders.length-1]?.time}</div>
                    <div className="font-black text-emerald-600 text-2xl tracking-tighter">₺{calculateTotal(table.orders).toFixed(2)}</div>
                  </div>
                ) : <span className="text-xs font-black uppercase text-slate-300 tracking-widest">BOŞ</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row font-sans overflow-hidden text-slate-900">
      <div className="flex-1 flex flex-col h-[60vh] lg:h-screen">
        <header className="bg-white p-4 flex items-center gap-4 shadow-sm border-b border-slate-200">
          <button onClick={() => setActiveTableId(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition"><ArrowLeft size={24} /></button>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">{activeTable.name} Sipariş Ekranı</h2>
        </header>
        <div className="bg-white border-b border-slate-200 p-3 overflow-x-auto">
          <div className="flex gap-2">
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition whitespace-nowrap ${activeCategory === cat.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filteredProducts.map(product => (
              <button key={product.id} onClick={() => handleAddProduct(product)} className={`${product.color} p-5 rounded-3xl flex flex-col items-center justify-center text-center shadow-sm hover:shadow-md transition active:scale-95 border border-black/5`}>
                <span className="font-bold text-slate-800 mb-2">{product.name}</span>
                <span className="text-slate-900 font-black bg-white/70 px-4 py-1.5 rounded-xl text-sm shadow-inner">₺{product.price}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="w-full lg:w-96 bg-white flex flex-col h-[40vh] lg:h-screen border-l border-slate-200 shadow-2xl">
        <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-black text-slate-800 flex items-center gap-2"><Receipt size={20} /> ADİSYON</h3>
          <span className="bg-slate-900 text-white px-3 py-1 rounded-full text-xs font-black">{activeTable.orders.length} KALEM</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTable.orders.map(order => (
            <div key={order.productId} className="flex flex-col p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex justify-between font-bold text-slate-800 mb-2"><span>{order.name}</span><span>₺{(order.price * order.quantity).toFixed(2)}</span></div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-bold">₺{order.price} x {order.quantity}</span>
                <div className="flex items-center gap-2 bg-white rounded-xl p-1 shadow-sm border border-slate-200">
                  <button onClick={() => handleRemoveProduct(order.productId)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">{order.quantity === 1 ? <Trash2 size={16} /> : <Minus size={16} />}</button>
                  <span className="w-6 text-center font-black text-slate-800">{order.quantity}</span>
                  <button onClick={() => handleAddProduct({id: order.productId, name: order.name, price: order.price})} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Plus size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-6 border-t border-slate-200 bg-white">
          <div className="flex justify-between items-end mb-6">
            <span className="text-slate-400 font-black text-xs uppercase tracking-widest">Toplam</span>
            <span className="text-4xl font-black text-slate-900 tracking-tighter">₺{calculateTotal(activeTable.orders).toFixed(2)}</span>
          </div>
          <div className="flex gap-3">
            <button className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black text-xs tracking-widest hover:bg-black transition active:scale-95 shadow-lg">MUTFAK</button>
            <button onClick={handleCheckout} disabled={activeTable.orders.length === 0} className={`flex-1 py-4 rounded-2xl font-black text-xs tracking-widest transition active:scale-95 shadow-lg flex items-center justify-center gap-2 ${activeTable.orders.length === 0 ? 'bg-slate-100 text-slate-300' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}><CheckCircle size={18} /> ÖDEME</button>
          </div>
        </div>
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        body { font-family: 'Inter', sans-serif; -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}