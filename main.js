// ==========================================
// Canvas ポリフィル互換性補完
// ==========================================
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        if (typeof r === 'number') r = [r, r, r, r];
        let radius = r[0] || 0;
        if (w < 2 * radius) radius = w / 2;
        if (h < 2 * radius) radius = h / 2;
        this.beginPath();
        this.moveTo(x + radius, y);
        this.arcTo(x + w, y, x + w, y + h, radius);
        this.arcTo(x + w, y + h, x, y + h, radius);
        this.arcTo(x, y + h, x, y, radius);
        this.arcTo(x, y, x + w, y, radius);
        this.closePath();
        return this;
    };
}

// ==========================================
// フォールバック & 基本設定
// ==========================================
if (typeof window.songList === 'undefined') {
    window.songList = [{
        id: "fallback", title: "System Ready", artist: "Unknown",
        scUrl: "https://soundcloud.com/mr-mr-deez/jane-doe-and-john-doe-lms",
        levels: { easy: "Lv.1", normal: "Lv.5", hard: "Lv.9" },
        charts: { easy: [], normal: [], hard: [] }
    }];
}

let gridSnapSec = 0.05;
let pxPerSec = 400; 

function updateSnap() { gridSnapSec = parseFloat(document.getElementById('gridSnapSelect').value) || 0; }
function updateZoom() { pxPerSec = parseInt(document.getElementById('zoomSlider').value) || 400; resizeEditorCanvas(); }

// ==========================================
// グローバルステート
// ==========================================
let currentSongIndex = 0; 
let currentSong = window.songList[0];
let currentDiff = 'normal'; 
let currentNotes = [];
let activeScreen = 'title';

let systemNoteSpeed = 3.0; 
let audioOffset = 0.00; 
let isAutoPlay = false;

let scWidget = null;
let isTrackPlaying = false;
let trackCurrentTime = 0; 
let forceUnlockTimeout;

// ゲームポーズ＆音量ステート
let isGamePaused = false;
let masterVolume = 50;
let seVolume = 70;

let gameScore = 0, gameCombo = 0, maxCombo = 0, grooveGauge = 50;
let countPerf = 0, countGreat = 0, countGood = 0, countMiss = 0;
const keysState = [false, false, false, false];

let userKeys = ['d', 'f', 'j', 'k'];
function getKeyMapping() { return { [userKeys[0]]: 0, [userKeys[1]]: 1, [userKeys[2]]: 2, [userKeys[3]]: 3 }; }

const glowColors = ['#00f0ff', '#ff0055', '#00ff88', '#ffee00']; 

let hitEffects = [];
let particles = []; 
let editorScrollSec = 0;
let isRecording = false; 
let isRecordingPaused = false;
let recordingNotes = [null, null, null, null];
let testPlayMode = false; 

let lastFrameTimestamp = performance.now();

// フォーカス外れ時の自動ポーズ＆キーリセット
window.addEventListener('blur', () => {
    keysState.fill(false);
    if (activeScreen === 'game' && !testPlayMode && isTrackPlaying && !isGamePaused) {
        toggleGamePause();
    }
});

// ==========================================
// オーディオ関連 (Assist Tick & SE 音量制御)
// ==========================================
let audioCtx;
let isAssistTick = false;

function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playTickSound() {
    if(!audioCtx || seVolume <= 0) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    
    const vol = (seVolume / 100) * 0.15;
    osc.type = 'square'; 
    osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.04);
    osc.start(); osc.stop(audioCtx.currentTime + 0.04);
}

function toggleAssistTick() {
    initAudio(); isAssistTick = !isAssistTick;
    const btn = document.getElementById('assistTickBtn');
    if(isAssistTick) {
        btn.innerHTML = "🔔 ASSIST TICK: ON"; btn.style.borderColor = "var(--accent-neon)"; btn.style.color = "var(--accent-neon)";
    } else {
        btn.innerHTML = "🔔 ASSIST TICK: OFF"; btn.style.borderColor = "#888"; btn.style.color = "#888";
    }
}

const gCanvas = document.getElementById('gameCanvas');
const gCtx = gCanvas.getContext('2d', { alpha: false }); 
const bgCanvas = document.getElementById('bgCanvas');
const bgCtx = bgCanvas.getContext('2d', { alpha: false }); 
const eCanvas = document.getElementById('editorCanvas');
const eCtx = eCanvas.getContext('2d', { alpha: false });

// ==========================================
// アカウント管理 & 拡張設定
// ==========================================
let userProfile = { 
    username: "", displayName: "GUEST", avatarUrl: "",
    level: 1, xp: 0, highScores: {},
    playCount: 0, totalScore: 0, 
    theme: "cyber", noteSkin: "classic",
    showEffects: true, bgAnim: true, keys: ['d', 'f', 'j', 'k'], 
    volume: 50, seVolume: 70,
    mirror: "off", random: "off", judgePosition: 600, showEarlyLate: "on",
    laneCover: "off", enableShake: "on", enableFlash: "on"
};

function initAccountSystem() {
    const data = localStorage.getItem('Strikers_Save') || localStorage.getItem('BRhythm_Save');
    if (data) {
        try { 
            let loaded = JSON.parse(data);
            userProfile = { ...userProfile, ...loaded }; 
            userKeys = userProfile.keys || ['d', 'f', 'j', 'k'];
            masterVolume = userProfile.volume !== undefined ? userProfile.volume : 50;
            seVolume = userProfile.seVolume !== undefined ? userProfile.seVolume : 70;
            applyProfileUI(); applyTheme(userProfile.theme); toggleBgAnim(userProfile.bgAnim);
        } catch(e) { showRegisterModal(); applyTheme('cyber'); }
    } else { showRegisterModal(); applyTheme('cyber'); }
    
    document.getElementById('vol-slider').value = masterVolume;
    document.getElementById('vol-disp').innerText = masterVolume;
    document.getElementById('se-vol-slider').value = seVolume;
    document.getElementById('se-vol-disp').innerText = seVolume;
}

function showRegisterModal() { document.getElementById('account-register-modal').classList.add('show'); }

function saveRegisteredName() {
    const input = document.getElementById('reg-name-input').value.trim() || "GUEST";
    userProfile.username = input; userProfile.displayName = input.toUpperCase();
    saveProfileToLocal(); applyProfileUI();
    document.getElementById('account-register-modal').classList.remove('show');
}

function saveProfileToLocal() { userProfile.keys = userKeys; localStorage.setItem('Strikers_Save', JSON.stringify(userProfile)); }

function applyProfileUI() {
    const dispName = userProfile.displayName || userProfile.username || "GUEST";
    document.getElementById('accName').innerText = dispName;
    document.getElementById('accLevel').innerText = `Lv.${userProfile.level}`;
    
    const avatarEl = document.getElementById('accAvatar');
    if (userProfile.avatarUrl) {
        avatarEl.style.backgroundImage = `url('${userProfile.avatarUrl}')`;
        avatarEl.style.backgroundSize = 'cover'; avatarEl.style.backgroundPosition = 'center'; avatarEl.innerText = '';
    } else {
        avatarEl.style.backgroundImage = 'none'; avatarEl.innerText = dispName.charAt(0).toUpperCase();
    }
    
    const progress = (userProfile.xp / (userProfile.level * 1000)) * 100;
    document.getElementById('accXpFill').style.width = `${progress}%`;
    buildSongList();
}

function addXp(amount) {
    userProfile.xp += amount;
    while (userProfile.xp >= userProfile.level * 1000) {
        userProfile.xp -= userProfile.level * 1000; userProfile.level++;
    }
    saveProfileToLocal(); applyProfileUI();
}

function applyTheme(themeName) {
    const root = document.documentElement;
    if (themeName === 'light') {
        root.style.setProperty('--bg-base', '#e4e9f0'); root.style.setProperty('--accent-neon', '#ff0055');
        root.style.setProperty('--border-line', 'rgba(255, 0, 85, 0.3)');
        root.style.setProperty('--text-main', '#111111'); root.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.88)');
    } else if (themeName === 'monochrome') {
        root.style.setProperty('--bg-base', '#050505'); root.style.setProperty('--accent-neon', '#ffffff');
        root.style.setProperty('--border-line', 'rgba(255, 255, 255, 0.3)');
        root.style.setProperty('--text-main', '#ffffff'); root.style.setProperty('--glass-bg', 'rgba(15, 15, 15, 0.9)');
    } else { 
        root.style.setProperty('--bg-base', '#03030c'); root.style.setProperty('--accent-neon', '#00f0ff');
        root.style.setProperty('--border-line', 'rgba(0, 240, 255, 0.3)');
        root.style.setProperty('--text-main', '#e0e0ff'); root.style.setProperty('--glass-bg', 'rgba(8, 10, 25, 0.88)');
    }
}

function previewTheme() {
    const theme = document.getElementById('theme-select').value;
    const previewBox = document.getElementById('theme-preview');
    if (theme === 'light') { previewBox.style.background = '#e4e9f0'; previewBox.style.color = '#ff0055'; previewBox.style.borderColor = '#ff0055'; } 
    else if (theme === 'monochrome') { previewBox.style.background = '#050505'; previewBox.style.color = '#ffffff'; previewBox.style.borderColor = '#ffffff'; } 
    else { previewBox.style.background = '#03030c'; previewBox.style.color = '#00f0ff'; previewBox.style.borderColor = '#00f0ff'; }
}

function toggleBgAnim(forceVal = null) {
    const sel = document.getElementById('bganim-select');
    const isAnim = forceVal !== null ? forceVal : (sel.value === 'on');
    document.body.style.animation = isAnim ? 'bgDrift 25s linear infinite' : 'none';
    userProfile.bgAnim = isAnim;
}

function updateVolume(val) {
    masterVolume = parseInt(val);
    document.getElementById('vol-disp').innerText = masterVolume;
    if (scWidget) scWidget.setVolume(masterVolume);
    userProfile.volume = masterVolume; saveProfileToLocal();
}

function updateSeVolume(val) {
    seVolume = parseInt(val);
    document.getElementById('se-vol-disp').innerText = seVolume;
    userProfile.seVolume = seVolume; saveProfileToLocal();
}

function updateJudgePos(val) {
    userProfile.judgePosition = parseInt(val);
    document.getElementById('judge-pos-disp').innerText = userProfile.judgePosition;
}

// ==========================================
// 画面制御 & UI
// ==========================================
function changeScreen(screenName) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`${screenName}-screen`).classList.add('active');
    activeScreen = screenName;
    
    document.getElementById('sysHeaderId').style.display = ['select', 'title', 'result'].includes(screenName) ? 'flex' : 'none';
    document.getElementById('quitTriggerId').style.display = ['game', 'editor'].includes(screenName) ? 'block' : 'none';

    if(scWidget && screenName !== 'game' && screenName !== 'editor') { scWidget.pause(); isTrackPlaying = false; }
    if(screenName !== 'editor' && isRecording) stopRecording();
    if(screenName === 'select') scrollToActiveSong();
    
    if(screenName === 'game') {
        document.getElementById('game-wrapper-box').classList.remove('game-flipped');
        isGamePaused = false;
        document.getElementById('pause-overlay').classList.remove('show');
        resizeGameCanvas();
        requestAnimationFrame(resizeGameCanvas);
    }
    if(screenName === 'editor') {
        resizeEditorCanvas();
        requestAnimationFrame(resizeEditorCanvas);
    }
}

function triggerQuitToSelect() {
    if(scWidget) scWidget.pause();
    isTrackPlaying = false;
    isGamePaused = false;
    keysState.fill(false);
    document.getElementById('pause-overlay').classList.remove('show');
    if (testPlayMode) { testPlayMode = false; changeScreen('editor'); } 
    else { changeScreen('select'); }
}

function toggleGamePause() {
    if (activeScreen !== 'game' || testPlayMode) return;
    isGamePaused = !isGamePaused;
    const overlay = document.getElementById('pause-overlay');
    
    if (isGamePaused) {
        overlay.classList.add('show');
        if (scWidget && isTrackPlaying) scWidget.pause();
    } else {
        overlay.classList.remove('show');
        if (scWidget) scWidget.play();
        lastFrameTimestamp = performance.now();
    }
}

function toggleAutoPlay() {
    isAutoPlay = !isAutoPlay;
    const box = document.getElementById('autoPlayToggle');
    const status = document.getElementById('autoPlayStatus');
    if(isAutoPlay) { box.classList.add('active'); status.innerText = "ON"; status.style.color = "#000"; } 
    else { box.classList.remove('active'); status.innerText = "OFF"; status.style.color = "var(--text-sub)"; }
}

// ==========================================
// 選曲リスト & SoundCloud API
// ==========================================
function buildSongList() {
    const container = document.getElementById('songListId');
    if(!container) return;
    container.innerHTML = "";
    if(!window.songList || window.songList.length === 0) return;

    window.songList.forEach((song, index) => {
        const card = document.createElement('div');
        card.className = `song-card ${index === currentSongIndex ? 'active' : ''}`;
        card.onclick = () => selectSong(index);
        
        let bestScore = userProfile.highScores[`${song.id}_${currentDiff}`] || 0;
        const scoreText = bestScore > 0 ? `HI-SCORE: ${bestScore.toLocaleString().padStart(6,'0')}` : "NO RECORD";
        let levelText = (song.levels && song.levels[currentDiff]) ? song.levels[currentDiff].split('.').pop() : "?";
        
        card.innerHTML = `
            <div class="song-card-info">
                <h3>${song.title}</h3><p>${song.artist}</p><div class="high-score-tag">${scoreText}</div>
            </div>
            <div><span style="border:1px solid var(--accent-neon); color:var(--accent-neon); padding:4px 8px; font-family:'Press Start 2P'; font-size:9px;">Lv.${levelText}</span></div>
        `;
        container.appendChild(card);
    });
    
    if(currentSong) {
        document.getElementById('selectedTitle').innerText = currentSong.title;
        document.getElementById('selectedArtist').innerText = currentSong.artist;
    }
}

function selectSong(index) {
    currentSongIndex = index; currentSong = window.songList[currentSongIndex];
    buildSongList();
    const startBtn = document.getElementById('startPlayBtn');
    if(startBtn) { startBtn.disabled = true; startBtn.innerText = "LOADING..."; }
    const jacket = document.getElementById('ui-jacket');
    if(jacket) jacket.style.opacity = '0.3';
    loadTrackViaWidget(currentSong.scUrl);
}

function loadTrackViaWidget(trackUrl) {
    if (!scWidget || !trackUrl) { unlockButton(); return; }
    if(forceUnlockTimeout) clearTimeout(forceUnlockTimeout);
    if (trackUrl.includes('soundcloud.com')) {
        scWidget.load(trackUrl, { 
            auto_play: false, show_artwork: false, 
            callback: () => { 
                unlockButton(); 
                scWidget.setVolume(masterVolume);
                scWidget.getCurrentSound((sound) => { updateJacketArtwork(sound); }); 
            } 
        });
        forceUnlockTimeout = setTimeout(unlockButton, 4000);
    } else { unlockButton(); }
}

function updateJacketArtwork(sound) {
    const jacket = document.getElementById('ui-jacket');
    if(!jacket) return;
    jacket.style.opacity = '1';
    if(sound && sound.artwork_url) {
        let highResUrl = sound.artwork_url.replace('-large', '-t500x500');
        jacket.style.backgroundImage = `url('${highResUrl}')`;
        jacket.innerHTML = `<style>.jacket-placeholder::after { display: none !important; }</style>`;
    } else {
        jacket.style.backgroundImage = 'none';
        jacket.innerHTML = `<div style="font-size:11px; font-family:'Press Start 2P'; color:#fff; opacity:0.3;">NO IMAGE</div>`;
    }
}

function unlockButton() {
    if(forceUnlockTimeout) clearTimeout(forceUnlockTimeout);
    const btn = document.getElementById('startPlayBtn');
    if(btn) { btn.disabled = false; btn.innerText = "GAME START"; }
}

function selectDiff(e, diff) {
    currentDiff = diff;
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    buildSongList(); 
}

function scrollToActiveSong() {
    const card = document.querySelector('.song-card.active');
    if(card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function safeLoadChart() {
    if (!currentSong) return [];
    
    // LocalStorageデータの取得優先
    const localChartKey = `Strikers_Chart_${currentSong.id}_${currentDiff}`;
    const savedLocal = localStorage.getItem(localChartKey);
    if (savedLocal) {
        try {
            return JSON.parse(savedLocal);
        } catch(e) {
            console.error("Local chart parse error", e);
        }
    }

    // グローバルオブジェクト定義の譜面データフォールバック
    let chartData = currentSong.charts || (window[currentSong.chartVar] = window[currentSong.chartVar] || { easy: [], normal: [], hard: [] });
    if (!chartData[currentDiff]) chartData[currentDiff] = [];
    return chartData[currentDiff];
}

function saveToGlobalChart() {
    if (!currentSong) return;
    
    if (currentSong.charts) currentSong.charts[currentDiff] = currentNotes;
    else if (currentSong.chartVar) {
        if (!window[currentSong.chartVar]) window[currentSong.chartVar] = {};
        window[currentSong.chartVar][currentDiff] = currentNotes;
    }

    const localChartKey = `Strikers_Chart_${currentSong.id}_${currentDiff}`;
    localStorage.setItem(localChartKey, JSON.stringify(currentNotes));
}

// ==========================================
// ゲームプレイ
// ==========================================
function startGame() {
    initAudio();
    const sourceData = safeLoadChart();
    currentNotes = JSON.parse(JSON.stringify(sourceData));
    
    // ミラー / ランダム変換
    if (userProfile.mirror === 'on') {
        currentNotes.forEach(n => { if (n.lane !== undefined) n.lane = 3 - n.lane; });
    } else if (userProfile.random === 'on') {
        const randMap = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
        currentNotes.forEach(n => { if (n.lane !== undefined) n.lane = randMap[n.lane]; });
    }

    currentNotes.forEach(n => { n.hit = false; n.missed = false; n.isHolding = false; n.hitEnd = false; n.played = false; });

    gameScore = 0; gameCombo = 0; maxCombo = 0; grooveGauge = 80;
    countPerf = 0; countGreat = 0; countGood = 0; countMiss = 0;
    hitEffects = []; particles = []; trackCurrentTime = 0;
    isGamePaused = false;
    keysState.fill(false);
    
    document.getElementById('autoplay-badge').style.display = isAutoPlay ? 'block' : 'none';

    changeScreen('game');
    resizeGameCanvas();
    updateHUD();

    if(scWidget) { 
        scWidget.setVolume(masterVolume);
        scWidget.seekTo(0); 
        scWidget.play(); 
    }
    isTrackPlaying = true;
    lastFrameTimestamp = performance.now();
    requestAnimationFrame(engineLoop);
}

function finishGame() {
    if (activeScreen !== 'game') return;
    isTrackPlaying = false;
    if(scWidget) scWidget.pause();
    
    if(testPlayMode) {
        testPlayMode = false; alert(`【TEST PLAY】\nSCORE: ${gameScore}\nMAX COMBO: ${maxCombo}`);
        changeScreen('editor'); return;
    }

    if (!isAutoPlay) {
        const key = `${currentSong.id}_${currentDiff}`;
        if (gameScore > (userProfile.highScores[key] || 0)) userProfile.highScores[key] = gameScore;
        addXp(Math.floor(gameScore / 100));
        userProfile.playCount = (userProfile.playCount || 0) + 1;
        userProfile.totalScore = (userProfile.totalScore || 0) + gameScore;
        saveProfileToLocal();
    }

    document.getElementById('resScore').innerText = String(gameScore).padStart(6, '0');
    document.getElementById('resMaxCombo').innerText = maxCombo;
    document.getElementById('resPerf').innerText = countPerf;
    document.getElementById('resGreat').innerText = countGreat;
    document.getElementById('resGood').innerText = countGood;
    document.getElementById('resMiss').innerText = countMiss;
    
    let rank = gameScore >= 950000 ? 'SSS' : gameScore >= 900000 ? 'SS' : gameScore >= 800000 ? 'S' : gameScore >= 700000 ? 'A' : gameScore >= 500000 ? 'B' : 'C';
    if(isAutoPlay) rank = 'AUTO';
    const rankEl = document.getElementById('resRankText');
    rankEl.innerText = rank; rankEl.style.color = rank === 'AUTO' ? '#888' : '#fff';

    changeScreen('result');
}

function triggerFlash() {
    if (userProfile.enableFlash === 'off') return;
    const flash = document.getElementById('flash-overlay');
    if(flash) {
        flash.style.display = 'block'; flash.style.opacity = '0.8';
        setTimeout(() => { flash.style.opacity = '0'; }, 50);
        setTimeout(() => { flash.style.display = 'none'; }, 250);
    }
}

function triggerShake() {
    if (userProfile.enableShake === 'off') return;
    const gameScreen = document.getElementById('game-wrapper-box');
    if(gameScreen) {
        gameScreen.style.transform = "translate(12px, 12px)";
        setTimeout(() => gameScreen.style.transform = "translate(-12px, -12px)", 50);
        setTimeout(() => gameScreen.style.transform = "translate(8px, 8px)", 100);
        setTimeout(() => gameScreen.style.transform = "translate(0, 0)", 150);
    }
}

function triggerFlip() {
    const gameScreen = document.getElementById('game-wrapper-box');
    if(gameScreen) {
        gameScreen.classList.toggle('game-flipped');
    }
}

// ==========================================
// 描画エンジン (Canvas)
// ==========================================
function getJudgeY() { return userProfile.judgePosition || 600; }

function resizeGameCanvas() {
    if(gCanvas && gCanvas.parentElement && gCanvas.parentElement.clientWidth > 0) {
        gCanvas.width = gCanvas.parentElement.clientWidth; gCanvas.height = gCanvas.parentElement.clientHeight;
        bgCanvas.width = gCanvas.width; bgCanvas.height = gCanvas.height;
    }
}

window.addEventListener('resize', () => { 
    if(activeScreen === 'game') requestAnimationFrame(resizeGameCanvas); 
    if(activeScreen === 'editor') requestAnimationFrame(resizeEditorCanvas);
});

function drawBackground() {
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    bgCtx.strokeStyle = 'rgba(0, 240, 255, 0.08)'; bgCtx.lineWidth = 1; bgCtx.beginPath();
    
    let speed = 200 * systemNoteSpeed;
    let offset = (trackCurrentTime * speed) % 100;
    for(let y = offset; y < bgCanvas.height; y += 100) { bgCtx.moveTo(0, y); bgCtx.lineTo(bgCanvas.width, y); }
    for(let x = 0; x <= bgCanvas.width; x += bgCanvas.width/4) { bgCtx.moveTo(x, 0); bgCtx.lineTo(x, bgCanvas.height); }
    bgCtx.stroke();
}

function drawNoteSkin(x, y, w, h, lane, isLongBody=false, type='normal') {
    const skin = userProfile.noteSkin || 'classic';
    
    if (type === 'fake') {
        gCtx.fillStyle = 'rgba(180, 0, 255, 0.95)'; 
        gCtx.beginPath();
        gCtx.moveTo(x + w/2, y); gCtx.lineTo(x + w, y + h/2); gCtx.lineTo(x + w/2, y + h); gCtx.lineTo(x, y + h/2);
        gCtx.fill();
        return;
    }
    
    gCtx.fillStyle = isLongBody ? 'rgba(255,255,255,0.45)' : '#fff';
    
    if (skin === 'round') {
        gCtx.beginPath(); gCtx.roundRect(x, y, w, h, h/2); gCtx.fill();
    } else if (skin === 'glow') {
        if (!isLongBody) { gCtx.shadowBlur = 18; gCtx.shadowColor = glowColors[lane]; }
        gCtx.fillStyle = glowColors[lane];
        gCtx.beginPath(); gCtx.roundRect(x, y, w, h, 3); gCtx.fill(); gCtx.shadowBlur = 0; 
    } else if (skin === 'diamond') {
        if (!isLongBody) {
            gCtx.fillStyle = glowColors[lane];
            gCtx.beginPath();
            gCtx.moveTo(x + w/2, y - h/2); gCtx.lineTo(x + w, y + h/2); gCtx.lineTo(x + w/2, y + h*1.5); gCtx.lineTo(x, y + h/2);
            gCtx.fill();
        } else {
            gCtx.fillRect(x, y, w, h);
        }
    } else {
        gCtx.fillRect(x, y, w, h);
        if(!isLongBody) { gCtx.fillStyle = '#000'; gCtx.fillRect(x + 10, y + 6, w - 20, 4); }
    }
}

function drawLaneCover() {
    if (userProfile.laneCover === 'off') return;
    const laneW = gCanvas.width;
    gCtx.fillStyle = 'rgba(2, 4, 12, 0.95)';
    gCtx.strokeStyle = 'var(--accent-neon)'; gCtx.lineWidth = 2;
    
    if (userProfile.laneCover === 'hidden') {
        gCtx.fillRect(0, 0, laneW, gCanvas.height * 0.4);
        gCtx.beginPath(); gCtx.moveTo(0, gCanvas.height * 0.4); gCtx.lineTo(laneW, gCanvas.height * 0.4); gCtx.stroke();
    } else if (userProfile.laneCover === 'sudden') {
        const judgeY = getJudgeY();
        gCtx.fillRect(0, judgeY - (gCanvas.height * 0.35), laneW, gCanvas.height * 0.35);
        gCtx.beginPath(); gCtx.moveTo(0, judgeY - (gCanvas.height * 0.35)); gCtx.lineTo(laneW, judgeY - (gCanvas.height * 0.35)); gCtx.stroke();
    }
}

function renderGame() {
    const judgeY = getJudgeY();
    drawBackground();
    gCtx.clearRect(0, 0, gCanvas.width, gCanvas.height);
    const laneW = gCanvas.width / 4; const noteTimeWindow = 2.0 / systemNoteSpeed; 

    for(let i=0; i<4; i++) {
        if(keysState[i]) { gCtx.fillStyle = 'rgba(0,240,255,0.12)'; gCtx.fillRect(i*laneW, 0, laneW, gCanvas.height); }
    }

    gCtx.fillStyle = '#fff'; gCtx.fillRect(0, judgeY, gCanvas.width, 2);

    let notesRemaining = false;
    
    currentNotes.forEach(note => {
        if (note.type === 'effect') {
            if (!note.played && trackCurrentTime >= note.time) {
                note.played = true;
                if (note.action === 'flash') triggerFlash();
                if (note.action === 'shake') triggerShake();
                if (note.action === 'flip') triggerFlip();
            } return; 
        }

        let rem = note.time - trackCurrentTime + audioOffset;
        if (rem > -0.2 && !note.hitEnd && (!note.hit || note.isLong)) notesRemaining = true;

        if (isAutoPlay && note.type !== 'fake') {
            if (!note.hit && rem <= 0) {
                keysState[note.lane] = true; executeHitJudgment(note.lane, true, note);
                setTimeout(() => { if(isAutoPlay) keysState[note.lane] = false; }, 50);
            }
            if (note.isLong && note.isHolding && note.endTime !== undefined) {
                let remEnd = note.endTime - trackCurrentTime + audioOffset;
                keysState[note.lane] = true;
                if (remEnd <= 0 && !note.hitEnd) { executeReleaseJudgment(note.lane, true, note); keysState[note.lane] = false; }
            }
        }

        let x = note.lane * laneW;

        if(note.isLong && !note.hitEnd && note.endTime !== undefined) {
            let remEnd = note.endTime - trackCurrentTime + audioOffset;
            if ((rem <= noteTimeWindow && remEnd > -0.2) || note.isHolding) {
                let yStart = note.isHolding ? judgeY : judgeY - (rem / noteTimeWindow) * judgeY;
                let yEnd = judgeY - (remEnd / noteTimeWindow) * judgeY;
                drawNoteSkin(x + 15, yEnd, laneW - 30, yStart - yEnd, note.lane, true, 'normal');
                if (note.isHolding && !isGamePaused) {
                    if(!isAutoPlay) gameScore += 10;
                    if(userProfile.showEffects && Math.random() > 0.6) spawnParticles(x + laneW/2, judgeY, glowColors[note.lane], 1);
                }
            }
        }

        if(rem <= noteTimeWindow && rem > -0.2 && !note.hit) {
            let y = judgeY - (rem / noteTimeWindow) * judgeY;
            drawNoteSkin(x + 5, y - 8, laneW - 10, 16, note.lane, false, note.type || 'normal');
        }
        
        if(!isAutoPlay && rem <= -0.2 && !note.missed && !note.hit) {
            note.missed = true; 
            if (note.type !== 'fake') {
                countMiss++; grooveGauge = Math.max(0, grooveGauge - 10);
                triggerJudgeNotice('MISS', 'var(--accent-pink)'); gameCombo = 0; updateHUD();
            }
        }
    });

    drawLaneCover();

    if (!notesRemaining && trackCurrentTime > 0) {
        let lastTime = currentNotes.length > 0 ? currentNotes[currentNotes.length - 1].time : 0;
        if (trackCurrentTime > lastTime + 2.0) finishGame();
    }

    if (userProfile.showEffects && !isGamePaused) {
        gCtx.globalCompositeOperation = 'lighter'; 
        for (let i = particles.length - 1; i >= 0; i--) {
            let p = particles[i]; gCtx.fillStyle = p.color; gCtx.fillRect(p.x, p.y, p.size, p.size);
            p.x += p.vx; p.y += p.vy; p.size *= 0.92; p.life -= 1;
            if (p.life <= 0) particles.splice(i, 1);
        }
        for(let i = hitEffects.length - 1; i >= 0; i--) {
            let eff = hitEffects[i]; gCtx.beginPath(); gCtx.arc(eff.x, eff.y, eff.radius, 0, Math.PI * 2);
            gCtx.strokeStyle = eff.color; gCtx.lineWidth = eff.alpha * 5; gCtx.stroke();
            eff.radius += 8; eff.alpha -= 0.08;
            if(eff.alpha <= 0) hitEffects.splice(i, 1);
        }
        gCtx.globalCompositeOperation = 'source-over';
    }
}

function spawnParticles(x, y, color, count=25) {
    if(!userProfile.showEffects || particles.length > 300) return; 
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x, y: y, 
            vx: (Math.random() - 0.5) * 20, 
            vy: (Math.random() - 0.8) * 20,
            size: Math.random() * 8 + 3, 
            color: color, life: 25
        });
    }
}

function executeHitJudgment(lane, forceHit=false, forceNote=null) {
    if(isGamePaused) return;
    const judgeY = getJudgeY();
    let perfectW = 0.05, greatW = 0.10, goodW = 0.15;
    let time = trackCurrentTime - audioOffset;
    let target = forceNote;

    if (!target) {
        let bestDiff = Infinity;
        currentNotes.forEach(note => {
            if(note.type !== 'effect' && note.lane === lane && !note.hit && !note.missed) {
                let diff = Math.abs(note.time - time);
                if(diff < bestDiff && diff < goodW) { bestDiff = diff; target = note; }
            }
        });
    }

    if(target) {
        if (target.type === 'fake') {
            target.hit = true;
            triggerJudgeNotice('POISON', 'var(--accent-pink)');
            gameCombo = 0; grooveGauge = Math.max(0, grooveGauge - 15);
            updateHUD();
            if(userProfile.showEffects) spawnParticles((lane * (gCanvas.width/4)) + (gCanvas.width/8), judgeY, 'var(--accent-pink)', 40);
            return;
        }

        target.hit = true;
        if(target.isLong) target.isHolding = true; 

        const laneW = gCanvas.width / 4; const targetX = (lane * laneW) + (laneW / 2);
        
        if (userProfile.showEffects) {
            hitEffects.push({ x: targetX, y: judgeY, radius: 10, color: glowColors[lane], alpha: 1.0 });
            spawnParticles(targetX, judgeY, glowColors[lane], 25);
        }

        let timeDiff = time - target.time;
        let absDiff = Math.abs(timeDiff);
        let subText = "";
        
        if (userProfile.showEarlyLate === 'on' && !forceHit) {
            if (absDiff > 0.02) {
                subText = timeDiff < 0 ? `EARLY (${Math.round(absDiff*1000)}ms)` : `LATE (${Math.round(absDiff*1000)}ms)`;
            }
        }

        if(forceHit || absDiff <= perfectW) { 
            triggerJudgeNotice('PERFECT', '#fff', subText); gameScore += 1000; gameCombo++; countPerf++; grooveGauge = Math.min(100, grooveGauge + 2);
        } else if(absDiff <= greatW) { 
            triggerJudgeNotice('GREAT', '#ccc', subText); gameScore += 700; gameCombo++; countGreat++; grooveGauge = Math.min(100, grooveGauge + 1);
        } else { 
            triggerJudgeNotice('GOOD', '#888', subText); gameScore += 400; gameCombo++; countGood++;
        }
        
        if (gameCombo > maxCombo) maxCombo = gameCombo;
        updateHUD();
    }
}

function executeReleaseJudgment(lane, forceHit=false, forceNote=null) {
    if(isGamePaused) return;
    const judgeY = getJudgeY();
    let time = trackCurrentTime - audioOffset;
    currentNotes.forEach(note => {
        if (note.type !== 'effect' && note.lane === lane && note.isHolding && !note.hitEnd) {
            if(forceNote && note !== forceNote) return;
            note.isHolding = false; let diff = Math.abs(note.endTime - time);
            
            if(forceHit || diff < 0.2) {
                note.hitEnd = true; const laneW = gCanvas.width / 4;
                spawnParticles((lane * laneW) + (laneW / 2), judgeY, glowColors[lane], 20);
                triggerJudgeNotice('PERFECT', '#fff'); gameCombo++;
            } else {
                note.missed = true; triggerJudgeNotice('MISS', 'var(--accent-pink)'); gameCombo = 0; countMiss++;
            }
            updateHUD();
        }
    });
}

function triggerJudgeNotice(text, color, subText="") {
    const el = document.getElementById('judgeId'); 
    const subEl = document.getElementById('judgeSubId');
    if(!el) return;
    el.childNodes[0].nodeValue = text; 
    if(subEl) subEl.innerText = subText;
    el.style.color = color;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

function updateHUD() {
    document.getElementById('scoreId').innerText = String(gameScore).padStart(6, '0');
    
    const comboEl = document.getElementById('comboId');
    comboEl.innerText = gameCombo + " COMBO";
    comboEl.classList.remove('combo-pop');
    void comboEl.offsetWidth; 
    if(gameCombo > 0) comboEl.classList.add('combo-pop');

    const grooveEl = document.getElementById('grooveFill');
    grooveEl.style.width = `${grooveGauge}%`;
    if (grooveGauge >= 80) grooveEl.classList.add('groove-overheat');
    else grooveEl.classList.remove('groove-overheat');
}

// ==========================================
// 譜面エディタ機能
// ==========================================
function startEditor() {
    initAudio(); currentNotes = safeLoadChart(); editorScrollSec = 0; changeScreen('editor'); 
    if(scWidget) { 
        scWidget.setVolume(masterVolume);
        scWidget.seekTo(0); 
        scWidget.pause(); 
        document.getElementById('editPlayBtn').innerText = "▶ PLAY/PAUSE"; 
    }
    isTrackPlaying = false;
    requestAnimationFrame(editorLoop);
}

function resizeEditorCanvas() { 
    if(eCanvas && eCanvas.parentElement && eCanvas.parentElement.clientWidth > 0) {
        eCanvas.width = eCanvas.parentElement.clientWidth; eCanvas.height = eCanvas.parentElement.clientHeight; 
    }
}

function toggleRecAction() { initAudio(); if (!isRecording) startRecordingFromZero(); else stopRecording(); }

function startRecordingFromZero() {
    isRecording = true; isRecordingPaused = false;
    const btn = document.getElementById('recordBtn'); btn.innerHTML = "🔴 REC STOP"; btn.classList.add('recording');
    const pauseBtn = document.getElementById('recordPauseBtn');
    if(pauseBtn) { pauseBtn.style.display = 'inline-block'; pauseBtn.innerHTML = "⏸ PAUSE"; pauseBtn.style.borderColor = ""; pauseBtn.style.color = ""; }
    
    editorScrollSec = 0; trackCurrentTime = 0;
    if (scWidget) { scWidget.seekTo(0); scWidget.play(); }
    isTrackPlaying = true; document.getElementById('editPlayBtn').innerHTML = "⏸ PAUSE AUDIO";
    triggerJudgeNotice("REC START", "var(--accent-pink)");
}

function pauseResumeRecording() {
    if (!isRecording) return;
    isRecordingPaused = !isRecordingPaused;
    const pauseBtn = document.getElementById('recordPauseBtn');
    if (isRecordingPaused) {
        if (scWidget) scWidget.pause(); isTrackPlaying = false;
        if(pauseBtn) { pauseBtn.innerHTML = "▶ RESUME"; pauseBtn.style.borderColor = "var(--accent-neon)"; pauseBtn.style.color = "var(--accent-neon)"; }
        triggerJudgeNotice("REC PAUSED", "#fff");
    } else {
        if (scWidget) { scWidget.seekTo(editorScrollSec * 1000); scWidget.play(); }
        isTrackPlaying = true; lastFrameTimestamp = performance.now();
        if(pauseBtn) { pauseBtn.innerHTML = "⏸ PAUSE"; pauseBtn.style.borderColor = ""; pauseBtn.style.color = ""; }
        triggerJudgeNotice("REC RESUMED", "var(--accent-pink)");
    }
}

function stopRecording() {
    isRecording = false; isRecordingPaused = false;
    const btn = document.getElementById('recordBtn'); btn.innerHTML = "🔴 REC START"; btn.classList.remove('recording');
    const pauseBtn = document.getElementById('recordPauseBtn'); if(pauseBtn) pauseBtn.style.display = 'none';
    
    for(let i=0; i<4; i++) finalizeRecordingNote(i);
    if (scWidget && isTrackPlaying) { scWidget.pause(); isTrackPlaying = false; }
    document.getElementById('editPlayBtn').innerHTML = "▶ PLAY/PAUSE"; triggerJudgeNotice("REC STOPPED", "#fff");
}

function toggleEditorAudio() {
    initAudio(); if(!scWidget) return;
    if(isTrackPlaying) {
        scWidget.pause(); isTrackPlaying = false; document.getElementById('editPlayBtn').innerText = "▶ PLAY/PAUSE";
        if (isRecording && !isRecordingPaused) pauseResumeRecording();
    } else {
        scWidget.seekTo(editorScrollSec * 1000); scWidget.play(); isTrackPlaying = true; lastFrameTimestamp = performance.now(); document.getElementById('editPlayBtn').innerText = "⏸ PAUSE AUDIO";
    }
}

function renderEditor() {
    eCtx.fillStyle = '#03030c'; eCtx.fillRect(0, 0, eCanvas.width, eCanvas.height);
    if (eCanvas.width === 0) return;

    const laneW = 80; const offsetX = Math.max((eCanvas.width - (laneW*4)) / 2, 50); const currentLineY = eCanvas.height - 150;

    if(isRecording && isTrackPlaying && !isRecordingPaused) {
        for(let i=0; i<4; i++) {
            if(recordingNotes[i]) {
                let calcTime = Math.round(editorScrollSec * 20) / 20;
                if(calcTime - recordingNotes[i].time > 0.25) { recordingNotes[i].isLong = true; recordingNotes[i].endTime = calcTime; }
            }
        }
    }

    for(let i=0; i<4; i++) {
        eCtx.strokeStyle = 'rgba(255,255,255,0.08)'; eCtx.strokeRect(offsetX + i*laneW, 0, laneW, eCanvas.height);
        if(isRecording && !isRecordingPaused && keysState[i]) { eCtx.fillStyle = 'rgba(0,240,255,0.12)'; eCtx.fillRect(offsetX + i*laneW, 0, laneW, eCanvas.height); }
    }

    let start = Math.max(0, editorScrollSec - (eCanvas.height - currentLineY)/pxPerSec);
    let end = editorScrollSec + currentLineY / pxPerSec;
    
    eCtx.beginPath(); eCtx.strokeStyle = 'rgba(255,255,255,0.08)';
    for(let t = Math.floor(start*10)/10; t<=end; t+=0.1) {
        let y = currentLineY - (t - editorScrollSec) * pxPerSec;
        if(y < 0 || y > eCanvas.height) continue;
        eCtx.moveTo(offsetX, y); eCtx.lineTo(offsetX + laneW*4, y);
    }
    eCtx.stroke();

    for(let t = Math.floor(start*10)/10; t<=end; t+=0.1) {
        let y = currentLineY - (t - editorScrollSec) * pxPerSec;
        if(y < 0 || y > eCanvas.height) continue;
        if(Math.abs(t % 1.0) < 0.01) {
            eCtx.beginPath(); eCtx.strokeStyle = '#fff'; eCtx.moveTo(offsetX, y); eCtx.lineTo(offsetX + laneW*4, y); eCtx.stroke();
            eCtx.fillStyle = '#fff'; eCtx.font = '10px "Press Start 2P"'; eCtx.fillText(t.toFixed(1) + "s", offsetX - 55, y + 4);
        }
    }

    eCtx.strokeStyle = isRecording && !isRecordingPaused ? '#ff0055' : 'var(--accent-neon)'; eCtx.lineWidth = 2;
    eCtx.beginPath(); eCtx.moveTo(offsetX - 20, currentLineY); eCtx.lineTo(offsetX + laneW*4 + 20, currentLineY); eCtx.stroke(); eCtx.lineWidth = 1;

    currentNotes.forEach(note => {
        let yStart = currentLineY - (note.time - editorScrollSec) * pxPerSec;
        
        if (note.type === 'effect') {
            if(yStart >= -20 && yStart <= eCanvas.height + 20) {
                if (note.action === 'flash') eCtx.fillStyle = '#fff';
                else if (note.action === 'shake') eCtx.fillStyle = '#ff0055';
                else if (note.action === 'flip') eCtx.fillStyle = '#ffaa00';
                eCtx.font = "bold 10px sans-serif";
                eCtx.fillText(`[${note.action.toUpperCase()}]`, offsetX + laneW*4 + 10, yStart + 4);
                eCtx.beginPath(); eCtx.arc(offsetX + laneW*4, yStart, 4, 0, Math.PI*2); eCtx.fill();
            } return;
        }

        let x = offsetX + note.lane * laneW;

        if (note.isLong && note.endTime) {
            let yEnd = currentLineY - (note.endTime - editorScrollSec) * pxPerSec;
            eCtx.fillStyle = note.type === 'fake' ? 'rgba(180,0,255,0.35)' : `rgba(0,240,255,0.35)`; 
            eCtx.fillRect(x + 20, yEnd, laneW - 40, yStart - yEnd);
        }
        if(yStart >= -20 && yStart <= eCanvas.height + 20) {
            if(note.type === 'fake') {
                eCtx.fillStyle = '#b400ff';
                eCtx.beginPath(); eCtx.moveTo(x+laneW/2, yStart-4); eCtx.lineTo(x+laneW/2+8, yStart); eCtx.lineTo(x+laneW/2, yStart+4); eCtx.lineTo(x+laneW/2-8, yStart); eCtx.fill();
            } else {
                eCtx.fillStyle = '#fff'; eCtx.fillRect(x + 6, yStart - 4, laneW - 12, 8);
            }
        }
    });
}

function editorLoop() {
    if (activeScreen === 'editor') {
        renderEditor();
        requestAnimationFrame(editorLoop);
    }
}

function finalizeRecordingNote(lane) {
    if (recordingNotes[lane]) { 
        currentNotes.sort((a,b) => a.time - b.time); 
        recordingNotes[lane] = null; 
        saveToGlobalChart(); 
    }
}

function clearCurrentChart() { if(confirm("譜面データ（演出含む）を全消去しますか？")) { currentNotes.splice(0, currentNotes.length); saveToGlobalChart(); } }

function tryTestPlay() {
    if(currentNotes.length === 0) { alert("ノーツがありません。"); return; }
    testPlayMode = true;
    currentNotes.forEach(n => { n.hit = false; n.missed = false; n.isHolding = false; n.hitEnd = false; n.played = false; });
    gameScore = 0; gameCombo = 0; maxCombo = 0; grooveGauge = 80; countPerf = 0; countGreat = 0; countGood = 0; countMiss = 0;
    hitEffects = []; particles = []; trackCurrentTime = 0; isGamePaused = false;
    document.getElementById('autoplay-badge').style.display = 'block'; document.getElementById('autoplay-badge').innerText = "TEST PLAY";
    changeScreen('game');
    resizeGameCanvas();
    updateHUD();
    if(scWidget) { scWidget.seekTo(0); scWidget.play(); } isTrackPlaying = true; lastFrameTimestamp = performance.now();
}

let currentIoMode = 'export';
function openExportModal() { currentIoMode = 'export'; document.getElementById('ioModalTitle').innerText = "EXPORT"; document.getElementById('io-action-btn').innerText = "COPY"; document.getElementById('io-textarea').value = JSON.stringify(currentNotes); document.getElementById('chart-io-modal').classList.add('show'); }
function openImportModal() { currentIoMode = 'import'; document.getElementById('ioModalTitle').innerText = "IMPORT"; document.getElementById('io-action-btn').innerText = "IMPORT"; document.getElementById('io-textarea').value = ""; document.getElementById('chart-io-modal').classList.add('show'); }
function closeIoModal() { document.getElementById('chart-io-modal').classList.remove('show'); }
function executeIoAction() {
    if (currentIoMode === 'export') { document.getElementById('io-textarea').select(); document.execCommand('copy'); alert("コピーしました"); closeIoModal();
    } else { try { const parsed = JSON.parse(document.getElementById('io-textarea').value); if(Array.isArray(parsed)) { currentNotes.splice(0, currentNotes.length, ...parsed); currentNotes.sort((a,b) => a.time - b.time); saveToGlobalChart(); alert("インポートしました"); closeIoModal(); } } catch(e) { alert("JSON解析エラー"); } }
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.tab-btn[onclick="switchTab('${tabId}')"]`).classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
}

function openHelpModal() { document.getElementById('help-modal').classList.add('show'); }
function closeHelpModal() { document.getElementById('help-modal').classList.remove('show'); }

function openSettingsModal() { 
    buildSpeedControls(); 
    document.getElementById('set-username').value = userProfile.username || '';
    document.getElementById('set-displayname').value = userProfile.displayName || '';
    document.getElementById('set-avatarurl').value = userProfile.avatarUrl || '';
    document.getElementById('stat-playcount').innerText = userProfile.playCount || 0;
    document.getElementById('stat-totalscore').innerText = (userProfile.totalScore || 0).toLocaleString();
    
    document.getElementById('offset-input').value = audioOffset;
    document.getElementById('effect-select').value = userProfile.showEffects !== false ? 'on' : 'off';
    
    document.getElementById('theme-select').value = userProfile.theme || 'cyber';
    document.getElementById('noteskin-select').value = userProfile.noteSkin || 'classic';
    document.getElementById('bganim-select').value = userProfile.bgAnim !== false ? 'on' : 'off';
    document.getElementById('vol-slider').value = masterVolume;
    document.getElementById('vol-disp').innerText = masterVolume;
    document.getElementById('se-vol-slider').value = seVolume;
    document.getElementById('se-vol-disp').innerText = seVolume;
    
    document.getElementById('mirror-select').value = userProfile.mirror || 'off';
    document.getElementById('random-select').value = userProfile.random || 'off';
    document.getElementById('judge-pos-slider').value = userProfile.judgePosition || 600;
    document.getElementById('judge-pos-disp').innerText = userProfile.judgePosition || 600;
    document.getElementById('earlylate-select').value = userProfile.showEarlyLate || 'on';
    document.getElementById('lanecover-select').value = userProfile.laneCover || 'off';
    document.getElementById('shake-select').value = userProfile.enableShake || 'on';
    document.getElementById('flash-select').value = userProfile.enableFlash || 'on';

    previewTheme();
    updateKeyBindUI();
    switchTab('profile'); document.getElementById('settings-modal').classList.add('show'); 
}

function closeSettingsModal() { 
    userProfile.username = document.getElementById('set-username').value.trim();
    userProfile.displayName = document.getElementById('set-displayname').value.trim();
    userProfile.avatarUrl = document.getElementById('set-avatarurl').value.trim();
    userProfile.showEffects = document.getElementById('effect-select').value === 'on';
    userProfile.theme = document.getElementById('theme-select').value;
    userProfile.noteSkin = document.getElementById('noteskin-select').value;
    userProfile.bgAnim = document.getElementById('bganim-select').value === 'on';
    
    userProfile.mirror = document.getElementById('mirror-select').value;
    userProfile.random = document.getElementById('random-select').value;
    userProfile.showEarlyLate = document.getElementById('earlylate-select').value;
    userProfile.laneCover = document.getElementById('lanecover-select').value;
    userProfile.enableShake = document.getElementById('shake-select').value;
    userProfile.enableFlash = document.getElementById('flash-select').value;

    audioOffset = parseFloat(document.getElementById('offset-input').value) || 0.00;
    
    saveProfileToLocal(); applyProfileUI(); applyTheme(userProfile.theme); toggleBgAnim(userProfile.bgAnim);
    document.getElementById('settings-modal').classList.remove('show'); 
}

function buildSpeedControls() {
    const container = document.getElementById('speed-controls'); container.innerHTML = "";
    [1.0, 2.0, 3.0, 4.0, 5.0].forEach(spd => {
        const btn = document.createElement('button'); btn.className = `sys-btn ${systemNoteSpeed === spd ? 'active' : ''}`;
        if(systemNoteSpeed === spd) { btn.style.background = '#fff'; btn.style.color = '#000'; }
        btn.innerText = spd.toFixed(1) + "x"; btn.onclick = () => { systemNoteSpeed = spd; buildSpeedControls(); }; container.appendChild(btn);
    });
}

let bindingLane = -1;
function startKeyBind(lane) { bindingLane = lane; updateKeyBindUI(); }
function updateKeyBindUI() {
    for(let i=0; i<4; i++) {
        const btn = document.getElementById(`key-bind-${i}`);
        if(btn) {
            if(bindingLane === i) { btn.innerText = "WAIT"; btn.classList.add('waiting'); }
            else { btn.innerText = userKeys[i].toUpperCase(); btn.classList.remove('waiting'); }
        }
    }
}

function engineLoop() {
    const now = performance.now(); const delta = (now - lastFrameTimestamp) / 1000; lastFrameTimestamp = now;

    if(isTrackPlaying && !isGamePaused) {
        let prevEdTime = editorScrollSec;
        if(activeScreen === 'game') trackCurrentTime += delta;
        if(activeScreen === 'editor') editorScrollSec += delta; 

        if (activeScreen === 'editor' && isAssistTick) {
            let hitTick = false;
            currentNotes.forEach(note => { if (note.type !== 'effect' && note.time > prevEdTime && note.time <= editorScrollSec) hitTick = true; });
            if (hitTick) playTickSound();
        }
    }

    const timeDisp = document.getElementById('editorTimeDisp');
    if (timeDisp && activeScreen === 'editor') {
        const m = Math.floor(editorScrollSec / 60).toString().padStart(2, '0');
        const s = (editorScrollSec % 60).toFixed(2).padStart(5, '0');
        timeDisp.innerText = `${m}:${s}`;
    }

    if (activeScreen === 'game') renderGame();
    if (activeScreen === 'editor') renderEditor();
    requestAnimationFrame(engineLoop);
}

// ==========================================
// 初期化 & SoundCloud API バインド
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    initAccountSystem();
    
    const iframe = document.getElementById('sc-player');
    if (iframe && typeof SC !== 'undefined' && SC.Widget) {
        scWidget = SC.Widget(iframe);
        scWidget.bind(SC.Widget.Events.READY, () => {
            scWidget.setVolume(masterVolume);
            if (window.songList && window.songList.length > 0) {
                selectSong(0);
            }
        });
        scWidget.bind(SC.Widget.Events.PLAY_PROGRESS, (data) => {
            if (isTrackPlaying && !isGamePaused) {
                let sec = data.currentPosition / 1000;
                if (activeScreen === 'game') trackCurrentTime = sec;
                if (activeScreen === 'editor' && isTrackPlaying) editorScrollSec = sec;
            }
        });
        scWidget.bind(SC.Widget.Events.FINISH, () => {
            isTrackPlaying = false;
            if (activeScreen === 'game') finishGame();
        });
    } else {
        if (window.songList && window.songList.length > 0) {
            selectSong(0);
        }
    }
});

// ==========================================
// エディタ用 マウス / ホイール イベントリスナー
// ==========================================
if (eCanvas) {
    eCanvas.addEventListener('mousedown', (e) => {
        if (activeScreen !== 'editor') return;
        const rect = eCanvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const laneW = 80;
        const offsetX = Math.max((eCanvas.width - (laneW * 4)) / 2, 50);
        const currentLineY = eCanvas.height - 150;

        const lane = Math.floor((clickX - offsetX) / laneW);
        if (lane >= 0 && lane < 4) {
            let noteTime = editorScrollSec + (currentLineY - clickY) / pxPerSec;
            if (gridSnapSec > 0) {
                noteTime = Math.round(noteTime / gridSnapSec) * gridSnapSec;
            }
            noteTime = Math.max(0, Math.round(noteTime * 100) / 100);

            const existingIdx = currentNotes.findIndex(n => n.lane === lane && Math.abs(n.time - noteTime) < 0.05);
            if (existingIdx !== -1) {
                currentNotes.splice(existingIdx, 1);
            } else {
                currentNotes.push({ lane: lane, time: noteTime, isLong: false });
                currentNotes.sort((a, b) => a.time - b.time);
            }
            saveToGlobalChart();
        }
    });

    eCanvas.addEventListener('wheel', (e) => {
        if (activeScreen !== 'editor') return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        editorScrollSec = Math.max(0, editorScrollSec + delta);
        if (scWidget && !isTrackPlaying) {
            scWidget.seekTo(editorScrollSec * 1000);
        }
    }, { passive: false });
}

// ==========================================
// キー入力判定リスナー (ゲーム & エディタ)
// ==========================================
window.addEventListener('keydown', (e) => {
    // 1. キーバインド設定時
    if (bindingLane !== -1 && document.getElementById('settings-modal').classList.contains('show')) {
        e.preventDefault(); 
        userKeys[bindingLane] = e.key.toLowerCase(); 
        bindingLane = -1; 
        updateKeyBindUI(); 
        return;
    }

    // 2. ESCキー (中断/終了)
    if (e.key === 'Escape') {
        if (['game', 'editor'].includes(activeScreen)) { 
            e.preventDefault(); 
            triggerQuitToSelect(); 
            return; 
        }
    }
    
    // 3. ゲームポーズ
    if (e.key === 'Enter' && activeScreen === 'game') { 
        e.preventDefault(); 
        toggleGamePause(); 
        return; 
    }
    
    // 4. ゲーム内ハイスピード調整
    if (activeScreen === 'game') {
        if (e.key === '+' || e.key === ';') { 
            systemNoteSpeed = Math.min(5.0, systemNoteSpeed + 0.1); 
            triggerJudgeNotice(`SPEED: ${systemNoteSpeed.toFixed(1)}`, "var(--accent-neon)"); 
            return; 
        }
        if (e.key === '-') { 
            systemNoteSpeed = Math.max(1.0, systemNoteSpeed - 0.1); 
            triggerJudgeNotice(`SPEED: ${systemNoteSpeed.toFixed(1)}`, "var(--accent-neon)"); 
            return; 
        }
    }

    // モーダル表示中は各種ショートカットを無効化 (ポーズ画面除く)
    if (document.querySelector('.modal-base.show') && !document.getElementById('pause-overlay').classList.contains('show')) return;

    const k = e.key.toLowerCase();
    
    // 選曲画面の矢印キー操作
    if (activeScreen === 'select') {
        if (e.key === 'ArrowUp') { 
            e.preventDefault(); 
            if (currentSongIndex > 0) selectSong(currentSongIndex - 1); 
        } else if (e.key === 'ArrowDown') { 
            e.preventDefault(); 
            if (currentSongIndex < window.songList.length - 1) selectSong(currentSongIndex + 1); 
        } else if (e.key === 'Enter') { 
            e.preventDefault(); 
            const startBtn = document.getElementById('startPlayBtn');
            if (startBtn && !startBtn.disabled) startGame();
        }
        return;
    }

    // レーンキー割り当て取得
    const keyMap = getKeyMapping();
    const lane = keyMap[k];

    // ゲーム画面でのレーン打鍵
    if (activeScreen === 'game' && lane !== undefined) {
        if (!keysState[lane]) {
            keysState[lane] = true;
            if (!isAutoPlay) {
                executeHitJudgment(lane);
            }
        }
    }

    // エディタ画面での操作
    if (activeScreen === 'editor') {
        if (e.code === 'Space') {
            e.preventDefault();
            toggleEditorAudio();
        } else if (lane !== undefined) {
            if (!keysState[lane]) {
                keysState[lane] = true;
                if (isRecording && !isRecordingPaused) {
                    let snapTime = Math.round(editorScrollSec / gridSnapSec) * gridSnapSec;
                    if (isNaN(snapTime)) snapTime = editorScrollSec;
                    recordingNotes[lane] = { lane: lane, time: snapTime, isLong: false };
                    currentNotes.push(recordingNotes[lane]);
                }
            }
        }
    }
});

window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    const keyMap = getKeyMapping();
    const lane = keyMap[k];

    if (lane !== undefined) {
        keysState[lane] = false;
        if (activeScreen === 'game' && !isAutoPlay) {
            executeReleaseJudgment(lane);
        }
        if (activeScreen === 'editor' && isRecording) {
            finalizeRecordingNote(lane);
        }
    }
});