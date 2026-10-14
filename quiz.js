/* ============================================
   口算题生成（mathgen.cpp 的网页版）
   —— 忠实移植 C++ 版的全部生成规则，生成后下载为 txt 文件。

   规则（与 mathgen.cpp 一致）：
   1. 每个算式含 3 个数字和 2 个运算符(+ - × ÷)。
   2. 参与运算的每个数字、每一步中间结果、最终结果都满足 0 <= 值 <= 100。
   3. 除法必须整除，且除数不为 0。
   4. 按标准数学优先级计算(先乘除, 后加减)。
   5. 算式不重复(去重)。
   6. 部分算式带括号，括号必须真正改变运算顺序，且结果与不加括号时不同(排除冗余括号)。
   7. 含数字 0 的题目受配额限制(每 100 道最多 3 道)。
   ============================================ */

// ---------------- 可修改参数（对应 mathgen.cpp 顶部常量） ----------------
const MIN_VALUE = 0;             // 数字最小值
const MAX_VALUE = 100;           // 数字 / 中间结果 / 最终结果的最大值
const MAX_ATTEMPTS = 1000000;    // 生成尝试上限，防止死循环
const ZERO_QUOTA_PER_100 = 3;    // 每 100 道题中，最多允许多少道出现数字 0
const PAREN_PERCENT = 30;        // 带括号题目所占百分比

// 运算符编码: 0='+', 1='-', 2='×', 3='÷'
const OP_SYMBOL = ["+", "-", "\u00d7", "\u00f7"];

// 生成 [min, max] 区间内的随机整数
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 运算符优先级：乘除(2) 高于 加减(1)
function precedence(op) {
    return op >= 2 ? 2 : 1;
}

// 对 x op y 求值；非法(除零/不整除)或越界(负数/大于 MAX_VALUE)返回 null（对应 apply）
function apply(x, op, y) {
    let out;
    switch (op) {
        case 0: out = x + y; break;
        case 1: out = x - y; break;
        case 2: out = x * y; break;
        case 3:
            if (y === 0 || x % y !== 0) return null;  // 除数为 0 或不能整除
            out = x / y;
            break;
        default: return null;
    }
    if (out < 0 || out > MAX_VALUE) return null;
    return out;
}

// 按标准优先级计算 a op1 b op2 c；任意一步越界或非法返回 null（对应 evaluate）
function evaluate(a, op1, b, op2, c) {
    if (precedence(op1) >= precedence(op2)) {
        const t = apply(a, op1, b);           // 先算左侧 (a op1 b) op2 c
        if (t === null) return null;
        return apply(t, op2, c);
    } else {
        const t = apply(b, op2, c);           // 先算右侧 a op1 (b op2 c)
        if (t === null) return null;
        return apply(a, op1, t);
    }
}

// 随机生成一个满足全部规则的算式；wantParen=true 时生成带括号的算式（对应 makeExpression）
// 成功返回 { text, value, hasZero }，失败返回 null
function makeExpression(wantParen) {
    const a = randInt(MIN_VALUE, MAX_VALUE);
    const b = randInt(MIN_VALUE, MAX_VALUE);
    const c = randInt(MIN_VALUE, MAX_VALUE);
    const op1 = randInt(0, 3);
    const op2 = randInt(0, 3);

    let result;
    let text;

    if (!wantParen) {
        // 不带括号：按默认优先级求值
        result = evaluate(a, op1, b, op2, c);
        if (result === null) return null;
        text = `${a} ${OP_SYMBOL[op1]} ${b} ${OP_SYMBOL[op2]} ${c}`;
    } else {
        // 带括号：选择与默认优先级相反的分组，使括号真正改变运算顺序
        const leftGroup = precedence(op1) < precedence(op2);
        if (leftGroup) {
            // 默认先算右侧，故给左侧加括号 (a op1 b) op2 c
            const t = apply(a, op1, b);
            if (t === null) return null;
            result = apply(t, op2, c);
            if (result === null) return null;
            text = `(${a} ${OP_SYMBOL[op1]} ${b}) ${OP_SYMBOL[op2]} ${c}`;
        } else {
            // 默认先算左侧，故给右侧加括号 a op1 (b op2 c)
            // 若 op1 为 '+' 或 '×'，由结合律括号不改变结果，属冗余，丢弃
            if (op1 === 0 || op1 === 2) return null;
            const t = apply(b, op2, c);
            if (t === null) return null;
            result = apply(a, op1, t);
            if (result === null) return null;
            text = `${a} ${OP_SYMBOL[op1]} (${b} ${OP_SYMBOL[op2]} ${c})`;
        }
        // 冗余括号检查：若与默认优先级结果相同，说明括号没有实际作用，丢弃
        const natural = evaluate(a, op1, b, op2, c);
        if (natural !== null && natural === result) return null;
    }

    return { text, value: result, hasZero: (a === 0 || b === 0 || c === 0) };
}

// 生成 count 道不重复题目（对应 main 的生成循环）
function generateQuestions(count) {
    const questions = [];
    const used = new Set();                                  // 算式去重
    const maxZeroAllowed = Math.floor(count * ZERO_QUOTA_PER_100 / 100);
    let zeroCount = 0;
    let attempts = 0;

    while (questions.length < count && attempts < MAX_ATTEMPTS) {
        attempts++;
        const wantParen = randInt(0, 99) < PAREN_PERCENT;    // 决定本题是否带括号
        const e = makeExpression(wantParen);
        if (!e) continue;                                    // 不满足规则，重试
        if (used.has(e.text)) continue;                      // 已存在，重试
        used.add(e.text);
        if (e.hasZero && zeroCount >= maxZeroAllowed) continue;  // 含 0 超额，丢弃
        if (e.hasZero) zeroCount++;
        questions.push(e);
    }
    return questions;
}

// 拼装 txt 文本（输出格式与 mathgen.cpp 一致：题目每行 1 个，答案每行 5 个）
function buildText(questions, withAnswer) {
    let out = "";
    out += `===== 题目 (共 ${questions.length} 道) =====\n`;
    questions.forEach((q, i) => {
        out += `${String(i + 1).padStart(3, " ")}) ${q.text} =\n`;
    });

    if (withAnswer) {
        out += `\n===== 答案 =====\n`;
        questions.forEach((q, i) => {
            out += `${String(i + 1).padStart(3, " ")}) ${String(q.value).padStart(4, " ")}`;
            // 每 5 个换行，最后一个也换行
            if ((i + 1) % 5 === 0 || i + 1 === questions.length) out += "\n";
            else out += "  ";
        });
    }
    return out;
}

// 触发浏览器下载 txt 文件
function downloadTxt(content, filename) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);   // 释放临时 URL
}

// ---------------- 页面交互绑定 ----------------
document.addEventListener("DOMContentLoaded", () => {
    const countInput = document.getElementById("quizCount");
    const answerBox  = document.getElementById("quizWithAnswer");
    const genBtn     = document.getElementById("quizGen");
    const statusEl   = document.getElementById("quizStatus");

    if (!genBtn) return;   // 页面没有该模块则跳过

    genBtn.addEventListener("click", () => {
        // 读取并校正题目数量
        let count = parseInt(countInput.value, 10);
        if (isNaN(count) || count < 1) count = 1;
        if (count > 5000) count = 5000;
        countInput.value = count;

        const withAnswer = answerBox.checked;
        statusEl.textContent = "生成中…";

        // 放到下一轮事件循环执行，让「生成中…」先显示出来（大量题目时生成会阻塞主线程）
        setTimeout(() => {
            const questions = generateQuestions(count);
            const text = buildText(questions, withAnswer);
            downloadTxt(text, `口算题_${questions.length}道.txt`);

            let msg = `已生成 ${questions.length} 道题目并开始下载`;
            if (questions.length < count)
                msg += `（目标 ${count} 道，受去重与约束限制未能全部生成）`;
            statusEl.textContent = msg;
        }, 0);
    });
});
