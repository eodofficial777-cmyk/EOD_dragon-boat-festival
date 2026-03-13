import React, { useState, useEffect, useRef, useCallback } from 'react';

// ============================================================
// ★★★ 將這裡換成你的 Google Apps Script 部署網址 ★★★
// ============================================================
const API_URL = 'https://script.google.com/macros/s/AKfycbzcTH56mDWt_AtygCjo-oJHu6YSWe9i6rk_9qp7gNk8rTzXdVhXZQeO6XHk1BL3TS4/exec';

// ============================================================
// API 呼叫工具
// ============================================================
async function apiGet(action, params = {}) {
  const url = new URL(API_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  return res.json();
}

async function apiPost(body) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // Apps Script CORS 需要 text/plain
    body: JSON.stringify(body),
  });
  return res.json();
}

// ============================================================
// 印章元件 - 只需提供噗浪圖床網址即可
// ============================================================
function StampDesign({ stamp, size = 88, stamped = false, boothEmoji = '🏮' }) {
  // 未集章：灰色佔位
  if (!stamped) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        border: '3px dashed #e2e8f0', background: '#fafafa',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden'
      }}>
        <span style={{ fontSize: size * 0.36, color: '#e2e8f0', fontWeight: 900 }}>?</span>
      </div>
    );
  }

  // 有圖片 → 圓形印章
  if (stamp.imageUrl) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', overflow: 'hidden',
        border: '3px solid rgba(13,148,136,0.2)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        position: 'relative', background: '#fff'
      }}>
        <img src={stamp.imageUrl} alt="stamp"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
        />
        <div style={{ display: 'none', position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, background: 'linear-gradient(135deg, #ecfdf5, #f0fdf4)' }}>
          {boothEmoji}
        </div>
      </div>
    );
  }

  // 無圖片 fallback → emoji 圓形
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', overflow: 'hidden',
      border: '3px solid rgba(13,148,136,0.2)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      background: 'linear-gradient(135deg, #ecfdf5, #f0fdf4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4
    }}>
      {boothEmoji}
    </div>
  );
}

// ============================================================
// 工具
// ============================================================
const AVATAR_COLORS = ['#f87171','#fb923c','#fbbf24','#34d399','#22d3ee','#818cf8','#c084fc','#f472b6','#a78bfa','#6ee7b7'];
function getAvatarColor(name) { let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h); return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]; }

const WaveDivider = ({ flip, color = '#0d9488' }) => (
  <svg viewBox="0 0 1200 40" fill="none" style={{ display: 'block', width: '100%', marginBottom: flip ? 0 : -1, marginTop: flip ? -1 : 0, transform: flip ? 'rotate(180deg)' : 'none' }}>
    <path d="M0 20C200 0 400 40 600 20C800 0 1000 40 1200 20V40H0V20Z" fill={color} fillOpacity="0.08" />
  </svg>
);

const RANK_STYLES = [
  { bg: 'linear-gradient(135deg, #fef3c7, #fde68a)', border: '#fbbf24', medal: '🥇', glow: 'rgba(251,191,36,0.15)' },
  { bg: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)', border: '#94a3b8', medal: '🥈', glow: 'rgba(148,163,184,0.12)' },
  { bg: 'linear-gradient(135deg, #fef2f2, #fde2c8)', border: '#d97706', medal: '🥉', glow: 'rgba(217,119,6,0.1)' },
];

// 預設攤位 (如果 API 還沒回來的 fallback)
const DEFAULT_BOOTHS = [
  { id: 'booth-1', side: 'top', name: '載入中...', emoji: '⏳', stamp: { imageUrl: '' }, items: [], description: '', plurkUrl: '', task: '', facadeImageUrl: '' }
];

// 模擬龍舟賽資料
const MOCK_RACE_TEAMS = [
  { id: 1, name: '南港輪胎隊', color: '#dc2626', flagImageUrl: '', outboundScore: 120, inboundScore: 0, turnSuccess: false, cheers: 88, lastRolls: [15, 20, 18, 5, 2] },
  { id: 2, name: '屈原不想下水隊', color: '#2563eb', flagImageUrl: 'https://images.plurk.com/2HjjzKJMBWLsFSHYdLaNAv.png', outboundScore: 200, inboundScore: 0, turnSuccess: false, cheers: 156, lastRolls: [20, 20, 20, 20, 20] },
  { id: 3, name: '粽子吃到飽隊', color: '#16a34a', flagImageUrl: '', outboundScore: 200, inboundScore: 60, turnSuccess: true, cheers: 342, lastRolls: [1, 3, 2, 5, 4] },
  { id: 4, name: '極速龍舟傳說', color: '#9333ea', flagImageUrl: 'https://images.plurk.com/2HjjzKJMBWLsFSHYdLaNAv.png', outboundScore: 200, inboundScore: 200, turnSuccess: true, cheers: 999, lastRolls: [] },
];

// ============================================================
// 主 App
// ============================================================
export default function App() {
  const [booths, setBooths] = useState(DEFAULT_BOOTHS);
  const [userData, setUserData] = useState(null);
  const [view, setView] = useState('entry');
  const [selectedBooth, setSelectedBooth] = useState(null);
  const [message, setMessage] = useState(null);
  const [inputName, setInputName] = useState('');
  const [inputPin, setInputPin] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [hoveredNav, setHoveredNav] = useState(null);
  const [loading, setLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [raceTeams, setRaceTeams] = useState([]);
  const [zoomFlagUrl, setZoomFlagUrl] = useState(null);

  const showMsg = (text, type = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // ============================================================
  // 初始化：從 Google Sheets 載入攤位資料
  // ============================================================
  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet('getBooths');
        if (res.success && res.data?.length) {
          setBooths(res.data);
        }
      } catch (err) {
        console.warn('攤位載入失敗，使用離線模式:', err);
      }
    })();
  }, []);

  // ============================================================
  // 載入龍舟賽況 (輪詢)
  // ============================================================
  useEffect(() => {
    const loadRace = async () => {
      try {
        const res = await apiGet('getRace');
        if (res.success && res.data?.length) {
          setRaceTeams(res.data);
          return;
        }
      } catch (err) { /* fallback to mock */ }
      // Mock data fallback
      setRaceTeams(MOCK_RACE_TEAMS);
    };
    loadRace();
    const timer = setInterval(loadRace, 6000);
    return () => clearInterval(timer);
  }, []);

  // ============================================================
  // 載入排行榜
  // ============================================================
  const loadLeaderboard = useCallback(async () => {
    try {
      const res = await apiGet('getLeaderboard');
      if (res.success) setLeaderboard(res.data);
    } catch (err) { console.warn('排行榜載入失敗:', err); }
  }, []);

  // ============================================================
  // 載入集章名單
  // ============================================================
  const loadCollectors = useCallback(async (boothId) => {
    try {
      const res = await apiGet('getCollectors', { boothId });
      if (res.success) setCollectors(res.data);
    } catch (err) { console.warn('集章名單載入失敗:', err); }
  }, []);

  // ============================================================
  // 註冊
  // ============================================================
  const handleRegister = async () => {
    if (!inputName.trim() || inputPin.length < 4) return showMsg('請輸入暱稱和至少4位數的密碼！', 'warn');
    setLoading(true);
    try {
      const res = await apiPost({ action: 'register', username: inputName.trim(), pin: inputPin.trim() });
      if (!res.success) return showMsg(res.error, 'warn');
      setUserData(res.data);
      setView('home');
      showMsg(`歡迎來到慶典，${res.data.username}！`, 'success');
    } catch (err) {
      showMsg('註冊失敗，請檢查網路', 'warn');
    } finally { setLoading(false); }
  };

  // ============================================================
  // 登入
  // ============================================================
  const handleLogin = async () => {
    if (!inputName.trim() || !inputPin.trim()) return showMsg('請輸入暱稱和密碼！', 'warn');
    setLoading(true);
    try {
      const res = await apiGet('login', { username: inputName.trim(), pin: inputPin.trim() });
      if (!res.success) return showMsg(res.error, 'warn');
      setUserData(res.data);
      setView('home');
      showMsg(`歡迎回來，${res.data.username}！`, 'success');
    } catch (err) {
      showMsg('登入失敗，請檢查網路', 'warn');
    } finally { setLoading(false); }
  };

  // ============================================================
  // 試玩
  // ============================================================
  const handleDemoLogin = () => {
    const name = `旅人_${Math.floor(Math.random() * 10000)}`;
    setUserData({
      username: name, pin: '0000', coins: 888,
      inventory: [{ id: 'demo-1', name: '試吃肉粽', price: 0, boothName: booths[0]?.name || '試玩攤位', description: '免費試吃品', imageUrl: '', date: new Date().toLocaleDateString(), stackRotation: 3 }],
      stamps: booths.length > 0 ? [booths[0].id] : [], createdAt: new Date().toISOString(), isDemo: true
    });
    setView('home');
    showMsg(`試玩模式啟動！（資料不會存入雲端）`, 'success');
  };

  const handleLogout = () => {
    setUserData(null); setView('entry'); setInputName(''); setInputPin(''); setIsLoginMode(true);
    showMsg('已安全登出。');
  };

  // ============================================================
  // 開啟攤位
  // ============================================================
  const openBooth = (booth) => {
    setSelectedBooth(booth);
    setCollectors([]);
    setView('booth');
    loadCollectors(booth.id);
  };
  const closeBooth = () => { setView('home'); setSelectedBooth(null); };

  // ============================================================
  // 購買
  // ============================================================
  const buyItem = async (booth, item) => {
    if (userData.coins < item.price) return showMsg('購物金不足喔！', 'warn');

    // 即時更新 UI
    const newItem = { ...item, boothName: booth.name, date: new Date().toLocaleDateString(), stackRotation: Math.floor(Math.random() * 10) - 5 };
    const optimistic = { ...userData, coins: userData.coins - item.price, inventory: [...userData.inventory, newItem] };
    setUserData(optimistic);
    showMsg(`成功購買 ${item.name}！`, 'success');

    // 寫入後端 (非 demo 才寫)
    if (!userData.isDemo) {
      try {
        const res = await apiPost({
          action: 'buyItem', username: userData.username,
          itemId: item.id, itemName: item.name, itemPrice: item.price,
          boothName: booth.name, itemDesc: item.description, itemImageUrl: item.imageUrl
        });
        if (res.success) setUserData(prev => ({ ...prev, coins: res.data.coins, inventory: res.data.inventory }));
      } catch (err) { console.warn('購買同步失敗:', err); }
    }
  };

  // ============================================================
  // 集章
  // ============================================================
  const collectStamp = async (boothId) => {
    if (userData.stamps.includes(boothId)) return showMsg('這個章你已經領過囉！');

    // 即時更新 UI
    const optimistic = { ...userData, coins: userData.coins + 50, stamps: [...userData.stamps, boothId] };
    setUserData(optimistic);
    showMsg('成功集章！獲得 50 元購物金！', 'success');

    if (!userData.isDemo) {
      try {
        const res = await apiPost({ action: 'collectStamp', username: userData.username, boothId });
        if (res.success) {
          setUserData(prev => ({ ...prev, coins: res.data.coins, stamps: res.data.stamps }));
          loadCollectors(boothId); // 重新載入名單
        }
      } catch (err) { console.warn('集章同步失敗:', err); }
    }
  };

  // --- 入口畫面 ---
  if (view === 'entry' || !userData) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'hidden', position: 'relative', background: 'linear-gradient(160deg, #0f2922 0%, #134e3a 40%, #1a3a4a 100%)' }}>
      <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(234,179,8,0.12) 0%, transparent 70%)', borderRadius: '50%' }} />
      <div style={{ position: 'absolute', bottom: '-15%', left: '-10%', width: 300, height: 300, background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)', borderRadius: '50%' }} />
      <div style={{ maxWidth: 380, width: '100%', position: 'relative', zIndex: 10, animation: 'fadeSlideUp 0.7s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 72, height: 72, margin: '0 auto 16px', background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, boxShadow: '0 8px 32px rgba(245,158,11,0.25)', transform: 'rotate(3deg)' }}>🐉</div>
          <h1 style={{ fontFamily: '"Noto Serif TC", Georgia, serif', fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: 2 }}>端午盛夏慶典</h1>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(167,215,195,0.6)', letterSpacing: 4, textTransform: 'uppercase', marginTop: 4 }}>Dragon Boat Festival</p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 28, padding: '28px 24px', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', borderRadius: 14, padding: 3, marginBottom: 20 }}>
            {['新玩家登記', '讀取舊檔'].map((label, i) => {
              const active = i === (isLoginMode ? 1 : 0);
              return (<button key={i} onClick={() => setIsLoginMode(i === 1)} style={{ flex: 1, padding: '10px 0', borderRadius: 12, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.3s', background: active ? 'rgba(255,255,255,0.95)' : 'transparent', color: active ? '#134e3a' : 'rgba(167,215,195,0.5)', boxShadow: active ? '0 2px 8px rgba(0,0,0,0.15)' : 'none' }}>{label}</button>);
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(167,215,195,0.7)', marginLeft: 4, letterSpacing: 1 }}>角色暱稱</label>
              <input type="text" maxLength={12} value={inputName} onChange={e => setInputName(e.target.value)} placeholder="請輸入暱稱"
                style={{ width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '14px 16px', background: 'rgba(0,20,15,0.4)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 16, color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(167,215,195,0.7)', marginLeft: 4, letterSpacing: 1 }}>通行密碼</label>
              <input type="password" maxLength={8} value={inputPin} onChange={e => setInputPin(e.target.value)} placeholder={isLoginMode ? '輸入密碼' : '設定4位數以上密碼'}
                style={{ width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '14px 16px', background: 'rgba(0,20,15,0.4)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 16, color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit', letterSpacing: 4 }} />
            </div>
          </div>

          <button onClick={isLoginMode ? handleLogin : handleRegister} disabled={loading}
            style={{ width: '100%', marginTop: 20, padding: '16px 0', background: loading ? '#94a3b8' : 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#134e3a', fontSize: 16, fontWeight: 900, border: 'none', borderRadius: 16, cursor: loading ? 'wait' : 'pointer', boxShadow: '0 4px 20px rgba(245,158,11,0.3)', letterSpacing: 1 }}>
            {loading ? '處理中...' : isLoginMode ? '登入慶典 →' : '開始冒險 →'}
          </button>

          <button onClick={handleDemoLogin} style={{ width: '100%', marginTop: 10, padding: '14px 0', background: 'rgba(16,185,129,0.12)', color: 'rgba(167,215,195,0.8)', fontSize: 13, fontWeight: 700, border: '1px solid rgba(16,185,129,0.2)', borderRadius: 16, cursor: 'pointer' }}>
            ⚡ 快速試玩 (Demo)
          </button>
        </div>
        {userData?.isDemo && <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 12 }}>試玩模式的資料不會儲存到雲端</p>}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700;900&family=Noto+Sans+TC:wght@400;500;700;900&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Noto Sans TC',-apple-system,sans-serif; }
        ::placeholder { color: rgba(167,215,195,0.35); }
        @keyframes fadeSlideUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );

  // ============================================================
  // 主畫面
  // ============================================================
  return (
    <div style={{ minHeight: '100vh', background: '#f8f7f4', fontFamily: '"Noto Sans TC",-apple-system,sans-serif', paddingBottom: 88, overflow: 'hidden' }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.06)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, #0d9488, #065f46)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🐉</div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.1, fontFamily: '"Noto Serif TC", serif', letterSpacing: 1 }}>河道慶典街</h1>
            <p style={{ fontSize: 9, fontWeight: 700, color: '#0d9488', letterSpacing: 2, textTransform: 'uppercase', marginTop: 2 }}>{userData.username} {userData.isDemo ? '(試玩)' : ''}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #fef3c7, #fde68a)', padding: '8px 16px', borderRadius: 20, border: '1px solid rgba(245,158,11,0.2)' }}>
            <span style={{ fontSize: 14 }}>🪙</span>
            <span style={{ fontWeight: 900, color: '#92400e', fontSize: 14, fontFamily: 'monospace' }}>{userData.coins}</span>
          </div>
          <button onClick={handleLogout} style={{ width: 36, height: 36, borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }} title="登出">↗</button>
        </div>
      </header>

      {/* Toast */}
      {message && (
        <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: message.type === 'success' ? '#065f46' : message.type === 'warn' ? '#92400e' : '#1e293b', color: '#fff', padding: '12px 24px', borderRadius: 16, fontSize: 12, fontWeight: 700, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', animation: 'fadeSlideDown 0.3s ease-out', display: 'flex', alignItems: 'center', gap: 8, maxWidth: '90vw' }}>
          <span>{message.type === 'success' ? '✓' : message.type === 'warn' ? '⚠' : 'ℹ'}</span> {message.text}
        </div>
      )}

      {/* 旗幟放大檢視 */}
      {zoomFlagUrl && (
        <div onClick={() => setZoomFlagUrl(null)} style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{ position: 'relative', animation: 'zoomIn 0.3s cubic-bezier(0.16,1,0.3,1)' }} onClick={e => e.stopPropagation()}>
            <img src={zoomFlagUrl} alt="隊伍旗幟"
              style={{
                maxWidth: '85vw', maxHeight: '75vh', borderRadius: 16,
                boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
                border: '4px solid rgba(255,255,255,0.2)',
                objectFit: 'contain', background: '#fff'
              }}
            />
            <button onClick={() => setZoomFlagUrl(null)} style={{
              position: 'absolute', top: -12, right: -12,
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(0,0,0,0.7)', color: '#fff', border: '2px solid rgba(255,255,255,0.3)',
              fontSize: 14, fontWeight: 900, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>✕</button>
          </div>
        </div>
      )}

      <main style={{ height: 'calc(100vh - 152px)', position: 'relative' }}>
        {/* HOME */}
        {view === 'home' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: 'radial-gradient(#0d9488 1px, transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none', zIndex: 0 }} />

            {/* 上排攤位 - 緊湊膠囊列 */}
            <BoothPillRow booths={booths.filter(b => b.side === 'top')} stamps={userData.stamps} onOpen={openBooth} side="top" />

            {/* ★ 河道賽況 - 絕對主角，佔滿剩餘空間 */}
            <div style={{ flex: 1, minHeight: 320, zIndex: 5, position: 'relative', display: 'flex', flexDirection: 'column', overflowY: 'auto',  }}>
              <WaveDivider color="#0d9488" />
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <RiverRaceTracker teams={raceTeams} onFlagClick={setZoomFlagUrl} />
              </div>
              <WaveDivider flip color="#0d9488" />
            </div>

            {/* 下排攤位 - 緊湊膠囊列 */}
            <BoothPillRow booths={booths.filter(b => b.side === 'bottom')} stamps={userData.stamps} onOpen={openBooth} side="bottom" />
          </div>
        )}

        {/* BOOTH DETAIL */}
        {view === 'booth' && selectedBooth && (
          <div style={{ height: '100%', overflowY: 'auto', background: '#fff', animation: 'slideUp 0.45s cubic-bezier(0.16,1,0.3,1)' }}>
            <div style={{ position: 'relative', height: 200, background: 'linear-gradient(135deg, #065f46, #134e3a)', display: 'flex', alignItems: 'flex-end', padding: 28, overflow: 'hidden' }}>
              {selectedBooth.facadeImageUrl && <img src={selectedBooth.facadeImageUrl} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }} />}
              <div style={{ position: 'absolute', top: 0, right: 0, width: 200, height: 200, background: 'radial-gradient(circle, rgba(251,191,36,0.15) 0%, transparent 70%)' }} />
              <div style={{ fontSize: 64, position: 'absolute', top: 20, right: 28, opacity: 0.2 }}>{selectedBooth.emoji}</div>
              <button onClick={closeBooth} style={{ position: 'absolute', top: 20, left: 20, width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
              <div style={{ position: 'relative', zIndex: 2 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>攤位</p>
                <h2 style={{ fontSize: 28, fontWeight: 900, color: '#fff', fontFamily: '"Noto Serif TC", serif' }}>{selectedBooth.name}</h2>
              </div>
            </div>

            <div style={{ maxWidth: 600, margin: '0 auto', padding: '28px 24px' }}>
              <p style={{ fontSize: 14, lineHeight: 1.8, color: '#64748b', marginBottom: 24 }}>{selectedBooth.description}</p>

              <a href={selectedBooth.plurkUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '16px 0', background: 'linear-gradient(135deg, #0d9488, #065f46)', color: '#fff', borderRadius: 18, fontWeight: 800, fontSize: 14, textDecoration: 'none', boxShadow: '0 4px 16px rgba(13,148,136,0.25)', letterSpacing: 1 }}>
                前往噗浪互動 ↗
              </a>

              <div style={{ margin: '24px 0', padding: 20, background: '#f0fdf4', borderRadius: 18, border: '1px solid rgba(13,148,136,0.1)' }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: '#0d9488', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>任務說明</p>
                <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.7 }}>{selectedBooth.task}</p>
              </div>

              {/* 商品列表 */}
              <p style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, marginTop: 28 }}>商品列表</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {selectedBooth.items.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, background: '#fafaf9', borderRadius: 20, border: '1px solid rgba(0,0,0,0.04)' }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0, overflow: 'hidden', background: 'linear-gradient(135deg, #e0f2fe, #f0fdf4)' }}>
                      {item.imageUrl ? <img src={item.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; e.target.parentElement.textContent = selectedBooth.emoji; }} /> : selectedBooth.emoji}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>{item.name}</h4>
                      <p style={{ fontSize: 11, color: '#94a3b8' }}>{item.description}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontWeight: 900, color: '#0d9488', fontSize: 16, fontFamily: 'monospace' }}>${item.price}</p>
                      <button onClick={() => buyItem(selectedBooth, item)} style={{ marginTop: 4, padding: '6px 16px', background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>購買</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* 印章區 */}
              <div style={{ marginTop: 28, padding: 24, background: '#fafaf9', borderRadius: 24, border: '1px solid rgba(0,0,0,0.04)', textAlign: 'center' }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>本攤印章</p>
                <div style={{ display: 'inline-block', transition: 'all 0.6s cubic-bezier(0.16,1,0.3,1)', transform: userData.stamps.includes(selectedBooth.id) ? 'rotate(8deg) scale(1)' : 'rotate(0deg) scale(0.9)', opacity: userData.stamps.includes(selectedBooth.id) ? 1 : 0.35, filter: userData.stamps.includes(selectedBooth.id) ? 'none' : 'grayscale(1)', marginBottom: 16 }}>
                  <StampDesign stamp={selectedBooth.stamp} size={100} stamped={true} boothEmoji={selectedBooth.emoji} />
                </div>
                <button disabled={userData.stamps.includes(selectedBooth.id)} onClick={() => collectStamp(selectedBooth.id)}
                  style={{ width: '100%', padding: '16px 0', borderRadius: 18, fontSize: 15, fontWeight: 900, border: 'none', cursor: userData.stamps.includes(selectedBooth.id) ? 'default' : 'pointer', background: userData.stamps.includes(selectedBooth.id) ? '#e2e8f0' : 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: userData.stamps.includes(selectedBooth.id) ? '#94a3b8' : '#451a03', boxShadow: userData.stamps.includes(selectedBooth.id) ? 'none' : '0 4px 20px rgba(245,158,11,0.3)', letterSpacing: 1 }}>
                  {userData.stamps.includes(selectedBooth.id) ? '✓ 已集章' : '🏆 領取印章與金幣'}
                </button>
              </div>

              {/* 集章名單 */}
              <CollectorsList collectors={collectors} currentUser={userData.username} isStamped={userData.stamps.includes(selectedBooth.id)} />
            </div>
          </div>
        )}

        {/* INVENTORY */}
        {view === 'inventory' && (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, animation: 'fadeSlideUp 0.5s ease-out' }}>
            <div style={{ width: '100%', maxWidth: 420, height: '85%', background: 'linear-gradient(180deg, #fffbeb, #fef3c7)', borderRadius: '16px 16px 40px 40px', border: '2px solid rgba(245,158,11,0.15)', boxShadow: '0 24px 64px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)', width: 100, height: 48, border: '4px solid rgba(217,119,6,0.2)', borderBottom: 'none', borderRadius: '28px 28px 0 0' }} />
              <div style={{ position: 'absolute', top: 16, right: -8, background: '#dc2626', color: '#fff', padding: '6px 20px 6px 12px', borderRadius: '8px 0 0 8px', fontSize: 9, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase' }}>端午慶典</div>
              <div style={{ padding: '32px 28px 16px', textAlign: 'center' }}>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: 'rgba(120,53,15,0.2)', letterSpacing: 4, textTransform: 'uppercase', fontFamily: '"Noto Serif TC", serif' }}>購物袋</h2>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(180,120,50,0.4)', marginTop: 4 }}>已收集 {userData.inventory.length} 個戰利品</p>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 24px' }}>
                {userData.inventory.length === 0 ? (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(180,120,50,0.3)', fontWeight: 700, fontSize: 14 }}>
                    <span style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>🛍️</span>購物袋還是空的...
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
                    {userData.inventory.map((item, idx) => (
                      <div key={idx} style={{ width: 88, background: '#fff', padding: 8, borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid rgba(245,158,11,0.1)', transform: `rotate(${item.stackRotation || 0}deg)`, cursor: 'default', animation: `dropIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275) ${idx * 0.06}s both` }}>
                        <div style={{ width: '100%', aspectRatio: '1', background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 6, overflow: 'hidden' }}>
                          {item.imageUrl ? <img src={item.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} /> : (booths.find(b => b.name === item.boothName)?.emoji || '🎁')}
                        </div>
                        <p style={{ fontSize: 9, fontWeight: 800, textAlign: 'center', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                        <p style={{ fontSize: 7, color: '#94a3b8', fontWeight: 600, textAlign: 'center', marginTop: 2 }}>{item.boothName}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ padding: '12px 24px', textAlign: 'center', borderTop: '1px solid rgba(245,158,11,0.1)' }}>
                <p style={{ fontSize: 8, fontWeight: 800, color: 'rgba(180,120,50,0.25)', letterSpacing: 2, textTransform: 'uppercase' }}>Thank you for visiting</p>
              </div>
            </div>
          </div>
        )}

        {/* STAMPS + LEADERBOARD */}
        {view === 'stamps' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '24px 20px 40px', animation: 'fadeSlideUp 0.5s ease-out' }}>
            <h2 style={{ fontSize: 28, fontWeight: 900, fontFamily: '"Noto Serif TC", serif', marginBottom: 20, letterSpacing: 2 }}>集章紀念冊</h2>
            <div style={{ background: '#fff', padding: 28, borderRadius: 28, boxShadow: '0 8px 32px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.04)', marginBottom: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, marginBottom: 28 }}>
                {booths.map((booth, i) => {
                  const stamped = userData.stamps.includes(booth.id);
                  return (
                    <div key={booth.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, animation: `fadeSlideUp 0.5s ease-out ${i * 0.1}s both` }}>
                      <div style={{ transition: 'all 0.5s cubic-bezier(0.16,1,0.3,1)', transform: stamped ? 'rotate(6deg) scale(1.05)' : 'none', filter: stamped ? 'none' : 'grayscale(0.5)' }}>
                        <StampDesign stamp={booth.stamp} size={88} stamped={stamped} boothEmoji={booth.emoji} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 800, color: stamped ? '#334155' : '#cbd5e1', letterSpacing: 1 }}>{booth.name}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: 1 }}>我的進度</span>
                  <span style={{ fontSize: 12, fontWeight: 900, color: '#0f172a' }}>{userData.stamps.length} / {booths.length}</span>
                </div>
                <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 4, transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)', width: `${(userData.stamps.length / booths.length) * 100}%`, background: userData.stamps.length === booths.length ? 'linear-gradient(90deg, #fbbf24, #f59e0b)' : 'linear-gradient(90deg, #0d9488, #14b8a6)' }} />
                </div>
              </div>
              {userData.stamps.length === booths.length && (
                <div style={{ textAlign: 'center', marginTop: 16, padding: '12px 20px', background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: 16, border: '1px solid rgba(245,158,11,0.2)' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#92400e' }}>🎉 恭喜完成所有集章！</span>
                </div>
              )}
            </div>
            <Leaderboard booths={booths} leaderboard={leaderboard} currentUser={userData.username} currentUserStamps={userData.stamps} onRefresh={loadLeaderboard} />
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(0,0,0,0.06)', padding: '8px 32px 20px', display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 50 }}>
        {[
          { id: 'home', icon: '🗺️', label: '街道' },
          { id: 'inventory', icon: '🛍️', label: '購物袋' },
          { id: 'stamps', icon: '🏅', label: '集章' }
        ].map(item => {
          const active = view === item.id || (view === 'booth' && item.id === 'home');
          return (
            <button key={item.id} onClick={() => { if (item.id === 'stamps') loadLeaderboard(); if (view === 'booth' && item.id === 'home') closeBooth(); else setView(item.id); }}
              onMouseEnter={() => setHoveredNav(item.id)} onMouseLeave={() => setHoveredNav(null)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: active ? '#0d9488' : '#cbd5e1', transition: 'all 0.3s', transform: active ? 'scale(1.1)' : hoveredNav === item.id ? 'scale(1.05)' : 'scale(1)' }}>
              <span style={{ fontSize: 24, filter: active ? 'none' : 'grayscale(1) opacity(0.4)' }}>{item.icon}</span>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', opacity: active ? 1 : 0.4 }}>{item.label}</span>
              {active && <div style={{ width: 4, height: 4, borderRadius: 2, background: '#0d9488', marginTop: 2 }} />}
            </button>
          );
        })}
      </nav>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700;900&family=Noto+Sans+TC:wght@400;500;700;900&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Noto Sans TC',-apple-system,sans-serif; -webkit-tap-highlight-color:transparent; }
        ::-webkit-scrollbar { display:none; }
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeSlideDown { from{opacity:0;transform:translate(-50%,-12px)} to{opacity:1;transform:translate(-50%,0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes zoomIn { from{opacity:0;transform:scale(0.8)} to{opacity:1;transform:scale(1)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
        @keyframes riverScroll { from{transform:translateX(90vw)} to{transform:translateX(-100%)} }
        @keyframes dropIn { 0%{opacity:0;transform:translateY(-30px) rotate(-15deg)} 60%{transform:translateY(5px) rotate(3deg)} 100%{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}

// ============================================================
// 河道龍舟賽況 (響應式，手機優先)
// ============================================================
function calcRacePos(team) {
  if (!team.turnSuccess && team.outboundScore < 200) {
    const pct = (team.outboundScore / 200) * 100;
    return { pct, dir: 'out', label: `衝刺 ${team.outboundScore}` };
  } else if (!team.turnSuccess && team.outboundScore >= 200) {
    return { pct: 100, dir: 'turn', label: '🚩 奪旗中' };
  } else if (team.inboundScore >= 200) {
    return { pct: 0, dir: 'finish', label: '🏆 完賽' };
  } else {
    const pct = 100 - ((team.inboundScore / 200) * 100);
    return { pct, dir: 'in', label: `回程 ${team.inboundScore}` };
  }
}

function RiverRaceTracker({ teams, onFlagClick }) {
  const [cheered, setCheered] = useState({});
  const [particles, setParticles] = useState([]);
  const containerRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const sorted = [...teams].sort((a, b) => {
    const sa = a.outboundScore + (a.turnSuccess ? 200 + a.inboundScore : 0);
    const sb = b.outboundScore + (b.turnSuccess ? 200 + b.inboundScore : 0);
    return sb - sa;
  });

  const doCheer = (teamId) => {
    setCheered(prev => ({ ...prev, [teamId]: true }));
    setTimeout(() => setCheered(prev => ({ ...prev, [teamId]: false })), 600);
    const icons = ['🔥', '💖', '💪', '🐲', '✨'];
    const newP = Array.from({ length: 4 }, (_, i) => ({
      id: Date.now() + i, icon: icons[Math.floor(Math.random() * icons.length)],
      x: Math.random() * 80 + 10, y: Math.random() * 40
    }));
    setParticles(prev => [...prev, ...newP]);
    setTimeout(() => setParticles(prev => prev.filter(p => !newP.find(n => n.id === p.id))), 1200);
    // 寫入後端
    apiPost({ action: 'cheer', teamId: String(teamId) }).catch(() => {});
  };

  if (!teams.length) {
    return (
      <div style={{ height: 140, background: 'linear-gradient(180deg, rgba(13,148,136,0.08), rgba(14,116,144,0.12))', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', display: 'flex', gap: 300, animation: 'riverScroll 20s linear infinite', fontSize: 40, opacity: 0.6 }}>🛶🐉🛶🐉</div>
        <span style={{ fontSize: 36, fontWeight: 900, letterSpacing: '0.3em', color: 'rgba(13,148,136,0.08)', fontFamily: '"Noto Serif TC", serif', zIndex: 1 }}>DRAGON BOAT</span>
      </div>
    );
  }

  const LANE_COLORS = ['#dc2626', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#c026d3', '#65a30d'];

  return (
    <div ref={containerRef} style={{
      background: 'linear-gradient(180deg, rgba(8,145,178,0.05) 0%, rgba(13,148,136,0.1) 50%, rgba(8,145,178,0.05) 100%)',
      position: 'relative', overflow: 'hidden',
      padding: isMobile ? '8px 0' : '12px 0',
      height: '100%', display: 'flex', flexDirection: 'column'
    }}>
      {/* Water pattern */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.025,
        backgroundImage: 'repeating-linear-gradient(90deg, #0d9488 0px, transparent 1px, transparent 24px)',
        pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '0 12px 6px' : '0 20px 10px', position: 'relative', zIndex: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: isMobile ? 14 : 16 }}>🐉</span>
          <span style={{ fontSize: isMobile ? 10 : 12, fontWeight: 800, color: '#0d9488', letterSpacing: 2 }}>龍舟爭霸 LIVE</span>
          <div style={{ width: 6, height: 6, borderRadius: 3, background: '#22c55e', boxShadow: '0 0 6px #22c55e', animation: 'pulse 2s infinite' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, fontSize: 8, fontWeight: 700, color: '#94a3b8' }}>
          <span>🔴 200折返</span>
          <span>🏁 400完賽</span>
        </div>
      </div>

      {/* === Race lanes === */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: isMobile ? 6 : 6, padding: isMobile ? '0 8px' : '0 16px', justifyContent: sorted.length <= 4 ? 'center' : 'flex-start' }}>
        {sorted.map((team, idx) => {
          const pos = calcRacePos(team);
          const isReturning = pos.dir === 'in' || pos.dir === 'finish';
          const color = team.color || LANE_COLORS[idx % LANE_COLORS.length];
          const total = team.outboundScore + (team.turnSuccess ? team.inboundScore : 0);
          const pct = Math.round((total / 400) * 100);

          // ---- 手機版：雙行卡片式 ----
          if (isMobile) {
            return (
              <div key={team.id} style={{
                background: 'rgba(255,255,255,0.65)', borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.9)', overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
              }}>
                {/* 上行：排名 + 旗幟 + 隊名 + 分數 + 集氣 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px 2px' }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                    background: idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : idx === 2 ? '#d97706' : '#e2e8f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 900, color: idx < 3 ? '#fff' : '#94a3b8'
                  }}>{idx + 1}</div>
                  {/* 旗幟 */}
                  {team.flagImageUrl ? (
                    <div onClick={(e) => { e.stopPropagation(); onFlagClick?.(team.flagImageUrl); }}
                      style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, overflow: 'hidden', cursor: 'pointer', border: '1.5px solid rgba(0,0,0,0.08)', background: '#fff' }}>
                      <img src={team.flagImageUrl} alt="旗" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <span style={{ fontSize: 14, flexShrink: 0 }}>🚩</span>
                  )}
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#1e293b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {team.name}
                  </span>
                  {/* 數字狀態 pill */}
                  <div style={{
                    padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 800, flexShrink: 0,
                    background: pos.dir === 'finish' ? '#fef3c7' : pos.dir === 'turn' ? '#fef2f2' : `${color}10`,
                    color: pos.dir === 'finish' ? '#92400e' : pos.dir === 'turn' ? '#dc2626' : color,
                    border: `1px solid ${pos.dir === 'finish' ? '#fde68a' : pos.dir === 'turn' ? '#fecaca' : color + '25'}`,
                    fontFamily: 'monospace'
                  }}>
                    {total}/400
                  </div>
                  <button onClick={() => doCheer(team.id)} style={{
                    padding: '3px 8px', borderRadius: 8, border: '1px solid #fecdd3', flexShrink: 0,
                    background: cheered[team.id] ? '#ffe4e6' : '#fff5f5', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 3,
                    transition: 'all 0.2s', transform: cheered[team.id] ? 'scale(1.1)' : 'scale(1)'
                  }}>
                    <span style={{ fontSize: 10 }}>💖</span>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#e11d48' }}>{team.cheers}</span>
                  </button>
                </div>
                {/* 下行：賽道進度條 */}
                <div style={{ padding: '2px 8px 6px', position: 'relative' }}>
                  <div style={{ height: 18, background: 'rgba(241,245,249,0.8)', borderRadius: 6, position: 'relative', overflow: 'hidden' }}>
                    {/* Fill */}
                    <div style={{
                      position: 'absolute', top: 0, bottom: 0, left: 0,
                      width: `${Math.min(100, pct)}%`,
                      background: `linear-gradient(90deg, ${color}20, ${color}35)`,
                      borderRadius: 6, transition: 'width 1s ease-in-out'
                    }} />
                    {/* Boat */}
                    <div style={{
                      position: 'absolute', top: '50%',
                      transform: `translateY(-50%) ${isReturning ? 'scaleX(-1)' : ''}`,
                      left: `calc(${pos.pct}% - 8px)`, transition: 'left 1.2s cubic-bezier(0.16,1,0.3,1)',
                      fontSize: 14, lineHeight: 1, zIndex: 2, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.15))'
                    }}>🛶</div>
                    {/* Status tag */}
                    <div style={{
                      position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                      right: 4, fontSize: 8, fontWeight: 800, padding: '1px 5px', borderRadius: 4,
                      background: pos.dir === 'turn' ? '#ef4444' : pos.dir === 'finish' ? '#fbbf24' : `${color}cc`,
                      color: '#fff', whiteSpace: 'nowrap',
                      animation: pos.dir === 'turn' ? 'pulse 1s infinite' : 'none'
                    }}>{pos.label}</div>
                    {/* Dice on track (only last 3 on mobile) */}
                    {team.lastRolls?.length > 0 && (
                      <div style={{ position: 'absolute', bottom: 1, left: 4, display: 'flex', gap: 1, zIndex: 3 }}>
                        {team.lastRolls.slice(-3).map((n, i) => (
                          <div key={i} style={{
                            width: 12, height: 12, borderRadius: 2, fontSize: 7, fontWeight: 800,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: n >= 18 ? '#fef3c7' : n <= 3 ? '#fef2f2' : '#f8fafc',
                            border: `1px solid ${n >= 18 ? '#fbbf24' : n <= 3 ? '#f87171' : '#e2e8f0'}`,
                            color: n >= 18 ? '#92400e' : n <= 3 ? '#991b1b' : '#64748b'
                          }}>{n}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          // ---- 桌面版：單行賽道 ----
          return (
            <div key={team.id} style={{ display: 'flex', alignItems: 'center', gap: 10, height: 48, position: 'relative', flexShrink: 0 }}>
              {/* Rank */}
              <div style={{
                width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                background: idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : idx === 2 ? '#d97706' : '#e2e8f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 900, color: idx < 3 ? '#fff' : '#94a3b8'
              }}>{idx + 1}</div>

              {/* Flag */}
              {team.flagImageUrl ? (
                <div onClick={() => onFlagClick?.(team.flagImageUrl)}
                  style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, overflow: 'hidden', cursor: 'pointer', border: '2px solid rgba(0,0,0,0.08)', background: '#fff', transition: 'transform 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                  <img src={team.flagImageUrl} alt="旗" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ) : (
                <span style={{ fontSize: 18, flexShrink: 0, width: 30, textAlign: 'center' }}>🚩</span>
              )}

              {/* Team name + score */}
              <div style={{ width: 110, flexShrink: 0, overflow: 'hidden' }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>{team.name}</p>
                <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, fontFamily: 'monospace' }}>{total}/400 ({pct}%)</p>
              </div>

              {/* Track */}
              <div style={{ flex: 1, height: 38, background: 'rgba(255,255,255,0.55)', borderRadius: 10, position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.8)' }}>
                {/* Fill */}
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, left: 0,
                  width: `${Math.min(100, pct)}%`,
                  background: `linear-gradient(90deg, ${color}15, ${color}30)`,
                  borderRadius: 8, transition: 'width 1s ease-in-out'
                }} />
                {/* Turn marker */}
                <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 2, background: '#ef444430' }}>
                  <div style={{ position: 'absolute', top: -1, right: 4, fontSize: 7, color: '#ef4444', fontWeight: 800 }}>折返</div>
                </div>
                {/* Boat */}
                <div style={{
                  position: 'absolute', top: '50%',
                  transform: `translateY(-50%) ${isReturning ? 'scaleX(-1)' : ''}`,
                  left: `calc(${pos.pct}% - 14px)`, transition: 'left 1.2s cubic-bezier(0.16,1,0.3,1)',
                  fontSize: 26, lineHeight: 1, zIndex: 2, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))'
                }}>🛶</div>
                {/* Status label */}
                <div style={{
                  position: 'absolute', top: 2,
                  left: `calc(${Math.min(pos.pct, 70)}% + 18px)`,
                  fontSize: 9, fontWeight: 800, padding: '1px 7px', borderRadius: 4,
                  background: pos.dir === 'turn' ? '#ef4444' : pos.dir === 'finish' ? '#fbbf24' : `${color}cc`,
                  color: '#fff', whiteSpace: 'nowrap', transition: 'left 1.2s ease-in-out',
                  animation: pos.dir === 'turn' ? 'pulse 1s infinite' : 'none'
                }}>{pos.label}</div>
                {/* Dice */}
                {team.lastRolls?.length > 0 && (
                  <div style={{ position: 'absolute', bottom: 2, right: 6, display: 'flex', gap: 2, zIndex: 3 }}>
                    {team.lastRolls.slice(-5).map((n, i) => (
                      <div key={i} style={{
                        width: 17, height: 17, borderRadius: 3, fontSize: 9, fontWeight: 800,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: n >= 18 ? '#fef3c7' : n <= 3 ? '#fef2f2' : '#f8fafc',
                        border: `1px solid ${n >= 18 ? '#fbbf24' : n <= 3 ? '#f87171' : '#e2e8f0'}`,
                        color: n >= 18 ? '#92400e' : n <= 3 ? '#991b1b' : '#64748b'
                      }}>{n}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cheer */}
              <button onClick={() => doCheer(team.id)} style={{
                height: 36, borderRadius: 10, border: '1px solid #fecdd3', flexShrink: 0, padding: '0 10px',
                background: cheered[team.id] ? '#ffe4e6' : '#fff5f5', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                transition: 'all 0.2s', transform: cheered[team.id] ? 'scale(1.12)' : 'scale(1)'
              }}>
                <span style={{ fontSize: 14 }}>💖</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#e11d48' }}>{team.cheers}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Floating particles */}
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute', top: `${p.y}%`, left: `${p.x}%`, fontSize: 14,
          pointerEvents: 'none', animation: 'cheerFloat 1s ease-out forwards'
        }}>{p.icon}</div>
      ))}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes cheerFloat { 0%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-50px) scale(1.4)} }
      `}</style>
    </div>
  );
}

// ============================================================
// 攤位膠囊列 (超緊湊，讓河道佔更多空間)
// ============================================================
function BoothPillRow({ booths, stamps, onOpen, side }) {
  // 每次元件掛載時隨機打亂攤位順序
  const shuffledRef = useRef(null);
  if (!shuffledRef.current || shuffledRef.current.length !== booths.length) {
    const arr = [...booths];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    shuffledRef.current = arr;
  }
  const shuffled = shuffledRef.current;

  if (!shuffled.length) return null;
  return (
    <div style={{
      flexShrink: 0, zIndex: 10, position: 'relative',
      padding: side === 'top' ? '8px 12px 4px' : '4px 12px 8px',
    }}>
      <div style={{
        display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2,
        WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none',
        justifyContent: 'center',
      }}>
        {shuffled.map((booth, i) => {
          const stamped = stamps.includes(booth.id);
          return (
            <MiniSquareCard key={booth.id} booth={booth} stamped={stamped} onClick={() => onOpen(booth)} delay={i * 70} />
          );
        })}
      </div>
    </div>
  );
}

function MiniSquareCard({ booth, stamped, onClick, delay = 0 }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flexShrink: 0, width: 200, cursor: 'pointer', position: 'relative',
        animation: `fadeSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) ${delay}ms both`,
      }}
    >
      <div style={{
        width: 200, height: 200, borderRadius: 20, overflow: 'hidden', position: 'relative',
        background: '#fff',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.05)',
        border: stamped ? '2.5px solid rgba(16,185,129,0.35)' : '2.5px solid #fff',
        transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
        transform: hovered ? 'translateY(-4px) scale(1.05)' : 'translateY(0) scale(1)',
      }}>
        {booth.facadeImageUrl ? (
          <img src={booth.facadeImageUrl} alt={booth.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.35s', transform: hovered ? 'scale(1.1)' : 'scale(1)' }}
            onError={e => { e.target.style.display = 'none'; }} />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(135deg, #ecfdf5, #f0fdf4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, transition: 'transform 0.35s', transform: hovered ? 'scale(1.1)' : 'scale(1)',
          }}>{booth.emoji}</div>
        )}
        {stamped && (
          <div style={{
            position: 'absolute', top: 6, right: 6, background: '#10b981', color: '#fff',
            width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 900, border: '2px solid #fff', boxShadow: '0 1px 4px rgba(16,185,129,0.3)',
          }}>✓</div>
        )}
        {/* 底部名牌 */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.55))',
          padding: '16px 6px 5px', textAlign: 'center',
        }}>
          <span style={{
            fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: 0.5,
            textShadow: '0 1px 3px rgba(0,0,0,0.4)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block',
          }}>{booth.name}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 攤位卡片 (大版，其他頁面可用)
// ============================================================
function BoothCard({ booth, isStamped, onClick, delay = 0 }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ flexShrink: 0, width: 160, cursor: 'pointer', position: 'relative', animation: `fadeSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) ${delay}ms both` }}>
      <div style={{ width: '100%', aspectRatio: '1', borderRadius: 28, overflow: 'hidden', position: 'relative', background: '#fff', boxShadow: hovered ? '0 16px 40px rgba(0,0,0,0.12)' : '0 4px 16px rgba(0,0,0,0.06)', border: '3px solid #fff', transition: 'all 0.4s cubic-bezier(0.16,1,0.3,1)', transform: hovered ? 'translateY(-8px) scale(1.03)' : 'translateY(0) scale(1)' }}>
        {booth.facadeImageUrl ? (
          <img src={booth.facadeImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s', transform: hovered ? 'scale(1.15)' : 'scale(1)' }} onError={e => { e.target.style.display = 'none'; }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #ecfdf5, #f0fdf4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56, transition: 'transform 0.4s', transform: hovered ? 'scale(1.15)' : 'scale(1)' }}>{booth.emoji}</div>
        )}
        {isStamped && (<div style={{ position: 'absolute', top: 10, right: 10, background: '#dc2626', color: '#fff', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, border: '2px solid #fff', boxShadow: '0 2px 8px rgba(220,38,38,0.3)' }}>✓</div>)}
      </div>
      <div style={{ position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)', background: '#0f172a', color: '#fff', padding: '6px 16px', borderRadius: 12, whiteSpace: 'nowrap', fontWeight: 800, fontSize: 11, letterSpacing: 1, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10 }}>{booth.name}</div>
    </div>
  );
}

// ============================================================
// 集章名單 (從 API 載入)
// ============================================================
function CollectorsList({ collectors, currentUser, isStamped }) {
  const [expanded, setExpanded] = useState(false);
  const allCollectors = [...collectors];
  if (isStamped && !allCollectors.find(c => c.username === currentUser)) {
    allCollectors.unshift({ username: currentUser, timestamp: '剛剛', isMe: true });
  }
  const list = allCollectors.map(c => ({ ...c, isMe: c.username === currentUser }));
  const shown = expanded ? list : list.slice(0, 3);
  const remaining = list.length - 3;
  if (list.length === 0) return null;

  return (
    <div style={{ marginTop: 24, animation: 'fadeSlideUp 0.4s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase' }}>集章名單</p>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#0d9488', background: 'rgba(13,148,136,0.08)', padding: '3px 10px', borderRadius: 10 }}>{list.length} 人</span>
        </div>
      </div>
      <div style={{ background: '#fafaf9', borderRadius: 20, border: '1px solid rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        {shown.map((c, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: idx < shown.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none', background: c.isMe ? 'rgba(251,191,36,0.06)' : 'transparent' }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, flexShrink: 0, background: c.isMe ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' : getAvatarColor(c.username), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', border: c.isMe ? '2px solid rgba(251,191,36,0.3)' : 'none' }}>{c.username.charAt(0)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.username}</span>
                {c.isMe && <span style={{ fontSize: 8, fontWeight: 800, color: '#92400e', background: '#fef3c7', padding: '2px 8px', borderRadius: 6, letterSpacing: 1, flexShrink: 0 }}>YOU</span>}
              </div>
              <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginTop: 1 }}>🕐 {c.timestamp}</p>
            </div>
            <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: 'rgba(220,38,38,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🔖</div>
          </div>
        ))}
        {list.length > 3 && (
          <button onClick={() => setExpanded(!expanded)} style={{ width: '100%', padding: '12px 16px', border: 'none', borderTop: '1px solid rgba(0,0,0,0.04)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#0d9488' }}>
            {expanded ? '收合名單 ↑' : `查看其餘 ${remaining} 位 ↓`}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 排行榜 (從 API 載入)
// ============================================================
function Leaderboard({ booths, leaderboard, currentUser, currentUserStamps, onRefresh }) {
  const [hoveredRow, setHoveredRow] = useState(null);

  useEffect(() => { onRefresh(); }, []);

  let players = [...leaderboard];
  const existingIdx = players.findIndex(p => p.username === currentUser);
  if (existingIdx >= 0) {
    players[existingIdx] = { ...players[existingIdx], stamps: currentUserStamps, isMe: true };
  } else {
    players.push({ username: currentUser, stamps: currentUserStamps, isMe: true });
  }
  players.sort((a, b) => b.stamps.length - a.stamps.length || a.username.localeCompare(b.username));
  players = players.map(p => ({ ...p, isMe: p.username === currentUser }));

  return (
    <div style={{ animation: 'fadeSlideUp 0.6s ease-out 0.2s both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h3 style={{ fontSize: 20, fontWeight: 900, fontFamily: '"Noto Serif TC", serif', letterSpacing: 1 }}>🏆 排行榜</h3>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', background: '#f1f5f9', padding: '4px 10px', borderRadius: 8 }}>共 {players.length} 位</span>
        </div>
        <button onClick={onRefresh} style={{ fontSize: 10, fontWeight: 700, color: '#0d9488', background: 'rgba(13,148,136,0.08)', padding: '6px 14px', borderRadius: 10, border: 'none', cursor: 'pointer' }}>↻ 重整</button>
      </div>

      {/* Podium */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, justifyContent: 'center', alignItems: 'flex-end' }}>
        {[1, 0, 2].map(rankIdx => {
          const player = players[rankIdx];
          if (!player) return null;
          const rs = RANK_STYLES[rankIdx];
          const isCenter = rankIdx === 0;
          return (
            <div key={rankIdx} style={{ flex: isCenter ? '0 0 40%' : '0 0 28%', background: rs.bg, borderRadius: 24, padding: isCenter ? '20px 12px 16px' : '16px 10px 14px', border: `2px solid ${rs.border}30`, boxShadow: `0 4px 20px ${rs.glow}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transform: isCenter ? 'scale(1)' : 'scale(0.92)', animation: `fadeSlideUp 0.5s ease-out ${rankIdx * 0.1 + 0.3}s both` }}>
              <span style={{ fontSize: isCenter ? 28 : 22 }}>{rs.medal}</span>
              <div style={{ width: isCenter ? 52 : 40, height: isCenter ? 52 : 40, borderRadius: '50%', background: player.isMe ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' : getAvatarColor(player.username), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isCenter ? 20 : 16, fontWeight: 800, color: '#fff', border: `3px solid ${player.isMe ? '#fbbf24' : '#fff'}`, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>{player.username.charAt(0)}</div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: isCenter ? 12 : 10, fontWeight: 800, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: isCenter ? 120 : 80 }}>{player.username}</p>
                {player.isMe && <span style={{ fontSize: 7, fontWeight: 800, color: '#92400e', background: 'rgba(251,191,36,0.3)', padding: '1px 6px', borderRadius: 4, letterSpacing: 1, marginTop: 2, display: 'inline-block' }}>YOU</span>}
              </div>
              <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
                {booths.map((b, i) => (<div key={i} style={{ width: isCenter ? 10 : 8, height: isCenter ? 10 : 8, borderRadius: '50%', background: player.stamps.includes(b.id) ? '#0d9488' : 'rgba(0,0,0,0.08)', boxShadow: player.stamps.includes(b.id) ? `0 1px 4px #0d948840` : 'none' }} title={b.name} />))}
              </div>
              <p style={{ fontSize: 10, fontWeight: 900, color: '#334155', fontFamily: 'monospace' }}>{player.stamps.length}/{booths.length}</p>
            </div>
          );
        })}
      </div>

      {/* Full list */}
      <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#fafaf9' }}>
          <span style={{ width: 36, fontSize: 9, fontWeight: 800, color: '#94a3b8', letterSpacing: 1 }}>#</span>
          <span style={{ flex: 1, fontSize: 9, fontWeight: 800, color: '#94a3b8', letterSpacing: 1 }}>玩家</span>
          <span style={{ width: 80, fontSize: 9, fontWeight: 800, color: '#94a3b8', letterSpacing: 1, textAlign: 'center' }}>集章</span>
          <span style={{ width: 60, fontSize: 9, fontWeight: 800, color: '#94a3b8', letterSpacing: 1, textAlign: 'right' }}>進度</span>
        </div>
        {players.map((player, idx) => {
          const rank = idx + 1;
          const pct = Math.round((player.stamps.length / booths.length) * 100);
          return (
            <div key={idx} onMouseEnter={() => setHoveredRow(idx)} onMouseLeave={() => setHoveredRow(null)}
              style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: idx < players.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none', background: player.isMe ? 'rgba(251,191,36,0.06)' : hoveredRow === idx ? 'rgba(0,0,0,0.01)' : 'transparent', transition: 'all 0.2s', animation: `fadeSlideUp 0.3s ease-out ${idx * 0.04}s both` }}>
              <div style={{ width: 36, flexShrink: 0 }}>{rank <= 3 ? <span style={{ fontSize: 16 }}>{RANK_STYLES[rank - 1].medal}</span> : <span style={{ fontSize: 13, fontWeight: 900, color: '#cbd5e1', fontFamily: 'monospace' }}>{rank}</span>}</div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: player.isMe ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' : getAvatarColor(player.username), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', border: player.isMe ? '2px solid rgba(251,191,36,0.3)' : 'none' }}>{player.username.charAt(0)}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.username}</span>
                    {player.isMe && <span style={{ fontSize: 7, fontWeight: 800, color: '#92400e', background: '#fef3c7', padding: '2px 7px', borderRadius: 5, letterSpacing: 1, flexShrink: 0 }}>YOU</span>}
                  </div>
                </div>
              </div>
              <div style={{ width: 80, display: 'flex', justifyContent: 'center', gap: 4, flexShrink: 0 }}>
                {booths.map((b, i) => (<div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: player.stamps.includes(b.id) ? '#0d9488' : '#f1f5f9', border: player.stamps.includes(b.id) ? `1px solid #0d948830` : '1px solid rgba(0,0,0,0.04)', boxShadow: player.stamps.includes(b.id) ? `0 1px 4px #0d948830` : 'none' }} title={b.name} />))}
              </div>
              <div style={{ width: 60, textAlign: 'right', flexShrink: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 900, fontFamily: 'monospace', color: pct === 100 ? '#f59e0b' : pct >= 50 ? '#0d9488' : '#94a3b8' }}>{pct === 100 ? '✦ ' : ''}{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ textAlign: 'center', fontSize: 9, color: '#cbd5e1', fontWeight: 600, marginTop: 16, letterSpacing: 1 }}>點「重整」更新最新排名</p>
    </div>
  );
}
