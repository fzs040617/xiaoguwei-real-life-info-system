// backup-import-layout.js
// 备份导入布局优化 V2：
// 只在 backup.html 运行。
// 左侧：选择文件、系统密码、验证码、导入按钮
// 右侧：备份文件预览

(function () {
    window.addEventListener("load", () => {
        setTimeout(applyBackupImportLayout, 900);
    });

    const observer = new MutationObserver(() => {
        applyBackupImportLayout();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    window.applyBackupImportLayout = applyBackupImportLayout;

    function getCurrentFileName() {
        const path = location.pathname || "";
        const fileName = decodeURIComponent(path.split("/").pop() || "");
        return fileName.toLowerCase();
    }

    function applyBackupImportLayout() {
        if (getCurrentFileName() !== "backup.html") {
            return;
        }

        const box = document.getElementById("backupImportBox");

        if (!box) {
            return;
        }

        if (box.dataset.layoutReady === "true") {
            return;
        }

        const fileRow = document.getElementById("backupImportFile")?.closest(".form-row");
        const preview = document.getElementById("backupImportPreview");
        const passwordRow = document.getElementById("backupImportSystemPassword")?.closest(".form-row");
        const codeRow = document.getElementById("backupImportCodeInput")?.closest(".form-row");
        const importButton = findBackupImportButton(box);
        const message = document.getElementById("backupImportMessage");

        if (!fileRow || !preview || !passwordRow || !codeRow || !importButton || !message) {
            return;
        }

        box.dataset.layoutReady = "true";

        const title = box.querySelector("h2");
        const notice = box.querySelector(".notice");

        const layout = document.createElement("div");
        layout.id = "backupImportLayout";
        layout.style.display = "grid";
        layout.style.gridTemplateColumns = "minmax(320px, 0.9fr) minmax(360px, 1.1fr)";
        layout.style.gap = "18px";
        layout.style.alignItems = "start";
        layout.style.marginTop = "14px";

        const left = document.createElement("div");
        left.id = "backupImportLeft";
        left.className = "card";
        left.style.margin = "0";

        const right = document.createElement("div");
        right.id = "backupImportRight";
        right.className = "card";
        right.style.margin = "0";
        right.style.maxHeight = "620px";
        right.style.overflowY = "auto";

        const rightTitle = document.createElement("h3");
        rightTitle.innerText = "备份文件预览";
        rightTitle.style.marginTop = "0";

        left.appendChild(fileRow);
        left.appendChild(passwordRow);
        left.appendChild(codeRow);
        left.appendChild(importButton);
        left.appendChild(message);

        right.appendChild(rightTitle);
        right.appendChild(preview);

        layout.appendChild(left);
        layout.appendChild(right);

        if (notice) {
            notice.insertAdjacentElement("afterend", layout);
        } else if (title) {
            title.insertAdjacentElement("afterend", layout);
        } else {
            box.appendChild(layout);
        }

        addBackupImportResponsiveStyle();
    }

    function findBackupImportButton(box) {
        const buttons = Array.from(box.querySelectorAll("button"));

        return buttons.find(button => {
            const code = button.getAttribute("onclick") || "";
            const text = button.innerText || "";
            return code.includes("importBackupData") || text.includes("导入备份");
        });
    }

    function addBackupImportResponsiveStyle() {
        if (document.getElementById("backupImportLayoutStyle")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "backupImportLayoutStyle";
        style.innerHTML = `
            @media (max-width: 900px) {
                #backupImportLayout {
                    grid-template-columns: 1fr !important;
                }

                #backupImportRight {
                    max-height: none !important;
                }
            }

            #backupImportLeft .form-row,
            #backupImportRight .form-row {
                margin-bottom: 14px;
            }

            #backupImportPreview {
                margin-top: 0 !important;
            }

            #backupImportPreview .dashboard-grid {
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            }
        `;

        document.head.appendChild(style);
    }
})();