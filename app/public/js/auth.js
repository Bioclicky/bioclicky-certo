// auth.js - Mostrar/ocultar senha nos formulários de login e cadastro.
document.querySelectorAll("[data-mostrar-senha]").forEach(function (caixa) {
  caixa.addEventListener("change", function () {
    caixa.dataset.mostrarSenha.split(",").forEach(function (id) {
      document.getElementById(id).type = caixa.checked ? "text" : "password";
    });
  });
});
