/* ============================================
   共享的首页背景选择器（供 index.html 与 information/index.html 使用）
   —— 同一次访问（同一浏览器标签页/同一 session）内，
      主页与 /information 使用**同一张**随机背景图；
      关闭标签页后 sessionStorage 清空，下次开新 session 会重新随机。
   —— 同时把该图中心亮度暴露成 bg.lum，供 particles.js 做自适应灰度配色。
   ============================================ */
(function () {
    const KEY = "locHomeBg";

    // 7 张 indexback/ 图片 + 用 PowerShell+System.Drawing 预计算好的中心区域平均亮度（0~255）
    const LIST = [
        { file: "12019-beach-1751455_1920.jpg",             lum: 185.3 },
        { file: "cleverpix-pier-1467984_1920.jpg",          lum: 148.2 },
        { file: "elija1703-beach-5982796_1920.jpg",          lum: 89.8  },
        { file: "frankbeckerde-mountains-6540497_1920.jpg",  lum: 168.0 },
        { file: "jwvein-autumn-7589934_1920.jpg",            lum: 75.2  },
        { file: "stevepb-sunset-404072_1920.jpg",            lum: 117.1 },
        { file: "yeskay1211-hills-2836301_1920.jpg",         lum: 139.7 },
    ];

    function pick() {
        let saved = null;
        try { saved = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) {}
        if (saved && LIST.some(i => i.file === saved.file)) return saved;

        const sel = LIST[Math.floor(Math.random() * LIST.length)];
        try { sessionStorage.setItem(KEY, JSON.stringify(sel)); } catch (e) {}
        return sel;
    }

    // 暴露成全局对象，两个页面都用它
    window.HomeBg = { pick: pick };
})();
