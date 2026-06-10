const COLLECTOR_TOKEN_KEY = "xgw_user_token";
const COLLECTOR_BACKEND_URL = "http://127.0.0.1:8000";
const COLLECTOR_NETWORK_MESSAGE = "无法连接后端，请确认 http://127.0.0.1:8000 已启动";

function collectorToken() {
    if (typeof getAdminToken === "function") {
        return getAdminToken();
    }
    return localStorage.getItem(COLLECTOR_TOKEN_KEY) || "";
}

function collectorApiBase() {
    if (typeof API_BASE !== "undefined") {
        return API_BASE;
    }
    return COLLECTOR_BACKEND_URL;
}

function collectorMessage(text, isError = false) {
    const box = document.getElementById("collectorMessage");
    if (!box) return;
    box.textContent = text || "";
    box.classList.toggle("user-admin-message-error", Boolean(isError));
}

function collectorDetectMessage(text, isError = false) {
    const box = document.getElementById("collectorDetectMessage");
    if (!box) return;
    box.textContent = text || "";
    box.classList.toggle("user-admin-message-error", Boolean(isError));
}

function collectorErrorMessage(error) {
    if (error && error.isNetworkError) {
        return COLLECTOR_NETWORK_MESSAGE;
    }
    const message = error && error.message ? error.message : "";
    if (message === "Failed to fetch" || message === "NetworkError when attempting to fetch resource.") {
        return COLLECTOR_NETWORK_MESSAGE;
    }
    return message || "请求失败";
}

async function collectorRequest(path, options = {}) {
    try {
        const response = await fetch(`${collectorApiBase()}${path}`, options);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const detail = data.detail || data.message || "请求失败";
            throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
        }
        return data;
    } catch (error) {
        if (error instanceof TypeError) {
            const networkError = new Error(COLLECTOR_NETWORK_MESSAGE);
            networkError.isNetworkError = true;
            throw networkError;
        }
        throw error;
    }
}

async function initCollectorPage() {
    collectorMessage("");
    collectorDetectMessage("");
    await Promise.all([
        loadCollectorSources(),
        loadCollectorItems(),
        loadCollectorRuns()
    ]);
}

async function loadCollectorSources() {
    const box = document.getElementById("collectorSourceList");
    if (!box) return;
    box.innerHTML = `<div class="empty">正在加载采集源...</div>`;

    try {
        const data = await collectorRequest(`/collector-admin/sources?token=${encodeURIComponent(collectorToken())}`);
        renderCollectorSources(data.data || []);
    } catch (error) {
        box.innerHTML = `<div class="empty">采集源加载失败：${collectorEscapeHtml(collectorErrorMessage(error))}</div>`;
    }
}

async function detectCollectorSource() {
    const urlInput = document.getElementById("collectorUrl");
    const url = urlInput ? urlInput.value.trim() : "";

    if (!url) {
        collectorDetectMessage("请先填写需要识别的公开 URL。", true);
        return;
    }

    collectorDetectMessage("正在识别采集源...");
    try {
        const data = await collectorRequest("/collector-admin/detect-source", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                token: collectorToken(),
                url
            })
        });

        if (!data.ok) {
            collectorDetectMessage(data.message || "无法识别该公开 URL，或请求超时", true);
            return;
        }

        setInputValue("collectorType", data.source_type || "", true);
        setInputValue("collectorPlatform", data.platform || "", false);
        setInputValue("collectorName", data.name || data.title || "", false);

        const keywordInput = document.getElementById("collectorKeyword");
        if (keywordInput && !keywordInput.value.trim() && data.keyword_suggestion) {
            keywordInput.value = data.keyword_suggestion;
        }

        collectorDetectMessage(
            `识别成功：类型 ${data.source_type || "-"}，平台 ${data.platform || "-"}，标题 ${data.title || data.name || "-"}`
        );
    } catch (error) {
        collectorDetectMessage(`识别失败：${collectorErrorMessage(error)}`, true);
    }
}

function setInputValue(id, value, alwaysReplace) {
    const input = document.getElementById(id);
    if (!input || !value) return;
    if (alwaysReplace || !input.value.trim()) {
        input.value = value;
    }
}

async function submitCollectorSource() {
    const name = document.getElementById("collectorName").value.trim();
    const platform = document.getElementById("collectorPlatform").value.trim();
    const sourceType = document.getElementById("collectorType").value;
    const url = document.getElementById("collectorUrl").value.trim();
    const keyword = document.getElementById("collectorKeyword").value.trim();
    const enabled = document.getElementById("collectorEnabled").value === "true";
    const notes = document.getElementById("collectorNotes").value.trim();

    if (!name || !url) {
        collectorMessage("请填写名称和 URL。", true);
        return;
    }

    try {
        await collectorRequest("/collector-admin/sources", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                token: collectorToken(),
                name,
                platform,
                source_type: sourceType,
                url,
                keyword,
                enabled,
                interval_hours: 24,
                notes
            })
        });
        collectorMessage("采集源已新增。");
        collectorDetectMessage("");
        document.getElementById("collectorName").value = "";
        document.getElementById("collectorPlatform").value = "";
        document.getElementById("collectorUrl").value = "";
        document.getElementById("collectorKeyword").value = "";
        document.getElementById("collectorNotes").value = "";
        await loadCollectorSources();
    } catch (error) {
        collectorMessage(`新增失败：${collectorErrorMessage(error)}`, true);
    }
}

async function toggleCollectorSource(sourceId, enabled) {
    try {
        await collectorRequest(`/collector-admin/sources/${sourceId}`, {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                token: collectorToken(),
                enabled
            })
        });
        collectorMessage(enabled ? "采集源已启用。" : "采集源已停用。");
        await loadCollectorSources();
    } catch (error) {
        collectorMessage(`切换失败：${collectorErrorMessage(error)}`, true);
    }
}

async function runCollectorSource(sourceId) {
    collectorMessage("正在运行采集源，请稍等...");
    try {
        const data = await collectorRequest(`/collector-admin/sources/${sourceId}/run`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({token: collectorToken()})
        });
        const run = data.result && data.result.run ? data.result.run : {};
        collectorMessage(`采集完成：状态 ${run.status || "-"}，新增 ${run.item_count ?? 0} 条。`);
        await Promise.all([loadCollectorSources(), loadCollectorItems(), loadCollectorRuns()]);
    } catch (error) {
        collectorMessage(`运行失败：${collectorErrorMessage(error)}`, true);
        await loadCollectorRuns();
    }
}

async function runAllCollectorSources() {
    collectorMessage("正在运行全部启用采集源，请稍等...");
    try {
        const data = await collectorRequest("/collector-admin/run-all", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({token: collectorToken()})
        });
        const result = data.result || {};
        collectorMessage(`全部运行完成：源 ${result.total_sources ?? 0} 个，新增 ${result.item_count ?? 0} 条，失败 ${result.failed_count ?? 0} 个。`);
        await Promise.all([loadCollectorSources(), loadCollectorItems(), loadCollectorRuns()]);
    } catch (error) {
        collectorMessage(`全部运行失败：${collectorErrorMessage(error)}`, true);
        await loadCollectorRuns();
    }
}

function renderCollectorSources(sources) {
    const box = document.getElementById("collectorSourceList");
    if (!box) return;

    if (!sources.length) {
        box.innerHTML = `<div class="empty">暂无采集源。请新增公开 RSS、公开 API 或公开 HTML 列表页。</div>`;
        return;
    }

    box.innerHTML = sources.map(source => `
        <div class="target-item">
            <div>
                <span class="tag">${collectorEscapeHtml(source.source_type || "-")}</span>
                <span class="tag ${source.enabled ? "" : "danger-tag"}">${source.enabled ? "启用中" : "已停用"}</span>
                <strong>${collectorEscapeHtml(source.name || "未命名采集源")}</strong>
            </div>
            <div class="target-url">${collectorEscapeHtml(source.url || "")}</div>
            <div>平台：${collectorEscapeHtml(source.platform || "未填写")}</div>
            <div>关键词：${collectorEscapeHtml(source.keyword || "使用默认大学城关键词")}</div>
            <div>最近运行：${collectorEscapeHtml(source.last_run_at || "尚未运行")}</div>
            <div>备注：${collectorEscapeHtml(source.notes || "暂无备注")}</div>
            <button class="small-button" onclick="toggleCollectorSource(${source.id}, ${source.enabled ? "false" : "true"})">${source.enabled ? "停用" : "启用"}</button>
            <button class="small-button verify-button" onclick="runCollectorSource(${source.id})">运行单个源</button>
        </div>
    `).join("");
}

async function loadCollectorItems() {
    const box = document.getElementById("collectorItemList");
    if (!box) return;
    box.innerHTML = `<div class="empty">正在加载采集条目...</div>`;

    const keywordInput = document.getElementById("collectorItemKeyword");
    const statusInput = document.getElementById("collectorItemStatus");
    const keyword = keywordInput ? keywordInput.value.trim() : "";
    const status = statusInput ? statusInput.value : "";
    const query = new URLSearchParams({
        token: collectorToken(),
        limit: "50",
        offset: "0"
    });
    if (keyword) query.set("keyword", keyword);
    if (status) query.set("status", status);

    try {
        const data = await collectorRequest(`/collector-admin/items?${query.toString()}`);
        renderCollectorItems(data.data || []);
    } catch (error) {
        box.innerHTML = `<div class="empty">采集条目加载失败：${collectorEscapeHtml(collectorErrorMessage(error))}</div>`;
    }
}

function renderCollectorItems(items) {
    const box = document.getElementById("collectorItemList");
    if (!box) return;

    if (!items.length) {
        box.innerHTML = `<div class="empty">暂无采集条目。</div>`;
        return;
    }

    box.innerHTML = items.map(item => `
        <div class="card">
            <div>
                <span class="tag">${collectorEscapeHtml(item.status || "new")}</span>
                <span class="tag">${collectorEscapeHtml(item.platform || "未知平台")}</span>
                <strong>${collectorEscapeHtml(item.title || "未命名条目")}</strong>
            </div>
            <div class="target-url">${item.url ? `<a href="${collectorEscapeAttribute(item.url)}" target="_blank" rel="noopener noreferrer">${collectorEscapeHtml(item.url)}</a>` : "无链接"}</div>
            <div class="summary">${collectorEscapeHtml(item.summary || "暂无摘要")}</div>
            <div class="notice">来源：${collectorEscapeHtml(item.source_name || String(item.source_id || "-"))} · 发布时间：${collectorEscapeHtml(item.published_at || "-")} · 抓取时间：${collectorEscapeHtml(item.fetched_at || "-")}</div>
        </div>
    `).join("");
}

async function loadCollectorRuns() {
    const box = document.getElementById("collectorRunList");
    if (!box) return;
    box.innerHTML = `<div class="empty">正在加载运行日志...</div>`;

    try {
        const data = await collectorRequest(`/collector-admin/runs?token=${encodeURIComponent(collectorToken())}&limit=50&offset=0`);
        renderCollectorRuns(data.data || []);
    } catch (error) {
        box.innerHTML = `<div class="empty">运行日志加载失败：${collectorEscapeHtml(collectorErrorMessage(error))}</div>`;
    }
}

function renderCollectorRuns(runs) {
    const box = document.getElementById("collectorRunList");
    if (!box) return;

    if (!runs.length) {
        box.innerHTML = `<div class="empty">暂无运行日志。</div>`;
        return;
    }

    box.innerHTML = `
        <div class="user-admin-table-wrap">
            <table class="user-admin-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>采集源</th>
                        <th>状态</th>
                        <th>新增</th>
                        <th>开始</th>
                        <th>结束</th>
                        <th>错误</th>
                    </tr>
                </thead>
                <tbody>
                    ${runs.map(run => `
                        <tr>
                            <td>${run.id}</td>
                            <td>${collectorEscapeHtml(run.source_name || String(run.source_id || "-"))}</td>
                            <td>${collectorEscapeHtml(run.status || "-")}</td>
                            <td>${run.item_count ?? 0}</td>
                            <td>${collectorEscapeHtml(run.started_at || "-")}</td>
                            <td>${collectorEscapeHtml(run.finished_at || "-")}</td>
                            <td>${collectorEscapeHtml(run.error_message || "")}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

function collectorEscapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function collectorEscapeAttribute(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
