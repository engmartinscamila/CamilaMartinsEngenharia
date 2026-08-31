importScripts("/js/firebase-push-config.js");

const config = self.CME_FIREBASE_PUSH_CONFIG;

if (config?.enabled && config.projectId) {
    importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
    importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

    firebase.initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId
    });

    const messaging = firebase.messaging();

    messaging.onBackgroundMessage(payload => {
        const data = payload?.data || {};
        const title = data.title || "Camila Martins Engenharia";
        const options = {
            body: data.body || "Há uma nova atualização no seu portal.",
            icon: "/assets/logo.png",
            badge: "/assets/logo.png",
            tag: data.tag || "cme-portal",
            data: { link: data.link || "/portal.html" }
        };
        self.registration.showNotification(title, options);
    });
}

self.addEventListener("notificationclick", event => {
    event.notification.close();
    const link = event.notification?.data?.link || "/portal.html";
    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then(lista => {
            const aberta = lista.find(cliente => "focus" in cliente && new URL(cliente.url).origin === self.location.origin);
            if (aberta) {
                aberta.navigate(link);
                return aberta.focus();
            }
            return clients.openWindow(link);
        })
    );
});
