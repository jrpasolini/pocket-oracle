# Implantação do Pocket Oracle — Worker e API

**Worker:** `pocket-tarot-ai` · **Origem:** `cloudflare-worker.js` · **API:** `https://api.jrpasolini.tech`.

> A versão **1.9.1** no GitHub não é necessariamente a que está implantada na Cloudflare. Compare o hash do código implantado e `/health` antes de declarar o deploy concluído.

## Antes de alterar produção

1. Confirme que a conta e a zona Cloudflare são as do domínio `jrpasolini.tech` e que existe somente um Worker alvo: `pocket-tarot-ai`.
2. Verifique os bindings e secrets existentes (`tarot-ai`, `ELEVENLABS_API_KEY`, `NARRATION_SIGNING_KEY`) sem divulgar valores.
3. Exporte o estado das rotas, DNS, rate limiting, versões implantadas e variáveis. Prepare procedimento de rollback.
4. **A rota oficial é `api.jrpasolini.tech/*` → `pocket-tarot-ai`**, com `request_limit_fail_open: false` (**fail closed**). Ela é **gerenciada fora do `wrangler.toml`** (API/painel) e está **comentada** no arquivo de propósito: um `wrangler deploy` pode reconciliar `routes` e sobrescrever a configuração manual.
   - **Conferir:** `GET https://api.cloudflare.com/client/v4/zones/{zone_id}/workers/routes` — deve existir **uma** rota: `api.jrpasolini.tech/*` → `pocket-tarot-ai`. Nenhuma rota curinga.
   - **Permissão necessária:** escopo de **Zona → Workers Routes → Editar**, com a zona `jrpasolini.tech`.
   - **Rollback da rota:** `PUT .../workers/routes/{route_id}` com `{"pattern":"*.jrpasolini.tech/*","script":"pocket-tarot-ai","request_limit_fail_open":false}` — isso **reabre o curinga** (estado anterior a 16/10; evitar, pois fica mais amplo que o WAF).
   - **Histórico:** em 16/10 a zona estava com `*.jrpasolini.tech/*` (curinga). A rota foi **estreitada** para `api.jrpasolini.tech/*` via `PUT` no **próprio ID** (`e9ecc359…`), preservando o vínculo com o Worker e o fail closed. O WAF cobre apenas o hostname `api`.
5. O DNS proxied da migração aponta, segundo o handover, para `pocket-tarot-ai.antonio-pasolini.workers.dev`. Embora a rota estivesse funcional, essa dependência deve ser reavaliada; prefira Custom Domain nativo após planejar uma migração reversível.
6. `workers_dev = false` e `preview_urls = false` são a configuração desejada. Confirme via API que nenhuma URL alternativa continua atendendo requisições.

## Alterações no código e testes

Em um ambiente com Node.js 22 ou superior, execute:

```bash
npm test
```

Sem `npm`, o comando equivalente é:

```bash
node --test tests/*.test.mjs
```

Os testes são locais e usam mocks: **não consomem Workers AI Neurons nem créditos ElevenLabs**.

Para implantar, com autorização e acesso Cloudflare apropriado:

```bash
wrangler deploy --config wrangler.toml
```

**Atenção:** o deploy pode sincronizar configurações e vinculações da conta. Interrompa se houver aviso de remoção de rota, variável ou binding não planejada. O frontend e o Worker são implantados de maneira independente.

## Verificação após o deploy

1. Faça `GET https://api.jrpasolini.tech/health`. Esperado: `service: pocket-tarot-ai`, `version: 1.9.1` e `narration: true` apenas se as duas chaves de narração estiverem configuradas.
2. Confira `OPTIONS /interpretar` das origens autorizadas; o preflight deve responder 204. Uma origem ilegítima deve ser recusada.
3. Envie JSON inválido para `/interpretar` para conferir resposta 4xx sem chamada ao modelo.
4. Com aprovação, execute uma leitura real e confirme `model`, `fallbacksUsed` e o esquema JSON. Com narração configurada, valide `/narrar` com um token recém-assinado.
5. Confira a publicação do frontend e a atualização do service worker: o cache **v19** deve conter `js/app.js` com `API_BASE = 'https://api.jrpasolini.tech'`. Teste também uma instalação pré-existente da PWA.
6. Valide as configurações WAF pela API; no handover havia uma regra de **30 requisições / 10 segundos** para todo o hostname `api.jrpasolini.tech`. Verifique se `OPTIONS`, `GET /health` e outros caminhos são contados; evite rajadas artificiais de produção.
7. Confirme rotas `workers.dev`, Version/Preview URLs e DNS órfãos. Não remova registros TXT vinculados a outros serviços sem atribuição confirmada.

## Regras da cascata Gemma → Llama

| Evento | Ação |
| --- | --- |
| `3036` — cota diária da conta | **Interromper**, sem executar fallback, responder 429 |
| `3040` — capacidade transitória | Permitir fallback se houver orçamento |
| `5035` — modelo exige Workers Paid | Permitir modelo alternativo compatível, sem upgrade |
| Resposta inválida ou timeout de fatia | Permitir fallback, conservando o orçamento total |

**Tempos:** até 60 s por tentativa, 100 s no Worker, 105 s no navegador. O timeout via `Promise.race` não prova cancelamento remoto.

## Segurança, limites e recuperação

Não exponha secrets, payloads pessoais ou narrações em logs. O `requestId` permite correlacionar incidentes sem imprimir perguntas. `CORS` não substitui autenticação e o limitador em memória do Worker não é distribuído.

Se houver regressão após implantar o Worker, use a versão anterior conhecida, preserve os bindings e confirme a rota atual antes de reverter. Não reative `workers.dev` como atalho sem avaliar a exposição fora do WAF.
