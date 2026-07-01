(function () {
    const API_BASE_URL = "http://127.0.0.1:8000";
    const ALL = "全部";
    const NORMAL = "正常";
    const ARCHIVED = "已归档";

    const mapState = {
        scene: ALL,
        category: ALL,
        status: NORMAL,
        points: [],
        routeUsage: new Map(),
        routesLoaded: false,
        routeLoadFailed: false,
        pendingCreatedId: null,
        pendingFallback: false
    };

    const routeState = {
        scene: ALL,
        routeType: ALL,
        status: NORMAL,
        routes: [],
        pendingCreatedId: null,
        pendingFallback: false
    };

    const mapSceneRules = [
        {name: "吃饭", keywords: ["食堂", "餐", "饭", "奶茶", "糖水", "美食", "探店", "夜宵", "烧烤", "简餐"]},
        {name: "交通", keywords: ["地铁", "公交", "校车", "交通", "车站", "站点", "出行", "通勤", "换乘"]},
        {name: "宿舍", keywords: ["宿舍", "公寓", "居住", "租房", "住宿", "寝室"]},
        {name: "维修", keywords: ["维修", "报修", "修理", "水电", "漏水", "故障"]},
        {name: "医疗", keywords: ["医院", "门诊", "就医", "药店", "诊所", "医保", "校医院"]},
        {name: "快递", keywords: ["快递", "驿站", "取件", "寄件", "包裹"]},
        {name: "活动", keywords: ["活动", "讲座", "展览", "社团", "演出", "比赛"]},
        {name: "政务", keywords: ["政务", "街道", "办事处", "社区", "证明", "居委", "服务中心"]},
        {name: "学习", keywords: ["图书馆", "自习", "教室", "学习", "打印", "复印", "教学楼"]},
        {name: "购物", keywords: ["商店", "超市", "购物", "市场", "便利店", "水果"]},
        {name: "运动", keywords: ["运动", "球场", "体育", "健身", "操场", "游泳"]},
        {name: "其他", keywords: []}
    ];

    const routeSceneRules = [
        {name: "新生办事路线", keywords: ["新生", "入学", "报到", "注册", "证件", "办事", "迎新"]},
        {name: "吃饭路线", keywords: ["美食", "饭", "餐", "食堂", "夜宵", "奶茶", "糖水"]},
        {name: "就医路线", keywords: ["医院", "就医", "门诊", "药店", "校医院", "医保"]},
        {name: "通勤路线", keywords: ["通勤", "地铁", "公交", "校车", "交通", "换乘"]},
        {name: "夜间安全路线", keywords: ["夜间", "晚上", "安全", "避坑", "照明", "夜归"]},
        {name: "快递取件路线", keywords: ["快递", "驿站", "取件", "寄件", "包裹"]},
        {name: "校园服务路线", keywords: ["校园服务", "服务", "打印", "维修", "宿舍", "办卡"]},
        {name: "周末 citywalk 路线", keywords: ["citywalk", "周末", "游玩", "散步", "逛", "骑行"]},
        {name: "政务办事路线", keywords: ["政务", "街道", "社区", "办事", "证明", "服务中心"]},
        {name: "其他路线", keywords: []}
    ];

    window.setMapScene = function (scene) {
        mapState.scene = scene || ALL;
        updateSceneChips("mapSceneFilters", mapState.scene);
        renderMapSceneView();
    };

    window.setMapCategory = function (category) {
        mapState.category = category || ALL;
        updateMapFilterButtons();
        loadMapPoints();
    };

    window.setMapStatus = function (status) {
        mapState.status = status || NORMAL;
        updateMapFilterButtons();
        loadMapPoints();
    };

    window.updateMapFilterButtons = function () {
        updateLegacyButtons("mapCat", mapState.category);
        updateLegacyButtons("mapStatus", mapState.status);
        updateSceneChips("mapSceneFilters", mapState.scene);
    };

    window.loadMapPoints = async function () {
        const box = document.getElementById("mapPointList");
        if (!box) {
            return;
        }

        const keywordInput = document.getElementById("mapKeyword");
        const keyword = keywordInput ? keywordInput.value.trim() : "";
        const params = new URLSearchParams();

        if (keyword) {
            params.set("keyword", keyword);
        }
        if (mapState.category !== ALL) {
            params.set("category", mapState.category);
        }
        if (mapState.status !== ALL) {
            params.set("status", mapState.status);
        }

        box.innerHTML = `<div class="empty loading">正在加载生活场景地点...</div>`;

        try {
            const response = await fetch(`${API_BASE_URL}/map-points?${params.toString()}`);
            const data = await response.json();
            if (!response.ok) {
                box.innerHTML = `<div class="empty">地图点加载失败：${escapeSceneHtml(JSON.stringify(data))}</div>`;
                return;
            }

            mapState.points = (data.data || []).map(point => ({
                ...point,
                scene: inferMapScene(point)
            }));
            loadMapRouteUsage();
            renderMapSceneView();
        } catch (error) {
            box.innerHTML = `<div class="empty">地图点加载失败，请确认后端已启动。</div>`;
            renderMapDedupeView();
        }
    };

    window.setRouteScene = function (scene) {
        routeState.scene = scene || ALL;
        updateSceneChips("routeSceneFilters", routeState.scene);
        renderRouteSceneView();
    };

    window.setRouteType = function (type) {
        routeState.routeType = type || ALL;
        window.currentRouteType = routeState.routeType;
        updateRouteFilterButtons();
        loadRoutes();
    };

    window.setRouteStatus = function (status) {
        routeState.status = status || NORMAL;
        window.currentRouteStatus = routeState.status;
        updateRouteFilterButtons();
        loadRoutes();
    };

    window.updateRouteFilterButtons = function () {
        updateLegacyButtons("routeType", routeState.routeType);
        updateLegacyButtons("routeStatus", routeState.status);
        updateSceneChips("routeSceneFilters", routeState.scene);
    };

    window.loadRoutePage = async function () {
        if (typeof window.loadSelectableMapPoints === "function") {
            await window.loadSelectableMapPoints();
        }
        await loadRoutes();
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
        if (routeState.routeType !== ALL) {
            params.set("route_type", routeState.routeType);
        }
        if (routeState.status !== ALL) {
            params.set("status", routeState.status);
        }

        box.innerHTML = `<div class="empty loading">正在加载生活场景路线...</div>`;

        try {
            const response = await fetch(`${API_BASE_URL}/routes?${params.toString()}`);
            const data = await response.json();
            if (!response.ok) {
                box.innerHTML = `<div class="empty">路线加载失败：${escapeSceneHtml(JSON.stringify(data))}</div>`;
                return;
            }

            routeState.routes = (data.data || []).map(route => ({
                ...route,
                scene: inferRouteScene(route)
            }));
            renderRouteSceneView();
        } catch (error) {
            box.innerHTML = `<div class="empty">路线加载失败，请确认后端已启动。</div>`;
        }
    };

    window.renderMapPointCard = renderSceneMapPointCard;
    window.renderRouteCard = renderSceneRouteCard;
    window.showMapSceneModule = function (name) {
        showSceneModule("map", name || "overview");
    };
    window.showRouteSceneModule = function (name) {
        showSceneModule("route", name || "overview");
    };

    document.addEventListener("DOMContentLoaded", () => {
        initMapSceneTabs();
        initRouteSceneTabs();
    });

    window.createMapPoint = async function () {
        const name = getInputValue("mapName");
        const category = getInputValue("mapCategory");
        const address = getInputValue("mapAddress");
        const latitude = getInputValue("mapLatitude");
        const longitude = getInputValue("mapLongitude");
        const mapType = getInputValue("mapType");
        const targetType = getInputValue("mapTargetType");
        const targetIdText = getInputValue("mapTargetId");
        const source = getInputValue("mapSource");
        const description = getInputValue("mapDescription");

        if (!name) {
            showSceneNotice("mapMessage", "请填写地点名称。", true);
            return;
        }

        const payload = {
            token: typeof getMapAdminToken === "function" ? getMapAdminToken() : "",
            name,
            category,
            address: address || null,
            latitude: latitude || null,
            longitude: longitude || null,
            map_type: mapType || "生活地点",
            target_type: targetType || null,
            target_id: targetIdText ? Number(targetIdText) : null,
            source: source || "手动添加",
            description: description || null
        };

        showSceneNotice("mapMessage", "正在添加地图点...");

        try {
            const response = await fetch(`${API_BASE_URL}/map-points`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(payload)
            });
            const data = await response.json();

            if (!response.ok) {
                showSceneNotice("mapMessage", `新增地图点失败：${JSON.stringify(data)}`, true);
                return;
            }

            clearMapCreateForm();
            await afterMapPointCreated(data.data || {});
        } catch (error) {
            showSceneNotice("mapMessage", "新增地图点失败，请确认后端已启动。", true);
        }
    };

    window.createRoute = async function () {
        const name = getInputValue("routeName");
        const routeType = getInputValue("routeType");
        const category = getInputValue("routeCategory");
        const startArea = getInputValue("routeStartArea");
        const pointIds = getInputValue("routePointIds");
        const source = getInputValue("routeSource");
        const description = getInputValue("routeDescription");

        if (!name) {
            showSceneNotice("routeMessage", "请填写路线名称。", true);
            return;
        }

        showSceneNotice("routeMessage", "正在添加路线...");

        try {
            const response = await fetch(`${API_BASE_URL}/routes`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    token: typeof getRouteAdminToken === "function" ? getRouteAdminToken() : "",
                    name,
                    route_type: routeType || "citywalk路线",
                    category,
                    start_area: startArea || null,
                    point_ids: pointIds || null,
                    source: source || "手动添加",
                    description: description || null
                })
            });
            const data = await response.json();

            if (!response.ok) {
                showSceneNotice("routeMessage", `新增路线失败：${JSON.stringify(data)}`, true);
                return;
            }

            if (typeof clearRouteDraft === "function") {
                clearRouteDraft();
            } else {
                clearRouteCreateForm();
            }
            await afterRoutePlanCreated(data.data || {});
        } catch (error) {
            showSceneNotice("routeMessage", "新增路线失败，请确认后端已启动。", true);
        }
    };

    function renderMapSceneView() {
        const box = document.getElementById("mapPointList");
        if (!box) {
            return;
        }

        renderMapStats(mapState.points);
        renderMapOverviewPreview(mapState.points);
        renderMapDedupeView();
        updateMapFilterButtons();

        const visiblePoints = mapState.scene === ALL
            ? mapState.points
            : mapState.points.filter(point => point.scene === mapState.scene);

        if (visiblePoints.length === 0) {
            box.innerHTML = `<div class="empty">当前暂无地点数据，可从真实库或用户反馈中整理地点。</div>`;
            focusPendingMapPoint();
            return;
        }

        box.innerHTML = visiblePoints.map(renderSceneMapPointCard).join("");
        focusPendingMapPoint();
    }

    function renderRouteSceneView() {
        const box = document.getElementById("routeList");
        if (!box) {
            return;
        }

        renderRouteStats(routeState.routes);
        renderRouteOverviewPreview(routeState.routes);
        updateRouteFilterButtons();

        const visibleRoutes = routeState.scene === ALL
            ? routeState.routes
            : routeState.routes.filter(route => route.scene === routeState.scene);

        if (visibleRoutes.length === 0) {
            box.innerHTML = `<div class="empty">当前暂无路线数据，可先从真实生活信息中整理路线。</div>`;
            focusPendingRoute();
            return;
        }

        box.innerHTML = visibleRoutes.map(renderSceneRouteCard).join("");
        focusPendingRoute();
    }

    function renderMapStats(points) {
        const box = document.getElementById("mapSceneStats");
        if (!box) {
            return;
        }

        const counts = countByScene(points, mapSceneRules);
        const focus = ["全部", "吃饭", "交通", "政务", "医疗", "活动"];
        box.innerHTML = focus.map(name => {
            const value = name === ALL ? points.length : counts[name] || 0;
            return `<div class="scene-stat-card"><strong>${value}</strong><span>${escapeSceneHtml(name === ALL ? "地点总数" : name)}</span></div>`;
        }).join("");
    }

    async function loadMapRouteUsage() {
        const summaryBox = document.getElementById("mapDedupeSummary");
        const listBox = document.getElementById("mapDedupeList");
        if (!summaryBox && !listBox) {
            return;
        }

        mapState.routesLoaded = false;
        mapState.routeLoadFailed = false;

        try {
            const response = await fetch(`${API_BASE_URL}/routes`);
            const data = await response.json();
            if (!response.ok) {
                mapState.routeUsage = new Map();
                mapState.routeLoadFailed = true;
                renderMapDedupeView();
                return;
            }

            mapState.routeUsage = buildMapRouteUsage(data.data || []);
            mapState.routesLoaded = true;
            mapState.routeLoadFailed = false;
            renderMapDedupeView();
        } catch (error) {
            mapState.routeUsage = new Map();
            mapState.routeLoadFailed = true;
            renderMapDedupeView();
        }
    }

    function buildMapRouteUsage(routes) {
        const usage = new Map();
        (routes || []).forEach(route => {
            const routeId = Number(route.id);
            if (!routeId) {
                return;
            }
            const pointIds = new Set([
                ...(route.points || []).map(point => Number(point.id)).filter(Boolean),
                ...parseRoutePointIds(route.point_ids)
            ]);
            pointIds.forEach(pointId => {
                if (!usage.has(pointId)) {
                    usage.set(pointId, []);
                }
                if (!usage.get(pointId).some(item => Number(item.id) === routeId)) {
                    usage.get(pointId).push(route);
                }
            });
        });
        return usage;
    }

    function renderMapDedupeView() {
        const summaryBox = document.getElementById("mapDedupeSummary");
        const listBox = document.getElementById("mapDedupeList");
        if (!summaryBox || !listBox) {
            return;
        }

        const groups = buildMapDedupeGroups(mapState.points);
        const strongCount = groups.filter(group => group.type === "strong").length;
        const weakCount = groups.filter(group => group.type === "weak").length;
        const pointCount = new Set(groups.flatMap(group => group.points.map(point => Number(point.id)))).size;

        summaryBox.innerHTML = [
            ["重复组总数", groups.length],
            ["涉及地图点", pointCount],
            ["强疑似重复", strongCount],
            ["弱疑似重复", weakCount]
        ].map(([label, value]) => `<div class="scene-stat-card"><strong>${value}</strong><span>${label}</span></div>`).join("");

        if (groups.length === 0) {
            listBox.className = "scene-empty-state";
            listBox.innerHTML = "暂无疑似重复地点。后续新增地点后，系统会自动根据名称和地址识别可能重复的记录。";
            return;
        }

        listBox.className = "dedupe-group-list";
        listBox.innerHTML = groups.map(renderMapDedupeGroup).join("");
    }

    function buildMapDedupeGroups(points) {
        const uniquePoints = uniqueMapPointsById(points);
        const strongGroups = [];
        const weakGroups = [];
        const strongMap = new Map();
        const nameMap = new Map();

        uniquePoints.forEach(point => {
            const nameKey = normalizeDedupeText(point.name);
            const addressKey = normalizeDedupeText(point.address);
            if (!nameKey) {
                return;
            }

            if (!nameMap.has(nameKey)) {
                nameMap.set(nameKey, []);
            }
            nameMap.get(nameKey).push(point);

            if (addressKey) {
                const strongKey = `${nameKey}|${addressKey}`;
                if (!strongMap.has(strongKey)) {
                    strongMap.set(strongKey, []);
                }
                strongMap.get(strongKey).push(point);
            }
        });

        strongMap.forEach(groupPoints => {
            if (groupPoints.length >= 2) {
                strongGroups.push(createMapDedupeGroup("strong", groupPoints));
            }
        });

        nameMap.forEach(groupPoints => {
            const addressKeys = new Set(groupPoints.map(point => normalizeDedupeText(point.address)));
            if (groupPoints.length >= 2 && (addressKeys.size > 1 || addressKeys.has(""))) {
                weakGroups.push(createMapDedupeGroup("weak", groupPoints));
            }
        });

        return [...strongGroups, ...weakGroups].sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === "strong" ? -1 : 1;
            }
            return b.points.length - a.points.length;
        });
    }

    function uniqueMapPointsById(points) {
        const map = new Map();
        (points || []).forEach(point => {
            const id = Number(point && point.id);
            if (id && !map.has(id)) {
                map.set(id, point);
            }
        });
        return Array.from(map.values());
    }

    function createMapDedupeGroup(type, points) {
        const sortedPoints = [...points].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
        const recommended = pickRecommendedMapPoint(sortedPoints);
        return {
            type,
            key: `${type}:${sortedPoints.map(point => point.id).join(",")}`,
            name: sortedPoints[0]?.name || "未命名地点",
            points: sortedPoints,
            recommended
        };
    }

    function pickRecommendedMapPoint(points) {
        return [...points].sort((a, b) => {
            const routeDiff = getMapPointRouteUsage(b.id).length - getMapPointRouteUsage(a.id).length;
            if (routeDiff !== 0) {
                return routeDiff;
            }
            const timeA = Date.parse(a.created_at || "") || Number.MAX_SAFE_INTEGER;
            const timeB = Date.parse(b.created_at || "") || Number.MAX_SAFE_INTEGER;
            if (timeA !== timeB) {
                return timeA - timeB;
            }
            return (Number(a.id) || 0) - (Number(b.id) || 0);
        })[0] || points[0];
    }

    function renderMapDedupeGroup(group) {
        const typeLabel = group.type === "strong" ? "强疑似重复" : "弱疑似重复";
        const typeClass = group.type === "strong" ? "strong" : "weak";
        const idsText = group.points.map(point => `#${Number(point.id)}`).join("、");
        return `
            <div class="dedupe-group-card">
                <div class="dedupe-group-header">
                    <div>
                        <span class="tag dedupe-type-${typeClass}">${typeLabel}</span>
                        <h3>${escapeSceneHtml(group.name)}</h3>
                        <p>涉及 ID：${escapeSceneHtml(idsText)}</p>
                    </div>
                    <div class="dedupe-recommend">
                        <strong>推荐保留：#${Number(group.recommended.id)}</strong>
                        <span>建议保留创建较早或关联路线更多的记录，其它记录先人工核对。</span>
                    </div>
                </div>
                <div class="scene-duplicate-note">本页只做识别和人工治理入口，不自动删除、不自动合并、不修改路线 point_ids。</div>
                <div class="dedupe-point-list">
                    ${group.points.map(point => renderMapDedupePoint(point, Number(point.id) === Number(group.recommended.id))).join("")}
                </div>
                <div class="scene-preview-actions">
                    <button class="small-button" type="button" onclick="showMapSceneModule('list')">打开地图中心地点列表</button>
                </div>
            </div>
        `;
    }

    function renderMapDedupePoint(point, isRecommended) {
        const routes = getMapPointRouteUsage(point.id);
        const relationText = point.target_type && point.target_id
            ? `${getRelatedTargetLabel(point.target_type)} #${point.target_id}`
            : "暂未关联";
        return `
            <div class="dedupe-point-card">
                <div class="scene-linked-point-head">
                    <strong>地图点 #${Number(point.id)} · ${escapeSceneHtml(point.name || "未命名地点")}</strong>
                    ${isRecommended ? `<span class="tag scene-tag">建议保留</span>` : `<span class="tag warning">疑似重复</span>`}
                </div>
                <div class="scene-point-meta">
                    <span>ID：${Number(point.id)}</span>
                    <span>分类：${escapeSceneHtml(point.category || "未分类")}</span>
                    <span>场景：${escapeSceneHtml(point.scene || "其他")}</span>
                    <span>地址：${escapeSceneHtml(point.address || "暂无地址/区域")}</span>
                    <span>来源：${escapeSceneHtml(point.source || "未知来源")}</span>
                    <span>创建时间：${escapeSceneHtml(point.created_at || "未知")}</span>
                    <span>关联：${escapeSceneHtml(relationText)}</span>
                    <span>路线使用：${mapState.routeLoadFailed ? "暂不可用" : `${routes.length} 条`}</span>
                </div>
                ${renderMapDedupeRouteLinks(routes)}
                <div class="scene-preview-actions">
                    <button class="small-button" type="button" onclick="location.href='map-detail.html?id=${Number(point.id)}'">查看地图点详情 #${Number(point.id)}</button>
                </div>
            </div>
        `;
    }

    function renderMapDedupeRouteLinks(routes) {
        if (mapState.routeLoadFailed) {
            return `<div class="scene-empty-state">路线使用情况暂不可用。</div>`;
        }
        if (!routes || routes.length === 0) {
            return `<div class="scene-empty-state">暂无路线使用该地图点。</div>`;
        }
        return `
            <div class="dedupe-route-list">
                ${routes.map(route => `
                    <button class="small-button btn-secondary" type="button" onclick="location.href='route-detail.html?id=${Number(route.id)}'">路线 #${Number(route.id)}：${escapeSceneHtml(route.name || "未命名路线")}</button>
                `).join("")}
            </div>
        `;
    }

    function getMapPointRouteUsage(pointId) {
        return mapState.routeUsage.get(Number(pointId)) || [];
    }

    function normalizeDedupeText(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/\s+/g, "")
            .trim();
    }

    function renderRouteStats(routes) {
        const box = document.getElementById("routeSceneStats");
        if (!box) {
            return;
        }

        const counts = countByScene(routes, routeSceneRules);
        const focus = ["全部", "新生办事路线", "吃饭路线", "就医路线", "通勤路线", "夜间安全路线"];
        box.innerHTML = focus.map(name => {
            const value = name === ALL ? routes.length : counts[name] || 0;
            const label = name === ALL ? "路线总数" : name.replace("路线", "");
            return `<div class="scene-stat-card"><strong>${value}</strong><span>${escapeSceneHtml(label)}</span></div>`;
        }).join("");
    }

    function renderMapOverviewPreview(points) {
        const box = document.getElementById("mapOverviewPreview");
        if (!box) {
            return;
        }
        const visiblePoints = getVisibleMapPoints(points);
        const recentPoints = sortSceneItems(visiblePoints).slice(0, 4);
        const representativePoints = pickRepresentativeItems(visiblePoints, "scene", 4);

        box.innerHTML = `
            ${renderOverviewBlock(
                "最近地点预览",
                recentPoints,
                renderMapPreviewCard,
                "暂无地点，可到“新增地点”添加。"
            )}
            ${renderOverviewBlock(
                mapState.scene === ALL ? "场景代表地点" : `${escapeSceneHtml(mapState.scene)}代表地点`,
                representativePoints,
                renderMapPreviewCard,
                "当前场景暂无代表地点，可切换场景或新增地点。"
            )}
            <div class="scene-overview-actions">
                <button class="small-button" type="button" onclick="showMapSceneModule('create')">去新增地点</button>
                <button class="small-button btn-secondary" type="button" onclick="showMapSceneModule('list')">查看全部地点</button>
            </div>
        `;
    }

    function renderRouteOverviewPreview(routes) {
        const box = document.getElementById("routeOverviewPreview");
        if (!box) {
            return;
        }
        const visibleRoutes = getVisibleRoutes(routes);
        const recentRoutes = sortSceneItems(visibleRoutes).slice(0, 4);
        const representativeRoutes = pickRepresentativeItems(visibleRoutes, "scene", 4);

        box.innerHTML = `
            ${renderOverviewBlock(
                "最近路线预览",
                recentRoutes,
                renderRoutePreviewCard,
                "暂无路线，可到“新增路线”添加。"
            )}
            ${renderOverviewBlock(
                routeState.scene === ALL ? "场景代表路线" : `${escapeSceneHtml(routeState.scene)}代表路线`,
                representativeRoutes,
                renderRoutePreviewCard,
                "当前场景暂无代表路线，可切换场景或新增路线。"
            )}
            <div class="scene-overview-actions">
                <button class="small-button" type="button" onclick="showRouteSceneModule('create')">去新增路线</button>
                <button class="small-button btn-secondary" type="button" onclick="showRouteSceneModule('list')">查看全部路线</button>
            </div>
        `;
    }

    function renderOverviewBlock(title, items, renderer, emptyText) {
        return `
            <div class="scene-overview-block">
                <div class="scene-overview-title">
                    <h3>${title}</h3>
                    <span>${items.length} 条</span>
                </div>
                <div class="scene-overview-list">
                    ${items.length > 0 ? items.map(renderer).join("") : `<div class="scene-empty-state">${emptyText}</div>`}
                </div>
            </div>
        `;
    }

    function renderMapPreviewCard(point) {
        const relatedButton = buildSceneRelatedButton(point);
        return `
            <div class="scene-preview-card" onclick="location.href='map-detail.html?id=${Number(point.id)}'">
                <div class="scene-preview-tags">
                    <span class="tag scene-tag">${escapeSceneHtml(point.scene || "其他")}</span>
                    <span class="tag">${escapeSceneHtml(point.category || "未分类")}</span>
                </div>
                <h4>${escapeSceneHtml(point.name || "未命名地点")}</h4>
                <p>${escapeSceneHtml(point.address || "暂无地址/区域")}</p>
                <div class="scene-preview-meta">
                    <span>${escapeSceneHtml(point.source || "未知来源")}</span>
                    <span>${escapeSceneHtml(point.created_at || "未知时间")}</span>
                </div>
                <div class="scene-preview-actions" onclick="event.stopPropagation()">
                    <button class="small-button" type="button" onclick="location.href='map-detail.html?id=${Number(point.id)}'">打开地点</button>
                    ${relatedButton}
                </div>
            </div>
        `;
    }

    function renderRoutePreviewCard(route) {
        const pointItems = buildRoutePointItems(route);
        const pointNames = pointItems.map(formatRoutePointLabel).filter(Boolean);
        const endpoint = pointNames.length > 0 ? pointNames[pointNames.length - 1] : "待补充";
        const pointLinks = buildCompactRoutePointLinks(route);
        return `
            <div class="scene-preview-card" onclick="location.href='route-detail.html?id=${Number(route.id)}'">
                <div class="scene-preview-tags">
                    <span class="tag scene-tag">${escapeSceneHtml(route.scene || "其他路线")}</span>
                    <span class="tag">${escapeSceneHtml(route.route_type || "路线")}</span>
                </div>
                <h4>${escapeSceneHtml(route.name || "未命名路线")}</h4>
                <p>起点：${escapeSceneHtml(route.start_area || "待补充")} / 终点：${escapeSceneHtml(endpoint)}</p>
                <p>途经：${escapeSceneHtml(pointNames.join(" -> ") || route.point_ids || "待补充")}</p>
                <div class="scene-preview-meta">
                    <span>${escapeSceneHtml(route.source || "未知来源")}</span>
                    <span>${escapeSceneHtml(route.created_at || "未知时间")}</span>
                </div>
                <div class="scene-preview-actions" onclick="event.stopPropagation()">
                    <button class="small-button" type="button" onclick="location.href='route-detail.html?id=${Number(route.id)}'">打开路线</button>
                    ${pointLinks}
                </div>
            </div>
        `;
    }

    function getVisibleMapPoints(points) {
        return mapState.scene === ALL
            ? points
            : points.filter(point => point.scene === mapState.scene);
    }

    function getVisibleRoutes(routes) {
        return routeState.scene === ALL
            ? routes
            : routes.filter(route => route.scene === routeState.scene);
    }

    function sortSceneItems(items) {
        return [...items].sort((a, b) => {
            const timeA = Date.parse(a.created_at || "") || 0;
            const timeB = Date.parse(b.created_at || "") || 0;
            if (timeA !== timeB) {
                return timeB - timeA;
            }
            return (Number(b.id) || 0) - (Number(a.id) || 0);
        });
    }

    function pickRepresentativeItems(items, groupKey, limit) {
        const seen = new Set();
        const result = [];
        sortSceneItems(items).forEach(item => {
            const key = item[groupKey] || "其他";
            if (!seen.has(key) || items.length <= limit) {
                seen.add(key);
                result.push(item);
            }
        });
        return result.slice(0, limit);
    }

    function buildCompactRoutePointLinks(route) {
        const items = buildRoutePointItems(route);
        const visibleItems = items.slice(0, 3);
        const moreCount = Math.max(items.length - visibleItems.length, 0);
        return `
            ${visibleItems.map(point => `
                <button class="small-button btn-secondary" type="button" onclick="location.href='map-detail.html?id=${Number(point.id)}'">${escapeSceneHtml(formatRoutePointLabel(point))}</button>
            `).join("")}
            ${moreCount > 0 ? `<span class="scene-more-count">等 ${moreCount} 个地点</span>` : ""}
        `;
    }

    function renderSceneMapPointCard(point) {
        const archived = point.status === ARCHIVED;
        const area = point.address || "暂无区域";
        const hasCoordinates = Boolean(point.latitude && point.longitude);
        const mapQuery = buildSceneMapQuery(point);
        const relatedButton = buildSceneRelatedButton(point);
        const linkedText = buildSceneRelatedText(point);

        return `
            <div class="card scene-card scene-map-card" data-map-point-id="${Number(point.id) || ""}">
                <div class="scene-card-tags">
                    <span class="tag scene-tag">${escapeSceneHtml(point.scene || "其他")}</span>
                    <span class="tag">${escapeSceneHtml(point.category || "未分类")}</span>
                    <span class="tag ${archived ? "danger-tag" : ""}">${escapeSceneHtml(point.status || NORMAL)}</span>
                    ${hasCoordinates ? `<span class="tag">有坐标</span>` : `<span class="tag">地点卡片</span>`}
                </div>

                <h3>${escapeSceneHtml(point.name || "未命名地点")}</h3>

                <div class="scene-card-grid">
                    <div><strong>场景分类</strong><span>${escapeSceneHtml(point.scene || "其他")}</span></div>
                    <div><strong>所在区域</strong><span>${escapeSceneHtml(area)}</span></div>
                    <div><strong>来源</strong><span>${escapeSceneHtml(point.source || "未知来源")}</span></div>
                    <div><strong>最近更新时间</strong><span>${escapeSceneHtml(point.created_at || "未知")}</span></div>
                    <div><strong>关联来源</strong><span>${escapeSceneHtml(linkedText)}</span></div>
                    <div><strong>坐标状态</strong><span>${hasCoordinates ? `${escapeSceneHtml(point.latitude)}, ${escapeSceneHtml(point.longitude)}` : "暂无坐标"}</span></div>
                </div>

                <div class="summary">${escapeSceneHtml(point.description || "暂无简介，可后续从真实库或用户反馈中补充。")}</div>
                ${buildSceneRelatedPanel(point)}

                <div class="action-row">
                    <div class="action-title">地图与关联入口</div>
                    <button class="small-button" onclick="openAmapSearch('${escapeSceneJs(mapQuery)}')">高德搜索</button>
                    <button class="small-button" onclick="openBaiduMapSearch('${escapeSceneJs(mapQuery)}')">百度地图</button>
                    ${relatedButton}
                </div>

                <div class="action-row">
                    <div class="action-title">地图点管理</div>
                    <button class="small-button" onclick="editMapPoint(${Number(point.id)})">编辑</button>
                    ${
                        archived
                        ? `<button class="small-button approve-button" onclick="restoreMapPoint(${Number(point.id)})">恢复</button>`
                        : `<button class="small-button warn-button" onclick="archiveMapPoint(${Number(point.id)})">归档</button>`
                    }
                    <button class="small-button danger-button" onclick="deleteMapPoint(${Number(point.id)}, '${escapeSceneJs(point.name || "")}')">彻底删除</button>
                </div>
            </div>
        `;
    }

    function renderSceneRouteCard(route) {
        const archived = route.status === ARCHIVED;
        const pointItems = buildRoutePointItems(route);
        const pointNames = pointItems.map(formatRoutePointLabel).filter(Boolean);
        const endpoint = pointNames.length > 0 ? pointNames[pointNames.length - 1] : "待补充";
        const audience = inferRouteAudience(route);
        const notes = inferRouteNotes(route);
        const pointsHtml = buildRoutePointList(route);

        return `
            <div class="card scene-card scene-route-card" data-route-plan-id="${Number(route.id) || ""}">
                <div class="scene-card-tags">
                    <span class="tag scene-tag">${escapeSceneHtml(route.scene || "其他路线")}</span>
                    <span class="tag">${escapeSceneHtml(route.route_type || "路线")}</span>
                    <span class="tag ${archived ? "danger-tag" : ""}">${escapeSceneHtml(route.status || NORMAL)}</span>
                </div>

                <h3>${escapeSceneHtml(route.name || "未命名路线")}</h3>

                <div class="scene-card-grid">
                    <div><strong>适用场景</strong><span>${escapeSceneHtml(route.scene || "其他路线")}</span></div>
                    <div><strong>起点</strong><span>${escapeSceneHtml(route.start_area || "待补充")}</span></div>
                    <div><strong>终点</strong><span>${escapeSceneHtml(endpoint)}</span></div>
                    <div><strong>途经地图点</strong><span>${escapeSceneHtml(pointNames.join(" -> ") || route.point_ids || "待补充")}</span></div>
                    <div><strong>适合人群</strong><span>${escapeSceneHtml(audience)}</span></div>
                    <div><strong>来源 / 更新时间</strong><span>${escapeSceneHtml(route.source || "未知来源")} / ${escapeSceneHtml(route.created_at || "未知")}</span></div>
                </div>

                <div class="summary">${escapeSceneHtml(route.description || "暂无路线说明，可先作为生活路线建议卡片，后续补充路径和注意事项。")}</div>
                <div class="scene-note">注意事项：${escapeSceneHtml(notes)}</div>

                <div class="action-row">
                    <div class="action-title">路线包含的地图点</div>
                    ${pointsHtml || `<div class="empty">暂无已绑定地图点，可先作为路线建议保存。</div>`}
                </div>

                <div class="action-row">
                    <div class="action-title">路线管理</div>
                    <button class="small-button" onclick="editRoute(${Number(route.id)})">编辑</button>
                    ${
                        archived
                        ? `<button class="small-button approve-button" onclick="restoreRoute(${Number(route.id)})">恢复</button>`
                        : `<button class="small-button warn-button" onclick="archiveRoute(${Number(route.id)})">归档</button>`
                    }
                    <button class="small-button danger-button" onclick="deleteRoute(${Number(route.id)}, '${escapeSceneJs(route.name || "")}')">彻底删除</button>
                </div>
            </div>
        `;
    }

    function inferMapScene(point) {
        return inferSceneFromRules(point, mapSceneRules, "其他", [
            point.name,
            point.category,
            point.address,
            point.map_type,
            point.source,
            point.description
        ]);
    }

    function inferRouteScene(route) {
        const pointText = (route.points || []).map(point => `${point.name || ""} ${point.category || ""} ${point.address || ""}`).join(" ");
        return inferSceneFromRules(route, routeSceneRules, "其他路线", [
            route.name,
            route.route_type,
            route.category,
            route.start_area,
            route.source,
            route.description,
            pointText
        ]);
    }

    function inferSceneFromRules(item, rules, fallback, values) {
        const text = values.map(value => String(value || "")).join(" ").toLowerCase();
        const matched = rules.find(rule => rule.keywords.length > 0 && rule.keywords.some(keyword => text.includes(keyword.toLowerCase())));
        return matched ? matched.name : fallback;
    }

    function inferRouteAudience(route) {
        const scene = route.scene || "";
        if (scene.includes("新生")) return "新生、刚到大学城的同学";
        if (scene.includes("就医")) return "需要就医、买药或医保咨询的人";
        if (scene.includes("夜间")) return "夜间返校、晚间出行人群";
        if (scene.includes("通勤")) return "跨校区通勤、地铁公交换乘人群";
        if (scene.includes("吃饭")) return "找食堂、简餐、夜宵和聚餐的人";
        if (scene.includes("政务")) return "需要社区、街道或政务办事的人";
        return "大学城日常生活用户";
    }

    function inferRouteNotes(route) {
        const scene = route.scene || "";
        if (scene.includes("夜间")) return "建议优先选择照明充足、人流稳定的道路。";
        if (scene.includes("就医")) return "建议出发前核对营业时间和是否需要预约。";
        if (scene.includes("快递")) return "建议避开取件高峰，并核对驿站营业时间。";
        if (scene.includes("政务")) return "建议提前准备证件材料，核对窗口办理时间。";
        if (scene.includes("通勤")) return "建议关注地铁、公交或校车末班时间。";
        return "路线仍需人工核验，实际出行前请再次确认。";
    }

    function countByScene(items, rules) {
        const counts = {};
        rules.forEach(rule => {
            counts[rule.name] = 0;
        });
        items.forEach(item => {
            counts[item.scene] = (counts[item.scene] || 0) + 1;
        });
        return counts;
    }

    function updateSceneChips(containerId, activeValue) {
        const container = document.getElementById(containerId);
        if (!container) {
            return;
        }
        Array.from(container.querySelectorAll(".scene-chip")).forEach(button => {
            button.classList.toggle("active", button.textContent.trim() === activeValue || button.getAttribute("onclick")?.includes(`'${activeValue}'`));
        });
    }

    function updateLegacyButtons(prefix, activeValue) {
        Array.from(document.querySelectorAll(`[id^="${prefix}"]`)).forEach(button => {
            button.classList.toggle("active", button.id === `${prefix}${activeValue}`);
        });
    }

    function buildSceneRelatedText(point) {
        if (!point.target_type || !point.target_id) {
            return "暂未关联";
        }
        return `${getRelatedTargetLabel(point.target_type)} #${point.target_id}`;
    }

    function buildSceneRelatedPanel(point) {
        if (!point.target_type || !point.target_id) {
            return "";
        }
        const label = getRelatedTargetLabel(point.target_type);
        const href = getRelatedTargetHref(point.target_type, point.target_id);
        if (!href) {
            return "";
        }
        return `
            <div class="spatial-link-panel">
                <div>
                    <strong>已关联${escapeSceneHtml(label)}</strong>
                    <span>关联 ID：${escapeSceneHtml(point.target_id)}</span>
                </div>
                <button class="small-button" onclick="location.href='${escapeSceneJs(href)}'">打开关联来源</button>
            </div>
        `;
    }

    function buildRoutePointList(route) {
        const items = buildRoutePointItems(route);
        const visibleItems = items.slice(0, 3);
        const moreCount = Math.max(items.length - visibleItems.length, 0);
        const itemHtml = visibleItems.map(point => `
            <div class="target-item spatial-route-point-item scene-linked-point-card">
                <div class="scene-linked-point-head">
                    <strong>${escapeSceneHtml(point.name || `地图点 #${point.id}`)}</strong>
                    <span class="scene-id-badge">#${Number(point.id)}</span>
                </div>
                <div class="scene-point-meta">
                    <span>ID：${Number(point.id)}</span>
                    <span>分类：${escapeSceneHtml(point.category || "未分类")}</span>
                    <span>地址：${escapeSceneHtml(point.address || "暂无地址/区域")}</span>
                    <span>来源：${escapeSceneHtml(point.source || "未知来源")}</span>
                </div>
                <div>${point.name ? "" : "未找到对应地图点，可能已删除或尚未创建。"}</div>
                <button class="small-button" onclick="location.href='map-detail.html?id=${Number(point.id)}'">${point.name ? "打开地图点详情" : "尝试打开地图点详情"}</button>
            </div>
        `).join("");
        return `${buildRouteDuplicateNote(items)}${itemHtml}${moreCount > 0 ? `<div class="scene-more-count">等 ${moreCount} 个地点</div>` : ""}`;
    }

    function buildRoutePointItems(route) {
        const byId = new Map();
        (route.points || []).forEach(point => {
            const id = Number(point && point.id);
            if (id && !byId.has(id)) {
                byId.set(id, {
                    id,
                    name: point.name || "",
                    category: point.category || "",
                    address: point.address || "",
                    source: point.source || "",
                    status: point.status || ""
                });
            }
        });
        parseRoutePointIds(route.point_ids).forEach(id => {
            if (!byId.has(id)) {
                byId.set(id, {id, name: "", category: "地图点 ID", address: "", source: "", status: ""});
            }
        });
        return Array.from(byId.values());
    }

    function formatRoutePointLabel(point) {
        const name = point.name || "地图点";
        return `${name} #${Number(point.id)}`;
    }

    function buildRouteDuplicateNote(items) {
        const nameToIds = new Map();
        items.forEach(point => {
            const name = String(point.name || "").trim();
            if (!name) {
                return;
            }
            if (!nameToIds.has(name)) {
                nameToIds.set(name, new Set());
            }
            nameToIds.get(name).add(Number(point.id));
        });
        const hasDuplicateName = Array.from(nameToIds.values()).some(ids => ids.size > 1);
        return hasDuplicateName
            ? `<div class="scene-duplicate-note">存在同名地点，请根据地图点 ID 区分。</div>`
            : "";
    }

    function parseRoutePointIds(pointIdsText) {
        if (!pointIdsText) {
            return [];
        }
        if (Array.isArray(pointIdsText)) {
            return uniqueRoutePointIds(pointIdsText);
        }

        const rawText = String(pointIdsText || "").trim();
        if (!rawText) {
            return [];
        }

        try {
            const parsed = JSON.parse(rawText);
            if (Array.isArray(parsed)) {
                return uniqueRoutePointIds(parsed);
            }
        } catch (error) {
            // Fall back to separator parsing.
        }

        return uniqueRoutePointIds(rawText.replace(/[，、;；\s]+/g, ",").split(","));
    }

    function uniqueRoutePointIds(values) {
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

    function getRelatedTargetLabel(targetType) {
        if (targetType === "verified") return "真实库信息";
        if (targetType === "clue") return "线索";
        return targetType || "来源";
    }

    function getRelatedTargetHref(targetType, targetId) {
        const id = Number(targetId);
        if (!id) {
            return "";
        }
        if (targetType === "verified") {
            return `item-detail.html?id=${id}`;
        }
        if (targetType === "clue") {
            return `clue-detail.html?id=${id}`;
        }
        return "";
    }

    function initMapSceneTabs() {
        initSceneTabs("map", "overview");
    }

    function initRouteSceneTabs() {
        initSceneTabs("route", "overview");
    }

    function initSceneTabs(scope, defaultName) {
        const tabSelector = `[data-${scope}-scene-tab]`;
        const tabs = Array.from(document.querySelectorAll(tabSelector));
        if (tabs.length === 0) {
            return;
        }

        tabs.forEach(tab => {
            tab.addEventListener("click", () => {
                const name = tab.getAttribute(`data-${scope}-scene-tab`) || defaultName;
                showSceneModule(scope, name);
            });
        });
        showSceneModule(scope, defaultName);
    }

    function showSceneModule(scope, name) {
        const targetName = name || "overview";
        const tabs = Array.from(document.querySelectorAll(`[data-${scope}-scene-tab]`));
        const modules = Array.from(document.querySelectorAll(`[data-${scope}-scene-module]`));
        if (tabs.length === 0 || modules.length === 0) {
            return;
        }

        tabs.forEach(tab => {
            const isActive = tab.getAttribute(`data-${scope}-scene-tab`) === targetName;
            tab.classList.toggle("active", isActive);
            tab.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
        modules.forEach(module => {
            const isActive = module.getAttribute(`data-${scope}-scene-module`) === targetName;
            module.hidden = !isActive;
        });
    }

    function buildSceneMapQuery(point) {
        if (point.latitude && point.longitude) {
            return `${point.latitude},${point.longitude}`;
        }
        return point.address || point.name || "广州大学城";
    }

    function buildSceneRelatedButton(point) {
        if (!point.target_type || !point.target_id) {
            return "";
        }
        if (point.target_type === "clue") {
            return `<button class="small-button" onclick="location.href='clue-detail.html?id=${Number(point.target_id)}'">查看关联线索</button>`;
        }
        if (point.target_type === "verified") {
            return `<button class="small-button" onclick="location.href='item-detail.html?id=${Number(point.target_id)}'">查看关联真实库</button>`;
        }
        return "";
    }

    async function afterMapPointCreated(createdItem) {
        const createdId = Number(createdItem && createdItem.id);
        showMapSceneModule("list");
        mapState.scene = ALL;
        mapState.category = ALL;
        mapState.status = NORMAL;
        mapState.pendingCreatedId = createdId || null;
        mapState.pendingFallback = !createdId;
        clearInputValue("mapKeyword");
        showSceneTabNotice("mapSceneTabMessage", "已添加地图点，已切到地点列表。");
        showSceneNotice("mapMessage", "已添加地图点，可在下方生活场景地图列表中查看。");
        await loadMapPoints();
    }

    async function afterRoutePlanCreated(createdItem) {
        const createdId = Number(createdItem && createdItem.id);
        showRouteSceneModule("list");
        routeState.scene = ALL;
        routeState.routeType = ALL;
        routeState.status = NORMAL;
        window.currentRouteType = ALL;
        window.currentRouteStatus = NORMAL;
        routeState.pendingCreatedId = createdId || null;
        routeState.pendingFallback = !createdId;
        clearInputValue("routeKeyword");
        showSceneTabNotice("routeSceneTabMessage", "已添加路线，已切到路线列表。");
        showSceneNotice("routeMessage", "已添加路线，可在下方生活场景路线列表中查看。");
        await loadRoutes();
    }

    function focusPendingMapPoint() {
        const targetId = mapState.pendingCreatedId;
        const fallback = mapState.pendingFallback;
        if (!targetId && !fallback) {
            return;
        }
        const selector = targetId ? `[data-map-point-id="${targetId}"]` : "";
        const card = selector ? document.querySelector(selector) : null;
        const target = card || document.getElementById("mapPointList");
        focusCreatedTarget(target, card);
        mapState.pendingCreatedId = null;
        mapState.pendingFallback = false;
    }

    function focusPendingRoute() {
        const targetId = routeState.pendingCreatedId;
        const fallback = routeState.pendingFallback;
        if (!targetId && !fallback) {
            return;
        }
        const selector = targetId ? `[data-route-plan-id="${targetId}"]` : "";
        const card = selector ? document.querySelector(selector) : null;
        const target = card || document.getElementById("routeList");
        focusCreatedTarget(target, card);
        routeState.pendingCreatedId = null;
        routeState.pendingFallback = false;
    }

    function focusCreatedTarget(target, card) {
        if (!target) {
            return;
        }
        setTimeout(() => {
            target.scrollIntoView({behavior: "smooth", block: card ? "center" : "start"});
            if (card) {
                card.classList.add("is-newly-created");
                setTimeout(() => {
                    card.classList.remove("is-newly-created");
                }, 4500);
            }
        }, 80);
    }

    function showSceneNotice(elementId, message, isError = false) {
        const box = document.getElementById(elementId);
        if (!box) {
            return;
        }
        box.textContent = message;
        box.classList.toggle("error", Boolean(isError));
        box.classList.toggle("scene-success-message", !isError);
    }

    function showSceneTabNotice(elementId, message) {
        const box = document.getElementById(elementId);
        if (!box) {
            return;
        }
        box.textContent = message;
        window.clearTimeout(box._sceneNoticeTimer);
        box._sceneNoticeTimer = window.setTimeout(() => {
            box.textContent = "";
        }, 5000);
    }

    function getInputValue(id) {
        const element = document.getElementById(id);
        return element ? String(element.value || "").trim() : "";
    }

    function clearInputValue(id) {
        const element = document.getElementById(id);
        if (element) {
            element.value = "";
        }
    }

    function clearMapCreateForm() {
        ["mapName", "mapAddress", "mapLatitude", "mapLongitude", "mapTargetId", "mapSource", "mapDescription"].forEach(clearInputValue);
    }

    function clearRouteCreateForm() {
        ["routeName", "routeStartArea", "routePointIds", "routeSource", "routeDescription"].forEach(clearInputValue);
    }

    function escapeSceneHtml(text) {
        return String(text || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function escapeSceneJs(text) {
        return String(text || "")
            .replace(/\\/g, "\\\\")
            .replace(/'/g, "\\'")
            .replace(/"/g, "&quot;")
            .replace(/\n/g, " ");
    }
})();
