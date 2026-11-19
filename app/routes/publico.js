// ============================================================
// publico.js - Páginas que qualquer visitante pode ver.
// ============================================================
const express = require("express");
const { checarId } = require("../validators/validacoes");
const {
  ler,
  salvar,
  normalizar,
  menorOferta,
  contarCategorias,
  farmaciasComTotal,
  buscarUsuario
} = require("./dados");

const router = express.Router();

// PÁGINA INICIAL: 3 remédios em destaque e as categorias.
router.get("/", (req, res) => {
  const todos = ler("remedios.json");
  const destaques = todos.slice(0, 3).map((r) => ({ ...r, menor: menorOferta(r) }));
  const categorias = contarCategorias(todos);
  res.render("pages/home", { titulo: "Início", pagina: "home", destaques, categorias });
});

// LISTA DE REMÉDIOS: busca (?q=), filtro de categoria e filtro de farmácia.
router.get("/remedios", (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 100);
  const categoria = String(req.query.categoria || "").trim().slice(0, 50);
  const farmacia = String(req.query.farmacia || "").trim().slice(0, 100);
  const todos = ler("remedios.json");
  let lista = todos;

  if (q) {
    const termo = normalizar(q);
    lista = lista.filter(
      (r) => normalizar(r.nome).includes(termo) || normalizar(r.laboratorio).includes(termo)
    );
  }
  if (categoria) lista = lista.filter((r) => r.categoria === categoria);
  if (farmacia) lista = lista.filter((r) => r.ofertas.some((o) => o.farmacia === farmacia));

  lista = lista.map((r) => ({ ...r, menor: menorOferta(r) }));

  // Se o usuário está logado, guarda a pesquisa no histórico (máximo 20)
  const usuario = buscarUsuario(req);
  if (q && usuario) {
    const usuarios = ler("usuarios.json");
    const u = usuarios.find((x) => x.id === usuario.id);
    u.historico = [q, ...u.historico.filter((h) => h !== q)].slice(0, 20);
    salvar("usuarios.json", usuarios);
  }

  res.render("pages/remedios", {
    titulo: "Remédios",
    pagina: "remedios",
    remedios: lista,
    categorias: [...new Set(todos.map((r) => r.categoria))],
    q,
    categoria,
    farmacia,
    favoritos: usuario ? usuario.favoritos : []
  });
});

// COMPARAÇÃO DE PREÇOS: ofertas de um remédio, da mais barata para a mais cara.
router.get("/remedios/:id", checarId, (req, res) => {
  const remedio = ler("remedios.json").find((r) => r.id === Number(req.params.id));
  if (!remedio) {
    return res.status(404).render("pages/erro", { titulo: "Medicamento não encontrado", pagina: "" });
  }
  const ofertas = [...remedio.ofertas].sort((a, b) => a.preco - b.preco);
  res.render("pages/comparar", { titulo: remedio.nome, pagina: "remedios", remedio, ofertas });
});

// LISTA DE FARMÁCIAS: com busca pelo nome.
router.get("/farmacias", (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 100);
  let farmacias = ler("farmacias.json");
  if (q) farmacias = farmacias.filter((f) => normalizar(f.nome).includes(normalizar(q)));
  farmacias = farmaciasComTotal(farmacias, ler("remedios.json"));
  res.render("pages/farmacias", { titulo: "Farmácias", pagina: "farmacias", farmacias, q });
});

// CATEGORIAS: quantos remédios existem em cada uma.
router.get("/categorias", (req, res) => {
  const categorias = contarCategorias(ler("remedios.json"));
  res.render("pages/categorias", { titulo: "Categorias", pagina: "categorias", categorias });
});

router.get("/sobre", (req, res) => {
  res.render("pages/sobre", { titulo: "Sobre", pagina: "sobre" });
});

module.exports = router;
