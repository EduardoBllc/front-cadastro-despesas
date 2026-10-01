# Importação de despesa via NFC-e (SEFAZ RS) — Design

**Data:** 2026-09-30
**Repos afetados:** `api-cadastro-despesas` (backend) e `front-cadastro-despesas` (front)

## Objetivo

Cadastrar uma compra (tipicamente de mercado) sem digitar item a item: o usuário cola o link do
QR Code da NFC-e — ou lê o QR pela webcam — e o formulário de nova despesa abre preenchido para
revisão. Ao salvar, o sistema aprende os vínculos produto da nota → item do catálogo, de modo que
a partir da segunda compra na mesma rede quase nada precise de ajuste manual.

## Decisões

| Tema | Decisão |
|---|---|
| Itens da nota | Vínculo aprendido por `(cnpj_raiz, codigo_produto) → item_id`; 1ª vez o usuário vincula, depois vem automático |
| Entrada do link | Colar URL **e** ler QR pela webcam do PC (sem HTTPS/rede local) |
| Estabelecimentos | Um por filial → coluna `cnpj` única no próprio estabelecimento |
| Fluxo | Rascunho stateless no import + gravação de chave/CNPJ/vínculos na mesma transação do `POST /despesas` (abordagem A) |
| Estados | Somente RS (chave começando com `43`) |
| Conflitos de vínculo | "Última escolha vence" (CNPJ e vínculos de produto são sobrescritos) |

## Fora de escopo

- Outros estados / outros layouts de DANFE NFC-e.
- Leitura de QR no celular (exigiria HTTPS no dev server).
- Edição de despesa alterar vínculos; campo `chave_nfce` na resposta da despesa.
- Criação automática de itens no catálogo a partir da descrição da nota.
- E2E (ver "Testes").

## 1. Dados (backend, migração Alembic única)

- `estabelecimentos.cnpj` — `VARCHAR(14)`, nullable, `UNIQUE`; somente dígitos.
- `despesas.chave_nfce` — `CHAR(44)`, nullable, `UNIQUE`.
- Nova tabela `vinculos_produto_nfce` (herda `BaseModel`: `id`, `data_cadastro`, `data_alteracao`):
  - `cnpj_raiz` `VARCHAR(8)` — 8 primeiros dígitos do CNPJ (compartilha vínculo entre filiais).
  - `codigo_produto` `VARCHAR(60)`.
  - `item_id` FK `itens.id` `ON DELETE CASCADE`.
  - `UNIQUE (cnpj_raiz, codigo_produto)`.
- Modelo novo registrado em `app/models/__init__.py`; schema de `Estabelecimento` (criar/atualizar/
  resposta) **não** expõe `cnpj` nesta entrega — ele só é gravado pelo fluxo de importação.

## 2. Backend — importação `POST /nfce/importar`

Router novo `app/routers/nfce.py` (prefixo `/nfce`), registrado em `app/main.py`.

**Entrada:** `{ "url": str }` — o link completo do QR Code.

**Fluxo (`app/services/nfce.py`):**

1. **Validar:** extrair o parâmetro `p` da URL (`urllib.parse`). Formato aceito: chave de 44 dígitos
   iniciando em `43`, seguida de campos separados por `|` (alfanuméricos). Falha → 422.
2. **Buscar:** o backend **nunca** acessa a URL recebida; monta
   `https://dfe-portal.svrs.rs.gov.br/Dfe/QrCodeNFce?p=<p>` (constante) e faz GET com
   `httpx.AsyncClient`, timeout 10 s. `httpx` passa de dependência dev para runtime (já está no
   lock). Erro de rede, timeout ou status ≥ 500 → 502. A busca fica numa função isolada
   (`buscar_html(p)`) para ser substituída nos testes.
3. **Parsear (`app/services/nfce_parser.py`):** função pura `parse(html: str) -> NotaNfce` usando
   `html.parser` da stdlib, guiada pelas classes estáveis do DANFE (`txtTopo`, `text`, `txtTit`,
   `RCod`, `Rqtd`, `RUN`, `RvlUnit`, `valor`, `totalNumb`, chave em `.chave`, número/emissão em
   `#infos`). Extrai:
   - emitente: razão social, CNPJ (só dígitos), endereço (texto normalizado em uma linha);
   - data de emissão (`date`), chave (44 dígitos);
   - itens: código, descrição, quantidade, unidade, valor unitário, valor total;
   - valor total bruto, desconto, valor a pagar.
   Valores convertidos de formato pt-BR (`1,25`) para `Decimal`. Estrutura ausente → exceção do
   parser → 422.
4. **Duplicidade:** se existir `Despesa` com `chave_nfce` igual → 409 com a data da despesa.
5. **Resolver:**
   - `estabelecimento_id` = estabelecimento com `cnpj` igual, ou `null`;
   - para cada item, `item_id` do vínculo `(cnpj[:8], codigo)`, ou `null`.
6. **Ratear desconto** (`ratear_desconto`, função pura):
   - `parcela_i = desconto × total_i / soma_totais`;
   - `desconto_unitario_i = round(parcela_i / quantidade_i, 2)` com `ROUND_HALF_UP` (mesmo
     arredondamento do `NUMERIC` do Postgres);
   - total do item calculado como no banco: `round((valor_unitario − desconto_unitario) × qtd, 2)`;
   - se a soma diferir do valor pago, a diferença é aplicada ao desconto unitário do **primeiro
     item com quantidade 1**; sem esse item, a diferença é mantida.

**Resposta (`RascunhoNfce`, nada é persistido):**

```
chave: str
data_emissao: date
cnpj: str
razao_social: str
endereco: str
estabelecimento_id: UUID | null
valor_pago: Decimal
desconto_total: Decimal
itens: [{
  codigo: str
  descricao_nota: str
  unidade_nota: str
  quantidade: Decimal
  valor_unitario: Decimal
  valor_desconto: Decimal      # por unidade, já rateado
  item_id: UUID | null
}]
```

## 3. Backend — gravação no `POST /despesas`

Campos novos, todos opcionais (criação manual não muda):

- `CriarDespesa.nfce: OrigemNfce | None` — `{ chave: str (44 dígitos), cnpj: str (14 dígitos) }`.
- `CriarDespesa.itens` passa a usar `CriarItemDespesaNfce(CriarItemDespesa)`, que acrescenta
  `codigo_produto_nfce: str | None` — excluído do `model_dump()` que cria o `ItemDespesa`. Subclasse
  (e não campo em `CriarItemDespesa`) porque `POST /despesas/{id}/itens` faz
  `ItemDespesa(**body.model_dump())` com `CriarItemDespesa`.

Com `nfce` presente, na mesma transação de `despesas.criar`:

1. Chave já usada → 409 (checagem explícita; o `UNIQUE` fica como segunda proteção).
2. `despesa.chave_nfce = nfce.chave`.
3. CNPJ: se outro estabelecimento tiver esse CNPJ, ele é limpo; o estabelecimento escolhido recebe
   o CNPJ (sobrescreve um CNPJ anterior, se houver).
4. Para cada item com `codigo_produto_nfce`: upsert em `vinculos_produto_nfce`
   (`INSERT ... ON CONFLICT (cnpj_raiz, codigo_produto) DO UPDATE SET item_id`), usando o
   `item_id` final enviado pelo front.

Excluir a despesa libera a chave (a nota pode ser reimportada). `PATCH`/edição não muda.

## 4. Front

Arquivos novos:

- `src/api/nfce.ts` — `importarNfce(url: string): Promise<RascunhoNfce>`.
- `src/components/ImportarNfceModal.vue` — campo "Cole o link do QR Code" + botão "Importar" +
  botão "Ler pela webcam". Mostra erro da API no próprio modal. Sucesso → `emit('importado', r)`.
  `data-cy`: `input-nfce-url`, `btn-importar-nfce`, `btn-ler-webcam`, `nfce-erro`.
- `src/components/LeitorQrCode.vue` — `getUserMedia` (câmera traseira/padrão) → `<video>` →
  quadros em `<canvas>` via `requestAnimationFrame` → `jsQR` (import dinâmico, carregado só ao
  abrir). Ao decodificar, `emit('lido', texto)`. Ao desmontar, para todas as tracks. Falha de
  permissão/dispositivo → `emit('erro', ...)`. Dependência nova: `jsqr`.

Tipos (`src/types/api.ts`): `RascunhoNfce`, `ItemRascunhoNfce`, `OrigemNfce`;
`CriarDespesaPayload.nfce?`; `CriarItemPayload.codigo_produto_nfce?`;
`ItemFormState.codigo_produto_nfce?` e `ItemFormState.descricao_nota?`.

`DespesaForm.vue`:

- Botão "Importar NFC-e" (`data-cy="btn-importar-nfce-abrir"`) no cabeçalho, somente em criação.
- `popularDeRascunho(r)` substitui o conteúdo do formulário:
  - `data_despesa` = `data_emissao`;
  - `estabelecimento_id` = vinculado ou vazio; quando vazio, aviso
    `"<razão social> · <CNPJ formatado> · <endereço>"` (`data-cy="nfce-estabelecimento-aviso"`);
  - itens vinculados: `item_id`, unidade do item do catálogo, quantidade, valor unitário,
    desconto, `codigo_produto_nfce`, `descricao_nota`;
  - itens sem vínculo: mesmos valores com `item_id` vazio, `descricao_nota` preenchida e unidade
    pré-selecionada quando a descrição de alguma `UnidadeMedida` bate (case-insensitive) com
    `unidade_nota`;
  - categoria: sugestão existente, disparada pelo `watch` de `estabelecimento_id` — por isso
    `popularDeRascunho` **não** liga a flag `inicializando` (que suprime a sugestão na edição);
  - guarda `origemNfce = { chave, cnpj }`.
- `ItemFormRow.vue` exibe `"Na nota: <descricao_nota> · <unidade_nota>"` quando
  `descricao_nota` existe (`data-cy="item-descricao-nota"`). Toda linha vinda da nota — vinculada
  ou não — recebe `descricao_nota`, para o usuário conferir (e corrigir) vínculos já aprendidos.
- Submit bloqueado enquanto houver linha com `codigo_produto_nfce` e sem `item_id`:
  erro "Vincule todos os itens da nota".
- Payload inclui `nfce: origemNfce` e `codigo_produto_nfce` por item. `resetForm()` limpa
  `origemNfce` ("Salvar e começar outra" e "Cancelar").

## 5. Erros

Mensagens em enum no backend (conjunto fechado). Todas chegam ao front via `detail`, que o
`client.ts` já propaga como `Error.message`.

| Situação | HTTP | Mensagem |
|---|---|---|
| Link inválido / não-RS | 422 | Link de NFC-e inválido (somente RS) |
| SEFAZ fora, timeout, 5xx | 502 | SEFAZ indisponível, tente novamente |
| HTML sem a estrutura esperada | 422 | Nota não encontrada ou formato desconhecido |
| Nota já importada (import ou save) | 409 | Nota já importada (despesa de dd/mm/aaaa) |
| Webcam negada/ausente (front) | — | Não foi possível acessar a câmera |

## 6. Testes

**Backend** (`pytest`, testcontainers):

- `tests/fixtures/nfce_rs.html` — HTML real desta nota com **CPF do consumidor substituído por um
  fictício**.
- Parser: 14 itens, totais (146,50 / 14,65 / 131,85), CNPJ, data 19/08/2026, chave, endereço;
  HTML inválido → exceção.
- Rateio: soma = valor pago na fixture; caso sintético forçando sobra de centavos.
- Validação de `p`: válido, outro estado, malformado.
- `POST /nfce/importar` com `buscar_html` substituído (sem rede): resolução de estabelecimento e
  itens, 409, 502.
- `POST /despesas` com `nfce`: grava chave, CNPJ e vínculos; segundo import da mesma rede volta
  vinculado; duplicata → 409; CNPJ movido entre estabelecimentos.

**Front** (Jest):

- `ImportarNfceModal`: colar → chama API → emite rascunho; erro exibido.
- `DespesaForm`: mapeamento do rascunho, bloqueio de submit com item sem vínculo, payload com
  `nfce` e códigos.
- `LeitorQrCode`: sem teste unitário (depende de câmera); verificação manual com webcam.

**E2E:** não incluído. A config atual é inconsistente (`npm run dev` usa porta 4200; Cypress e
`test:e2e` esperam 5173) e não há servidor/porta isolados do ambiente de dev.

**Pré-existente:** `tests/unit/DespesaForm.test.ts` já falha na `main` (6 testes, `fetch is not
defined` — falta mock de alguma API chamada no `onMounted`). Os testes novos de `DespesaForm`
exigem corrigir esse mock primeiro.
