// ============================================================
// adm-farmacias.js - ADM: cadastrar, editar e excluir farmácias (rotas /adm/farmacias).
// ============================================================
const express = require("express");
const { checarId, validarFarmacia, errosDoFormulario } = require("../validators/validacoes");
const { ler, salvar, normalizar, proximoId, farmaciasComTotal, textoAviso } = require("./dados");

const router = express.Router();

// Mostra o formulário de farmácia (usado no "novo", no "editar" e quando há erros)
function mostrarForm(res, dados) {
  res.status(dados.status || 200).render("pages/adm-farmacia-form", {
    titulo: dados.modo === "novo" ? "Nova farmácia" : "Editar farmácia",
    pagina: "adm",
    modo: dados.modo,
    idFarmacia: dados.idFarmacia || null,
    erro: dados.erro || null,
    erros: dados.erros || {},
    valores: dados.valores || {}
  });
}

// Responde 404 quando a farmácia não existe
function naoEncontrada(res) {
  return res.status(404).render("pages/erro", { titulo: "Farmácia não encontrada", pagina: "" });
}

// Parte comum de "criar" e "editar": valida, confere nome repetido e grava.
// Se "farmacia" for informada, ela é atualizada; senão, uma nova é criada.
function gravar(req, res, farmacias, farmacia) {
  const valores = req.body;
  const mostrarErros = (erros) =>
    mostrarForm(res, {
      status: 400,
      modo: farmacia ? "editar" : "novo",
      idFarmacia: farmacia ? farmacia.id : null,
      erro: "Corrija os campos indicados abaixo.",
      erros,
      valores
    });

  const erros = errosDoFormulario(req);
  if (erros) return mostrarErros(erros);

  const repetida = farmacias.some(
    (f) => (!farmacia || f.id !== farmacia.id) && normalizar(f.nome) === normalizar(valores.nome)
  );
  if (repetida) return mostrarErros({ nome: "Já existe uma farmácia com esse nome." });

  const dados = { nome: valores.nome, endereco: valores.endereco || null, logo: valores.logo || null };
  const nomeAntigo = farmacia ? farmacia.nome : null;

  if (farmacia) {
    Object.assign(farmacia, dados);
  } else {
    farmacias.push({ id: proximoId(farmacias), ...dados });
  }
  salvar("farmacias.json", farmacias);

  // Se o nome mudou, atualiza o nome nas ofertas dos remédios
  if (farmacia && nomeAntigo !== dados.nome) {
    const remedios = ler("remedios.json");
    remedios.forEach((r) => {
      r.ofertas.forEach((o) => {
        if (o.farmacia === nomeAntigo) o.farmacia = dados.nome;
      });
    });
    salvar("remedios.json", remedios);
  }
  res.redirect("/adm/farmacias?aviso=salvo");
}

// LISTA
router.get("/", (req, res) => {
  const farmacias = farmaciasComTotal(ler("farmacias.json"), ler("remedios.json"));
  res.render("pages/adm-farmacias", {
    titulo: "Gerenciar farmácias",
    pagina: "adm",
    farmacias,
    aviso: textoAviso(req.query.aviso)
  });
});

// NOVA
router.get("/novo", (req, res) => {
  mostrarForm(res, { modo: "novo" });
});

router.post("/", validarFarmacia, (req, res) => {
  gravar(req, res, ler("farmacias.json"), null);
});

// EDITAR (o formulário HTML só envia POST, por isso não usamos PUT)
router.get("/:id/editar", checarId, (req, res) => {
  const f = ler("farmacias.json").find((x) => x.id === Number(req.params.id));
  if (!f) return naoEncontrada(res);
  mostrarForm(res, {
    modo: "editar",
    idFarmacia: f.id,
    valores: { nome: f.nome, endereco: f.endereco || "", logo: f.logo || "" }
  });
});

router.post("/:id", checarId, validarFarmacia, (req, res) => {
  const farmacias = ler("farmacias.json");
  const farmacia = farmacias.find((f) => f.id === Number(req.params.id));
  if (!farmacia) return naoEncontrada(res);
  gravar(req, res, farmacias, farmacia);
});

// EXCLUIR (e apagar as ofertas dela dos remédios)
router.post("/:id/excluir", checarId, (req, res) => {
  const farmacias = ler("farmacias.json");
  const farmacia = farmacias.find((f) => f.id === Number(req.params.id));
  if (farmacia) {
    salvar("farmacias.json", farmacias.filter((f) => f.id !== farmacia.id));

    const remedios = ler("remedios.json");
    remedios.forEach((r) => {
      r.ofertas = r.ofertas.filter((o) => o.farmacia !== farmacia.nome);
    });
    salvar("remedios.json", remedios);
  }
  res.redirect("/adm/farmacias?aviso=excluido");
});

module.exports = router;
