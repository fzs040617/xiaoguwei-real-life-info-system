// user-avatar-click-upload.js
// 用户头像点击上传：
// 注册 / 编辑用户信息时，直接点击头像预览即可选择图片。
// 隐藏原来的“上传头像”文件输入行，但保留功能。

(function () {
    window.addEventListener("load", () => {
        bindAvatarClickUpload();
    });

    const observer = new MutationObserver(() => {
        bindAvatarClickUpload();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    function bindAvatarClickUpload() {
        const modal = document.getElementById("userModalMask");

        if (!modal) {
            return;
        }

        const preview =
            document.getElementById("registerAvatarPreview") ||
            document.getElementById("editAvatarPreview");

        if (!preview) {
            return;
        }

        const fileInput = modal.querySelector('input[type="file"][accept="image/*"]');

        if (!fileInput) {
            return;
        }

        const fileRow = fileInput.closest(".form-row");

        if (fileRow) {
            fileRow.style.display = "none";
        }

        preview.title = "点击更换头像";
        preview.style.cursor = "pointer";
        preview.style.border = "2px dashed #b7d8c5";
        preview.style.position = "relative";

        if (!preview.dataset.avatarClickReady) {
            preview.dataset.avatarClickReady = "true";

            preview.addEventListener("click", () => {
                fileInput.click();
            });
        }

        if (!document.getElementById("avatarClickTip")) {
            const tip = document.createElement("div");
            tip.id = "avatarClickTip";
            tip.innerText = "点击头像更换图片";
            tip.style.color = "#666";
            tip.style.fontSize = "13px";
            tip.style.margin = "-4px 0 12px 0";

            preview.insertAdjacentElement("afterend", tip);
        }
    }
})();