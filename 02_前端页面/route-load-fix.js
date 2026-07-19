// route-load-fix.js
// 修复路线中心“可选地图点一直加载”的问题，并显示具体错误。

const ROUTE_LOAD_FIX_API = "http://127.0.0.1:8000";

window.loadSelectableMapPoints = async function () {
    const box = document.getElementById("selectableMapPointList");

    if (!box) {
        return;
    }

    const keywordInput = document.getElementById("routeMapKeyword");
    const keyword = keywordInput ? keywordInput.value.trim() : "";

    box.innerHTML = `<div class="empty">正在加载地图点，请稍等...</div>`;

    const params = new URLSearchParams();
    params.set("status", "正常");

    if (keyword) {
        params.set("keyword", keyword);
    }

    try {
        const url = `${ROUTE_LOAD_FIX_API}/map-points?${params.toString()}`;
        const response = await fetch(url);

        const data = await response.json();

        if (!response.ok) {
            box.innerHTML = `<div class="empty">地图点加载失败：${JSON.stringify(data)}</div>`;
            return;
        }

        const points = data.data || [];

        if (points.length === 0) {
            box.innerHTML = `
                <div class="empty">
                    暂无可选地图点。请先去地图中心新增地图点，或者检查地图点是否为“正常”状态。
                </div>
            `;
            return;
        }

        box.innerHTML = points.map(point => `
            <div class="card">
                <div>
                    <span class="tag">${escapeRouteLoadHtml(point.map_type || "生活地点")}</span>
                    <span class="tag">${escapeRouteLoadHtml(point.category || "未分类")}</span>
                    <span class="tag">${escapeRouteLoadHtml(point.status || "正常")}</span>
                </div>

                <h3>${escapeRouteLoadHtml(point.name)}</h3>
                <div>ID：${point.id}</div>
                <div>地址：${escapeRouteLoadHtml(point.address || "暂无地址")}</div>
                <div class="summary">${escapeRouteLoadHtml(point.description || "暂无说明")}</div>

                <button class="small-button" onclick="addPointToRouteDraft(${point.id})">加入路线草稿</button>
                <button class="small-button" onclick="location.href='map.html'">去地图中心</button>
            </div>
        `).join("");

    } catch (error) {
        box.innerHTML = `
            <div class="empty">
                地图点加载失败：${escapeRouteLoadHtml(error.message)}
                <br>
                请确认后端已启动，并且 http://127.0.0.1:8000/docs 能打开。
            </div>
        `;
    }
};

window.loadRoutes = async function () {
    const box = document.getElementById("routeList");

    if (!box) {
        return;
    }

    const keywordInput = document.getElementById("routeKeyword");
    const keyword = keywordInput ? keywordInput.value.trim() : "";

    const params = new URLSearchParams();

    if (keyword) {
        params.set("keyword", keyword);
    }

    if (window.currentRouteType && window.currentRouteType !== "全部") {
        params.set("route_type", window.currentRouteType);
    }

    if (window.currentRouteStatus && window.currentRouteStatus !== "全部") {
        params.set("status", window.currentRouteStatus);
    } else {
        params.set("status", "正常");
    }

    box.innerHTML = `<div class="empty">正在加载路线，请稍等...</div>`;

    try {
        const url = `${ROUTE_LOAD_FIX_API}/routes?${params.toString()}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            box.innerHTML = `<div class="empty">路线加载失败：${JSON.stringify(data)}</div>`;
            return;
        }

        const routes = data.data || [];

        if (routes.length === 0) {
            box.innerHTML = `<div class="empty">当前筛选下暂无路线。</div>`;
            return;
        }

        if (typeof renderRouteCard === "function") {
            box.innerHTML = routes.map(route => renderRouteCard(route)).join("");
        } else {
            box.innerHTML = routes.map(route => `
                <div class="card">
                    <h3>${escapeRouteLoadHtml(route.name)}</h3>
                    <div>路线类型：${escapeRouteLoadHtml(route.route_type || "路线")}</div>
                    <div>起点：${escapeRouteLoadHtml(route.start_area || "暂无起点")}</div>
                    <div class="summary">${escapeRouteLoadHtml(route.description || "暂无说明")}</div>
                </div>
            `).join("");
        }

    } catch (error) {
        box.innerHTML = `
            <div class="empty">
                路线加载失败：${escapeRouteLoadHtml(error.message)}
                <br>
                请确认后端已启动，并且 /docs 能打开。
            </div>
        `;
    }
};

function escapeRouteLoadHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}