// history-inline.js
// 详情页内嵌更新历史模块：
// 在 clue-detail.html / item-detail.html 中显示当前对象的独立更新历史。

(function () {
    const API_BASE = "http://127.0.0.1:8000";

    window.addEventListener("load", () => {
        setTimeout(loadInlineHistory, 500);
    });

    async function loadInlineHistory() {
        const target = detectCurrentDetailTarget();

        if (!target) {
            return;
        }

        injectInlineHistoryBox();

        const listBox = document.getElementById("inlineHistoryList");
        const summaryBox = document.getElementById("inlineHistorySummary");

        if (!listBox || !summaryBox) {
            return;
        }

        listBox.innerHTML = `<div class="empty">正在加载该条信息的更新历史...</div>`;

        try {
            const params = new URLSearchParams();
            params.set("target_type", target.targetType);
            params.set("target_id", target.targetId);

            const response = await fetch(`${API_BASE}/update-history?${params.toString()}`);
            const data = await response.json();

            if (!response.ok) {
                listBox.innerHTML = `<div class="empty">加载失败：${JSON.stringify(data)}</div>`;
                return;
            }

            const histories = data.data || [];

            if (histories.length === 0) {
                summaryBox.innerHTML = `
                    <span class="tag">最后更新</span>
                    暂无历史记录
                `;

                listBox.innerHTML = `
                    <div class="empty">
                        暂无该条信息的更新历史。之后新增、编辑、归档、恢复、审核等操作会自动记录在这里。
                    </div>
                `;
                return;
            }

            const latest = histories[0];

            summaryBox.innerHTML = `
                <span class="tag">最后更新</span>
                ${escapeInlineHistoryHtml(latest.created_at || "未知时间")}
                <span style="margin-left:8px;">${escapeInlineHistoryHtml(latest.action || "更新")}</span>
            `;

            listBox.innerHTML = histories.map(item => `
                <div class="card">
                    <div>
                        <span class="tag">${escapeInlineHistoryHtml(item.action || "更新")}</span>
                        <span class="tag">ID：${escapeInlineHistoryHtml(item.target_id)}</span>
                    </div>

                    <h3>${escapeInlineHistoryHtml(item.title || "未命名对象")}</h3>

                    <div>操作人：${escapeInlineHistoryHtml(item.operator || "系统")}</div>
                    <div>时间：${escapeInlineHistoryHtml(item.created_at || "未知")}</div>
                    <div class="summary">${escapeInlineHistoryHtml(item.detail || "暂无详情")}</div>
                </div>
            `).join("");

        } catch (error) {
            listBox.innerHTML = `
                <div class="empty">
                    更新历史加载失败：${escapeInlineHistoryHtml(error.message)}
                    <br>
                    请确认后端已启动，并且 /docs 能打开。
                </div>
            `;
        }
    }

    function detectCurrentDetailTarget() {
        const params = new URLSearchParams(window.location.search);
        const id = params.get("id");

        if (!id) {
            return null;
        }

        const path = window.location.pathname;

        if (path.includes("clue-detail")) {
            return {
                targetType: "clue",
                targetId: id
            };
        }

        if (path.includes("item-detail")) {
            return {
                targetType: "verified",
                targetId: id
            };
        }

        return null;
    }

    function injectInlineHistoryBox() {
        if (document.getElementById("inlineHistoryBox")) {
            return;
        }

        const container = document.querySelector(".container");

        if (!container) {
            return;
        }

        const section = document.createElement("div");
        section.className = "section";
        section.id = "inlineHistoryBox";

        section.innerHTML = `
            <h2>该条信息的更新历史</h2>
            <div id="inlineHistorySummary" class="card">正在加载最后更新时间...</div>
            <div id="inlineHistoryList" class="empty">正在加载更新历史...</div>
        `;

        container.appendChild(section);
    }

    function escapeInlineHistoryHtml(text) {
        return String(text || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
})();