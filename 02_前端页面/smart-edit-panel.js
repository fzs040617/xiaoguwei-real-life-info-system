// smart-edit-panel.js
// 智能识别结果可编辑面板：
// 识别后把结果显示为可编辑表单，用户修改后自动同步到真实表单。

function showSmartEditPanel(pageType, data) {
    const smartInput =
        document.getElementById("mapSmartInput") ||
        document.getElementById("genericSmartInput") ||
        document.getElementById("routeSmartInput");

    if (!smartInput) {
        return;
    }

    let panel = document.getElementById("smartEditPanel");

    if (!panel) {
        panel = document.createElement("div");
        panel.id = "smartEditPanel";
        panel.className = "box";
        panel.style.marginTop = "14px";

        const smartBox = smartInput.closest(".box");
        if (smartBox) {
            smartBox.appendChild(panel);
        }
    }

    const fields = getSmartEditFields(pageType, data);

    panel.innerHTML = `
        <h2>识别结果校正</h2>
        <p class="notice">
            这里是系统识别出来的字段。你可以先修改这里，修改后会同步到下方表单，再点击“确认同步到系统”。
        </p>
        ${fields.map(field => renderSmartEditField(field)).join("")}
        <button onclick="applySmartEditPanel('${pageType}')">应用修改到表单</button>
    `;

    panel.dataset.pageType = pageType;
}

function getSmartEditFields(pageType, data) {
    if (pageType === "map") {
        return [
            { key: "name", label: "地点名称", value: data.name || "" },
            { key: "category", label: "分类", value: data.category || "" },
            { key: "address", label: "地址/区域", value: data.address || "" },
            { key: "latitude", label: "纬度", value: data.latitude || "" },
            { key: "longitude", label: "经度", value: data.longitude || "" },
            { key: "mapType", label: "地图类型", value: data.mapType || "" },
            { key: "targetType", label: "关联对象类型", value: data.targetType || "" },
            { key: "targetId", label: "关联对象 ID", value: data.targetId || "" },
            { key: "source", label: "来源", value: data.source || "" },
            { key: "description", label: "说明", value: data.description || "", textarea: true }
        ];
    }

    if (pageType === "route") {
        return [
            { key: "name", label: "路线名称", value: data.name || "" },
            { key: "routeType", label: "路线类型", value: data.routeType || "" },
            { key: "category", label: "分类", value: data.category || "" },
            { key: "startArea", label: "起点/区域", value: data.startArea || "" },
            { key: "pointIds", label: "地图点 ID", value: data.pointIds || "" },
            { key: "source", label: "来源", value: data.source || "" },
            { key: "description", label: "路线说明", value: data.description || "", textarea: true }
        ];
    }

    if (pageType === "clue") {
        return [
            { key: "title", label: "线索标题", value: data.title || "" },
            { key: "category", label: "分类", value: data.category || "" },
            { key: "source", label: "来源平台", value: data.source || "" },
            { key: "url", label: "来源链接", value: data.url || "" },
            { key: "summary", label: "线索简介", value: data.summary || "", textarea: true }
        ];
    }

    if (pageType === "crawler") {
        return [
            { key: "url", label: "采集网址", value: data.url || "" },
            { key: "category", label: "分类", value: data.category || "" },
            { key: "source", label: "来源平台", value: data.source || "" },
            { key: "summary", label: "备注", value: data.summary || "", textarea: true }
        ];
    }

    if (pageType === "feedback") {
        return [
            { key: "userName", label: "昵称", value: data.userName || "" },
            { key: "feedbackType", label: "反馈类型", value: data.feedbackType || "" },
            { key: "feedbackContent", label: "反馈内容", value: data.feedbackContent || "", textarea: true }
        ];
    }

    return [];
}

function renderSmartEditField(field) {
    const id = "smartEdit_" + field.key;
    const value = escapeSmartEditAttr(field.value || "");

    if (field.textarea) {
        return `
            <div class="form-row">
                <label>${field.label}</label>
                <textarea id="${id}" oninput="applySmartEditPanel('${getCurrentSmartEditPageType()}')">${escapeSmartEditHtml(field.value || "")}</textarea>
            </div>
        `;
    }

    return `
        <div class="form-row">
            <label>${field.label}</label>
            <input id="${id}" value="${value}" oninput="applySmartEditPanel('${getCurrentSmartEditPageType()}')">
        </div>
    `;
}

function getCurrentSmartEditPageType() {
    const panel = document.getElementById("smartEditPanel");
    return panel ? panel.dataset.pageType || "" : "";
}

function readSmartEditData(pageType) {
    const fields = getSmartEditFields(pageType, {});
    const data = {};

    fields.forEach(field => {
        const el = document.getElementById("smartEdit_" + field.key);
        data[field.key] = el ? el.value.trim() : "";
    });

    return data;
}

function applySmartEditPanel(pageType) {
    if (!pageType) {
        return;
    }

    const data = readSmartEditData(pageType);

    if (pageType === "map") {
        setValue("mapName", data.name);
        setSelectValueSmartEdit("mapCategory", data.category);
        setValue("mapAddress", data.address);
        setValue("mapLatitude", data.latitude);
        setValue("mapLongitude", data.longitude);
        setSelectValueSmartEdit("mapType", data.mapType);
        setSelectValueSmartEdit("mapTargetType", data.targetType);
        setValue("mapTargetId", data.targetId);
        setValue("mapSource", data.source);
        setValue("mapDescription", data.description);
        return;
    }

    if (pageType === "route") {
        setValue("routeName", data.name);
        setSelectValueSmartEdit("routeType", data.routeType);
        setSelectValueSmartEdit("routeCategory", data.category);
        setValue("routeStartArea", data.startArea);
        setValue("routePointIds", data.pointIds);
        setValue("routeSource", data.source);
        setValue("routeDescription", data.description);
        return;
    }

    if (pageType === "clue") {
        setValue("clueTitle", data.title);
        setSelectValueSmartEdit("clueCategory", data.category);
        setValue("cluePlatform", data.source);
        setValue("clueUrl", data.url);
        setValue("clueSummary", data.summary);
        return;
    }

    if (pageType === "crawler") {
        setValue("targetUrl", data.url);
        setSelectValueSmartEdit("targetCategory", data.category);
        setValue("targetPlatform", data.source);
        setValue("targetNote", data.summary);
        return;
    }

    if (pageType === "feedback") {
        setValue("feedbackUserName", data.userName);
        setSelectValueSmartEdit("feedbackType", data.feedbackType);
        setValue("feedbackContent", data.feedbackContent);
        return;
    }
}

function clearSmartEditPanel() {
    const panel = document.getElementById("smartEditPanel");
    if (panel) {
        panel.remove();
    }
}

function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.value = value || "";
    }
}

function setSelectValueSmartEdit(id, value) {
    const el = document.getElementById(id);
    if (!el || !value) {
        return;
    }

    const matched = Array.from(el.options).find(option => option.value === value || option.text === value);
    if (matched) {
        el.value = matched.value;
    }
}

function escapeSmartEditHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function escapeSmartEditAttr(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}