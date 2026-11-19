// ============================================================
// app.js - Arquivo principal. Configura o Express e inicia o servidor.
// ============================================================

// Lê o arquivo .env (se existir) e coloca as variáveis em process.env.
// Em hospedagens (Render, Railway...) as variáveis são configuradas no painel do site,
// então não existe .env e esse trecho simplesmente não faz nada.
try {
  process.loadEnvFile();
} catch (e) {
  // sem arquivo .env: tudo bem
}

const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const path = require("path");
const router = require("./app/routes/router");

const app = express();
const PORTA = process.env.PORT || 3000;
const EM_PRODUCAO = process.env.NODE_ENV === "production";

// Segredo da sessão: vem do .env. Nunca fica escrito no código.
let segredoSessao = process.env.SESSION_SECRET;
if (!segredoSessao) {
  if (EM_PRODUCAO) {
    console.error("ERRO: defina a variável SESSION_SECRET antes de publicar o site.");
    process.exit(1);
  }
  // Só para desenvolvimento: segredo aleatório (o login some quando o servidor reinicia)
  segredoSessao = crypto.randomBytes(32).toString("hex");
  console.warn("AVISO: SESSION_SECRET não definido; usando um segredo temporário (só para desenvolvimento).");
}

// Atrás do proxy da hospedagem (HTTPS), o Express precisa confiar nele para o cookie "secure" funcionar
if (EM_PRODUCAO) {
  app.set("trust proxy", 1);
}

// Motor de templates EJS e pasta das views
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "app", "views"));
app.disable("x-powered-by"); // não conta para todo mundo que usamos Express

// Cabeçalhos simples de segurança
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Arquivos estáticos (css, js, imagens) servidos a partir de app/public
app.use(express.static(path.join(__dirname, "app", "public")));

// Lê dados de formulários (login, cadastro, administração)
app.use(express.urlencoded({ extended: true, limit: "50kb" }));

// Sessão: guarda quem está logado
app.use(
  session({
    name: "bioclicky.sid",
    secret: segredoSessao,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // JavaScript da página não consegue ler o cookie (protege contra XSS)
      sameSite: "lax", // o cookie não vai em POST vindo de outros sites (protege contra CSRF)
      secure: "auto", // só HTTPS quando o site está em HTTPS
      maxAge: 1000 * 60 * 60 * 2 // 2 horas
    }
  })
);

// Deixa o usuário logado e a lista de erros de formulário disponíveis em todos os EJS
app.use((req, res, next) => {
  res.locals.usuario = req.session.usuario || null;
  res.locals.erros = {}; // erros por campo; as rotas com formulário trocam por erros reais
  next();
});

app.use("/", router);

// Página 404
app.use((req, res) => {
  res.status(404).render("pages/erro", { titulo: "Página não encontrada", pagina: "" });
});

// Erros inesperados: o detalhe vai só para o terminal, nunca para o visitante
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) {
    return next(err);
  }
  res
    .status(500)
    .render("pages/erro", { titulo: "Algo deu errado. Tente novamente em instantes.", pagina: "" });
});

app.listen(PORTA, () => {
  console.log("BioClicky rodando na porta " + PORTA);
});
