/* ============================================
   首页粒子文字动画（弹簧 + 斥力 物理模型）
   —— 效果 ——
   · 初始：页面「上半部分」用粒子以金榜体拼出较小号的「守璠的主页」
   · 鼠标碰到文字（非中心）：像重力源一样排斥附近粒子，推开后弹回
   · 鼠标移到字中心的小圆内：触发分离
       - 上半部分粒子飞进导航栏方向并淡出「消失」
       - 下半部分粒子下移到页面底部，用楷体、更小字号、单行拼出一句随机名言
   · 一旦触发就不再复原（不再做中心判定，减少计算）；并通知时钟在时间后加 @shoufan

   依赖：quotes.js 提供全局 QUOTES；金榜体经 style.css 的 @font-face 声明
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
    const home = document.getElementById("home");
    const canvas = document.getElementById("homeCanvas");
    const sign = document.getElementById("homeSign");
    if (!home || !canvas || !canvas.getContext) return;

    const ctx = canvas.getContext("2d");
    const TITLE = "守璠的主页";                                          // 初始字样
    const TITLE_FONT = '"ShouJinBang", "KaiTi", "楷体", serif';         // 标题：金榜体（回退楷体）
    const QUOTE_FONT = '"KaiTi", "楷体", "STKaiti", "Kaiti SC", serif'; // 名言：保持楷体

    // ---- 可调参数 ----
    const N = 18000;                // 粒子总数
    const GAP = 2;                  // 文字采样步长（越小越密）
    const IDLE_CY = 0.28;           // 初始标题竖直中心（上半部分，越小越靠上）
    const QUOTE_CY = 0.90;          // 底部名言竖直中心（更靠下）
    const SPRING = 0.022;           // 弹簧回位系数
    const FRICTION = 0.78;          // 阻尼
    const REPEL_R = 45;             // 鼠标斥力半径
    const REPEL_R2 = REPEL_R * REPEL_R;
    const REPEL_STRENGTH = 2.4;     // 斥力强度
    const TRIGGER_R = 28;           // 中心触发半径
    const TRIGGER_R2 = TRIGGER_R * TRIGGER_R;
    const ALPHA_RATE = 0.08;        // 透明度渐变速度（上半淡出）

    // 粒子颜色：根据背景图中心亮度自适应，从传统灰度里选深/浅
    const bgLum = (typeof window.HOME_BG_LUM === "number") ? window.HOME_BG_LUM : 255;
    const PARTICLE_COLOR = bgLum >= 128
        ? "rgba(26, 26, 26, 0.9)"      // 亮背景 → 深灰（近黑）
        : "rgba(238, 238, 238, 0.92)"; // 暗背景 → 浅灰（近白）

    let W = 0, H = 0, dpr = 1;
    let cxIdle = 0, cyIdle = 0;
    let triggered = false;
    let currentQuote = "";
    let titleCenterPts = [];
    const particles = [];
    const mouse = { x: -9999, y: -9999, active: false };

    const rand = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    // ---------- 文字采样为点云 ----------
    function sampleText(lines, fontSize, cx, cy, gap, fontFamily) {
        const off = document.createElement("canvas");
        off.width = Math.max(1, Math.floor(W));
        off.height = Math.max(1, Math.floor(H));
        const o = off.getContext("2d");
        o.fillStyle = "#000";
        o.font = `600 ${fontSize}px ${fontFamily || QUOTE_FONT}`;
        o.textAlign = "center";
        o.textBaseline = "middle";
        const lineH = fontSize * 1.35;
        const startY = cy - (lines.length - 1) * lineH / 2;
        lines.forEach((ln, i) => o.fillText(ln, cx, startY + i * lineH));

        const data = o.getImageData(0, 0, off.width, off.height).data;
        const pts = [];
        for (let y = 0; y < off.height; y += gap) {
            for (let x = 0; x < off.width; x += gap) {
                if (data[(y * off.width + x) * 4 + 3] > 128) pts.push({ x, y });
            }
        }
        return pts;
    }

    // 去除标点符号（中英文常见标点），只保留汉字
    function stripPunct(s) {
        return s.replace(/[，。、；：？！“”‘’（）《》〈〉【】…—～·,.!?;:()]/g, "");
    }

    // 名言：去标点 + 单行 + 更小字号 + 靠下，保持楷体
    function quoteCloud() {
        const oneLine = stripPunct(currentQuote || "").trim();
        const len = Math.max(1, oneLine.length);
        const fq = Math.min((W * 0.9) / len, 30);   // 继续缩小字号，确保一行放得下
        return sampleText([oneLine], fq, W / 2, H * QUOTE_CY, GAP, QUOTE_FONT);
    }

    // ---------- 尺寸与点云 ----------
    function rebuild() {
        const rect = canvas.getBoundingClientRect();
        W = rect.width; H = rect.height;
        dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(W * dpr);
        canvas.height = Math.floor(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        cxIdle = W / 2; cyIdle = H * IDLE_CY;
        const fIdle = clamp(W * 0.10, 44, 120);     // 变小号的「守璠的主页」
        titleCenterPts = sampleText([TITLE], fIdle, cxIdle, cyIdle, GAP, TITLE_FONT);
    }

    // ---------- 粒子 ----------
    function createParticles() {
        particles.length = 0;
        for (let i = 0; i < N; i++) {
            particles.push({
                x: rand(0, W), y: rand(0, H),
                vx: 0, vy: 0, tx: 0, ty: 0,
                size: rand(0.7, 1.5),
                alpha: 1, alphaTarget: 1,
                role: "title",
            });
        }
    }

    function assignTitle() {
        const L = titleCenterPts.length;
        if (!L) return;
        for (let i = 0; i < N; i++) {
            const pt = titleCenterPts[Math.floor(i * L / N)];
            const p = particles[i];
            p.tx = pt.x; p.ty = pt.y; p.alphaTarget = 1; p.role = "title";
        }
    }

    // 触发后布局：上半飞入导航栏淡出、下半在底部拼成名言
    function applyTriggerLayout() {
        const qPts = quoteCloud();
        const lower = [];
        for (const p of particles) {
            if (p.role === "upper") {
                p.tx = p.x;
                p.ty = -30 - rand(0, 40);   // 飞出画布顶部（被 #home 裁掉）
                p.alphaTarget = 0;          // 淡出消失
            } else {
                p.role = "lower";
                lower.push(p);
            }
        }
        const Lq = qPts.length;
        if (Lq && lower.length) {
            for (let k = 0; k < lower.length; k++) {
                const pt = qPts[Math.floor(k * Lq / lower.length)];
                const p = lower[k];
                p.tx = pt.x; p.ty = pt.y; p.alphaTarget = 1;
            }
        }
    }

    function pickNewQuote() {
        if (typeof QUOTES === "undefined" || !QUOTES.length) { currentQuote = "知行合一"; return; }
        let q;
        do { q = QUOTES[Math.floor(Math.random() * QUOTES.length)]; }
        while (QUOTES.length > 1 && q.text === currentQuote);
        currentQuote = q.text;
    }

    function trigger() {
        triggered = true;
        if (sign) sign.classList.add("show");   // 淡入时间后的 @shoufan
        pickNewQuote();
        for (const p of particles) {
            p.role = (p.y < cyIdle) ? "upper" : "lower";
        }
        applyTriggerLayout();
        for (const p of particles) {
            if (p.role !== "lower") continue;
            const dx = p.x - cxIdle, dy = p.y - cyIdle;
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            p.vx += (dx / d) * rand(2, 9);
            p.vy += (dy / d) * rand(2, 9);
        }
    }

    // ---------- 渲染 + 物理 ----------
    function frame() {
        requestAnimationFrame(frame);
        if (!home.classList.contains("active")) return;

        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = PARTICLE_COLOR;

        const mx = mouse.x, my = mouse.y, mActive = mouse.active;
        for (const p of particles) {
            let ax = (p.tx - p.x) * SPRING;
            let ay = (p.ty - p.y) * SPRING;

            if (mActive) {
                const dx = p.x - mx, dy = p.y - my;
                const d2 = dx * dx + dy * dy;
                if (d2 < REPEL_R2 && d2 > 0.01) {
                    const d = Math.sqrt(d2);
                    const f = (REPEL_R - d) / REPEL_R * REPEL_STRENGTH;
                    ax += (dx / d) * f; ay += (dy / d) * f;
                }
            }

            p.vx = (p.vx + ax) * FRICTION;
            p.vy = (p.vy + ay) * FRICTION;
            p.x += p.vx; p.y += p.vy;
            p.alpha += (p.alphaTarget - p.alpha) * ALPHA_RATE;

            if (p.alpha < 0.02) continue;
            ctx.globalAlpha = p.alpha;
            ctx.fillRect(p.x, p.y, p.size, p.size);
        }
        ctx.globalAlpha = 1;
    }

    // ---------- 鼠标交互 ----------
    canvas.addEventListener("mousemove", (e) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
        mouse.active = true;

        if (!triggered) {
            const dx = mouse.x - cxIdle, dy = mouse.y - cyIdle;
            if (dx * dx + dy * dy <= TRIGGER_R2) trigger();
        }
    });

    canvas.addEventListener("mouseleave", () => {
        mouse.active = false; mouse.x = mouse.y = -9999;
    });

    // ---------- 初始化 & 自适应 ----------
    function boot() {
        rebuild();
        createParticles();
        assignTitle();
        requestAnimationFrame(frame);
    }

    // 先尽力加载金榜体（canvas 采样前字体必须就绪），失败/超时则用回退字体
    function loadTitleFontThenBoot() {
        if (document.fonts && document.fonts.load) {
            Promise.race([
                document.fonts.load(`600 100px "ShouJinBang"`, TITLE),
                new Promise(res => setTimeout(res, 1200))
            ]).then(boot).catch(boot);
        } else {
            boot();
        }
    }

    let resizeTimer = null;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            rebuild();
            if (triggered) applyTriggerLayout(); else assignTitle();
            for (const p of particles) { p.x = p.tx; p.y = p.ty; p.vx = 0; p.vy = 0; p.alpha = p.alphaTarget; }
        }, 150);
    });

    loadTitleFontThenBoot();
});
