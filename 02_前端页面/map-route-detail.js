// map-route-detail.js
// 地图点详情页 + 路线详情页共用脚本

const MAP_ROUTE_DETAIL_API = "http://127.0.0.1:8000";
const MAP_ROUTE_DETAIL_TOKEN_KEY = "xgw_user_token";

function getMapRouteDetailToken() {
    return localStorage.getItem(MAP_ROUTE_DETAIL_TOKEN_KEY) || "";
}

function getDetailId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
}

async function loadMapPointDetail() {
    const id = getDetailId();
    const box = document.getElementById("detailBox");

    if (!id) {
        box.innerHTML = `<div class="empty">缺少地图点 ID。</div>`;
        return;
    }

    try {
        const response = await fetch(`${MAP_ROUTE_DETAIL_API}/map-points/${id}`);
        const item = await response.json();

        if (!response.ok) {
            box.innerHTML = `<div class="empty">地图点加载失败：${JSON.stringify(item)}</div>`;
            return;
        }

        const mapQuery = buildMapQuery(item);

        box.innerHTML = `
            <div class="card">
                <div>
                    <span class="tag">${escapeDetailHtml(item.map_type || "生活地点")}</span>
                    <span class="tag">${escapeDetailHtml(item.category || "未分类")}</span>
                    <span class="tag ${item.status === "已归档" ? "danger-tag" : ""}">${escapeDetailHtml(item.status || "正常")}</span>
                </div>

                <h2>${escapeDetailHtml(item.name)}</h2>

                <p><strong>ID：</strong>${item.id}</p>
                <p><strong>地址/区域：</strong>${escapeDetailHtml(item.address || "暂无地址")}</p>
                <p><strong>坐标：</strong>${escapeDetailHtml(item.latitude || "暂无纬度")}，${escapeDetailHtml(item.longitude || "暂无经度")}</p>
                <p><strong>来源：</strong>${escapeDetailHtml(item.source || "未知来源")}</p>
                <p><strong>创建时间：</strong>${escapeDetailHtml(item.created_at || "未知")}</p>

                <div class="summary">
                    <strong>说明：</strong><br>
                    ${escapeDetailHtml(item.description || "暂无说明")}
                </div>

                <div class="action-row">
                    <div class="action-title">地图跳转</div>
                    <button class="small-button" onclick="openAmapFromDetail('${escapeJsDetail(mapQuery)}')">高德搜索</button>
                    <button class="small-button" onclick="openBaiduFromDetail('${escapeJsDetail(mapQuery)}')">百度地图</button>
                    ${buildRelatedObjectButton(item)}
                </div>

                <div class="action-row">
                    <div class="action-title">地图点管理</div>
                    ${
                        item.status === "已归档"
                        ? `<button class="small-button approve-button" onclick="restoreMapPointFromDetail(${item.id})">恢复</button>`
                        : `<button class="small-button warn-button" onclick="archiveMapPointFromDetail(${item.id})">归档</button>`
                    }
                    <button class="small-button danger-button" onclick="deleteMapPointFromDetail(${item.id})">彻底删除</button>
                </div>
            </div>
        `;

        await loadDetailHistory("map_point", id);

    } catch (error) {
        box.innerHTML = `<div class="empty">地图点加载失败，请确认后端已启动。${escapeDetailHtml(error.message)}</div>`;
    }
}

async function loadRouteDetail() {
    const id = getDetailId();
    const box = document.getElementById("detailBox");

    if (!id) {
        box.innerHTML = `<div class="empty">缺少路线 ID。</div>`;
        return;
    }

    try {
        const [response, pointResponse] = await Promise.all([
            fetch(`${MAP_ROUTE_DETAIL_API}/routes/${id}`),
            fetch(`${MAP_ROUTE_DETAIL_API}/map-points`)
        ]);
        const item = await response.json();
        const pointData = await pointResponse.json();

        if (!response.ok) {
            box.innerHTML = `<div class="empty">路线加载失败：${JSON.stringify(item)}</div>`;
            return;
        }

        const pointsHtml = buildRouteDetailInlinePoints(item, pointResponse.ok ? (pointData.data || []) : []);

        box.innerHTML = `
            <div class="card">
                <div>
                    <span class="tag">${escapeDetailHtml(item.route_type || "路线")}</span>
                    <span class="tag">${escapeDetailHtml(item.category || "未分类")}</span>
                    <span class="tag ${item.status === "已归档" ? "danger-tag" : ""}">${escapeDetailHtml(item.status || "正常")}</span>
                </div>

                <h2>${escapeDetailHtml(item.name)}</h2>

                <p><strong>ID：</strong>${item.id}</p>
                <p><strong>起点/区域：</strong>${escapeDetailHtml(item.start_area || "暂无起点")}</p>
                <p><strong>地图点 ID：</strong>${escapeDetailHtml(item.point_ids || "暂无地图点")}</p>
                <p><strong>来源：</strong>${escapeDetailHtml(item.source || "未知来源")}</p>
                <p><strong>创建时间：</strong>${escapeDetailHtml(item.created_at || "未知")}</p>

                <div class="summary">
                    <strong>路线说明：</strong><br>
                    ${escapeDetailHtml(item.description || "暂无说明")}
                </div>

                <div class="action-row">
                    <div class="action-title">路线包含的地图点</div>
                    ${pointsHtml || `<div class="empty">暂无已绑定地图点</div>`}
                </div>

                <div class="action-row">
                    <div class="action-title">路线管理</div>
                    ${
                        item.status === "已归档"
                        ? `<button class="small-button approve-button" onclick="restoreRouteFromDetail(${item.id})">恢复</button>`
                        : `<button class="small-button warn-button" onclick="archiveRouteFromDetail(${item.id})">归档</button>`
                    }
                    <button class="small-button danger-button" onclick="deleteRouteFromDetail(${item.id})">彻底删除</button>
                </div>
            </div>
        `;

        await loadDetailHistory("route", id);

    } catch (error) {
        box.innerHTML = `<div class="empty">路线加载失败，请确认后端已启动。${escapeDetailHtml(error.message)}</div>`;
    }
}

async function loadDetailHistory(targetType, targetId) {
    const summaryBox = document.getElementById("detailHistorySummary");
    const listBox = document.getElementById("detailHistoryList");

    if (!summaryBox || !listBox) {
        return;
    }

    try {
        const params = new URLSearchParams();
        params.set("target_type", targetType);
        params.set("target_id", targetId);

        const response = await fetch(`${MAP_ROUTE_DETAIL_API}/update-history?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
            listBox.innerHTML = `<div class="empty">历史加载失败：${JSON.stringify(data)}</div>`;
            return;
        }

        const histories = data.data || [];

        if (histories.length === 0) {
            summaryBox.innerHTML = `<span class="tag">最后更新</span> 暂无历史记录`;
            listBox.innerHTML = `<div class="empty">暂无该条信息的更新历史。</div>`;
            return;
        }

        const latest = histories[0];

        summaryBox.innerHTML = `
            <span class="tag">最后更新</span>
            ${escapeDetailHtml(latest.created_at || "未知时间")}
            <span style="margin-left:8px;">${escapeDetailHtml(latest.action || "更新")}</span>
        `;

        listBox.innerHTML = histories.map(item => `
            <div class="card">
                <div>
                    <span class="tag">${escapeDetailHtml(item.action || "更新")}</span>
                    <span class="tag">ID：${escapeDetailHtml(item.target_id)}</span>
                </div>

                <h3>${escapeDetailHtml(item.title || "未命名对象")}</h3>

                <div>操作人：${escapeDetailHtml(item.operator || "系统")}</div>
                <div>时间：${escapeDetailHtml(item.created_at || "未知")}</div>
                <div class="summary">${escapeDetailHtml(item.detail || "暂无详情")}</div>
            </div>
        `).join("");

    } catch (error) {
        listBox.innerHTML = `<div class="empty">历史加载失败：${escapeDetailHtml(error.message)}</div>`;
    }
}

function buildRelatedObjectButton(item) {
    if (!item.target_type || !item.target_id) {
        return "";
    }

    if (item.target_type === "clue") {
        return `<button class="small-button" onclick="location.href='clue-detail.html?id=${item.target_id}'">查看关联线索</button>`;
    }

    if (item.target_type === "verified") {
        return `<button class="small-button" onclick="location.href='item-detail.html?id=${item.target_id}'">查看关联真实库</button>`;
    }

    return "";
}

function buildRouteDetailInlinePoints(route, allMapPoints) {
    const points = buildRouteDetailInlinePointItems(route, allMapPoints);
    const duplicateNote = hasRouteDetailInlineSameName(points)
        ? `<div class="scene-duplicate-note">存在同名地点，请根据地图点 ID 区分；如为误建，可后续在地图中心清理重复地点。</div>`
        : "";
    return `${duplicateNote}${points.map(point => `
        <div class="target-item scene-linked-point-card">
            <div class="scene-linked-point-head">
                <strong>地图点 #${Number(point.id)} · ${escapeDetailHtml(point.name || "未命名地图点")}</strong>
                <span class="scene-id-badge">#${Number(point.id)}</span>
            </div>
            <div class="scene-point-meta">
                <span>ID：${Number(point.id)}</span>
                <span>分类：${escapeDetailHtml(point.category || "未分类")}</span>
                <span>地址：${escapeDetailHtml(point.address || "暂无地址/区域")}</span>
                <span>来源：${escapeDetailHtml(point.source || "未知来源")}</span>
            </div>
            ${point.missing ? `<div>未找到对应地图点，可能已删除或尚未创建。</div>` : ""}
            <button class="small-button" onclick="location.href='map-detail.html?id=${Number(point.id)}'">${point.missing ? "尝试打开地图点详情" : "查看地图点详情"} #${Number(point.id)}</button>
        </div>
    `).join("")}`;
}

function buildRouteDetailInlinePointItems(route, allMapPoints) {
    const allPointMap = new Map();
    (allMapPoints || []).forEach(point => {
        const id = Number(point && point.id);
        if (id) {
            allPointMap.set(id, point);
        }
    });
    const byId = new Map();
    (route.points || []).forEach(point => {
        const id = Number(point && point.id);
        if (id && !byId.has(id)) {
            const fullPoint = {...(allPointMap.get(id) || {}), ...point};
            byId.set(id, {
                id,
                name: fullPoint.name || "",
                category: fullPoint.category || "",
                address: fullPoint.address || "",
                source: fullPoint.source || "",
                missing: false
            });
        }
    });
    parseRouteDetailInlinePointIds(route.point_ids).forEach(id => {
        if (!byId.has(id)) {
            const point = allPointMap.get(id);
            byId.set(id, {
                id,
                name: point ? (point.name || "") : "",
                category: point ? (point.category || "") : "",
                address: point ? (point.address || "") : "",
                source: point ? (point.source || "") : "",
                missing: !point
            });
        }
    });
    return Array.from(byId.values());
}

function parseRouteDetailInlinePointIds(value) {
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return uniqueRouteDetailInlinePointIds(value);
    }
    const text = String(value || "").trim();
    if (!text) {
        return [];
    }
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
            return uniqueRouteDetailInlinePointIds(parsed);
        }
    } catch (error) {
        // Fall back to separator parsing.
    }
    return uniqueRouteDetailInlinePointIds(text.replace(/[，、;；\s]+/g, ",").split(","));
}

function uniqueRouteDetailInlinePointIds(values) {
    const seen = new Set();
    const result = [];
    values.forEach(value => {
        const id = Number(String(value || "").trim());
        if (Number.isInteger(id) && id > 0 && !seen.has(id)) {
            seen.add(id);
            result.push(id);
        }
    });
    return result;
}

function hasRouteDetailInlineSameName(points) {
    const nameToIds = new Map();
    points.forEach(point => {
        const name = String(point.name || "").trim();
        if (!name) {
            return;
        }
        if (!nameToIds.has(name)) {
            nameToIds.set(name, new Set());
        }
        nameToIds.get(name).add(Number(point.id));
    });
    return Array.from(nameToIds.values()).some(ids => ids.size > 1);
}

function buildMapQuery(item) {
    if (item.latitude && item.longitude) {
        return `${item.latitude},${item.longitude}`;
    }

    return item.address || item.name || "广州大学城";
}

function openAmapFromDetail(query) {
    const url = `https://www.amap.com/search?query=${encodeURIComponent(query || "广州大学城")}`;
    window.open(url, "_blank");
}

function openBaiduFromDetail(query) {
    const encoded = encodeURIComponent(query || "广州大学城");
    const url = `https://map.baidu.com/search/${encoded}?querytype=s&wd=${encoded}`;
    window.open(url, "_blank");
}

async function archiveMapPointFromDetail(id) {
    if (!confirm("确认归档这个地图点吗？")) return;

    const response = await fetch(`${MAP_ROUTE_DETAIL_API}/map-points/${id}/archive?token=${encodeURIComponent(getMapRouteDetailToken())}`, { method: "POST" });

    if (response.ok) {
        alert("地图点已归档。");
        location.reload();
    } else {
        alert("归档失败。");
    }
}

async function restoreMapPointFromDetail(id) {
    if (!confirm("确认恢复这个地图点吗？")) return;

    const response = await fetch(`${MAP_ROUTE_DETAIL_API}/map-points/${id}/restore?token=${encodeURIComponent(getMapRouteDetailToken())}`, { method: "POST" });

    if (response.ok) {
        alert("地图点已恢复。");
        location.reload();
    } else {
        alert("恢复失败。");
    }
}

async function deleteMapPointFromDetail(id) {
    if (!confirm("确认彻底删除这个地图点吗？建议优先归档。")) return;

    const response = await fetch(`${MAP_ROUTE_DETAIL_API}/map-points/${id}?token=${encodeURIComponent(getMapRouteDetailToken())}`, { method: "DELETE" });

    if (response.ok) {
        alert("地图点已删除。");
        location.href = "map.html";
    } else {
        alert("删除失败。");
    }
}

async function archiveRouteFromDetail(id) {
    if (!confirm("确认归档这条路线吗？")) return;

    const response = await fetch(`${MAP_ROUTE_DETAIL_API}/routes/${id}/archive?token=${encodeURIComponent(getMapRouteDetailToken())}`, { method: "POST" });

    if (response.ok) {
        alert("路线已归档。");
        location.reload();
    } else {
        alert("归档失败。");
    }
}

async function restoreRouteFromDetail(id) {
    if (!confirm("确认恢复这条路线吗？")) return;

    const response = await fetch(`${MAP_ROUTE_DETAIL_API}/routes/${id}/restore?token=${encodeURIComponent(getMapRouteDetailToken())}`, { method: "POST" });

    if (response.ok) {
        alert("路线已恢复。");
        location.reload();
    } else {
        alert("恢复失败。");
    }
}

async function deleteRouteFromDetail(id) {
    if (!confirm("确认彻底删除这条路线吗？建议优先归档。")) return;

    const response = await fetch(`${MAP_ROUTE_DETAIL_API}/routes/${id}?token=${encodeURIComponent(getMapRouteDetailToken())}`, { method: "DELETE" });

    if (response.ok) {
        alert("路线已删除。");
        location.href = "route.html";
    } else {
        alert("删除失败。");
    }
}

function escapeDetailHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeJsDetail(text) {
    return String(text || "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/"/g, "&quot;")
        .replace(/\n/g, " ");
}
