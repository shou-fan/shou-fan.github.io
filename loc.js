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
};

// 扩展名(小写) -> 语言 映射（对应 kExtMap）
const EXT_MAP = {
    ".c": "C", ".h": "C",
    ".cpp": "C++", ".cc": "C++", ".cxx": "C++", ".c++": "C++",
    ".hpp": "C++", ".hh": "C++", ".hxx": "C++", ".h++": "C++", ".inl": "C++",
    ".java": "Java",
    ".py": "Python", ".pyw": "Python",
};

// 输出顺序（对应 order）
const ORDER = ["C", "C++", "Java", "Python"];

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
});
