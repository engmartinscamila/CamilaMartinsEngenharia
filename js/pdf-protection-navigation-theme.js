(function () {
    "use strict";

    const PORTAL_THEME_KEY = "cme_portal_tema";
    const params = new URLSearchParams(location.search);
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    const themeButton = document.getElementById("portalThemeToggle");
    const backButton = document.getElementById("pdfProtectionBack");

    function normalizeTheme(value) {
        return value === "claro" ? "claro" : "escuro";
    }

    function savedTheme() {
        return normalizeTheme(localStorage.getItem(PORTAL_THEME_KEY));
    }

    function applyTheme(theme, persist = true) {
        const value = normalizeTheme(theme);
        const light = value === "claro";

        document.documentElement.dataset.portalTheme = value;
        document.documentElement.style.colorScheme = light ? "light" : "dark";

        if (persist) {
            localStorage.setItem(PORTAL_THEME_KEY, value);
        }

        if (themeMeta) {
            themeMeta.setAttribute("content", light ? "#eef1f4" : "#010914");
        }

        if (themeButton) {
            themeButton.innerHTML = light
                ? '<i class="bi bi-moon-stars"></i><span>Tema escuro</span>'
                : '<i class="bi bi-sun"></i><span>Tema claro</span>';
            themeButton.setAttribute(
                "aria-label",
                light ? "Ativar tema escuro" : "Ativar tema claro"
            );
            themeButton.title = light ? "Ativar tema escuro" : "Ativar tema claro";
        }
    }

    function safeSameOriginReferrer() {
        if (!document.referrer) return "";
        try {
            const url = new URL(document.referrer);
            if (url.origin !== location.origin) return "";
            if (url.pathname.endsWith("/pdf-protegido.html")) return "";
            return url.href;
        } catch {
            return "";
        }
    }

    function fallbackUrl() {
        const bucket = params.get("bucket");
        if (bucket === "biblioteca") return "biblioteca-cliente.html";
        if (bucket === "documentos") return "documentos-cliente.html";
        if (params.get("siteSlug")) return "index.html";
        return "portal.html";
    }

    function goBack() {
        const referrer = safeSameOriginReferrer();

        if (referrer) {
            location.assign(referrer);
            return;
        }

        if (history.length > 1) {
            let changed = false;
            const markChanged = () => {
                changed = true;
            };
            window.addEventListener("pagehide", markChanged, { once: true });
            history.back();

            window.setTimeout(() => {
                if (!changed && location.pathname.endsWith("/pdf-protegido.html")) {
                    location.assign(fallbackUrl());
                }
            }, 350);
            return;
        }

        location.assign(fallbackUrl());
    }

    applyTheme(savedTheme(), false);

    themeButton?.addEventListener("click", () => {
        applyTheme(savedTheme() === "claro" ? "escuro" : "claro");
    });

    backButton?.addEventListener("click", goBack);

    window.addEventListener("pageshow", () => {
        applyTheme(savedTheme(), false);
    });

    window.addEventListener("storage", event => {
        if (event.key === PORTAL_THEME_KEY) {
            applyTheme(event.newValue, false);
        }
    });
}());
