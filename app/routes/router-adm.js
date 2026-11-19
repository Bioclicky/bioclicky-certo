// ============================================================
// router-adm.js - Rotas do ADM (o app.js usa este arquivo em "/adm").
// Junta as telas de remédios, farmácias e usuários.
// ============================================================
const express = require("express");
const { ler } = require("./dados");
const { exigirAdm } = require("./acesso");

const router = express.Router();

// Tudo que passa por aqui exige ADM
router.use(exigirAdm);

// PAINEL PRINCIPAL: totais do sistema. (URL: /adm)
router.get("/", (req, res) => {
  const totais = {
    remedios: ler("remedios.json").length,
    farmacias: ler("farmacias.json").length,
    usuarios: ler("usuarios.json").length
  };
  res.render("pages/adm", { titulo: "Painel do ADM", pagina: "adm", totais });
});

router.use("/remedios", require("./adm-remedios"));
router.use("/farmacias", require("./adm-farmacias"));
router.use("/usuarios", require("./adm-usuarios"));

module.exports = router;
