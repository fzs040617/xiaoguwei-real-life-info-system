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
        routes: [],
        routeUsage: new Map(),
        routesLoaded: false,
        routeLoadFailed: false,
        dedupeKeepChoices: new Map(),
        dedupeCopyMessage: "",
        pendingCreatedId: null,
        pendingFallback: false,
        lifeTheme: "全部地图",
        lifeSearchKeyword: "",
        selectedLifePointId: null,
        selectedLifeRouteId: null,
        highlightedLifePointIds: new Set(),
        sampleZone: "全部",
        sampleTheme: "全部主题",
        selectedSampleRouteId: null,
        sampleMessage: ""
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

    const lifeMapThemes = [
        {name: "全部地图", className: "all", keywords: []},
        {name: "美食地图", className: "food", keywords: ["吃饭", "饭店", "餐厅", "糖水", "奶茶", "夜宵", "简餐", "食堂", "饭堂", "美食", "咖啡"]},
        {name: "citywalk 地图", className: "citywalk", keywords: ["citywalk", "散步", "打卡", "周末", "路线", "游玩", "逛", "景点", "公园", "商圈"]},
        {name: "租房地图", className: "rent", keywords: ["租房", "公寓", "宿舍", "房租", "单间", "合租", "看房", "住房", "居住"]},
        {name: "交通地图", className: "traffic", keywords: ["地铁", "公交", "车站", "通勤", "换乘", "交通", "大学城北", "大学城南"]},
        {name: "医疗地图", className: "medical", keywords: ["医院", "门诊", "校医院", "药店", "就医", "医疗"]},
        {name: "快递地图", className: "express", keywords: ["快递", "驿站", "取件", "寄件", "菜鸟", "快递点"]},
        {name: "校园服务地图", className: "campus", keywords: ["饭堂", "宿舍", "维修", "校园", "报到", "办事", "服务"]},
        {name: "政务地图", className: "gov", keywords: ["政务", "街道办", "社区", "办事处", "政府", "证明"]},
        {name: "夜间安全地图", className: "safe", keywords: ["夜间", "安全", "照明", "偏僻", "绕行", "晚归"]}
    ];

    const LIFE_AREA_PENDING = "待补全区域";
    const lifeMapAreas = ["贝岗", "穗石", "南亭", "北亭"];

    const lifeMapSamples = [
        {area: "贝岗", items: ["美食", "交通", "租房", "快递", "citywalk 起点"], hint: "大学城北交通可作为贝岗区域建议；补充贝岗村、北站周边、取件点和出发点。"},
        {area: "穗石", items: ["租房", "美食", "快递", "生活服务"], hint: "围绕穗石村、穗石路、穗石市场补充居住、吃饭、取件和维修办事信息。"},
        {area: "南亭", items: ["美食", "citywalk", "交通", "租房"], hint: "围绕南亭村、南亭渡口、南亭商业街补充聚餐、散步、交通和看房信息。"},
        {area: "北亭", items: ["租房", "快递", "校园服务", "夜间安全"], hint: "围绕北亭村、北亭广场、北亭生活区补充居住、取件、校园服务和晚归安全信息。"}
    ];

    const sampleZones = ["全部", "贝岗", "穗石", "南亭", "北亭"];
    const sampleThemes = ["全部主题", "美食", "citywalk", "租房", "交通", "快递", "医疗", "校园服务", "政务", "夜间安全"];
    const sampleVerifyStatus = "待人工核验";

    const lifeSamplePoints = [
        createSamplePoint("P-BG-FOOD", "贝岗", "美食", "贝岗美食聚集点", "探店", "贝岗村或贝岗地铁周边", "用于记录贝岗周边可核验的吃饭、夜宵、糖水、简餐等地点类型。"),
        createSamplePoint("P-BG-TRAFFIC", "贝岗", "交通", "贝岗地铁周边交通点", "地图", "大学城北站 / 贝岗地铁周边", "用于记录地铁口、公交接驳、通勤换乘、晚间返回等交通信息。"),
        createSamplePoint("P-BG-RENT", "贝岗", "租房", "贝岗租房生活区", "租房", "贝岗生活区附近", "用于记录贝岗周边待核验的公寓、单间、合租、看房动线等信息。"),
        createSamplePoint("P-BG-EXPRESS", "贝岗", "快递", "贝岗快递取件点", "生活服务", "贝岗村或贝岗生活区附近", "用于记录菜鸟驿站、快递点、寄件点等取件服务信息。"),
        createSamplePoint("P-BG-SAFE", "贝岗", "夜间安全", "贝岗夜间通行提示点", "避坑纠错", "贝岗晚归路径附近", "用于记录照明、绕行、偏僻路段等需要人工核验的安全提示。"),
        createSamplePoint("P-SS-RENT", "穗石", "租房", "穗石租房生活区", "租房", "穗石村 / 穗石路周边", "用于记录穗石待核验的租房、看房、居住配套和通勤提示。"),
        createSamplePoint("P-SS-FOOD", "穗石", "美食", "穗石美食生活点", "探店", "穗石市场或穗石生活区附近", "用于记录穗石周边饭店、简餐、奶茶等待核验生活信息。"),
        createSamplePoint("P-SS-EXPRESS", "穗石", "快递", "穗石快递取件点", "生活服务", "穗石生活区附近", "用于记录穗石快递、驿站、寄件服务等待核验地点。"),
        createSamplePoint("P-SS-SERVICE", "穗石", "校园服务", "穗石生活服务点", "生活服务", "穗石村或穗石生活区附近", "用于记录打印、维修、生活服务等待核验服务点。"),
        createSamplePoint("P-NT-FOOD", "南亭", "美食", "南亭美食生活区", "探店", "南亭村 / 南亭商业街附近", "用于记录南亭周边聚餐、简餐、饮品等待核验地点。"),
        createSamplePoint("P-NT-WALK", "南亭", "citywalk", "南亭 citywalk 起点", "路线", "南亭渡口或南亭商业街附近", "用于记录南亭散步、打卡、周末路线起点等待核验信息。"),
        createSamplePoint("P-NT-TRAFFIC", "南亭", "交通", "南亭交通换乘点", "地图", "南亭村或南亭商业街周边", "用于记录南亭公交、骑行接驳、换乘提示等交通信息。"),
        createSamplePoint("P-NT-RENT", "南亭", "租房", "南亭租房生活区", "租房", "南亭村周边", "用于记录南亭待核验租房、居住配套和看房提醒。"),
        createSamplePoint("P-BT-RENT", "北亭", "租房", "北亭租房生活区", "租房", "北亭村 / 北亭生活区附近", "用于记录北亭租房、看房、通勤和居住配套信息。"),
        createSamplePoint("P-BT-EXPRESS", "北亭", "快递", "北亭快递取件点", "生活服务", "北亭生活区附近", "用于记录北亭快递、驿站、取件高峰等待核验信息。"),
        createSamplePoint("P-BT-CAMPUS", "北亭", "校园服务", "北亭校园服务点", "生活服务", "北亭广场或北亭生活区附近", "用于记录校园服务、维修、打印、报到办事等待核验信息。"),
        createSamplePoint("P-BT-SAFE", "北亭", "夜间安全", "北亭夜间安全提示点", "避坑纠错", "北亭晚归路径附近", "用于记录晚归照明、绕行、偏僻路段等待核验安全提示。")
    ];

    const lifeSampleRoutes = [
        createSampleRoute("R-BG-TRAFFIC", "贝岗", "交通", "贝岗地铁到生活区路线", "大学城北站 / 贝岗地铁周边", "贝岗生活区", ["贝岗地铁周边交通点", "贝岗租房生活区"], "用于整理从地铁到贝岗生活区的接驳、通勤和晚间返回提示。"),
        createSampleRoute("R-BG-FOOD", "贝岗", "美食", "贝岗美食短路线", "贝岗生活区入口", "贝岗美食聚集点", ["贝岗美食聚集点", "贝岗快递取件点"], "用于整理贝岗短距离觅食、夜宵和取件顺路信息。"),
        createSampleRoute("R-SS-RENT", "穗石", "租房", "穗石租房看房路线", "穗石生活区", "穗石租房生活区", ["穗石租房生活区", "穗石生活服务点"], "用于整理穗石看房、居住配套和通勤观察路线。"),
        createSampleRoute("R-SS-SERVICE", "穗石", "校园服务", "穗石生活服务路线", "穗石美食生活点", "穗石生活服务点", ["穗石美食生活点", "穗石快递取件点", "穗石生活服务点"], "用于整理穗石吃饭、取件、维修打印等生活服务串联路线。"),
        createSampleRoute("R-NT-WALK", "南亭", "citywalk", "南亭美食 citywalk 路线", "南亭 citywalk 起点", "南亭美食生活区", ["南亭 citywalk 起点", "南亭美食生活区"], "用于整理南亭周末散步、打卡和美食串联路线。"),
        createSampleRoute("R-NT-TRAFFIC", "南亭", "交通", "南亭交通接驳路线", "南亭交通换乘点", "南亭租房生活区", ["南亭交通换乘点", "南亭租房生活区"], "用于整理南亭交通换乘、骑行接驳和看房到达路线。"),
        createSampleRoute("R-BT-EXPRESS", "北亭", "快递", "北亭快递取件路线", "北亭校园服务点", "北亭快递取件点", ["北亭校园服务点", "北亭快递取件点"], "用于整理北亭校园服务和取件顺路路线。"),
        createSampleRoute("R-BT-SAFE", "北亭", "夜间安全", "北亭夜间安全绕行路线", "北亭生活区", "北亭夜间安全提示点", ["北亭租房生活区", "北亭夜间安全提示点"], "用于整理北亭晚归、照明、绕行和安全提醒路线。")
    ];

    window.setLifeMapTheme = function (theme) {
        mapState.lifeTheme = theme || "全部地图";
        mapState.selectedLifePointId = null;
        mapState.selectedLifeRouteId = null;
        mapState.highlightedLifePointIds = new Set();
        renderLifeMapEngine();
    };

    window.setLifeMapKeyword = function (keyword) {
        mapState.lifeSearchKeyword = String(keyword || "").trim();
        mapState.selectedLifePointId = null;
        mapState.selectedLifeRouteId = null;
        mapState.highlightedLifePointIds = new Set();
        renderLifeMapEngine();
    };

    window.clearLifeMapKeyword = function () {
        mapState.lifeSearchKeyword = "";
        const input = document.getElementById("lifeMapKeyword");
        if (input) {
            input.value = "";
            input.focus();
        }
        mapState.selectedLifePointId = null;
        mapState.selectedLifeRouteId = null;
        mapState.highlightedLifePointIds = new Set();
        renderLifeMapEngine();
    };

    window.handleLifeMapSearchKeyDown = function (event) {
        if (event && event.key === "Enter") {
            event.preventDefault();
        }
    };

    window.selectLifeMapPoint = function (pointId) {
        const id = Number(pointId);
        mapState.selectedLifePointId = id || null;
        mapState.selectedLifeRouteId = null;
        mapState.highlightedLifePointIds = id ? new Set([id]) : new Set();
        renderLifeMapEngine();
    };

    window.selectLifeMapRoute = function (routeId) {
        const id = Number(routeId);
        const route = getLifeRouteById(id);
        mapState.selectedLifeRouteId = id || null;
        mapState.selectedLifePointId = null;
        mapState.highlightedLifePointIds = new Set(getLifeRoutePointIds(route));
        renderLifeMapEngine();
    };

    window.setSampleZone = function (zone) {
        mapState.sampleZone = zone || "全部";
        mapState.sampleMessage = "";
        renderLifeSampleWorkbench();
    };

    window.setSampleTheme = function (theme) {
        mapState.sampleTheme = theme || "全部主题";
        mapState.sampleMessage = "";
        renderLifeSampleWorkbench();
    };

    window.fillMapPointFromSample = function (sampleId) {
        const sample = getSamplePointById(sampleId);
        if (!sample) {
            return;
        }
        showMapSceneModule("create");
        setInputValue("mapName", sample.name);
        setSelectValue("mapCategory", sample.category || "生活服务");
        setInputValue("mapAddress", `${sample.zone}：${sample.address_hint || ""}`);
        setSelectValue("mapType", `${sample.theme}地图`);
        setInputValue("mapSource", "四区样板库（待人工核验）");
        setInputValue("mapDescription", buildSamplePointDraftText(sample));
        mapState.sampleMessage = `已填入新增地点草稿：${sample.name}。请人工核验后再保存。`;
        renderLifeSampleWorkbench();
        showSceneTabNotice("mapSceneTabMessage", mapState.sampleMessage);
        showSceneNotice("mapMessage", mapState.sampleMessage);
    };

    window.selectSampleRouteDraft = function (sampleId) {
        const sample = getSampleRouteById(sampleId);
        if (!sample) {
            return;
        }
        mapState.selectedSampleRouteId = sample.id;
        mapState.sampleMessage = `已生成路线草稿：${sample.name}。不会自动写入数据库。`;
        renderLifeSampleWorkbench();
    };

    window.copySampleRouteDraft = async function (sampleId) {
        const sample = getSampleRouteById(sampleId);
        if (!sample) {
            return;
        }
        const text = buildSampleRouteDraftText(sample);
        const copied = await copySceneText(text);
        mapState.selectedSampleRouteId = sample.id;
        mapState.sampleMessage = copied ? "路线草稿已复制，可到路线中心人工录入。" : "复制失败，请手动选中路线草稿文本复制。";
        renderLifeSampleWorkbench();
    };

    window.openRouteCenterWithSampleDraft = function (sampleId) {
        const sample = getSampleRouteById(sampleId);
        if (sample) {
            try {
                localStorage.setItem("lifeSceneRouteDraft", JSON.stringify({
                    ...sample,
                    draft_text: buildSampleRouteDraftText(sample),
                    saved_at: new Date().toISOString()
                }));
            } catch (error) {
                // Ignore storage errors; the visible draft remains available for copying.
            }
        }
        location.href = "route.html";
    };

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
                scene: inferMapScene(point),
                lifeThemes: inferLifePointThemes(point),
                lifeArea: inferLifeMapArea(point)
            }));
            loadMapRouteUsage();
            renderMapSceneView();
        } catch (error) {
            box.innerHTML = `<div class="empty">地图点加载失败，请确认后端已启动。</div>`;
            renderLifeSampleWorkbench();
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
    window.setMapDedupeKeepPoint = function (groupKey, pointId) {
        mapState.dedupeKeepChoices.set(String(groupKey), Number(pointId));
        renderMapDedupeView();
    };
    window.copyMapDedupePlan = async function (groupKey) {
        const textBox = document.getElementById(getMapDedupePlanId(groupKey));
        if (!textBox) {
            return;
        }
        const text = textBox.value || textBox.textContent || "";
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                textBox.focus();
                textBox.select();
                const copied = document.execCommand && document.execCommand("copy");
                if (!copied) {
                    throw new Error("clipboard unavailable");
                }
            }
            mapState.dedupeCopyMessage = String(groupKey);
            renderMapDedupeView();
            window.setTimeout(() => {
                if (mapState.dedupeCopyMessage === String(groupKey)) {
                    mapState.dedupeCopyMessage = "";
                    renderMapDedupeView();
                }
            }, 1800);
        } catch (error) {
            mapState.dedupeCopyMessage = `manual:${String(groupKey)}`;
            renderMapDedupeView();
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        initMapSceneTabs();
        initRouteSceneTabs();
        renderLifeSampleWorkbench();
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

    function renderLifeMapEngine() {
        renderLifeThemeFilters();
        renderLifeSearchSummary();
        renderLifeThemeSummary();
        renderLifeMapCanvas();
        renderLifeMapSummaries();
        renderLifeMapSamples();
        renderLifeSampleWorkbench();
    }

    function renderLifeThemeFilters() {
        const box = document.getElementById("lifeMapThemeFilters");
        if (!box) {
            return;
        }
        box.innerHTML = lifeMapThemes.map(theme => `
            <button class="life-theme-chip life-theme-${theme.className} ${mapState.lifeTheme === theme.name ? "active" : ""}" type="button" onclick="setLifeMapTheme('${escapeSceneJs(theme.name)}')">
                ${escapeSceneHtml(theme.name)}
            </button>
        `).join("");
    }

    function renderLifeSearchSummary() {
        const box = document.getElementById("lifeMapSearchSummary");
        if (!box) {
            return;
        }
        const keyword = getLifeSearchKeyword();
        const points = getVisibleLifePoints();
        const routes = getVisibleLifeRoutes();
        box.textContent = keyword
            ? `当前搜索结果：${points.length} 个地点 / ${routes.length} 条路线`
            : `当前匹配：${points.length} 个地点 / ${routes.length} 条路线`;
    }

    function renderLifeThemeSummary() {
        const themeBox = document.getElementById("lifeMapThemeSummary");
        const areaBox = document.getElementById("lifeMapAreaStats");
        if (!themeBox && !areaBox) {
            return;
        }

        const points = getVisibleLifePoints();
        const routes = getVisibleLifeRoutes();
        const theme = getLifeTheme(mapState.lifeTheme);
        if (themeBox) {
            const keywordText = theme && theme.keywords.length ? theme.keywords.join("、") : "展示全部主题地点与路线";
            themeBox.innerHTML = `
                <div class="life-theme-current">${escapeSceneHtml(mapState.lifeTheme)}</div>
                <div class="life-stat-pair"><strong>${points.length}</strong><span>地点</span></div>
                <div class="life-stat-pair"><strong>${routes.length}</strong><span>路线</span></div>
                <p>匹配字段：category、map_type、name、address、description、source、route category、route description。</p>
                <p>关键词：${escapeSceneHtml(keywordText)}</p>
            `;
        }
        if (areaBox) {
            const counts = countLifePointsByArea(points);
            areaBox.innerHTML = lifeMapAreas.map(area => `
                <div class="life-area-stat">
                    <span>${escapeSceneHtml(area)}</span>
                    <strong>${counts[area] || 0}</strong>
                </div>
            `).join("");
        }
    }

    function renderLifeMapCanvas() {
        const box = document.getElementById("lifeMapCanvas");
        if (!box) {
            return;
        }

        const points = getVisibleLifePoints();
        if (points.length === 0) {
            const searchKeyword = getLifeSearchKeyword();
            const routeCount = getVisibleLifeRoutes().length;
            const emptyTitle = searchKeyword && routeCount === 0 ? "暂无匹配地点或路线" : "当前主题暂无地图点";
            const emptyText = searchKeyword
                ? (routeCount > 0 ? "暂无匹配地点，匹配路线可在下方路线列表查看。" : "暂无匹配地点或路线，请换个关键词试试。")
                : "可以切换到全部地图，或到“新增地点”录入真实生活地点。";
            box.innerHTML = `
                <div class="life-map-empty">
                    <strong>${escapeSceneHtml(emptyTitle)}</strong>
                    <span>${escapeSceneHtml(emptyText)}</span>
                    ${searchKeyword
                        ? `<button class="small-button btn-secondary" type="button" onclick="clearLifeMapKeyword()">清空搜索</button>`
                        : `<button class="small-button" type="button" onclick="showMapSceneModule('create')">去新增地点</button>
                           <button class="small-button btn-secondary" type="button" onclick="showMapSceneModule('samples')">进入四区样板库</button>`
                    }
                </div>
            `;
            renderLifeDetailPanel();
            return;
        }

        const groups = groupLifePointsByArea(points);
        const pendingPoints = getPendingLifeAreaPoints(points);
        box.innerHTML = lifeMapAreas.map(area => {
            const areaPoints = groups.get(area) || [];
            const areaRoutes = getLifeRoutesForArea(area);
            return `
            <section class="life-map-area life-map-area-${getLifeAreaClass(area)}">
                <div class="life-map-area-head">
                    <h3>${escapeSceneHtml(area)}</h3>
                    <span>${areaPoints.length} 个点 / ${areaRoutes.length} 条路线</span>
                </div>
                <div class="life-map-point-cloud">
                    ${areaPoints.map(renderLifeMapPointMarker).join("") || `<div class="life-map-area-empty">暂无当前主题地点，可从新增地点录入。</div>`}
                </div>
            </section>
        `;
        }).join("") + renderPendingLifeAreaPanel(pendingPoints);
        renderLifeDetailPanel();
    }

    function renderLifeMapPointMarker(point) {
        const pointId = Number(point.id);
        const themes = point.lifeThemes || inferLifePointThemes(point);
        const primaryTheme = themes[0] || "全部地图";
        const theme = getLifeTheme(primaryTheme) || lifeMapThemes[0];
        const routeCount = getMapPointRouteUsage(point.id).length;
        const isSelected = Number(mapState.selectedLifePointId) === pointId;
        const isHighlighted = mapState.highlightedLifePointIds && mapState.highlightedLifePointIds.has(pointId);
        return `
            <button class="life-map-point life-theme-${theme.className} ${isSelected ? "selected" : ""} ${isHighlighted ? "highlighted" : ""}" type="button" onclick="selectLifeMapPoint(${pointId})">
                <span class="life-point-id">#${pointId}</span>
                <strong>${escapeSceneHtml(point.name || "未命名地点")}</strong>
                <span>${escapeSceneHtml(point.address || point.lifeArea || "暂无地址")}</span>
                <span class="life-point-tags">${themes.map(renderLifeThemeTag).join("")}</span>
                <span class="life-point-meta">${escapeSceneHtml(point.source || "未知来源")} · ${routeCount > 0 ? `路线 ${routeCount} 条` : "暂未被路线使用"}</span>
            </button>
        `;
    }

    function renderPendingLifeAreaPanel(points) {
        if (!points.length) {
            return "";
        }
        return `
            <aside class="life-area-pending">
                <div>
                    <h3>待补全区域地点</h3>
                    <p>以下地点暂未识别到贝岗 / 穗石 / 南亭 / 北亭，可在地点详情或地点列表中补充地址。</p>
                </div>
                <div class="life-pending-list">
                    ${points.map(point => `
                        <div class="life-pending-item">
                            <strong>地图点 #${Number(point.id)}：${escapeSceneHtml(point.name || "未命名地点")}</strong>
                            <span>地址：${escapeSceneHtml(point.address || "暂无地址")}</span>
                            <span>来源：${escapeSceneHtml(point.source || "未知来源")}</span>
                            <button class="small-button btn-secondary" type="button" onclick="location.href='map-detail.html?id=${Number(point.id)}'">查看地图点详情</button>
                        </div>
                    `).join("")}
                </div>
            </aside>
        `;
    }

    function renderLifeMapSummaries() {
        const pointBox = document.getElementById("lifeMapPointSummary");
        const routeBox = document.getElementById("lifeMapRouteSummary");
        const points = sortSceneItems(getVisibleLifePoints()).slice(0, 8);
        const routes = sortSceneItems(getVisibleLifeRoutes()).slice(0, 8);

        if (pointBox) {
            pointBox.innerHTML = points.length ? points.map(point => {
                const routesForPoint = getMapPointRouteUsage(point.id);
                return `
                    <div class="life-summary-item ${Number(mapState.selectedLifePointId) === Number(point.id) ? "selected" : ""}">
                        <div>
                            <strong>地图点 #${Number(point.id)}：${escapeSceneHtml(point.name || "未命名地点")}</strong>
                            <span>${escapeSceneHtml(point.lifeArea || inferLifeMapArea(point))} / ${escapeSceneHtml(point.address || "暂无地址")}</span>
                            <span>${(point.lifeThemes || []).map(renderLifeThemeTag).join("")}</span>
                        </div>
                        <div class="life-summary-actions">
                            <span>${point.target_type && point.target_id ? "已关联真实库 / 线索" : "未关联真实库 / 线索"}</span>
                            <span>${routesForPoint.length > 0 ? `被 ${routesForPoint.length} 条路线使用` : "暂未被路线使用"}</span>
                            <button class="small-button" type="button" onclick="selectLifeMapPoint(${Number(point.id)})">查看联动</button>
                            <button class="small-button btn-secondary" type="button" onclick="location.href='map-detail.html?id=${Number(point.id)}'">查看地图点详情</button>
                        </div>
                    </div>
                `;
            }).join("") : `<div class="scene-empty-state">${getLifeSearchKeyword() ? "暂无匹配地点，请换个关键词试试。" : "当前主题暂无地点。"}</div>`;
        }

        if (routeBox) {
            routeBox.innerHTML = routes.length ? routes.map(route => {
                const pointItems = buildRoutePointItems(route);
                const pointNames = pointItems.map(formatRoutePointLabel).filter(Boolean);
                const endpoint = pointNames.length > 0 ? pointNames[pointNames.length - 1] : "待补充";
                const routeAreas = getLifeRouteAreas(route);
                return `
                    <div class="life-summary-item ${Number(mapState.selectedLifeRouteId) === Number(route.id) ? "selected" : ""}">
                        <div>
                            <strong>路线 #${Number(route.id)}：${escapeSceneHtml(route.name || "未命名路线")}</strong>
                            <span>适用场景：${(route.lifeThemes || []).map(renderLifeThemeTag).join("") || escapeSceneHtml(route.scene || "未匹配")}</span>
                            <span>涉及区域：${escapeSceneHtml(routeAreas.join(" / ") || "待补全区域")}</span>
                            <span>起点：${escapeSceneHtml(route.start_area || "待补充")} / 终点：${escapeSceneHtml(endpoint)}</span>
                            <span>途经地图点：${escapeSceneHtml(pointNames.join(" -> ") || route.point_ids || "待补充")}</span>
                        </div>
                        <div class="life-summary-actions">
                            <button class="small-button" type="button" onclick="selectLifeMapRoute(${Number(route.id)})">高亮路线点位</button>
                            <button class="small-button btn-secondary" type="button" onclick="location.href='route-detail.html?id=${Number(route.id)}'">查看路线详情</button>
                        </div>
                    </div>
                `;
            }).join("") : `<div class="scene-empty-state">${getLifeSearchKeyword() ? "暂无匹配路线，请换个关键词试试。" : "当前主题暂无路线。"}</div>`;
        }
    }

    function renderLifeDetailPanel() {
        const box = document.getElementById("lifeMapDetailPanel");
        if (!box) {
            return;
        }
        const route = getLifeRouteById(mapState.selectedLifeRouteId);
        if (route) {
            const pointItems = buildRoutePointItems(route);
            const routeAreas = getLifeRouteAreas(route);
            box.innerHTML = `
                <h3>路线 #${Number(route.id)}：${escapeSceneHtml(route.name || "未命名路线")}</h3>
                <div class="life-detail-tags">${(route.lifeThemes || []).map(renderLifeThemeTag).join("")}</div>
                <p>${escapeSceneHtml(route.description || "暂无路线说明。")}</p>
                <div class="life-detail-grid">
                    <div><strong>适用场景</strong><span>${escapeSceneHtml((route.lifeThemes || []).join("、") || route.scene || "未匹配")}</span></div>
                    <div><strong>涉及区域</strong><span>${escapeSceneHtml(routeAreas.join(" / ") || "待补全区域")}</span></div>
                    <div><strong>起点</strong><span>${escapeSceneHtml(route.start_area || "待补充")}</span></div>
                    <div><strong>途经地图点</strong><span>${escapeSceneHtml(pointItems.map(formatRoutePointLabel).join(" -> ") || route.point_ids || "待补充")}</span></div>
                    <div><strong>来源</strong><span>${escapeSceneHtml(route.source || "未知来源")}</span></div>
                </div>
                <div class="life-detail-actions">
                    <button class="small-button" type="button" onclick="location.href='route-detail.html?id=${Number(route.id)}'">查看路线详情</button>
                </div>
            `;
            return;
        }

        const point = getLifePointById(mapState.selectedLifePointId);
        if (point) {
            const routes = getMapPointRouteUsage(point.id);
            box.innerHTML = `
                <h3>地图点 #${Number(point.id)}：${escapeSceneHtml(point.name || "未命名地点")}</h3>
                <div class="life-detail-tags">${(point.lifeThemes || []).map(renderLifeThemeTag).join("")}</div>
                <p>${escapeSceneHtml(point.description || "暂无地点说明。")}</p>
                <div class="life-detail-grid">
                    <div><strong>地址 / 区域</strong><span>${escapeSceneHtml(point.address || point.lifeArea || "暂无地址")}</span></div>
                    <div><strong>来源</strong><span>${escapeSceneHtml(point.source || "未知来源")}</span></div>
                    <div><strong>关联入口</strong><span>${escapeSceneHtml(buildSceneRelatedText(point))}</span></div>
                    <div><strong>路线使用</strong><span>${mapState.routeLoadFailed ? "暂不可用" : `${routes.length} 条`}</span></div>
                </div>
                ${renderLifeRelatedRoutes(routes)}
                <div class="life-detail-actions">
                    ${buildSceneRelatedButton(point)}
                    <button class="small-button" type="button" onclick="location.href='map-detail.html?id=${Number(point.id)}'">查看地图点详情</button>
                </div>
            `;
            return;
        }

        box.innerHTML = `
            <h3>地点 / 路线详情</h3>
            <p>点击地图点位或下方路线，查看关联路线、真实库 / 线索入口和详情跳转。</p>
        `;
    }

    function renderLifeRelatedRoutes(routes) {
        if (mapState.routeLoadFailed) {
            return `<div class="scene-empty-state">路线关联暂不可用，请确认后端已启动。</div>`;
        }
        if (!routes || routes.length === 0) {
            return `<div class="scene-empty-state">该地点暂未被路线使用。</div>`;
        }
        return `
            <div class="life-related-routes">
                <strong>相关路线</strong>
                ${routes.map(route => `
                    <button class="small-button btn-secondary" type="button" onclick="selectLifeMapRoute(${Number(route.id)})">
                        路线 #${Number(route.id)}：${escapeSceneHtml(route.name || "未命名路线")}
                    </button>
                `).join("")}
            </div>
        `;
    }

    function renderLifeMapSamples() {
        const box = document.getElementById("lifeMapSamples");
        if (!box) {
            return;
        }
        box.innerHTML = lifeMapSamples.map(sample => `
            <div class="life-sample-card">
                <strong>${escapeSceneHtml(sample.area)}</strong>
                <span>${escapeSceneHtml(sample.items.join(" / "))}</span>
                <p>${escapeSceneHtml(sample.hint)}</p>
                <div>
                    <button class="small-button" type="button" onclick="showMapSceneModule('create')">去新增地点</button>
                    <button class="small-button btn-secondary" type="button" onclick="location.href='route.html'">去新增路线</button>
                </div>
            </div>
        `).join("");
    }

    function renderLifeSampleWorkbench() {
        renderSampleFilters("sampleZoneFilters", sampleZones, mapState.sampleZone, "setSampleZone");
        renderSampleFilters("sampleThemeFilters", sampleThemes, mapState.sampleTheme, "setSampleTheme");
        renderSamplePointList();
        renderSampleRouteList();
        renderSampleRouteDraft();
        renderSamplePendingTips();
        const notice = document.getElementById("sampleWorkbenchNotice");
        if (notice) {
            notice.textContent = mapState.sampleMessage || "样板项只是录入提示，不代表真实准确；请人工核验后再保存。";
        }
    }

    function renderSampleFilters(containerId, values, activeValue, handlerName) {
        const box = document.getElementById(containerId);
        if (!box) {
            return;
        }
        box.innerHTML = values.map(value => `
            <button class="sample-filter-chip ${activeValue === value ? "active" : ""}" type="button" onclick="${handlerName}('${escapeSceneJs(value)}')">
                ${escapeSceneHtml(value)}
            </button>
        `).join("");
    }

    function renderSamplePointList() {
        const box = document.getElementById("samplePointList");
        const countBox = document.getElementById("samplePointCount");
        if (!box) {
            return;
        }
        const points = getVisibleSamplePoints();
        if (countBox) {
            countBox.textContent = `${points.length} 条`;
        }
        box.innerHTML = points.length ? points.map(renderSamplePointCard).join("") : `<div class="scene-empty-state">当前筛选下暂无样板地点。</div>`;
    }

    function renderSampleRouteList() {
        const box = document.getElementById("sampleRouteList");
        const countBox = document.getElementById("sampleRouteCount");
        if (!box) {
            return;
        }
        const routes = getVisibleSampleRoutes();
        if (countBox) {
            countBox.textContent = `${routes.length} 条`;
        }
        box.innerHTML = routes.length ? routes.map(renderSampleRouteCard).join("") : `<div class="scene-empty-state">当前筛选下暂无样板路线。</div>`;
    }

    function renderSamplePointCard(sample) {
        return `
            <article class="sample-card sample-point-card">
                <div class="sample-card-tags">
                    <span class="sample-zone-tag">${escapeSceneHtml(sample.zone)}</span>
                    <span class="sample-theme-tag">${escapeSceneHtml(sample.theme)}</span>
                    <span class="sample-verify-tag">${escapeSceneHtml(sample.verify_status)}</span>
                </div>
                <h3>${escapeSceneHtml(sample.name)}</h3>
                <div class="sample-card-meta">
                    <span>分类：${escapeSceneHtml(sample.category)}</span>
                    <span>地址提示：${escapeSceneHtml(sample.address_hint)}</span>
                    <span>来源：${escapeSceneHtml(sample.source_note)}</span>
                </div>
                <p>${escapeSceneHtml(sample.description)}</p>
                <div class="sample-card-actions">
                    <button class="small-button" type="button" onclick="fillMapPointFromSample('${escapeSceneJs(sample.id)}')">填入新增地点草稿</button>
                    <button class="small-button btn-secondary" type="button" onclick="copySamplePointDraft('${escapeSceneJs(sample.id)}')">复制草稿</button>
                </div>
            </article>
        `;
    }

    function renderSampleRouteCard(sample) {
        const selected = mapState.selectedSampleRouteId === sample.id;
        return `
            <article class="sample-card sample-route-card ${selected ? "selected" : ""}">
                <div class="sample-card-tags">
                    <span class="sample-zone-tag">${escapeSceneHtml(sample.zone)}</span>
                    <span class="sample-theme-tag">${escapeSceneHtml(sample.theme)}</span>
                    <span class="sample-verify-tag">${escapeSceneHtml(sample.verify_status)}</span>
                </div>
                <h3>${escapeSceneHtml(sample.name)}</h3>
                <div class="sample-card-meta">
                    <span>起点提示：${escapeSceneHtml(sample.start_hint)}</span>
                    <span>终点提示：${escapeSceneHtml(sample.end_hint)}</span>
                    <span>途经提示：${escapeSceneHtml(sample.point_hints.join(" -> "))}</span>
                </div>
                <p>${escapeSceneHtml(sample.description)}</p>
                <div class="sample-card-actions">
                    <button class="small-button" type="button" onclick="selectSampleRouteDraft('${escapeSceneJs(sample.id)}')">生成路线草稿</button>
                    <button class="small-button btn-secondary" type="button" onclick="copySampleRouteDraft('${escapeSceneJs(sample.id)}')">复制路线草稿</button>
                    <button class="small-button btn-secondary" type="button" onclick="openRouteCenterWithSampleDraft('${escapeSceneJs(sample.id)}')">打开路线中心</button>
                </div>
            </article>
        `;
    }

    window.copySamplePointDraft = async function (sampleId) {
        const sample = getSamplePointById(sampleId);
        if (!sample) {
            return;
        }
        const copied = await copySceneText(buildSamplePointDraftText(sample));
        mapState.sampleMessage = copied ? "地点草稿已复制，可人工粘贴核验。" : "复制失败，请手动复制样板卡内容。";
        renderLifeSampleWorkbench();
    };

    function renderSampleRouteDraft() {
        const box = document.getElementById("sampleRouteDraftBox");
        if (!box) {
            return;
        }
        const sample = getSampleRouteById(mapState.selectedSampleRouteId);
        if (!sample) {
            box.innerHTML = "选择样板路线后，可复制草稿并打开路线中心人工录入。";
            return;
        }
        box.innerHTML = `
            <textarea class="sample-draft-textarea" readonly>${escapeSceneHtml(buildSampleRouteDraftText(sample))}</textarea>
            <div class="sample-card-actions">
                <button class="small-button" type="button" onclick="copySampleRouteDraft('${escapeSceneJs(sample.id)}')">复制路线草稿</button>
                <button class="small-button btn-secondary" type="button" onclick="openRouteCenterWithSampleDraft('${escapeSceneJs(sample.id)}')">打开路线中心</button>
            </div>
        `;
    }

    function renderSamplePendingTips() {
        const box = document.getElementById("samplePendingTips");
        if (!box) {
            return;
        }
        box.innerHTML = `
            <div class="sample-tip-list">
                <div>所有样板地点和路线均为“${escapeSceneHtml(sampleVerifyStatus)}”，只用于提示后续可录入的信息类型。</div>
                <div>填入新增地点草稿不会自动提交，仍需人工确认名称、地址、分类、来源和说明。</div>
                <div>路线草稿只提供复制和打开路线中心入口，不会自动创建路线，也不会修改 route.point_ids。</div>
            </div>
        `;
    }

    function getVisibleSamplePoints() {
        return lifeSamplePoints.filter(sample => isSampleVisible(sample));
    }

    function getVisibleSampleRoutes() {
        return lifeSampleRoutes.filter(sample => isSampleVisible(sample));
    }

    function isSampleVisible(sample) {
        const zoneMatched = mapState.sampleZone === "全部" || sample.zone === mapState.sampleZone;
        const themeMatched = mapState.sampleTheme === "全部主题" || sample.theme === mapState.sampleTheme;
        return zoneMatched && themeMatched;
    }

    function createSamplePoint(id, zone, theme, name, category, addressHint, description) {
        return {
            id,
            zone,
            theme,
            name,
            category,
            address_hint: addressHint,
            description,
            source_note: "四区样板库（待人工核验）",
            verify_status: sampleVerifyStatus
        };
    }

    function createSampleRoute(id, zone, theme, name, startHint, endHint, pointHints, description) {
        return {
            id,
            zone,
            theme,
            name,
            start_hint: startHint,
            end_hint: endHint,
            point_hints: pointHints,
            description,
            source_note: "四区样板库（待人工核验）",
            verify_status: sampleVerifyStatus
        };
    }

    function getSamplePointById(sampleId) {
        return lifeSamplePoints.find(sample => sample.id === sampleId);
    }

    function getSampleRouteById(sampleId) {
        return lifeSampleRoutes.find(sample => sample.id === sampleId);
    }

    function buildSamplePointDraftText(sample) {
        return [
            `区域：${sample.zone}`,
            `主题：${sample.theme}`,
            `核验状态：${sample.verify_status}`,
            `地址提示：${sample.address_hint}`,
            `说明：${sample.description}`,
            `来源说明：${sample.source_note}`,
            "注意：该样板项不是已核实真实地点，请人工核验后再保存。"
        ].join("\n");
    }

    function buildSampleRouteDraftText(sample) {
        return [
            `路线名称：${sample.name}`,
            `区域：${sample.zone}`,
            `主题：${sample.theme}`,
            `核验状态：${sample.verify_status}`,
            `起点提示：${sample.start_hint}`,
            `终点提示：${sample.end_hint}`,
            `途经提示：${sample.point_hints.join(" -> ")}`,
            `说明：${sample.description}`,
            `来源说明：${sample.source_note}`,
            "注意：该样板路线不是已核实真实路线，请人工核验后再录入路线中心。"
        ].join("\n");
    }

    async function copySceneText(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch (error) {
            // Fall back to the textarea method below.
        }
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "readonly");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        let copied = false;
        try {
            copied = document.execCommand && document.execCommand("copy");
        } catch (error) {
            copied = false;
        }
        document.body.removeChild(textarea);
        return copied;
    }

    function setInputValue(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.value = value || "";
        }
    }

    function setSelectValue(id, value) {
        const element = document.getElementById(id);
        if (!element) {
            return;
        }
        const option = Array.from(element.options || []).find(item => item.value === value || item.textContent.trim() === value);
        if (option) {
            element.value = option.value;
        }
    }

    function getVisibleLifePoints() {
        const points = getThemeFilteredLifePoints();
        const keyword = getLifeSearchKeyword();
        if (!keyword) {
            return points;
        }
        return points.filter(point => doesLifePointMatchSearch(point, keyword));
    }

    function getVisibleLifeRoutes() {
        const routes = getThemeFilteredLifeRoutes();
        const keyword = getLifeSearchKeyword();
        if (!keyword) {
            return routes;
        }
        return routes.filter(route => doesLifeRouteMatchSearch(route, keyword));
    }

    function getThemeFilteredLifePoints() {
        if (mapState.lifeTheme === "全部地图") {
            return mapState.points;
        }
        return mapState.points.filter(point => (point.lifeThemes || inferLifePointThemes(point)).includes(mapState.lifeTheme));
    }

    function getThemeFilteredLifeRoutes() {
        if (mapState.lifeTheme === "全部地图") {
            return mapState.routes || [];
        }
        return (mapState.routes || []).filter(route => (route.lifeThemes || inferLifeRouteThemes(route)).includes(mapState.lifeTheme));
    }

    function getLifeSearchKeyword() {
        return String(mapState.lifeSearchKeyword || "").trim().toLowerCase();
    }

    function doesLifePointMatchSearch(point, keyword) {
        return buildLifeSearchText([
            point.id,
            point.name,
            point.address,
            point.category,
            point.map_type,
            point.description,
            point.source,
            point.tags,
            point.zone,
            point.area,
            point.lifeArea || inferLifeMapArea(point),
            ...(point.lifeThemes || inferLifePointThemes(point))
        ]).includes(keyword);
    }

    function doesLifeRouteMatchSearch(route, keyword) {
        return buildLifeSearchText([
            route.id,
            route.name,
            route.title,
            route.description,
            route.route_description,
            route.category,
            route.map_type,
            route.route_type,
            route.start_area,
            route.source,
            route.tags,
            route.zone,
            route.area,
            route.point_ids,
            route.scene,
            ...(route.lifeThemes || inferLifeRouteThemes(route)),
            ...getLifeRouteAreas(route),
            ...buildRoutePointItems(route).flatMap(point => [
                point.id,
                point.name,
                point.category,
                point.address,
                point.description,
                point.source
            ]),
            ...getLifeRouteMappedPoints(route).flatMap(point => [
                point.name,
                point.category,
                point.address,
                point.description,
                point.source,
                point.lifeArea || inferLifeMapArea(point)
            ])
        ]).includes(keyword);
    }

    function buildLifeSearchText(values) {
        return values
            .flatMap(value => Array.isArray(value) ? value : [value])
            .map(value => String(value || ""))
            .join(" ")
            .toLowerCase();
    }

    function getLifeRouteMappedPoints(route) {
        const ids = new Set([
            ...buildRoutePointItems(route).map(point => Number(point.id)).filter(Boolean),
            ...parseRoutePointIds(route && route.point_ids)
        ]);
        return (mapState.points || []).filter(point => ids.has(Number(point.id)));
    }

    function inferLifePointThemes(point) {
        return inferLifeThemesFromValues([
            point.category,
            point.map_type,
            point.name,
            point.address,
            point.description,
            point.source
        ]);
    }

    function inferLifeRouteThemes(route) {
        const pointText = (route.points || []).map(point => `${point.name || ""} ${point.category || ""} ${point.address || ""} ${point.description || ""}`).join(" ");
        return inferLifeThemesFromValues([
            route.category,
            route.route_type,
            route.name,
            route.start_area,
            route.description,
            route.source,
            pointText
        ]);
    }

    function inferLifeThemesFromValues(values) {
        const text = values.map(value => String(value || "")).join(" ").toLowerCase();
        return lifeMapThemes
            .filter(theme => theme.name !== "全部地图" && theme.keywords.some(keyword => text.includes(keyword.toLowerCase())))
            .map(theme => theme.name);
    }

    function inferLifeMapArea(point) {
        const text = [point.name, point.address, point.description, point.source].map(value => String(value || "")).join(" ");
        if (hasLifeAreaKeyword(text, ["穗石", "穗石村", "穗石路", "穗石市场", "穗石生活区"])) return "穗石";
        if (hasLifeAreaKeyword(text, ["南亭", "南亭村", "南亭渡口", "南亭商业街"])) return "南亭";
        if (hasLifeAreaKeyword(text, ["贝岗", "贝岗村", "贝岗地铁"])) return "贝岗";
        if (hasLifeAreaKeyword(text, ["北亭", "北亭村", "北亭广场", "北亭生活区"])) return "北亭";
        if (hasLifeAreaKeyword(text, ["大学城北", "大学城北站", "北站"])) return "贝岗";
        return LIFE_AREA_PENDING;
    }

    function hasLifeAreaKeyword(text, keywords) {
        return keywords.some(keyword => text.includes(keyword));
    }

    function groupLifePointsByArea(points) {
        const groups = new Map();
        lifeMapAreas.forEach(area => groups.set(area, []));
        points.forEach(point => {
            const area = point.lifeArea || inferLifeMapArea(point);
            if (groups.has(area)) {
                groups.get(area).push(point);
            }
        });
        return groups;
    }

    function countLifePointsByArea(points) {
        const counts = {};
        points.forEach(point => {
            const area = point.lifeArea || inferLifeMapArea(point);
            if (lifeMapAreas.includes(area)) {
                counts[area] = (counts[area] || 0) + 1;
            }
        });
        return counts;
    }

    function getPendingLifeAreaPoints(points) {
        return points.filter(point => !lifeMapAreas.includes(point.lifeArea || inferLifeMapArea(point)));
    }

    function getLifeRoutesForArea(area) {
        const areaPointIds = new Set(getVisibleLifePoints()
            .filter(point => (point.lifeArea || inferLifeMapArea(point)) === area)
            .map(point => Number(point.id))
            .filter(Boolean));
        return getVisibleLifeRoutes().filter(route => getLifeRoutePointIds(route).some(pointId => areaPointIds.has(Number(pointId))));
    }

    function getLifeTheme(name) {
        return lifeMapThemes.find(theme => theme.name === name);
    }

    function renderLifeThemeTag(name) {
        const theme = getLifeTheme(name) || lifeMapThemes[0];
        return `<span class="life-theme-tag life-theme-${theme.className}">${escapeSceneHtml(name)}</span>`;
    }

    function getLifeAreaClass(area) {
        const index = Math.max(lifeMapAreas.indexOf(area), 0);
        return String(index + 1);
    }

    function getLifePointById(pointId) {
        const id = Number(pointId);
        return (mapState.points || []).find(point => Number(point.id) === id);
    }

    function getLifeRouteById(routeId) {
        const id = Number(routeId);
        return (mapState.routes || []).find(route => Number(route.id) === id);
    }

    function getLifeRoutePointIds(route) {
        if (!route) {
            return [];
        }
        return buildRoutePointItems(route).map(point => Number(point.id)).filter(Boolean);
    }

    function getLifeRouteAreas(route) {
        const pointIds = new Set(getLifeRoutePointIds(route));
        const areas = new Set();
        (mapState.points || []).forEach(point => {
            if (!pointIds.has(Number(point.id))) {
                return;
            }
            const area = point.lifeArea || inferLifeMapArea(point);
            if (lifeMapAreas.includes(area)) {
                areas.add(area);
            }
        });
        return Array.from(areas);
    }

    function renderMapSceneView() {
        const box = document.getElementById("mapPointList");
        if (!box) {
            return;
        }

        renderMapStats(mapState.points);
        renderMapOverviewPreview(mapState.points);
        renderLifeMapEngine();
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
                mapState.routes = [];
                mapState.routeUsage = new Map();
                mapState.routeLoadFailed = true;
                renderLifeMapEngine();
                renderMapDedupeView();
                return;
            }

            mapState.routes = (data.data || []).map(route => ({
                ...route,
                lifeThemes: inferLifeRouteThemes(route)
            }));
            mapState.routeUsage = buildMapRouteUsage(mapState.routes);
            mapState.routesLoaded = true;
            mapState.routeLoadFailed = false;
            renderLifeMapEngine();
            renderMapDedupeView();
        } catch (error) {
            mapState.routes = [];
            mapState.routeUsage = new Map();
            mapState.routeLoadFailed = true;
            renderLifeMapEngine();
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

    function renderMapDedupeGroup(group) {
        const typeLabel = group.type === "strong" ? "强疑似重复" : "弱疑似重复";
        const typeClass = group.type === "strong" ? "strong" : "weak";
        const idsText = group.points.map(point => `#${Number(point.id)}`).join("、");
        const selectedKeepId = mapState.dedupeKeepChoices.get(group.key) || Number(group.recommended.id);
        const keepPoint = group.points.find(point => Number(point.id) === Number(selectedKeepId)) || group.recommended;
        const duplicatePoints = group.points.filter(point => Number(point.id) !== Number(keepPoint.id));
        const recommendationReason = getMapDedupeRecommendationReason(group, group.recommended);

        return `
            <div class="dedupe-group-card">
                <div class="dedupe-group-header">
                    <div>
                        <span class="tag dedupe-type-${typeClass}">${typeLabel}</span>
                        <h3>${escapeSceneHtml(group.name)}</h3>
                        <p>涉及 ID：${escapeSceneHtml(idsText)}</p>
                    </div>
                    <div class="dedupe-recommend">
                        <strong>推荐保留：地图点 #${Number(group.recommended.id)}</strong>
                        <span>推荐理由：${escapeSceneHtml(recommendationReason)}。其它记录先人工核对，不自动合并。</span>
                    </div>
                </div>
                <div class="scene-duplicate-note">本页只做识别、预览和人工治理入口，不自动删除、不自动合并、不修改路线 point_ids。</div>
                <div class="dedupe-keep-selector">
                    <div>
                        <strong>选择保留记录</strong>
                        <p>当前保留：地图点 #${Number(keepPoint.id)} · ${escapeSceneHtml(keepPoint.name || "未命名地点")}。待处理重复点：${duplicatePoints.map(point => `#${Number(point.id)}`).join("、") || "无"}。</p>
                    </div>
                    <div class="dedupe-keep-buttons">
                        ${group.points.map(point => `
                            <button class="small-button ${Number(point.id) === Number(keepPoint.id) ? "" : "btn-secondary"}" type="button" onclick="setMapDedupeKeepPoint('${escapeSceneJs(group.key)}', ${Number(point.id)})">设为保留 #${Number(point.id)}</button>
                        `).join("")}
                    </div>
                </div>
                <div class="dedupe-point-list">
                    ${group.points.map(point => renderMapDedupePoint(point, Number(point.id) === Number(group.recommended.id))).join("")}
                </div>
                ${renderMapDedupeMergePreview(group, keepPoint)}
                <div class="scene-preview-actions">
                    <button class="small-button" type="button" onclick="showMapSceneModule('list')">打开地图中心地点列表</button>
                </div>
            </div>
        `;
    }

    function getMapDedupeRecommendationReason(group, recommended) {
        const routeCounts = group.points.map(point => getMapPointRouteUsage(point.id).length);
        const maxRouteCount = Math.max(...routeCounts);
        const recommendedRouteCount = getMapPointRouteUsage(recommended.id).length;
        if (recommendedRouteCount > 0 && recommendedRouteCount === maxRouteCount && routeCounts.filter(count => count === maxRouteCount).length === 1) {
            return "被路线使用更多";
        }

        const knownTimes = group.points
            .map(point => ({id: Number(point.id), time: Date.parse(point.created_at || "")}))
            .filter(item => Number.isFinite(item.time))
            .sort((a, b) => a.time - b.time || a.id - b.id);
        if (knownTimes.length && knownTimes[0].id === Number(recommended.id)) {
            return "创建时间较早";
        }

        return "ID 更小";
    }

    function renderMapDedupeMergePreview(group, keepPoint) {
        const duplicatePoints = group.points.filter(point => Number(point.id) !== Number(keepPoint.id));
        const routeImpacts = buildMapDedupeRouteImpacts(keepPoint, duplicatePoints);
        const relationImpacts = buildMapDedupeRelationImpacts(keepPoint, duplicatePoints);
        const planText = buildMapDedupePlanText(group, keepPoint, duplicatePoints, routeImpacts, relationImpacts);
        const planId = getMapDedupePlanId(group.key);
        const copyMessage = mapState.dedupeCopyMessage === group.key
            ? "已复制合并处理方案"
            : mapState.dedupeCopyMessage === `manual:${group.key}`
                ? "浏览器不支持自动复制，请手动复制下方方案"
                : "";

        return `
            <div class="dedupe-merge-preview">
                <div class="scene-linked-point-head">
                    <strong>安全合并预览</strong>
                    <span class="tag warning">仅预览，不写入</span>
                </div>
                <div class="dedupe-preview-grid">
                    <section class="dedupe-preview-section">
                        <h4>保留地图点</h4>
                        ${renderMapDedupePreviewPoint(keepPoint)}
                    </section>
                    <section class="dedupe-preview-section">
                        <h4>待处理重复点</h4>
                        ${duplicatePoints.length
                            ? duplicatePoints.map(point => renderMapDedupePreviewPoint(point)).join("")
                            : `<div class="scene-empty-state">暂无待处理重复点。</div>`}
                    </section>
                </div>
                <section class="dedupe-preview-section">
                    <h4>路线影响预览</h4>
                    ${renderMapDedupeRouteImpacts(routeImpacts, duplicatePoints, keepPoint)}
                </section>
                <section class="dedupe-preview-section">
                    <h4>关联信息影响</h4>
                    ${relationImpacts.map(item => `<div class="scene-empty-state">${escapeSceneHtml(item)}</div>`).join("")}
                </section>
                <div class="dedupe-risk-note">本轮仅生成合并预览，不会修改数据库、不会删除地图点、不会自动修改 route.point_ids。合并前请人工确认路线、真实库和线索关联。</div>
                <section class="dedupe-preview-section">
                    <div class="scene-linked-point-head">
                        <h4>处理建议</h4>
                        <button class="small-button" type="button" onclick="copyMapDedupePlan('${escapeSceneJs(group.key)}')">复制处理方案</button>
                    </div>
                    ${copyMessage ? `<div class="dedupe-copy-status">${escapeSceneHtml(copyMessage)}</div>` : ""}
                    <textarea id="${planId}" class="dedupe-plan-text" readonly>${escapeSceneHtml(planText)}</textarea>
                </section>
            </div>
        `;
    }

    function renderMapDedupePreviewPoint(point) {
        const routes = getMapPointRouteUsage(point.id);
        return `
            <div class="dedupe-preview-point">
                <strong>地图点 #${Number(point.id)} · ${escapeSceneHtml(point.name || "未命名地点")}</strong>
                <div class="scene-point-meta">
                    <span>ID：${Number(point.id)}</span>
                    <span>地址：${escapeSceneHtml(point.address || "暂无地址/区域")}</span>
                    <span>来源：${escapeSceneHtml(point.source || "未知来源")}</span>
                    <span>关联：${escapeSceneHtml(formatMapPointRelation(point))}</span>
                    <span>路线使用：${mapState.routeLoadFailed ? "暂不可用" : `${routes.length} 条`}</span>
                </div>
                ${renderMapDedupeRouteLinks(routes)}
            </div>
        `;
    }

    function buildMapDedupeRouteImpacts(keepPoint, duplicatePoints) {
        const keepId = Number(keepPoint.id);
        const duplicateIds = duplicatePoints.map(point => Number(point.id)).filter(Boolean);
        const routeMap = new Map();
        duplicateIds.forEach(pointId => {
            getMapPointRouteUsage(pointId).forEach(route => {
                routeMap.set(Number(route.id), route);
            });
        });

        return [...routeMap.values()].map(route => {
            const currentIds = getRoutePointIdsForPreview(route);
            const suggestedIds = previewReplaceRoutePointIds(currentIds, keepId, duplicateIds);
            return {
                route,
                currentIds,
                suggestedIds,
                changed: currentIds.join(",") !== suggestedIds.join(",")
            };
        }).filter(item => item.changed);
    }

    function getRoutePointIdsForPreview(route) {
        const ids = parseRoutePointIds(route.point_ids);
        if (ids.length) {
            return ids;
        }
        if (Array.isArray(route.points)) {
            return route.points
                .map(point => Number(point.id || point.point_id || point))
                .filter(Boolean);
        }
        return [];
    }

    function previewReplaceRoutePointIds(currentIds, keepId, duplicateIds) {
        const duplicateIdSet = new Set(duplicateIds.map(Number));
        const seen = new Set();
        const result = [];
        currentIds.forEach(id => {
            const normalizedId = Number(id);
            if (!normalizedId) {
                return;
            }
            const nextId = duplicateIdSet.has(normalizedId) ? Number(keepId) : normalizedId;
            if (!seen.has(nextId)) {
                seen.add(nextId);
                result.push(nextId);
            }
        });
        return result;
    }

    function renderMapDedupeRouteImpacts(routeImpacts, duplicatePoints, keepPoint) {
        if (mapState.routeLoadFailed) {
            return `<div class="scene-empty-state">路线使用情况暂不可用，无法生成路线 point_ids 预览。</div>`;
        }
        if (!routeImpacts.length) {
            return `<div class="scene-empty-state">待处理重复点暂未被路线使用，暂无 route.point_ids 替换建议。</div>`;
        }
        const duplicateIdsText = duplicatePoints.map(point => `#${Number(point.id)}`).join("、");
        return `
            <div class="dedupe-route-impact-list">
                ${routeImpacts.map(item => `
                    <div class="dedupe-route-impact">
                        <strong>路线 #${Number(item.route.id)}：${escapeSceneHtml(item.route.name || "未命名路线")}</strong>
                        <div class="scene-point-meta">
                            <span>当前 point_ids：${escapeSceneHtml(item.currentIds.join(",") || "空")}</span>
                            <span>建议替换后：${escapeSceneHtml(item.suggestedIds.join(",") || "空")}</span>
                            <span>说明：将 ${escapeSceneHtml(duplicateIdsText)} 替换为 #${Number(keepPoint.id)}，并去除重复 ID。</span>
                        </div>
                        <button class="small-button btn-secondary" type="button" onclick="location.href='route-detail.html?id=${Number(item.route.id)}'">查看路线详情 #${Number(item.route.id)}</button>
                    </div>
                `).join("")}
            </div>
        `;
    }

    function buildMapDedupeRelationImpacts(keepPoint, duplicatePoints) {
        const keepRelation = getMapPointRelationKey(keepPoint);
        const duplicateRelations = duplicatePoints
            .map(point => ({point, key: getMapPointRelationKey(point)}))
            .filter(item => item.key);
        if (!duplicateRelations.length) {
            return ["待处理重复点未发现真实库 / 线索关联。"];
        }
        const impacts = [];
        duplicateRelations.forEach(item => {
            if (!keepRelation) {
                impacts.push(`地图点 #${Number(item.point.id)} 关联 ${formatMapPointRelation(item.point)}，保留点暂无关联，建议人工迁移关联。`);
            } else if (keepRelation !== item.key) {
                impacts.push(`保留点关联 ${formatMapPointRelation(keepPoint)}，地图点 #${Number(item.point.id)} 关联 ${formatMapPointRelation(item.point)}，存在多来源关联，需人工确认。`);
            }
        });
        return impacts.length ? impacts : ["保留点已覆盖相同真实库 / 线索关联，仍建议人工核对后再处理重复记录。"];
    }

    function formatMapPointRelation(point) {
        if (!point.target_type || !point.target_id) {
            return "暂未关联";
        }
        return `${getRelatedTargetLabel(point.target_type)} #${point.target_id}`;
    }

    function getMapPointRelationKey(point) {
        if (!point.target_type || !point.target_id) {
            return "";
        }
        return `${point.target_type}:${point.target_id}`;
    }

    function buildMapDedupePlanText(group, keepPoint, duplicatePoints, routeImpacts, relationImpacts) {
        const duplicateText = duplicatePoints.map(point => `#${Number(point.id)}`).join("、") || "无";
        const routeLines = routeImpacts.length
            ? routeImpacts.map(item => `建议将路线 #${Number(item.route.id)} 的 point_ids 从 ${item.currentIds.join(",") || "空"} 调整为 ${item.suggestedIds.join(",") || "空"}`)
            : ["待处理重复点暂未影响路线 point_ids。"];
        return [
            "重复地点合并建议：",
            `重复组：${group.name}`,
            `保留地图点 #${Number(keepPoint.id)}：${keepPoint.name || "未命名地点"}`,
            `待处理重复点：${duplicateText}`,
            ...routeLines,
            "关联影响：",
            ...relationImpacts.map(item => `- ${item}`),
            "本轮仅生成预览，不会修改数据库、不会删除地图点、不会自动修改 route.point_ids。",
            "建议人工检查重复点的真实库 / 线索关联后，再归档或删除重复记录。"
        ].join("\n");
    }

    function getMapDedupePlanId(groupKey) {
        return `mapDedupePlan-${String(groupKey).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
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
        initSceneTabs("map", "life");
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
