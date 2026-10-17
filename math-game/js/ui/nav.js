// 顶部导航渲染。每个 HTML 放 <div id="navRoot"></div>，页面 JS 首先调 renderNav('hall' | 'print' | ...)
function renderNav(activePage) {
    const cur = Storage.current();
    const userChip = cur
        ? `<div class="user-chip">
             <span>${cur.name}${cur.isGuest ? ' <small style="color:#e67e22">(游客)</small>' : ''}</span>
             <span class="coins">🪙 ${cur.coins}</span>
             <button class="btn btn-ghost" onclick="Storage.logout();location.href='index.html'">切换</button>
           </div>`
        : `<div class="user-chip"><a href="index.html">未登录 · 进入大厅</a></div>`;
    const links = [
        ['hall',    'index.html',   '大厅'],
        ['shop',    'shop.html',    '商店'],
        ['profile', 'profile.html', '我的成就'],
        ['print',   'print.html',   '试卷模式'],
        ['admin',   'admin.html',   '后台'],
    ];
    const html = `<nav class="gnav">
        <div class="brand">🧮 口算闯关</div>
        <div class="links">${links.map(([k, h, t]) => `<a href="${h}"${k === activePage ? ' class="active"' : ''}>${t}</a>`).join('')}</div>
        <div class="spacer"></div>${userChip}</nav>`;
    const root = document.getElementById('navRoot');
    if (root) root.outerHTML = html;
}
