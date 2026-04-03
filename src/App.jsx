import './index.css';
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

// --- FİREBASE ALTYAPISI (DAĞITIK SİSTEM ENTEGRASYONU) ---
const firebaseConfig = {
  apiKey: "AIzaSyCa_Rc0476-6E1La4J1XoopNU3bYzeJV1M",
  authDomain: "my-cafe-f8ee7.firebaseapp.com",
  projectId: "my-cafe-f8ee7",
  storageBucket: "my-cafe-f8ee7.firebasestorage.app",
  messagingSenderId: "408851040899",
  appId: "1:408851040899:web:a9378e8345356cbf3129b6",
  measurementId: "G-E5KRT2E8B2"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- VERİ MODELLERİ (MOCK DATA) ---

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
  orders: [], // Sipariş edilen ürünler: { productId, quantity, time }
  status: 'empty' // 'empty', 'occupied'
}));


// --- ANA UYGULAMA BİLEŞENİ ---

export default function App() {
  const [user, setUser] = useState(null);
  const [tables, setTables] = useState(INITIAL_TABLES);
  const [activeTableId, setActiveTableId] = useState(null);
  const [activeCategory, setActiveCategory] = useState('sicak');

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);

  // --- PWA (PROGRESSIVE WEB APP) ENTEGRASYONU ---
  // Literatürde PWA mimarisi iki ana bileşene dayanır: Manifest (meta veri) ve Service Worker (önbellekleme/çevrimdışı yetenek).
  // Bu prototipte, bu gereksinimleri çalışma zamanında (runtime) dinamik olarak (Blob injection ile) enjekte ediyoruz.
  useEffect(() => {
    // 1. Dinamik Web App Manifest (Tarayıcıya uygulamanın yüklenebilir bir kimliği olduğunu söyler)
    const manifestData = {
      name: "Cafe Adisyon POS",
      short_name: "Adisyon",
      start_url: ".",
      display: "standalone",
      background_color: "#f8fafc",
      theme_color: "#0f172a",
      icons: [
        {
          // Cihaz ana ekranında görünecek SVG tabanlı vektörel ikon
          src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230f172a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M17 8h1a4 4 0 1 1 0 8h-1'/%3E%3Cpath d='M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z'/%3E%3Cline x1='6' y1='2' x2='6' y2='4'/%3E%3Cline x1='10' y1='2' x2='10' y2='4'/%3E%3Cline x1='14' y1='2' x2='14' y2='4'/%3E%3C/svg%3E",
          sizes: "192x192 512x512",
          type: "image/svg+xml",
          purpose: "any maskable"
        }
      ]
    };

    const manifestBlob = new Blob([JSON.stringify(manifestData)], { type: 'application/json' });
    const manifestUrl = URL.createObjectURL(manifestBlob);
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = manifestUrl;
    document.head.appendChild(link);

    // 2. Service Worker Kaydı (DÜZELTME)
    // NOT: Çalışma ortamımızın (sandbox/iframe) sıkı güvenlik politikaları gereği, 
    // Blob URL'leri üzerinden dinamik Service Worker kaydına (register) izin verilmemektedir. 
    // Konsol hatasını önlemek adına bu bloğu kaldırdım. 
    // Gerçek bir sunucuda yayına alırken uygulamanın yanına fiziksel bir "sw.js" dosyası konulmalıdır.

    // 3. Tarayıcının "Kurulum" (Install) tetikleyicisini dinleme
    const handleBeforeInstallPrompt = (e) => {
      // Tarayıcının otomatik "Ana Ekrana Ekle" banner'ını engelliyoruz
      e.preventDefault();
      // Olayı daha sonra tetiklemek üzere saklıyoruz
      setDeferredPrompt(e);
      // Kurulum butonunu görünür yapıyoruz
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    // Kullanıcıya kurulum penceresini göster
    deferredPrompt.prompt();
    // Kullanıcının yanıtını bekle
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    // Kurulum penceresi bir kez gösterilebilir, referansı temizle
    setDeferredPrompt(null);
  };

  // 1. Aşama: Kimlik Doğrulama (Güvenli Veri Erişimi İçin)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Kimlik doğrulama hatası:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Aşama: Gerçek Zamanlı (Real-time) Dinleyici Bağlantısı
  useEffect(() => {
    if (!user) return;
    
    // Veritabanındaki masalar koleksiyonuna WebSocket üzerinden abone (subscribe) oluyoruz.
    const tablesRef = collection(db, 'artifacts', appId, 'public', 'data', 'tables');
    const unsubscribe = onSnapshot(tablesRef, (snapshot) => {
      const dbTables = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Buluttan gelen veri ile yerel kalıp veriyi birleştir (Merge)
      // Böylece henüz veritabanında oluşmamış masalar da ekranda boş olarak görünür.
      setTables(INITIAL_TABLES.map(initialTable => {
        const dbTable = dbTables.find(t => t.id === initialTable.id);
        return dbTable || initialTable;
      }));
    }, (error) => {
      console.error("Veri senkronizasyon hatası:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Aktif masanın verisini bul
  const activeTable = useMemo(() => 
    tables.find(t => t.id === activeTableId), 
    [tables, activeTableId]
  );

  // Kategoriye göre filtrelenmiş ürünler
  const filteredProducts = useMemo(() => 
    PRODUCTS.filter(p => p.category === activeCategory),
    [activeCategory]
  );

  // Sepete ürün ekleme (Dağıtık state güncellemesi)
  const handleAddProduct = async (product) => {
    if (!user) return;
    const currentTable = tables.find(t => t.id === activeTableId);
    if (!currentTable) return;

    const existingOrderIndex = currentTable.orders.findIndex(o => o.productId === product.id);
    let newOrders = [...currentTable.orders];
    
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

    // Yerel state'i güncellemek yerine veritabanını güncelliyoruz.
    // Dinleyici (onSnapshot) bu değişikliği algılayıp tüm cihazların ekranını anında güncelleyecektir.
    const tableRef = doc(db, 'artifacts', appId, 'public', 'data', 'tables', activeTableId);
    await setDoc(tableRef, {
      id: activeTableId,
      name: currentTable.name,
      orders: newOrders,
      status: 'occupied'
    });
  };

  // Sepetten ürün çıkarma/azaltma
  const handleRemoveProduct = async (productId) => {
    if (!user) return;
    const currentTable = tables.find(t => t.id === activeTableId);
    if (!currentTable) return;
    
    const existingOrderIndex = currentTable.orders.findIndex(o => o.productId === productId);
    if (existingOrderIndex === -1) return;

    let newOrders = [...currentTable.orders];
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

  // Masayı kapatma / Hesabı alma
  const handleCheckout = async () => {
    if (!user) return;
    // iframe kısıtlamaları nedeniyle browser onay pencereleri yerine modern modal pencereler tercih edilmelidir,
    // ancak bu prototipte sistemin reaksiyonunu görmek için window.confirm kullanıyoruz.
    if (window.confirm(`${activeTable.name} hesabı kapatılacak. Onaylıyor musunuz?`)) {
      const tableRef = doc(db, 'artifacts', appId, 'public', 'data', 'tables', activeTableId);
      await setDoc(tableRef, {
        id: activeTableId,
        name: activeTable.name,
        orders: [],
        status: 'empty'
      });
      setActiveTableId(null);
    }
  };

  // Toplam tutar hesaplama
  const calculateTotal = (orders) => {
    return orders.reduce((total, order) => total + (order.price * order.quantity), 0);
  };

  // --- GÖRÜNÜM: MASA SEÇİM EKRANI ---
  if (!activeTableId) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Salon Yönetimi</h1>
            <p className="text-slate-500">Aktif durumdaki masaları görüntüleyin</p>
          </div>
          <div className="flex items-center gap-3">
            {isInstallable && (
              <button 
                onClick={handleInstallClick}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full shadow-md transition-colors text-sm font-semibold animate-pulse"
              >
                <Download size={16} />
                Cihaza Yükle
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
                className={`
                  relative flex flex-col items-start p-5 rounded-2xl transition-all duration-200
                  border-2 text-left h-36
                  ${isOccupied 
                    ? 'bg-white border-emerald-500 shadow-md hover:shadow-lg' 
                    : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}
                `}
              >
                <div className="flex justify-between w-full mb-auto">
                  <span className={`text-lg font-bold ${isOccupied ? 'text-slate-800' : 'text-slate-400'}`}>
                    {table.name}
                  </span>
                  {isOccupied && <Utensils size={20} className="text-emerald-500" />}
                </div>
                
                {isOccupied && (
                  <div className="w-full mt-4">
                    <div className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                      <Clock size={12} /> {table.orders[table.orders.length-1]?.time || 'Yeni'}
                    </div>
                    <div className="font-semibold text-emerald-600 text-lg">
                      ₺{total.toFixed(2)}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // --- GÖRÜNÜM: SİPARİŞ EKRANI (POS) ---
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row font-sans overflow-hidden">
      
      {/* SOL/ÜST KISIM: MENÜ VE KATALOG */}
      <div className="flex-1 flex flex-col h-[60vh] lg:h-screen">
        {/* Başlık ve Geri Dönüş */}
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
                className={`
                  flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition
                  ${activeCategory === cat.id 
                    ? 'bg-slate-800 text-white shadow-md' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}
                `}
              >
                {cat.icon}
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Ürün Izgarası */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                onClick={() => handleAddProduct(product)}
                className={`
                  ${product.color} p-4 rounded-2xl flex flex-col items-center justify-center
                  text-center shadow-sm hover:shadow-md transition active:scale-95 min-h-[120px]
                  border border-black/5
                `}
              >
                <span className="font-semibold text-slate-800 mb-2 leading-tight">
                  {product.name}
                </span>
                <span className="text-slate-700 font-medium bg-white/50 px-3 py-1 rounded-lg text-sm">
                  ₺{product.price}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SAĞ/ALT KISIM: ADİSYON SEPETİ */}
      <div className="w-full lg:w-96 bg-white flex flex-col h-[40vh] lg:h-screen border-l border-slate-200 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-20">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Receipt size={20} />
            Adisyon Özeti
          </h3>
          <span className="bg-slate-200 text-slate-700 px-2 py-1 rounded text-xs font-semibold">
            {activeTable.orders.reduce((acc, curr) => acc + curr.quantity, 0)} Ürün
          </span>
        </div>

        {/* Sipariş Listesi */}
        <div className="flex-1 overflow-y-auto p-3">
          {activeTable.orders.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-70">
              <Receipt size={48} className="mb-3" />
              <p>Henüz ürün eklenmedi</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {activeTable.orders.map(order => (
                <div key={order.productId} className="flex flex-col p-3 border border-slate-100 bg-slate-50 rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-slate-800">{order.name}</span>
                    <span className="font-semibold text-slate-800">₺{(order.price * order.quantity).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-slate-500">Birim: ₺{order.price}</span>
                    <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg p-1">
                      <button 
                        onClick={() => handleRemoveProduct(order.productId)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        {order.quantity === 1 ? <Trash2 size={16} /> : <Minus size={16} />}
                      </button>
                      <span className="w-4 text-center font-semibold text-slate-700">{order.quantity}</span>
                      <button 
                        onClick={() => handleAddProduct({id: order.productId, name: order.name, price: order.price})}
                        className="p-1 text-emerald-500 hover:bg-emerald-50 rounded"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Toplam ve Ödeme Alanı */}
        <div className="p-4 bg-white border-t border-slate-200 pb-safe">
          <div className="flex justify-between items-end mb-4">
            <span className="text-slate-500 font-medium">Genel Toplam</span>
            <span className="text-3xl font-bold text-slate-800">
              ₺{calculateTotal(activeTable.orders).toFixed(2)}
            </span>
          </div>
          
          <div className="flex gap-2">
            <button className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-semibold transition active:scale-95 shadow-sm">
              Mutfak/Bar'a İlet
            </button>
            <button 
              onClick={handleCheckout}
              disabled={activeTable.orders.length === 0}
              className={`
                flex-1 py-3 rounded-xl font-semibold transition active:scale-95 flex items-center justify-center gap-2 shadow-sm
                ${activeTable.orders.length === 0 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'}
              `}
            >
              <CheckCircle size={20} />
              Tahsilat
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}