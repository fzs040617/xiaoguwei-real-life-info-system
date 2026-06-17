// history-danger-zone.js
// 更新历史危险操作区 V6：
// 普通用户不显示危险操作按钮。
// 管理员显示按钮，但执行时必须输入系统密码。

const HISTORY_DANGER_API = "http://127.0.0.1:8000";
const HISTORY_USER_TOKEN_KEY = "xgw_user_token";

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
                <input id="clearHistoryRangeStartDate" type="date" min="2000-01-01" max="2099-12-31" maxlength="10" pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}" placeholder="YYYY-MM-DD" autocomplete="off" oninput="handleHistoryRangeDateInput(this)">
            </div>
            <div class="form-row">
                <label>结束日期</label>
                <input id="clearHistoryRangeEndDate" type="date" min="2000-01-01" max="2099-12-31" maxlength="10" pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}" placeholder="YYYY-MM-DD" autocomplete="off" oninput="handleHistoryRangeDateInput(this)">
            </div>
            <div class="form-row">
                <label>系统密码</label>
                <input id="clearHistoryRangeSystemPassword" type="password" placeholder="请输入系统密码" oninput="clearHistoryRangeMessage()">
            </div>
            <div class="form-row">
                <label>确认文字</label>
                <input id="clearHistoryRangeConfirmText" placeholder="必须输入：清空历史" oninput="clearHistoryRangeMessage()">
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
}

function initHistoryDangerDateInputs() {
    const inputs = [
        document.getElementById("clearHistoryRangeStartDate"),
        document.getElementById("clearHistoryRangeEndDate")
    ].filter(Boolean);

    inputs.forEach(input => {
        input.addEventListener("click", () => openHistoryDatePicker(input));
        input.addEventListener("focus", () => openHistoryDatePicker(input));
        input.addEventListener("keydown", event => {
            if (input.type !== "date" || typeof input.showPicker !== "function") {
                return;
            }

            if (event.ctrlKey || event.metaKey || event.altKey) {
                return;
            }

            const allowedKeys = [
                "Tab",
                "Enter",
                "Escape",
                "Backspace",
                "Delete",
                "ArrowLeft",
                "ArrowRight",
                "ArrowUp",
                "ArrowDown",
                "Home",
                "End"
            ];

            if (!allowedKeys.includes(event.key) && event.key.length === 1) {
                event.preventDefault();
                openHistoryDatePicker(input);
            }
        });
        input.addEventListener("paste", event => {
            if (input.type === "date" && typeof input.showPicker === "function") {
                event.preventDefault();
            }
        });
        input.addEventListener("drop", event => {
            if (input.type === "date" && typeof input.showPicker === "function") {
                event.preventDefault();
            }
        });
    });
}

function openHistoryDatePicker(input) {
    if (!input || typeof input.showPicker !== "function") {
        return;
    }

    try {
        input.showPicker();
    } catch (error) {
        // Some browsers only allow showPicker during a direct user gesture.
    }
}

function handleHistoryRangeDateInput(input) {
    clearHistoryRangeMessage();

    if (!input) {
        return;
    }

    if (input.type !== "date") {
        input.value = normalizeHistoryRangeDateText(input.value);
        return;
    }

    if (input.value && !isValidHistoryRangeDate(input.value)) {
        input.value = "";
    }
}

function normalizeHistoryRangeDateText(value) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
    const year = digits.slice(0, 4);
    const month = digits.slice(4, 6);
    const day = digits.slice(6, 8);

    return [year, month, day].filter(Boolean).join("-");
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
                <input id="clearHistoryConfirmText" placeholder="请输入：清空历史">
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
    const confirmText = document.getElementById("clearHistoryConfirmText").value.trim();
    const message = document.getElementById("clearHistoryMessage");

    if (!token) {
        alert("登录状态无效，请重新登录管理员账号。");
        return;
    }

    if (!systemPassword) {
        alert("请输入系统密码。");
        return;
    }

    if (confirmText !== "清空历史") {
        alert("确认文字不正确，请输入：清空历史");
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
                confirm_text: confirmText
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
    const startDate = document.getElementById("clearHistoryRangeStartDate").value.trim();
    const endDate = document.getElementById("clearHistoryRangeEndDate").value.trim();
    const systemPassword = document.getElementById("clearHistoryRangeSystemPassword").value.trim();
    const confirmText = document.getElementById("clearHistoryRangeConfirmText").value.trim();
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

    if (confirmText !== "清空历史") {
        setHistoryRangeMessage("确认文字不正确，请输入：清空历史");
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
                end_date: endDate
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

