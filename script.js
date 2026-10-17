/* ============================================
   交互脚本：页面切换 + 左上角时钟
   - 顶部导航项、小程序卡片、返回按钮都通过统一的方式切换页面
   - 前进：新页面从右向左滑入、旧页面向左滑出
   - 返回：新页面从左向右滑入、旧页面向右滑出
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {

    const navLinks = document.querySelectorAll(".nav-links a");
    const ANIMATION_MS = 500;  // 需与 style.css 中 .page 的 transition 时长一致

    // 顶部导航项的顺序（用于判断前进 / 返回方向）
    const navOrder = Array.from(navLinks).map(l => l.getAttribute("href"));

    // 取某个页面在导航顺序中的下标；子页面按 data-nav 归属，否则用自身 id
    function navIndexOf(pageEl) {
        const navTarget = pageEl.getAttribute("data-nav") || ("#" + pageEl.id);
        return navOrder.indexOf(navTarget);   // 找不到返回 -1
    }

    /**
     * 切换到指定页面（核心函数，供导航项/卡片/返回按钮共用）
     * @param {string}  targetId  形如 "#home" / "#app-loc" 的锚点选择器
     * @param {boolean} forceBack 是否强制使用「返回」方向（从左向右滑）
     */
    function switchTo(targetId, forceBack) {
        const target = document.querySelector(targetId);
        const current = document.querySelector(".page.active");

        // 目标不存在，或点的就是当前页，则什么都不做
        if (!target || target === current) return;

        // ---- 判断方向 ----
        // 显式返回 -> backward；否则比较导航顺序，目标在当前位置左侧也算 backward
        let backward = !!forceBack;
        if (!backward && current) {
            const ci = navIndexOf(current);
            const ti = navIndexOf(target);
            if (ci !== -1 && ti !== -1 && ti < ci) backward = true;
        }

        if (backward) {
            // ===== 返回：新页面从左向右滑入 =====
            // 先把新页面「无动画地」放到左侧屏幕外，确立起点
            target.style.transition = "none";
            target.style.transform = "translateX(-100%)";
            void target.offsetWidth;            // 强制回流，让起点立即生效
            target.style.transition = "";       // 恢复过渡
            target.style.transform = "";        // 清除内联，交回 CSS 类控制
            target.classList.add("active");     // -> translateX(0)，从左侧滑入

            // 旧页面：移除 active 即回到默认位置(右侧屏幕外)，自然向右滑出
            if (current) current.classList.remove("active");
        } else {
            // ===== 前进：新页面从右向左滑入 =====
            target.classList.add("active");     // 默认停在右侧外 -> translateX(0)

            // 旧页面向左滑出，动画结束后「无动画地」复位到右侧待命，避免反向滑回穿帮
            if (current) {
                current.classList.remove("active");
                current.classList.add("leaving");
                setTimeout(() => {
                    current.style.transition = "none";
                    current.classList.remove("leaving");
                    void current.offsetWidth;
                    current.style.transition = "";
                }, ANIMATION_MS);
            }
        }

        // 更新顶部导航高亮：子页面用 data-nav 指定所属导航项，否则用自身 id
        const navTarget = target.getAttribute("data-nav") || targetId;
        navLinks.forEach(l =>
            l.classList.toggle("nav-active", l.getAttribute("href") === navTarget));
    }

    // ① 顶部导航链接（方向由导航顺序自动判断）
    navLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            const href = link.getAttribute("href");
            if (href && href.startsWith("#") && href.length > 1) {
                e.preventDefault();
                switchTo(href, false);
            }
        });
    });

    // ② 所有带 data-goto 的元素（小程序卡片、返回按钮等）
    //    带 data-back 标记的强制使用「返回」方向
    document.querySelectorAll("[data-goto]").forEach(el => {
        el.addEventListener("click", (e) => {
            e.preventDefault();
            switchTo(el.getAttribute("data-goto"), el.hasAttribute("data-back"));
        });
    });

    // ===== 左上角：实时时间显示（只有发生变化的字符才跳动） =====
    const clock = document.getElementById("clock");
    if (clock) {
        const pad = n => String(n).padStart(2, "0");  // 个位数补零，如 9 -> 09
        let spans = [];        // 每个字符对应一个 span
        let prevChars = [];    // 上一次的字符，用于对比是否变化

        // 按文本长度重建字符 span
        function buildSpans(text) {
            clock.innerHTML = "";
            spans = [];
            for (const ch of text) {
                const s = document.createElement("span");
                s.className = "clock-char";
                s.textContent = ch;
                clock.appendChild(s);
                spans.push(s);
            }
        }

        function updateClock() {
            const now = new Date();
            // 东七区（UTC+7）：用绝对时间戳加 7 小时后，再读 UTC 字段即得东七区墙钟
            const e7 = new Date(now.getTime() + 7 * 3600 * 1000);
            const date = `${e7.getUTCFullYear()}-${pad(e7.getUTCMonth() + 1)}-${pad(e7.getUTCDate())}`;
            const time = `${pad(e7.getUTCHours())}:${pad(e7.getUTCMinutes())}:${pad(e7.getUTCSeconds())}`;
            const text = `${date} ${time} UTC+7`;              // 用英文标注东七区(UTC+7)；@shoufan 改为独立元素淡入

            // 首次或长度变化：重建全部字符
            if (spans.length !== text.length) {
                buildSpans(text);
                prevChars = Array.from(text);
                return;
            }

            // 逐字符对比，只更新并跳动「发生变化」的字符
            for (let i = 0; i < text.length; i++) {
                if (text[i] !== prevChars[i]) {
                    spans[i].textContent = text[i];
                    // 重新触发动画：移除 .tick → 强制回流 → 加回
                    spans[i].classList.remove("tick");
                    void spans[i].offsetWidth;
                    spans[i].classList.add("tick");
                    prevChars[i] = text[i];
                }
            }
        }

        updateClock();                   // 先立即显示一次，避免空白
        setInterval(updateClock, 1000);  // 之后每秒更新
    }

    // ===== 首页背景：使用共享的 HomeBg（bg.js）=====
    // 同一次访问内主页与 /information 会拿到**同一张**随机图（sessionStorage）；
    // 同时把该图预计算的中心亮度写入 window.HOME_BG_LUM，供 particles.js 自适应选灰度色。
    if (typeof HomeBg !== "undefined") {
        const bg = HomeBg.pick();
        document.body.style.backgroundImage = `url("indexback/${bg.file}")`;
        window.HOME_BG_LUM = bg.lum;
    }

    // ===== 支持 URL hash 直达某个页面（例如 /information 里点导航栏跳回 ../#research）=====
    // 只在初始加载时处理一次；不触发 switchTo 避免开场动画
    const initialHash = (location.hash || "").trim();
    if (initialHash.length > 1 && initialHash.charAt(0) === "#") {
        const target = document.getElementById(initialHash.slice(1));
        if (target && target.classList.contains("page") && !target.classList.contains("active")) {
            const cur = document.querySelector(".page.active");
            if (cur) cur.classList.remove("active");
            target.classList.add("active");
            const navTarget = target.getAttribute("data-nav") || initialHash;
            navLinks.forEach(l =>
                l.classList.toggle("nav-active", l.getAttribute("href") === navTarget));
        }
    }

});
