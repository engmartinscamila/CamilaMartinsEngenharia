(function (scope) {
    "use strict";

    // Configuração pública do Firebase Web.
    // Estes valores NÃO são segredos. O envio servidor->FCM usa uma credencial
    // privada separada no Supabase e nunca deve ser colocado neste arquivo.
    scope.CME_FIREBASE_PUSH_CONFIG = Object.freeze({
        enabled: true,
        apiKey: "AIzaSyAOrZvZQy3RmtZSgIGsaV01lJD30CrIZYI",
        authDomain: "camilamartinsengenharia-88a9d.firebaseapp.com",
        projectId: "camilamartinsengenharia-88a9d",
        storageBucket: "camilamartinsengenharia-88a9d.firebasestorage.app",
        messagingSenderId: "474097139718",
        appId: "1:474097139718:web:adf772e34ce58ca3220387",
        vapidKey: "BIYTZ0zLyZ8CFw7O5vXTWrExBIFTyJx0nmthHWc0RV_Mw3clWpRid9FrYn1QWur8D_TWjOwV8Yrxh04mFQKuKfM"
    });
}(typeof self !== "undefined" ? self : window));
