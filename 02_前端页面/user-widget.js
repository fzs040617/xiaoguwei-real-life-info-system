// user-widget.js
// 用户登录注册组件 V1：右上角头像、登录、注册、编辑资料、用户菜单。

const USER_WIDGET_API = "http://127.0.0.1:8000";
const USER_TOKEN_KEY = "xgw_user_token";

let currentUser = null;
let editingAvatarBase64 = "";

window.addEventListener("load", () => {
    injectUserWidgetStyle();
    injectUserWidget();
    loadCurrentUser();
});

function injectUserWidget() {
    if (document.getElementById("userWidget")) {
        return;
    }

    const widget = document.createElement("div");
    widget.id = "userWidget";

    widget.innerHTML = `
        <div id="userAvatarButton" onclick="toggleUserMenu()">
            <div id="userAvatarCircle">未</div>
            <div id="userNameText">未登录</div>
        </div>

        <div id="userMenuPanel" style="display:none;">
            <div id="userMenuContent"></div>
        </div>
    `;

    const headerInner = document.querySelector(".header-inner");

    if (headerInner) {
        headerInner.appendChild(widget);
    } else {
        document.body.appendChild(widget);
    }

    renderUserMenu();
}

function injectUserWidgetStyle() {
    if (document.getElementById("userWidgetStyle")) {
        return;
    }

    const style = document.createElement("style");
    style.id = "userWidgetStyle";

    style.innerHTML = `
        #userWidget {
            position: relative;
            margin-left: 12px;
            z-index: 9999;
            font-family: Arial, "Microsoft YaHei", sans-serif;
        }

        #userAvatarButton {
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(255,255,255,0.95);
            color: #1f7a4d;
            border-radius: 999px;
            padding: 7px 10px;
            cursor: pointer;
            min-width: 92px;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            user-select: none;
        }

        #userAvatarCircle {
            width: 34px;
            height: 34px;
            border-radius: 50%;
            background: #1f7a4d;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            overflow: hidden;
            flex-shrink: 0;
        }

        #userAvatarCircle img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        #userNameText {
            max-width: 90px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-weight: 600;
            font-size: 14px;
        }

        #userMenuPanel {
            position: absolute;
            right: 0;
            top: 48px;
            width: 280px;
            background: #fff;
            color: #333;
            border-radius: 14px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.18);
            padding: 14px;
            z-index: 99999;
        }

        #userMenuPanel h3 {
            margin: 0 0 8px 0;
            color: #1f7a4d;
        }

        #userMenuPanel p {
            margin: 6px 0;
            color: #666;
            font-size: 14px;
        }

        .user-menu-button {
            width: 100%;
            margin-top: 8px;
            padding: 9px 12px;
            border: none;
            border-radius: 8px;
            background: #1f7a4d;
            color: white;
            cursor: pointer;
            font-size: 14px;
            text-align: center;
        }

        .user-menu-secondary {
            background: #eef8f2;
            color: #1f7a4d;
        }

        .user-menu-danger {
            background: #b3261e;
            color: white;
        }

        .user-modal-mask {
            position: fixed;
            left: 0;
            top: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.38);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .user-modal {
            width: 460px;
            max-width: 92%;
            background: #fff;
            border-radius: 14px;
            padding: 22px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }

        .user-modal h2 {
            margin-top: 0;
            color: #1f7a4d;
        }

        .user-avatar-preview {
            width: 74px;
            height: 74px;
            border-radius: 50%;
            background: #eef8f2;
            color: #1f7a4d;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            font-weight: 700;
            margin-bottom: 10px;
        }

        .user-avatar-preview img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .user-modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 18px;
        }

        .user-plain-button {
            padding: 9px 14px;
            border: 1px solid #ddd;
            border-radius: 8px;
            background: #fff;
            color: #333;
            cursor: pointer;
        }
    `;

    document.head.appendChild(style);
}

async function loadCurrentUser() {
    const token = localStorage.getItem(USER_TOKEN_KEY);

    if (!token) {
        currentUser = null;
        renderUserWidget();
        renderUserMenu();
        return;
    }

    try {
        const response = await fetch(`${USER_WIDGET_API}/auth/me`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({token})
        });

        const data = await response.json();

        if (!response.ok) {
            localStorage.removeItem(USER_TOKEN_KEY);
            currentUser = null;
            renderUserWidget();
            renderUserMenu();
            return;
        }

        currentUser = data.data;
        renderUserWidget();
        renderUserMenu();

    } catch (error) {
        currentUser = null;
        renderUserWidget();
        renderUserMenu();
    }
}

function renderUserWidget() {
    const avatar = document.getElementById("userAvatarCircle");
    const nameText = document.getElementById("userNameText");

    if (!avatar || !nameText) {
        return;
    }

    if (!currentUser) {
        avatar.innerText = "未";
        nameText.innerText = "未登录";
        return;
    }

    if (currentUser.avatar_base64) {
        avatar.innerHTML = `<img src="${currentUser.avatar_base64}" alt="头像">`;
    } else {
        avatar.innerText = (currentUser.nickname || currentUser.account || "用").slice(0, 1);
    }

    nameText.innerText = currentUser.nickname || currentUser.account || "用户";
}

function renderUserMenu() {
    const box = document.getElementById("userMenuContent");

    if (!box) {
        return;
    }

    if (!currentUser) {
        box.innerHTML = `
            <h3>用户中心</h3>
            <p>当前未登录。登录后可编辑个人信息，后续管理员可使用系统管理权限。</p>
            <button class="user-menu-button" onclick="openLoginModal()">登录</button>
            <button class="user-menu-button user-menu-secondary" onclick="openRegisterModal()">注册</button>
        `;
        return;
    }

    box.innerHTML = `
        <h3>${escapeUserWidgetHtml(currentUser.nickname || currentUser.account)}</h3>
        <p>账号：${escapeUserWidgetHtml(currentUser.account)}</p>
        <p>角色：${currentUser.role === "admin" ? "管理员" : "普通用户"}</p>

        <button class="user-menu-button" onclick="openEditProfileModal()">编辑用户信息</button>
        <button class="user-menu-button user-menu-secondary" onclick="openSystemSettings()">系统设置</button>
        ${
            currentUser.role === "admin"
                ? `<button class="user-menu-button user-menu-secondary" onclick="alert('管理员功能后续接入：清空历史、用户管理、权限控制。')">管理员权限</button>`
                : ``
        }
        <button class="user-menu-button user-menu-danger" onclick="logoutUser()">退出登录</button>
    `;
}

function toggleUserMenu() {
    const panel = document.getElementById("userMenuPanel");

    if (!panel) {
        return;
    }

    panel.style.display = panel.style.display === "none" ? "block" : "none";
}

function closeUserMenu() {
    const panel = document.getElementById("userMenuPanel");

    if (panel) {
        panel.style.display = "none";
    }
}

function openLoginModal() {
    closeUserMenu();

    showUserModal(`
        <h2>登录</h2>

        <div class="form-row">
            <label>账号</label>
            <input id="loginAccount" placeholder="英文、数字、常用标点">
        </div>

        <div class="form-row">
            <label>密码</label>
            <input id="loginPassword" type="password" placeholder="英文、数字、常用标点">
        </div>

        <div id="userModalMessage" class="message"></div>

        <div class="user-modal-actions">
            <button class="user-plain-button" onclick="closeUserModal()">取消</button>
            <button class="user-menu-button" style="width:auto; margin-top:0;" onclick="loginUser()">登录</button>
        </div>
    `);
}

function openRegisterModal() {
    closeUserMenu();
    editingAvatarBase64 = "";

    showUserModal(`
        <h2>注册</h2>
        <p class="notice">第一个注册用户会自动成为管理员，后续注册用户默认为普通用户。</p>

        <div class="user-avatar-preview" id="registerAvatarPreview">头像</div>

        <div class="form-row">
            <label>上传头像，可选</label>
            <input type="file" accept="image/*" onchange="readUserAvatarFile(event, 'registerAvatarPreview')">
        </div>

        <div class="form-row">
            <label>昵称</label>
            <input id="registerNickname" placeholder="例如：小谷围管理员">
        </div>

        <div class="form-row">
            <label>账号</label>
            <input id="registerAccount" placeholder="只能英文大小写、数字、常用标点">
        </div>

        <div class="form-row">
            <label>密码</label>
            <input id="registerPassword" type="password" placeholder="只能英文大小写、数字、常用标点">
        </div>

        <div id="userModalMessage" class="message"></div>

        <div class="user-modal-actions">
            <button class="user-plain-button" onclick="closeUserModal()">取消</button>
            <button class="user-menu-button" style="width:auto; margin-top:0;" onclick="registerUser()">注册</button>
        </div>
    `);
}

function openEditProfileModal() {
    closeUserMenu();

    if (!currentUser) {
        alert("请先登录。");
        return;
    }

    editingAvatarBase64 = currentUser.avatar_base64 || "";

    showUserModal(`
        <h2>编辑用户信息</h2>

        <div class="user-avatar-preview" id="editAvatarPreview">
            ${
                editingAvatarBase64
                    ? `<img src="${editingAvatarBase64}" alt="头像">`
                    : escapeUserWidgetHtml((currentUser.nickname || currentUser.account || "用").slice(0, 1))
            }
        </div>

        <div class="form-row">
            <label>上传新头像，可选</label>
            <input type="file" accept="image/*" onchange="readUserAvatarFile(event, 'editAvatarPreview')">
        </div>

        <div class="form-row">
            <label>昵称</label>
            <input id="editNickname" value="${escapeUserWidgetAttr(currentUser.nickname || "")}">
        </div>

        <div class="form-row">
            <label>账号</label>
            <input id="editAccount" value="${escapeUserWidgetAttr(currentUser.account || "")}">
        </div>

        <div class="form-row">
            <label>新密码，可留空</label>
            <input id="editPassword" type="password" placeholder="留空表示不修改密码">
        </div>

        <div id="userModalMessage" class="message"></div>

        <div class="user-modal-actions">
            <button class="user-plain-button" onclick="closeUserModal()">取消</button>
            <button class="user-menu-button" style="width:auto; margin-top:0;" onclick="updateUserProfile()">保存修改</button>
        </div>
    `);
}

function showUserModal(innerHtml) {
    closeUserModal();

    const mask = document.createElement("div");
    mask.className = "user-modal-mask";
    mask.id = "userModalMask";

    mask.innerHTML = `
        <div class="user-modal">
            ${innerHtml}
        </div>
    `;

    document.body.appendChild(mask);
}

function closeUserModal() {
    const mask = document.getElementById("userModalMask");

    if (mask) {
        mask.remove();
    }
}

function readUserAvatarFile(event, previewId) {
    const file = event.target.files[0];

    if (!file) {
        return;
    }

    if (!file.type.startsWith("image/")) {
        alert("请选择图片文件。");
        return;
    }

    const reader = new FileReader();

    reader.onload = function (e) {
        editingAvatarBase64 = e.target.result;

        const preview = document.getElementById(previewId);

        if (preview) {
            preview.innerHTML = `<img src="${editingAvatarBase64}" alt="头像">`;
        }
    };

    reader.readAsDataURL(file);
}

async function registerUser() {
    const account = getUserInputValue("registerAccount");
    const password = getUserInputValue("registerPassword");
    const nickname = getUserInputValue("registerNickname");

    if (!account || !password) {
        setUserModalMessage("账号和密码不能为空。");
        return;
    }

    try {
        const response = await fetch(`${USER_WIDGET_API}/auth/register`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                account,
                password,
                nickname: nickname || account,
                avatar_base64: editingAvatarBase64 || null
            })
        });

        const data = await response.json();

        if (!response.ok) {
            setUserModalMessage("注册失败：" + JSON.stringify(data));
            return;
        }

        localStorage.setItem(USER_TOKEN_KEY, data.token);
        currentUser = data.data;

        closeUserModal();
        renderUserWidget();
        renderUserMenu();

        alert(`注册成功。你的角色是：${currentUser.role === "admin" ? "管理员" : "普通用户"}`);

    } catch (error) {
        setUserModalMessage("注册失败，请确认后端已启动：" + error.message);
    }
}

async function loginUser() {
    const account = getUserInputValue("loginAccount");
    const password = getUserInputValue("loginPassword");

    if (!account || !password) {
        setUserModalMessage("账号和密码不能为空。");
        return;
    }

    try {
        const response = await fetch(`${USER_WIDGET_API}/auth/login`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({account, password})
        });

        const data = await response.json();

        if (!response.ok) {
            setUserModalMessage("登录失败：" + JSON.stringify(data));
            return;
        }

        localStorage.setItem(USER_TOKEN_KEY, data.token);
        currentUser = data.data;

        closeUserModal();
        renderUserWidget();
        renderUserMenu();

        alert("登录成功。");

    } catch (error) {
        setUserModalMessage("登录失败，请确认后端已启动：" + error.message);
    }
}

async function updateUserProfile() {
    const token = localStorage.getItem(USER_TOKEN_KEY);

    if (!token) {
        setUserModalMessage("登录状态无效，请重新登录。");
        return;
    }

    const account = getUserInputValue("editAccount");
    const password = getUserInputValue("editPassword");
    const nickname = getUserInputValue("editNickname");

    try {
        const payload = {
            token,
            account,
            nickname,
            avatar_base64: editingAvatarBase64 || null
        };

        if (password) {
            payload.password = password;
        }

        const response = await fetch(`${USER_WIDGET_API}/auth/profile`, {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            setUserModalMessage("保存失败：" + JSON.stringify(data));
            return;
        }

        currentUser = data.data;

        closeUserModal();
        renderUserWidget();
        renderUserMenu();

        alert("用户信息已更新。");

    } catch (error) {
        setUserModalMessage("保存失败，请确认后端已启动：" + error.message);
    }
}

async function logoutUser() {
    const token = localStorage.getItem(USER_TOKEN_KEY);

    if (!token) {
        localStorage.removeItem(USER_TOKEN_KEY);
        currentUser = null;
        renderUserWidget();
        renderUserMenu();
        return;
    }

    try {
        await fetch(`${USER_WIDGET_API}/auth/logout`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({token})
        });
    } catch (error) {
        console.log("退出登录请求失败，但本地会清除登录状态", error);
    }

    localStorage.removeItem(USER_TOKEN_KEY);
    currentUser = null;
    closeUserMenu();
    renderUserWidget();
    renderUserMenu();

    alert("已退出登录。");
}

function openSystemSettings() {
    alert("系统设置后续会加入：主题、危险操作权限、导入导出策略、用户管理等。");
}

function getUserInputValue(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
}

function setUserModalMessage(text) {
    const box = document.getElementById("userModalMessage");

    if (box) {
        box.innerText = text;
    } else {
        alert(text);
    }
}

function escapeUserWidgetHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function escapeUserWidgetAttr(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}