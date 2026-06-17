// backup-import.js
// 备份导入 V4：
// 只在 backup.html 运行。
// 普通用户不显示导入按钮，只显示权限说明。
// 管理员显示备份导入区域。
// 执行导入必须输入系统密码 + 随机验证码。

(function () {
    const BACKUP_IMPORT_API = "http://127.0.0.1:8000";
    const BACKUP_IMPORT_TOKEN_KEY = "xgw_user_token";

    let selectedBackupData = null;
    let backupImportVerifyToken = "";

    window.selectedBackupData = selectedBackupData;
    window.backupImportVerifyToken = backupImportVerifyToken;

    window.addEventListener("load", () => {
        setTimeout(initBackupImportPage, 500);
    });

    function getCurrentFileName() {
        const path = location.pathname || "";
        const fileName = decodeURIComponent(path.split("/").pop() || "");
        return fileName.toLowerCase();
    }

    async function initBackupImportPage() {
        if (getCurrentFileName() !== "backup.html") {
            return;
        }

        const mount = getBackupImportMount();

        if (!mount) {
            return;
        }

        mount.innerHTML = `
            <div class="box" style="border:1px solid #f0d0cd; background:#fffafa;">
                <h2 style="color:#b3261e;">管理员备份导入</h2>
                <p class="notice">正在检查当前账号权限...</p>
            </div>
        `;

        const token = localStorage.getItem(BACKUP_IMPORT_TOKEN_KEY);

        if (!token) {
            mount.innerHTML = `
                <div class="box" style="border:1px solid #f0d0cd; background:#fffafa;">
                    <h2 style="color:#b3261e;">管理员备份导入</h2>
                    <p class="notice">
                        备份导入属于危险操作。请先登录管理员账号后再使用。
                    </p>
                </div>
            `;
            return;
        }

        try {
            const response = await fetch(`${BACKUP_IMPORT_API}/auth/me`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({token})
            });

            const data = await response.json();

            if (!response.ok) {
                mount.innerHTML = `
                    <div class="box" style="border:1px solid #f0d0cd; background:#fffafa;">
                        <h2 style="color:#b3261e;">管理员备份导入</h2>
                        <p class="notice">登录状态无效，请重新登录管理员账号。</p>
                    </div>
                `;
                return;
            }

            const user = data.data;

            if (!user || user.role !== "admin") {
                mount.innerHTML = `
                    <div class="box" style="border:1px solid #f0d0cd; background:#fffafa;">
                        <h2 style="color:#b3261e;">管理员备份导入</h2>
                        <p class="notice">
                            当前账号不是管理员，不能使用备份导入功能。
                        </p>
                    </div>
                `;
                return;
            }

            renderBackupImportBox(mount);
            await loadBackupImportCode();

            setTimeout(() => {
                if (typeof window.applyBackupImportLayout === "function") {
                    window.applyBackupImportLayout();
                }
            }, 100);

        } catch (error) {
            mount.innerHTML = `
                <div class="box" style="border:1px solid #f0d0cd; background:#fffafa;">
                    <h2 style="color:#b3261e;">管理员备份导入</h2>
                    <p class="notice">权限检查失败，请确认后端已启动：${escapeBackupImportHtml(error.message)}</p>
                </div>
            `;
        }
    }

    function getBackupImportMount() {
        let mount = document.getElementById("backupImportMount");

        if (mount) {
            return mount;
        }

        const container = document.querySelector(".container");

        if (!container) {
            return null;
        }

        mount = document.createElement("div");
        mount.id = "backupImportMount";

        const preview = document.getElementById("backupPreview");

        if (preview && preview.closest(".section")) {
            preview.closest(".section").insertAdjacentElement("beforebegin", mount);
        } else {
            container.appendChild(mount);
        }

        return mount;
    }

    function renderBackupImportBox(mount) {
        mount.innerHTML = `
            <div class="box" id="backupImportBox" style="border:1px solid #f0d0cd; background:#fffafa;">
                <h2 style="color:#b3261e;">管理员备份导入</h2>
                <p class="notice">
                    只有管理员能看到这里。当前为安全合并模式：只导入系统里不存在的 ID，已存在的数据会跳过，不会覆盖旧数据。
                    导入需要系统密码和随机验证码。
                </p>

                <div class="form-row">
                    <label>选择 JSON 备份文件</label>
                    <input id="backupImportFile" type="file" accept=".json,application/json" onchange="readBackupImportFile()">
                </div>

                <div id="backupImportPreview" class="empty">尚未选择备份文件。</div>

                <div class="form-row">
                    <label>系统密码</label>
                    <input id="backupImportSystemPassword" type="password" placeholder="请输入系统密码">
                </div>

                <div class="form-row">
                    <label>随机验证码</label>
                    <div class="card" style="margin-bottom:10px;">
                        <span class="tag">验证码</span>
                        <strong 
                            id="backupImportCodeDisplay" 
                            onclick="loadBackupImportCode()" 
                            title="点击刷新验证码"
                            style="
                                font-size:22px; 
                                letter-spacing:3px; 
                                cursor:pointer;
                                user-select:none;
                                padding:4px 8px;
                                border-radius:8px;
                                background:#eef8f2;
                                color:#1f7a4d;
                                display:inline-block;
                                margin-left:8px;
                            "
                        >加载中...</strong>
                        <span style="margin-left:10px; color:#888; font-size:13px;">点击验证码可刷新</span>
                    </div>
                    <input id="backupImportCodeInput" placeholder="请输入上方随机验证码">
                </div>

                <button class="danger-button" onclick="importBackupData()">导入备份</button>
                <div id="backupImportMessage" class="message"></div>
            </div>
        `;
    }

    window.loadBackupImportCode = async function () {
        const display = document.getElementById("backupImportCodeDisplay");

        if (display) {
            display.innerText = "加载中...";
        }

        try {
            const token = localStorage.getItem(BACKUP_IMPORT_TOKEN_KEY) || "";
            const response = await fetch(`${BACKUP_IMPORT_API}/backup/import-code?token=${encodeURIComponent(token)}`);
            const data = await response.json();

            if (!response.ok) {
                if (display) display.innerText = "加载失败";
                return;
            }

            backupImportVerifyToken = data.verify_token;
            window.backupImportVerifyToken = backupImportVerifyToken;

            if (display) {
                display.innerText = data.verify_code;
            }

            const input = document.getElementById("backupImportCodeInput");
            if (input) {
                input.value = "";
            }

        } catch (error) {
            if (display) {
                display.innerText = "加载失败";
            }
        }
    };

    window.readBackupImportFile = function () {
        const fileInput = document.getElementById("backupImportFile");
        const preview = document.getElementById("backupImportPreview");
        const file = fileInput.files[0];

        selectedBackupData = null;
        window.selectedBackupData = null;

        if (!file) {
            preview.innerHTML = `<div class="empty">尚未选择备份文件。</div>`;
            return;
        }

        const reader = new FileReader();

        reader.onload = function (event) {
            try {
                const data = JSON.parse(event.target.result);
                selectedBackupData = data;
                window.selectedBackupData = selectedBackupData;

                const summary = data.summary || {};
                const systemName = data.system_name || "未知系统";
                const backupVersion = data.backup_version || "未知版本";
                const exportedAt = data.exported_at || "未知时间";

                preview.innerHTML = `
                    <div class="card">
                        <h3>备份文件预览</h3>
                        <p>系统名称：${escapeBackupImportHtml(systemName)}</p>
                        <p>备份版本：${escapeBackupImportHtml(backupVersion)}</p>
                        <p>导出时间：${escapeBackupImportHtml(exportedAt)}</p>
                    </div>

                    <div class="dashboard-grid">
                        ${renderBackupImportMetric("线索", summary.clues || 0)}
                        ${renderBackupImportMetric("真实库", summary.verified_items || 0)}
                        ${renderBackupImportMetric("采集目标", summary.crawl_targets || 0)}
                        ${renderBackupImportMetric("反馈", summary.feedbacks || 0)}
                        ${renderBackupImportMetric("地图点", summary.map_points || 0)}
                        ${renderBackupImportMetric("路线", summary.routes || 0)}
                        ${renderBackupImportMetric("更新历史", summary.update_histories || 0)}
                    </div>
                `;

                if (typeof window.applyBackupImportLayout === "function") {
                    window.applyBackupImportLayout();
                }

            } catch (error) {
                selectedBackupData = null;
                window.selectedBackupData = null;
                preview.innerHTML = `<div class="empty">文件解析失败：${escapeBackupImportHtml(error.message)}</div>`;
            }
        };

        reader.onerror = function () {
            selectedBackupData = null;
            window.selectedBackupData = null;
            preview.innerHTML = `<div class="empty">文件读取失败。</div>`;
        };

        reader.readAsText(file, "utf-8");
    };

    window.importBackupData = async function () {
        const token = localStorage.getItem(BACKUP_IMPORT_TOKEN_KEY);
        const message = document.getElementById("backupImportMessage");
        const systemPassword = document.getElementById("backupImportSystemPassword").value.trim();
        const verifyCode = document.getElementById("backupImportCodeInput").value.trim().toUpperCase();

        if (!token) {
            alert("请先登录管理员账号。");
            return;
        }

        if (!selectedBackupData) {
            alert("请先选择并解析一个 JSON 备份文件。");
            return;
        }

        if (!systemPassword) {
            alert("请输入系统密码。");
            return;
        }

        if (!backupImportVerifyToken) {
            alert("验证码未加载，请刷新验证码。");
            return;
        }

        if (!verifyCode) {
            alert("请输入随机验证码。");
            return;
        }

        const firstConfirm = confirm("确认导入这个备份文件吗？当前模式不会覆盖已有 ID，但会新增不存在的数据。");
        if (!firstConfirm) {
            return;
        }

        const secondConfirm = confirm("再次确认：导入前建议先导出一次当前系统备份。是否继续？");
        if (!secondConfirm) {
            return;
        }

        message.innerText = "正在导入备份，请稍等...";

        try {
            const response = await fetch(`${BACKUP_IMPORT_API}/backup/import-v3`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    token: token,
                    system_password: systemPassword,
                    verify_token: backupImportVerifyToken,
                    verify_code: verifyCode,
                    backup_data: selectedBackupData
                })
            });

            const data = await response.json();

            if (!response.ok) {
                message.innerText = "导入失败：" + JSON.stringify(data);
                await loadBackupImportCode();
                return;
            }

            message.innerText =
                `导入完成：新增 ${data.total_imported} 条，跳过 ${data.total_skipped} 条，失败 ${data.total_failed} 条。`;

            alert("备份导入完成，页面将刷新。");
            location.reload();

        } catch (error) {
            message.innerText = "导入失败，请确认后端已启动：" + error.message;
            await loadBackupImportCode();
        }
    };

    function renderBackupImportMetric(title, value) {
        return `
            <div class="card">
                <h3>${escapeBackupImportHtml(title)}</h3>
                <div style="font-size:28px; font-weight:700; color:#1f7a4d; margin:8px 0;">${value}</div>
            </div>
        `;
    }

    function escapeBackupImportHtml(text) {
        return String(text || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
})();
