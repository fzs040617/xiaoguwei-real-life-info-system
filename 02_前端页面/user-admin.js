// user-admin.js
// 管理员用户管理页体验优化：分页、清晰状态提示、角色徽章和角色修改确认。

const USER_ADMIN_API = "http://127.0.0.1:8000";
const USER_ADMIN_TOKEN_KEY = "xgw_user_token";

let userAdminCurrentUser = null;
let userAdminUsers = [];
let userRoleEditingUser = null;
let userAdminPage = 1;
let userAdminPageSize = 20;
let userAdminTotal = 0;

async function initUserAdminPage() {
    const token = getUserAdminToken();

    if (!token) {
        renderUserAdminNoPermission("guest", "未登录");
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
            renderUserAdminNoPermission("guest", data.detail || "token 失效，请重新登录");
            return;
        }

        userAdminCurrentUser = data.data || null;

        if (!userAdminCurrentUser || userAdminCurrentUser.role !== "admin") {
            renderUserAdminNoPermission("user", "当前账号无权限访问用户管理");
            return;
        }

        syncUserAdminPageSizeFromControl();
        await loadUserAdminList();
    } catch (error) {
        setUserAdminMessage(`读取当前用户失败：${formatUserAdminNetworkError(error)}`, true);
        renderUserAdminEmpty("网络错误，无法确认当前登录身份。");
    }
}

async function loadUserAdminList() {
    const token = getUserAdminToken();

    if (!token) {
        renderUserAdminNoPermission("guest", "未登录");
        return;
    }

    syncUserAdminPageSizeFromControl();

    const keyword = document.getElementById("userAdminKeyword")?.value.trim() || "";
    const role = document.getElementById("userAdminRoleFilter")?.value || "";
    const offset = (userAdminPage - 1) * userAdminPageSize;
    const params = new URLSearchParams({
        token,
        limit: String(userAdminPageSize),
        offset: String(offset)
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
            handleUserAdminListError(response.status, data);
            return;
        }

        userAdminUsers = readUserAdminItems(data);
        userAdminTotal = readUserAdminTotal(data, userAdminUsers.length);
        userAdminPageSize = Number(data.limit || userAdminPageSize) || userAdminPageSize;

        if (!userAdminUsers.length && userAdminTotal > 0 && userAdminPage > getUserAdminTotalPages()) {
            userAdminPage = getUserAdminTotalPages();
            await loadUserAdminList();
            return;
        }

        renderUserAdminList(userAdminUsers, userAdminTotal);
        renderUserAdminPagination();
    } catch (error) {
        setUserAdminMessage(`读取用户列表失败：${formatUserAdminNetworkError(error)}`, true);
        renderUserAdminEmpty("网络错误，请确认后端已启动，并且 /docs 可以打开。");
        renderUserAdminPagination();
    }
}

function handleUserAdminListError(status, data) {
    const detail = formatUserAdminError(data);

    if (status === 401) {
        renderUserAdminNoPermission("guest", detail || "未登录或 token 失效");
        return;
    }

    if (status === 403) {
        renderUserAdminNoPermission("user", detail || "无权限访问用户管理");
        return;
    }

    setUserAdminMessage(`读取用户列表失败：${detail}`, true);
    renderUserAdminEmpty("用户列表读取失败。");
    renderUserAdminPagination();
}

function searchUserAdminList() {
    userAdminPage = 1;
    loadUserAdminList();
}

function handleUserAdminSearchKey(event) {
    if (event.key === "Enter") {
        searchUserAdminList();
    }
}

function handleUserAdminFilterChange() {
    userAdminPage = 1;
    loadUserAdminList();
}

function handleUserAdminPageSizeChange() {
    userAdminPage = 1;
    syncUserAdminPageSizeFromControl();
    loadUserAdminList();
}

function resetUserAdminFilters() {
    const keywordInput = document.getElementById("userAdminKeyword");
    const roleFilter = document.getElementById("userAdminRoleFilter");
    const pageSize = document.getElementById("userAdminPageSize");

    if (keywordInput) {
        keywordInput.value = "";
    }

    if (roleFilter) {
        roleFilter.value = "";
    }

    if (pageSize) {
        pageSize.value = "20";
    }

    userAdminPage = 1;
    syncUserAdminPageSizeFromControl();
    loadUserAdminList();
}

function goUserAdminPrevPage() {
    if (userAdminPage <= 1) {
        return;
    }

    userAdminPage -= 1;
    loadUserAdminList();
}

function goUserAdminNextPage() {
    if (!canUserAdminGoNext()) {
        return;
    }

    userAdminPage += 1;
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

    const newRole = document.getElementById("userRoleNewRole");
    const password = document.getElementById("userRoleSystemPassword");
    const confirmText = document.getElementById("userRoleConfirmText");
    const message = document.getElementById("userRoleModalMessage");
    const mask = document.getElementById("userRoleModalMask");

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

    updateUserRoleModalPreview();

    if (mask) {
        mask.style.display = "flex";
    }
}

function updateUserRoleModalPreview() {
    const notice = document.getElementById("userRoleModalNotice");
    const newRole = document.getElementById("userRoleNewRole")?.value || "";

    if (!notice || !userRoleEditingUser) {
        return;
    }

    notice.innerHTML = `
        <div><strong>用户名：</strong>${escapeUserAdminHtml(userRoleEditingUser.username || userRoleEditingUser.account || "")}</div>
        <div><strong>昵称：</strong>${escapeUserAdminHtml(userRoleEditingUser.nickname || "无昵称")}</div>
        <div><strong>当前角色：</strong>${renderUserRoleBadgeHtml(userRoleEditingUser.role)}</div>
        <div><strong>将修改为：</strong>${renderUserRoleBadgeHtml(newRole)}</div>
        <div class="notice">系统密码请输入：xgw2026；确认文字必须输入：修改角色。</div>
        <div class="notice">该操作只修改角色，不删除用户、不重置密码、不封禁账号。</div>
    `;
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
        setUserRoleModalMessage("请输入系统密码。系统密码为：xgw2026", true);
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
        setUserAdminMessage(`用户角色已更新：${escapeTextForMessage(data.data?.username || data.data?.account || "目标用户")} -> ${getUserRoleText(data.data?.role)}`);
        await loadUserAdminList();
    } catch (error) {
        setUserRoleModalMessage(`修改失败：${formatUserAdminNetworkError(error)}`, true);
    }
}

function renderUserAdminList(users, total) {
    const summary = document.getElementById("userAdminSummary");
    const list = document.getElementById("userAdminList");
    const totalPages = getUserAdminTotalPages();

    if (summary) {
        summary.innerText = `共 ${total} 个用户，当前第 ${userAdminPage} / ${totalPages} 页，每页 ${userAdminPageSize} 条，本页显示 ${users.length} 条。`;
    }

    if (!list) {
        return;
    }

    if (!users.length) {
        list.innerHTML = `<div class="empty user-admin-empty">暂无匹配用户</div>`;
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
    const disabledAttr = isSelf ? "disabled" : "";
    const disabledClass = isSelf ? " disabled-button" : "";
    const buttonText = isSelf ? "当前账号" : "修改角色";

    return `
        <tr>
            <td>${escapeUserAdminHtml(user.id)}</td>
            <td>${escapeUserAdminHtml(user.username || user.account || "")}</td>
            <td>${escapeUserAdminHtml(user.nickname || "")}</td>
            <td>${renderUserRoleBadgeHtml(user.role)}</td>
            <td>${escapeUserAdminHtml(formatUserAdminDate(user.created_at))}</td>
            <td>${escapeUserAdminHtml(formatUserAdminDate(user.updated_at))}</td>
            <td>
                <button class="small-button${disabledClass}" ${disabledAttr} onclick="openUserRoleModal(${Number(user.id)})">${buttonText}</button>
            </td>
        </tr>
    `;
}

function renderUserRoleBadgeHtml(role) {
    const roleClass = role === "admin" ? "user-role-badge-admin" : "user-role-badge-user";
    return `<span class="user-role-badge ${roleClass}">${escapeUserAdminHtml(getUserRoleText(role))}</span>`;
}

function getUserRoleText(role) {
    return role === "admin" ? "管理员" : "普通用户";
}

function renderUserAdminPagination() {
    const pagination = document.getElementById("userAdminPagination");

    if (!pagination) {
        return;
    }

    const totalPages = getUserAdminTotalPages();
    const prevDisabled = userAdminPage <= 1 ? "disabled" : "";
    const nextDisabled = canUserAdminGoNext() ? "" : "disabled";

    pagination.innerHTML = `
        <button class="small-button filter-button" ${prevDisabled} onclick="goUserAdminPrevPage()">上一页</button>
        <span class="user-admin-page-info">第 ${userAdminPage} / ${totalPages} 页</span>
        <button class="small-button filter-button" ${nextDisabled} onclick="goUserAdminNextPage()">下一页</button>
    `;
}

function renderUserAdminLoading() {
    const summary = document.getElementById("userAdminSummary");
    const list = document.getElementById("userAdminList");
    const pagination = document.getElementById("userAdminPagination");

    if (summary) {
        summary.innerText = "正在加载用户列表...";
    }

    if (list) {
        list.innerHTML = `<div class="empty user-admin-loading">正在加载用户列表...</div>`;
    }

    if (pagination) {
        pagination.innerHTML = "";
    }
}

function renderUserAdminEmpty(text) {
    const summary = document.getElementById("userAdminSummary");
    const list = document.getElementById("userAdminList");
    const pagination = document.getElementById("userAdminPagination");

    if (summary) {
        summary.innerText = "";
    }

    if (list) {
        list.innerHTML = `<div class="empty user-admin-empty">${escapeUserAdminHtml(text)}</div>`;
    }

    if (pagination) {
        pagination.innerHTML = "";
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

function readUserAdminItems(data) {
    if (Array.isArray(data.items)) {
        return data.items;
    }

    if (Array.isArray(data.data)) {
        return data.data;
    }

    return [];
}

function readUserAdminTotal(data, fallback) {
    if (Number.isFinite(Number(data.total_count))) {
        return Number(data.total_count);
    }

    if (Number.isFinite(Number(data.total))) {
        return Number(data.total);
    }

    return fallback;
}

function syncUserAdminPageSizeFromControl() {
    const pageSizeValue = document.getElementById("userAdminPageSize")?.value || "20";
    const nextPageSize = Number(pageSizeValue);

    userAdminPageSize = [20, 50, 100].includes(nextPageSize) ? nextPageSize : 20;
}

function canUserAdminGoNext() {
    if (userAdminTotal > 0) {
        return userAdminPage * userAdminPageSize < userAdminTotal;
    }

    return userAdminUsers.length >= userAdminPageSize;
}

function getUserAdminTotalPages() {
    if (!userAdminTotal) {
        return 1;
    }

    return Math.max(1, Math.ceil(userAdminTotal / userAdminPageSize));
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
    message.className = isError ? "message user-admin-message user-admin-message-error" : "message user-admin-message";
}

function setUserRoleModalMessage(text, isError) {
    const message = document.getElementById("userRoleModalMessage");

    if (!message) {
        return;
    }

    message.innerText = text || "";
    message.className = isError ? "message user-admin-message user-admin-message-error" : "message user-admin-message";
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

function formatUserAdminNetworkError(error) {
    return error && error.message ? error.message : "网络错误";
}

function escapeTextForMessage(text) {
    return String(text || "");
}

function escapeUserAdminHtml(text) {
    return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
