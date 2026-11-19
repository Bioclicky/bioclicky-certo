// ============================================================
// acessibilidade.js - Recursos de acessibilidade do site inteiro.
// As escolhas ficam salvas no localStorage (chave "bioclicky-acess")
// e valem em todas as páginas, igual ao tema claro/escuro.
// ============================================================
(function () {
  var CHAVE = "bioclicky-acess";
  var raiz = document.documentElement;
  var PASSOS_FONTE = [85, 100, 115, 130, 150, 175];

  // Cada recurso liga/desliga uma classe no <html>. O CSS (acessibilidade.css) faz o resto.
  var RECURSOS = {
    contraste: "acess-contraste",
    links: "acess-links",
    dislexia: "acess-dislexia",
    espacamento: "acess-espacamento",
    cursor: "acess-cursor",
    animacoes: "acess-sem-animacao"
  };

  var padrao = { fonte: 100, contraste: false, links: false, dislexia: false, espacamento: false, cursor: false, animacoes: false, libras: false };
  var prefs = carregar();

  // ---------- Salvar / carregar ----------
  function carregar() {
    try {
      var salvo = JSON.parse(localStorage.getItem(CHAVE));
      return Object.assign({}, padrao, salvo || {});
    } catch (e) {
      return Object.assign({}, padrao);
    }
  }

  function salvar() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(prefs));
    } catch (e) {}
  }

  // ---------- Aplicar no <html> (roda já no head, antes da página aparecer) ----------
  function aplicar() {
    raiz.style.fontSize = prefs.fonte + "%";
    Object.keys(RECURSOS).forEach(function (nome) {
      raiz.classList.toggle(RECURSOS[nome], !!prefs[nome]);
    });
  }
  aplicar();

  // ---------- Resto só roda quando o HTML já carregou ----------
  document.addEventListener("DOMContentLoaded", function () {
    var painel = document.getElementById("painelAcess");
    var botaoAbrir = document.getElementById("acessBotao");
    var status = document.getElementById("acessStatus");
    var valorFonte = document.getElementById("acessFonteValor");
    var botaoLer = document.getElementById("acessLer");
    if (!painel || !botaoAbrir) return;

    function avisar(texto) {
      if (status) status.textContent = texto;
    }

    // Atualiza aria-pressed dos botões e o valor da fonte
    function sincronizar() {
      painel.querySelectorAll("[data-acess]").forEach(function (b) {
        b.setAttribute("aria-pressed", prefs[b.dataset.acess] ? "true" : "false");
      });
      if (valorFonte) valorFonte.textContent = prefs.fonte + "%";
    }

    function mudar(nome, ligado) {
      prefs[nome] = ligado;
      salvar();
      aplicar();
      sincronizar();
      if (nome === "libras") {
        alternarLibras(ligado);
      }
    }

    function alternar(nome) {
      mudar(nome, !prefs[nome]);
      avisar((nome === "contraste" ? "Alto contraste" : nome) + (prefs[nome] ? " ativado" : " desativado"));
    }

    // ---------- Abrir / fechar painel ----------
    function abrirPainel() {
      sincronizar();
      if (!painel.open) painel.showModal();
    }
    botaoAbrir.addEventListener("click", abrirPainel);

    // Clicar no fundo escurecido fecha o painel
    painel.addEventListener("click", function (e) {
      if (e.target === painel) painel.close();
    });

    // ---------- Botões de liga/desliga ----------
    painel.querySelectorAll("[data-acess]").forEach(function (b) {
      b.addEventListener("click", function () {
        alternar(b.dataset.acess);
      });
    });

    // ---------- Tamanho da fonte ----------
    function mudarFonte(direcao) {
      var i = PASSOS_FONTE.indexOf(prefs.fonte);
      if (i === -1) i = 1;
      var novo = PASSOS_FONTE[Math.max(0, Math.min(PASSOS_FONTE.length - 1, i + direcao))];
      prefs.fonte = novo;
      salvar();
      aplicar();
      sincronizar();
      avisar("Tamanho do texto " + novo + " por cento");
    }
    painel.querySelectorAll("[data-acess-fonte]").forEach(function (b) {
      b.addEventListener("click", function () {
        mudarFonte(b.dataset.acessFonte === "mais" ? 1 : -1);
      });
    });

    // ---------- Restaurar ----------
    document.getElementById("acessReset").addEventListener("click", function () {
      pararLeitura();
      alternarLibras(false);
      prefs = Object.assign({}, padrao);
      salvar();
      aplicar();
      sincronizar();
      avisar("Configurações de acessibilidade restauradas");
    });

    // ---------- Libras (VLibras - widget oficial do Governo Federal) ----------
    // O VLibras exige uma estrutura própria de elementos. Ela é criada por JavaScript,
    // por isso não aparece no HTML/EJS do projeto.
    function alternarLibras(ligado) {
      var existente = document.getElementById("vlibras-raiz");
      if (existente) {
        existente.style.display = ligado ? "" : "none";
        return;
      }
      if (!ligado) return;

      var caixa = document.createElement("div");
      caixa.id = "vlibras-raiz";
      caixa.setAttribute("vw", "");
      caixa.className = "enabled";
      caixa.innerHTML =
        '<div vw-access-button class="active"></div>' +
        '<div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div>';
      document.body.appendChild(caixa);

      var script = document.createElement("script");
      script.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
      script.onload = function () {
        new window.VLibras.Widget("https://vlibras.gov.br/app");
        avisar("VLibras carregado. Use o botão azul de Libras na lateral da tela.");
      };
      script.onerror = function () {
        avisar("Não foi possível carregar o VLibras. Verifique a conexão com a internet.");
      };
      document.body.appendChild(script);
    }
    if (prefs.libras) alternarLibras(true);

    // ---------- Leitor de texto (Web Speech API do navegador) ----------
    var lendo = false;

    function pararLeitura() {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      lendo = false;
      if (botaoLer) botaoLer.setAttribute("aria-pressed", "false");
    }

    function lerPagina() {
      if (!("speechSynthesis" in window)) {
        avisar("Seu navegador não suporta leitura em voz alta.");
        return;
      }
      if (lendo) {
        pararLeitura();
        avisar("Leitura interrompida");
        return;
      }
      // Se houver texto selecionado, lê só ele; senão, lê o conteúdo principal
      var selecao = String(window.getSelection() || "").trim();
      var texto = selecao || document.getElementById("conteudo").innerText;
      // Divide em pedaços, pois alguns navegadores cortam falas muito longas
      var pedacos = texto.match(/[^.!?\n]+[.!?\n]*/g) || [texto];
      var fila = [];
      var atual = "";
      pedacos.forEach(function (p) {
        if ((atual + p).length > 220) {
          fila.push(atual);
          atual = p;
        } else {
          atual += p;
        }
      });
      if (atual.trim()) fila.push(atual);

      window.speechSynthesis.cancel();
      lendo = true;
      botaoLer.setAttribute("aria-pressed", "true");
      fila.forEach(function (parte, i) {
        var fala = new SpeechSynthesisUtterance(parte);
        fala.lang = "pt-BR";
        if (i === fila.length - 1) {
          fala.onend = function () {
            lendo = false;
            botaoLer.setAttribute("aria-pressed", "false");
          };
        }
        window.speechSynthesis.speak(fala);
      });
    }
    if (botaoLer) botaoLer.addEventListener("click", lerPagina);

    // ---------- Atalhos de teclado ----------
    document.addEventListener("keydown", function (e) {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      var tecla = e.key.toLowerCase();
      if (tecla === "a") {
        e.preventDefault();
        abrirPainel();
      } else if (tecla === "c") {
        e.preventDefault();
        alternar("contraste");
      } else if (tecla === "l") {
        e.preventDefault();
        lerPagina();
      } else if (tecla === "1") {
        e.preventDefault();
        document.getElementById("conteudo").focus();
      }
    });

    sincronizar();
  });
})();
