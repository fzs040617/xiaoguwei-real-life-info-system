// user-admin.js
// 管理员用户管理页第一期：查看、搜索、筛选用户，并在确认后修改用户角色。

const USER_ADMIN_API = "http://127.0.0.1:8000";
const USER_ADMIN_TOKEN_KEY = "xgw_user_token";

let userAdminCurrentUser = null;
let userAdminUsers = [];
let userRoleEditingUser = null;

async function initUserAdminPage() {
    const token = getUserAdminToken();

    if (!token) {
        renderUserAdminNoPermission("guest");
        return;
    }

    try {
        const response = await fetch(`${USER_ADMIN_API}/auth/me`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({token})
        });
        const data = await response.json();

        if (!response.ok) {
            renderUserAdminNoPermission("guest", data.detail || "登录状态无效或已过期");
            return;
        }

        userAdminCurrentUser = data.data || null;

        if (!userAdminCurrentUser || userAdminCurrentUser.role !== "admin") {
            renderUserAdminNoPermission("user");
            return;
        }

        await loadUserAdminList();
    } catch (error) {
        setUserAdminMessage(`读取当前用户失败：${error.message}`, true);
    }
}

async function loadUserAdminList() {
    const token = getUserAdminToken();

    if (!token) {
        renderUserAdminNoPermission("guest");
        return;
    }

    const keyword = document.getElementById("userAdminKeyword")?.value.trim() || "";
    const role = document.getElementById("userAdminRoleFilter")?.value || "";
    const params = new URLSearchParams({
        token,
        limit: "50",
        offset: "0"
    });

    if (keyword) {
        params.set("keyword", keyword);
    }

    if (role) {
        params.set("role", role);
    }

    setUserAdminMessage("");
    renderUserAdminLoading();

    try {
        const response = await fetch(`${USER_ADMIN_API}/auth/users-admin?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
            if (response.status === 401) {
                renderUserAdminNoPermission("guest", data.detail || "请先登录管理员账号");
                return;
            }

            if (response.status === 403) {
                renderUserAdminNoPermission("user", data.detail || "当前账号不是管理员");
                return;
            }

            setUserAdminMessage(`读取用户列表失败：${formatUserAdminError(data)}`, true);
            renderUserAdminEmpty("用户列表读取失败。");
            return;
        }

        userAdminUsers = Array.isArray(data.data) ? data.data : [];
        renderUserAdminList(userAdminUsers, data.total || 0);
    } catch (error) {
        setUserAdminMessage(`读取用户列表失败：${error.message}`, true);
        renderUserAdminEmpty("请确认后端已启动，并且 /docs 可以打开。");
    }
}

function handleUserAdminSearchKey(event) {
    if (event.key === "Enter") {
        loadUserAdminList();
    }
}

function resetUserAdminFilters() {
    const keywordInput = document.getElementById("userAdminKeyword");
    const roleFilter = document.getElementById("userAdminRoleFilter");

    if (keywordInput) {
        keywordInput.value = "";
    }

    if (roleFilter) {
        roleFilter.value = "";
    }

    loadUserAdminList();
}

function openUserRoleModal(userId) {
    const user = userAdminUsers.find(item => Number(item.id) === Number(userId));

    if (!user) {
        setUserAdminMessage("没有找到要修改的用户。", true);
        return;
    }

    if (userAdminCurrentUser && Number(user.id) === Number(userAdminCurrentUser.id)) {
        setUserAdminMessage("不能修改当前登录管理员自己的角色。", true);
        return;
    }

    userRoleEditingUser = user;

    const notice = document.getElementById("userRoleModalNotice");
    const newRole = document.getElementById("userRoleNewRole");
    const password = document.getElementById("userRoleSystemPassword");
    const confirmText = document.getElementById("userRoleConfirmText");
    const message = document.getElementById("userRoleModalMessage");
    const mask = document.getElementById("userRoleModalMask");

    if (notice) {
        notice.innerText = `正在修改用户：${user.username || user.account || ""}（${user.nickname || "无昵称"}）。该操作只修改角色，不删除用户、不重置密码、不封禁账号。`;
    }

    if (newRole) {
        newRole.value = user.role === "admin" ? "user" : "admin";
    }

    if (password) {
        password.value = "";
    }

    if (confirmText) {
        confirmText.value = "";
    }

    if (message) {
        message.innerText = "";
        message.style.color = "";
    }

    if (mask) {
        mask.style.display = "flex";
    }
}

function closeUserRoleModal() {
    const mask = document.getElementById("userRoleModalMask");

    userRoleEditingUser = null;

    if (mask) {
        mask.style.display = "none";
    }
}

async function submitUserRoleChange() {
    if (!userRoleEditingUser) {
        setUserRoleModalMessage("没有选择要修改的用户。", true);
        return;
    }

    const token = getUserAdminToken();
    const newRole = document.getElementById("userRoleNewRole")?.value || "";
    const systemPassword = document.getElementById("userRoleSystemPassword")?.value || "";
    const confirmText = document.getElementById("userRoleConfirmText")?.value || "";

    if (!systemPassword) {
        setUserRoleModalMessage("请输入系统密码。", true);
        return;
    }

    if (confirmText !== "修改角色") {
        setUserRoleModalMessage("确认文字错误，请输入：修改角色", true);
        return;
    }

    try {
        const response = await fetch(`${USER_ADMIN_API}/auth/users/${encodeURIComponent(userRoleEditingUser.id)}/role-admin`, {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                token,
                system_password: systemPassword,
                new_role: newRole,
                confirm_text: confirmText
            })
        });
        const data = await response.json();

        if (!response.ok) {
            setUserRoleModalMessage(`修改失败：${formatUserAdminError(data)}`, true);
            return;
        }

        closeUserRoleModal();
        setUserAdminMessage("用户角色已更新。");
        await loadUserAdminList();
    } catch (error) {
        setUserRoleModalMessage(`修改失败：${error.message}`, true);
    }
}

function renderUserAdminList(users, total) {
    const summary = document.getElementById("userAdminSummary");
    const list = document.getElementById("userAdminList");

    if (summary) {
        summary.innerText = `共找到 ${total} 个用户，当前显示 ${users.length} 个。`;
    }

    if (!list) {
        return;
    }

    if (!users.length) {
        list.innerHTML = `<div class="empty">没有符合条件的用户。</div>`;
        return;
    }

    list.innerHTML = `
        <div class="user-admin-table-wrap">
            <table class="user-admin-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>用户名</th>
                        <th>昵称</th>
                        <th>角色</th>
                        <th>创建时间</th>
                        <th>更新时间</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(renderUserAdminRow).join("")}
                </tbody>
            </table>
        </div>
    `;
}

function renderUserAdminRow(user) {
    const isSelf = userAdminCurrentUser && Number(user.id) === Number(userAdminCurrentUser.id);
    const roleText = user.role === "admin" ? "管理员" : "普通用户";
    const roleClass = user.role === "admin" ? "tag" : "tag warning";
    const disabledAttr = isSelf ? "disabled" : "";
    const disabledClass = isSelf ? " disabled-button" : "";
    const buttonText = isSelf ? "当前账号" : "修改角色";

    return `
        <tr>
            <td>${escapeUserAdminHtml(user.id)}</td>
            <td>${escapeUserAdminHtml(user.username || user.account || "")}</td>
            <td>${escapeUserAdminHtml(user.nickname || "")}</td>
            <td><span class="${roleClass}">${roleText}</span></td>
            <td>${escapeUserAdminHtml(formatUserAdminDate(user.created_at))}</td>
            <td>${escapeUserAdminHtml(formatUserAdminDate(user.updated_at))}</td>
            <td>
                <button class="small-button${disabledClass}" ${disabledAttr} onclick="openUserRoleModal(${Number(user.id)})">${buttonText}</button>
            </td>
        </tr>
    `;
}

function renderUserAdminLoading() {
    const summary = document.getElementById("userAdminSummary");
    const list = document.getElementById("userAdminList");

    if (summary) {
        summary.innerText = "正在加载用户列表...";
    }

    if (list) {
        list.innerHTML = `<div class="empty">正在加载用户列表...</div>`;
    }
}

function renderUserAdminEmpty(text) {
    const summary = document.getElementById("userAdminSummary");
    const list = document.getElementById("userAdminList");

    if (summary) {
        summary.innerText = "";
    }

    if (list) {
        list.innerHTML = `<div class="empty">${escapeUserAdminHtml(text)}</div>`;
    }
}

function renderUserAdminNoPermission(role, reason) {
    const container = document.querySelector(".container");

    if (!container) {
        return;
    }

    const roleText = role === "guest" ? "未登录用户" : "普通用户";
    const reasonText = reason ? `<p class="notice">原因：${escapeUserAdminHtml(reason)}</p>` : "";

    container.dataset.permissionBlocked = "true";
    container.dataset.permissionRole = role;
    container.innerHTML = `
        <div class="box">
            <h2>无权限访问</h2>
            <p class="notice">
                当前身份是：${roleText}。用户管理属于系统管理功能，仅管理员可以查看和操作。
            </p>
            ${reasonText}
            <div class="action-row">
                <button onclick="location.href='index.html'">返回首页</button>
                <button onclick="openLoginModal()">登录管理员账号</button>
            </div>
        </div>
    `;
}

function getUserAdminToken() {
    return localStorage.getItem(USER_ADMIN_TOKEN_KEY) || "";
}

function setUserAdminMessage(text, isError) {
    const message = document.getElementById("userAdminMessage");

    if (!message) {
        return;
    }

    message.innerText = text || "";
    message.style.color = isError ? "#c0392b" : "";
}

function setUserRoleModalMessage(text, isError) {
    const message = document.getElementById("userRoleModalMessage");

    if (!message) {
        return;
    }

    message.innerText = text || "";
    message.style.color = isError ? "#c0392b" : "";
}

function formatUserAdminDate(value) {
    if (!value) {
        return "暂无";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString("zh-CN", {hour12: false});
}

function formatUserAdminError(data) {
    if (!data) {
        return "未知错误";
    }

    if (typeof data.detail === "string") {
        return data.detail;
    }

    return JSON.stringify(data);
}

function escapeUserAdminHtml(text) {
    return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
