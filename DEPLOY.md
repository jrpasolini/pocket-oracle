# Deploy do Worker — passo a passo

O Worker é o motor da leitura. Ele lê o PDF da tiragem e devolve a interpretação em JSON.
A versão atual usa uma **cascata de modelos**: **Gemma primeiro**, Llama como rede de segurança.

---

## Caminho A — pelo painel da Cloudflare (~2 minutos)

1. Abra `dash.cloudflare.com` → **Workers & Pages** → o Worker **`tarot-rider-waite-ai`**
2. Clique em **Edit code** (ou "Quick edit")
3. Apague **todo** o conteúdo do editor e cole o conteúdo de **`cloudflare-worker.js`** deste repositório
4. Confira o binding de IA — **Settings → Bindings**: precisa existir um binding **Workers AI** chamado **`tarot-ai`**
   - *(o código aceita `tarot-ai`; se você renomear, ele também aceita o nome padrão `AI`)*
5. **Deploy**
6. Teste o health no navegador:

```
https://tarot-rider-waite-ai.antonio-pasolini.workers.dev/health
```

Deve responder com os **dois** modelos na cascata:

```json
{"ok":true,"service":"tarot-rider-waite-ai","version":"1.1.0",
 "model":"@cf/meta/llama-3.3-70b-instruct-fp8-fast",
 "modelChain":["@cf/google/gemma-4-26b-a4b-it","@cf/meta/llama-3.3-70b-instruct-fp8-fast"],
 "status":"online"}
```

---

## Caminho B — por linha de comando

Se houver um token de API com **Workers Scripts: Edit** + **Workers AI: Read**:

```bash
npm i -g wrangler
wrangler deploy --config wrangler.toml
```

O `wrangler.toml` já está no repositório com o binding `tarot-ai` declarado.

---

## Como saber se a cascata está funcionando

Cada leitura agora devolve **`model`** e **`fallbacksUsed`** na resposta:

- **`fallbacksUsed: 0`** → o **Gemma deu conta sozinho** (JSON válido de primeira). É o cenário que a gente quer.
- **`fallbacksUsed: 1`** → o Gemma não entregou JSON válido e o Llama respondeu.

Medir é o ponto: **10 leituras** dizem se o Gemma se sustenta como motor único, ou se a rede de segurança é realmente necessária.

---

## O que mudou nesta versão (1.0.0 → 1.1.0)

| Antes | Agora |
| --- | --- |
| Motor único: `llama-3.3-70b` | **Cascata**: `gemma-4-26b` → `llama-3.3-70b` |
| `MODEL` fixo no código | `MODEL_CHAIN`, em ordem de preferência |
| — | `response_format: json_schema` só para modelos que suportam (o Gemma não suporta) |
| — | JSON pedido no prompt para os que não suportam, com validação na saída |
| — | `/health` mostra `modelChain`; a leitura mostra `model` e `fallbacksUsed` |

**Por que a cascata:** a Cloudflare documenta que o *JSON Mode* (saída estruturada garantida)
só funciona em uma lista curta de modelos — **e o Gemma não está nela**.
Chamar o Gemma direto com `json_schema` quebraria a leitura. A cascata resolve sem abrir mão do Gemma.
