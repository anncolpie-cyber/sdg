/* ==========================================================================
   SDG 永續守護戰 - 遊戲邏輯核心 (JavaScript - 效能與角色解鎖優化版)
   ========================================================================== */

// ==================== 1. 遊戲設定與資料庫 ====================

// 關卡詳細配置
const LEVEL_CONFIGS = {
  1: {
    name: "第 1 關：綠色起點",
    activeRows: [2], // 僅中間路線
    unlockedUnits: ["recycleCannon"], // 僅可用回收砲台
    unlockNext: "solarPanel", // 過關解鎖太陽能板
    waves: [
      {
        spawnInterval: 8000,
        sequence: ["trash1", "trash1", "trash1", "trash1"]
      }
    ]
  },
  2: {
    name: "第 2 關：潔淨能源",
    activeRows: [1, 2, 3], // 3 條路線
    unlockedUnits: ["recycleCannon", "solarPanel"],
    unlockNext: "coralShield", // 過關解鎖珊瑚盾
    waves: [
      {
        spawnInterval: 7000,
        sequence: ["trash1", "trash1", "trash1", "trash1", "trash1", "trash1"]
      }
    ]
  },
  3: {
    name: "第 3 關：海洋保育",
    activeRows: [1, 2, 3], // 3 條路線
    unlockedUnits: ["recycleCannon", "solarPanel", "coralShield"],
    unlockNext: "forestGuardian", // 過關解鎖森林守衛
    waves: [
      {
        spawnInterval: 6000,
        sequence: ["trash1", "trash2", "trash1", "trash1", "trash2", "trash1", "trash2"]
      }
    ]
  },
  4: {
    name: "第 4 關：陸域生態",
    activeRows: [0, 1, 2, 3, 4], // 全 5 條路線
    unlockedUnits: ["recycleCannon", "solarPanel", "coralShield", "forestGuardian"],
    unlockNext: null,
    waves: [
      {
        spawnInterval: 5000,
        sequence: ["trash1", "trash2", "trash1", "trash2", "trash1", "trash2", "trash2", "trash1", "trash2"]
      }
    ]
  },
  5: {
    name: "第 5 關：終極氣候行動",
    activeRows: [0, 1, 2, 3, 4], // 全 5 條路線
    unlockedUnits: ["recycleCannon", "solarPanel", "coralShield", "forestGuardian"],
    unlockNext: null,
    waves: [
      {
        spawnInterval: 5000,
        sequence: ["trash1", "trash2", "trash3", "trash1", "trash2", "trash3", "trash3"]
      },
      {
        spawnInterval: 5500,
        sequence: ["trash2", "trash3", "boss", "trash2", "trash3", "trash2"]
      }
    ]
  }
};

// 守方單位屬性
const UNIT_TYPES = {
  solarPanel: {
    name: "太陽能板",
    emoji: "☀️",
    cost: 50,
    maxHp: 80,
    actionInterval: 6000, // 每 6 秒產生 25 能量
    color: "#f1c40f",
    description: "每 6 秒產生 25 能量"
  },
  recycleCannon: {
    name: "回收砲台",
    emoji: "♻️",
    cost: 100,
    maxHp: 120,
    actionInterval: 1500, // 每 1.5 秒射一次
    damage: 20,
    color: "#3498db",
    description: "發射回收彈 (傷害 20)"
  },
  coralShield: {
    name: "珊瑚盾",
    emoji: "🪸",
    cost: 75,
    maxHp: 400,
    actionInterval: 0, // 不發射、不產能，單純阻擋
    color: "#e67e22",
    description: "高血量防禦障礙"
  },
  forestGuardian: {
    name: "森林守衛",
    emoji: "🌲",
    cost: 150,
    maxHp: 300,
    actionInterval: 1200, // 每 1.2 秒近戰一次
    damage: 45,
    color: "#27ae60",
    description: "近戰 (對 Boss 有額外傷害)"
  }
};

// 敵人單位屬性
const ENEMY_TYPES = {
  trash1: {
    name: "垃圾怪 LV1",
    emoji: "🗑️",
    maxHp: 100,
    speed: 0.6, // 像素/幀 (約 60fps 時的基礎速度)
    damage: 10,
    earthDamage: 1,
    attackInterval: 1000, // 每 1 秒攻擊一次
    color: "#95a5a6"
  },
  trash2: {
    name: "垃圾怪 LV2",
    emoji: "🥤",
    maxHp: 180,
    speed: 0.6,
    damage: 15,
    earthDamage: 1,
    attackInterval: 1000,
    color: "#bdc3c7"
  },
  trash3: {
    name: "垃圾怪 LV3",
    emoji: "🥫",
    maxHp: 300,
    speed: 0.35,
    damage: 20,
    earthDamage: 2, // 突破扣 2 點生命
    attackInterval: 1000,
    color: "#7f8c8d"
  },
  boss: {
    name: "砍樹機器人 (Boss)",
    emoji: "🚜",
    maxHp: 900,
    speed: 0.22,
    damage: 80, // 極高攻擊力，快速拆房
    earthDamage: 5, // 突破直接扣光 5 點生命失敗
    attackInterval: 800, // 攻擊頻率偏快
    color: "#d35400"
  }
};

// ==================== 2. 遊戲全域狀態與 DOM 快取 ====================

// DOM 快取變數
let elCurrentLevelText = null;
let elWaveText = null;
let elEnergyValue = null;
let elHpHearts = null;
let elCardSolarPanel = null;
let elCardRecycleCannon = null;
let elCardCoralShield = null;
let elCardForestGuardian = null;
let elShovelBtn = null;
let elStartScreen = null;
let elVictoryScreen = null;
let elDefeatScreen = null;
let elNextLevelBtn = null;
let elVictoryDesc = null;
let elToastContainer = null;
let elCardsList = []; // 快取卡片陣列

// 偵錯模式 (DEBUG_MODE === true 時可以跳關測試)
const DEBUG_MODE = false;

// 進度儲存：改用新的 key，避免 Antigravity 測試時留下的舊 highestUnlockedLevel 讓玩家一開局就能跳關
const PROGRESS_STORAGE_KEY = "sdgDefenseHighestUnlockedLevel";
const LEGACY_PROGRESS_STORAGE_KEY = "highestUnlockedLevel";

function clampLevel(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(5, Math.floor(n)));
}

function getSavedHighestUnlockedLevel() {
  const saved = localStorage.getItem(PROGRESS_STORAGE_KEY);
  if (saved === null) {
    // 忽略並清掉舊測試 key，避免所有關卡被意外開啟
    localStorage.removeItem(LEGACY_PROGRESS_STORAGE_KEY);
    localStorage.setItem(PROGRESS_STORAGE_KEY, "1");
    return 1;
  }
  return clampLevel(saved);
}

function saveHighestUnlockedLevel(level) {
  highestUnlockedLevel = clampLevel(level);
  localStorage.setItem(PROGRESS_STORAGE_KEY, String(highestUnlockedLevel));
  localStorage.removeItem(LEGACY_PROGRESS_STORAGE_KEY);
}

// 遊戲狀態與計費
let currentLevel = 1;
let highestUnlockedLevel = 1;
let gameState = "MENU"; // MENU, PLAYING, VICTORY, DEFEAT
let energy = 150;
let earthHp = 5;

// 時間與計時器 (基於 requestAnimationFrame 的 deltaTime 處理)
let lastTime = 0;
let gameTime = 0;
let passiveIncomeTimer = 0; // 每 8 秒 +25 能量
const PASSIVE_INCOME_INTERVAL = 8000;

// FPS 檢測
let fps = 0;
let frameCount = 0;
let fpsTimer = 0;

// 波次控制
let currentWaveIndex = 0;
let waveSpawnTimer = 0;
let waveSequence = [];
let spawnIndex = 0;
let totalEnemiesInWaves = 0;
let killedEnemiesCount = 0;

// 實體容器
let defenses = [];
let enemies = [];
let projectiles = [];
let particles = [];
let floatingTexts = [];
let visualEffects = []; // 近戰斬擊與技能光環


// 手機/小螢幕偵測與低特效模式
const IS_TOUCH_DEVICE = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
const IS_SMALL_VIEWPORT = window.innerWidth < 900 || window.innerHeight < 560;
const LOW_EFFECTS_MODE = IS_TOUCH_DEVICE || IS_SMALL_VIEWPORT;

// 實體上限限制，優化記憶體與渲染負擔
// 手機或小螢幕自動使用低特效模式，避免大量能量/粒子/浮動文字同時出現造成卡頓.
const MAX_PROJECTILES = LOW_EFFECTS_MODE ? 36 : 50;
const MAX_PARTICLES = LOW_EFFECTS_MODE ? 0 : 70;
const MAX_FLOATING_TEXTS = LOW_EFFECTS_MODE ? 4 : 12;
const MAX_VISUAL_EFFECTS = LOW_EFFECTS_MODE ? 0 : 10;

// 使用者互動
let selectedUnitType = null; // 'solarPanel', 'recycleCannon', 'coralShield', 'forestGuardian', 'shovel'
let isShovelSelected = false;
let hoveredCell = null;

// 畫布物件
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d", { alpha: false });

// 手機不需要 1920px 的內部畫布，降低 Canvas 解析度可明顯減少繪圖負擔。
const LOGICAL_CANVAS_WIDTH = LOW_EFFECTS_MODE ? 1280 : 1920;
const LOGICAL_CANVAS_HEIGHT = LOW_EFFECTS_MODE ? 520 : 780;
canvas.width = LOGICAL_CANVAS_WIDTH;
canvas.height = LOGICAL_CANVAS_HEIGHT;

// 解析度規格定義：桌機沿用 1920x780；手機依比例縮小。
const CANVAS_SCALE = LOGICAL_CANVAS_WIDTH / 1920;
const GRID_START_X = Math.round(240 * CANVAS_SCALE); // 地球基地寬度
const GRID_END_X = Math.round(1680 * CANVAS_SCALE);  // 戰場右邊界
const GRID_COL_WIDTH = (GRID_END_X - GRID_START_X) / 9;
const GRID_ROW_HEIGHT = LOGICAL_CANVAS_HEIGHT / 5;

// 依照目前 Canvas 邏輯尺寸自動縮放角色與血條，避免手機版壓縮後位置看起來偏移
const UNIT_FONT_SIZE = Math.round(GRID_ROW_HEIGHT * 0.62);
const ENEMY_FONT_SIZE = Math.round(GRID_ROW_HEIGHT * 0.62);
const BOSS_FONT_SIZE = Math.round(GRID_ROW_HEIGHT * 0.88);
const DEFENSE_HP_BAR_W = Math.round(GRID_COL_WIDTH * 0.56);
const ENEMY_HP_BAR_W = Math.round(GRID_COL_WIDTH * 0.52);
const BOSS_HP_BAR_W = Math.round(GRID_COL_WIDTH * 0.82);
const HP_BAR_H = Math.max(5, Math.round(GRID_ROW_HEIGHT * 0.065));

// 靜態背景快取：格線、基地、工廠區不需要每一幀重畫，可降低 Canvas 負擔
let gridCacheCanvas = null;
let gridCacheLevel = null;

// HUD 更新節流：大量太陽能板同時產能時，只在同一幀統一更新 DOM，避免卡頓
let hudDirty = true;
let hudForce = false;
let lastRenderedLevel = null;
let lastRenderedWaveText = null;
let lastRenderedEnergy = null;
let lastRenderedEarthHp = null;
let lastEnergyPulseAt = 0;

// 能量提示批次化：很多太陽能板同時觸發時，只顯示一個總和提示
let solarEnergyBatch = 0;
let solarEnergyBatchTimer = 0;
const SOLAR_BATCH_TEXT_DELAY = 220;

// 能量增加先進入緩衝，主迴圈每幀最多套用一次，避免同一幀大量太陽能板造成 HUD/卡片 DOM 尖峰更新
let pendingEnergyAmount = 0;
let pendingPassiveText = false;

// 簡單空間索引：每幀依 row 分組，減少子彈/近戰/阻擋時掃描全場
let activeEnemiesByRow = [[], [], [], [], []];
let activeDefensesByRow = [[], [], [], [], []];

// ==================== 3. 初始化 DOM 快取 ====================

function initDOMElements() {
  elCurrentLevelText = document.getElementById("currentLevelText");
  elWaveText = document.getElementById("waveText");
  elEnergyValue = document.getElementById("energyValue");
  elHpHearts = document.getElementById("hpHearts");
  
  elCardSolarPanel = document.getElementById("card-solarPanel");
  elCardRecycleCannon = document.getElementById("card-recycleCannon");
  elCardCoralShield = document.getElementById("card-coralShield");
  elCardForestGuardian = document.getElementById("card-forestGuardian");
  
  elShovelBtn = document.getElementById("shovelBtn");
  elStartScreen = document.getElementById("startScreen");
  elVictoryScreen = document.getElementById("victoryScreen");
  elDefeatScreen = document.getElementById("defeatScreen");
  elNextLevelBtn = document.getElementById("nextLevelBtn");
  elVictoryDesc = document.getElementById("victoryDesc");
  elToastContainer = document.getElementById("toastContainer");

  // 組裝快取卡片列表
  elCardsList = [elCardSolarPanel, elCardRecycleCannon, elCardCoralShield, elCardForestGuardian];
}

// ==================== 4. 實體類別定義 ====================

// 回收彈
class Projectile {
  constructor(x, y, row, damage) {
    this.x = x;
    this.y = y;
    this.row = row;
    this.damage = damage;
    this.speed = 8.5; // 每幀基礎像素移動量 (基於 60fps, 約 16.67ms)
    this.radius = 12;
  }

  update(dt) {
    // 使用 dt 進行幀率無關的物理移動優化
    const timeScale = dt / 16.67;
    this.x += this.speed * timeScale;
  }

  draw() {
    ctx.save();
    // 繪製綠色回收飛彈 (帶有光暈與環形)
    ctx.shadowBlur = LOW_EFFECTS_MODE ? 0 : 15;
    ctx.shadowColor = "#2ecc71";
    ctx.fillStyle = "#2ecc71";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // 內圈白色
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // 回收環符號文字
    ctx.font = "bold 12px sans-serif";
    ctx.fillStyle = "#27ae60";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("♻️", this.x, this.y);

    ctx.restore();
  }
}

// 粒子特效
class Particle {
  constructor(x, y, color, shape = "circle") {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 6;
    this.vy = (Math.random() - 0.5) * 6;
    this.alpha = 1;
    this.decay = 0.02 + Math.random() * 0.02;
    this.color = color;
    this.size = 3 + Math.random() * 6;
    this.shape = shape; // circle, leaf, star
  }

  update(dt) {
    const timeScale = dt / 16.67;
    this.x += this.vx * timeScale;
    this.y += this.vy * timeScale;
    this.vy += 0.08 * timeScale; // 重力加速度
    this.alpha -= this.decay * timeScale;
  }

  draw() {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    
    if (this.shape === "circle") {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.shape === "leaf") {
      ctx.font = `${this.size * 2}px sans-serif`;
      ctx.fillText("🍃", this.x, this.y);
    } else if (this.shape === "star") {
      ctx.font = `${this.size * 2}px sans-serif`;
      ctx.fillText("✨", this.x, this.y);
    }
    
    ctx.restore();
  }
}

// 飄浮傷害/能量文字
class FloatingText {
  constructor(text, x, y, color, size = 28) {
    this.text = text;
    this.x = x;
    this.y = y;
    this.color = color;
    this.size = size;
    this.alpha = 1;
    this.vy = -1.2;
    this.life = 60; // 幀數生命
  }

  update(dt) {
    const timeScale = dt / 16.67;
    this.x += (Math.random() - 0.5) * 0.4 * timeScale;
    this.y += this.vy * timeScale;
    this.alpha -= (1 / this.life) * timeScale;
  }

  draw() {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.font = `800 ${this.size}px 'Outfit', sans-serif`;
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 6;
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.textAlign = "center";
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

// 揮砍與特效發光
class VisualEffect {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // 'slash'
    this.life = 15;
    this.maxLife = 15;
  }

  update(dt) {
    const timeScale = dt / 16.67;
    this.life -= timeScale;
  }

  draw() {
    if (this.life <= 0) return;
    ctx.save();
    let ratio = this.life / this.maxLife;
    if (ratio < 0) ratio = 0;
    ctx.globalAlpha = ratio;

    if (this.type === "slash") {
      ctx.strokeStyle = "#e74c3c";
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(this.x, this.y, 50, -Math.PI / 4, Math.PI / 4);
      ctx.stroke();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 50, -Math.PI / 5, Math.PI / 5);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// 防禦單位
class Defense {
  constructor(row, col, type) {
    this.row = row;
    this.col = col;
    this.type = type;
    
    // 格子中心座標
    this.x = GRID_START_X + col * GRID_COL_WIDTH + GRID_COL_WIDTH / 2;
    this.y = row * GRID_ROW_HEIGHT + GRID_ROW_HEIGHT / 2;
    
    const props = UNIT_TYPES[type];
    this.hp = props.maxHp;
    this.maxHp = props.maxHp;
    this.emoji = props.emoji;
    this.color = props.color;
    
    // 隨機錯開第一次行動時間，避免大量太陽能板/砲台在同一幀一起觸發造成卡頓
    this.actionTimer = props.actionInterval > 0 ? Math.random() * props.actionInterval : 0;
    this.damage = props.damage || 0;
    this.flashFrames = 0; // 受傷閃紅幀數
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.flashFrames = 6;
    
    // 生成落葉碎屑粒子 (限制生成以維持效能)
    const particleCount = Math.min(2, MAX_PARTICLES - particles.length);
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle(this.x, this.y, this.color, "circle"));
    }
    
    if (this.hp < 0) this.hp = 0;
  }

  update(dt) {
    if (this.flashFrames > 0) this.flashFrames--;

    const props = UNIT_TYPES[this.type];
    if (props.actionInterval > 0) {
      this.actionTimer += dt;
      if (this.actionTimer >= props.actionInterval) {
        this.actionTimer = 0;
        this.performAction();
      }
    }
  }

  performAction() {
    if (this.type === "solarPanel") {
      // 太陽能板產能：批次化處理，避免很多太陽能板同一時間觸發造成 DOM / 特效尖峰卡頓
      addEnergy(25, "solar");
    } 
    else if (this.type === "recycleCannon") {
      // 檢查此路線右側是否有敵人，且子彈未達上限
      if (projectiles.length < MAX_PROJECTILES && hasEnemyInRow(this.row, this.x)) {
        projectiles.push(new Projectile(this.x + Math.round(GRID_COL_WIDTH * 0.25), this.y - Math.round(GRID_ROW_HEIGHT * 0.08), this.row, this.damage));
      }
    } 
    else if (this.type === "forestGuardian") {
      // 近戰攻擊，檢查前方 X 距離內的最近同路線敵人
      let target = getMeleeTarget(this.row, this.x);
      if (target) {
        let actualDamage = this.damage;
        if (target.type === "boss") {
          actualDamage = 90; // 雙倍剋制傷害
          if (!LOW_EFFECTS_MODE && floatingTexts.length < MAX_FLOATING_TEXTS) {
            floatingTexts.push(new FloatingText("⚡ 剋敵 90", target.x, target.y - 50, "#e74c3c", 32));
          }
        } else {
          if (!LOW_EFFECTS_MODE && floatingTexts.length < MAX_FLOATING_TEXTS) {
            floatingTexts.push(new FloatingText(`-${actualDamage}`, target.x, target.y - 50, "#f39c12", 28));
          }
        }
        
        target.takeDamage(actualDamage);
        
        if (!LOW_EFFECTS_MODE && visualEffects.length < MAX_VISUAL_EFFECTS) {
          visualEffects.push(new VisualEffect(target.x, target.y, "slash"));
        }
      }
    }
  }

  draw() {
    ctx.save();
    // 保險重置繪圖狀態，避免上一個半透明預覽或特效影響已放置單位亮度
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    if ("filter" in ctx) ctx.filter = "none";

    // 不再繪製已放置單位的圓形光圈/濾鏡，保持乾淨的棋盤視覺
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
    
    // 受傷閃紅
    if (this.flashFrames > 0) {
      ctx.shadowBlur = LOW_EFFECTS_MODE ? 0 : 24;
      ctx.shadowColor = "#e74c3c";
    }

    const size = UNIT_FONT_SIZE;
    ctx.font = `${size}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.emoji, this.x, this.y + Math.round(size * 0.04));

    // 血條：跟著角色大小縮放，手機版不會看起來離角色太遠
    if (this.hp < this.maxHp) {
      const barW = DEFENSE_HP_BAR_W;
      const barH = HP_BAR_H;
      const bx = this.x - barW / 2;
      const by = this.y - Math.round(size * 0.78);
      
      ctx.fillStyle = "rgba(231, 76, 60, 0.4)";
      ctx.fillRect(bx, by, barW, barH);
      
      const ratio = this.hp / this.maxHp;
      ctx.fillStyle = "#2ecc71";
      ctx.fillRect(bx, by, barW * ratio, barH);
      
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.strokeRect(bx, by, barW, barH);
    }
    
    ctx.restore();
  }
}

// 污染怪 (敵人)
class Enemy {
  constructor(row, type) {
    this.row = row;
    this.type = type;
    
    this.x = GRID_END_X + 100 + Math.random() * 80;
    this.y = row * GRID_ROW_HEIGHT + GRID_ROW_HEIGHT / 2;
    
    const props = ENEMY_TYPES[type];
    this.hp = props.maxHp;
    this.maxHp = props.maxHp;
    this.emoji = props.emoji;
    this.speed = props.speed;
    this.damage = props.damage;
    this.earthDamage = props.earthDamage;
    this.color = props.color;
    this.attackInterval = props.attackInterval;
    
    this.isBlocked = false;
    this.blockedDefense = null;
    this.attackTimer = 0;
    this.flashFrames = 0;
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.flashFrames = 6;
    
    const pCount = Math.min(2, MAX_PARTICLES - particles.length);
    for (let i = 0; i < pCount; i++) {
      particles.push(new Particle(this.x, this.y, this.color, "circle"));
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }

  die() {
    const pCount = Math.min(5, MAX_PARTICLES - particles.length);
    for (let i = 0; i < pCount; i++) {
      particles.push(new Particle(this.x, this.y, this.color, "circle"));
    }
    killedEnemiesCount++;
    checkLevelWinCondition();
  }

  update(dt) {
    if (this.flashFrames > 0) this.flashFrames--;
    const timeScale = dt / 16.67;

    if (this.isBlocked) {
      // 檢查阻擋單位是否存在
      if (!defenses.includes(this.blockedDefense) || this.blockedDefense.hp <= 0) {
        this.isBlocked = false;
        this.blockedDefense = null;
        this.attackTimer = 0;
      } else {
        // 攻擊阻擋的防禦塔
        this.attackTimer += dt;
        if (this.attackTimer >= this.attackInterval) {
          this.attackTimer = 0;
          this.blockedDefense.takeDamage(this.damage);
        }
      }
    } else {
      // 向左行走
      this.x -= this.speed * timeScale;

      // 檢查是否與該路線防禦單位相撞 (優化：只比對同一行)
      let defenseInPath = getDefenseInPath(this.row, this.x);
      if (defenseInPath) {
        this.isBlocked = true;
        this.blockedDefense = defenseInPath;
        this.attackTimer = this.attackInterval - 200; // 稍作減免，撞上後立即咬一下
      }

      // 突破左側防線
      if (this.x <= GRID_START_X) {
        earthTakeDamage(this.earthDamage, this.type === "boss");
        
        const pCount = Math.min(5, MAX_PARTICLES - particles.length);
        for (let i = 0; i < pCount; i++) {
          particles.push(new Particle(this.x, this.y, "#e74c3c", "circle"));
        }
        
        killedEnemiesCount++;
        this.hp = 0; // 銷毀
        checkLevelWinCondition();
      }
    }
  }

  draw() {
    ctx.save();
    
    // 受擊高亮閃白
    if (this.flashFrames > 0) {
      ctx.shadowBlur = LOW_EFFECTS_MODE ? 0 : 20;
      ctx.shadowColor = "#ffffff";
    }

    const size = this.type === "boss" ? BOSS_FONT_SIZE : ENEMY_FONT_SIZE;
    ctx.font = `${size}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.emoji, this.x, this.y + Math.round(size * 0.04));

    // 血條：依角色大小定位，避免手機版縮放後血條與敵人分離
    if (this.hp < this.maxHp) {
      const barW = this.type === "boss" ? BOSS_HP_BAR_W : ENEMY_HP_BAR_W;
      const barH = HP_BAR_H;
      const bx = this.x - barW / 2;
      const by = this.y - Math.round(size * 0.70);
      
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(bx, by, barW, barH);
      
      const ratio = this.hp / this.maxHp;
      ctx.fillStyle = "#e74c3c";
      ctx.fillRect(bx, by, barW * ratio, barH);
      
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.strokeRect(bx, by, barW, barH);
    }
    
    ctx.restore();
  }
}

// ==================== 5. 核心運算與碰撞優化 ====================

// 檢查同一行右側是否有敵人 (優化射擊判斷)
function hasEnemyInRow(row, fromX) {
  const rowEnemies = activeEnemiesByRow[row] || [];
  for (let i = 0; i < rowEnemies.length; i++) {
    const enemy = rowEnemies[i];
    if (enemy.x > fromX && enemy.x < GRID_END_X + 100 && enemy.hp > 0) {
      return true;
    }
  }
  return false;
}

// 取得近戰攻擊目標 (優化：只檢查同一行，且 X 距離在近戰範圍內)
function getMeleeTarget(row, guardX) {
  let closestTarget = null;
  let minX = guardX + GRID_COL_WIDTH + 45;
  const rowEnemies = activeEnemiesByRow[row] || [];

  for (let i = 0; i < rowEnemies.length; i++) {
    const enemy = rowEnemies[i];
    if (enemy.hp > 0 && enemy.x > guardX && enemy.x <= minX) {
      if (closestTarget === null || enemy.x < closestTarget.x) {
        closestTarget = enemy;
      }
    }
  }
  return closestTarget;
}

// 檢測阻擋碰撞 (優化：僅在同一個 Row 中檢查)
function getDefenseInPath(row, enemyX) {
  const rowDefenses = activeDefensesByRow[row] || [];
  for (let i = 0; i < rowDefenses.length; i++) {
    const defense = rowDefenses[i];
    if (defense.hp <= 0) continue;
    const dist = enemyX - defense.x;
    // 寬度距離碰撞檢測
    if (dist > 0 && dist < 85) {
      return defense;
    }
  }
  return null;
}

// 地球基地受傷
function earthTakeDamage(amount, isBoss = false) {
  if (gameState !== "PLAYING") return;
  
  earthHp -= amount;
  if (earthHp < 0) earthHp = 0;
  
  updateHUD();
  showToast(`⚠️ 地球受到污染入侵，HP -${amount}!`, "danger");

  if (earthHp <= 0 || isBoss) {
    earthHp = 0;
    updateHUD();
    triggerGameOver();
  }
}

function triggerGameOver() {
  gameState = "DEFEAT";
  elDefeatScreen.classList.add("active");
}

function checkLevelWinCondition() {
  if (gameState !== "PLAYING") return;

  const waveFinishedSpawning = spawnIndex >= waveSequence.length;
  // 過濾出尚存活的怪物
  let activeCount = 0;
  for (let i = 0; i < enemies.length; i++) {
    if (enemies[i].hp > 0) activeCount++;
  }

  if (waveFinishedSpawning && activeCount === 0) {
    if (currentWaveIndex < LEVEL_CONFIGS[currentLevel].waves.length - 1) {
      currentWaveIndex++;
      startWave(currentWaveIndex);
    } else {
      triggerLevelClear();
    }
  }
}

function triggerLevelClear() {
  gameState = "VICTORY";
  
  const nextLvl = currentLevel + 1;
  if (nextLvl <= 5 && nextLvl > highestUnlockedLevel) {
    saveHighestUnlockedLevel(nextLvl);
  }

  const currentConfig = LEVEL_CONFIGS[currentLevel];
  if (currentConfig.unlockNext) {
    const unlockedName = UNIT_TYPES[currentConfig.unlockNext].name;
    elVictoryDesc.innerHTML = `🌍 SDG 防線成功守住！<br><br>恭喜！解鎖新永續守護單位：<strong>【${unlockedName}】</strong>`;
  } else {
    elVictoryDesc.innerHTML = `🌍 地球生態環境完全恢復永續與和平！<br><br>恭喜您通關全部的 SDG 永續挑戰！讓我們繼續守護現實的地球環境。`;
  }

  if (currentLevel === 5) {
    elNextLevelBtn.style.display = "none";
  } else {
    elNextLevelBtn.style.display = "inline-block";
  }

  elVictoryScreen.classList.add("active");
}

// ==================== 6. 畫布渲染繪製 ====================

function buildGridCache() {
  gridCacheCanvas = document.createElement("canvas");
  gridCacheCanvas.width = canvas.width;
  gridCacheCanvas.height = canvas.height;
  const g = gridCacheCanvas.getContext("2d");
  const config = LEVEL_CONFIGS[currentLevel];

  // 1. 地球基地 (0 to 240 px)
  let earthGrad = g.createLinearGradient(0, 0, GRID_START_X, 0);
  earthGrad.addColorStop(0, "rgba(20, 50, 35, 0.9)");
  earthGrad.addColorStop(0.7, "rgba(46, 204, 113, 0.15)");
  earthGrad.addColorStop(1, "rgba(46, 204, 113, 0.0)");
  g.fillStyle = earthGrad;
  g.fillRect(0, 0, GRID_START_X, canvas.height);

  g.strokeStyle = "rgba(46, 204, 113, 0.4)";
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(GRID_START_X, 0);
  g.lineTo(GRID_START_X, canvas.height);
  g.stroke();

  g.font = "80px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("🏡", 100, canvas.height / 2);
  g.font = "40px sans-serif";
  g.fillText("🌿", 70, canvas.height / 2 - 120);
  g.fillText("🌳", 80, canvas.height / 2 + 130);
  g.fillText("🌸", 150, canvas.height / 2 + 50);

  // 2. 污染怪出生區 (1680 to 1920 px)
  let spawnGrad = g.createLinearGradient(GRID_END_X, 0, canvas.width, 0);
  spawnGrad.addColorStop(0, "rgba(127, 140, 141, 0.0)");
  spawnGrad.addColorStop(0.3, "rgba(44, 62, 80, 0.25)");
  spawnGrad.addColorStop(1, "rgba(10, 15, 12, 0.95)");
  g.fillStyle = spawnGrad;
  g.fillRect(GRID_END_X, 0, canvas.width - GRID_END_X, canvas.height);

  g.strokeStyle = "rgba(127, 140, 141, 0.25)";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(GRID_END_X, 0);
  g.lineTo(GRID_END_X, canvas.height);
  g.stroke();

  g.font = "70px sans-serif";
  g.fillText("🏭", canvas.width - 100, canvas.height / 2);
  g.font = "30px sans-serif";
  g.fillText("☠️", canvas.width - 150, canvas.height / 2 - 100);
  g.fillText("💨", canvas.width - 70, canvas.height / 2 + 100);

  // 3. 中間 5 條路線
  for (let r = 0; r < 5; r++) {
    const isActive = config.activeRows.includes(r);
    const y = r * GRID_ROW_HEIGHT;

    if (isActive) {
      for (let c = 0; c < 9; c++) {
        const x = GRID_START_X + c * GRID_COL_WIDTH;
        g.fillStyle = (r + c) % 2 === 0 ? "rgba(46, 204, 113, 0.06)" : "rgba(46, 204, 113, 0.02)";
        g.fillRect(x, y, GRID_COL_WIDTH, GRID_ROW_HEIGHT);
        g.strokeStyle = "rgba(46, 204, 113, 0.15)";
        g.lineWidth = 1;
        g.setLineDash([4, 4]);
        g.strokeRect(x, y, GRID_COL_WIDTH, GRID_ROW_HEIGHT);
        g.setLineDash([]);
      }
    } else {
      g.fillStyle = "rgba(20, 24, 22, 0.95)";
      g.fillRect(GRID_START_X, y, GRID_END_X - GRID_START_X, GRID_ROW_HEIGHT);

      g.font = "38px sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      for (let c = 0; c < 9; c++) {
        const x = GRID_START_X + c * GRID_COL_WIDTH + GRID_COL_WIDTH / 2;
        const cy = y + GRID_ROW_HEIGHT / 2;
        if (r === 0 || r === 4) {
          g.fillText("⛰️", x, cy - 20);
          g.font = "24px sans-serif";
          g.fillText("🪨", x + 35, cy + 20);
          g.font = "38px sans-serif";
        } else {
          g.fillText("🌲", x, cy - 20);
          g.font = "24px sans-serif";
          g.fillText("🌳", x - 35, cy + 20);
          g.font = "38px sans-serif";
        }
      }
    }

    g.strokeStyle = "rgba(46, 204, 113, 0.12)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(GRID_START_X, y);
    g.lineTo(GRID_END_X, y);
    g.stroke();
  }
  gridCacheLevel = currentLevel;
}

function drawGrid() {
  if (!gridCacheCanvas || gridCacheLevel !== currentLevel) {
    buildGridCache();
  }
  ctx.drawImage(gridCacheCanvas, 0, 0);
}

function drawSelectionHighlight() {
  if (gameState !== "PLAYING") return;
  if (!selectedUnitType) return;
  if (!hoveredCell) return;

  const { row, col } = hoveredCell;
  const config = LEVEL_CONFIGS[currentLevel];
  
  const isActiveRow = config.activeRows.includes(row);
  const isOccupied = defenses.some(def => def.row === row && def.col === col);
  
  const x = GRID_START_X + col * GRID_COL_WIDTH;
  const y = row * GRID_ROW_HEIGHT;

  ctx.save();
  if (isShovelSelected) {
    if (isOccupied) {
      ctx.fillStyle = "rgba(231, 76, 60, 0.2)";
      ctx.strokeStyle = "#e74c3c";
      ctx.lineWidth = 4;
      ctx.fillRect(x, y, GRID_COL_WIDTH, GRID_ROW_HEIGHT);
      ctx.strokeRect(x, y, GRID_COL_WIDTH, GRID_ROW_HEIGHT);
    }
  } else {
    if (isActiveRow && !isOccupied) {
      ctx.fillStyle = "rgba(46, 204, 113, 0.2)";
      ctx.strokeStyle = "#2ecc71";
      ctx.lineWidth = 4;
      ctx.fillRect(x, y, GRID_COL_WIDTH, GRID_ROW_HEIGHT);
      ctx.strokeRect(x, y, GRID_COL_WIDTH, GRID_ROW_HEIGHT);
      
      // 半透明 Emoji 預覽
      ctx.globalAlpha = 0.5;
      const previewSize = UNIT_FONT_SIZE;
      ctx.font = `${previewSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        UNIT_TYPES[selectedUnitType].emoji, 
        x + GRID_COL_WIDTH / 2, 
        y + GRID_ROW_HEIGHT / 2 + Math.round(previewSize * 0.04)
      );
    } else {
      ctx.fillStyle = "rgba(231, 76, 60, 0.15)";
      ctx.strokeStyle = "rgba(231, 76, 60, 0.6)";
      ctx.lineWidth = 3;
      ctx.fillRect(x, y, GRID_COL_WIDTH, GRID_ROW_HEIGHT);
      ctx.strokeRect(x, y, GRID_COL_WIDTH, GRID_ROW_HEIGHT);
    }
  }
  ctx.restore();
}

// ==================== 7. 遊戲主迴圈 (Game Loop) ====================

function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  let dt = timestamp - lastTime;
  lastTime = timestamp;

  // 限制極大幀延遲 (例如切換分頁或背景切回)
  if (dt > 100) dt = 16.67;

  if (gameState === "PLAYING") {
    gameTime += dt;
    
    // FPS 計數器計算
    frameCount++;
    fpsTimer += dt;
    if (fpsTimer >= 1000) {
      fps = Math.round((frameCount * 1000) / fpsTimer);
      frameCount = 0;
      fpsTimer = 0;
    }

    // 1. 自然永續能量增長 (每 8 秒 +25)
    passiveIncomeTimer += dt;
    if (passiveIncomeTimer >= PASSIVE_INCOME_INTERVAL) {
      passiveIncomeTimer = 0;
      addEnergy(25, "passive");
    }

    // 2. 處理出怪與實體更新 (傳入真正的 dt，保證物理移動/技能計時 frame-independent)
    updateWaveSpawning(dt);
    updateEntities(dt);
    applyPendingEnergy();
    updateEnergyBatchTexts(dt);
    flushHUD();
  }

  // 3. 清除畫布並重新繪製所有物件 (優化：單次 Canvas redraw)
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  drawGrid();
  drawSelectionHighlight();

  // 繪製塔、敵人、子彈、粒子、字體與特效
  for (let i = 0; i < defenses.length; i++) defenses[i].draw();
  for (let i = 0; i < enemies.length; i++) {
    if (enemies[i].hp > 0) enemies[i].draw();
  }
  for (let i = 0; i < projectiles.length; i++) projectiles[i].draw();
  for (let i = 0; i < particles.length; i++) particles[i].draw();
  for (let i = 0; i < visualEffects.length; i++) visualEffects[i].draw();
  for (let i = 0; i < floatingTexts.length; i++) floatingTexts[i].draw();

  // 繪製 FPS 效能偵測器在右下角
  if (gameState === "PLAYING" && !LOW_EFFECTS_MODE) {
    ctx.save();
    ctx.font = "bold 20px 'Outfit', sans-serif";
    ctx.fillStyle = "rgba(46, 204, 113, 0.45)";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText(`FPS: ${fps}`, canvas.width - 20, canvas.height - 20);
    ctx.restore();
  }

  requestAnimationFrame(gameLoop);
}

// 重新建立 row 索引，讓碰撞與尋敵只查同一路線
function rebuildSpatialIndexes() {
  activeEnemiesByRow = [[], [], [], [], []];
  activeDefensesByRow = [[], [], [], [], []];

  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (enemy.hp > 0 && activeEnemiesByRow[enemy.row]) {
      activeEnemiesByRow[enemy.row].push(enemy);
    }
  }

  for (let i = 0; i < defenses.length; i++) {
    const defense = defenses[i];
    if (defense.hp > 0 && activeDefensesByRow[defense.row]) {
      activeDefensesByRow[defense.row].push(defense);
    }
  }
}

function addEnergy(amount, source) {
  pendingEnergyAmount += amount;

  if (source === "solar") {
    solarEnergyBatch += amount;
    solarEnergyBatchTimer = SOLAR_BATCH_TEXT_DELAY;
  } else if (source === "passive") {
    pendingPassiveText = true;
  }
}

function applyPendingEnergy() {
  if (pendingEnergyAmount === 0) return;
  energy += pendingEnergyAmount;
  pendingEnergyAmount = 0;
  updateHUD();
}

function updateEnergyBatchTexts(dt) {
  // 自然能量提示只保留一個，避免與太陽能板大量產能同時洗版
  if (pendingPassiveText) {
    pendingPassiveText = false;
    if (!LOW_EFFECTS_MODE && floatingTexts.length < MAX_FLOATING_TEXTS) {
      floatingTexts.push(new FloatingText("+25 自然能量 🔋", canvas.width / 2, 50, "#2ecc71", 24));
    }
  }

  if (solarEnergyBatch <= 0) return;
  solarEnergyBatchTimer -= dt;

  if (solarEnergyBatchTimer <= 0) {
    // 很多太陽能板同時產生能量時，只顯示一個總和文字；手機低特效模式則完全不顯示，避免卡頓。
    if (!LOW_EFFECTS_MODE && floatingTexts.length < MAX_FLOATING_TEXTS) {
      floatingTexts.push(new FloatingText(`+${solarEnergyBatch} ⚡`, canvas.width / 2, 88, "#f1c40f", 26));
    }
    solarEnergyBatch = 0;
    solarEnergyBatchTimer = 0;
  }
}

// 實體更新與碰撞檢測優化 (deltaTime 更新)
function updateEntities(dt) {
  // 0. 清掉已死亡的防禦單位，避免屍體留在陣列中繼續參與碰撞/佔格
  for (let i = defenses.length - 1; i >= 0; i--) {
    if (defenses[i].hp <= 0) defenses.splice(i, 1);
  }
  rebuildSpatialIndexes();

  // 1. 更新防禦塔
  for (let i = 0; i < defenses.length; i++) {
    defenses[i].update(dt);
  }

  // 2. 更新子彈並進行同線碰撞檢查
  for (let i = projectiles.length - 1; i >= 0; i--) {
    let proj = projectiles[i];
    proj.update(dt);

    let hit = false;
    // 子彈只檢查同一 Row 的敵人，避免每顆子彈掃描全場
    const rowEnemies = activeEnemiesByRow[proj.row] || [];
    for (let j = 0; j < rowEnemies.length; j++) {
      let enemy = rowEnemies[j];
      if (enemy.hp > 0) {
        const dist = Math.abs(proj.x - enemy.x);
        if (dist < 55) {
          enemy.takeDamage(proj.damage);
          hit = true;
          
          if (!LOW_EFFECTS_MODE && floatingTexts.length < MAX_FLOATING_TEXTS) {
            floatingTexts.push(new FloatingText(`-${proj.damage}`, enemy.x, enemy.y - 45, "#ffffff", 24));
          }
          break;
        }
      }
    }

    // 超出右側邊界或擊中，立即移除子彈
    if (hit || proj.x > GRID_END_X + 50) {
      projectiles.splice(i, 1);
    }
  }

  // 3. 更新敵人
  for (let i = enemies.length - 1; i >= 0; i--) {
    let enemy = enemies[i];
    if (enemy.hp <= 0) {
      enemies.splice(i, 1);
      continue;
    }
    enemy.update(dt);
  }

  // 4. 更新粒子並隨時回收
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update(dt);
    if (particles[i].alpha <= 0) {
      particles.splice(i, 1);
    }
  }

  // 5. 更新視覺技能特效
  for (let i = visualEffects.length - 1; i >= 0; i--) {
    visualEffects[i].update(dt);
    if (visualEffects[i].life <= 0) {
      visualEffects.splice(i, 1);
    }
  }

  // 6. 更新飄浮字體
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    floatingTexts[i].update(dt);
    if (floatingTexts[i].alpha <= 0) {
      floatingTexts.splice(i, 1);
    }
  }
}

// 敵人波次生成
function updateWaveSpawning(dt) {
  if (spawnIndex >= waveSequence.length) return;

  waveSpawnTimer += dt;
  const currentWave = LEVEL_CONFIGS[currentLevel].waves[currentWaveIndex];
  
  if (waveSpawnTimer >= currentWave.spawnInterval) {
    waveSpawnTimer = 0;
    
    const nextEnemyType = waveSequence[spawnIndex];
    spawnIndex++;

    // 隨機選一個此關卡啟用的 Row
    const activeRows = LEVEL_CONFIGS[currentLevel].activeRows;
    const randomRow = activeRows[Math.floor(Math.random() * activeRows.length)];

    enemies.push(new Enemy(randomRow, nextEnemyType));
    
    // 更新 HUD
    elWaveText.innerText = `${currentWaveIndex + 1} / ${LEVEL_CONFIGS[currentLevel].waves.length} (出怪中 ${spawnIndex}/${waveSequence.length})`;
  }
}

// ==================== 8. 關卡與波次啟動機制 ====================

function startLevel(lvl) {
  highestUnlockedLevel = getSavedHighestUnlockedLevel();

  // 關卡進度限制阻擋 (非 DEBUG 模式且大於最高解鎖關卡)
  if (!DEBUG_MODE && lvl > highestUnlockedLevel) {
    showToast("請先完成前一關", "danger");
    return;
  }

  currentLevel = lvl;
  gameState = "PLAYING";
  gridCacheLevel = null;
  energy = 150;
  earthHp = 5;
  
  gameTime = 0;
  passiveIncomeTimer = 0;
  
  defenses = [];
  enemies = [];
  projectiles = [];
  particles = [];
  floatingTexts = [];
  visualEffects = [];
  solarEnergyBatch = 0;
  solarEnergyBatchTimer = 0;
  pendingEnergyAmount = 0;
  pendingPassiveText = false;
  activeEnemiesByRow = [[], [], [], [], []];
  activeDefensesByRow = [[], [], [], [], []];
  
  deselectAll();

  currentWaveIndex = 0;
  startWave(currentWaveIndex);

  // 關閉所有彈窗選單
  elStartScreen.classList.remove("active");
  elVictoryScreen.classList.remove("active");
  elDefeatScreen.classList.remove("active");

  // 更新卡片解鎖 UI 後再更新 HUD，避免剛解鎖的卡片仍被判定為 locked
  updateCardsLockStatus();
  updateHUD(true);
  showToast(`🌳 第 ${currentLevel} 關開始！建立您的永續防線。`, "success");
}

function startWave(waveIdx) {
  currentWaveIndex = waveIdx;
  const config = LEVEL_CONFIGS[currentLevel];
  const currentWave = config.waves[waveIdx];
  
  waveSequence = [...currentWave.sequence];
  spawnIndex = 0;
  waveSpawnTimer = currentWave.spawnInterval - 1000; // 稍作延遲，讓玩家能先放置 1 秒後才出怪
  
  totalEnemiesInWaves = waveSequence.length;
  killedEnemiesCount = 0;

  elWaveText.innerText = `${waveIdx + 1} / ${config.waves.length} (準備中)`;
  
  if (!LOW_EFFECTS_MODE && floatingTexts.length < MAX_FLOATING_TEXTS) {
    floatingTexts.push(new FloatingText(`⚠️ 第 ${waveIdx + 1} 波 怪物即將入侵！`, canvas.width / 2, canvas.height / 2 - 50, "#e74c3c", 36));
  }
}

// ==================== 9. UI 快取與更新邏輯 ====================

function updateHUD(force = false) {
  hudDirty = true;
  if (force) hudForce = true;

  // 選單/勝敗畫面沒有主迴圈更新時，立即刷新一次
  if (gameState !== "PLAYING" || force) {
    flushHUD(force);
  }
}

function flushHUD(force = false) {
  if (!hudDirty && !force && !hudForce) return;
  renderHUD(force || hudForce);
  hudDirty = false;
  hudForce = false;
}

function renderHUD(force = false) {
  const levelText = `第 ${currentLevel} 關`;
  if (force || lastRenderedLevel !== currentLevel || elCurrentLevelText.innerText !== levelText) {
    elCurrentLevelText.innerText = levelText;
    lastRenderedLevel = currentLevel;
  }
  
  const config = LEVEL_CONFIGS[currentLevel];
  if (config) {
    const waveText = `${currentWaveIndex + 1} / ${config.waves.length}`;
    if (force || lastRenderedWaveText !== waveText) {
      elWaveText.innerText = waveText;
      lastRenderedWaveText = waveText;
    }
  }

  if (force || lastRenderedEnergy !== energy) {
    elEnergyValue.innerText = energy;

    // 效能優先：不再每次能量變動切換 pulse class，避免大量產能時造成 layout/style recalculation 尖峰
    lastRenderedEnergy = energy;
    updateCardAffordability();
  }

  if (force || lastRenderedEarthHp !== earthHp) {
    elHpHearts.innerHTML = "";
    for (let i = 1; i <= 5; i++) {
      const heartSpan = document.createElement("span");
      heartSpan.classList.add("heart");
      if (i <= earthHp) {
        heartSpan.innerText = "💚";
      } else {
        heartSpan.innerText = "🖤";
        heartSpan.classList.add("lost");
      }
      elHpHearts.appendChild(heartSpan);
    }
    lastRenderedEarthHp = earthHp;
  }
}

// 依據當前關卡解鎖角色，正確控制鎖定遮罩與 allowedUnits 比對
function updateCardsLockStatus() {
  const config = LEVEL_CONFIGS[currentLevel];
  const unlockList = config.unlockedUnits;

  toggleCardLock(elCardSolarPanel, !unlockList.includes("solarPanel"));
  toggleCardLock(elCardRecycleCannon, !unlockList.includes("recycleCannon"));
  toggleCardLock(elCardCoralShield, !unlockList.includes("coralShield"));
  toggleCardLock(elCardForestGuardian, !unlockList.includes("forestGuardian"));
}

function toggleCardLock(cardElem, isLocked) {
  if (!cardElem) return;

  cardElem.classList.toggle("locked", isLocked);
  cardElem.setAttribute("aria-disabled", isLocked ? "true" : "false");

  if (isLocked) {
    cardElem.classList.remove("selected", "insufficient-funds");
  }
}

function updateCardAffordability() {
  setAffordability(elCardSolarPanel, "solarPanel");
  setAffordability(elCardRecycleCannon, "recycleCannon");
  setAffordability(elCardCoralShield, "coralShield");
  setAffordability(elCardForestGuardian, "forestGuardian");
}

function setAffordability(cardElem, unitType) {
  if (!cardElem) return;
  if (cardElem.classList.contains("locked")) {
    cardElem.classList.remove("insufficient-funds");
    return;
  }
  
  const cost = UNIT_TYPES[unitType].cost;
  cardElem.classList.toggle("insufficient-funds", energy < cost);
}

// ==================== 10. 防禦放置與卡片交互 ====================

function selectUnit(unitType) {
  if (gameState !== "PLAYING") return;

  const cardElem = document.getElementById(`card-${unitType}`);
  const config = LEVEL_CONFIGS[currentLevel];
  const isUnlocked = Boolean(config && config.unlockedUnits.includes(unitType));
  if (!isUnlocked || !cardElem || cardElem.classList.contains("locked")) {
    showToast("🔒 此單位在此關卡尚未解鎖！", "danger");
    return;
  }
  if (energy < UNIT_TYPES[unitType].cost) {
    showToast("⚡ 能量不足，無法選取放置此單位！", "danger");
    return;
  }

  deselectAll();

  selectedUnitType = unitType;
  isShovelSelected = false;
  cardElem.classList.add("selected");
}

function selectShovel() {
  if (gameState !== "PLAYING") return;

  deselectAll();
  isShovelSelected = true;
  selectedUnitType = "shovel";
  elShovelBtn.classList.add("selected");
}

function deselectAll() {
  selectedUnitType = null;
  isShovelSelected = false;
  
  // 優化：直接使用快取清空 class
  for (let i = 0; i < elCardsList.length; i++) {
    elCardsList[i].classList.remove("selected");
  }
  elShovelBtn.classList.remove("selected");
}

function handleCanvasClick(event) {
  if (gameState !== "PLAYING") return;
  if (!selectedUnitType) return;

  const gridCoord = getGridCoords(event);
  if (!gridCoord) return;

  const { row, col } = gridCoord;
  const config = LEVEL_CONFIGS[currentLevel];

  if (!config.activeRows.includes(row)) {
    showToast("🚫 該路線在此關卡是自然阻隔區，無法放置防禦！", "danger");
    return;
  }

  const existingDefIndex = defenses.findIndex(def => def.row === row && def.col === col);
  const isOccupied = existingDefIndex !== -1;

  if (isShovelSelected) {
    if (isOccupied) {
      const removedDefense = defenses[existingDefIndex];
      const pCount = Math.min(4, MAX_PARTICLES - particles.length);
      for (let i = 0; i < pCount; i++) {
        particles.push(new Particle(removedDefense.x, removedDefense.y, removedDefense.color, "leaf"));
      }
      
      defenses.splice(existingDefIndex, 1);
      deselectAll();
      showToast("🧹 已移除防禦單位。", "success");
      updateHUD();
    }
  } else {
    if (isOccupied) {
      showToast("🚫 此格子已經有放置防禦了！", "danger");
      return;
    }

    const cost = UNIT_TYPES[selectedUnitType].cost;
    if (energy < cost) {
      showToast("⚡ 能量不足，無法放置！", "danger");
      deselectAll();
      return;
    }

    energy -= cost;
    defenses.push(new Defense(row, col, selectedUnitType));
    
    // 放置時不產生圈圈/光暈/粒子，畫面保持乾淨，也避免手機上大量放置造成卡頓。
    showToast(`🌱 成功放置 ${UNIT_TYPES[selectedUnitType].name}！`, "success");
    deselectAll();
    updateHUD();
  }
}

function getEventPoint(event) {
  if (event.changedTouches && event.changedTouches.length > 0) return event.changedTouches[0];
  if (event.touches && event.touches.length > 0) return event.touches[0];
  return event;
}

function getGridCoords(event) {
  const point = getEventPoint(event);
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  const x = (point.clientX - rect.left) * scaleX;
  const y = (point.clientY - rect.top) * scaleY;

  if (x >= GRID_START_X && x < GRID_END_X && y >= 0 && y < canvas.height) {
    const col = Math.floor((x - GRID_START_X) / GRID_COL_WIDTH);
    const row = Math.floor(y / GRID_ROW_HEIGHT);
    return { row, col };
  }
  return null;
}

// 快捷鍵
window.addEventListener("keydown", (e) => {
  if (gameState !== "PLAYING") return;

  if (e.key === "1") {
    selectUnit("solarPanel");
  } else if (e.key === "2") {
    selectUnit("recycleCannon");
  } else if (e.key === "3") {
    selectUnit("coralShield");
  } else if (e.key === "4") {
    selectUnit("forestGuardian");
  } else if (e.key.toLowerCase() === "s" || e.key === " ") {
    selectShovel();
    e.preventDefault();
  } else if (e.key === "Escape") {
    deselectAll();
  }
});

function handleCanvasPointerDown(event) {
  if (event.cancelable) event.preventDefault();
  hoveredCell = getGridCoords(event);
  handleCanvasClick(event);
}

if (window.PointerEvent) {
  canvas.addEventListener("pointermove", (event) => {
    hoveredCell = getGridCoords(event);
  });
  canvas.addEventListener("pointerleave", () => {
    hoveredCell = null;
  });
  canvas.addEventListener("pointercancel", () => {
    hoveredCell = null;
  });
  canvas.addEventListener("pointerdown", handleCanvasPointerDown);
} else {
  canvas.addEventListener("mousemove", (event) => {
    hoveredCell = getGridCoords(event);
  });
  canvas.addEventListener("mouseleave", () => {
    hoveredCell = null;
  });
  canvas.addEventListener("click", handleCanvasClick);
  canvas.addEventListener("touchstart", handleCanvasPointerDown, { passive: false });
}

// 手機瀏覽器避免拖動頁面、雙擊縮放干擾放置。
document.addEventListener("touchmove", (event) => {
  if (event.cancelable) event.preventDefault();
}, { passive: false });

// ==================== 11. 關卡控制與通知 UI ====================

function initStartMenu() {
  gameState = "MENU";
  highestUnlockedLevel = getSavedHighestUnlockedLevel();
  
  const levelDescriptions = {
    1: "綠色起點 (1 路線)",
    2: "潔淨能源 (3 路線)",
    3: "海洋保育 (3 路線)",
    4: "陸域生態 (5 路線)",
    5: "終極氣候行動 (5 路線)"
  };

  for (let l = 1; l <= 5; l++) {
    const btn = document.getElementById(`btn-lvl-${l}`);
    const descDiv = btn.querySelector(".lvl-desc");
    const isUnlocked = l <= highestUnlockedLevel;

    btn.classList.toggle("locked", !isUnlocked);
    btn.classList.toggle("active", isUnlocked && l === highestUnlockedLevel);
    btn.disabled = !isUnlocked;
    btn.setAttribute("aria-disabled", isUnlocked ? "false" : "true");

    if (descDiv) {
      descDiv.innerText = isUnlocked ? levelDescriptions[l] : "🔒 未解鎖";
    }
  }

  updateCardsLockStatus();
  updateCardAffordability();
  elStartScreen.classList.add("active");
  elVictoryScreen.classList.remove("active");
  elDefeatScreen.classList.remove("active");
}

function retryLevel() {
  startLevel(currentLevel);
}

function nextLevel() {
  if (currentLevel < 5) {
    const target = currentLevel + 1;
    if (!DEBUG_MODE && target > highestUnlockedLevel) {
      showToast("請先完成前一關", "danger");
      return;
    }
    startLevel(target);
  } else {
    backToMenu();
  }
}

function backToMenu() {
  initStartMenu();
}

// 需要測試從第 1 關開始時，可在 Console 執行 resetProgress()
function resetProgress() {
  saveHighestUnlockedLevel(1);
  currentLevel = 1;
  initStartMenu();
  showToast("進度已重置為第 1 關", "success");
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type === "danger" ? "danger" : ""}`;
  
  if (type === "success") {
    toast.style.background = "rgba(46, 204, 113, 0.95)";
    toast.style.borderColor = "var(--color-eco-green)";
  } else if (type === "danger") {
    toast.style.background = "rgba(231, 76, 60, 0.95)";
    toast.style.borderColor = "var(--color-danger-red)";
  }
  
  toast.innerText = message;
  elToastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2500);
}

// ==================== 12. 遊戲初始化啟動 ====================

window.addEventListener("DOMContentLoaded", () => {
  initDOMElements();
  initStartMenu();
  requestAnimationFrame(gameLoop);
});
