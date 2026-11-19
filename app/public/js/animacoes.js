// animacoes.js - Faz os elementos com a classe "revelar" aparecerem suavemente ao rolar a página.
(function () {
  var itens = document.querySelectorAll(".revelar");
  if (!("IntersectionObserver" in window)) {
    itens.forEach(function (el) { el.classList.add("visivel"); });
    return;
  }
  var observador = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add("visivel");
        observador.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  itens.forEach(function (el, i) {
    el.style.animationDelay = (i % 4) * 80 + "ms";
    observador.observe(el);
  });
})();
