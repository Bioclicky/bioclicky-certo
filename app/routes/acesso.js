// ============================================================
// acesso.js - Login, sessão e proteção de páginas (usuário e ADM).
// ============================================================
const { ler, salvar, buscarUsuario } = require("./dados");

// Bloqueia páginas que exigem login (e desloga quem teve a conta excluída)
function exigirLogin(req, res, next) {
  if (!req.session.usuario) return res.redirect("/login");
  if (!buscarUsuario(req)) return req.session.destroy(() => res.redirect("/login"));
  next();
}

// Bloqueia páginas que só o ADM pode ver
function exigirAdm(req, res, next) {
  if (!req.session.usuario) return res.redirect("/login");
  const u = buscarUsuario(req);
  if (!u || u.tipo !== "adm") {
    return res
      .status(403)
      .render("pages/erro", { titulo: "Acesso negado: só o ADM pode entrar aqui", pagina: "" });
  }
  next();
}

// Troca a sessão por uma nova ao entrar (evita "fixação de sessão") e vai para o destino
function iniciarSessao(req, res, next, usuario, destino) {
  req.session.regenerate((erro) => {
    if (erro) return next(erro);
    req.session.usuario = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      tipo: usuario.tipo || "usuario"
    };
    req.session.save((erroSalvar) => {
      if (erroSalvar) return next(erroSalvar);
      res.redirect(destino);
    });
  });
}

// Volta para a página de onde o usuário veio, mas só dentro do nosso site
function voltarPara(req, padrao) {
  try {
    const url = new URL(req.get("referer"));
    return url.pathname + url.search;
  } catch (e) {
    return padrao;
  }
}

// Dados do primeiro ADM (podem ser trocados aqui)
const ADMIN_EMAIL = "adm@bioclicky.com";
const ADMIN_SENHA = "admin123";

// Cria o primeiro ADM se ainda não existir nenhum.
function criarAdmDoAmbiente() {
  const usuarios = ler("usuarios.json");
  if (usuarios.some((u) => u.tipo === "adm")) return; // já existe um ADM

  usuarios.push({
    id: Date.now(),
    nome: "Administrador",
    email: ADMIN_EMAIL,
    senha: ADMIN_SENHA,
    tipo: "adm",
    favoritos: [],
    historico: []
  });
  salvar("usuarios.json", usuarios);
  console.log("ADM criado: " + ADMIN_EMAIL + "  senha: " + ADMIN_SENHA);
}

module.exports = { exigirLogin, exigirAdm, iniciarSessao, voltarPara, criarAdmDoAmbiente };
