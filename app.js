const express = require("express");
const session = require("express-session");
const app = express();
const porta = process.env.PORT || 3000; // 3000 no computador; o Render define a PORT sozinho

//indicação de pasta de arquivos estáticos - css, js, img
app.use(express.static("./app/public"));

//configurar o ejs como mecanismo de renderização
app.set("view engine", "ejs");
//configurar a pasta das views - html->ejs
app.set("views", "./app/views");

//SEMPRE ANTES DA REQUISIÇÃO DAS ROTAS
//configurar o payload para formato JSON (API)
app.use(express.json());
//configurar o payload para formato URLencoded - (form html -> array, objeto, json)
app.use(express.urlencoded({ extended: true }));

//sessão: guarda quem está logado (login, favoritos e área do ADM dependem disso)
app.use(
  session({
    name: "bioclicky.sid",
    secret: "bioclicky-segredo-do-tcc",
    resave: false,
    saveUninitialized: false
  })
);

//deixa o usuário logado e a lista de erros disponíveis em todas as páginas (EJS)
app.use((req, res, next) => {
  res.locals.usuario = req.session.usuario || null;
  res.locals.erros = {};
  next();
});

//requisitar arquivos de rotas
const rota = require("./app/routes/router");
const rotaAdm = require("./app/routes/router-adm");
// indicar o local de uso das rotas
app.use("/", rota);
// ("/") indica a raiz do site
// http://localhost:3000
app.use("/adm", rotaAdm);
// ("/adm") indica acesso ao site pela pasta adm
// http://localhost:3000/adm

//página 404 (nenhuma rota encontrada)
app.use((req, res) => {
  res.status(404).render("pages/erro", { titulo: "Página não encontrada", pagina: "" });
});

//iniciar o servidor
app.listen(porta, () => {
  console.log(`Servidor on-line \nhttp://localhost:${porta}`);
});
