// submit-action-fix.js
// 统一提交修复包：
// 1. 修复“点击新建/提交没反应”
// 2. 所有提交成功后自动清空智能识别输入框
// 3. 所有提交失败时显示具体错误

const SUBMIT_ACTION_API = "http://127.0.0.1:8000";

function setSubmitMessage(id, text) {
    const box = document.getElementById(id);
    if (box) {
        box.innerText = text;
    } else {
        alert(text);
    }
}

function clearSmartBoxesAfterSubmit() {
    if (typeof clearGenericSmartInput === "function") {
        clearGenericSmartInput();
    }

    if (typeof clearRouteSmartInput === "function") {
        clearRouteSmartInput();
    }

    if (typeof clearMapSmartInput === "function") {
        clearMapSmartInput();
    }

    if (typeof clearSmartEditPanel === "function") {
        clearSmartEditPanel();
    }

    const genericInput = document.getElementById("genericSmartInput");
    if (genericInput) genericInput.value = "";

    const routeInput = document.getElementById("routeSmartInput");
    if (routeInput) routeInput.value = "";

    const mapInput = document.getElementById("mapSmartInput");
    if (mapInput) mapInput.value = "";

    const genericPreview = document.getElementById("genericSmartPreview");
    if (genericPreview) genericPreview.innerText = "";

    const routePreview = document.getElementById("routeSmartPreview");
    if (routePreview) routePreview.innerText = "";

    const mapPreview = document.getElementById("mapSmartPreview");
    if (mapPreview) mapPreview.innerText = "";

    const genericConfirm = document.getElementById("genericSmartConfirmBtn");
    if (genericConfirm) genericConfirm.style.display = "none";

    const routeConfirm = document.getElementById("routeSmartConfirmBtn");
    if (routeConfirm) routeConfirm.style.display = "none";

    const mapConfirm = document.getElementById("mapSmartConfirmBtn");
    if (mapConfirm) mapConfirm.style.display = "none";

    const progressText = document.getElementById("smartProgressText");
    const progressBar = document.getElementById("smartProgressBar");

    if (progressText) {
        progressText.innerText = "同步成功，已清空智能识别输入";
    }

    if (progressBar) {
        progressBar.style.width = "100%";
    }
}

function getInputValue(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
}

function getSelectValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : "";
}

function clearInputValue(id) {
    const el = document.getElementById(id);
    if (el) {
        el.value = "";
    }
}

async function safeJson(response) {
    try {
        return await response.json();
    } catch (error) {
        return {
            detail: "响应不是 JSON，可能后端接口报错或未启动"
        };
    }
}

/* =========================
   提交线索 submit.html
========================= */

window.submitClue = async function () {
    const title = getInputValue("clueTitle");
    const category = getSelectValue("clueCategory");
    const sourcePlatform = getInputValue("cluePlatform");
    const sourceUrl = getInputValue("clueUrl");
    const summary = getInputValue("clueSummary");

    if (!title) {
        alert("请填写线索标题。");
        return;
    }

    setSubmitMessage("submitMessage", "正在提交线索，请稍等...");

    try {
        const response = await fetch(`${SUBMIT_ACTION_API}/clues`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                title: title,
                category: category || "外部线索",
                source_platform: sourcePlatform || "用户投稿",
                source_url: sourceUrl || null,
                summary: summary || "用户提交的线索，等待审核和核验。"
            })
        });

        const data = await safeJson(response);

        if (!response.ok) {
            setSubmitMessage("submitMessage", "提交失败：" + JSON.stringify(data));
            return;
        }

        setSubmitMessage("submitMessage", "线索提交成功，已进入线索库。");

        clearInputValue("clueTitle");
        clearInputValue("cluePlatform");
        clearInputValue("clueUrl");
        clearInputValue("clueSummary");

        clearSmartBoxesAfterSubmit();

    } catch (error) {
        setSubmitMessage("submitMessage", "提交失败，请确认后端已启动。\n" + error.message);
    }
};

/* =========================
   采集目标 crawler.html
========================= */

function getSubmitActionAdminToken() {
    return localStorage.getItem("xgw_user_token") || "";
}

window.submitCrawlTarget = async function () {
    const url = getInputValue("targetUrl");
    const category = getSelectValue("targetCategory");
    const platform = getInputValue("targetPlatform");
    const note = getInputValue("targetNote");

    if (!url) {
        alert("请填写采集网址。");
        return;
    }

    setSubmitMessage("targetMessage", "正在保存采集目标，请稍等...");

    try {
        const response = await fetch(`${SUBMIT_ACTION_API}/crawler/targets`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                token: getSubmitActionAdminToken(),
                url: url,
                category: category || "外部线索",
                source_platform: platform || "公开网页自动采集",
                enabled: true,
                note: note || ""
            })
        });

        const data = await safeJson(response);

        if (!response.ok) {
            setSubmitMessage("targetMessage", "保存失败：" + JSON.stringify(data));
            return;
        }

        setSubmitMessage("targetMessage", "采集目标保存成功。");

        clearInputValue("targetUrl");
        clearInputValue("targetPlatform");
        clearInputValue("targetNote");

        clearSmartBoxesAfterSubmit();

        if (typeof loadCrawlerTargets === "function") {
            await loadCrawlerTargets();
        }

    } catch (error) {
        setSubmitMessage("targetMessage", "保存失败，请确认后端已启动。\n" + error.message);
    }
};

/* =========================
   地图点 map.html
========================= */

window.createMapPoint = async function () {
    const name = getInputValue("mapName");
    const category = getSelectValue("mapCategory");
    const address = getInputValue("mapAddress");
    const latitude = getInputValue("mapLatitude");
    const longitude = getInputValue("mapLongitude");
    const mapType = getSelectValue("mapType");
    const targetType = getSelectValue("mapTargetType");
    const targetIdText = getInputValue("mapTargetId");
    const source = getInputValue("mapSource");
    const description = getInputValue("mapDescription");

    if (!name) {
        alert("请填写地点名称。");
        return;
    }

    setSubmitMessage("mapMessage", "正在新增地图点，请稍等...");

    try {
        const response = await fetch(`${SUBMIT_ACTION_API}/map-points`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                token: getSubmitActionAdminToken(),
                name: name,
                category: category || "外部线索",
                address: address || null,
                latitude: latitude || null,
                longitude: longitude || null,
                map_type: mapType || "生活地点",
                target_type: targetType || null,
                target_id: targetIdText ? Number(targetIdText) : null,
                source: source || "手动添加",
                description: description || null
            })
        });

        const data = await safeJson(response);

        if (!response.ok) {
            setSubmitMessage("mapMessage", "新增失败：" + JSON.stringify(data));
            return;
        }

        setSubmitMessage("mapMessage", "地图点新增成功。");

        clearInputValue("mapName");
        clearInputValue("mapAddress");
        clearInputValue("mapLatitude");
        clearInputValue("mapLongitude");
        clearInputValue("mapTargetId");
        clearInputValue("mapSource");
        clearInputValue("mapDescription");

        clearSmartBoxesAfterSubmit();

        if (typeof loadMapPoints === "function") {
            await loadMapPoints();
        }

    } catch (error) {
        setSubmitMessage("mapMessage", "新增失败，请确认后端已启动。\n" + error.message);
    }
};

/* =========================
   路线 route.html
========================= */

window.createRoute = async function () {
    const name = getInputValue("routeName");
    const routeType = getSelectValue("routeType");
    const category = getSelectValue("routeCategory");
    const startArea = getInputValue("routeStartArea");
    const pointIds = getInputValue("routePointIds");
    const source = getInputValue("routeSource");
    const description = getInputValue("routeDescription");

    if (!name) {
        alert("请填写路线名称。");
        return;
    }

    setSubmitMessage("routeMessage", "正在新建路线，请稍等...");

    try {
        const response = await fetch(`${SUBMIT_ACTION_API}/routes`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                token: getSubmitActionAdminToken(),
                name: name,
                route_type: routeType || "citywalk路线",
                category: category || "路线",
                start_area: startArea || null,
                point_ids: pointIds || null,
                source: source || "手动添加",
                description: description || null
            })
        });

        const data = await safeJson(response);

        if (!response.ok) {
            setSubmitMessage("routeMessage", "路线创建失败：" + JSON.stringify(data));
            return;
        }

        clearInputValue("routeName");
        clearInputValue("routeStartArea");
        clearInputValue("routePointIds");
        clearInputValue("routeSource");
        clearInputValue("routeDescription");

        clearSmartBoxesAfterSubmit();

        setSubmitMessage("routeMessage", "路线创建成功。");

        if (typeof loadRoutes === "function") {
            await loadRoutes();
        }

    } catch (error) {
        setSubmitMessage("routeMessage", "路线创建失败，请确认后端已启动。\n" + error.message);
    }
};

/* =========================
   反馈 clue-detail / item-detail
========================= */

window.submitFeedback = async function (targetType) {
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get("id");

    const userName = getInputValue("feedbackUserName");
    const feedbackType = getSelectValue("feedbackType");
    const content = getInputValue("feedbackContent");

    if (!targetId) {
        alert("缺少详情 ID，无法提交反馈。");
        return;
    }

    if (!content) {
        alert("请填写反馈内容。");
        return;
    }

    setSubmitMessage("feedbackMessage", "正在提交反馈，请稍等...");

    try {
        const response = await fetch(`${SUBMIT_ACTION_API}/feedbacks`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                target_type: targetType,
                target_id: Number(targetId),
                feedback_type: feedbackType || "补充信息",
                content: content,
                user_name: userName || "匿名用户"
            })
        });

        const data = await safeJson(response);

        if (!response.ok) {
            setSubmitMessage("feedbackMessage", "反馈提交失败：" + JSON.stringify(data));
            return;
        }

        setSubmitMessage("feedbackMessage", "反馈提交成功。");

        clearInputValue("feedbackUserName");
        clearInputValue("feedbackContent");

        clearSmartBoxesAfterSubmit();

        if (typeof loadFeedback === "function") {
            await loadFeedback(targetType);
        }

    } catch (error) {
        setSubmitMessage("feedbackMessage", "反馈提交失败，请确认后端已启动。\n" + error.message);
    }
};
