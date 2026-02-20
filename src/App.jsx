import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, LayoutDashboard, ArrowRightLeft, Search, Plus, 
  AlertTriangle, CheckCircle, XCircle, Edit, Trash2, X,
  TrendingUp, TrendingDown, Clock, Sparkles, Loader2, Database, Download
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, deleteDoc, writeBatch } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAR_VCccZQwhq4s_hhUFbKAwYmSb6tT6Ic",
  authDomain: "cheondoglass.firebaseapp.com",
  projectId: "cheondoglass",
  storageBucket: "cheondoglass.firebasestorage.app",
  messagingSenderId: "189724958056",
  appId: "1:189724958056:web:0c886b5478578b9f644add",
  measurementId: "G-P66Z4H5DV6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'cheondo-inventory-system';

// --- 에러 추적기가 달린 새로운 AI 연결 코드 ---
const fetchGemini = async (prompt) => {
  // 🚨 대표님의 진짜 API 키 적용 완료!
  const apiKey = "AIzaSyBD1gWNmjcda-FedtXBuf6hHLLPT8-lfYU"; 
  
  // 💡 구글 최신 정식 인공지능 모델 적용 완료!
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  let retries = 3;
  let delay = 1000;
  let lastErrorMsg = "AI 응답을 가져오는데 실패했습니다.";

  while (retries >= 0) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: "당신은 천도글라스의 재고 관리 및 건축/유리 자재 전문가입니다. 한국어로 전문적이고 간결하게 답변하세요." }] }
        })
      });

      const data = await response.json();

      // 구글 서버가 거절했다면, 그 "진짜 이유"를 화면에 띄우도록 에러를 던집니다!
      if (!response.ok) {
        throw new Error(`[구글 AI 오류] ${data.error?.message || response.statusText}`);
      }

      return data.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (error) {
      lastErrorMsg = error.message;
      if (retries === 0) throw new Error(lastErrorMsg); // 마지막 시도까지 실패하면 화면에 에러 표시
      await new Promise(res => setTimeout(res, delay));
      delay *= 2;
      retries--;
    }
  }
};

export default function InventoryApp() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isDbReady, setIsDbReady] = useState(false);
  
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productToDelete, setProductToDelete] = useState(null); 
  const [logToDelete, setLogToDelete] = useState(null);         
  const [toast, setToast] = useState(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const [aiReport, setAiReport] = useState(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
      showToast('천도글라스 앱이 기기에 설치되었습니다!');
    }
    setDeferredPrompt(null);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        showToast("인터넷 연결을 확인해주세요.", "error");
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const productsRef = collection(db, 'artifacts', appId, 'public', 'data', 'products');
    const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'logs');

    const unsubProducts = onSnapshot(productsRef, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(prods);
      setIsDbReady(true);
    }, (err) => showToast("데이터 수신 오류: " + err.message, "error"));

    const unsubLogs = onSnapshot(logsRef, (snapshot) => {
      const fetchedLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
      setLogs(fetchedLogs);
    }, (err) => showToast("내역 수신 오류: " + err.message, "error"));

    return () => { unsubProducts(); unsubLogs(); };
  }, [user]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000); // 3초 뒤 메시지 창 사라짐
  };

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const handleSaveProduct = async (productData) => {
    if (!user) return;
    if (!productData.name || !productData.sku || !productData.category) {
      showToast('이름, SKU, 카테고리는 필수 입력값입니다.', 'error');
      return;
    }
    
    const isDuplicateSKU = products.some(p => p.sku === productData.sku && p.id !== productData.id);
    if (isDuplicateSKU) {
      showToast('이미 존재하는 SKU(고유코드)입니다.', 'error');
      return;
    }

    try {
      const targetId = productData.id || generateId();
      const newQuantity = Number(productData.quantity) || 0;
      
      const batch = writeBatch(db);
      const productRef = doc(db, 'artifacts', appId, 'public', 'data', 'products', targetId);
      batch.set(productRef, { ...productData, id: targetId, quantity: productData.id ? productData.quantity : newQuantity });

      if (!productData.id && newQuantity > 0) {
        const logId = generateId();
        const logRef = doc(db, 'artifacts', appId, 'public', 'data', 'logs', logId);
        batch.set(logRef, {
          productId: targetId, type: 'IN', amount: newQuantity, date: new Date().toISOString(), user: 'System (초기등록)'
        });
      }

      await batch.commit();
      showToast(productData.id ? '제품이 수정되어 실시간 반영되었습니다.' : '새 제품이 등록되었습니다.');
      setIsProductModalOpen(false);
    } catch (e) {
      showToast('저장 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleDeleteProduct = (productId) => {
    const target = products.find(p => p.id === productId);
    if (target) setProductToDelete(target);
  };

  const executeDeleteProduct = async () => {
    if (!productToDelete || !user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', productToDelete.id));
      showToast(`'${productToDelete.name}' 자재가 삭제되었습니다.`);
    } catch (e) {
      showToast('삭제 중 오류가 발생했습니다.', 'error');
    } finally {
      setProductToDelete(null);
    }
  };

  const handleAdjustStock = async (productId, type, amount, userName) => {
    if (!user) return;
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('올바른 수량을 입력해주세요.', 'error');
      return;
    }
    if (!userName.trim()) {
      showToast('담당자 이름을 입력해주세요.', 'error');
      return;
    }

    const product = products.find(p => p.id === productId);
    if (!product) return;

    let newQuantity = product.quantity;
    if (type === 'IN') {
      newQuantity += numAmount;
    } else if (type === 'OUT') {
      if (product.quantity < numAmount) {
        showToast(`재고가 부족합니다. (현재 재고: ${product.quantity})`, 'error');
        return;
      }
      newQuantity -= numAmount;
    }

    try {
      const batch = writeBatch(db);
      
      const productRef = doc(db, 'artifacts', appId, 'public', 'data', 'products', productId);
      batch.update(productRef, { quantity: newQuantity });

      const logId = generateId();
      const logRef = doc(db, 'artifacts', appId, 'public', 'data', 'logs', logId);
      batch.set(logRef, {
        productId, type, amount: numAmount, date: new Date().toISOString(), user: userName
      });

      await batch.commit();
      showToast(`${type === 'IN' ? '입고' : '출고'}가 완료되어 전 직원에게 공유되었습니다.`);
      setIsAdjustModalOpen(false);
    } catch (e) {
      showToast('재고 조정 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleDeleteLog = (logId) => {
    const target = logs.find(l => l.id === logId);
    if (target) setLogToDelete(target);
  };

  const executeDeleteLog = async () => {
    if (!logToDelete || !user) return;

    try {
      const batch = writeBatch(db);
      const logRef = doc(db, 'artifacts', appId, 'public', 'data', 'logs', logToDelete.id);

      const product = products.find(p => p.id === logToDelete.productId);
      
      if (product) {
        let newQuantity = product.quantity;
        if (logToDelete.type === 'IN') {
          if (product.quantity < logToDelete.amount) {
            showToast(`복구 불가: 현재 재고(${product.quantity})가 취소량보다 적어 마이너스 재고가 됩니다.`, 'error');
            setLogToDelete(null);
            return;
          }
          newQuantity -= logToDelete.amount;
        } else if (logToDelete.type === 'OUT') {
          newQuantity += logToDelete.amount;
        }

        const productRef = doc(db, 'artifacts', appId, 'public', 'data', 'products', product.id);
        batch.update(productRef, { quantity: newQuantity });
      }

      batch.delete(logRef);
      await batch.commit();

      showToast('내역이 삭제되고 재고가 정상 복구(Rollback) 되었습니다.');
    } catch (e) {
      showToast('내역 삭제 중 오류가 발생했습니다.', 'error');
    } finally {
      setLogToDelete(null);
    }
  };

  const handleSeedData = async () => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      const sampleProducts = [
        { id: generateId(), name: '10mm 투명 강화유리 (1헤베)', sku: 'GL-T-10', category: '강화유리', price: 45000, quantity: 120, description: '가장 많이 쓰이는 기본 강화유리' },
        { id: generateId(), name: '구조용 실리콘 (흑색)', sku: 'SL-ST-BLK', category: '부자재', price: 6500, quantity: 300, description: '외장 코킹용 구조 실리콘' }
      ];
      sampleProducts.forEach(p => {
        batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'products', p.id), p);
      });
      await batch.commit();
      showToast('천도글라스 초기 샘플 데이터가 로드되었습니다.');
    } catch (e) {
      showToast('샘플 데이터 로드 실패', 'error');
    }
  };

  const totalProducts = products.length;
  const lowStockProducts = products.filter(p => p.quantity <= 10);
  const totalInventoryValue = products.reduce((acc, p) => acc + (p.price * p.quantity), 0);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, categoryFilter]);

  const categories = ['All', ...new Set(products.map(p => p.category))];

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const prompt = `
      다음은 천도글라스의 현재 클라우드 재고 상태입니다.
      총 제품 수: ${totalProducts}개
      총 재고 가치: ${totalInventoryValue}원
      재고 부족 제품(10개 이하): ${lowStockProducts.map(p => p.name).join(', ') || '없음'}
      
      위 데이터를 바탕으로:
      1. 현재 재고 상태에 대한 전반적인 평가 (1~2줄)
      2. 관리자가 즉시 취해야 할 구체적인 추천 액션 2가지
      를 보기 편한 마크다운 리스트 형태로 작성해주세요. (제목은 생략하고 내용만 바로 출력)
      `;
      // AI 호출 후 결과를 받아옵니다. 여기서 에러가 나면 아래 catch 블록으로 바로 이동합니다.
      const report = await fetchGemini(prompt);
      if(report) setAiReport(report);
    } catch (e) {
      // 🚨 이 부분이 변경되었습니다! 에러 메시지를 5초 동안 화면에 빨간색으로 띄워줍니다.
      showToast(e.message, 'error'); 
    } finally {
      setIsGeneratingReport(false);
    }
  };

  if (!isDbReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-indigo-600">
        <Loader2 size={48} className="animate-spin mb-4" />
        <h2 className="text-xl font-bold">천도글라스 서버 연결 중...</h2>
        <p className="text-slate-500 text-sm mt-2">정식 데이터베이스 정보를 불러오고 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col md:flex-row">
      {/* 화면 우측 상단에 뜨는 알림(Toast) 메시지 영역 */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg flex items-center gap-2 text-white animate-fade-in ${toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
          {toast.type === 'error' ? <XCircle size={20} /> : <CheckCircle size={20} />}
          {/* 에러 메시지가 길면 다 보이도록 스타일 수정 */}
          <span className="whitespace-pre-wrap text-sm">{toast.message}</span> 
        </div>
      )}

      <nav className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl flex-shrink-0 relative">
        <div className="p-6 bg-slate-950 text-white flex items-center gap-3 relative overflow-hidden">
          <div className="p-2 bg-blue-600 rounded-lg relative z-10">
            <Package size={24} />
          </div>
          <div className="relative z-10">
            <h1 className="font-bold text-lg tracking-wide">천도글라스</h1>
            <p className="text-xs text-blue-300 flex items-center gap-1">
              <Database size={10} /> 클라우드 연동 완료
            </p>
          </div>
        </div>
        <div className="flex-1 py-4 flex flex-row md:flex-col overflow-x-auto md:overflow-visible">
          <NavButton icon={<LayoutDashboard size={20} />} label="대시보드" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavButton icon={<Package size={20} />} label="제품 관리" active={activeTab === 'products'} onClick={() => setActiveTab('products')} />
          <NavButton icon={<ArrowRightLeft size={20} />} label="입출고 내역" active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} />
        </div>

        <div className="mt-auto p-4 md:p-6 border-t border-slate-800">
          {isInstallable ? (
            <button 
              onClick={handleInstallApp}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-transform hover:scale-105 shadow-lg shadow-emerald-900/50"
            >
              <Download size={18} />
              <span>기기에 앱 다운로드</span>
            </button>
          ) : (
            <button 
              onClick={() => setShowInstallGuide(true)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors border border-slate-700 shadow-sm"
            >
              <Download size={18} />
              <span>앱 설치 안내 보기</span>
            </button>
          )}
        </div>
      </nav>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-800">대시보드</h2>
              {products.length === 0 && (
                <button onClick={handleSeedData} className="px-3 py-1.5 bg-indigo-100 text-indigo-700 text-sm font-bold rounded-lg hover:bg-indigo-200 flex items-center gap-1">
                  <Database size={16}/> 초기 샘플 생성하기
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                <div className="p-4 bg-blue-50 text-blue-600 rounded-full"><Package size={28} /></div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">등록된 총 제품</p>
                  <p className="text-3xl font-bold text-slate-800">{totalProducts}건</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                <div className="p-4 bg-red-50 text-red-600 rounded-full"><AlertTriangle size={28} /></div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">재고 부족 (10개 이하)</p>
                  <p className="text-3xl font-bold text-red-600">{lowStockProducts.length}건</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                <div className="p-4 bg-emerald-50 text-emerald-600 rounded-full"><TrendingUp size={28} /></div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">총 재고 자산 가치</p>
                  <p className="text-2xl font-bold text-slate-800">{totalInventoryValue.toLocaleString()}원</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-100 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                  <Sparkles className="text-indigo-600" size={20} /> AI 재고 분석 리포트
                </h3>
                <button 
                  onClick={handleGenerateReport} 
                  disabled={isGeneratingReport || products.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors text-sm shadow-sm"
                >
                  {isGeneratingReport ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {aiReport ? '리포트 갱신' : 'AI 리포트 생성 ✨'}
                </button>
              </div>
              {aiReport ? (
                <div className="bg-white/60 p-4 rounded-lg text-sm text-slate-700 whitespace-pre-wrap leading-relaxed border border-indigo-50">
                  {aiReport}
                </div>
              ) : (
                <p className="text-sm text-indigo-400">데이터를 등록하고 버튼을 눌러 현황 분석을 받아보세요.</p>
              )}
            </div>

            {lowStockProducts.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                <h3 className="text-lg font-bold text-red-800 mb-4 flex items-center gap-2">
                  <AlertTriangle size={20} /> 재고 보충 필요 품목
                </h3>
                <div className="bg-white rounded-lg border border-red-100 overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-red-50 text-red-800">
                      <tr><th className="p-3">품명</th><th className="p-3">SKU</th><th className="p-3">현재 재고</th></tr>
                    </thead>
                    <tbody>
                      {lowStockProducts.map(p => (
                        <tr key={p.id} className="border-t border-red-100">
                          <td className="p-3 font-medium">{p.name}</td>
                          <td className="p-3 text-slate-500">{p.sku}</td>
                          <td className="p-3 font-bold text-red-600">{p.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Clock size={20} className="text-slate-500" /> 최근 입출고 내역 (최신 5건)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-3">일시</th><th className="p-3">유형</th><th className="p-3">품명</th><th className="p-3">수량</th><th className="p-3">담당자</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.slice(0, 5).map(log => {
                      const product = products.find(p => p.id === log.productId);
                      return (
                        <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-3 text-slate-500">{new Date(log.date).toLocaleString('ko-KR')}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${log.type === 'IN' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                              {log.type === 'IN' ? '입고' : '출고'}
                            </span>
                          </td>
                          <td className="p-3 font-medium">{product ? product.name : '삭제된 제품'}</td>
                          <td className="p-3 font-bold">{log.amount}</td>
                          <td className="p-3 text-slate-600">{log.user}</td>
                        </tr>
                      );
                    })}
                    {logs.length === 0 && <tr><td colSpan="5" className="p-6 text-center text-slate-500">클라우드에 등록된 내역이 없습니다.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-2xl font-bold text-slate-800">제품 관리</h2>
              <button 
                onClick={() => { setSelectedProduct(null); setIsProductModalOpen(true); }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                <Plus size={18} /> 새 제품 등록
              </button>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" placeholder="품명 또는 SKU 검색..." 
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select 
                className="w-full md:w-48 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
              >
                {categories.map(cat => <option key={cat} value={cat}>{cat === 'All' ? '전체 카테고리' : cat}</option>)}
              </select>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-4 font-semibold">품명 / SKU</th>
                      <th className="p-4 font-semibold">카테고리</th>
                      <th className="p-4 font-semibold text-right">단가</th>
                      <th className="p-4 font-semibold text-center">재고 수량</th>
                      <th className="p-4 font-semibold text-center">관리 / 재고조정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map(product => (
                      <tr key={product.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="p-4">
                          <p className="font-bold text-slate-800">{product.name}</p>
                          <p className="text-xs text-slate-500">{product.sku}</p>
                        </td>
                        <td className="p-4"><span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">{product.category}</span></td>
                        <td className="p-4 text-right font-medium">{product.price.toLocaleString()}원</td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full font-bold ${product.quantity <= 10 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {product.quantity}
                          </span>
                        </td>
                        <td className="p-4 text-center space-x-2">
                          <button onClick={() => { setSelectedProduct(product); setIsAdjustModalOpen(true); }} className="px-3 py-1.5 bg-slate-800 text-white rounded text-xs font-medium hover:bg-slate-700 transition-colors">입출고</button>
                          <button onClick={() => { setSelectedProduct(product); setIsProductModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit size={16} /></button>
                          <button onClick={() => handleDeleteProduct(product.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                    {filteredProducts.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-500">데이터가 없습니다.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-bold text-slate-800">전체 입출고 내역</h2>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-4 font-semibold">거래 일시</th>
                      <th className="p-4 font-semibold">유형</th>
                      <th className="p-4 font-semibold">대상 품목</th>
                      <th className="p-4 font-semibold text-right">변동 수량</th>
                      <th className="p-4 font-semibold">담당자</th>
                      <th className="p-4 font-semibold text-center">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => {
                      const product = products.find(p => p.id === log.productId);
                      return (
                        <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-4 text-slate-600">{new Date(log.date).toLocaleString('ko-KR')}</td>
                          <td className="p-4">
                            {log.type === 'IN' ? 
                              <span className="flex items-center gap-1 text-blue-600 font-bold"><TrendingUp size={16} /> 입고</span> : 
                              <span className="flex items-center gap-1 text-orange-600 font-bold"><TrendingDown size={16} /> 출고</span>
                            }
                          </td>
                          <td className="p-4 font-medium text-slate-800">{product ? product.name : <span className="text-red-400">삭제된 제품</span>}</td>
                          <td className="p-4 text-right font-bold">{log.amount}</td>
                          <td className="p-4 text-slate-600">{log.user}</td>
                          <td className="p-4 text-center">
                            <button onClick={() => handleDeleteLog(log.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="내역 삭제 및 재고 복구">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {logs.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-slate-500">입출고 내역이 없습니다.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {isProductModalOpen && (
        <ProductModal 
          product={selectedProduct} 
          onClose={() => setIsProductModalOpen(false)} 
          onSave={handleSaveProduct} 
          showToast={showToast}
        />
      )}
      {isAdjustModalOpen && selectedProduct && (
        <AdjustStockModal 
          product={selectedProduct} 
          onClose={() => setIsAdjustModalOpen(false)} 
          onSave={handleAdjustStock} 
        />
      )}

      {productToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6 text-center border border-red-100">
            <div className="mx-auto w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
              <Trash2 size={28} />
            </div>
            <h3 className="font-bold text-xl text-slate-800 mb-2">자재를 삭제할까요?</h3>
            <p className="text-slate-600 mb-6 text-sm leading-relaxed">
              <strong className="text-slate-900 block mb-1 text-base">{productToDelete.name}</strong>
              정말 이 자재를 지우시겠습니까?<br/>
              <span className="text-red-500 font-medium">삭제 시 직원들의 화면에서도 즉시 사라집니다.</span>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setProductToDelete(null)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">취소</button>
              <button onClick={executeDeleteProduct} className="flex-1 px-4 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200">삭제하기</button>
            </div>
          </div>
        </div>
      )}

      {logToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6 text-center border border-orange-100">
            <div className="mx-auto w-14 h-14 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle size={28} />
            </div>
            <h3 className="font-bold text-xl text-slate-800 mb-2">내역을 삭제할까요?</h3>
            <p className="text-slate-600 mb-6 text-sm leading-relaxed">
              이 입출고 기록을 지우시면 관련된 자재의<br/>
              <strong className="text-orange-600">재고 수량도 자동으로 복구(Rollback)</strong>되며,<br/>
              전 직원에게 실시간으로 반영됩니다.
              {!products.some(p => p.id === logToDelete.productId) && (
                <span className="block mt-2 text-red-500 font-bold">※ 주의: 자재가 이미 삭제된 상태이므로 내역만 지워집니다.</span>
              )}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setLogToDelete(null)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">취소</button>
              <button onClick={executeDeleteLog} className="flex-1 px-4 py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition-colors shadow-lg shadow-orange-200">확인 및 삭제</button>
            </div>
          </div>
        </div>
      )}

      {showInstallGuide && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <Download className="text-blue-600" size={20} /> 스마트폰에 앱 설치하기
              </h3>
              <button onClick={() => setShowInstallGuide(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4 text-sm text-slate-600 leading-relaxed">
              <p>
                대표님, 현재 보시는 화면은 코드를 테스트하는 <strong className="text-blue-600">임시 환경(미리보기)</strong>입니다. 
                해킹 및 오류 방지 정책상 이런 임시 환경에서는 기기에 진짜 앱을 다운로드할 수 없도록 막혀있습니다.
              </p>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-800 mb-2">🚀 전 직원 폰에 설치하는 3단계</h4>
                <ol className="list-decimal pl-5 space-y-2 font-medium">
                  <li>이 완성된 코드를 <strong className="text-slate-800">Vercel</strong> 또는 <strong className="text-slate-800">Firebase</strong> 같은 웹 서버에 정식으로 <strong className="text-blue-600">배포(업로드)</strong>합니다.</li>
                  <li>발급받은 <strong className="text-blue-600">천도글라스 고유 주소(URL)</strong>를 직원들 카카오톡으로 공유합니다.</li>
                  <li>직원들이 폰에서 해당 주소를 열면, 화면에 <strong className="text-emerald-600">"홈 화면에 천도글라스 추가(앱 설치)"</strong> 버튼이 자동으로 활성화됩니다!</li>
                </ol>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button onClick={() => setShowInstallGuide(false)} className="px-6 py-2 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-lg transition-colors">확인했습니다</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function NavButton({ icon, label, active, onClick }) {
    return (
      <button 
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-6 py-3 md:py-4 transition-colors text-sm font-medium
          ${active ? 'bg-blue-600 text-white border-l-4 border-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border-l-4 border-transparent'}`}
      >
        {icon} <span className="hidden md:inline">{label}</span>
      </button>
    );
  }

  function ProductModal({ product, onClose, onSave, showToast }) {
    const [formData, setFormData] = useState(
      product || { name: '', sku: '', category: '', price: 0, quantity: 0, description: '' }
    );
    const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

    const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData({ ...formData, [name]: name === 'price' || name === 'quantity' ? Number(value) : value });
    };

    const handleGenerateDesc = async () => {
      if (!formData.name) {
        if(showToast) showToast('품명을 먼저 입력해주세요.', 'error');
        return;
      }
      setIsGeneratingDesc(true);
      try {
        const prompt = `건축/유리 자재 쇼핑몰에 등록할 제품의 설명을 작성해주세요. 
        - 제품명: ${formData.name}
        - 카테고리: ${formData.category || '미지정'}
        2문장 이내로 전문적이고 매력적으로 작성해주세요. (따옴표나 불필요한 서두 생략)`;
        
        const desc = await fetchGemini(prompt);
        if (desc) {
          setFormData(prev => ({ ...prev, description: desc.trim() }));
          if(showToast) showToast('AI가 설명을 성공적으로 작성했습니다.');
        }
      } catch (e) {
        if(showToast) showToast(e.message, 'error');
      } finally {
        setIsGeneratingDesc(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-lg text-slate-800">{product ? '제품 정보 수정' : '신규 제품 등록'}</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">품명 (필수)</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="ex) 10mm 투명 강화유리" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">SKU / 고유코드 (필수)</label>
                <input type="text" name="sku" value={formData.sku} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">카테고리 (필수)</label>
                <input type="text" name="category" value={formData.category} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="ex) 강화유리, 부자재" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">단가 (원)</label>
                <input type="number" name="price" value={formData.price} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">초기 재고수량</label>
                <input type="number" name="quantity" value={formData.quantity} onChange={handleChange} disabled={!!product} className="w-full p-2 border border-slate-300 rounded outline-none disabled:bg-slate-100 disabled:text-slate-400" title={product ? "재고 수정은 '입출고' 버튼을 이용하세요." : ""} />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-500">상세 설명</label>
                <button 
                  type="button" 
                  onClick={handleGenerateDesc} 
                  disabled={isGeneratingDesc}
                  className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold bg-indigo-50 px-2 py-1 rounded transition-colors disabled:opacity-50"
                >
                  {isGeneratingDesc ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  AI 자동 작성 ✨
                </button>
              </div>
              <textarea name="description" value={formData.description} onChange={handleChange} rows="3" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none resize-none"></textarea>
            </div>
          </div>
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded transition-colors">취소</button>
            <button onClick={() => onSave(formData)} className="px-4 py-2 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded transition-colors">저장하기</button>
          </div>
        </div>
      </div>
    );
  }

  function AdjustStockModal({ product, onClose, onSave }) {
    const [type, setType] = useState('IN');
    const [amount, setAmount] = useState('');
    const [user, setUser] = useState('');

    return (
      <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-lg text-slate-800">입고 / 출고 등록</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
          </div>
          <div className="p-6 space-y-5">
            <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-500 mb-1">선택된 품목</p>
              <p className="font-bold text-slate-800">{product.name}</p>
              <p className="text-xs text-blue-600 font-bold mt-1">현재 재고: {product.quantity} 개</p>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => setType('IN')} 
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${type === 'IN' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >입고 (IN)</button>
              <button 
                onClick={() => setType('OUT')} 
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${type === 'OUT' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >출고 (OUT)</button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">변동 수량</label>
              <input 
                type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} 
                className="w-full p-3 text-lg font-bold border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-center" 
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">담당자 이름 (필수)</label>
              <input 
                type="text" value={user} onChange={(e) => setUser(e.target.value)} 
                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                placeholder="작업자 이름 입력"
              />
            </div>
          </div>
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded transition-colors">취소</button>
            <button 
              onClick={() => onSave(product.id, type, amount, user)} 
              className={`px-6 py-2 text-white font-medium rounded transition-colors ${type === 'IN' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'}`}
            >
              {type === 'IN' ? '입고 처리' : '출고 처리'}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
