// ============================================================
// adm-remedios.js - ADM: cadastrar, editar e excluir remédios (rotas /adm/remedios).
// ============================================================
const express = require("express");
const { checarId, validarRemedio, errosDoFormulario } = require("../validators/validacoes");
const { ler, salvar, menorOferta, proximoId, textoAviso } = require("./dados");

const router = express.Router();

// Mostra o formulário de remédio (usado no "novo", no "editar" e quando há erros)
function mostrarForm(res, dados) {
  res.status(dados.status || 200).render("pages/adm-remedio-form", {
    titulo: dados.modo === "novo" ? "Novo remédio" : "Editar remédio",
    pagina: "adm",
    modo: dados.modo,
    idRemedio: dados.idRemedio || null,
    farmacias: ler("farmacias.json"),
    categorias: [...new Set(ler("remedios.json").map((r) => r.categoria))],
    erro: dados.erro || null,
    erros: dados.erros || {},
    valores: dados.valores || {}
  });
}

// Lê os preços do formulário (campos precos[ID_DA_FARMACIA]). Campo vazio = sem oferta.
// Retorna null se algum preço for inválido.
function montarOfertas(corpo, farmacias) {
  const precos = corpo.precos && typeof corpo.precos === "object" ? corpo.precos : {};
  const ofertas = [];
  for (const f of farmacias) {
    const digitado = String(precos[f.id] || "").replace(",", ".").trim();
    if (digitado === "") continue;
    const preco = Number(digitado);
    if (isNaN(preco) || preco <= 0 || preco > 99999.99) return null;
    ofertas.push({ farmacia: f.nome, preco: Number(preco.toFixed(2)) });
  }
  return ofertas;
}

// Parte comum de "criar" e "editar": valida, monta as ofertas e grava.
// Se "remedio" for informado, ele é atualizado; senão, um novo é criado.
function gravar(req, res, remedios, remedio) {
  const valores = req.body;
  const mostrarErros = (erros) =>
    mostrarForm(res, {
      status: 400,
      modo: remedio ? "editar" : "novo",
      idRemedio: remedio ? remedio.id : null,
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

  const dados = {
    nome: valores.nome,
    laboratorio: valores.laboratorio,
    categoria: valores.categoria,
    descricao: valores.descricao || "",
    imagem: valores.imagem || null,
    ofertas: ofertas
  };
  if (remedio) {
    Object.assign(remedio, dados);
  } else {
    remedios.push({ id: proximoId(remedios), ...dados });
  }
  salvar("remedios.json", remedios);
  res.redirect("/adm/remedios?aviso=salvo");
}

// Responde 404 quando o remédio não existe
function naoEncontrado(res) {
  return res.status(404).render("pages/erro", { titulo: "Medicamento não encontrado", pagina: "" });
}

// LISTA
router.get("/", (req, res) => {
  const remedios = ler("remedios.json").map((r) => ({ ...r, menor: menorOferta(r) }));
  res.render("pages/adm-remedios", {
    titulo: "Gerenciar remédios",
    pagina: "adm",
    remedios,
    aviso: textoAviso(req.query.aviso)
  });
});

// NOVO
router.get("/novo", (req, res) => {
  mostrarForm(res, { modo: "novo" });
});

router.post("/", validarRemedio, (req, res) => {
  gravar(req, res, ler("remedios.json"), null);
});

// EDITAR (o formulário HTML só envia POST, por isso não usamos PUT)
router.get("/:id/editar", checarId, (req, res) => {
  const farmacias = ler("farmacias.json");
  const remedio = ler("remedios.json").find((r) => r.id === Number(req.params.id));
  if (!remedio) return naoEncontrado(res);

  // Preenche o formulário com o que já está salvo
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
    if (f) valores.precos[f.id] = String(o.preco).replace(".", ",");
  });
  mostrarForm(res, { modo: "editar", idRemedio: remedio.id, valores });
});

router.post("/:id", checarId, validarRemedio, (req, res) => {
  const remedios = ler("remedios.json");
  const remedio = remedios.find((r) => r.id === Number(req.params.id));
  if (!remedio) return naoEncontrado(res);
  gravar(req, res, remedios, remedio);
});

// EXCLUIR (e tirar dos favoritos de todos os usuários)
router.post("/:id/excluir", checarId, (req, res) => {
  const id = Number(req.params.id);
  salvar("remedios.json", ler("remedios.json").filter((r) => r.id !== id));

  const usuarios = ler("usuarios.json");
  usuarios.forEach((u) => {
    u.favoritos = u.favoritos.filter((f) => f !== id);
  });
  salvar("usuarios.json", usuarios);

  res.redirect("/adm/remedios?aviso=excluido");
});

module.exports = router;
