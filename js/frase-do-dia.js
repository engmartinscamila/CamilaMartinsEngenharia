(function () {
    "use strict";

    if (window.__CME_FRASE_DO_DIA__) return;
    window.__CME_FRASE_DO_DIA__ = true;

    const ARQUIVO = "assets/frases-do-dia.json?v=20260901-3";
    const TIMEZONE = "America/Sao_Paulo";
    const MS_DIA = 86400000;
    const FALLBACK = {
        texto: "Consistência transforma intenção em resultado.",
        autor: "Camila Martins",
        categoria: "Disciplina"
    };

    function instalarEstilos() {
        if (document.getElementById("cmeFraseDoDiaStyle")) return;
        const style = document.createElement("style");
        style.id = "cmeFraseDoDiaStyle";
        style.textContent = `
            .cme-frase-dia { position:relative; isolation:isolate; width:100%; margin:24px 0 30px; padding:25px 30px 24px 34px; overflow:hidden; border:1px solid var(--linha,var(--borda,rgba(184,154,99,.30))); border-radius:2px; background:linear-gradient(120deg,rgba(184,154,99,.10),rgba(255,255,255,.025) 52%,rgba(184,154,99,.035)),var(--painel,var(--azul-card,rgba(3,13,26,.94))); box-shadow:0 18px 46px rgba(0,0,0,.16); color:var(--texto,var(--branco,inherit)); font-family:var(--font-main,"Century Gothic","Avenir Next","Helvetica Neue",Arial,sans-serif); }
            .cme-frase-dia::before { content:"“"; position:absolute; top:-28px; right:22px; z-index:-1; font-family:Georgia,serif; font-size:9.5rem; line-height:1; color:rgba(184,154,99,.10); pointer-events:none; }
            .cme-frase-dia__topo { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:12px; }
            .cme-frase-dia__rotulo { color:var(--dourado,#b89a63); font-size:.70rem; font-weight:600; letter-spacing:.18em; text-transform:uppercase; }
            .cme-frase-dia__categoria { padding:5px 9px; border:1px solid rgba(184,154,99,.28); border-radius:999px; color:var(--texto-claro,var(--cinza-claro,#aeb4bd)); font-size:.66rem; letter-spacing:.05em; }
            .cme-frase-dia blockquote { max-width:980px; margin:0; color:inherit; font-family:var(--font-main,"Century Gothic","Avenir Next","Helvetica Neue",Arial,sans-serif); font-size:clamp(1.06rem,1.8vw,1.34rem); font-weight:300; line-height:1.62; letter-spacing:.01em; }
            .cme-frase-dia cite { display:block; margin-top:12px; color:var(--dourado,#b89a63); font-family:var(--font-signature,"Brittany","Parisienne","Segoe Script",cursive); font-size:clamp(1.45rem,2.6vw,2rem); font-weight:400; font-style:normal; line-height:1.15; letter-spacing:0; }
            .cme-frase-dia cite::before { content:""; }
            .conteudo > .cme-frase-dia { margin-top:24px; }
            .portal-container > .cme-frase-dia { margin-top:0; margin-bottom:28px; }
            html[data-portal-theme="claro"] .cme-frase-dia { background:linear-gradient(120deg,rgba(184,154,99,.12),rgba(255,255,255,.88)); color:#17202a; box-shadow:0 16px 38px rgba(49,39,20,.08); }
            html[data-portal-theme="claro"] .cme-frase-dia__categoria { color:#66717b; }
            html[data-portal-theme="claro"] .cme-frase-dia cite { color:#9a7740; }
            @media (max-width:720px) { .cme-frase-dia { padding:21px 21px 20px 24px; } .cme-frase-dia__topo { align-items:flex-start; flex-direction:column; gap:8px; } .cme-frase-dia blockquote { font-size:1rem; line-height:1.58; } .cme-frase-dia cite { font-size:1.55rem; } .cme-frase-dia::before { right:8px; font-size:7rem; } }
        `;
        document.head.appendChild(style);
    }

    function chaveDataBrasil(data = new Date()) {
        const partes = new Intl.DateTimeFormat("en-CA", { timeZone:TIMEZONE, year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(data);
        const mapa = Object.fromEntries(partes.map(item => [item.type,item.value]));
        return `${mapa.year}-${mapa.month}-${mapa.day}`;
    }

    function indiceDoDia(chave,total) {
        const [ano,mes,dia] = chave.split("-").map(Number);
        const diasDesdeEpoch = Math.floor(Date.UTC(ano,mes-1,dia)/MS_DIA);
        return ((diasDesdeEpoch % total)+total)%total;
    }

    function normalizarFrase(item) {
        if (!item || !String(item.texto || "").trim()) return null;
        return {
            texto:String(item.texto).trim(),
            autor:String(item.autor || FALLBACK.autor).trim(),
            categoria:String(item.categoria || "Reflexão").trim(),
            fonte:item.fonte ? String(item.fonte).trim() : ""
        };
    }

    function montarAcervo(acervo) {
        if (Array.isArray(acervo?.frases)) return acervo.frases.map(normalizarFrase).filter(Boolean);
        const finais = Array.isArray(acervo?.finais) ? acervo.finais : [];
        const inicios = Array.isArray(acervo?.inicios) ? acervo.inicios : [];
        const categorias = Array.isArray(acervo?.categorias) ? acervo.categorias : [];
        const legado = [];
        inicios.forEach((inicio,i) => finais.forEach((final,j) => legado.push({ texto:`${inicio}; ${final}.`, autor:acervo.autor || FALLBACK.autor, categoria:categorias.length ? categorias[(i+j)%categorias.length] : "Reflexão", fonte:"" })));
        return legado;
    }

    async function carregarFrase() {
        try {
            const resposta = await fetch(ARQUIVO,{cache:"force-cache"});
            if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
            const acervo = montarAcervo(await resposta.json());
            if (!acervo.length) throw new Error("Acervo vazio");
            return acervo[indiceDoDia(chaveDataBrasil(),acervo.length)] || FALLBACK;
        } catch (erro) {
            console.warn("Frase do dia indisponível; usando frase de segurança.",erro);
            return FALLBACK;
        }
    }

    function criarCard() {
        if (document.getElementById("cmeFraseDoDia")) return document.getElementById("cmeFraseDoDia");
        const card=document.createElement("section");
        card.id="cmeFraseDoDia"; card.className="cme-frase-dia"; card.setAttribute("aria-label","Frase do dia");
        card.innerHTML=`<div class="cme-frase-dia__topo"><span class="cme-frase-dia__rotulo">Frase do dia</span><span class="cme-frase-dia__categoria" id="cmeFraseCategoria">Reflexão</span></div><blockquote id="cmeFraseTexto">Carregando reflexão do dia...</blockquote><cite id="cmeFraseAutor">Camila Martins</cite>`;
        return card;
    }

    function posicionarCard(card) {
        const portal=document.querySelector(".portal-container");
        if (portal) { portal.insertBefore(card,portal.firstElementChild||null); return true; }
        const topoAdmin=document.querySelector(".conteudo > .topbar");
        if (topoAdmin) { topoAdmin.insertAdjacentElement("afterend",card); return true; }
        return false;
    }

    async function iniciar() {
        instalarEstilos();
        const card=criarCard();
        if (!posicionarCard(card)) return;
        const frase=await carregarFrase();
        const texto=document.getElementById("cmeFraseTexto"), autor=document.getElementById("cmeFraseAutor"), categoria=document.getElementById("cmeFraseCategoria");
        if (texto) texto.textContent=frase.texto;
        if (autor) { autor.textContent=frase.autor; if (frase.fonte) autor.title=`Fonte: ${frase.fonte}`; }
        if (categoria) categoria.textContent=frase.categoria;
        card.dataset.dataFrase=chaveDataBrasil();
    }

    if (document.readyState==="loading") document.addEventListener("DOMContentLoaded",iniciar,{once:true}); else iniciar();
}());
