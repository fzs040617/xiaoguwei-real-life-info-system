// history-badge.js
// 给页面上的卡片自动加“最后更新时间”和“查看本条历史”按钮。
// 依赖后端 GET /update-history。

(function () {
    const API_BASE = "http://127.0.0.1:8000";
    let historyList = [];

    window.addEventListener("load", () => {
        setTimeout(loadHistoryBadges, 600);
    });

    const observer = new MutationObserver(() => {
        setTimeout(renderHistoryBadges, 200);
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    async function loadHistoryBadges() {
        try {
            const response = await fetch(`${API_BASE}/update-history`);
            const data = await response.json();

            historyList = data.data || [];
            renderHistoryBadges();
        } catch (error) {
            console.log("[历史徽标] 加载失败", error);
        }
    }

    function renderHistoryBadges() {
        const cards = Array.from(document.querySelectorAll(".card"));

        cards.forEach(card => {
            if (card.dataset.historyBadgeReady === "true") {
                return;
            }

            const target = inferTargetFromCard(card);

            if (!target) {
                return;
            }

            const latest = findLatestHistory(target.targetType, target.targetId);

            if (!latest) {
                return;
            }

            const badge = document.createElement("div");
            badge.className = "history-badge";
            badge.style.marginTop = "10px";
            badge.style.padding = "10px";
            badge.style.border = "1px solid #e5e5e5";
            badge.style.borderRadius = "10px";
            badge.style.background = "#f8faf9";
            badge.style.fontSize = "13px";
            badge.style.color = "#555";

            badge.innerHTML = `
                <div>
                    <span class="tag">最后更新</span>
                    <span>${escapeHistoryBadgeHtml(latest.created_at || "未知时间")}</span>
                    <span style="margin-left:8px;">${escapeHistoryBadgeHtml(latest.action || "更新")}</span>
                </div>
                <button class="small-button" style="margin-top:8px;" onclick="location.href='history.html?target_type=${target.targetType}&target_id=${target.targetId}'">
                    查看本条历史
                </button>
            `;

            const actionRow = card.querySelector(".action-row");

            if (actionRow) {
                actionRow.insertAdjacentElement("beforebegin", badge);
            } else {
                card.appendChild(badge);
            }

            card.dataset.historyBadgeReady = "true";
        });
    }

    function inferTargetFromCard(card) {
        const buttons = Array.from(card.querySelectorAll("button[onclick]"));
        const links = Array.from(card.querySelectorAll("a[href]"));

        for (const button of buttons) {
            const code = button.getAttribute("onclick") || "";

            const routeMatch = code.match(/(?:editRoute|archiveRoute|restoreRoute|deleteRoute)\((\d+)/);
            if (routeMatch) {
                return { targetType: "route", targetId: Number(routeMatch[1]) };
            }

            const mapMatch = code.match(/(?:editMapPoint|archiveMapPoint|restoreMapPoint|deleteMapPoint)\((\d+)/);
            if (mapMatch) {
                return { targetType: "map_point", targetId: Number(mapMatch[1]) };
            }

            const clueMatch = code.match(/(?:updateClueStatus|approveClue|deleteClue|editClue|archiveClue|restoreClue)\((\d+)/);
            if (clueMatch) {
                return { targetType: "clue", targetId: Number(clueMatch[1]) };
            }

            const verifiedMatch = code.match(/(?:deleteVerifiedItem|editVerifiedItem|archiveVerifiedItem|restoreVerifiedItem)\((\d+)/);
            if (verifiedMatch) {
                return { targetType: "verified", targetId: Number(verifiedMatch[1]) };
            }

            const feedbackMatch = code.match(/(?:deleteFeedback|deleteFeedbackFromAdmin)\((\d+)/);
            if (feedbackMatch) {
                return { targetType: "feedback", targetId: Number(feedbackMatch[1]) };
            }
        }

        for (const link of links) {
            const href = link.getAttribute("href") || "";

            const clueDetail = href.match(/clue-detail\.html\?id=(\d+)/);
            if (clueDetail) {
                return { targetType: "clue", targetId: Number(clueDetail[1]) };
            }

            const itemDetail = href.match(/item-detail\.html\?id=(\d+)/);
            if (itemDetail) {
                return { targetType: "verified", targetId: Number(itemDetail[1]) };
            }
        }

        return null;
    }

    function findLatestHistory(targetType, targetId) {
        const matched = historyList.filter(item =>
            item.target_type === targetType &&
            Number(item.target_id) === Number(targetId)
        );

        if (matched.length === 0) {
            return null;
        }

        return matched[0];
    }

    function escapeHistoryBadgeHtml(text) {
        return String(text || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
})();   