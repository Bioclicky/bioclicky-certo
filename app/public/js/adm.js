// adm.js - Pergunta "tem certeza?" antes de excluir alguma coisa no painel do ADM.
document.querySelectorAll("[data-confirmar]").forEach(function (botao) {
  botao.addEventListener("click", function (evento) {
    var pergunta = botao.dataset.confirmar;
    if (!confirm(pergunta)) {
      evento.preventDefault();
    }
  });
});
