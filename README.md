# BioClicky

Plataforma de comparação de preços de medicamentos. Node.js + Express + EJS. Sem React.
O BioClicky NÃO é uma farmácia: não vende, não tem carrinho nem pagamento.

## Como rodar
1. Abra a pasta no VS Code.
2. No terminal: `npm install`
3. `npm start` e acesse http://localhost:3000

## Mobile first
Todo CSS foi escrito primeiro para celular (320px). Tablet (`min-width: 768px`) e
computador (`min-width: 1025px`) só acrescentam regras nas media queries.

## O que cada arquivo faz
- `app.js` – configura Express, EJS, sessão e arquivos estáticos.
- `app/routes/router.js` – rotas do site (públicas, login/cadastro, área do usuário), divididas em `publico.js`, `auth.js` e `usuario.js`.
- `app/routes/router-adm.js` – rotas do ADM (`/adm`), divididas em `adm-remedios.js`, `adm-farmacias.js` e `adm-usuarios.js`.
- `app/validators/validacoes.js` – validação do servidor com express-validator.
- `app/public/js/validacao.js` – validação dos formulários no navegador.
- `app/data/*.json` – medicamentos e farmácias (DEMONSTRATIVOS), usuários, favoritos e histórico.
- `app/views/partials/head.ejs` – `<head>` e CSS de cada página.
- `app/views/partials/header.ejs` – logo + botões de acessibilidade e de tema.
- `app/views/partials/navegacao.ejs` – **navegação fixa embaixo** + painel de acessibilidade (`<dialog>`).
- `app/views/partials/footer.ejs` – rodapé e scripts.
- `app/public/css/home.css` – variáveis de tema, header, botões, cards, footer e página inicial.
- `app/public/css/navegacao.css` – barra inferior (celular) e dock flutuante (computador).
- `app/public/css/acessibilidade.css` – painel e modos: alto contraste, links, dislexia, espaçamento, cursor, sem animações.
- `app/public/js/tema.js` – tema claro/escuro (localStorage `bioclicky-tema`).
- `app/public/js/acessibilidade.js` – recursos de acessibilidade (localStorage `bioclicky-acess`), VLibras, leitor de voz, atalhos.
- `app/public/js/animacoes.js` – animação de entrada ao rolar a página.

## Área do ADM
- Entrada: faça login com um usuário do tipo `adm`. Ele vai direto para `/adm`.
- O primeiro ADM é criado sozinho na primeira vez que o site roda (se não existir nenhum ADM):
  e-mail `adm@bioclicky.com` e senha `admin123` (definidos em `app/routes/acesso.js`).
- `/adm` – painel com o total de remédios, farmácias e usuários.
- `/adm/remedios` – cadastrar, editar e excluir remédios (com o preço de cada farmácia).
- `/adm/farmacias` – cadastrar, editar e excluir farmácias (se mudar o nome, as ofertas acompanham).
- `/adm/usuarios` – tornar usuário em ADM (ou o contrário) e excluir usuários.
- A função `exigirAdm` (em `acesso.js`, usada no `router-adm.js`) bloqueia essas páginas para quem não é ADM.
- Arquivos novos: `views/pages/adm*.ejs`, `public/css/adm.css`, `public/js/adm.js`.
- Cada usuário tem o campo `tipo` (`"usuario"` ou `"adm"`) em `usuarios.json`.

## Acessibilidade
Tamanho do texto, alto contraste, destacar links, fonte para dislexia, espaçamento do texto,
cursor grande, pausar animações, Libras (VLibras), leitura em voz alta, foco visível,
link "Ir para o conteúdo", respeito a `prefers-reduced-motion` e atalhos
(Alt+A painel, Alt+C contraste, Alt+L ler, Alt+1 conteúdo).

## HTML semântico
Nenhuma página usa `<div>`. Listas de cards são `<ul><li><article>`, rodapé de card é `<footer>`,
grupos de título são `<hgroup>`, o painel é `<dialog>`.
Única exceção técnica: o widget VLibras (do Governo Federal) exige `div` e os cria por
JavaScript quando o usuário liga a opção Libras.

## Importante
- Medicamentos e farmácias em `app/data/*.json` são DEMONSTRATIVOS.
- Para trocar as farmácias parceiras: edite `app/data/farmacias.json` e use o MESMO nome em `ofertas[].farmacia` de `remedios.json`.
- Logos de farmácias: coloque em `app/public/imagens/farmacias/` e informe `"logo": "/imagens/farmacias/arquivo.png"`.
- Usuários ficam em `usuarios.json` (arquivo, não é banco de dados).
