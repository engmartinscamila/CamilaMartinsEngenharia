(function () {
    "use strict";
    const catalogo = {
        arquitetonico: ["Projeto arquitetônico", [["Briefing e levantamento",10],["Estudo preliminar",20],["Anteprojeto",25],["Aprovação do cliente",10],["Detalhamento",25],["Entrega final",10]]],
        executivo: ["Projeto executivo", [["Conferência do escopo",10],["Compatibilização",20],["Detalhamento técnico",40],["Especificações",15],["Revisão e entrega",15]]],
        eletrico: ["Projeto elétrico", [["Levantamento de cargas",15],["Pontos e circuitos",25],["Dimensionamento",25],["Diagramas e detalhes",20],["Revisão e entrega",15]]],
        hidrossanitario: ["Projeto hidrossanitário", [["Levantamento",15],["Lançamento das redes",25],["Dimensionamento",25],["Detalhamento",20],["Revisão e entrega",15]]],
        render_3d: ["Renderização 3D", [["Briefing e referências",10],["Modelagem",35],["Materiais e iluminação",25],["Prévia e ajustes",20],["Entrega",10]]],
        regularizacao: ["Regularização, alvará ou Habite-se", [["Documentos",15],["Levantamento",15],["Projeto e adequações",25],["Protocolo",15],["Exigências",20],["Aprovação",10]]],
        incendio: ["Projeto de combate a incêndio", [["Levantamento",10],["Medidas de segurança",15],["Desenvolvimento",30],["Memoriais",20],["Protocolo e aprovação",25]]],
        industrial: ["Projeto industrial", [["Escopo técnico",10],["Concepção",15],["Desenvolvimento",25],["Detalhamento",30],["Revisão e entrega",20]]],
        consultoria: ["Consultoria técnica", [["Diagnóstico",25],["Análise técnica",30],["Recomendações",25],["Relatório e entrega",20]]],
        laudo: ["Laudo técnico", [["Documentos",10],["Vistoria",25],["Análise",25],["Elaboração",25],["ART e entrega",15]]],
        gestao_obra: ["Gestão de obra", [["Planejamento",5],["Fundações e estrutura",25],["Vedações e cobertura",20],["Instalações",20],["Revestimentos",15],["Acabamentos",10],["Entrega",5]]],
        reforma: ["Projeto de reforma", [["Levantamento",15],["Estudo de soluções",20],["Anteprojeto",20],["Detalhamento",25],["Compatibilização",10],["Entrega",10]]],
        outro: ["Outro serviço", [["Definição do escopo",20],["Desenvolvimento",50],["Revisão",15],["Entrega",15]]]
    };
    const pct = etapa => {
        if (etapa?.percentual_conclusao !== null && etapa?.percentual_conclusao !== undefined)
            return Math.max(0, Math.min(100, Number(etapa.percentual_conclusao) || 0));
        const status = String(etapa?.status || "").toLowerCase();
        return status.startsWith("conclu") ? 100 : status.includes("andamento") ? 50 : 0;
    };
    window.cmNomeServico = tipo => (catalogo[tipo] || catalogo.outro)[0];
    window.cmEtapasDoServico = tipo => (catalogo[tipo] || catalogo.outro)[1].map(([nome,peso],i) => ({
        nome, peso_percentual:peso, percentual_conclusao:0, status:"Pendente", ordem:i+1
    }));
    window.cmPercentualEtapa = pct;
    window.cmCalcularProgresso = etapas => {
        if (!etapas?.length) return 0;
        const peso = etapas.reduce((t,e) => t + (Number(e.peso_percentual)||0), 0);
        return Math.round(peso
            ? etapas.reduce((t,e) => t + (Number(e.peso_percentual)||0)*pct(e),0)/peso
            : etapas.reduce((t,e) => t+pct(e),0)/etapas.length);
    };
    window.cmRotuloContrato = projeto =>
        `${projeto?.nome || window.cmNomeServico(projeto?.tipo)} — contrato ${projeto?.numero_contrato || "não informado"} — cad. ${String(projeto?.id || "").slice(0,8).toUpperCase()}`;
})();
