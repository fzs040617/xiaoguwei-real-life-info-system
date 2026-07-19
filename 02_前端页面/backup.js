// backup.js
// 数据库备份导出 V1

const BACKUP_API = "http://127.0.0.1:8000";
const BACKUP_TOKEN_KEY = "xgw_user_token";

let latestBackupData = null;

function getBackupToken() {
    return localStorage.getItem(BACKUP_TOKEN_KEY) || "";
}

async function loadBackupPreview() {
    const previewBox = document.getElementById("backupPreview");
    const structureBox = document.getElementById("backupStructure");
    const message = document.getElementById("backupMessage");

    previewBox.innerHTML = `<div class="empty">正在读取备份数据...</div>`;
    structureBox.innerHTML = `<div class="empty">正在读取导出结构...</div>`;

    try {
        const response = await fetch(`${BACKUP_API}/backup/export?token=${encodeURIComponent(getBackupToken())}`);
        const data = await response.json();

        if (!response.ok) {
            previewBox.innerHTML = `<div class="empty">读取失败：${JSON.stringify(data)}</div>`;
            return;
        }

        latestBackupData = data;

        const summary = data.summary || {};

        previewBox.innerHTML = `
            <div class="dashboard-grid">
                ${renderBackupMetric("线索", summary.clues || 0)}
                ${renderBackupMetric("真实库", summary.verified_items || 0)}
                ${renderBackupMetric("采集目标", summary.crawl_targets || 0)}
                ${renderBackupMetric("反馈", summary.feedbacks || 0)}
                ${renderBackupMetric("地图点", summary.map_points || 0)}
                ${renderBackupMetric("路线", summary.routes || 0)}
                ${renderBackupMetric("更新历史", summary.update_histories || 0)}
            </div>

            <div class="card">
                <h3>备份基本信息</h3>
                <p>系统名称：${escapeBackupHtml(data.system_name || "")}</p>
                <p>备份版本：${escapeBackupHtml(data.backup_version || "")}</p>
                <p>导出时间：${escapeBackupHtml(data.exported_at || "")}</p>
            </div>
        `;

        structureBox.innerHTML = `
            <div class="card">
                <h3>JSON 顶层结构</h3>
                <pre style="white-space:pre-wrap;">${escapeBackupHtml(JSON.stringify(Object.keys(data), null, 2))}</pre>
            </div>

            <div class="card">
                <h3>data 内部表结构</h3>
                <pre style="white-space:pre-wrap;">${escapeBackupHtml(JSON.stringify(Object.keys(data.data || {}), null, 2))}</pre>
            </div>
        `;

        if (message) {
            message.innerText = "备份预览加载成功。";
        }

    } catch (error) {
        previewBox.innerHTML = `
            <div class="empty">
                读取备份失败：${escapeBackupHtml(error.message)}
                <br>
                请确认后端已启动，并且 /docs 能打开。
            </div>
        `;
    }
}

async function downloadBackupJson() {
    const message = document.getElementById("backupMessage");

    if (!latestBackupData) {
        message.innerText = "正在先加载备份数据...";
        await loadBackupPreview();
    }

    if (!latestBackupData) {
        message.innerText = "备份数据加载失败，无法导出。";
        return;
    }

    const jsonText = JSON.stringify(latestBackupData, null, 2);
    const blob = new Blob([jsonText], {
        type: "application/json;charset=utf-8"
    });

    const now = new Date();
    const filename = buildBackupFileName(now);

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    message.innerText = `备份文件已生成：${filename}`;
}

function buildBackupFileName(date) {
    const year = date.getFullYear();
    const month = padBackupNumber(date.getMonth() + 1);
    const day = padBackupNumber(date.getDate());
    const hour = padBackupNumber(date.getHours());
    const minute = padBackupNumber(date.getMinutes());
    const second = padBackupNumber(date.getSeconds());

    return `xgw_backup_${year}${month}${day}_${hour}${minute}${second}.json`;
}

function padBackupNumber(num) {
    return String(num).padStart(2, "0");
}

function renderBackupMetric(title, value) {
    return `
        <div class="card">
            <h3>${escapeBackupHtml(title)}</h3>
            <div style="font-size:32px; font-weight:700; color:#1f7a4d; margin:10px 0;">${value}</div>
        </div>
    `;
}

function escapeBackupHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
