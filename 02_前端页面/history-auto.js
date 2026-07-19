// history-auto.js
// 自动记录更新历史 V2：
// 1. 监听成功的 POST / PATCH / DELETE 请求
// 2. 写入 update-history
// 3. 修复 POST /clues 返回没有 id 时无法记录历史的问题

(function () {
    if (window.__HISTORY_AUTO_LOADED_V2__) {
        return;
    }

    window.__HISTORY_AUTO_LOADED_V2__ = true;

    const API_BASE = "http://127.0.0.1:8000";
    const ORIGINAL_FETCH = window.fetch;

    window.fetch = async function (url, options = {}) {
        const response = await ORIGINAL_FETCH(url, options);

        try {
            const method = (options.method || "GET").toUpperCase();

            if (["POST", "PATCH", "DELETE"].includes(method)) {
                const responseClone = response.clone();
                const requestBodyText = options.body || "";

                setTimeout(() => {
                    recordHistoryFromRequest(url, options, method, responseClone, requestBodyText);
                }, 0);
            }
        } catch (error) {
            console.log("[历史记录] 自动记录失败", error);
        }

        return response;
    };

    async function recordHistoryFromRequest(url, options, method, responseClone, requestBodyText) {
        if (!responseClone.ok) {
            return;
        }

        const path = getPath(url);

        if (!path || path.includes("/update-history")) {
            return;
        }

        if (isBackendAuditedHistoryPath(path, method)) {
            return;
        }

        const target = inferHistoryTarget(path);

        if (!target) {
            return;
        }

        let responseData = {};

        try {
            responseData = await responseClone.json();
        } catch (error) {
            responseData = {};
        }

        const requestData = parseRequestBody(requestBodyText);

        let finalTargetId = target.target_id || extractIdFromResponse(responseData);
        let title = extractTitleFromResponse(responseData) || requestData.title || requestData.name || requestData.url || target.title || "";

        // 重点修复：POST /clues 如果响应里没有 id，就去 /clues 里找最新同标题线索
        if (!finalTargetId && method === "POST" && path === "/clues") {
            const matchedClue = await findLatestClueByRequest(requestData);

            if (matchedClue) {
                finalTargetId = matchedClue.id;
                title = matchedClue.title || title;
            }
        }

        // 采集目标如果响应里没有 id，也尝试补查
        if (!finalTargetId && method === "POST" && path === "/crawler/targets") {
            const matchedTarget = await findLatestCrawlerTargetByRequest(requestData);

            if (matchedTarget) {
                finalTargetId = matchedTarget.id;
                title = matchedTarget.url || title;
            }
        }

        if (!finalTargetId) {
            console.log("[历史记录] 没有拿到对象 ID，跳过记录", {
                path,
                method,
                responseData,
                requestData
            });
            return;
        }

        const action = inferHistoryAction(path, method);

        const payload = {
            target_type: target.target_type,
            target_id: Number(finalTargetId),
            action: action,
            title: title || "未命名对象",
            detail: `${method} ${path}`,
            operator: "前端自动记录"
        };

        try {
            await ORIGINAL_FETCH(`${API_BASE}/update-history`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            console.log("[历史记录] 已记录", payload);
        } catch (error) {
            console.log("[历史记录] 写入失败", error);
        }
    }

    function getPath(url) {
        try {
            const parsed = new URL(url, window.location.origin);
            return parsed.pathname;
        } catch (error) {
            return String(url || "");
        }
    }

    function parseRequestBody(bodyText) {
        if (!bodyText) {
            return {};
        }

        try {
            return JSON.parse(bodyText);
        } catch (error) {
            return {};
        }
    }

    function inferHistoryTarget(path) {
        const parts = path.split("/").filter(Boolean);

        if (parts.length === 0) {
            return null;
        }

        if (parts[0] === "clues") {
            return {
                target_type: "clue",
                target_id: Number(parts[1]) || null
            };
        }

        if (parts[0] === "admin" && parts[1] === "clues") {
            return {
                target_type: "clue",
                target_id: Number(parts[2]) || null
            };
        }

        if (parts[0] === "verified-items") {
            return {
                target_type: "verified",
                target_id: Number(parts[1]) || null
            };
        }

        if (parts[0] === "map-points") {
            return {
                target_type: "map_point",
                target_id: Number(parts[1]) || null
            };
        }

        if (parts[0] === "routes") {
            return {
                target_type: "route",
                target_id: Number(parts[1]) || null
            };
        }

        if (parts[0] === "feedbacks") {
            return {
                target_type: "feedback",
                target_id: Number(parts[1]) || null
            };
        }

        if (parts[0] === "crawler" && parts[1] === "targets") {
            return {
                target_type: "crawl_target",
                target_id: Number(parts[2]) || null
            };
        }

        return null;
    }

    function isBackendAuditedHistoryPath(path, method) {
        const parts = path.split("/").filter(Boolean);

        if (parts.length === 2 && parts[0] === "clues" && method === "PATCH") {
            return true;
        }

        if (parts.length === 3 && parts[0] === "clues" && parts[2] === "status" && method === "PATCH") {
            return true;
        }

        if (parts.length === 3 && parts[0] === "clues" && parts[2] === "archive" && method === "POST") {
            return true;
        }

        if (parts.length === 3 && parts[0] === "clues" && parts[2] === "restore" && method === "POST") {
            return true;
        }

        if (parts.length === 2 && parts[0] === "clues" && method === "DELETE") {
            return true;
        }

        if (parts.length === 4 && parts[0] === "admin" && parts[1] === "clues" && parts[3] === "approve" && method === "POST") {
            return true;
        }

        if (parts.length === 4 && parts[0] === "collector-admin" && parts[1] === "items" && parts[3] === "to-clue" && method === "POST") {
            return true;
        }

        return false;
    }

    function inferHistoryAction(path, method) {
        if (path.includes("/approve")) return "审核通过";
        if (path.includes("/archive")) return "归档";
        if (path.includes("/restore")) return "恢复";
        if (path.includes("/status")) return "更新状态";
        if (path.includes("/toggle")) return "启用/停用";
        if (method === "POST") return "新增";
        if (method === "PATCH") return "编辑";
        if (method === "DELETE") return "删除";
        return "更新";
    }

    function extractIdFromResponse(data) {
        if (!data) return null;

        if (data.id) return data.id;

        if (data.data && data.data.id) {
            return data.data.id;
        }

        return null;
    }

    function extractTitleFromResponse(data) {
        if (!data) return "";

        const obj = data.data || data;

        return obj.title || obj.name || obj.url || obj.action || "";
    }

    async function findLatestClueByRequest(requestData) {
        try {
            const response = await ORIGINAL_FETCH(`${API_BASE}/clues`);
            const data = await response.json();

            const clues = data.data || [];

            if (clues.length === 0) {
                return null;
            }

            const title = requestData.title || "";
            const summary = requestData.summary || "";

            const matched = clues.find(item => {
                const titleOk = title && item.title === title;
                const summaryOk = summary && item.summary === summary;
                return titleOk || summaryOk;
            });

            return matched || clues[0];

        } catch (error) {
            console.log("[历史记录] 查找最新线索失败", error);
            return null;
        }
    }

    async function findLatestCrawlerTargetByRequest(requestData) {
        try {
            const response = await ORIGINAL_FETCH(`${API_BASE}/crawler/targets`);
            const data = await response.json();

            const targets = data.data || [];

            if (targets.length === 0) {
                return null;
            }

            const url = requestData.url || "";

            const matched = targets.find(item => url && item.url === url);

            return matched || targets[0];

        } catch (error) {
            console.log("[历史记录] 查找采集目标失败", error);
            return null;
        }
    }
})();
