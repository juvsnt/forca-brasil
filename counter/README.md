# Serviço de contagem — Forca Brasil

Produção: `https://forca-brasil-counter.jogo-forca-brasil.workers.dev/visits`.

- Worker: `forca-brasil-counter`.
- Banco D1: `forca-brasil-visitors`.
- Origem permitida: `https://juvsnt.github.io`.
- `POST /visits`: registra o IP recebido pela borda Cloudflare e retorna `{ "count": N }`.
- `GET /visits`: consulta o total sem registrar visita.
- O cabeçalho `Origin` deve corresponder à origem permitida.

O HMAC secreto fica exclusivamente no Worker, em `IP_HASH_SECRET`. Não altere esse segredo sem planejar a migração: uma troca faz o mesmo IP gerar outra identificação. Não publique o arquivo de credenciais do Wrangler. A configuração local `wrangler.jsonc` está ignorada pelo Git; a configuração de exemplo contém somente campos públicos.

## Recriar em outra conta

Execute na raiz do repositório:

1. `npx --yes wrangler@4 login`
2. `npx --yes wrangler@4 d1 create forca-brasil-visitors`
3. Copie `counter/wrangler.example.jsonc` para `counter/wrangler.jsonc` e preencha o ID de banco retornado. Se houver mais de uma conta, preencha também `account_id`.
4. `npx --yes wrangler@4 d1 execute forca-brasil-visitors --remote --file counter/schema.sql --config counter/wrangler.jsonc`
5. `npx --yes wrangler@4 deploy --config counter/wrangler.jsonc`
6. `npx --yes wrangler@4 secret put IP_HASH_SECRET --config counter/wrangler.jsonc` — forneça pelo terminal um segredo aleatório de pelo menos 32 caracteres; nunca pelo chat ou em arquivo público.
7. Atualize `counter-config.js` com o endereço retornado, acrescentando `/visits`, e publique o frontend.

O índice único dos HMACs impede duplicações. Um gatilho incrementa o total apenas quando uma identificação nova é inserida; a inserção e a leitura usam uma transação D1. A tabela de totais evita percorrer todos os visitantes em cada acesso. O serviço usa o IP da Cloudflare, nunca um parâmetro informado pelo navegador.

Documentação: [D1 e transações](https://developers.cloudflare.com/d1/worker-api/d1-database/) e [cabeçalhos da Cloudflare](https://developers.cloudflare.com/fundamentals/reference/http-headers/).

## Ranking global

A rota /ranking usa o mesmo Worker e banco, com uma tabela separada scores. Antes de atualizar o Worker, execute na raiz:

`npx --yes wrangler@4 d1 execute forca-brasil-visitors --remote --file counter/ranking.sql --config counter/wrangler.jsonc`

Depois execute o deploy habitual. A migração é aditiva e não altera as visitas existentes. GET /ranking retorna entries com até 10 resultados. POST /ranking recebe JSON com id (UUID v4), name e rounds (word e guesses), limitado a 16 KiB. O resultado numérico é calculado no servidor. A chave única evita duplicação no reenvio. Em empate de pontos e acertos, o registro mais antigo vem primeiro e o ID estabiliza a ordenação.

Os resultados ficam em scores; somente os 10 melhores são exibidos. Não há cadastro, soma por apelido nem importação automática do ranking local antigo. O catálogo words.json deve acompanhar o catálogo do jogo; os testes verificam a equivalência. A validação de rodadas é básica e não substitui um jogo integralmente controlado pelo servidor contra automação.
