import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";

const FONTE_SHA = "49a7da15a265eb319b3c3d0514ff35be107e5342";
const FONTE_URL = `https://raw.githubusercontent.com/luiz-lp/frase-do-dia/${FONTE_SHA}/data/quotes.json`;
const SAIDA = "assets/frases-do-dia.json";
const TOTAL_EXTERNAS = 800;
const TOTAL_CAMILA = 200;

const INICIOS_CAMILA = [
  "Grandes resultados nascem da constância",
  "A clareza transforma esforço em direção",
  "O progresso começa com uma decisão consciente",
  "A disciplina sustenta aquilo que a motivação inicia",
  "Conhecimento ganha valor quando se transforma em ação",
  "A excelência cresce nos detalhes bem cuidados",
  "Boas decisões nascem de perguntas bem formuladas",
  "A paciência também é uma forma de inteligência",
  "Coragem é seguir adiante com consciência",
  "Todo projeto sólido começa por uma boa base",
  "A criatividade floresce quando há espaço para observar",
  "Planejamento reduz ruído e amplia possibilidades",
  "Quem aprende continuamente amplia o próprio horizonte",
  "Consistência é o elo entre intenção e resultado",
  "A simplicidade é sinal de compreensão profunda",
  "Um passo bem dado vale mais que dez impulsivos",
  "Resultados duradouros respeitam processos",
  "A atenção dedicada ao presente melhora o futuro",
  "Aprender a priorizar é aprender a avançar",
  "O tempo revela o valor daquilo que foi bem construído",
  "Curiosidade abre caminhos que a pressa não percebe",
  "Persistência transforma dificuldade em experiência",
  "Responsabilidade dá forma concreta aos objetivos",
  "A qualidade de uma escolha começa na qualidade da análise",
  "Organização cria espaço para pensar melhor",
  "Uma mente aberta encontra soluções onde outros veem limites",
  "Melhorar um pouco todos os dias produz grandes mudanças",
  "Autonomia cresce junto com o conhecimento",
  "Foco é a arte de proteger o que importa",
  "Boas ideias precisam de método para ganhar forma",
  "A evolução acontece quando conforto deixa de ser prioridade",
  "Sabedoria também está em reconhecer o que ainda falta aprender",
  "Cada desafio contém informação útil para o próximo passo",
  "Confiabilidade é construída por pequenas entregas repetidas",
  "Visão de longo prazo melhora as decisões de hoje",
  "Uma meta clara transforma esforço disperso em movimento",
  "A maturidade aparece na forma como lidamos com imprevistos",
  "Pensar antes de agir economiza tempo depois",
  "A boa execução começa com entendimento",
  "Quem observa com atenção enxerga oportunidades antes dos outros"
];

const FINAIS_CAMILA = [
  "quando cada passo tem propósito.",
  "porque pequenas escolhas coerentes constroem trajetórias duradouras.",
  "quando conhecimento, método e presença caminham juntos.",
  "porque consistência transforma intenção em resultado.",
  "quando a qualidade do caminho importa tanto quanto a chegada."
];

const AUTORES_PRIORITARIOS = new Set([
  "Albert Einstein","Aristóteles","Platão","Sócrates","William Shakespeare","Clarice Lispector",
  "Leonardo da Vinci","Isaac Newton","Marie Curie","Thomas A. Edison","Thomas Edison","Nikola Tesla",
  "Confúcio","Sêneca","Seneca","Marco Aurélio","Marcus Aurelius","Epicteto","Epictetus",
  "Arthur Conan Doyle","Mark Twain","Oscar Wilde","Jane Austen","Charles Dickens","Victor Hugo",
  "Miguel de Cervantes","Fernando Pessoa","Machado de Assis","Carlos Drummond de Andrade",
  "Cecília Meireles","Cecilia Meireles","Emily Dickinson","Ralph Waldo Emerson","Henry David Thoreau",
  "Louisa May Alcott","Charlotte Brontë","Charlotte Bronte","George Eliot","Robert Louis Stevenson",
  "Jules Verne","Lewis Carroll","Edgar Allan Poe","Hans Christian Andersen","Esopo","Aesop",
  "Amelia Earhart","Florence Nightingale","Helen Keller","Isaac Asimov","Carl Sagan","Stephen Hawking",
  "Richard Feynman","Galileu Galilei","Galileo Galilei","Johannes Kepler","Blaise Pascal",
  "René Descartes","Rene Descartes","Immanuel Kant","David Hume","John Locke","Francis Bacon",
  "Michel de Montaigne","Voltaire","Alexandre Dumas","Fyodor Dostoevsky","Fiódor Dostoiévski",
  "Anton Chekhov","Jorge Luis Borges","Italo Calvino","Umberto Eco","Antoine de Saint-Exupéry",
  "Virginia Woolf","Agatha Christie","George Orwell","T. S. Eliot","Rainer Maria Rilke",
  "Johann Wolfgang von Goethe","Friedrich Schiller","Homer","Homero","Virgílio","Virgil",
  "Dante Alighieri","Anne Frank","Eleanor Roosevelt","Maya Angelou","Simone de Beauvoir",
  "Abraham Maslow","Carl Jung","Viktor Frankl","Alfred Adler","Daniel Kahneman","Peter Drucker",
  "David Allen","Richard Restak","Samuel Beckett","Anatole France","André Gide","Andre Gide",
  "Alfred North Whitehead","Alfred Whitehead","Anaïs Nin","Anais Nin","Rudyard Kipling",
  "Katherine Mansfield","Joseph Conrad","Daniel Defoe","Herman Melville","Mary Shelley"
].map(normalizar));

const AUTORES_BLOQUEADOS = [
  "jesus","cristo","buda","buddha","dalai lama","sao francisco","são francisco","papa ","pope ",
  "mahatma gandhi","gandhi","theodore roosevelt","franklin roosevelt","eleanor roosevelt","abraham lincoln",
  "winston churchill","nelson mandela","martin luther king","mao ","mao tse","lenin","stalin","karl marx",
  "friedrich engels","che guevara","fidel castro","vladimir putin","donald trump","joe biden","barack obama",
  "margaret thatcher","ronald reagan","john f kennedy","john kennedy","noam chomsky","jean-paul sartre",
  "pablo neruda","frida kahlo","pablo picasso","bertolt brecht","george bernard shaw","h.g. wells","h. g. wells",
  "john lennon","bob marley","charles chaplin","ayn rand","malcolm x","desmond tutu"
];

const TERMOS_BLOQUEADOS = [
  "deus","senhor ","jesus","cristo","bíblia","biblia","igreja","oração","oracao","pecado","sagrado",
  "religião","religiao","fé ","fe ","paraíso","paraiso","inferno","salvação","salvacao","espírito santo",
  "política","politica","eleição","eleicao","partido","presidente","governo","governante","comunismo",
  "comunista","socialismo","socialista","capitalismo","capitalista","esquerda","direita política","revolução",
  "revolucao","ditadura","parlamento","congresso","senado","guerra civil","nação contra","nacao contra"
];

function normalizar(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hash(valor) {
  return createHash("sha256").update(valor, "utf8").digest("hex");
}

function categoria(texto) {
  const t = normalizar(texto);
  if (/criativ|imagina|ideia|invent|arte/.test(t)) return "Criatividade";
  if (/conhec|aprend|sabed|intelig|mente|pens|estud|curios/.test(t)) return "Conhecimento";
  if (/corag|medo|ousad|risco/.test(t)) return "Coragem";
  if (/persist|constan|discipl|habito|hábito|esfor|trabalh|tent/.test(t)) return "Persistência";
  if (/tempo|pacien|espera/.test(t)) return "Paciência";
  if (/verdad|clarez|duvid|pergunta|compreend/.test(t)) return "Clareza";
  if (/excel|qualidade|melhor|valor/.test(t)) return "Excelência";
  if (/planej|objetiv|meta|direç|direc|prior/.test(t)) return "Planejamento";
  if (/mud|cres|evolu|progres|futuro/.test(t)) return "Crescimento";
  return "Reflexão";
}

function fraseValida(item) {
  const autor = String(item?.author || "").trim();
  const texto = String(item?.quote || "").trim();
  if (!autor || !texto || texto.length < 25 || texto.length > 220) return false;
  const a = normalizar(autor);
  const t = normalizar(texto);
  if (AUTORES_BLOQUEADOS.some(x => a.includes(normalizar(x)))) return false;
  if (TERMOS_BLOQUEADOS.some(x => t.includes(normalizar(x)))) return false;
  if (/\b(presidente|primeiro-ministro|ministro|senador|deputado|rei|rainha|imperador|papa)\b/.test(a)) return false;
  return true;
}

function frasesCamila() {
  const saida = [];
  for (const inicio of INICIOS_CAMILA) {
    for (const final of FINAIS_CAMILA) {
      saida.push({
        texto: `${inicio}, ${final}`,
        autor: "Camila Martins",
        categoria: categoria(`${inicio} ${final}`),
        fonte: "Autoral"
      });
    }
  }
  if (saida.length !== TOTAL_CAMILA) throw new Error(`Esperadas ${TOTAL_CAMILA} frases autorais, obtidas ${saida.length}`);
  return saida;
}

function selecionarExternas(base) {
  const unicas = new Map();
  for (const item of base) {
    if (!fraseValida(item)) continue;
    const texto = String(item.quote).replace(/\s+/g, " ").trim();
    const autor = String(item.author).replace(/\s+/g, " ").trim();
    const chave = normalizar(texto);
    if (!unicas.has(chave)) unicas.set(chave, { ...item, texto, autor });
  }

  const grupos = new Map();
  for (const item of unicas.values()) {
    const chaveAutor = normalizar(item.autor);
    if (!grupos.has(chaveAutor)) grupos.set(chaveAutor, []);
    grupos.get(chaveAutor).push(item);
  }
  for (const itens of grupos.values()) itens.sort((a,b) => hash(`${a.autor}|${a.texto}`).localeCompare(hash(`${b.autor}|${b.texto}`)));

  const autores = [...grupos.keys()].sort((a,b) => {
    const pa = AUTORES_PRIORITARIOS.has(a) ? 0 : 1;
    const pb = AUTORES_PRIORITARIOS.has(b) ? 0 : 1;
    return pa - pb || a.localeCompare(b,"pt-BR");
  });

  const escolhidas = [];
  const vistos = new Set();
  for (const limite of [6,10,15,24,40,80]) {
    for (const autor of autores) {
      const itens = grupos.get(autor) || [];
      const jaAutor = escolhidas.filter(x => normalizar(x.autor) === autor).length;
      for (let i = jaAutor; i < Math.min(limite, itens.length) && escolhidas.length < TOTAL_EXTERNAS; i++) {
        const item = itens[i];
        const k = `${normalizar(item.autor)}|${normalizar(item.texto)}`;
        if (vistos.has(k)) continue;
        vistos.add(k);
        escolhidas.push(item);
      }
      if (escolhidas.length >= TOTAL_EXTERNAS) break;
    }
    if (escolhidas.length >= TOTAL_EXTERNAS) break;
  }

  if (escolhidas.length < TOTAL_EXTERNAS) {
    throw new Error(`A filtragem conservadora encontrou apenas ${escolhidas.length} citações; são necessárias ${TOTAL_EXTERNAS}.`);
  }

  return escolhidas.slice(0, TOTAL_EXTERNAS).map(item => ({
    texto: item.texto,
    autor: item.autor,
    categoria: categoria(item.texto),
    fonte: item.source && item.source !== "local"
      ? String(item.source)
      : `Base PT-BR fixada: luiz-lp/frase-do-dia@${FONTE_SHA}`,
    origem: "citação"
  }));
}

function intercalar(camila, externas) {
  const saida = [];
  for (let i = 0; i < TOTAL_CAMILA; i++) {
    saida.push(camila[i]);
    const base = i * 4;
    saida.push(...externas.slice(base, base + 4));
  }
  return saida;
}

const resposta = await fetch(FONTE_URL, { headers: { "user-agent": "CamilaMartinsEngenharia-build" } });
if (!resposta.ok) throw new Error(`Falha ao carregar base externa: HTTP ${resposta.status}`);
const base = await resposta.json();
if (!Array.isArray(base)) throw new Error("Formato inesperado da base externa.");

const camila = frasesCamila();
const externas = selecionarExternas(base);
const frases = intercalar(camila, externas);
if (frases.length !== 1000) throw new Error(`Acervo final inválido: ${frases.length} frases.`);
if (new Set(frases.map(x => normalizar(x.texto))).size !== 1000) throw new Error("Há frases duplicadas no acervo final.");

const autoresExternos = new Set(externas.map(x => x.autor)).size;
const payload = {
  versao: 3,
  timezone: "America/Sao_Paulo",
  total: 1000,
  composicao: { autoraisCamilaMartins: 200, citacoesAutores: 800, autoresExternos },
  politicaEditorial: "Sem conteúdo político-partidário ou religioso; filtro conservador de autores e termos; citações externas em português provenientes de base pública fixada por commit.",
  fonteBaseExterna: { repositorio: "luiz-lp/frase-do-dia", commit: FONTE_SHA, arquivo: "data/quotes.json" },
  frases
};

await writeFile(SAIDA, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Acervo gerado: ${frases.length} frases (${camila.length} Camila Martins + ${externas.length} externas; ${autoresExternos} autores externos).`);
