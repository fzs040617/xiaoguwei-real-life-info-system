// user-widget-v2.js
// 用户组件 V2：
// 1. 注册密码输入两遍
// 2. 注册时选择普通用户 / 管理员
// 3. 注册管理员必须输入系统密码
// 4. 修改密码必须输入原密码
// 5. 继续复用 user-widget.js 的右上角头像和菜单

let registerAdminVerifyToken = "";

window.openRegisterModal = function () {
    closeUserMenu();
    editingAvatarBase64 = "";

    showUserModal(`
        <h2>注册</h2>
        <p class="notice">
            普通用户可直接注册；注册管理员需要输入正确的系统密码。
        </p>

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
            <label>用户属性</label>
            <select id="registerRole" onchange="toggleRegisterAdminPassword()">
                <option value="user">普通用户</option>
                <option value="admin">管理员</option>
            </select>
        </div>

        <div class="form-row" id="registerAdminPasswordRow" style="display:none;">
            <label>系统密码，注册管理员必填</label>
            <input id="registerAdminPassword" type="password" placeholder="请输入系统密码">
        </div>

        <div class="form-row" id="registerAdminVerifyRow" style="display:none;">
            <label>动态验证码，注册管理员必填</label>
            <div class="xgw-verify-code-panel">
                <span class="tag">验证码</span>
                <strong id="registerAdminVerifyDisplay" class="xgw-verify-code" onclick="loadRegisterAdminVerifyCode()" title="点击刷新验证码">点击获取</strong>
                <button type="button" class="small-button filter-button" onclick="loadRegisterAdminVerifyCode()">刷新</button>
            </div>
            <input id="registerAdminVerifyCode" placeholder="请输入上方动态验证码">
        </div>

        <div class="form-row">
            <label>账号</label>
            <input id="registerAccount" placeholder="只能英文大小写、数字、常用标点">
        </div>

        <div class="form-row">
            <label>密码</label>
            <input id="registerPassword" type="password" placeholder="只能英文大小写、数字、常用标点">
        </div>

        <div class="form-row">
            <label>再次输入密码</label>
            <input id="registerPasswordConfirm" type="password" placeholder="请再次输入密码">
        </div>

        <div id="userModalMessage" class="message"></div>

        <div class="user-modal-actions">
            <button class="user-plain-button" onclick="closeUserModal()">取消</button>
            <button class="user-menu-button" style="width:auto; margin-top:0;" onclick="registerUser()">注册</button>
        </div>
    `);
};

window.toggleRegisterAdminPassword = function () {
    const role = document.getElementById("registerRole")?.value || "user";
    const row = document.getElementById("registerAdminPasswordRow");
    const verifyRow = document.getElementById("registerAdminVerifyRow");

    if (row) {
        row.style.display = role === "admin" ? "block" : "none";
    }

    if (verifyRow) {
        verifyRow.style.display = role === "admin" ? "block" : "none";
    }

    if (role === "admin") {
        loadRegisterAdminVerifyCode();
    } else {
        registerAdminVerifyToken = "";
        const verifyCode = document.getElementById("registerAdminVerifyCode");
        if (verifyCode) {
            verifyCode.value = "";
        }
    }
};

window.loadRegisterAdminVerifyCode = async function () {
    const display = document.getElementById("registerAdminVerifyDisplay");
    const input = document.getElementById("registerAdminVerifyCode");

    if (display) {
        display.innerText = "加载中...";
    }

    try {
        const response = await fetch(`${USER_WIDGET_API}/admin/verify-code?purpose=admin_register`);
        const data = await response.json();

        if (!response.ok) {
            registerAdminVerifyToken = "";
            if (display) {
                display.innerText = "加载失败";
            }
            setUserModalMessage("验证码加载失败：" + formatUserWidgetVerifyError(data));
            return;
        }

        registerAdminVerifyToken = data.verify_token || "";
        if (display) {
            display.innerText = data.verify_code || "点击刷新";
        }
        if (input) {
            input.value = "";
        }
    } catch (error) {
        registerAdminVerifyToken = "";
        if (display) {
            display.innerText = "加载失败";
        }
        setUserModalMessage("验证码加载失败：" + error.message);
    }
};

window.registerUser = async function () {
    const account = getUserInputValue("registerAccount");
    const password = getUserInputValue("registerPassword");
    const passwordConfirm = getUserInputValue("registerPasswordConfirm");
    const nickname = getUserInputValue("registerNickname");
    const role = getUserInputValue("registerRole") || "user";
    const adminPassword = getUserInputValue("registerAdminPassword");
    const verifyCode = getUserInputValue("registerAdminVerifyCode").toUpperCase();

    if (!account || !password || !passwordConfirm) {
        setUserModalMessage("账号、密码、再次输入密码不能为空。");
        return;
    }

    if (password !== passwordConfirm) {
        setUserModalMessage("两次输入的密码不一致。");
        return;
    }

    if (role === "admin" && !adminPassword) {
        setUserModalMessage("注册管理员必须输入系统密码。");
        return;
    }

    if (role === "admin" && !registerAdminVerifyToken) {
        setUserModalMessage("请先获取动态验证码。");
        return;
    }

    if (role === "admin" && !verifyCode) {
        setUserModalMessage("请输入动态验证码。");
        return;
    }

    try {
        const response = await fetch(`${USER_WIDGET_API}/auth/register-v2`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                account,
                password,
                password_confirm: passwordConfirm,
                nickname: nickname || account,
                avatar_base64: editingAvatarBase64 || null,
                role,
                admin_password: adminPassword || null,
                verify_token: role === "admin" ? registerAdminVerifyToken : null,
                verify_code: role === "admin" ? verifyCode : null
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
        notifyUserWidgetAuthChanged();

        alert(`注册成功。你的角色是：${currentUser.role === "admin" ? "管理员" : "普通用户"}`);

    } catch (error) {
        setUserModalMessage("注册失败，请确认后端已启动：" + error.message);
    }
};

window.openEditProfileModal = function () {
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
            <label>原密码，修改密码时必填</label>
            <input id="editOldPassword" type="password" placeholder="不修改密码可留空">
        </div>

        <div class="form-row">
            <label>新密码，可留空</label>
            <input id="editPassword" type="password" placeholder="留空表示不修改密码">
        </div>

        <div class="form-row">
            <label>再次输入新密码</label>
            <input id="editPasswordConfirm" type="password" placeholder="请再次输入新密码">
        </div>

        <div id="userModalMessage" class="message"></div>

        <div class="user-modal-actions">
            <button class="user-plain-button" onclick="closeUserModal()">取消</button>
            <button class="user-menu-button" style="width:auto; margin-top:0;" onclick="updateUserProfile()">保存修改</button>
        </div>
    `);
};

window.updateUserProfile = async function () {
    const token = localStorage.getItem(USER_TOKEN_KEY);

    if (!token) {
        setUserModalMessage("登录状态无效，请重新登录。");
        return;
    }

    const account = getUserInputValue("editAccount");
    const nickname = getUserInputValue("editNickname");
    const oldPassword = getUserInputValue("editOldPassword");
    const password = getUserInputValue("editPassword");
    const passwordConfirm = getUserInputValue("editPasswordConfirm");

    const wantsChangePassword = oldPassword || password || passwordConfirm;

    if (wantsChangePassword) {
        if (!oldPassword) {
            setUserModalMessage("修改密码必须输入原密码。");
            return;
        }

        if (!password || !passwordConfirm) {
            setUserModalMessage("请输入新密码并再次确认。");
            return;
        }

        if (password !== passwordConfirm) {
            setUserModalMessage("两次输入的新密码不一致。");
            return;
        }
    }

    try {
        const payload = {
            token,
            account,
            nickname,
            avatar_base64: editingAvatarBase64 || null
        };

        if (wantsChangePassword) {
            payload.old_password = oldPassword;
            payload.password = password;
            payload.password_confirm = passwordConfirm;
        }

        const response = await fetch(`${USER_WIDGET_API}/auth/profile-v2`, {
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
        notifyUserWidgetAuthChanged();

        alert("用户信息已更新。");

    } catch (error) {
        setUserModalMessage("保存失败，请确认后端已启动：" + error.message);
    }
};

function formatUserWidgetVerifyError(data) {
    if (!data) {
        return "未知错误";
    }

    if (typeof data.detail === "string") {
        return data.detail;
    }

    return JSON.stringify(data);
}

const USER_WIDGET_V2_OVERRIDES = {
    openRegisterModal: window.openRegisterModal,
    toggleRegisterAdminPassword: window.toggleRegisterAdminPassword,
    loadRegisterAdminVerifyCode: window.loadRegisterAdminVerifyCode,
    registerUser: window.registerUser,
    openEditProfileModal: window.openEditProfileModal,
    updateUserProfile: window.updateUserProfile
};

window.installUserWidgetV2Overrides = function () {
    Object.keys(USER_WIDGET_V2_OVERRIDES).forEach(name => {
        if (USER_WIDGET_V2_OVERRIDES[name]) {
            window[name] = USER_WIDGET_V2_OVERRIDES[name];
        }
    });
};

window.installUserWidgetV2Overrides();
window.addEventListener("load", window.installUserWidgetV2Overrides);
