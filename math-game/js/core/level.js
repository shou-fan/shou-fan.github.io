// 30 关配置表：每 10 关一档（easy/medium/hard），段内用「运算符集合 → 括号比例 → 0 配额」递增难度。
// 结构：id, segment, digits, count, timeLimit(秒), minNum, maxNum, cap(中间结果上限), opSet, parenPercent, zeroQuota

const OP_PLUS_MINUS = [0, 1];
const OP_PM_MUL     = [0, 1, 2];
const OP_ALL        = [0, 1, 2, 3];

const LEVELS = [];

function _fill(startId, seg, base, ramp) {
    for (let i = 0; i < 10; i++) {
        const r = ramp[i];
        LEVELS.push(Object.assign({ id: startId + i, segment: seg }, base, r));
    }
}

_fill(1, 'easy', { digits: 1, count: 20, timeLimit: 300, minNum: 1, cap: 99 }, [
    { maxNum: 5,   opSet: OP_PLUS_MINUS, parenPercent: 0,  zeroQuota: 0 },
    { maxNum: 7,   opSet: OP_PLUS_MINUS, parenPercent: 0,  zeroQuota: 0 },
    { maxNum: 9,   opSet: OP_PM_MUL,     parenPercent: 0,  zeroQuota: 0 },
    { maxNum: 9,   opSet: OP_PM_MUL,     parenPercent: 0,  zeroQuota: 0 },
    { maxNum: 9,   opSet: OP_ALL,        parenPercent: 0,  zeroQuota: 0 },
    { maxNum: 9,   opSet: OP_ALL,        parenPercent: 10, zeroQuota: 0 },
    { maxNum: 9,   opSet: OP_ALL,        parenPercent: 10, zeroQuota: 1 },
    { maxNum: 9,   opSet: OP_ALL,        parenPercent: 20, zeroQuota: 2 },
    { maxNum: 9,   opSet: OP_ALL,        parenPercent: 20, zeroQuota: 3 },
    { maxNum: 9,   opSet: OP_ALL,        parenPercent: 30, zeroQuota: 3 },
]);
_fill(11, 'medium', { digits: 2, count: 20, timeLimit: 240, minNum: 10, cap: 999 }, [
    { maxNum: 30,  opSet: OP_PLUS_MINUS, parenPercent: 0,  zeroQuota: 0 },
    { maxNum: 50,  opSet: OP_PLUS_MINUS, parenPercent: 0,  zeroQuota: 0 },
    { maxNum: 70,  opSet: OP_PM_MUL,     parenPercent: 0,  zeroQuota: 0 },
    { maxNum: 90,  opSet: OP_PM_MUL,     parenPercent: 0,  zeroQuota: 0 },
    { maxNum: 99,  opSet: OP_ALL,        parenPercent: 0,  zeroQuota: 0 },
    { maxNum: 99,  opSet: OP_ALL,        parenPercent: 10, zeroQuota: 0 },
    { maxNum: 99,  opSet: OP_ALL,        parenPercent: 10, zeroQuota: 1 },
    { maxNum: 99,  opSet: OP_ALL,        parenPercent: 20, zeroQuota: 2 },
    { maxNum: 99,  opSet: OP_ALL,        parenPercent: 20, zeroQuota: 3 },
    { maxNum: 99,  opSet: OP_ALL,        parenPercent: 40, zeroQuota: 3 },
]);
_fill(21, 'hard', { digits: 3, count: 20, timeLimit: 180, minNum: 100, cap: 9999 }, [
    { maxNum: 300, opSet: OP_PLUS_MINUS, parenPercent: 0,  zeroQuota: 0 },
    { maxNum: 500, opSet: OP_PLUS_MINUS, parenPercent: 0,  zeroQuota: 0 },
    { maxNum: 700, opSet: OP_PM_MUL,     parenPercent: 0,  zeroQuota: 0 },
    { maxNum: 900, opSet: OP_PM_MUL,     parenPercent: 0,  zeroQuota: 0 },
    { maxNum: 999, opSet: OP_ALL,        parenPercent: 0,  zeroQuota: 0 },
    { maxNum: 999, opSet: OP_ALL,        parenPercent: 10, zeroQuota: 0 },
    { maxNum: 999, opSet: OP_ALL,        parenPercent: 10, zeroQuota: 1 },
    { maxNum: 999, opSet: OP_ALL,        parenPercent: 20, zeroQuota: 2 },
    { maxNum: 999, opSet: OP_ALL,        parenPercent: 30, zeroQuota: 3 },
    { maxNum: 999, opSet: OP_ALL,        parenPercent: 50, zeroQuota: 3 },
]);

function getLevel(id) { return LEVELS.find(l => l.id === id); }

// bestStars 是长度 30 的数组，bestStars[i] 表示第 (i+1) 关的历史最高星级
function isUnlocked(id, bestStars) {
    if (id <= 1) return true;
    return (bestStars[id - 2] || 0) >= 1;
}

// 用时 → 星级：≤30% 时限=3★, ≤50%=2★, ≤100%=1★, 超时=0★
function starFor(elapsedSec, timeLimit) {
    if (elapsedSec >= timeLimit) return 0;
    const r = elapsedSec / timeLimit;
    if (r <= 0.3) return 3;
    if (r <= 0.5) return 2;
    return 1;
}

// 星级 → 累计金币（1★=20, 2★=50, 3★=90），本次发奖 = 新累计 − 历史累计
const CUMULATIVE_COINS = [0, 20, 50, 90];
function coinDelta(prevStars, newStars) {
    if (newStars <= prevStars) return 0;
    return CUMULATIVE_COINS[newStars] - CUMULATIVE_COINS[prevStars];
}
