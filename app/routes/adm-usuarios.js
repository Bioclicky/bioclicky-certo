// ============================================================
// adm-usuarios.js - ADM: gerenciar usuários (rotas /adm/usuarios).
// ============================================================
const express = require("express");
const { checarId } = require("../validators/validacoes");
const { ler, salvar, textoAviso } = require("./dados");

const router = express.Router();

// LISTA
router.get("/", (req, res) => {
  res.render("pages/adm-usuarios", {
    titulo: "Gerenciar usuários",
    pagina: "adm",
    usuarios: ler("usuarios.json"),
    aviso: textoAviso(req.query.aviso),
    erro: req.query.erro === "proprio" ? "Você não pode alterar ou excluir a sua própria conta aqui." : null
  });
});

// O ADM não pode mexer na própria conta
function naoEhEle(req, res, next) {
  if (Number(req.params.id) === req.session.usuario.id) {
    return res.redirect("/adm/usuarios?erro=proprio");
  }
  next();
}

// Alterna entre "usuario" e "adm"
router.post("/:id/tipo", checarId, naoEhEle, (req, res) => {
  const usuarios = ler("usuarios.json");
  const u = usuarios.find((x) => x.id === Number(req.params.id));
  if (u) {
    u.tipo = u.tipo === "adm" ? "usuario" : "adm";
    salvar("usuarios.json", usuarios);
  }
  res.redirect("/adm/usuarios?aviso=tipo");
});

// EXCLUIR
router.post("/:id/excluir", checarId, naoEhEle, (req, res) => {
  const id = Number(req.params.id);
  salvar("usuarios.json", ler("usuarios.json").filter((u) => u.id !== id));
  res.redirect("/adm/usuarios?aviso=excluido");
});

module.exports = router;
