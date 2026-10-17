// 答题页：加载关卡配置 → 出题 → 渲染网格 → 倒计时 → 判题 → 结算
(function () {
    renderNav('hall');
    const cur = Storage.current();
    if (!cur) { location.href = 'index.html'; return; }
    const params = new URLSearchParams(location.search);
    const levelId = parseInt(params.get('level') || '1', 10);
    const cfg = getLevel(levelId);
    if (!cfg) { showToast('关卡不存在', 'err'); setTimeout(() => location.href = 'index.html', 800); return; }

    const segLabel = { easy: '简单', medium: '中等', hard: '困难' }[cfg.segment];
    document.getElementById('qTitle').textContent =
        `第 ${levelId} 关 · ${segLabel} · ${cfg.digits} 位数 · ${cfg.count} 题`;

    const questions = generateBatch(cfg);
    questions.forEach(q => { q.hash = hashQ(q.text, q.answer, q.seed); });

    const startTime = performance.now();
    const perQ = questions.map(() => ({ start: null, end: null, done: false }));
    perQ[0].start = startTime;

    // 渲染
    const grid = document.getElementById('qGrid');
    grid.innerHTML = questions.map((q, i) => `
        <div class="qcard" data-idx="${i}">
            <div class="qtext">${i + 1}) ${q.text} = </div>
            <input type="number" class="ans" data-idx="${i}" autocomplete="off" inputmode="numeric"/>
        </div>`).join('');
    const inputs = Array.from(grid.querySelectorAll('input.ans'));
    inputs[0].focus();

    const timerEl = document.getElementById('timer');
    const progressEl = document.getElementById('progress');
    const submitBtn = document.getElementById('submitBtn');

    function fmt(sec) {
        const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
        return `${m}:${String(s).padStart(2, '0')}`;
    }
    function tick() {
        const used = (performance.now() - startTime) / 1000;
        const left = Math.max(0, cfg.timeLimit - used);
        timerEl.textContent = fmt(left);
        timerEl.classList.toggle('ok', left > 30);
        if (left <= 0) { clearInterval(timerId); settle(true); }
    }
    const timerId = setInterval(tick, 250);
    tick();

    function updateProgress() {
        const done = perQ.filter(p => p.done).length;
        progressEl.textContent = `已完成 ${done}/${questions.length}`;
        submitBtn.disabled = done !== questions.length;
    }

    inputs.forEach((inp, i) => {
        inp.addEventListener('input', () => {
            const card = inp.closest('.qcard');
            card.classList.remove('wrong', 'done');
            if (inp.value === '') return;
            if (isCorrect(questions[i], inp.value)) {
                card.classList.add('done');
                inp.disabled = true;
                perQ[i].done = true;
                perQ[i].end = performance.now();
                const nextIdx = perQ.findIndex(p => !p.done);
                if (nextIdx !== -1) {
                    if (!perQ[nextIdx].start) perQ[nextIdx].start = performance.now();
                    inputs[nextIdx].focus();
                }
            } else {
                card.classList.add('wrong');
            }
            updateProgress();
        });
        inp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                for (let j = i + 1; j < inputs.length; j++) {
                    if (!perQ[j].done) { inputs[j].focus(); break; }
                }
            }
        });
    });

    submitBtn.addEventListener('click', () => settle(false));
    document.getElementById('abandonBtn').addEventListener('click', () => {
        if (confirm('放弃本关并返回大厅？')) {
            clearInterval(timerId);
            location.href = 'index.html';
        }
    });

    function settle(timedOut) {
        clearInterval(timerId);
        const elapsed = (performance.now() - startTime) / 1000;
        if (timedOut) {
            showToast('时间到，本关未通关，可重开', 'err');
            setTimeout(() => location.reload(), 1200);
            return;
        }
        const durations = perQ.map(p => (p.end && p.start) ? (p.end - p.start) : 0).filter(v => v > 0);
        const timing = checkTiming(durations);
        let stars = starFor(elapsed, cfg.timeLimit);
        const flagged = timing.flagged;
        if (flagged) stars = 0;
        const prev = cur.bestStars[levelId - 1] || 0;
        const res = Storage.submitResult(cur.pid, levelId, stars, elapsed, flagged);
        showResultModal({
            levelId, stars, elapsed, prev, flagged,
            coinDelta: res.coinDelta, isNewBest: res.isNewBest,
        });
    }

    function showResultModal(info) {
        const mask = document.createElement('div');
        mask.className = 'modal-mask';
        const nextBtn = info.levelId < 30
            ? `<button class="btn" onclick="location.href='play.html?level=${info.levelId + 1}'">下一关</button>` : '';
        mask.innerHTML = `
        <div class="modal">
            <h2>第 ${info.levelId} 关 · 结算</h2>
            <div class="star-display">${'★'.repeat(info.stars)}${'☆'.repeat(3 - info.stars)}</div>
            <p>用时 ${info.elapsed.toFixed(1)} 秒 / 上限 ${(getLevel(info.levelId).timeLimit / 60).toFixed(0)} 分钟</p>
            <p class="coin-earned">${info.coinDelta > 0 ? '获得 ' + info.coinDelta + ' 金币 🪙' : '无新金币（未超越历史最高）'}</p>
            ${info.flagged ? '<p style="color:#e74c3c">⚠ 作答速度可疑，本次不计分</p>' : ''}
            <p style="color:#95a5a6;font-size:13px">${info.isNewBest ? '🎉 新纪录！' : '历史最佳：' + '★'.repeat(info.prev)}</p>
            <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn btn-primary" onclick="location.href='index.html'">回大厅</button>
                <button class="btn" onclick="location.reload()">再挑战</button>
                ${nextBtn}
            </div>
        </div>`;
        document.body.appendChild(mask);
    }
})();
