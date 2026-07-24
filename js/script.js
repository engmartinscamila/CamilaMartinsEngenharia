/*
=====================================================
CAMILA MARTINS ENGENHARIA
SCRIPT.JS - Site público (index.html)
=====================================================
Menu mobile, header com fundo ao rolar a página, e
animação de entrada dos elementos ".reveal".
=====================================================
*/

document.addEventListener("DOMContentLoaded", () => {
    configurarMenuMobile();
    configurarHeaderScroll();
    configurarAnimacaoReveal();
});

function configurarMenuMobile() {
    const botao = document.querySelector(".menu-toggle");
    const links = document.querySelector(".nav-links");

    if (!botao || !links) return;

    botao.addEventListener("click", () => {
        const aberto = links.classList.toggle("open");
        botao.setAttribute("aria-expanded", aberto ? "true" : "false");
    });

    links.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => {
            links.classList.remove("open");
            botao.setAttribute("aria-expanded", "false");
        });
    });
}

function configurarHeaderScroll() {
    const header = document.querySelector(".site-header");
    if (!header) return;

    const atualizar = () => {
        header.classList.toggle("scrolled", window.scrollY > 10);
    };

    atualizar();
    window.addEventListener("scroll", atualizar, { passive: true });
}

function configurarAnimacaoReveal() {
    const elementos = document.querySelectorAll(".reveal");
    if (elementos.length === 0) return;

    if (!("IntersectionObserver" in window)) {
        elementos.forEach(el => el.classList.add("visible"));
        return;
    }

    const observer = new IntersectionObserver((entradas) => {
        entradas.forEach(entrada => {
            if (entrada.isIntersecting) {
                entrada.target.classList.add("visible");
                observer.unobserve(entrada.target);
            }
        });
    }, { threshold: 0.15 });

    elementos.forEach(el => observer.observe(el));
}
