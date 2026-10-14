/* ============================================
   代码量统计工具（loc.cpp 的网页交互版）
   —— 把 C++ 命令行版的「逐字符状态机」算法忠实移植到 JavaScript。
   访客选择本地文件后，网页实时统计每种语言的
   文件数 / 空行 / 注释行 / 代码行 / 总行数，输出与命令行一致的表格。

   口径与原版保持一致：
   - 列序：Language | Files | Blank | Comment | Code | Total
   - Python 三引号 docstring 计入 comment（与 cloc 一致）
   - 跳过 UTF-8 BOM
   - 无法识别扩展名的文件被忽略
   ============================================ */

// ---------------- 语言定义（对应 loc.cpp 的 Language 结构） ----------------
// blockComments 用 [起始, 结束] 二元组表示
const LANGS = {
    "C":      { lineComments: ["//"], blockComments: [["/*", "*/"]], multilineStrings: [], singleStrings: ['"', "'"] },
    "C++":    { lineComments: ["//"], blockComments: [["/*", "*/"]], multilineStrings: [], singleStrings: ['"', "'"] },
    "Java":   { lineComments: ["//"], blockComments: [["/*", "*/"]], multilineStrings: [], singleStrings: ['"', "'"] },
    // Python: 三引号视为块注释(docstring)，计入 comment
    "Python": { lineComments: ["#"],  blockComments: [['"""', '"""'], ["'''", "'''"]], multilineStrings: [], singleStrings: ['"', "'"] },
    // JavaScript: // 行注释、/* */ 块注释、` 模板字符串（可跨行，start=end=``）
    "JavaScript": { lineComments: ["//"], blockComments: [["/*", "*/"]], multilineStrings: ["`"], singleStrings: ['"', "'"] },
    // HTML: <!-- --> 块注释；无行注释；属性里的引号当字符串防止误判
    "HTML":       { lineComments: [],      blockComments: [["<!--", "-->"]],  multilineStrings: [], singleStrings: ['"', "'"] },
    // CSS: /* */ 块注释；无行注释
    "CSS":        { lineComments: [],      blockComments: [["/*", "*/"]],     multilineStrings: [], singleStrings: ['"', "'"] },
};

// 扩展名(小写) -> 语言 映射（对应 kExtMap）
const EXT_MAP = {
    ".c": "C", ".h": "C",
    ".cpp": "C++", ".cc": "C++", ".cxx": "C++", ".c++": "C++",
    ".hpp": "C++", ".hh": "C++", ".hxx": "C++", ".h++": "C++", ".inl": "C++",
    ".java": "Java",
    ".py": "Python", ".pyw": "Python",
    ".js": "JavaScript", ".mjs": "JavaScript", ".cjs": "JavaScript", ".jsx": "JavaScript",
    ".html": "HTML", ".htm": "HTML",
    ".css": "CSS",
};

// 输出顺序（对应 order）
const ORDER = ["C", "C++", "Java", "Python", "JavaScript", "HTML", "CSS"];

// ---------------- 扫描辅助函数 ----------------

// 判断 s 从 pos 起是否以 token 开头（对应 startsWith）
function startsWith(s, pos, token) {
    if (token.length === 0 || pos + token.length > s.length) return false;
    return s.startsWith(token, pos);
}

// 从 pos 起查找字符串结束定界符，处理反斜杠转义；找不到返回 -1（对应 findStringClose）
function findStringClose(s, pos, delim) {
    for (let i = pos; i < s.length;) {
        if (s[i] === "\\") { i += 2; continue; }   // 跳过被转义的字符
        if (startsWith(s, i, delim)) return i;
        i++;
    }
    return -1;
}

// 按行切分，模拟 C++ std::getline 的行为：
// 文件以换行结尾时不会多算一个空行。
function splitLines(text) {
    if (text.length === 0) return [];
    const lines = text.split("\n");
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    return lines;
}

// 取文件扩展名(小写，含点)；无扩展名或以点开头的文件返回 ""（对应 std::filesystem::path::extension）
function extOf(filename) {
    const i = filename.lastIndexOf(".");
    if (i <= 0) return "";
    return filename.slice(i).toLowerCase();
}

// ---------------- 行扫描状态机（对应 countFile） ----------------
function countLines(lang, text) {
    const c = { code: 0, blank: 0, comment: 0, total: 0 };

    // 跳过 UTF-8 BOM
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

    let activeBlockEnd = null;   // 非 null 表示正处于块注释中
    let activeString = "";       // 非空表示正处于跨行字符串中

    for (const raw of splitLines(text)) {
        let line = raw;
        if (line.length && line[line.length - 1] === "\r") line = line.slice(0, -1); // 兼容 Windows 行尾
        c.total++;

        let hasCode = false;
        let hasComment = false;

        // 跨行构造中的空行也应归入其类别
        if (activeBlockEnd) hasComment = true;
        else if (activeString) hasCode = true;

        const n = line.length;
        let i = 0;
        while (i < n) {
            // 1) 块注释内部
            if (activeBlockEnd) {
                hasComment = true;
                if (startsWith(line, i, activeBlockEnd)) { i += activeBlockEnd.length; activeBlockEnd = null; }
                else i++;
                continue;
            }
            // 2) 跨行字符串内部（如 Python 三引号，当前语言定义未启用）
            if (activeString) {
                hasCode = true;
                if (startsWith(line, i, activeString)) { i += activeString.length; activeString = ""; }
                else i++;
                continue;
            }
            // 3) 普通代码状态
            let matched = false;
            // 3a) 行注释：本行剩余全部视为注释
            for (const lc of lang.lineComments) {
                if (startsWith(line, i, lc)) { hasComment = true; i = n; matched = true; break; }
            }
            if (matched) continue;
            // 3b) 块注释起始
            for (const bc of lang.blockComments) {
                if (startsWith(line, i, bc[0])) { hasComment = true; activeBlockEnd = bc[1]; i += bc[0].length; matched = true; break; }
            }
            if (matched) continue;
            // 3c) 跨行字符串起始（先于单行，保证三引号优先匹配）
            for (const d of lang.multilineStrings) {
                if (startsWith(line, i, d)) {
                    hasCode = true;
                    const close = findStringClose(line, i + d.length, d);
                    if (close === -1) { activeString = d; i = n; }
                    else i = close + d.length;
                    matched = true; break;
                }
            }
            if (matched) continue;
            // 3d) 单行字符串/字符字面量起始
            for (const d of lang.singleStrings) {
                if (startsWith(line, i, d)) {
                    hasCode = true;
                    const close = findStringClose(line, i + d.length, d);
                    if (close === -1) i = n;   // 未在本行闭合：视作到行尾结束
                    else i = close + d.length;
                    matched = true; break;
                }
            }
            if (matched) continue;
            // 3e) 普通字符
            if (!/\s/.test(line[i])) hasCode = true;
            i++;
        }

        if (hasCode) c.code++;
        else if (hasComment) c.comment++;
        else c.blank++;
    }
    return c;
}

// ---------------- 批量统计一组文件 ----------------
async function runStats(files) {
    const stats = {};
    ORDER.forEach(name => { stats[name] = { files: 0, blank: 0, comment: 0, code: 0, total: 0 }; });

    let counted = 0, ignored = 0;
    for (const file of files) {
        const langName = EXT_MAP[extOf(file.name)];
        if (!langName) { ignored++; continue; }   // 完全忽略未识别的文件

        const text = await file.text();          // 读取用户选择的文件（file:// 下也允许）
        const lc = countLines(LANGS[langName], text);
        const s = stats[langName];
        s.files += 1; s.code += lc.code; s.blank += lc.blank;
        s.comment += lc.comment; s.total += lc.total;
        counted++;
    }
    return { stats, counted, ignored };
}

// ---------------- 生成结果表格 HTML（对应 printTable） ----------------
function renderTableHTML(stats) {
    const sum = { files: 0, blank: 0, comment: 0, code: 0, total: 0 };
    let body = "";
    ORDER.forEach(name => {
        const s = stats[name];
        body += `<tr><td>${name}</td><td>${s.files}</td><td>${s.blank}</td>`
              + `<td>${s.comment}</td><td>${s.code}</td><td>${s.total}</td></tr>`;
        sum.files += s.files; sum.blank += s.blank; sum.comment += s.comment;
        sum.code += s.code; sum.total += s.total;
    });

    return `<table>
        <thead>
            <tr><th>Language</th><th>Files</th><th>Blank</th><th>Comment</th><th>Code</th><th>Total</th></tr>
        </thead>
        <tbody>${body}</tbody>
        <tfoot>
            <tr class="sum-row"><td>SUM</td><td>${sum.files}</td><td>${sum.blank}</td>`
            + `<td>${sum.comment}</td><td>${sum.code}</td><td>${sum.total}</td></tr>
        </tfoot>
    </table>`;
}

// ---------------- GitHub 仓库统计 ----------------

// 解析 GitHub 链接（支持 https://github.com/owner/repo[/tree/分支[/子目录]][.git]），
// 返回 { owner, repo, ref, subpath }；ref/subpath 可为空。
function parseGitHubUrl(input) {
    let s = (input || "").trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "");
    const parts = s.split("/").filter(Boolean);
    if (parts.length < 2 || parts[0].toLowerCase() !== "github.com") {
        throw new Error("请输入有效的 GitHub 仓库链接，如 https://github.com/用户/仓库");
    }
    const owner = parts[1];
    const repo = parts[2].replace(/\.git$/i, "");
    if (!repo) throw new Error("链接缺少仓库名");
    let ref = "", subpath = "";
    if (parts[3] === "tree" && parts[4]) {
        ref = parts[4];
        if (parts.length > 5) subpath = parts.slice(5).join("/");
    }
    return { owner, repo, ref, subpath };
}

// ---------- GitHub Token 存取（localStorage） ----------
const GH_TOKEN_KEY = "locGitHubToken";

function getGitHubToken() {
    try { return localStorage.getItem(GH_TOKEN_KEY) || ""; }
    catch (e) { return ""; }
}

function setGitHubToken(token) {
    try {
        if (token) localStorage.setItem(GH_TOKEN_KEY, token);
        else localStorage.removeItem(GH_TOKEN_KEY);
    } catch (e) { /* 部分环境 localStorage 不可用，忽略 */ }
}

// 从响应头里读 x-ratelimit-remaining / -limit，更新页面配额展示
function updateGhQuotaDisplay(res) {
    const el = document.getElementById("ghQuota");
    if (!el) return;
    const remain = res.headers.get("x-ratelimit-remaining");
    const limit  = res.headers.get("x-ratelimit-limit");
    if (remain !== null && limit !== null) {
        el.textContent = `API 剩余额度：${remain} / ${limit} 次/小时`
            + (getGitHubToken() ? "（已启用 Token）" : "（匿名）");
    }
}

// 封装 GitHub API 请求：自动附带 Token（如果已保存）+ 常见错误提示
async function ghApiFetch(path) {
    const url = "https://api.github.com/" + path.replace(/^\//, "");
    const headers = { Accept: "application/vnd.github+json" };
    const tok = getGitHubToken();
    if (tok) headers.Authorization = "Bearer " + tok;
    let res;
    try {
        res = await fetch(url, { headers });
    } catch (e) {
        throw new Error("网络错误：无法访问 GitHub API");
    }
    updateGhQuotaDisplay(res);
    if (res.status === 401) throw new Error("GitHub Token 无效或已过期（401），请重新生成或在「高级」中清除");
    if (res.status === 403) {
        if (res.headers.get("x-ratelimit-remaining") === "0") {
            throw new Error(tok
                ? "已启用 Token 但配额已用完（5000 次/小时），请稍后再试"
                : "GitHub API 未登录限额已用完（60 次/小时），可在下方「高级」里填入自己的 Token 提升到 5000 次/小时");
        }
        throw new Error("GitHub API 拒绝访问（403）");
    }
    if (res.status === 404) throw new Error("仓库不存在或为私有仓库（404）");
    if (!res.ok) throw new Error("GitHub API 请求失败：" + res.status + " " + res.statusText);
    return await res.json();
}

// 从 GitHub 仓库 URL 统计代码量（复用现有 countLines 算法）
// onProgress(msg) 用于实时上报进度
async function runStatsFromGitHub(input, onProgress) {
    const { owner, repo, ref: refFromUrl, subpath } = parseGitHubUrl(input);

    // 1. 确定分支：URL 中没给则拿默认分支
    onProgress("获取仓库信息…");
    let ref = refFromUrl;
    if (!ref) {
        const info = await ghApiFetch(`repos/${owner}/${repo}`);
        ref = info.default_branch || "main";
    }

    // 2. 拉取递归文件树
    onProgress("获取文件树…");
    const treeResp = await ghApiFetch(
        `repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`);
    if (!Array.isArray(treeResp.tree)) throw new Error("无法读取文件树");

    // 3. 过滤：只保留已识别的源码文件，跳过超大文件（多为自动生成/压缩）
    const MAX_FILES = 800;           // 一次最多拉取多少个源码文件
    const MAX_SIZE  = 800 * 1024;    // 800KB 以上跳过
    const filtered = [];
    for (const e of treeResp.tree) {
        if (e.type !== "blob") continue;
        if (subpath && !e.path.startsWith(subpath + "/")) continue;
        if (!EXT_MAP[extOf(e.path)]) continue;
        if (typeof e.size === "number" && e.size > MAX_SIZE) continue;
        filtered.push(e);
    }
    const overCap = filtered.length > MAX_FILES;
    const files = filtered.slice(0, MAX_FILES);
    const truncated = !!treeResp.truncated || overCap;

    // 4. 初始化统计结构（与本地文件统计一致）
    const stats = {};
    ORDER.forEach(name => { stats[name] = { files: 0, blank: 0, comment: 0, code: 0, total: 0 }; });
    let counted = 0, failed = 0;

    if (files.length > 0) {
        // 5. 并发拉取 raw 内容（raw.githubusercontent.com 不估 API 限额）
        const rawBase = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(ref)}/`;
        let nextIdx = 0;
        const worker = async () => {
            while (true) {
                const i = nextIdx++;
                if (i >= files.length) break;
                const f = files[i];
                const url = rawBase + f.path.split("/").map(encodeURIComponent).join("/");
                try {
                    const res = await fetch(url);
                    if (!res.ok) { failed++; }
                    else {
                        const text = await res.text();
                        const langName = EXT_MAP[extOf(f.path)];
                        const lc = countLines(LANGS[langName], text);
                        const s = stats[langName];
                        s.files += 1; s.code += lc.code; s.blank += lc.blank;
                        s.comment += lc.comment; s.total += lc.total;
                        counted++;
                    }
                } catch (e) { failed++; }
                onProgress(`统计中 ${counted + failed}/${files.length}`);
            }
        };
        const CONC = 8;   // 8 个并发工人
        await Promise.all(Array.from({ length: CONC }, () => worker()));
    }

    return { stats, counted, failed, fileTotal: files.length, truncated };
}

// ---------------- 页面交互绑定 ----------------
document.addEventListener("DOMContentLoaded", () => {
    const fileInput = document.getElementById("locFiles");
    const dirInput  = document.getElementById("locDir");
    const pickFiles = document.getElementById("pickFiles");
    const pickDir   = document.getElementById("pickDir");
    const runBtn    = document.getElementById("locRun");
    const statusEl  = document.getElementById("locStatus");
    const resultEl  = document.getElementById("locResult");

    if (!runBtn || !fileInput) return;   // 页面没有该模块则跳过

    // 当前已选择、等待统计的文件列表（可能来自文件选择，也可能来自文件夹）
    let pendingFiles = [];

    // 用样式按钮触发隐藏的 input
    if (pickFiles) pickFiles.addEventListener("click", () => fileInput.click());
    if (pickDir && dirInput) pickDir.addEventListener("click", () => dirInput.click());

    // 选择文件后记录
    fileInput.addEventListener("change", () => {
        pendingFiles = Array.from(fileInput.files || []);
        statusEl.textContent = `已选择 ${pendingFiles.length} 个文件`;
        resultEl.innerHTML = "";
    });

    // 选择文件夹后记录（浏览器会递归列出文件夹内所有文件）
    if (dirInput) {
        dirInput.addEventListener("change", () => {
            pendingFiles = Array.from(dirInput.files || []);
            // 从第一个文件的相对路径里取出文件夹名
            const rel = pendingFiles.length ? (pendingFiles[0].webkitRelativePath || "") : "";
            const folderName = rel ? rel.split("/")[0] : "文件夹";
            statusEl.textContent = `已选择文件夹「${folderName}」，共 ${pendingFiles.length} 个文件`;
            resultEl.innerHTML = "";
        });
    }

    runBtn.addEventListener("click", async () => {
        if (pendingFiles.length === 0) {
            statusEl.textContent = "请先选择文件或文件夹";
            resultEl.innerHTML = "";
            return;
        }

        runBtn.disabled = true;
        statusEl.textContent = "统计中…";
        try {
            const { stats, counted, ignored } = await runStats(pendingFiles);
            resultEl.innerHTML = renderTableHTML(stats);
            statusEl.textContent = `已统计 ${counted} 个源码文件`
                + (ignored > 0 ? `，忽略 ${ignored} 个不支持的文件` : "");
        } catch (err) {
            statusEl.textContent = "出错了：" + err.message;
            resultEl.innerHTML = "";
        } finally {
            runBtn.disabled = false;
        }
    });

    // ===== GitHub 链接仓库统计 =====
    const ghUrlInput = document.getElementById("ghUrl");
    const ghRunBtn   = document.getElementById("ghRun");
    if (ghRunBtn && ghUrlInput) {
        const runGitHub = async () => {
            const val = (ghUrlInput.value || "").trim();
            if (!val) { statusEl.textContent = "请先粘贴 GitHub 仓库链接"; return; }
            ghRunBtn.disabled = true;
            runBtn.disabled = true;   // 避免同时跑两个
            resultEl.innerHTML = "";
            const t0 = performance.now();
            try {
                const r = await runStatsFromGitHub(val, (msg) => { statusEl.textContent = msg; });
                resultEl.innerHTML = renderTableHTML(r.stats);
                const secs = ((performance.now() - t0) / 1000).toFixed(1);
                let m = `已统计 ${r.counted} 个源码文件（${secs}s）`;
                if (r.failed > 0) m += `，失败 ${r.failed}`;
                if (r.truncated) m += `，文件树过大已截断（前 800 个）`;
                statusEl.textContent = m;
            } catch (err) {
                statusEl.textContent = "出错了：" + err.message;
            } finally {
                ghRunBtn.disabled = false;
                runBtn.disabled = false;
            }
        };
        ghRunBtn.addEventListener("click", runGitHub);
        ghUrlInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") { e.preventDefault(); runGitHub(); }
        });
    }

    // ===== GitHub Token 管理（保存/清除到 localStorage） =====
    const ghTokenInput  = document.getElementById("ghToken");
    const ghTokenSave   = document.getElementById("ghTokenSave");
    const ghTokenClear  = document.getElementById("ghTokenClear");
    const ghTokenStatus = document.getElementById("ghTokenStatus");

    function refreshGhTokenStatus() {
        if (ghTokenStatus) ghTokenStatus.textContent = getGitHubToken() ? "已启用" : "";
    }

    if (ghTokenSave && ghTokenInput) ghTokenSave.addEventListener("click", () => {
        const v = (ghTokenInput.value || "").trim();
        setGitHubToken(v);
        ghTokenInput.value = "";   // 保存后立刻清空，避免 DevTools 里能看到明文
        refreshGhTokenStatus();
        statusEl.textContent = v ? "已保存 Token，限额提升到 5000/小时" : "Token 已清空，回到匿名 60/小时";
    });

    if (ghTokenClear && ghTokenInput) ghTokenClear.addEventListener("click", () => {
        setGitHubToken("");
        ghTokenInput.value = "";
        refreshGhTokenStatus();
        statusEl.textContent = "已清除 Token";
    });

    refreshGhTokenStatus();
});
