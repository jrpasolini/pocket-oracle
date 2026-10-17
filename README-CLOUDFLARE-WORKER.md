# Worker de interpretação — Pocket Oracle

**Repositório:** `jrpasolini/pocket-oracle` · **Worker:** `pocket-tarot-ai` · **API:** `https://api.jrpasolini.tech`.

O `cloudflare-worker.js` mantém a lógica de interpretação, narração e tratamento de erros. A versão **1.9.1** presente no GitHub só aparecerá em `/health` após um deploy correspondente na Cloudflare. Nunca confunda *commit* com *deploy*.

## Ambiente e rotas

- Bindings: Workers AI com nome `tarot-ai` (ou fallback `AI`), secrets `ELEVENLABS_API_KEY` e `NARRATION_SIGNING_KEY`, variável `ELEVENLABS_VOICE_ID` e allowlist `ALLOWED_ORIGINS`.
- Endpoints: `GET /health`, `POST /interpretar` e `POST /narrar`.
- `workers_dev = false` e `preview_urls = false` estão configurados no `wrangler.toml`; **confirme também os estados remotos** de workers.dev, Version/Preview URLs e eventuais aliases pelo painel/API.
- A rota oficial é **`api.jrpasolini.tech/*` → `pocket-tarot-ai`** (`request_limit_fail_open: false`, fail closed), **gerenciada fora do `wrangler.toml`** — o arquivo NÃO declara essa rota ativa de propósito (um deploy reconcilia `routes` e pode sobrescrevê-la). Em 16/10 a zona estava com o **curinga** `*.jrpasolini.tech/*`; ele foi **estreitado** para `api.jrpasolini.tech/*` via `PUT` no próprio ID da rota (`e9ecc359…`). Conferir com `GET /zones/<zone_id>/workers/routes`; a permissão necessária é **Zona → Workers Routes → Editar**; o rollback (reabrir o curinga) está documentado no `DEPLOY.md`. O DNS é um **CNAME proxied** que controlamos (`api` → `<worker>.workers.dev`).
- Uma regra WAF de rate limiting foi informada no handover da Melissa (30 requisições / 10 segundos por IP e colo; `http.host eq "api.jrpasolini.tech"`). Essa configuração vive na Cloudflare e deve ser conferida pela API, pois não é gerenciada pelo código do Worker.
- O CORS autoriza apenas origens permitidas; **CORS não é autenticação**.

## Validação e atualização

1. Confira o commit da `main`, o código e os bindings atuais no painel. **Não substitua secrets existentes**.
2. Execute `npm test` (ou `node --test tests/*.test.mjs`) sem usar créditos dos provedores.
3. Antes de implantar, compare `wrangler.toml` com configurações, domínio, rota, variáveis e secrets efetivos. Se o deploy tentar remover ou substituir uma rota, interrompa e peça aprovação.
4. Com autorização e credenciais apropriadas, use `wrangler deploy --config wrangler.toml` ou o mecanismo de implantação já empregado. Isso altera produção; o push no GitHub não publica automaticamente o Worker.
5. Verifique `https://api.jrpasolini.tech/health`: nome `pocket-tarot-ai`, versão esperada e `narration` conforme as duas chaves. Uma resposta 200 não comprova inferência nem narração.
6. Confira `OPTIONS` e allowlist de origens, um erro de payload inválido e, somente com autorização, uma interpretação e uma narração reais de baixo volume. Verifique Render e GitHub Pages, além da PWA instalada.
7. Depois do deploy, confirme que `workers.dev`, Version URLs, Preview URLs e rotas antigas não expõem a API fora do WAF. Prepare rollback antes de mudanças de DNS/WAF.

## Política de fallback e limites

- **Gemma 4** é prioritária; **Llama 3.3** é fallback.
- `3036` (cota diária da conta esgotada): parar a cascata, sem chamar Llama, e responder HTTP 429.
- `3040` (capacidade temporariamente indisponível): fallback pode ser tentado dentro do orçamento.
- `5035` (modelo exige plano pago): fallback para outro modelo disponível pode ser tentado; nunca fazer upgrade automático.
- Resposta inválida ou timeout de fatia: pode justificar fallback, preservando as restrições de validação e os tempos atuais (Gemma 60 s, total 100 s, navegador 105 s). `Promise.race` não garante cancelamento do processamento remoto.
- O rate limiter em memória do Worker é secundário, por isolate; não substitui uma regra de borda e não estabelece cota global exata.

Veja também [`DEPLOY.md`](DEPLOY.md) para a sequência de implantação.

## Proteção da narração ElevenLabs (obrigatória antes de publicar)

O endpoint `/narrar` **não aceita mais texto ou leitura arbitrários**. Uma
interpretação legítima retorna `narrationToken` (autorização HMAC com duração
de dez minutos) e o navegador o envia para `/narrar`:

```json
{ "narrationToken": "<token obtido de /interpretar>" }
```

No painel **Settings → Variables and Secrets**, configure os secrets:

- `ELEVENLABS_API_KEY`: chave privada da ElevenLabs, nunca no frontend.
- `NARRATION_SIGNING_KEY`: segredo aleatório independente, com **pelo menos
  32 caracteres**, usado para assinar as narrações. Gere um valor com um
  gerador criptograficamente seguro; não o envie para GitHub ou screenshots.

Sem os dois secrets, a interpretação continua funcionando, mas o botão de
narração não aparece. Configurar apenas `ELEVENLABS_API_KEY` não habilita a
voz. **Atualize o frontend e o Worker juntos** quando publicar essa mudança.

O token pode ser reutilizado até expirar. Isto não resolve sozinho abuso dos
endpoints pagos; ainda é necessário configurar limites globais de requisições,
proteção contra automação, alertas de consumo e limites de orçamento na
Cloudflare e na ElevenLabs. O limitador atual em memória do Worker é apenas
uma barreira secundária. Não considere CORS uma forma de autenticação.

## Idioma da narração (PT/EN)

O idioma da leitura é fixado quando o usuário solicita a interpretação:
`idioma: "pt"` ou `idioma: "en"`. O Worker inclui esse valor no token
assinado de narração, padroniza as posições da tiragem de três cartas
(`Passado/Presente/Futuro` ou `Past/Present/Future`) e envia
`language_code` correspondente para a ElevenLabs. O cliente não pode
alterar o idioma apenas manipulando a chamada `/narrar`.

Ao alternar o idioma do site, a leitura e o áudio antigos são invalidados,
mas as cartas sorteadas permanecem. É necessário solicitar uma **nova**
interpretação para ouvir a leitura no novo idioma; isso pode gerar uma
nova chamada cobrada ao serviço de IA. A PWA também recebeu uma nova
versão do cache, para atualizar os scripts bilíngues instalados.

A configuração do idioma orienta a narração, mas não traduz
automaticamente frases que um modelo eventualmente produza no idioma
errado. Confira uma tiragem de três cartas em cada idioma no ambiente
publicado antes de submeter o projeto.
