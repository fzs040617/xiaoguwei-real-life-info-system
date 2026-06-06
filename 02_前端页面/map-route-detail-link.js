// map-route-detail-link.js
// 给地图点卡片和路线卡片自动增加“查看详情”按钮。

(function () {
    window.addEventListener("load", () => {
        setTimeout(addMapRouteDetailButtons, 500);
    });

    const observer = new MutationObserver(() => {
        setTimeout(addMapRouteDetailButtons, 200);
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    function addMapRouteDetailButtons() {
        const cards = Array.from(document.querySelectorAll(".card"));

        cards.forEach(card => {
            if (card.dataset.mapRouteDetailReady === "true") {
                return;
            }

            const target = inferMapRouteTarget(card);

            if (!target) {
                return;
            }

            const btn = document.createElement("button");
            btn.className = "small-button";
            btn.innerText = "查看详情";

            if (target.type === "map_point") {
                btn.onclick = function () {
                    location.href = `map-detail.html?id=${target.id}`;
                };
            }

            if (target.type === "route") {
                btn.onclick = function () {
                    location.href = `route-detail.html?id=${target.id}`;
                };
            }

            const firstActionRow = card.querySelector(".action-row");

            if (firstActionRow) {
                firstActionRow.insertAdjacentElement("beforebegin", btn);
            } else {
                card.appendChild(btn);
            }

            card.dataset.mapRouteDetailReady = "true";
        });
    }

    function inferMapRouteTarget(card) {
        const buttons = Array.from(card.querySelectorAll("button[onclick]"));

        for (const button of buttons) {
            const code = button.getAttribute("onclick") || "";

            const mapMatch = code.match(/(?:editMapPoint|archiveMapPoint|restoreMapPoint|deleteMapPoint)\((\d+)/);
            if (mapMatch) {
                return {
                    type: "map_point",
                    id: Number(mapMatch[1])
                };
            }

            const routeMatch = code.match(/(?:editRoute|archiveRoute|restoreRoute|deleteRoute)\((\d+)/);
            if (routeMatch) {
                return {
                    type: "route",
                    id: Number(routeMatch[1])
                };
            }
        }

        return null;
    }
})();