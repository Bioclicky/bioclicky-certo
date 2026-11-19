// ============================================================
// dados.js - Funções auxiliares para ler/gravar os JSON e tratar os dados.
// ============================================================
const fs = require("fs");
const path = require("path");

const PASTA_DADOS = path.join(__dirname, "..", "data");

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
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Menor oferta de um medicamento (ou null se não houver ofertas)
function menorOferta(remedio) {
  if (!remedio.ofertas || remedio.ofertas.length === 0) return null;
  return remedio.ofertas.reduce((menor, atual) => (atual.preco < menor.preco ? atual : menor));
}

// Quantos remédios existem em cada categoria: [{ nome, total }]
function contarCategorias(remedios) {
  const contagem = {};
  remedios.forEach((r) => {
    contagem[r.categoria] = (contagem[r.categoria] || 0) + 1;
  });
  return Object.keys(contagem).map((nome) => ({ nome, total: contagem[nome] }));
}

// Adiciona em cada farmácia quantas ofertas ela tem
function farmaciasComTotal(farmacias, remedios) {
  return farmacias.map((f) => ({
    ...f,
    totalOfertas: remedios.reduce(
      (soma, r) => soma + r.ofertas.filter((o) => o.farmacia === f.nome).length,
      0
    )
  }));
}

// Próximo id livre de uma lista
function proximoId(lista) {
  return lista.reduce((maior, item) => Math.max(maior, item.id), 0) + 1;
}

// Textos das mensagens de sucesso (vêm pela URL: ?aviso=salvo)
const AVISOS = {
  salvo: "Salvo com sucesso!",
  excluido: "Excluído com sucesso!",
  tipo: "Tipo do usuário alterado!"
};
function textoAviso(codigo) {
  return AVISOS[codigo] || null;
}

// Usuário logado (objeto completo do JSON) ou null
function buscarUsuario(req) {
  if (!req.session.usuario) return null;
  return ler("usuarios.json").find((u) => u.id === req.session.usuario.id) || null;
}

module.exports = {
  ler,
  salvar,
  normalizar,
  menorOferta,
  contarCategorias,
  farmaciasComTotal,
  proximoId,
  textoAviso,
  buscarUsuario
};
