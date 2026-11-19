// ============================================================
// validacao.js - Validação dos formulários no navegador (JavaScript puro).
//
// Como funciona:
//   - Cada <form> tem o atributo data-validar="login | cadastro | farmacia | remedio".
//   - Cada campo tem uma <small class="campo-erro" id="erro-ID_DO_CAMPO"> logo abaixo,
//     onde a mensagem de erro aparece.
//   - O formulário usa "novalidate" para que as mensagens sejam as nossas (em português),
//     e não as do navegador.
//   - O servidor (express-validator) confere tudo de novo: esta validação só ajuda o usuário.
// ============================================================
(function () {
  "use strict";

  // ---------- Funções de conferência ----------

  function emailValido(texto) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(texto);
  }

  // Aceita 7,90 ou 7.90 (até 2 casas), maior que zero e até 99.999,99
  function precoValido(texto) {
    var numero = texto.replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(numero)) {
      return false;
    }
    return Number(numero) >= 0.01 && Number(numero) <= 99999.99;
  }

  function temTag(texto) {
    return /[<>]/.test(texto);
  }

  function enderecoImagemValido(texto) {
    return /^(\/[\w\-./]+|https?:\/\/[^\s<>"']+)$/i.test(texto);
  }

  // ---------- Regras de cada campo ----------
  // Cada regra recebe o valor e o formulário e devolve a mensagem de erro
  // (ou "" quando o campo está certo).

  function regraTexto(nomeDoCampo, minimo, maximo) {
    return function (valor) {
      if (valor === "") return "Informe " + nomeDoCampo + ".";
      if (valor.length < minimo || valor.length > maximo) {
        return "Use entre " + minimo + " e " + maximo + " caracteres.";
      }
      if (temTag(valor)) return "Não use os símbolos < ou >.";
      return "";
    };
  }

  function regraTextoOpcional(maximo) {
    return function (valor) {
      if (valor.length > maximo) return "Use no máximo " + maximo + " caracteres.";
      if (temTag(valor)) return "Não use os símbolos < ou >.";
      return "";
    };
  }

  function regraEmail(valor) {
    if (valor === "") return "Informe seu e-mail.";
    if (!emailValido(valor)) return "Informe um e-mail válido, como nome@exemplo.com.";
    return "";
  }

  function regraEnderecoImagem(valor) {
    if (valor !== "" && !enderecoImagemValido(valor)) {
      return "Use um caminho começando com / (ex: /imagens/logo.png) ou um link http:// ou https://.";
    }
    return "";
  }

  function regraPreco(valor) {
    if (valor !== "" && !precoValido(valor)) {
      return "Preço inválido. Use apenas números maiores que zero, como 7,90.";
    }
    return "";
  }

  var regrasPorFormulario = {
    login: {
      email: regraEmail,
      senha: function (valor) {
        return valor === "" ? "Informe sua senha." : "";
      }
    },

    cadastro: {
      nome: regraTexto("seu nome", 2, 80),
      email: regraEmail,
      senha: function (valor) {
        if (valor === "") return "Crie uma senha.";
        if (valor.length < 8) return "A senha deve ter pelo menos 8 caracteres.";
        if (valor.length > 72) return "A senha pode ter no máximo 72 caracteres.";
        if (!/[A-Za-z]/.test(valor)) return "A senha precisa ter pelo menos uma letra.";
        if (!/\d/.test(valor)) return "A senha precisa ter pelo menos um número.";
        return "";
      },
      confirmacao: function (valor, formulario) {
        if (valor === "") return "Confirme a senha.";
        if (valor !== formulario.elements.senha.value) return "As senhas não coincidem.";
        return "";
      }
    },

    farmacia: {
      nome: regraTexto("o nome da farmácia", 2, 100),
      endereco: regraTextoOpcional(200),
      logo: regraEnderecoImagem
    },

    remedio: {
      nome: regraTexto("o nome do remédio", 2, 100),
      laboratorio: regraTexto("o laboratório", 2, 100),
      categoria: regraTexto("a categoria", 2, 50),
      descricao: regraTextoOpcional(500),
      imagem: regraEnderecoImagem
    }
  };

  // Campos que NÃO podem ter os espaços das pontas removidos (senhas)
  function ehSenha(campo) {
    return campo.type === "password";
  }

  // ---------- Mostrar e limpar erros ----------

  function avisoDoCampo(campo) {
    return document.getElementById("erro-" + campo.id);
  }

  function mostrarErro(campo, mensagem) {
    var aviso = avisoDoCampo(campo);
    campo.setAttribute("aria-invalid", "true");
    if (aviso) aviso.textContent = mensagem;
  }

  function limparErro(campo) {
    var aviso = avisoDoCampo(campo);
    campo.removeAttribute("aria-invalid");
    if (aviso) aviso.textContent = "";
  }

  // Confere um campo. Devolve true se está certo.
  function validarCampo(formulario, campo) {
    var regras = regrasPorFormulario[formulario.dataset.validar];
    var regra = null;
    if (campo.hasAttribute("data-preco")) {
      regra = regraPreco; // campos de preço (um para cada farmácia)
    } else if (regras && regras[campo.name]) {
      regra = regras[campo.name];
    }
    if (!regra) return true;

    var valor = ehSenha(campo) ? campo.value : campo.value.trim();
    var mensagem = regra(valor, formulario);
    if (mensagem) {
      mostrarErro(campo, mensagem);
      return false;
    }
    limparErro(campo);
    return true;
  }

  // ---------- Ligando tudo aos formulários ----------

  document.querySelectorAll("form[data-validar]").forEach(function (formulario) {
    // Ao enviar: confere todos os campos e bloqueia o envio se houver erro
    formulario.addEventListener("submit", function (evento) {
      var primeiroComErro = null;
      Array.prototype.forEach.call(formulario.elements, function (campo) {
        if (campo.type === "checkbox" || campo.type === "submit" || campo.type === "button") return;
        if (!validarCampo(formulario, campo) && !primeiroComErro) {
          primeiroComErro = campo;
        }
      });
      if (primeiroComErro) {
        evento.preventDefault();
        primeiroComErro.focus(); // leva o usuário direto ao primeiro erro
      }
    });

    // Ao sair de um campo preenchido: confere só aquele campo
    // (campos vazios só são cobrados ao enviar, para não irritar quem está só passando por eles)
    formulario.addEventListener("focusout", function (evento) {
      var campo = evento.target;
      if (campo.name && (campo.value !== "" || campo.getAttribute("aria-invalid") === "true")) {
        validarCampo(formulario, campo);
      }
    });

    // Enquanto digita num campo com erro: some o erro assim que ficar certo
    formulario.addEventListener("input", function (evento) {
      var campo = evento.target;
      if (campo.getAttribute("aria-invalid") === "true") {
        validarCampo(formulario, campo);
      }
      // Se mudou a senha e a confirmação já foi preenchida, confere a confirmação de novo
      if (campo.name === "senha" && formulario.elements.confirmacao && formulario.elements.confirmacao.value) {
        validarCampo(formulario, formulario.elements.confirmacao);
      }
    });
  });
})();
