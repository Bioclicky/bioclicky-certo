// ============================================================
// validacoes.js - Regras de validação do servidor (biblioteca express-validator).
//
// Como funciona:
//   1. Cada lista abaixo (ex: validarCadastro) é colocada na rota ANTES da função da rota.
//   2. O express-validator confere os campos e guarda os erros na requisição.
//   3. Na rota, chamamos errosDoFormulario(req) para ler os erros (validationResult).
//
// Sobre escape(): o EJS já "escapa" tudo que aparece na tela com <%= %>. Se guardássemos
// o texto já escapado, "Johnson & Johnson" viraria "Johnson &amp; Johnson" no arquivo e
// apareceria com "&amp;amp;" na tela. Por isso, em vez de escape(), bloqueamos os símbolos
// < e > nos textos (regra SEM_TAGS). Senhas nunca são alteradas (nem trim, nem escape).
// ============================================================
const { body, param, validationResult } = require("express-validator");

// Texto sem < e > (impede colocar tags HTML nos campos)
const SEM_TAGS = /^[^<>]*$/;
// Endereço de imagem: caminho do próprio site (/imagens/x.png) ou link http(s)
const ENDERECO_IMAGEM = /^(\/[\w\-./]+|https?:\/\/[^\s<>"']+)$/i;

// ---------- Cadastro de usuário ----------
const validarCadastro = [
  body("nome")
    .trim()
    .notEmpty().withMessage("Informe seu nome.").bail()
    .isLength({ min: 2, max: 80 }).withMessage("O nome deve ter entre 2 e 80 caracteres.").bail()
    .matches(SEM_TAGS).withMessage("O nome não pode conter os símbolos < ou >."),

  body("email")
    .trim()
    .notEmpty().withMessage("Informe seu e-mail.").bail()
    .isEmail().withMessage("Informe um e-mail válido, como nome@exemplo.com.").bail()
    .isLength({ max: 120 }).withMessage("O e-mail pode ter no máximo 120 caracteres.")
    // deixa minúsculo, mas NÃO mexe nos pontos nem no "+" do Gmail
    .normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false }),

  // Senha: sem trim e sem escape (espaços e símbolos fazem parte da senha)
  body("senha")
    .notEmpty().withMessage("Crie uma senha.").bail()
    .isLength({ min: 8, max: 72 }).withMessage("A senha deve ter entre 8 e 72 caracteres.").bail()
    .matches(/[A-Za-z]/).withMessage("A senha precisa ter pelo menos uma letra.").bail()
    .matches(/\d/).withMessage("A senha precisa ter pelo menos um número."),

  body("confirmacao")
    .notEmpty().withMessage("Confirme a senha.").bail()
    .custom((valor, { req }) => valor === req.body.senha).withMessage("As senhas não coincidem.")
];

// ---------- Login ----------
// No login só conferimos o formato; quem diz se a senha está certa é o bcrypt na rota.
const validarLogin = [
  body("email")
    .trim()
    .notEmpty().withMessage("Informe seu e-mail.").bail()
    .isEmail().withMessage("Informe um e-mail válido, como nome@exemplo.com.")
    .normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false }),

  body("senha")
    .notEmpty().withMessage("Informe sua senha.").bail()
    .isLength({ max: 72 }).withMessage("A senha pode ter no máximo 72 caracteres.")
];

// ---------- Identificador na URL (/adm/remedios/:id ...) ----------
const validarId = [param("id").isInt({ min: 1 }).withMessage("Identificador inválido.")];

// Se o :id da URL for inválido, mostra a página de "não encontrado"
function exigirIdValido(req, res, next) {
  if (!validationResult(req).isEmpty()) {
    return res.status(404).render("pages/erro", { titulo: "Página não encontrada", pagina: "" });
  }
  next();
}

// Use nas rotas que têm :id: [...checarId]
const checarId = [...validarId, exigirIdValido];

// ---------- Remédios (cadastro e edição) ----------
const validarRemedio = [
  body("nome")
    .trim()
    .notEmpty().withMessage("Informe o nome do remédio.").bail()
    .isLength({ min: 2, max: 100 }).withMessage("O nome deve ter entre 2 e 100 caracteres.").bail()
    .matches(SEM_TAGS).withMessage("O nome não pode conter os símbolos < ou >."),

  body("laboratorio")
    .trim()
    .notEmpty().withMessage("Informe o laboratório.").bail()
    .isLength({ min: 2, max: 100 }).withMessage("O laboratório deve ter entre 2 e 100 caracteres.").bail()
    .matches(SEM_TAGS).withMessage("O laboratório não pode conter os símbolos < ou >."),

  body("categoria")
    .trim()
    .notEmpty().withMessage("Informe a categoria.").bail()
    .isLength({ min: 2, max: 50 }).withMessage("A categoria deve ter entre 2 e 50 caracteres.").bail()
    .matches(SEM_TAGS).withMessage("A categoria não pode conter os símbolos < ou >."),

  body("descricao")
    .trim()
    .isLength({ max: 500 }).withMessage("A descrição pode ter no máximo 500 caracteres.").bail()
    .matches(SEM_TAGS).withMessage("A descrição não pode conter os símbolos < ou >."),

  body("imagem")
    .trim()
    .optional({ values: "falsy" })
    .matches(ENDERECO_IMAGEM)
    .withMessage("Use um caminho começando com / (ex: /imagens/remedio.png) ou um link http:// ou https://."),

  // Preços: os campos se chamam precos[ID_DA_FARMACIA]. Campo vazio = sem oferta.
  // A vírgula é trocada por ponto antes de conferir (7,90 vira 7.90).
  body("precos.*")
    .optional({ values: "falsy" })
    .customSanitizer((valor) => String(valor).trim().replace(",", "."))
    .isFloat({ min: 0.01, max: 99999.99 })
    .withMessage("Preço inválido. Use apenas números maiores que zero, como 7,90.")
];

// ---------- Farmácias (cadastro e edição) ----------
const validarFarmacia = [
  body("nome")
    .trim()
    .notEmpty().withMessage("Informe o nome da farmácia.").bail()
    .isLength({ min: 2, max: 100 }).withMessage("O nome deve ter entre 2 e 100 caracteres.").bail()
    .matches(SEM_TAGS).withMessage("O nome não pode conter os símbolos < ou >."),

  body("endereco")
    .trim()
    .isLength({ max: 200 }).withMessage("O endereço pode ter no máximo 200 caracteres.").bail()
    .matches(SEM_TAGS).withMessage("O endereço não pode conter os símbolos < ou >."),

  body("logo")
    .trim()
    .optional({ values: "falsy" })
    .matches(ENDERECO_IMAGEM)
    .withMessage("Use um caminho começando com / (ex: /imagens/farmacias/logo.png) ou um link http:// ou https://.")
];

// ---------- Lê os erros e devolve { campo: "mensagem" } (ou null se está tudo certo) ----------
function errosDoFormulario(req) {
  const resultado = validationResult(req);
  if (resultado.isEmpty()) {
    return null;
  }
  const erros = {};
  resultado.array().forEach((e) => {
    let campo = e.path || e.param;
    // "precos[3]" (ou "precos.3") vira "preco_3", o id do campo na tela
    const preco = /^precos(?:\[|\.)(\d+)\]?$/.exec(campo);
    if (preco) {
      campo = "preco_" + preco[1];
    }
    if (!erros[campo]) {
      erros[campo] = e.msg; // guarda só o primeiro erro de cada campo
    }
  });
  return erros;
}

module.exports = {
  validarCadastro,
  validarLogin,
  checarId,
  validarRemedio,
  validarFarmacia,
  errosDoFormulario
};
