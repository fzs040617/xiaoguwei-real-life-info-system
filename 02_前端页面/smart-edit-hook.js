// smart-edit-hook.js
// 给现有智能识别函数加“识别结果可编辑面板”。

(function () {
    window.addEventListener("load", () => {
        hookMapSmartEdit();
        hookRouteSmartEdit();
        hookGenericSmartEdit();
    });

    function hookMapSmartEdit() {
        if (!document.getElementById("mapSmartInput")) {
            return;
        }

        const oldParse = window.parseMapSmartText;

        window.parseMapSmartText = function () {
            if (typeof oldParse === "function") {
                oldParse();
            }

            setTimeout(() => {
                const data = readMapFormAsSmartData();
                if (typeof showSmartEditPanel === "function") {
                    showSmartEditPanel("map", data);
                }
            }, 100);
        };
    }

    function hookRouteSmartEdit() {
        if (!document.getElementById("routeSmartInput")) {
            return;
        }

        const oldParse = window.parseRouteSmartText;

        window.parseRouteSmartText = function () {
            if (typeof oldParse === "function") {
                oldParse();
            }

            setTimeout(() => {
                const data = readRouteFormAsSmartData();
                if (typeof showSmartEditPanel === "function") {
                    showSmartEditPanel("route", data);
                }
            }, 100);
        };
    }

    function hookGenericSmartEdit() {
        if (!document.getElementById("genericSmartInput")) {
            return;
        }

        const oldParse = window.parseGenericSmartText;

        window.parseGenericSmartText = function () {
            if (typeof oldParse === "function") {
                oldParse();
            }

            setTimeout(() => {
                const pageType = detectSmartGenericPageType();
                const data = readGenericFormAsSmartData(pageType);

                if (typeof showSmartEditPanel === "function") {
                    showSmartEditPanel(pageType, data);
                }
            }, 100);
        };
    }

    function detectSmartGenericPageType() {
        if (document.getElementById("clueTitle")) {
            return "clue";
        }

        if (document.getElementById("targetUrl")) {
            return "crawler";
        }

        if (document.getElementById("feedbackContent")) {
            return "feedback";
        }

        return "";
    }

    function readMapFormAsSmartData() {
        return {
            name: getValue("mapName"),
            category: getValue("mapCategory"),
            address: getValue("mapAddress"),
            latitude: getValue("mapLatitude"),
            longitude: getValue("mapLongitude"),
            mapType: getValue("mapType"),
            targetType: getValue("mapTargetType"),
            targetId: getValue("mapTargetId"),
            source: getValue("mapSource"),
            description: getValue("mapDescription")
        };
    }

    function readRouteFormAsSmartData() {
        return {
            name: getValue("routeName"),
            routeType: getValue("routeType"),
            category: getValue("routeCategory"),
            startArea: getValue("routeStartArea"),
            pointIds: getValue("routePointIds"),
            source: getValue("routeSource"),
            description: getValue("routeDescription")
        };
    }

    function readGenericFormAsSmartData(pageType) {
        if (pageType === "clue") {
            return {
                title: getValue("clueTitle"),
                category: getValue("clueCategory"),
                source: getValue("cluePlatform"),
                url: getValue("clueUrl"),
                summary: getValue("clueSummary")
            };
        }

        if (pageType === "crawler") {
            return {
                url: getValue("targetUrl"),
                category: getValue("targetCategory"),
                source: getValue("targetPlatform"),
                summary: getValue("targetNote")
            };
        }

        return {
            userName: getValue("feedbackUserName"),
            feedbackType: getValue("feedbackType"),
            feedbackContent: getValue("feedbackContent")
        };
    }

    function getValue(id) {
        const el = document.getElementById(id);
        return el ? el.value.trim() : "";
    }
})();