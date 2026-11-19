// ============================================================
// router.js - Define as rotas (URLs) do site e quais dados cada página recebe.
// Dados de medicamentos/farmácias: arquivos JSON em app/data (DEMONSTRATIVOS).
// Usuários, favoritos e histórico: salvos em app/data/usuarios.json.
// ============================================================
const express = require("express");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const {
  validarCadastro,
  validarLogin,
  checarId,
  validarRemedio,
  validarFarmacia,
  errosDoFormulario
} = require("../validators/validacoes");

const router = express.Router();
const PASTA_DADOS = path.join(__dirname, "..", "data");

// ---------- Funções auxiliares de leitura/escrita ----------
function ler(arquivo) {
  return JSON.parse(fs.readFileSync(path.join(PASTA_DADOS, arquivo), "utf-8"));
}

function salvar(arquivo, dados) {
  fs.writeFileSync(path.join(PASTA_DADOS, arquivo), JSON.stringify(dados, null, 2));
}

// Se o usuarios.json não existir ainda, criamos vazio.
if (!fs.existsSync(path.join(PASTA_DADOS, "usuarios.json"))) {
  salvar("usuarios.json", []);
}

// Remove acentos e deixa minúsculo para a busca ignorar "Dipírona" x "dipirona"
function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Calcula a menor oferta de um medicamento (ou null se não houver ofertas)
function menorOferta(remedio) {
  if (!remedio.ofertas || remedio.ofertas.length === 0) {
    return null;
  }
  return remedio.ofertas.reduce((menor, atual) => (atual.preco < menor.preco ? atual : menor));
}

// Conta quantos remédios existem em cada categoria. Retorna [{ nome, total }]
// (usado na página inicial e na página de categorias)
function contarCategorias(remedios) {
  const contagem = {};
  remedios.forEach((r) => {
    contagem[r.categoria] = (contagem[r.categoria] || 0) + 1;
  });
  return Object.keys(contagem).map((nome) => ({ nome, total: contagem[nome] }));
}

// Adiciona em cada farmácia quantas ofertas ela tem (usado nas páginas de farmácias)
function farmaciasComTotal(farmacias, remedios) {
  return farmacias.map((f) => ({
    ...f,
    totalOfertas: remedios.reduce(
      (soma, r) => soma + r.ofertas.filter((o) => o.farmacia === f.nome).length,
      0
    )
  }));
}

// Bloqueia páginas que exigem login (e desloga quem teve a conta excluída)
function exigirLogin(req, res, next) {
  if (!req.session.usuario) {
    return res.redirect("/login");
  }
  const existe = ler("usuarios.json").some((u) => u.id === req.session.usuario.id);
  if (!existe) {
    return req.session.destroy(() => res.redirect("/login"));
  }
  next();
}

// Cria o primeiro ADM se ainda não existir nenhum.
// Não há senha escrita no código: usa ADMIN_EMAIL/ADMIN_PASSWORD (se definidos) ou
// gera uma senha aleatória e mostra UMA vez no terminal.
function criarAdmDoAmbiente() {
  const usuarios = ler("usuarios.json");
  if (usuarios.some((u) => u.tipo === "adm")) {
    return; // já existe um ADM
  }
  const email = String(process.env.ADMIN_EMAIL || "adm@bioclicky.com").trim().toLowerCase();
  const senhaDefinida = (process.env.ADMIN_PASSWORD || "").length >= 8;
  const senha = senhaDefinida ? process.env.ADMIN_PASSWORD : require("crypto").randomBytes(6).toString("hex");
  usuarios.push({
    id: Date.now(),
    nome: "Administrador",
    email: email,
    senhaHash: bcrypt.hashSync(senha, 10),
    tipo: "adm",
    favoritos: [],
    historico: []
  });
  salvar("usuarios.json", usuarios);
  console.log("ADM criado: " + email + (senhaDefinida ? "" : "  senha: " + senha + "  (anote, não será mostrada de novo)"));
}
criarAdmDoAmbiente();

// Bloqueia páginas que só o ADM pode ver
function exigirAdm(req, res, next) {
  if (!req.session.usuario) {
    return res.redirect("/login");
  }
  const u = ler("usuarios.json").find((x) => x.id === req.session.usuario.id);
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

// Descobre o próximo id livre de uma lista
function proximoId(lista) {
  let maior = 0;
  lista.forEach((item) => {
    if (item.id > maior) maior = item.id;
  });
  return maior + 1;
}

// Textos das mensagens de sucesso (vêm pela URL: ?aviso=salvo)
function textoAviso(codigo) {
  const avisos = {
    salvo: "Salvo com sucesso!",
    excluido: "Excluído com sucesso!",
    tipo: "Tipo do usuário alterado!"
  };
  return avisos[codigo] || null;
}

// Lê os preços do formulário (campos precos[ID_DA_FARMACIA]).
// Campo vazio = sem oferta. O express-validator já conferiu os valores;
// aqui conferimos de novo por segurança e retornamos null se algum preço for inválido.
function montarOfertas(corpo, farmacias) {
  const precos = corpo.precos && typeof corpo.precos === "object" ? corpo.precos : {};
  const ofertas = [];
  for (let i = 0; i < farmacias.length; i++) {
    const f = farmacias[i];
    const digitado = String(precos[f.id] || "").replace(",", ".").trim();
    if (digitado !== "") {
      const preco = Number(digitado);
      if (isNaN(preco) || preco <= 0 || preco > 99999.99) {
        return null;
      }
      ofertas.push({ farmacia: f.nome, preco: Number(preco.toFixed(2)) });
    }
  }
  return ofertas;
}

// ---------- Páginas públicas ----------
// PÁGINA INICIAL: mostra 3 remédios em destaque e as categorias.
router.get("/", (req, res) => {
  const todos = ler("remedios.json");
  // Destaques: os 3 primeiros medicamentos, com a menor oferta calculada
  const destaques = todos.slice(0, 3).map((r) => ({ ...r, menor: menorOferta(r) }));
  const categorias = contarCategorias(todos);
  res.render("pages/home", { titulo: "Início", pagina: "home", destaques, categorias });
});

// LISTA DE REMÉDIOS: aplica a busca (?q=), o filtro de categoria e o filtro de farmácia.
router.get("/remedios", (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 100);
  const categoria = String(req.query.categoria || "").trim().slice(0, 50);
  const farmacia = String(req.query.farmacia || "").trim().slice(0, 100);
  let lista = ler("remedios.json");

  if (q) {
    const termo = normalizar(q);
    lista = lista.filter(
      (r) => normalizar(r.nome).includes(termo) || normalizar(r.laboratorio).includes(termo)
    );
  }
  if (categoria) {
    lista = lista.filter((r) => r.categoria === categoria);
  }
  // Filtro vindo da página de farmácias: só medicamentos com oferta nessa farmácia
  if (farmacia) {
    lista = lista.filter((r) => r.ofertas.some((o) => o.farmacia === farmacia));
  }

  // Cada medicamento recebe a "menor" oferta calculada
  lista = lista.map((r) => ({ ...r, menor: menorOferta(r) }));

  const categorias = [...new Set(ler("remedios.json").map((r) => r.categoria))];

  // Registra no histórico do usuário logado
  if (q && req.session.usuario) {
    const usuarios = ler("usuarios.json");
    const u = usuarios.find((x) => x.id === req.session.usuario.id);
    if (u) {
      u.historico = [q, ...u.historico.filter((h) => h !== q)].slice(0, 20);
      salvar("usuarios.json", usuarios);
    }
  }

  const favoritos = favoritosDoUsuario(req);
  res.render("pages/remedios", {
    titulo: "Remédios",
    pagina: "remedios",
    remedios: lista,
    categorias,
    q,
    categoria,
    farmacia,
    favoritos
  });
});

// COMPARAÇÃO DE PREÇOS: mostra as ofertas de um remédio, da mais barata para a mais cara.
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
  const remedios = ler("remedios.json");

  if (q) {
    farmacias = farmacias.filter((f) => normalizar(f.nome).includes(normalizar(q)));
  }
  farmacias = farmaciasComTotal(farmacias, remedios);

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

// ---------- Cadastro ----------
router.get("/cadastro", (req, res) => {
  res.render("pages/cadastro", { titulo: "Cadastro", pagina: "cadastro", erro: null, valores: {} });
});

// validarCadastro (express-validator) confere os campos antes da função abaixo
router.post("/cadastro", validarCadastro, (req, res, next) => {
  const { nome, email, senha } = req.body;
  // Função que mostra o formulário de novo, com as mensagens de erro e o que a pessoa já digitou
  const mostrarErros = (erros) =>
    res.status(400).render("pages/cadastro", {
      titulo: "Cadastro",
      pagina: "cadastro",
      erro: "Corrija os campos indicados abaixo.",
      erros,
      valores: { nome, email }
    });

  // 1) Se o express-validator achou erro, mostra o formulário de novo e PARA aqui (nada é salvo)
  const erros = errosDoFormulario(req);
  if (erros) return mostrarErros(erros);

  // 2) E-mail já usado por outra conta?
  const usuarios = ler("usuarios.json");
  if (usuarios.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return mostrarErros({ email: "Este e-mail já está cadastrado." });
  }

  // 3) Tudo certo: guarda o usuário com a senha em hash (nunca a senha pura) e já faz o login
  const novo = {
    id: Date.now(),
    nome: nome,
    email: email,
    senhaHash: bcrypt.hashSync(senha, 10),
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
      valores: { email: req.body.email }
    });
  }

  const usuario = ler("usuarios.json").find((u) => u.email === email);

  // A mesma mensagem para "e-mail não existe" e "senha errada" (não revela quais e-mails têm conta)
  if (!usuario || !bcrypt.compareSync(senha, usuario.senhaHash)) {
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

// ---------- Área do usuário ----------
function favoritosDoUsuario(req) {
  if (!req.session.usuario) return [];
  const u = ler("usuarios.json").find((x) => x.id === req.session.usuario.id);
  return u ? u.favoritos : [];
}

// DASHBOARD: favoritos e histórico de pesquisas do usuário logado.
router.get("/dashboard", exigirLogin, (req, res) => {
  const u = ler("usuarios.json").find((x) => x.id === req.session.usuario.id);
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

// FAVORITAR: se já é favorito, remove; se não é, adiciona.
router.post("/favoritos/:id", checarId, exigirLogin, (req, res) => {
  const id = Number(req.params.id);
  const usuarios = ler("usuarios.json");
  const u = usuarios.find((x) => x.id === req.session.usuario.id);
  u.favoritos = u.favoritos.includes(id) ? u.favoritos.filter((f) => f !== id) : [...u.favoritos, id];
  salvar("usuarios.json", usuarios);
  res.redirect(voltarPara(req, "/dashboard"));
});

// LIMPAR HISTÓRICO de pesquisas.
router.post("/historico/limpar", exigirLogin, (req, res) => {
  const usuarios = ler("usuarios.json");
  const u = usuarios.find((x) => x.id === req.session.usuario.id);
  u.historico = [];
  salvar("usuarios.json", usuarios);
  res.redirect("/dashboard");
});

// ============================================================
// ÁREA DO ADM (todas as rotas abaixo usam exigirAdm)
// ============================================================

// ---------- Painel principal ----------
// (exigirAdm: só o ADM entra; os outros recebem "acesso negado")
router.get("/adm", exigirAdm, (req, res) => {
  const totais = {
    remedios: ler("remedios.json").length,
    farmacias: ler("farmacias.json").length,
    usuarios: ler("usuarios.json").length
  };
  res.render("pages/adm", { titulo: "Painel do ADM", pagina: "adm", totais });
});

// ---------- ADM: remédios ----------
// Mostra o formulário de remédio (usado no "novo", no "editar" e quando há erros)
function mostrarFormRemedio(res, dados) {
  const remedios = ler("remedios.json");
  res.status(dados.status || 200).render("pages/adm-remedio-form", {
    titulo: dados.modo === "novo" ? "Novo remédio" : "Editar remédio",
    pagina: "adm",
    modo: dados.modo,
    idRemedio: dados.idRemedio || null,
    farmacias: ler("farmacias.json"),
    categorias: [...new Set(remedios.map((r) => r.categoria))],
    erro: dados.erro || null,
    erros: dados.erros || {},
    valores: dados.valores || {}
  });
}

router.get("/adm/remedios", exigirAdm, (req, res) => {
  const remedios = ler("remedios.json").map((r) => ({ ...r, menor: menorOferta(r) }));
  res.render("pages/adm-remedios", {
    titulo: "Gerenciar remédios",
    pagina: "adm",
    remedios,
    aviso: textoAviso(req.query.aviso)
  });
});

router.get("/adm/remedios/novo", exigirAdm, (req, res) => {
  mostrarFormRemedio(res, { modo: "novo" });
});

// SALVAR NOVO REMÉDIO: valida (express-validator), monta as ofertas e grava no JSON.
router.post("/adm/remedios", exigirAdm, validarRemedio, (req, res) => {
  const valores = req.body;
  const mostrarErros = (erros) =>
    mostrarFormRemedio(res, {
      status: 400,
      modo: "novo",
      erro: "Corrija os campos indicados abaixo.",
      erros,
      valores
    });

  const erros = errosDoFormulario(req);
  if (erros) return mostrarErros(erros);

  const ofertas = montarOfertas(valores, ler("farmacias.json"));
  if (ofertas === null) {
    return mostrarErros({ preco: "Preço inválido. Use apenas números maiores que zero, como 7,90." });
  }

  const remedios = ler("remedios.json");
  remedios.push({
    id: proximoId(remedios),
    nome: valores.nome,
    laboratorio: valores.laboratorio,
    categoria: valores.categoria,
    descricao: valores.descricao || "",
    imagem: valores.imagem || null,
    ofertas: ofertas
  });
  salvar("remedios.json", remedios);
  res.redirect("/adm/remedios?aviso=salvo");
});

router.get("/adm/remedios/:id/editar", checarId, exigirAdm, (req, res) => {
  const farmacias = ler("farmacias.json");
  const remedio = ler("remedios.json").find((r) => r.id === Number(req.params.id));
  if (!remedio) {
    return res.status(404).render("pages/erro", { titulo: "Medicamento não encontrado", pagina: "" });
  }

  // Monta os valores do formulário com o que já está salvo
  const valores = {
    nome: remedio.nome,
    laboratorio: remedio.laboratorio,
    categoria: remedio.categoria,
    descricao: remedio.descricao,
    imagem: remedio.imagem || "",
    precos: {}
  };
  remedio.ofertas.forEach((o) => {
    const f = farmacias.find((x) => x.nome === o.farmacia);
    if (f) {
      valores.precos[f.id] = String(o.preco).replace(".", ",");
    }
  });

  mostrarFormRemedio(res, { modo: "editar", idRemedio: remedio.id, valores });
});

// Editar: o formulário HTML só envia POST (PUT não existe em <form>), por isso usamos POST aqui
router.post("/adm/remedios/:id", checarId, exigirAdm, validarRemedio, (req, res) => {
  const remedios = ler("remedios.json");
  const remedio = remedios.find((r) => r.id === Number(req.params.id));
  if (!remedio) {
    return res.status(404).render("pages/erro", { titulo: "Medicamento não encontrado", pagina: "" });
  }
  const valores = req.body;
  const mostrarErros = (erros) =>
    mostrarFormRemedio(res, {
      status: 400,
      modo: "editar",
      idRemedio: remedio.id,
      erro: "Corrija os campos indicados abaixo.",
      erros,
      valores
    });

  const erros = errosDoFormulario(req);
  if (erros) return mostrarErros(erros);

  const ofertas = montarOfertas(valores, ler("farmacias.json"));
  if (ofertas === null) {
    return mostrarErros({ preco: "Preço inválido. Use apenas números maiores que zero, como 7,90." });
  }

  remedio.nome = valores.nome;
  remedio.laboratorio = valores.laboratorio;
  remedio.categoria = valores.categoria;
  remedio.descricao = valores.descricao || "";
  remedio.imagem = valores.imagem || null;
  remedio.ofertas = ofertas;
  salvar("remedios.json", remedios);
  res.redirect("/adm/remedios?aviso=salvo");
});

// EXCLUIR REMÉDIO (e tirar dos favoritos de todos).
router.post("/adm/remedios/:id/excluir", checarId, exigirAdm, (req, res) => {
  const id = Number(req.params.id);
  const restantes = ler("remedios.json").filter((r) => r.id !== id);
  salvar("remedios.json", restantes);

  // Tira o remédio dos favoritos de todo mundo
  const usuarios = ler("usuarios.json");
  usuarios.forEach((u) => {
    u.favoritos = u.favoritos.filter((f) => f !== id);
  });
  salvar("usuarios.json", usuarios);

  res.redirect("/adm/remedios?aviso=excluido");
});

// ---------- ADM: farmácias ----------
router.get("/adm/farmacias", exigirAdm, (req, res) => {
  const farmacias = farmaciasComTotal(ler("farmacias.json"), ler("remedios.json"));
  res.render("pages/adm-farmacias", {
    titulo: "Gerenciar farmácias",
    pagina: "adm",
    farmacias,
    aviso: textoAviso(req.query.aviso)
  });
});

router.get("/adm/farmacias/novo", exigirAdm, (req, res) => {
  res.render("pages/adm-farmacia-form", {
    titulo: "Nova farmácia",
    pagina: "adm",
    modo: "novo",
    idFarmacia: null,
    erro: null,
    valores: {}
  });
});

// SALVAR NOVA FARMÁCIA: valida, confere nome repetido e grava no JSON.
router.post("/adm/farmacias", exigirAdm, validarFarmacia, (req, res) => {
  const farmacias = ler("farmacias.json");
  const valores = req.body;
  const mostrarErros = (erros) =>
    res.status(400).render("pages/adm-farmacia-form", {
      titulo: "Nova farmácia",
      pagina: "adm",
      modo: "novo",
      idFarmacia: null,
      erro: "Corrija os campos indicados abaixo.",
      erros,
      valores
    });

  const erros = errosDoFormulario(req);
  if (erros) return mostrarErros(erros);

  if (farmacias.some((f) => normalizar(f.nome) === normalizar(valores.nome))) {
    return mostrarErros({ nome: "Já existe uma farmácia com esse nome." });
  }

  farmacias.push({
    id: proximoId(farmacias),
    nome: valores.nome,
    endereco: valores.endereco || null,
    logo: valores.logo || null
  });
  salvar("farmacias.json", farmacias);
  res.redirect("/adm/farmacias?aviso=salvo");
});

router.get("/adm/farmacias/:id/editar", checarId, exigirAdm, (req, res) => {
  const farmacia = ler("farmacias.json").find((f) => f.id === Number(req.params.id));
  if (!farmacia) {
    return res.status(404).render("pages/erro", { titulo: "Farmácia não encontrada", pagina: "" });
  }
  res.render("pages/adm-farmacia-form", {
    titulo: "Editar farmácia",
    pagina: "adm",
    modo: "editar",
    idFarmacia: farmacia.id,
    erro: null,
    valores: { nome: farmacia.nome, endereco: farmacia.endereco || "", logo: farmacia.logo || "" }
  });
});

// Editar: o formulário HTML só envia POST (PUT não existe em <form>), por isso usamos POST aqui
router.post("/adm/farmacias/:id", checarId, exigirAdm, validarFarmacia, (req, res) => {
  const farmacias = ler("farmacias.json");
  const farmacia = farmacias.find((f) => f.id === Number(req.params.id));
  if (!farmacia) {
    return res.status(404).render("pages/erro", { titulo: "Farmácia não encontrada", pagina: "" });
  }
  const valores = req.body;
  const mostrarErros = (erros) =>
    res.status(400).render("pages/adm-farmacia-form", {
      titulo: "Editar farmácia",
      pagina: "adm",
      modo: "editar",
      idFarmacia: farmacia.id,
      erro: "Corrija os campos indicados abaixo.",
      erros,
      valores
    });

  const erros = errosDoFormulario(req);
  if (erros) return mostrarErros(erros);

  const repetida = farmacias.some(
    (f) => f.id !== farmacia.id && normalizar(f.nome) === normalizar(valores.nome)
  );
  if (repetida) {
    return mostrarErros({ nome: "Já existe uma farmácia com esse nome." });
  }

  const nomeAntigo = farmacia.nome;
  farmacia.nome = valores.nome;
  farmacia.endereco = valores.endereco || null;
  farmacia.logo = valores.logo || null;
  salvar("farmacias.json", farmacias);

  // Se o nome mudou, atualiza o nome nas ofertas dos remédios
  if (nomeAntigo !== farmacia.nome) {
    const remedios = ler("remedios.json");
    remedios.forEach((r) => {
      r.ofertas.forEach((o) => {
        if (o.farmacia === nomeAntigo) o.farmacia = farmacia.nome;
      });
    });
    salvar("remedios.json", remedios);
  }
  res.redirect("/adm/farmacias?aviso=salvo");
});

// EXCLUIR FARMÁCIA (e apagar as ofertas dela dos remédios).
router.post("/adm/farmacias/:id/excluir", checarId, exigirAdm, (req, res) => {
  const farmacias = ler("farmacias.json");
  const farmacia = farmacias.find((f) => f.id === Number(req.params.id));
  if (farmacia) {
    salvar("farmacias.json", farmacias.filter((f) => f.id !== farmacia.id));

    // Apaga as ofertas dessa farmácia dos remédios
    const remedios = ler("remedios.json");
    remedios.forEach((r) => {
      r.ofertas = r.ofertas.filter((o) => o.farmacia !== farmacia.nome);
    });
    salvar("remedios.json", remedios);
  }
  res.redirect("/adm/farmacias?aviso=excluido");
});

// ---------- ADM: usuários ----------
router.get("/adm/usuarios", exigirAdm, (req, res) => {
  const usuarios = ler("usuarios.json");
  res.render("pages/adm-usuarios", {
    titulo: "Gerenciar usuários",
    pagina: "adm",
    usuarios,
    aviso: textoAviso(req.query.aviso),
    erro: req.query.erro === "proprio" ? "Você não pode alterar ou excluir a sua própria conta aqui." : null
  });
});

// Alterna entre "usuario" e "adm"
router.post("/adm/usuarios/:id/tipo", checarId, exigirAdm, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.session.usuario.id) {
    return res.redirect("/adm/usuarios?erro=proprio");
  }
  const usuarios = ler("usuarios.json");
  const u = usuarios.find((x) => x.id === id);
  if (u) {
    u.tipo = u.tipo === "adm" ? "usuario" : "adm";
    salvar("usuarios.json", usuarios);
  }
  res.redirect("/adm/usuarios?aviso=tipo");
});

// EXCLUIR USUÁRIO (o ADM não pode excluir a si mesmo).
router.post("/adm/usuarios/:id/excluir", checarId, exigirAdm, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.session.usuario.id) {
    return res.redirect("/adm/usuarios?erro=proprio");
  }
  salvar("usuarios.json", ler("usuarios.json").filter((u) => u.id !== id));
  res.redirect("/adm/usuarios?aviso=excluido");
});

module.exports = router;
