// ============================================================
// router.js - Rotas do site (o app.js usa este arquivo em "/"). Cada assunto fica em um arquivo:
//   publico.js  -> início, remédios, farmácias, categorias, sobre
//   auth.js     -> cadastro, login, logout
//   usuario.js  -> dashboard, favoritos, histórico
// As rotas do ADM ficam em router-adm.js (+ adm-remedios, adm-farmacias, adm-usuarios).
// Apoio: dados.js (ler/gravar JSON e cálculos) e acesso.js (sessão e permissões).
// ============================================================
const express = require("express");
const { criarAdmDoAmbiente } = require("./acesso");

const router = express.Router();

criarAdmDoAmbiente(); // garante que existe pelo menos um ADM

router.use("/", require("./publico"));
router.use("/", require("./auth"));
router.use("/", require("./usuario"));

module.exports = router;
