// clue-item-detail-edit.js
// 线索详情页 / 真实库详情页编辑保存功能

const CLUE_ITEM_EDIT_API = "http://127.0.0.1:8000";
const CLUE_ITEM_EDIT_TOKEN_KEY = "xgw_user_token";

function getClueItemEditToken() {
    return localStorage.getItem(CLUE_ITEM_EDIT_TOKEN_KEY) || "";
}

window.addEventListener("load", () => {
    setTimeout(injectClueItemEditBox, 600);
});

function getClueItemDetailId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
}

function isClueDetailPage() {
    return location.pathname.includes("clue-detail");
}

function isItemDetailPage() {
    return location.pathname.includes("item-detail");
}

async function injectClueItemEditBox() {
    const id = getClueItemDetailId();
    const container = document.querySelector(".container");

    if (!id || !container || document.getElementById("clueItemEditBox")) {
        return;
    }

    if (isClueDetailPage()) {
        await injectClueEditBox(id, container);
    }

    if (isItemDetailPage()) {
        await injectVerifiedEditBox(id, container);
    }
}

async function injectClueEditBox(id, container) {
    const response = await fetch(`${CLUE_ITEM_EDIT_API}/clues/${id}`);
    const item = await response.json();

    if (!response.ok) {
        return;
    }

    const box = document.createElement("div");
    box.className = "box";
    box.id = "clueItemEditBox";

    box.innerHTML = `
        <h2>编辑线索</h2>
        <p class="notice">修改后点击“保存修改”。保存成功后会刷新页面，并写入该线索的更新历史。</p>

        <div class="form-row">
            <label>线索标题</label>
            <input id="editClueTitle" value="${escapeClueItemEditAttr(item.title || "")}">
        </div>

        <div class="form-row">
            <label>分类</label>
            <select id="editClueCategory">
                ${buildClueItemOptions(["探店", "租房", "地图", "路线", "生活服务", "避坑纠错", "外部线索", "测试线索"], item.category)}
            </select>
        </div>

        <div class="form-row">
            <label>来源平台</label>
            <input id="editCluePlatform" value="${escapeClueItemEditAttr(item.source_platform || "")}">
        </div>

        <div class="form-row">
            <label>来源链接</label>
            <input id="editClueUrl" value="${escapeClueItemEditAttr(item.source_url || "")}">
        </div>

        <div class="form-row">
            <label>状态</label>
            <select id="editClueStatus">
                ${buildClueItemOptions(["待核验", "用户核验：属实", "用户核验：不准确", "用户反馈：已过期", "已转入真实库", "已归档"], item.status)}
            </select>
        </div>

        <div class="form-row">
            <label>线索简介</label>
            <textarea id="editClueSummary">${escapeClueItemEditHtml(item.summary || "")}</textarea>
        </div>

        <button onclick="saveClueDetailEdit(${id})">保存修改</button>
        <div id="clueItemEditMessage" class="message"></div>
    `;

    insertEditBoxBeforeHistory(container, box);
}

async function injectVerifiedEditBox(id, container) {
    const response = await fetch(`${CLUE_ITEM_EDIT_API}/verified-items/${id}`);
    const item = await response.json();

    if (!response.ok) {
        return;
    }

    const box = document.createElement("div");
    box.className = "box";
    box.id = "clueItemEditBox";

    box.innerHTML = `
        <h2>编辑真实库信息</h2>
        <p class="notice">修改后点击“保存修改”。保存成功后会刷新页面，并写入该真实库信息的更新历史。</p>

        <div class="form-row">
            <label>标题</label>
            <input id="editVerifiedTitle" value="${escapeClueItemEditAttr(item.title || "")}">
        </div>

        <div class="form-row">
            <label>分类</label>
            <select id="editVerifiedCategory">
                ${buildClueItemOptions(["探店", "租房", "地图", "路线", "生活服务", "避坑纠错", "外部线索", "测试线索"], item.category)}
            </select>
        </div>

        <div class="form-row">
            <label>位置</label>
            <input id="editVerifiedLocation" value="${escapeClueItemEditAttr(item.location || "")}">
        </div>

        <div class="form-row">
            <label>可信状态</label>
            <select id="editVerifiedTrustLevel">
                ${buildClueItemOptions(["已审核", "管理员已审核", "用户核验属实", "待复核", "已归档"], item.trust_level)}
            </select>
        </div>

        <div class="form-row">
            <label>简介</label>
            <textarea id="editVerifiedSummary">${escapeClueItemEditHtml(item.summary || "")}</textarea>
        </div>

        <button onclick="saveVerifiedDetailEdit(${id})">保存修改</button>
        <div id="clueItemEditMessage" class="message"></div>
    `;

    insertEditBoxBeforeHistory(container, box);
}

function insertEditBoxBeforeHistory(container, box) {
    const inlineHistoryBox = document.getElementById("inlineHistoryBox");

    if (inlineHistoryBox) {
        inlineHistoryBox.insertAdjacentElement("beforebegin", box);
        return;
    }

    const feedbackBox = document.getElementById("feedbackList");

    if (feedbackBox) {
        const section = feedbackBox.closest(".section");
        if (section) {
            section.insertAdjacentElement("beforebegin", box);
            return;
        }
    }

    container.appendChild(box);
}

async function saveClueDetailEdit(id) {
    const message = document.getElementById("clueItemEditMessage");
    message.innerText = "正在保存线索修改...";

    const payload = {
        token: getClueItemEditToken(),
        title: getClueItemValue("editClueTitle"),
        category: getClueItemValue("editClueCategory"),
        source_platform: getClueItemValue("editCluePlatform"),
        source_url: getClueItemValue("editClueUrl"),
        status: getClueItemValue("editClueStatus"),
        summary: getClueItemValue("editClueSummary")
    };

    if (!payload.title) {
        alert("线索标题不能为空。");
        return;
    }

    try {
        const response = await fetch(`${CLUE_ITEM_EDIT_API}/detail-edit/clues/${id}`, {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            message.innerText = "保存失败：" + JSON.stringify(data);
            return;
        }

        await recordClueItemHistory("clue", id, "编辑", data.data.title, "PATCH /detail-edit/clues/" + id);

        alert("线索修改成功，页面将刷新。");
        location.reload();
    } catch (error) {
        message.innerText = "保存失败，请确认后端已启动：" + error.message;
    }
}

async function saveVerifiedDetailEdit(id) {
    const message = document.getElementById("clueItemEditMessage");
    message.innerText = "正在保存真实库修改...";

    const payload = {
        token: getClueItemEditToken(),
        title: getClueItemValue("editVerifiedTitle"),
        category: getClueItemValue("editVerifiedCategory"),
        location: getClueItemValue("editVerifiedLocation"),
        trust_level: getClueItemValue("editVerifiedTrustLevel"),
        summary: getClueItemValue("editVerifiedSummary")
    };

    if (!payload.title) {
        alert("标题不能为空。");
        return;
    }

    try {
        const response = await fetch(`${CLUE_ITEM_EDIT_API}/detail-edit/verified-items/${id}`, {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            message.innerText = "保存失败：" + JSON.stringify(data);
            return;
        }

        await recordClueItemHistory("verified", id, "编辑", data.data.title, "PATCH /detail-edit/verified-items/" + id);

        alert("真实库信息修改成功，页面将刷新。");
        location.reload();
    } catch (error) {
        message.innerText = "保存失败，请确认后端已启动：" + error.message;
    }
}

async function recordClueItemHistory(targetType, targetId, action, title, detail) {
    try {
        await fetch(`${CLUE_ITEM_EDIT_API}/update-history`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                target_type: targetType,
                target_id: Number(targetId),
                action: action,
                title: title || "未命名对象",
                detail: detail,
                operator: "详情页编辑"
            })
        });
    } catch (error) {
        console.log("编辑历史记录失败", error);
    }
}

function getClueItemValue(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
}

function buildClueItemOptions(options, currentValue) {
    return options.map(option => {
        const selected = option === currentValue ? "selected" : "";
        return `<option value="${escapeClueItemEditAttr(option)}" ${selected}>${escapeClueItemEditHtml(option)}</option>`;
    }).join("");
}

function escapeClueItemEditHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function escapeClueItemEditAttr(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
