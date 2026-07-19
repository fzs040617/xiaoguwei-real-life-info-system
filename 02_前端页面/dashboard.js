const API_BASE = "http://127.0.0.1:8000";

let dashboardData = {
    clues: [],
    verifiedItems: [],
    crawlTargets: []
};

async function loadDashboardData() {
    try {
        const cluesResponse = await fetch(`${API_BASE}/clues`);
        const cluesData = await cluesResponse.json();

        const verifiedResponse = await fetch(`${API_BASE}/verified-items`);
        const verifiedData = await verifiedResponse.json();

        const targetsResponse = await fetch(`${API_BASE}/crawler/targets`);
        const targetsData = await targetsResponse.json();

        dashboardData.clues = cluesData.data || [];
        dashboardData.verifiedItems = verifiedData.data || [];
        dashboardData.crawlTargets = targetsData.data || [];

        renderStats();
        renderClueStatus();
        renderCategories();

    } catch (error) {
        document.getElementById("statsBox").innerHTML = `<div class="empty">加载失败，请确认后端已启动。</div>`;
        document.getElementById("clueStatusBox").innerHTML = `<div class="empty">加载失败，请确认后端已启动。</div>`;
        document.getElementById("categoryBox").innerHTML = `<div class="empty">加载失败，请确认后端已启动。</div>`;
    }
}

function renderStats() {
    const clues = dashboardData.clues;
    const verifiedItems = dashboardData.verifiedItems;
    const crawlTargets = dashboardData.crawlTargets;

    const pendingClues = clues.filter(item => item.status !== "已转入真实库").length;
    const approvedClues = clues.filter(item => item.status === "已转入真实库").length;
    const enabledTargets = crawlTargets.filter(item => item.enabled).length;
    const disabledTargets = crawlTargets.filter(item => !item.enabled).length;

    document.getElementById("statsBox").innerHTML = `
        <div class="card">
            <h3>总览</h3>
            <p>线索库总数：${clues.length}</p>
            <p>真实库总数：${verifiedItems.length}</p>
            <p>采集目标总数：${crawlTargets.length}</p>
            <p>待核验线索：${pendingClues}</p>
            <p>已转入真实库线索：${approvedClues}</p>
            <p>启用中的采集目标：${enabledTargets}</p>
            <p>已停用采集目标：${disabledTargets}</p>
        </div>
    `;
}

function renderClueStatus() {
    const statusMap = {};

    dashboardData.clues.forEach(item => {
        const status = item.status || "未知状态";
        statusMap[status] = (statusMap[status] || 0) + 1;
    });

    const rows = Object.keys(statusMap).map(status => `
        <div class="card">
            <span class="tag">${escapeHtml(status)}</span>
            <span>数量：${statusMap[status]}</span>
        </div>
    `).join("");

    document.getElementById("clueStatusBox").innerHTML = rows || `<div class="empty">暂无线索状态数据</div>`;
}

function renderCategories() {
    const categoryMap = {};

    dashboardData.clues.forEach(item => {
        const category = item.category || "未分类";
        categoryMap[category] = (categoryMap[category] || 0) + 1;
    });

    dashboardData.verifiedItems.forEach(item => {
        const category = item.category || "未分类";
        categoryMap[category] = (categoryMap[category] || 0) + 1;
    });

    const rows = Object.keys(categoryMap).map(category => `
        <div class="card">
            <span class="tag">${escapeHtml(category)}</span>
            <span>数量：${categoryMap[category]}</span>
        </div>
    `).join("");

    document.getElementById("categoryBox").innerHTML = rows || `<div class="empty">暂无分类数据</div>`;
}

function downloadBackup() {
    const backup = {
        project: "小谷围岛广州大学城真实生活信息共建系统",
        exported_at: new Date().toISOString(),
        clues: dashboardData.clues,
        verified_items: dashboardData.verifiedItems,
        crawl_targets: dashboardData.crawlTargets
    };

    const content = JSON.stringify(backup, null, 2);
    const blob = new Blob([content], {type: "application/json;charset=utf-8"});
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const filename = `小谷围岛数据备份_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.json`;

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);

    document.getElementById("backupMessage").innerText = `已导出备份文件：${filename}`;
}

async function importBackup() {
    const fileInput = document.getElementById("backupFileInput");
    const messageBox = document.getElementById("importMessage");

    if (!fileInput.files || fileInput.files.length === 0) {
        alert("请先选择一个 JSON 备份文件。");
        return;
    }

    const file = fileInput.files[0];

    try {
        const text = await file.text();
        const backup = JSON.parse(text);

        if (!backup.clues && !backup.verified_items && !backup.crawl_targets) {
            alert("这个 JSON 文件不像是本系统导出的备份文件。");
            return;
        }

        const confirmed = confirm(
            "确认导入这个备份文件吗？\n\n系统会自动跳过重复数据，不会清空现有数据库。"
        );

        if (!confirmed) {
            return;
        }

        messageBox.innerText = "正在导入备份，请稍等...";

        const response = await fetch(`${API_BASE}/backup/import`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                clues: backup.clues || [],
                verified_items: backup.verified_items || [],
                crawl_targets: backup.crawl_targets || []
            })
        });

        const data = await response.json();

        if (response.ok) {
            const result = data.result || {};

            messageBox.innerText =
                "备份导入完成\n" +
                "导入线索：" + (result.imported_clues ?? 0) + "\n" +
                "跳过线索：" + (result.skipped_clues ?? 0) + "\n" +
                "导入真实库：" + (result.imported_verified_items ?? 0) + "\n" +
                "跳过真实库：" + (result.skipped_verified_items ?? 0) + "\n" +
                "导入采集目标：" + (result.imported_crawl_targets ?? 0) + "\n" +
                "跳过采集目标：" + (result.skipped_crawl_targets ?? 0);

            await loadDashboardData();
        } else {
            messageBox.innerText = "导入失败：" + JSON.stringify(data);
        }

    } catch (error) {
        messageBox.innerText = "导入失败，请确认文件是正确的 JSON 备份。\n" + error;
    }
}

function pad(num) {
    return String(num).padStart(2, "0");
}

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}