// 口算出题核心：相比 homepage/quiz.js，参数化「位数档 + 运算符集合 + 括号比例 + 中间结果上限 + 0 配额」。
// 生成规则（与原 C++ mathgen 一致）：
//   1. 3 数 2 符；2. 每步结果非负且不超上限；3. 除法整除、除数非 0；
//   4. 标准优先级；5. 算式去重；6. 括号必须真正改变结果；7. 0 出现受配额限制。

const OP_SYMBOL = ["+", "-", "\u00d7", "\u00f7"];
const MAX_GEN_ATTEMPTS = 500000;

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function precedence(op) { return op >= 2 ? 2 : 1; }

function applyOp(x, op, y, cap) {
    let r;
    switch (op) {
        case 0: r = x + y; break;
        case 1: r = x - y; break;
        case 2: r = x * y; break;
        case 3:
            if (y === 0 || x % y !== 0) return null;
            r = x / y; break;
        default: return null;
    }
    if (r < 0 || r > cap) return null;
    return r;
}

function evalNatural(a, op1, b, op2, c, cap) {
    if (precedence(op1) >= precedence(op2)) {
        const t = applyOp(a, op1, b, cap); if (t === null) return null;
        return applyOp(t, op2, c, cap);
    } else {
        const t = applyOp(b, op2, c, cap); if (t === null) return null;
        return applyOp(a, op1, t, cap);
    }
}

function makeOne(cfg) {
    const { minNum, maxNum, cap, opSet, wantParen } = cfg;
    const a = randInt(minNum, maxNum);
    const b = randInt(minNum, maxNum);
    const c = randInt(minNum, maxNum);
    const op1 = opSet[randInt(0, opSet.length - 1)];
    const op2 = opSet[randInt(0, opSet.length - 1)];
    let text, result;
    if (!wantParen) {
        result = evalNatural(a, op1, b, op2, c, cap);
        if (result === null) return null;
        text = `${a} ${OP_SYMBOL[op1]} ${b} ${OP_SYMBOL[op2]} ${c}`;
    } else {
        const leftGroup = precedence(op1) < precedence(op2);
        if (leftGroup) {
            const t = applyOp(a, op1, b, cap); if (t === null) return null;
            result = applyOp(t, op2, c, cap); if (result === null) return null;
            text = `(${a} ${OP_SYMBOL[op1]} ${b}) ${OP_SYMBOL[op2]} ${c}`;
        } else {
            if (op1 === 0 || op1 === 2) return null;
            const t = applyOp(b, op2, c, cap); if (t === null) return null;
            result = applyOp(a, op1, t, cap); if (result === null) return null;
            text = `${a} ${OP_SYMBOL[op1]} (${b} ${OP_SYMBOL[op2]} ${c})`;
        }
        const natural = evalNatural(a, op1, b, op2, c, cap);
        if (natural !== null && natural === result) return null;
    }
    return { text, answer: result, hasZero: (a === 0 || b === 0 || c === 0) };
}

// 生成一批；levelCfg 来自 core/level.js。返回 [{ text, answer, seed }]
function generateBatch(levelCfg) {
    const { count, minNum, maxNum, cap, opSet, parenPercent, zeroQuota } = levelCfg;
    const out = [];
    const used = new Set();
    let zeroCount = 0, attempts = 0;
    while (out.length < count && attempts < MAX_GEN_ATTEMPTS) {
        attempts++;
        const wantParen = randInt(0, 99) < parenPercent;
        const e = makeOne({ minNum, maxNum, cap, opSet, wantParen });
        if (!e) continue;
        if (used.has(e.text)) continue;
        used.add(e.text);
        if (e.hasZero && zeroCount >= zeroQuota) continue;
        if (e.hasZero) zeroCount++;
        e.seed = 'q' + Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36);
        out.push({ text: e.text, answer: e.answer, seed: e.seed });
    }
    return out;
}
