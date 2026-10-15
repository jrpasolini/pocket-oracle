# Worker de interpretação do Tarot

O arquivo `cloudflare-worker.js` é o código do Worker `tarot-rider-waite-ai`.

## Configuração no painel da Cloudflare

1. Abra **Workers & Pages → tarot-rider-waite-ai → Editar código**.
2. Substitua o conteúdo do editor por `cloudflare-worker.js`.
3. Confirme em **Bindings** que o Workers AI está vinculado com o nome exato `tarot-ai`.
4. Clique em **Deploy**.
5. Abra `https://tarot-rider-waite-ai.antonio-pasolini.workers.dev/health` e confirme que a resposta contém `"ok": true`.

O frontend já aponta para:

`https://tarot-rider-waite-ai.antonio-pasolini.workers.dev/interpretar`

## Contrato

- `GET /health`: confirma que o Worker está publicado.
- `POST /interpretar`: recebe uma pergunta e uma tiragem de uma ou três cartas.
- Modelo prioritário: `@cf/google/gemma-4-26b-a4b-it` (fallback: Llama 3.3).
- Origens liberadas: GitHub Pages de `jrpasolini` e servidor local nas portas documentadas.
- A resposta usa JSON estruturado e é renderizada no site somente como texto.

O Tarot continua funcionando como galeria, PWA e oráculo offline. Apenas a interpretação com IA exige conexão.


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
