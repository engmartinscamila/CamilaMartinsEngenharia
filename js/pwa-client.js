(function () {
    "use strict";

    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/firebase-messaging-sw.js?v=20260903-1", {
            scope: "/",
            updateViaCache: "none"
        }).then(registration => {
            registration.update().catch(() => {});
        }).catch(error => {
            console.warn("Não foi possível registrar o aplicativo do portal neste navegador.", error);
        });
    }, { once: true });
}());
