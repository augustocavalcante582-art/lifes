# Life (protótipo v0.2)

Loja e biblioteca de jogos para desktop, com visual roxo moderno e animações. É um **protótipo**: os jogos, amigos e posts são fictícios, o pagamento é simulado e o download é de mentira (só uma barra de progresso).

## Como abrir (Windows) — caminho mais simples

Precisa só do Node.js (https://nodejs.org, versão LTS).

1. Extraia o zip e abra a pasta que contém `server.js` e `package.json`.
2. Clique na barra de endereço do Explorador, digite `cmd` e aperte Enter.
3. Digite `node server.js` e aperte Enter. Deixe a janela preta aberta.
4. No navegador, abra `http://localhost:3737`.

Para parar, feche a janela preta. Não dê dois cliques nos arquivos `.js`: eles precisam ser executados pelo terminal.

## Como abrir como aplicativo (janela própria)

No terminal da pasta, rode `npm install` (baixa o Electron, uns 100 MB) e depois `npm start`. Na primeira vez que usar, o `npm start` é o único passo que ainda não foi testado em um computador real.

## O que tem

- **Início:** destaque rotativo com animação, ofertas com desconto e mais bem avaliados
- **Loja:** busca, filtro por gênero e ordenação (avaliação, desconto, lançamento, preço)
- **Página do jogo:** conquistas, amigos que jogam, sobre, requisitos de sistema (mínimos e recomendados)
- **Biblioteca:** abas Todos / Instalados / Favoritos, instalar com barra de progresso, jogar (sessão simulada que soma horas e pode liberar conquistas), desinstalar
- **Amigos e Comunidade:** dados de exemplo, com busca e curtidas
- **Downloads:** progresso em tempo real com velocidade e tempo restante
- **Carrinho:** compra simulada
- **Publicar jogo:** o dev cadastra um jogo e ele aparece na loja
- **Configurações:** nome do perfil e opção de reduzir animações
- Notificações no sino, busca global no topo

Os dados ficam na pasta `data-local` (modo navegador) ou na pasta de dados do app (modo Electron). Para voltar ao estado inicial, apague essa pasta. Se você já usou a versão 0.1, seus jogos comprados e publicados são mantidos.

## Testes

`npm test` roda os testes da API (não precisa do Electron).

## Como o projeto é organizado

- `main.js`: abre a janela do Electron
- `server.js`: a "loja" (catálogo, compra, biblioteca, favoritos, amigos, perfil). Hoje roda dentro do app; numa loja real seria um servidor na internet
- `public/`: a interface (HTML, CSS e JavaScript)
- `data/`: jogos, amigos e posts de exemplo

## Trocar as artes dos jogos

Cada jogo é desenhado só com cores e emoji, para o protótipo não usar imagens de terceiros. Quando você tiver artes próprias ou licenciadas, dá para trocar a função `art()` em `public/app.js` para mostrar imagens.

## O que falta para virar uma loja de verdade

Servidor hospedado, contas com login, pagamento real, envio e hospedagem dos arquivos dos jogos, atualizações, verificação de segurança dos jogos enviados, termos de uso e contratos com os desenvolvedores. Também faltam um instalador (`.exe`) e assinatura digital, senão o Windows avisa que o app é de "editor desconhecido".

## Aviso sobre conteúdo

Só coloque jogos na loja se tiver autorização por escrito de quem os criou. Jogos e artes de terceiros pertencem às respectivas empresas.
