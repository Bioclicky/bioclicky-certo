// ============================================================
// usuario.js - Área do usuário logado: dashboard, favoritos e histórico.
// ============================================================
const express = require("express");
const { checarId } = require("../validators/validacoes");
const { ler, salvar, menorOferta, buscarUsuario } = require("./dados");
const { exigirLogin, voltarPara } = require("./acesso");

const router = express.Router();

// DASHBOARD: favoritos e histórico de pesquisas.
router.get("/dashboard", exigirLogin, (req, res) => {
  const u = buscarUsuario(req);
  const favoritos = ler("remedios.json")
    .filter((r) => u.favoritos.includes(r.id))
    .map((r) => ({ ...r, menor: menorOferta(r) }));
  res.render("pages/dashboard", {
    titulo: "Minha conta",
    pagina: "dashboard",
    conta: u,
    favoritos,
    historico: u.historico
  });
});

// Altera um campo do usuário logado e grava no JSON
function alterarUsuario(req, alteracao) {
  const usuarios = ler("usuarios.json");
  alteracao(usuarios.find((x) => x.id === req.session.usuario.id));
  salvar("usuarios.json", usuarios);
}

// FAVORITAR: se já é favorito, remove; se não é, adiciona.
router.post("/favoritos/:id", checarId, exigirLogin, (req, res) => {
  const id = Number(req.params.id);
  alterarUsuario(req, (u) => {
    u.favoritos = u.favoritos.includes(id) ? u.favoritos.filter((f) => f !== id) : [...u.favoritos, id];
  });
  res.redirect(voltarPara(req, "/dashboard"));
});

// LIMPAR HISTÓRICO de pesquisas.
router.post("/historico/limpar", exigirLogin, (req, res) => {
  alterarUsuario(req, (u) => {
    u.historico = [];
  });
  res.redirect("/dashboard");
});

module.exports = router;
