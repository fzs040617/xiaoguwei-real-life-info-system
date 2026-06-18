// history-danger-zone.js
// 更新历史危险操作区 V6：
// 普通用户不显示危险操作按钮。
// 管理员显示按钮，但执行时必须输入系统密码。

const HISTORY_DANGER_API = "http://127.0.0.1:8000";
const HISTORY_USER_TOKEN_KEY = "xgw_user_token";
const HISTORY_CLEAR_CONFIRM_TEXT = "清空历史";
let historyClearAllVerifyToken = "";
let historyClearRangeVerifyToken = "";

function normalizeHistoryConfirmText(value) {
    return String(value || "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
}

window.addEventListener("load", () => {
    setTimeout(checkAndInjectHistoryDangerButton, 800);
});

async function checkAndInjectHistoryDangerButton() {
    const token = localStorage.getItem(HISTORY_USER_TOKEN_KEY);

    if (!token) {
        return;
    }

    try {
        const response = await fetch(`${HISTORY_DANGER_API}/auth/me`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({token})
        });

        const data = await response.json();

        if (!response.ok) {
            return;
        }

        const user = data.data;

        if (!user || user.role !== "admin") {
            return;
        }

        injectHistoryDangerButton();

    } catch (error) {
        console.log("检查管理员权限失败", error);
    }
}

function injectHistoryDangerButton() {
    if (document.getElementById("historyDangerButtonBox")) {
        return;
    }

    const container = document.querySelector(".container");

    if (!container) {
        return;
    }

    const box = document.createElement("div");
    box.className = "box";
    box.id = "historyDangerButtonBox";
    box.style.border = "1px solid #f0d0cd";
    box.style.background = "#fffafa";

    box.innerHTML = `
        <h2 style="color:#b3261e;">管理员危险操作</h2>
        <p class="notice">
            只有管理员能看到这里。执行清空历史时，需要输入系统密码，而不是用户账号密码。
        </p>
        <button class="danger-button" onclick="openClearHistoryModal()">清空所有更新历史</button>

        <div style="margin-top:18px; padding-top:18px; border-top:1px solid #f0d0cd;">
            <h3 style="margin:0 0 12px; color:#b3261e;">按时间区间清空更新历史</h3>
            <div class="form-row">
                <label>开始日期</label>
                <div style="display:flex; gap:8px; align-items:center;">
                    <input id="clearHistoryRangeStartDate" type="text" inputmode="numeric" maxlength="10" pattern="[0-9./-]{8,10}" placeholder="例如：20990102 或 2099-01-02" autocomplete="off" oninput="handleHistoryRangeDateInput(this)">
                    <button type="button" class="small-button filter-button" onclick="openHistoryDatePicker('clearHistoryRangeStartDatePicker')">选择日期</button>
                    <input id="clearHistoryRangeStartDatePicker" type="date" min="2000-01-01" max="2099-12-31" tabindex="-1" onchange="handleHistoryRangePickerChange('clearHistoryRangeStartDate', this)" style="position:absolute; opacity:0; width:1px; height:1px; pointer-events:none;">
                </div>
            </div>
            <div class="form-row">
                <label>结束日期</label>
                <div style="display:flex; gap:8px; align-items:center;">
                    <input id="clearHistoryRangeEndDate" type="text" inputmode="numeric" maxlength="10" pattern="[0-9./-]{8,10}" placeholder="例如：20990103 或 2099-01-03" autocomplete="off" oninput="handleHistoryRangeDateInput(this)">
                    <button type="button" class="small-button filter-button" onclick="openHistoryDatePicker('clearHistoryRangeEndDatePicker')">选择日期</button>
                    <input id="clearHistoryRangeEndDatePicker" type="date" min="2000-01-01" max="2099-12-31" tabindex="-1" onchange="handleHistoryRangePickerChange('clearHistoryRangeEndDate', this)" style="position:absolute; opacity:0; width:1px; height:1px; pointer-events:none;">
                </div>
            </div>
            <div class="form-row">
                <label>系统密码</label>
                <input id="clearHistoryRangeSystemPassword" type="password" placeholder="请输入系统密码" oninput="clearHistoryRangeMessage()">
            </div>
            <div class="form-row">
                <label>确认文字</label>
                <input id="clearHistoryRangeConfirmText" placeholder="必须输入：${HISTORY_CLEAR_CONFIRM_TEXT}" oninput="clearHistoryRangeMessage()">
            </div>
            <div class="form-row">
                <label>动态验证码</label>
                <div class="xgw-verify-code-panel">
                    <span class="tag">验证码</span>
                    <strong id="clearHistoryRangeVerifyDisplay" class="xgw-verify-code" onclick="loadHistoryDangerVerifyCode('history_clear_range')" title="点击刷新验证码">点击获取</strong>
                    <button type="button" class="small-button filter-button" onclick="loadHistoryDangerVerifyCode('history_clear_range')">刷新</button>
                </div>
                <input id="clearHistoryRangeVerifyCode" placeholder="请输入上方动态验证码" oninput="clearHistoryRangeMessage()">
            </div>
            <div id="clearHistoryRangeMessage" class="message"></div>
            <button class="danger-button" onclick="clearRangeUpdateHistory()">清空所选区间历史</button>
        </div>
    `;

    const historySection = document.getElementById("historyList");

    if (historySection) {
        historySection.closest(".section").insertAdjacentElement("beforebegin", box);
    } else {
        container.appendChild(box);
    }

    initHistoryDangerDateInputs();
    loadHistoryDangerVerifyCode("history_clear_range");
}

function initHistoryDangerDateInputs() {
    const inputs = [
        document.getElementById("clearHistoryRangeStartDate"),
        document.getElementById("clearHistoryRangeEndDate")
    ].filter(Boolean);

    inputs.forEach(input => {
        input.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                applyFlexibleHistoryRangeDate(input, input.value);
            }
        });
        input.addEventListener("blur", () => {
            applyFlexibleHistoryRangeDate(input, input.value);
        });
    });
}

function openHistoryDatePicker(inputOrId) {
    const input = typeof inputOrId === "string" ? document.getElementById(inputOrId) : inputOrId;

    if (!input) {
        return;
    }

    try {
        if (typeof input.showPicker === "function") {
            input.showPicker();
            return;
        }
    } catch (error) {
        // Some browsers only allow showPicker during a direct user gesture.
    }

    input.focus();
    input.click();
}

function handleHistoryRangePickerChange(textInputId, pickerInput) {
    const textInput = document.getElementById(textInputId);

    if (!textInput || !pickerInput || !pickerInput.value) {
        return;
    }

    applyFlexibleHistoryRangeDate(textInput, pickerInput.value);
}

async function loadHistoryDangerVerifyCode(purpose) {
    const token = localStorage.getItem(HISTORY_USER_TOKEN_KEY) || "";
    const purposeText = String(purpose || "");
    const isRange = purposeText === "history_clear_range";
    const display = document.getElementById(isRange ? "clearHistoryRangeVerifyDisplay" : "clearHistoryVerifyDisplay");
    const input = document.getElementById(isRange ? "clearHistoryRangeVerifyCode" : "clearHistoryVerifyCode");

    if (display) {
        display.innerText = "加载中...";
    }

    try {
        const response = await fetch(`${HISTORY_DANGER_API}/admin/verify-code?purpose=${encodeURIComponent(purposeText)}&token=${encodeURIComponent(token)}`);
        const data = await response.json();

        if (!response.ok) {
            if (isRange) {
                historyClearRangeVerifyToken = "";
                setHistoryRangeMessage("验证码加载失败：" + getHistoryDangerErrorMessage(data));
            } else {
                historyClearAllVerifyToken = "";
                const message = document.getElementById("clearHistoryMessage");
                if (message) {
                    message.innerText = "验证码加载失败：" + getHistoryDangerErrorMessage(data);
                }
            }
            if (display) {
                display.innerText = "加载失败";
            }
            return;
        }

        if (isRange) {
            historyClearRangeVerifyToken = data.verify_token || "";
        } else {
            historyClearAllVerifyToken = data.verify_token || "";
        }

        if (display) {
            display.innerText = data.verify_code || "点击刷新";
        }

        if (input) {
            input.value = "";
        }
    } catch (error) {
        if (isRange) {
            historyClearRangeVerifyToken = "";
            setHistoryRangeMessage("验证码加载失败：" + error.message);
        } else {
            historyClearAllVerifyToken = "";
            const message = document.getElementById("clearHistoryMessage");
            if (message) {
                message.innerText = "验证码加载失败：" + error.message;
            }
        }
        if (display) {
            display.innerText = "加载失败";
        }
    }
}

function handleHistoryRangeDateInput(input) {
    clearHistoryRangeMessage();

    if (!input) {
        return;
    }

    if (input.type !== "date") {
        applyFlexibleHistoryRangeDate(input, input.value, {partial: true});
        return;
    }

    if (input.value && !isValidHistoryRangeDate(input.value)) {
        input.value = "";
    }

    if (input.id === "clearHistoryRangeStartDate") {
        syncHistoryRangeEndDate();
    }
}

function applyFlexibleHistoryRangeDate(input, rawValue, options = {}) {
    if (!input) {
        return "";
    }

    const normalized = normalizeFlexibleHistoryRangeDateValue(rawValue);
    const compactDigits = String(rawValue || "").replace(/\D/g, "");
    const isPartial = options.partial === true && compactDigits.length > 0 && compactDigits.length < 8;

    if (isPartial) {
        return "";
    }

    if (!normalized) {
        input.value = "";
        syncHistoryRangePickerValue(input);
        return "";
    }

    if (!isValidHistoryRangeDate(normalized)) {
        input.value = "";
        input.dataset.flexDateBuffer = "";
        syncHistoryRangePickerValue(input);
        clearInvalidHistoryRangeEndDate(input);
        return "";
    }

    input.value = normalized;
    input.dataset.flexDateBuffer = "";
    syncHistoryRangePickerValue(input);

    if (input.id === "clearHistoryRangeStartDate") {
        syncHistoryRangeEndDate();
    } else {
        clearInvalidHistoryRangeEndDate(input);
    }

    return normalized;
}

function syncHistoryRangeEndDate() {
    const startInput = document.getElementById("clearHistoryRangeStartDate");
    const endInput = document.getElementById("clearHistoryRangeEndDate");
    const endPicker = document.getElementById("clearHistoryRangeEndDatePicker");

    if (!startInput || !endInput) {
        return;
    }

    if (!isValidHistoryRangeDate(startInput.value)) {
        endInput.min = "2000-01-01";
        if (endPicker) {
            endPicker.min = "2000-01-01";
        }
        return;
    }

    endInput.min = startInput.value;
    if (endPicker) {
        endPicker.min = startInput.value;
    }

    if (!endInput.value || endInput.value < startInput.value) {
        endInput.value = startInput.value;
        syncHistoryRangePickerValue(endInput);
    }
}

function clearInvalidHistoryRangeEndDate(input) {
    if (!input || input.id !== "clearHistoryRangeEndDate") {
        return;
    }

    const startInput = document.getElementById("clearHistoryRangeStartDate");

    if (!startInput || !isValidHistoryRangeDate(startInput.value)) {
        return;
    }

    if (input.value && input.value < startInput.value) {
        input.value = startInput.value;
        syncHistoryRangePickerValue(input);
    }
}

function syncHistoryRangePickerValue(textInput) {
    const pickerIdMap = {
        clearHistoryRangeStartDate: "clearHistoryRangeStartDatePicker",
        clearHistoryRangeEndDate: "clearHistoryRangeEndDatePicker"
    };
    const picker = document.getElementById(pickerIdMap[textInput.id]);

    if (!picker) {
        return;
    }

    if (isValidHistoryRangeDate(textInput.value)) {
        picker.value = textInput.value;
    } else {
        picker.value = "";
    }
}

function normalizeFlexibleHistoryRangeDateValue(value) {
    const text = String(value || "").trim();

    if (!text) {
        return "";
    }

    const compactMatch = text.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compactMatch) {
        return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
    }

    const dashedMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (dashedMatch) {
        return `${dashedMatch[1]}-${dashedMatch[2].padStart(2, "0")}-${dashedMatch[3].padStart(2, "0")}`;
    }

    const slashOrDotMatch = text.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
    if (slashOrDotMatch) {
        return `${slashOrDotMatch[1]}-${slashOrDotMatch[2].padStart(2, "0")}-${slashOrDotMatch[3].padStart(2, "0")}`;
    }

    return text;
}

function isValidHistoryRangeDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [yearText, monthText, dayText] = value.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);

    if (year < 2000 || year > 2099) {
        return false;
    }

    const date = new Date(Date.UTC(year, month - 1, day));

    return date.getUTCFullYear() === year
        && date.getUTCMonth() === month - 1
        && date.getUTCDate() === day;
}

function validateHistoryRangeDates(startDate, endDate) {
    if (!startDate || !isValidHistoryRangeDate(startDate)) {
        return "请输入有效的开始日期";
    }

    if (!endDate || !isValidHistoryRangeDate(endDate)) {
        return "请输入有效的结束日期";
    }

    if (endDate < startDate) {
        return "结束日期不能早于开始日期";
    }

    return "";
}

function openClearHistoryModal() {
    if (document.getElementById("clearHistoryModalMask")) {
        return;
    }

    const token = localStorage.getItem(HISTORY_USER_TOKEN_KEY);

    if (!token) {
        alert("请先登录管理员账号。");
        return;
    }

    const mask = document.createElement("div");
    mask.id = "clearHistoryModalMask";
    mask.style.position = "fixed";
    mask.style.left = "0";
    mask.style.top = "0";
    mask.style.right = "0";
    mask.style.bottom = "0";
    mask.style.background = "rgba(0, 0, 0, 0.38)";
    mask.style.zIndex = "99999";
    mask.style.display = "flex";
    mask.style.alignItems = "center";
    mask.style.justifyContent = "center";

    mask.innerHTML = `
        <div style="
            width: 460px;
            max-width: 92%;
            background: #fff;
            border-radius: 14px;
            padding: 24px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            font-family: Arial, 'Microsoft YaHei', sans-serif;
        ">
            <h2 style="margin-top:0; color:#b3261e;">确认清空所有更新历史</h2>

            <p style="line-height:1.7; color:#444;">
                这个操作只会清空“更新历史”，不会删除线索、真实库、地图点、路线、反馈等正式数据。
                清空后历史记录不可恢复。
            </p>

            <div class="form-row">
                <label>系统密码</label>
                <input id="clearHistorySystemPassword" type="password" placeholder="请输入系统密码">
            </div>

            <div class="form-row">
                <label>确认文字</label>
                <input id="clearHistoryConfirmText" placeholder="请输入：${HISTORY_CLEAR_CONFIRM_TEXT}">
            </div>

            <div class="form-row">
                <label>动态验证码</label>
                <div class="xgw-verify-code-panel">
                    <span class="tag">验证码</span>
                    <strong id="clearHistoryVerifyDisplay" class="xgw-verify-code" onclick="loadHistoryDangerVerifyCode('history_clear_all')" title="点击刷新验证码">点击获取</strong>
                    <button type="button" class="small-button filter-button" onclick="loadHistoryDangerVerifyCode('history_clear_all')">刷新</button>
                </div>
                <input id="clearHistoryVerifyCode" placeholder="请输入上方动态验证码">
            </div>

            <div id="clearHistoryMessage" class="message"></div>

            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
                <button onclick="closeClearHistoryModal()" style="
                    padding: 10px 16px;
                    border: 1px solid #ccc;
                    border-radius: 8px;
                    background: #ffffff;
                    color: #333333;
                    cursor: pointer;
                    font-size: 14px;
                    min-width: 72px;
                ">取消</button>

                <button onclick="clearAllUpdateHistory()" style="
                    padding: 10px 16px;
                    border: none;
                    border-radius: 8px;
                    background: #b3261e;
                    color: white;
                    cursor: pointer;
                    font-size: 14px;
                ">确认清空</button>
            </div>
        </div>
    `;

    document.body.appendChild(mask);
    historyClearAllVerifyToken = "";
    loadHistoryDangerVerifyCode("history_clear_all");
}

function closeClearHistoryModal() {
    const mask = document.getElementById("clearHistoryModalMask");

    if (mask) {
        mask.remove();
    }
}

async function clearAllUpdateHistory() {
    const token = localStorage.getItem(HISTORY_USER_TOKEN_KEY);
    const systemPassword = document.getElementById("clearHistorySystemPassword").value.trim();
    const confirmText = normalizeHistoryConfirmText(document.getElementById("clearHistoryConfirmText").value);
    const verifyCode = document.getElementById("clearHistoryVerifyCode").value.trim().toUpperCase();
    const message = document.getElementById("clearHistoryMessage");

    if (!token) {
        alert("登录状态无效，请重新登录管理员账号。");
        return;
    }

    if (!systemPassword) {
        alert("请输入系统密码。");
        return;
    }

    if (confirmText !== HISTORY_CLEAR_CONFIRM_TEXT) {
        alert(`确认文字不正确，请输入：${HISTORY_CLEAR_CONFIRM_TEXT}`);
        return;
    }

    if (!historyClearAllVerifyToken) {
        alert("请先获取动态验证码。");
        return;
    }

    if (!verifyCode) {
        alert("请输入动态验证码。");
        return;
    }

    const firstConfirm = confirm("确认清空所有更新历史吗？这个操作不可恢复。");
    if (!firstConfirm) {
        return;
    }

    const secondConfirm = confirm("再次确认：只清空更新历史，不删除正式数据。是否继续？");
    if (!secondConfirm) {
        return;
    }

    message.innerText = "正在清空更新历史，请稍等...";

    try {
        const response = await fetch(`${HISTORY_DANGER_API}/update-history/clear-all-admin-v2`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                token: token,
                system_password: systemPassword,
                confirm_text: confirmText,
                verify_token: historyClearAllVerifyToken,
                verify_code: verifyCode
            })
        });

        const data = await response.json();

        if (!response.ok) {
            message.innerText = "清空失败：" + JSON.stringify(data);
            return;
        }

        alert(`更新历史已清空，共删除 ${data.deleted_count} 条历史记录。页面将刷新。`);
        location.reload();

    } catch (error) {
        message.innerText = "清空失败，请确认后端已启动：" + error.message;
    }
}

function clearHistoryRangeMessage() {
    const message = document.getElementById("clearHistoryRangeMessage");

    if (message) {
        message.innerText = "";
    }
}

function setHistoryRangeMessage(text) {
    const message = document.getElementById("clearHistoryRangeMessage");

    if (message) {
        message.innerText = text;
    }
}

function getHistoryDangerErrorMessage(data) {
    if (!data) {
        return "请求失败，请检查后端服务。";
    }

    if (typeof data.detail === "string") {
        return data.detail;
    }

    if (Array.isArray(data.detail)) {
        return data.detail.map(item => item.msg || JSON.stringify(item)).join("；");
    }

    if (data.message) {
        return data.message;
    }

    return JSON.stringify(data);
}
async function clearRangeUpdateHistory() {
    const token = localStorage.getItem(HISTORY_USER_TOKEN_KEY);
    const startDateInput = document.getElementById("clearHistoryRangeStartDate");
    const endDateInput = document.getElementById("clearHistoryRangeEndDate");
    const startDate = applyFlexibleHistoryRangeDate(startDateInput, startDateInput.value || startDateInput.dataset.flexDateBuffer);
    const endDate = applyFlexibleHistoryRangeDate(endDateInput, endDateInput.value || endDateInput.dataset.flexDateBuffer);
    const systemPassword = document.getElementById("clearHistoryRangeSystemPassword").value.trim();
    const confirmText = normalizeHistoryConfirmText(document.getElementById("clearHistoryRangeConfirmText").value);
    const verifyCode = document.getElementById("clearHistoryRangeVerifyCode").value.trim().toUpperCase();
    clearHistoryRangeMessage();

    if (!token) {
        setHistoryRangeMessage("登录状态无效，请重新登录管理员账号。");
        return;
    }

    const dateError = validateHistoryRangeDates(startDate, endDate);
    if (dateError) {
        setHistoryRangeMessage(dateError);
        return;
    }

    if (!systemPassword) {
        setHistoryRangeMessage("请输入系统密码。");
        return;
    }

    if (confirmText !== HISTORY_CLEAR_CONFIRM_TEXT) {
        setHistoryRangeMessage(`确认文字不正确，请输入：${HISTORY_CLEAR_CONFIRM_TEXT}`);
        return;
    }

    if (!historyClearRangeVerifyToken) {
        setHistoryRangeMessage("请先获取动态验证码。");
        return;
    }

    if (!verifyCode) {
        setHistoryRangeMessage("请输入动态验证码。");
        return;
    }

    const firstConfirm = confirm(`确认清空 ${startDate} 至 ${endDate} 的更新历史吗？这个操作不会删除正式数据。`);
    if (!firstConfirm) {
        return;
    }

    const secondConfirm = confirm("再次确认：只删除 update_histories 表中的记录，不删除线索、真实库、地图点、路线、反馈等正式数据。是否继续？");
    if (!secondConfirm) {
        return;
    }

    setHistoryRangeMessage("正在清空所选时间区间内的更新历史，请稍等...");

    try {
        const response = await fetch(`${HISTORY_DANGER_API}/update-history/clear-range-admin`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                token: token,
                system_password: systemPassword,
                confirm_text: confirmText,
                start_date: startDate,
                end_date: endDate,
                verify_token: historyClearRangeVerifyToken,
                verify_code: verifyCode
            })
        });

        const data = await response.json();

        if (!response.ok) {
            setHistoryRangeMessage("清空失败：" + getHistoryDangerErrorMessage(data));
            return;
        }

        document.getElementById("clearHistoryRangeSystemPassword").value = "";
        document.getElementById("clearHistoryRangeConfirmText").value = "";
        setHistoryRangeMessage(`已清空 ${data.deleted_count} 条更新历史。`);
        alert(`已清空 ${data.deleted_count} 条更新历史`);

        if (typeof loadHistoryList === "function") {
            await loadHistoryList();
        } else {
            location.reload();
        }

    } catch (error) {
        setHistoryRangeMessage("清空失败，请确认后端已启动：" + error.message);
    }
}

