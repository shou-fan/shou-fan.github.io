// 大厅页：未登录显示选人/建档，登录后显示 30 关地图
(function () {
    renderNav('hall');
    const cur = Storage.current();
    if (!cur) { renderGuestGate(); return; }
    renderMap();
})();

let _selectedPid = null;

function renderGuestGate() {
    document.getElementById('hallContent').innerHTML = `
    <div class="login-card">
        <h1>开始闯关</h1>
        <p class="subtitle" style="text-align:center">创建账户或选一个已有账户</p>
        <ul class="player-list" id="playerList"></ul>
        <div style="display:flex;gap:8px;margin-bottom:12px">
            <button class="btn btn-primary" onclick="showCreate()">+ 新建账户</button>
            <button class="btn" onclick="guest()">游客模式</button>
        </div>
        <div id="createBox" style="display:none">
            <input id="newName" placeholder="用户名"/>
            <input id="newPin" placeholder="PIN (≥4 位数字)" type="number"/>
            <button class="btn btn-primary" onclick="submitCreate()">创建并进入</button>
        </div>
        <div id="pinBox" style="display:none">
            <p style="font-size:13px;color:#7f8c8d">请输入所选账户的 PIN：</p>
            <input id="loginPin" placeholder="PIN" type="number"/>
            <button class="btn btn-primary" onclick="submitLogin()">登录</button>
        </div>
    </div>`;
    const list = document.getElementById('playerList');
    const players = Storage.listPlayers();
    list.innerHTML = players.length
        ? players.map(p => `<li onclick="selectPlayer('${p.pid}')">${p.name}${p.isGuest ? ' (游客)' : ''}</li>`).join('')
        : '<li style="cursor:default;color:#95a5a6">还没有账户</li>';
}
function showCreate() { document.getElementById('createBox').style.display = 'block'; }
function selectPlayer(pid) { _selectedPid = pid; document.getElementById('pinBox').style.display = 'block'; }
function submitLogin() {
    try { Storage.login(_selectedPid, document.getElementById('loginPin').value); location.reload(); }
    catch (e) { showToast(e.message, 'err'); }
}
function submitCreate() {
    try { Storage.createUser(document.getElementById('newName').value, document.getElementById('newPin').value); location.reload(); }
    catch (e) { showToast(e.message, 'err'); }
}
function guest() { Storage.loginAsGuest(); location.reload(); }

function renderMap() {
    const cur = Storage.current();
    const best = cur.bestStars;
    const segs = [
        { name: '简单段 · 一位数 · 5 分钟 · 20 题',  range: [1, 10] },
        { name: '中等段 · 两位数 · 4 分钟 · 20 题',  range: [11, 20] },
        { name: '困难段 · 三位数 · 3 分钟 · 20 题',  range: [21, 30] },
    ];
    const parts = [`<h1>关卡地图</h1>`,
        `<p class="subtitle">通关上一关 ≥1★ 即解锁下一关；金币按历史最高星级的差额发放（1★=20，升到 2★补 30，升到 3★再补 40）。无限次重玩。</p>`];
    segs.forEach(seg => {
        const arr = [];
        for (let i = seg.range[0]; i <= seg.range[1]; i++) {
            const stars = best[i - 1] || 0;
            const unlocked = isUnlocked(i, best);
            arr.push(`<button class="level-btn ${unlocked ? '' : 'locked'}" onclick="enterLevel(${i}, ${unlocked})">
                <div class="lid">${i}</div>
                <div class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
            </button>`);
        }
        parts.push(`<div class="segment"><h2>${seg.name}</h2><div class="level-map">${arr.join('')}</div></div>`);
    });
    document.getElementById('hallContent').innerHTML = parts.join('');
}

function enterLevel(id, unlocked) {
    if (!unlocked) { showToast('先通过上一关！', 'err'); return; }
    location.href = 'play.html?level=' + id;
}
