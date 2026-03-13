// ============================================================
// 端午慶典 Google Sheets 後端 (Google Apps Script)
// ============================================================
// 部署方式：
// 1. 建立 Google Sheets，新增 4 個工作表（見下方 SHEET_NAMES）
// 2. 在 Google Sheets 選單 → 擴充功能 → Apps Script
// 3. 貼上此段程式碼 → 部署 → 新增部署 → 類型選「網頁應用程式」
// 4. 「誰可以存取」選「所有人」→ 部署 → 複製網址貼到前端 API_URL
// ============================================================

// --- 設定 ---
const SHEET_NAMES = {
  BOOTHS: '攤位資料',     // 攤位基本資料
  ITEMS: '商品資料',       // 各攤商品
  PLAYERS: '玩家資料',     // 玩家帳號與遊戲進度
  STAMP_LOG: '集章紀錄',   // 誰在哪個攤位集章
  RACE: '龍舟賽況',       // 龍舟爭霸戰即時資料
};

// --- 工具函式 ---

function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

/** 將工作表轉成物件陣列 (第一列為標題) */
function sheetToObjects(sheetName) {
  const sheet = getSheet(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).filter(row => row[0] !== '').map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

/** 在工作表中找到某欄等於某值的那一列 (回傳 row index, 1-based) */
function findRow(sheetName, colHeader, value) {
  const sheet = getSheet(sheetName);
  if (!sheet) return -1;
  const data = sheet.getDataRange().getValues();
  const colIdx = data[0].indexOf(colHeader);
  if (colIdx === -1) return -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colIdx]).trim() === String(value).trim()) return i + 1; // 1-based
  }
  return -1;
}

/** 回傳 JSON response */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// GET 請求處理
// ============================================================
function doGet(e) {
  const action = e.parameter.action;

  try {
    switch (action) {

      // --- 取得所有攤位 + 商品 ---
      case 'getBooths': {
        const booths = sheetToObjects(SHEET_NAMES.BOOTHS);
        const items = sheetToObjects(SHEET_NAMES.ITEMS);

        const result = booths.map(b => ({
          id: b.id,
          side: b.side,
          name: b.name,
          owner: b.owner,
          emoji: b.emoji,
          description: b.description,
          plurkUrl: b.plurkUrl,
          task: b.task,
          facadeImageUrl: b.facadeImageUrl || '',
          stamp: {
            imageUrl: b.stampImageUrl || '',  // 噗浪圖床的印章圖片
          },
          items: items
            .filter(it => it.boothId === b.id)
            .map(it => ({
              id: it.itemId,
              name: it.name,
              price: Number(it.price) || 0,
              description: it.description || '',
              imageUrl: it.imageUrl || '',  // 噗浪圖床的商品圖片
            }))
        }));

        return jsonResponse({ success: true, data: result });
      }

      // --- 玩家登入 ---
      case 'login': {
        const username = (e.parameter.username || '').trim();
        const pin = (e.parameter.pin || '').trim();
        if (!username || !pin) return jsonResponse({ success: false, error: '請輸入暱稱和密碼' });

        const rowIdx = findRow(SHEET_NAMES.PLAYERS, 'username', username);
        if (rowIdx === -1) return jsonResponse({ success: false, error: '找不到這個角色的紀錄' });

        const sheet = getSheet(SHEET_NAMES.PLAYERS);
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const row = sheet.getRange(rowIdx, 1, 1, sheet.getLastColumn()).getValues()[0];

        const player = {};
        headers.forEach((h, i) => { player[h] = row[i]; });

        if (String(player.pin).trim() !== pin) {
          return jsonResponse({ success: false, error: '密碼錯誤' });
        }

        // 解析 JSON 欄位
        player.inventory = safeParseJSON(player.inventory, []);
        player.stamps = safeParseJSON(player.stamps, []);
        player.coins = Number(player.coins) || 0;

        return jsonResponse({ success: true, data: player });
      }

      // --- 取得排行榜 ---
      case 'getLeaderboard': {
        const players = sheetToObjects(SHEET_NAMES.PLAYERS);
        const leaderboard = players.map(p => ({
          username: p.username,
          stamps: safeParseJSON(p.stamps, []),
          coins: Number(p.coins) || 0,
          createdAt: p.createdAt || '',
        }));
        // 依集章數排序
        leaderboard.sort((a, b) => b.stamps.length - a.stamps.length);
        return jsonResponse({ success: true, data: leaderboard });
      }

      // --- 取得某攤位的集章名單 ---
      case 'getCollectors': {
        const boothId = (e.parameter.boothId || '').trim();
        if (!boothId) return jsonResponse({ success: false, error: '缺少 boothId' });

        const logs = sheetToObjects(SHEET_NAMES.STAMP_LOG);
        const collectors = logs
          .filter(l => l.boothId === boothId)
          .map(l => ({ username: l.username, timestamp: l.timestamp }));

        return jsonResponse({ success: true, data: collectors });
      }

      // --- 取得龍舟賽況 ---
      case 'getRace': {
        const raceData = sheetToObjects(SHEET_NAMES.RACE);
        const result = raceData.map(r => ({
          id: r.id,
          name: r.name,
          color: r.color || '',
          flagImageUrl: r.flagImageUrl || '',
          outboundScore: Number(r.outboundScore) || 0,
          inboundScore: Number(r.inboundScore) || 0,
          turnSuccess: String(r.turnSuccess).toLowerCase() === 'true',
          cheers: Number(r.cheers) || 0,
          lastRolls: r.lastRolls ? String(r.lastRolls).split(',').map(n => parseInt(n)).filter(n => !isNaN(n)) : [],
        }));
        return jsonResponse({ success: true, data: result });
      }

      // --- 取得單一玩家資料 ---
      case 'getPlayer': {
        const username = (e.parameter.username || '').trim();
        if (!username) return jsonResponse({ success: false, error: '缺少 username' });

        const rowIdx = findRow(SHEET_NAMES.PLAYERS, 'username', username);
        if (rowIdx === -1) return jsonResponse({ success: false, error: '找不到玩家' });

        const sheet = getSheet(SHEET_NAMES.PLAYERS);
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const row = sheet.getRange(rowIdx, 1, 1, sheet.getLastColumn()).getValues()[0];
        const player = {};
        headers.forEach((h, i) => { player[h] = row[i]; });
        player.inventory = safeParseJSON(player.inventory, []);
        player.stamps = safeParseJSON(player.stamps, []);
        player.coins = Number(player.coins) || 0;

        return jsonResponse({ success: true, data: player });
      }

      default:
        return jsonResponse({ success: false, error: '未知的 action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ============================================================
// POST 請求處理
// ============================================================
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    switch (action) {

      // --- 註冊新玩家 ---
      case 'register': {
        const username = (body.username || '').trim();
        const pin = (body.pin || '').trim();
        if (!username || pin.length < 4) {
          return jsonResponse({ success: false, error: '暱稱或密碼格式不正確' });
        }

        // 檢查是否已存在
        if (findRow(SHEET_NAMES.PLAYERS, 'username', username) !== -1) {
          return jsonResponse({ success: false, error: '此名稱已有人使用' });
        }

        const sheet = getSheet(SHEET_NAMES.PLAYERS);
        const now = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
        sheet.appendRow([username, pin, 500, '[]', '[]', now]);

        return jsonResponse({
          success: true,
          data: { username, pin, coins: 500, inventory: [], stamps: [], createdAt: now }
        });
      }

      // --- 購買商品 ---
      case 'buyItem': {
        const { username, itemId, itemName, itemPrice, boothName, itemDesc, itemImageUrl } = body;
        if (!username || !itemId) return jsonResponse({ success: false, error: '缺少參數' });

        const sheet = getSheet(SHEET_NAMES.PLAYERS);
        const rowIdx = findRow(SHEET_NAMES.PLAYERS, 'username', username);
        if (rowIdx === -1) return jsonResponse({ success: false, error: '找不到玩家' });

        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const row = sheet.getRange(rowIdx, 1, 1, sheet.getLastColumn()).getValues()[0];
        const coinsCol = headers.indexOf('coins') + 1;
        const inventoryCol = headers.indexOf('inventory') + 1;

        let coins = Number(row[coinsCol - 1]) || 0;
        let inventory = safeParseJSON(row[inventoryCol - 1], []);
        const price = Number(itemPrice) || 0;

        if (coins < price) return jsonResponse({ success: false, error: '金幣不足' });

        coins -= price;
        inventory.push({
          id: itemId + '_' + Date.now(),
          name: itemName,
          price: price,
          boothName: boothName || '',
          description: itemDesc || '',
          imageUrl: itemImageUrl || '',
          date: new Date().toLocaleDateString('zh-TW'),
          stackRotation: Math.floor(Math.random() * 10) - 5
        });

        sheet.getRange(rowIdx, coinsCol).setValue(coins);
        sheet.getRange(rowIdx, inventoryCol).setValue(JSON.stringify(inventory));

        return jsonResponse({ success: true, data: { coins, inventory } });
      }

      // --- 集章 ---
      case 'collectStamp': {
        const { username, boothId } = body;
        if (!username || !boothId) return jsonResponse({ success: false, error: '缺少參數' });

        const sheet = getSheet(SHEET_NAMES.PLAYERS);
        const rowIdx = findRow(SHEET_NAMES.PLAYERS, 'username', username);
        if (rowIdx === -1) return jsonResponse({ success: false, error: '找不到玩家' });

        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const row = sheet.getRange(rowIdx, 1, 1, sheet.getLastColumn()).getValues()[0];
        const coinsCol = headers.indexOf('coins') + 1;
        const stampsCol = headers.indexOf('stamps') + 1;

        let coins = Number(row[coinsCol - 1]) || 0;
        let stamps = safeParseJSON(row[stampsCol - 1], []);

        if (stamps.includes(boothId)) {
          return jsonResponse({ success: false, error: '已經集過章了' });
        }

        stamps.push(boothId);
        coins += 50; // 集章獎勵

        sheet.getRange(rowIdx, coinsCol).setValue(coins);
        sheet.getRange(rowIdx, stampsCol).setValue(JSON.stringify(stamps));

        // 寫入集章紀錄
        const logSheet = getSheet(SHEET_NAMES.STAMP_LOG);
        const now = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
        logSheet.appendRow([boothId, username, now]);

        return jsonResponse({ success: true, data: { coins, stamps } });
      }

      default:
        return jsonResponse({ success: false, error: '未知的 action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// --- 安全解析 JSON ---
function safeParseJSON(str, fallback) {
  if (!str || str === '') return fallback;
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
}

// ============================================================
// 初始化工作表（第一次使用時執行一次）
// 在 Apps Script 編輯器中選擇 initSheets → 按執行
// ============================================================
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 攤位資料
  let s = ss.getSheetByName(SHEET_NAMES.BOOTHS);
  if (!s) {
    s = ss.insertSheet(SHEET_NAMES.BOOTHS);
    s.appendRow([
      'id', 'side', 'name', 'owner', 'emoji', 'description',
      'plurkUrl', 'task', 'facadeImageUrl', 'stampImageUrl'
    ]);
    // 範例資料
    s.appendRow([
      'booth-1', 'top', '五月花粽', '粽子大師', '🍱',
      '傳承三代的南部粽，料多實在。',
      'https://www.plurk.com/p/example1',
      '在噗浪攤位留言「粽志成城」即可獲得集章與 50 元金幣。',
      'https://images.plurk.com/xxxxx.jpg',
      'https://images.plurk.com/stamp1.png'
    ]);
  }

  // 商品資料
  s = ss.getSheetByName(SHEET_NAMES.ITEMS);
  if (!s) {
    s = ss.insertSheet(SHEET_NAMES.ITEMS);
    s.appendRow(['boothId', 'itemId', 'name', 'price', 'description', 'imageUrl']);
    // 範例
    s.appendRow(['booth-1', 'item-1-1', '傳統肉粽', 50, '經典口味，糯米香Q。', 'https://images.plurk.com/item1.jpg']);
    s.appendRow(['booth-1', 'item-1-2', '鹹甜鹼粽', 40, '建議沾砂糖食用。', 'https://images.plurk.com/item2.jpg']);
  }

  // 玩家資料
  s = ss.getSheetByName(SHEET_NAMES.PLAYERS);
  if (!s) {
    s = ss.insertSheet(SHEET_NAMES.PLAYERS);
    s.appendRow(['username', 'pin', 'coins', 'inventory', 'stamps', 'createdAt']);
  }

  // 集章紀錄
  s = ss.getSheetByName(SHEET_NAMES.STAMP_LOG);
  if (!s) {
    s = ss.insertSheet(SHEET_NAMES.STAMP_LOG);
    s.appendRow(['boothId', 'username', 'timestamp']);
  }

  // 龍舟賽況
  s = ss.getSheetByName(SHEET_NAMES.RACE);
  if (!s) {
    s = ss.insertSheet(SHEET_NAMES.RACE);
    s.appendRow(['id', 'name', 'color', 'flagImageUrl', 'outboundScore', 'inboundScore', 'turnSuccess', 'cheers', 'lastRolls']);
    // 範例資料
    s.appendRow([1, '南港輪胎隊', '#dc2626', '', 120, 0, 'false', 88, '15,20,18,5,2']);
    s.appendRow([2, '屈原不想下水隊', '#2563eb', 'https://images.plurk.com/flag2.png', 200, 0, 'false', 156, '20,20,20,20,20']);
    s.appendRow([3, '粽子吃到飽隊', '#16a34a', '', 200, 60, 'true', 342, '1,3,2,5,4']);
    s.appendRow([4, '極速龍舟傳說', '#9333ea', 'https://images.plurk.com/flag4.png', 200, 200, 'true', 999, '']);
  }

  SpreadsheetApp.getUi().alert('✅ 工作表初始化完成！共 5 個工作表已建立。');
}
