(function (scope) {
    "use strict";

    // Configuração pública do Firebase Web.
    // Estes valores NÃO são segredos. O envio servidor->FCM usa uma credencial
    // privada separada no Supabase e nunca deve ser colocado neste arquivo.
    scope.CME_FIREBASE_PUSH_CONFIG = Object.freeze({
        enabled: false,
        apiKey: "",
        authDomain: "",
        projectId: "",
        storageBucket: "",
        messagingSenderId: "",
        appId: "",
        vapidKey: ""
    });
}(typeof self !== "undefined" ? self : window));
