// 判题与软反作弊：djb2 题面 hash 防篡改；作答时长过短视为可疑。
// P2 起会由 LeanCloud 云函数承担同样的校验，本文件保留同签名方便切换。

function hashQ(text, answer, seed) {
    const s = text + "|" + answer + "|" + seed;
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
}

function isCorrect(question, userAns) {
    const n = parseInt(userAns, 10);
    if (Number.isNaN(n)) return false;
    return n === question.answer;
}

// durationsMs: 每题从聚焦到答对所用的毫秒数组
// 任一题 < 200ms 或 平均 < 400ms → 判为可疑
function checkTiming(durationsMs) {
    if (!durationsMs.length) return { flagged: false, avgMs: 0, minMs: 0 };
    const sum = durationsMs.reduce((a, b) => a + b, 0);
    const avg = sum / durationsMs.length;
    const min = Math.min.apply(null, durationsMs);
    return { flagged: avg < 400 || min < 200, avgMs: avg, minMs: min };
}
