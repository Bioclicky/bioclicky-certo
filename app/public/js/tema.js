// tema.js - Tema claro/escuro. Uma única lógica para o site inteiro.
// A escolha fica salva no localStorage com a chave "bioclicky-tema".
(function () {
  document.documentElement.classList.add("js");
  var CHAVE = "bioclicky-tema";

  function temaSalvo() {
    try {
      return localStorage.getItem(CHAVE);
    } catch (e) {
      return null;
    }
  }

  function aplicar(tema) {
    document.documentElement.setAttribute("data-tema", tema);
    // Mantém o botão acessível: informa se o modo escuro está ligado
    var botao = document.getElementById("temaBotao");
    if (botao) {
      botao.setAttribute("aria-pressed", tema === "escuro" ? "true" : "false");
    }
  }

  // Se não há escolha salva, usa a preferência do sistema
  var inicial = temaSalvo() || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro");
  aplicar(inicial);

  document.addEventListener("DOMContentLoaded", function () {
    var botao = document.getElementById("temaBotao");
    if (!botao) return;
    aplicar(document.documentElement.getAttribute("data-tema"));
    botao.addEventListener("click", function () {
      var novo = document.documentElement.getAttribute("data-tema") === "escuro" ? "claro" : "escuro";
      aplicar(novo);
      try {
        localStorage.setItem(CHAVE, novo);
      } catch (e) {}
    });
  });
})();
