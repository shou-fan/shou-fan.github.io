// 试卷模式：选难度 + 题量 → 生成预览 → 浏览器打印 / 下载 txt
let _lastQuestions = null;
let _lastCfg = null;

(function () {
    renderNav('print');
    document.getElementById('genBtn').addEventListener('click', onGenerate);
    document.getElementById('txtBtn').addEventListener('click', onDownloadTxt);
    document.getElementById('printBtn').addEventListener('click', onPrint);
})();

function onGenerate() {
    const seg = document.getElementById('segSel').value;
    const tierStart = { easy: 1, medium: 11, hard: 21 }[seg];
    const baseCfg = getLevel(tierStart);
    const count = Math.min(50, Math.max(1, parseInt(document.getElementById('pcount').value, 10) || 20));
    const cfg = Object.assign({}, baseCfg, { count });
    const qs = generateBatch(cfg);
    if (qs.length === 0) { showToast('生成失败，请重试', 'err'); return; }
    _lastQuestions = qs; _lastCfg = cfg;
    renderPreview(qs, seg, document.getElementById('pans').checked);
    showToast(`已生成 ${qs.length} 道`, 'ok');
}

function renderPreview(qs, seg, withAns) {
    const label = { easy: '一位数', medium: '两位数', hard: '三位数' }[seg];
    const root = document.getElementById('printPreview');
    root.innerHTML = `
        <h3>口算试卷 · ${label} · ${qs.length} 题</h3>
        <p style="text-align:center;color:#95a5a6;font-size:13px">姓名__________ 用时__________ 得分__________</p>
        <div class="ptest-grid">
            ${qs.map((q, i) => `<div class="ptest-item">${i + 1}. ${q.text} = ______${withAns ? ' <span style="color:#27ae60">(' + q.answer + ')</span>' : ''}</div>`).join('')}
        </div>`;
}

function onDownloadTxt() {
    if (!_lastQuestions) { showToast('请先生成', 'err'); return; }
    const withAns = document.getElementById('pans').checked;
    let out = `===== 题目 (共 ${_lastQuestions.length} 道) =====\n`;
    _lastQuestions.forEach((q, i) => { out += `${String(i + 1).padStart(3, ' ')}) ${q.text} =\n`; });
    if (withAns) {
        out += `\n===== 答案 =====\n`;
        _lastQuestions.forEach((q, i) => {
            out += `${String(i + 1).padStart(3, ' ')}) ${String(q.answer).padStart(4, ' ')}`;
            if ((i + 1) % 5 === 0 || i + 1 === _lastQuestions.length) out += "\n";
            else out += "  ";
        });
    }
    const blob = new Blob([out], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `口算试卷_${_lastQuestions.length}道.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function onPrint() {
    if (!_lastQuestions) { showToast('请先生成', 'err'); return; }
    window.print();
}
