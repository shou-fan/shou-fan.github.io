// 数据层：P1 全走 localStorage；P2 起把每个方法改成 LeanCloud 调用，UI 代码不动。
const STORAGE_KEY = 'mathgame.v1';

function _loadAll() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { players: {}, currentPid: null };
        return JSON.parse(raw);
    } catch (e) { return { players: {}, currentPid: null }; }
}
function _saveAll(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function _hashPin(pin) {
    const s = String(pin || '') + '::mg';
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
}
function _newPid() {
    return 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

const Storage = {
    createUser(name, pin) {
        name = (name || '').trim(); pin = String(pin || '').trim();
        if (!name || !pin) throw new Error('用户名和 PIN 必填');
        if (pin.length < 4) throw new Error('PIN 至少 4 位');
        const state = _loadAll();
        if (Object.values(state.players).some(p => p.name === name)) throw new Error('用户名已存在');
        const pid = _newPid();
        state.players[pid] = {
            pid, name, pinHash: _hashPin(pin),
            avatar: 'default', theme: 'default',
            coins: 0, itemsOwned: {}, skinsOwned: ['default'], skinEquipped: 'default',
            bestStars: new Array(30).fill(0),
            createdAt: new Date().toISOString(),
        };
        state.currentPid = pid;
        _saveAll(state);
        return state.players[pid];
    },
    login(pid, pin) {
        const s = _loadAll();
        const p = s.players[pid];
        if (!p) throw new Error('账户不存在');
        if (p.pinHash !== _hashPin(pin)) throw new Error('PIN 错误');
        s.currentPid = pid; _saveAll(s); return p;
    },
    loginAsGuest() {
        const s = _loadAll();
        const pid = _newPid();
        s.players[pid] = {
            pid, name: '游客', isGuest: true,
            avatar: 'default', theme: 'default',
            coins: 0, itemsOwned: {}, skinsOwned: ['default'], skinEquipped: 'default',
            bestStars: new Array(30).fill(0),
            createdAt: new Date().toISOString(),
        };
        s.currentPid = pid; _saveAll(s); return s.players[pid];
    },
    logout() { const s = _loadAll(); s.currentPid = null; _saveAll(s); },
    current() { const s = _loadAll(); return s.currentPid ? s.players[s.currentPid] : null; },
    listPlayers() {
        const s = _loadAll();
        return Object.values(s.players).map(p => ({ pid: p.pid, name: p.name, isGuest: !!p.isGuest }));
    },
    // 结算：返回 { coinDelta, prevStars, stars, isNewBest }
    submitResult(pid, levelId, stars, elapsedSec, flagged) {
        const s = _loadAll(); const p = s.players[pid];
        if (!p) throw new Error('账户不存在');
        const idx = levelId - 1;
        const prev = p.bestStars[idx] || 0;
        const newBest = flagged ? prev : Math.max(prev, stars);
        p.bestStars[idx] = newBest;
        const delta = flagged ? 0 : (CUMULATIVE_COINS[newBest] - CUMULATIVE_COINS[prev]);
        p.coins = (p.coins || 0) + delta;
        s.players[pid] = p; _saveAll(s);
        return { coinDelta: delta, prevStars: prev, stars, isNewBest: newBest > prev };
    },
    clearAll() { localStorage.removeItem(STORAGE_KEY); },
};
