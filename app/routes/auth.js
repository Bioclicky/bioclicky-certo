// ============================================================
// auth.js - Cadastro, login e logout.
// ============================================================
const express = require("express");
const { validarCadastro, validarLogin, errosDoFormulario } = require("../validators/validacoes");
const { ler, salvar } = require("./dados");
const { iniciarSessao } = require("./acesso");

const router = express.Router();

// ---------- Cadastro ----------
router.get("/cadastro", (req, res) => {
  res.render("pages/cadastro", { titulo: "Cadastro", pagina: "cadastro", erro: null, valores: {} });
});

// validarCadastro (express-validator) confere os campos antes da função abaixo
router.post("/cadastro", validarCadastro, (req, res, next) => {
  const { nome, email, senha } = req.body;

  // Mostra o formulário de novo, com as mensagens de erro e o que a pessoa já digitou
  const mostrarErros = (erros) =>
    res.status(400).render("pages/cadastro", {
      titulo: "Cadastro",
      pagina: "cadastro",
      erro: "Corrija os campos indicados abaixo.",
      erros,
      valores: { nome, email }
    });

  // 1) O express-validator achou erro? Mostra o formulário de novo e PARA (nada é salvo)
  const erros = errosDoFormulario(req);
  if (erros) return mostrarErros(erros);

  // 2) E-mail já usado por outra conta?
  const usuarios = ler("usuarios.json");
  if (usuarios.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return mostrarErros({ email: "Este e-mail já está cadastrado." });
  }

  // 3) Tudo certo: guarda o usuário (senha em texto simples) e já faz o login
  const novo = {
    id: Date.now(),
    nome: nome,
    email: email,
    senha: senha,
    tipo: "usuario",
    favoritos: [],
    historico: []
  };
  usuarios.push(novo);
  salvar("usuarios.json", usuarios);
  iniciarSessao(req, res, next, novo, "/dashboard");
});

// ---------- Login / Logout ----------
router.get("/login", (req, res) => {
  res.render("pages/login", { titulo: "Entrar", pagina: "login", erro: null, valores: {} });
});

router.post("/login", validarLogin, (req, res, next) => {
  const { email, senha } = req.body;

  const erros = errosDoFormulario(req);
  if (erros) {
    return res.status(400).render("pages/login", {
      titulo: "Entrar",
      pagina: "login",
      erro: "Corrija os campos indicados abaixo.",
      erros,
      valores: { email }
    });
  }

  const usuario = ler("usuarios.json").find((u) => u.email === email);

  // A mesma mensagem para "e-mail não existe" e "senha errada" (não revela quais e-mails têm conta)
  if (!usuario || usuario.senha !== senha) {
    return res.status(401).render("pages/login", {
      titulo: "Entrar",
      pagina: "login",
      erro: "E-mail ou senha incorretos.",
      valores: { email }
    });
  }
  // ADM vai direto para o painel dele
  iniciarSessao(req, res, next, usuario, usuario.tipo === "adm" ? "/adm" : "/dashboard");
});

// SAIR: apaga a sessão e o cookie.
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("bioclicky.sid");
    res.redirect("/");
  });
});

module.exports = router;
