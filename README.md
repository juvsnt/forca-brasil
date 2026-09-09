# Forca Brasil

Jogo da forca interativo desenvolvido com HTML, CSS e JavaScript, utilizando palavras e assuntos conhecidos pelos brasileiros.

## Recursos

- identificação do jogador pelo nome;
- cinco níveis de dificuldade progressiva;
- palavras e expressões em português brasileiro;
- categorias como cultura, culinária, esportes, geografia e cotidiano;
- desenho progressivo da forca;
- sons diferentes para acertos e erros;
- pontuação baseada no nível e nas tentativas restantes;
- ranking dos melhores resultados;
- teclado virtual e suporte ao teclado físico;
- uma dica indireta por palavra, com uma única abertura por rodada e sem perder pontos;
- contador compartilhado de visitas únicas por IP, hospedado na Cloudflare;
- interface responsiva para computadores e dispositivos móveis.

## Executar localmente

O jogo pode ser aberto localmente sem instalação. O contador e o ranking global exigem conexão e funcionam no endereço publicado autorizado na Cloudflare.

1. Baixe ou clone o repositório.
2. Abra o arquivo `index.html` em um navegador moderno.

## Publicação

Este projeto pode ser publicado diretamente pelo GitHub Pages a partir da branch `main` e da pasta raiz do repositório.

Endereço previsto:

<https://juvsnt.github.io/forca-brasil/>

## Ranking

O ranking global usa o mesmo Worker Cloudflare e banco D1 do contador, em uma tabela separada. Exibe as 10 melhores partidas de todos os dispositivos, ordenadas por pontos, acertos e ordem de registro em caso de empate. Não soma partidas nem identifica pessoas pelo nome: apelidos iguais podem pertencer a pessoas diferentes e uma pessoa pode ter mais de um resultado.

Ao terminar uma partida, o navegador envia seu identificador, nome ou apelido e letras tentadas em cada rodada. O servidor verifica as palavras, a progressão e o encerramento das rodadas, recalcula pontos e acertos e guarda o resultado uma única vez. O nome ou apelido informado torna-se público junto do resultado, como avisado na tela inicial. Não é necessário cadastro.

Se o envio falhar, o resultado fica pendente no navegador e é reenviado ao abrir ou atualizar o ranking. O armazenamento local antigo é preservado, mas seus resultados não são importados: eles não contêm as rodadas necessárias à validação. Novas partidas alimentam o ranking global.

A validação impede números arbitrários e sequências impossíveis, mas não prova que um humano jogou: as palavras continuam públicas no frontend. Este é um ranking recreativo, sem autenticação de jogadores ou proteção completa contra automação.

## Dicas

As 25 palavras possuem pistas próprias em `hints.js`. O botão **Quero uma dica** abre uma janela sem limite de tempo de leitura. Ao fechar, inclusive com Escape, a dica é apagada da janela e não pode ser reaberta naquela rodada. A próxima palavra disponibiliza outra dica. O teclado do jogo fica suspenso enquanto a janela está aberta. A pontuação é preservada.

## Contador de visitas

A faixa acima da autoria apresenta o total acumulado de IPs únicos desde a ativação em setembro de 2026. O jogo continua no GitHub Pages; o contador e o ranking usam Cloudflare Workers e D1. O navegador envia uma visita ao carregar a página. Recarregar, abrir outra aba ou apagar o armazenamento local não duplica o mesmo IP.

O Worker recebe o IP pelo cabeçalho da Cloudflare e armazena apenas um HMAC-SHA-256, calculado com segredo mantido na Cloudflare. As tabelas do contador não gravam IPs em texto, nomes de jogadores ou histórico individual de visitas. O ranking guarda nome ou apelido e resultado em uma tabela separada, sem associação aos IPs do contador. O serviço retorna apenas o total. Os registros operacionais da plataforma seguem as configurações da Cloudflare.

IPs não equivalem exatamente a pessoas: usuários na mesma rede podem compartilhar IP, e uma mesma pessoa pode acessar por IPs diferentes. A contagem não recupera acessos anteriores, não expira diariamente e não é uma medição antifraude. Clientes sem JavaScript, bloqueadores e indisponibilidade de rede podem impedir o registro. A restrição de origem limita o uso por outros sites no navegador, mas não autentica clientes fora dele.

O endereço público está em `counter-config.js`, sem credenciais. Em caso de falha, a faixa é ocultada e o jogo continua normalmente, sem exibir números fictícios.

Para manutenção do serviço, veja [counter/README.md](counter/README.md).

## Verificação

Com Node.js 24 ou mais recente, execute `node --test tests/*.test.mjs`. Os testes cobrem as dicas nos cinco níveis, o bloqueio após fechar, IPs repetidos e equivalentes, gravação atômica e estados da interface do contador.

## Autoria

Desenvolvido pelo **Prof. JNeto**.
