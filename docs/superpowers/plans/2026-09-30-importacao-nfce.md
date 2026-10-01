# Importação de despesa via NFC-e — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar uma NFC-e do RS (link colado ou QR lido pela webcam) e abrir o formulário de nova despesa preenchido, aprendendo vínculos produto da nota → item do catálogo ao salvar.

**Architecture:** O backend expõe `POST /nfce/importar`, que valida o parâmetro `p` do link, busca o DANFE na SEFAZ RS por URL constante, parseia o HTML (stdlib), rateia o desconto e devolve um rascunho sem persistir nada. O `POST /despesas` passa a aceitar a origem da nota e, na mesma transação, grava a chave (única), o CNPJ do estabelecimento e os vínculos `(cnpj_raiz, código) → item`. No front, um modal de importação (colar link / webcam com `jsqr`) entrega o rascunho ao `DespesaForm`, que preenche os campos e bloqueia o salvamento enquanto houver item da nota sem vínculo.

**Tech Stack:** FastAPI 0.136 + SQLAlchemy 2 async + Alembic + Postgres 17, `httpx` 0.28.1, pytest + testcontainers (backend); Vue 3 `<script setup>` + TypeScript + Tailwind, Jest + @vue/test-utils, `jsqr` 1.4.0 (front).

**Spec:** `front-cadastro-despesas/docs/superpowers/specs/2026-09-30-importacao-nfce-design.md`

**Repos:** `API` = `/home/ballico/Projetos/api-cadastro-despesas`, `FRONT` = `/home/ballico/Projetos/front-cadastro-despesas`. Tasks 1–5 rodam no repo API; Tasks 6–10 no repo FRONT; Task 11 nos dois. Caminhos de arquivo em cada task são relativos à raiz do repo indicado. Em execução com worktrees, troque a raiz pelo caminho da worktree correspondente.

## Global Constraints

- Conjunto fechado de valores vira enum. Nada de magic string/number solta em comparação, default, parâmetro ou teste (use as constantes/enums definidos neste plano; status HTTP via `fastapi.status`).
- Mensagens de erro exatas (enum `ErroNfce` no backend, `MensagemNfce` no front):
  - `Link de NFC-e inválido (somente RS)` — 422
  - `SEFAZ indisponível, tente novamente` — 502
  - `Nota não encontrada ou formato desconhecido` — 422
  - `Nota já importada (despesa de dd/mm/aaaa)` — 409
  - `Não foi possível acessar a câmera` (front)
  - `Vincule todos os itens da nota` (front)
- Somente RS: a chave dentro de `p` começa com `43`.
- O backend **nunca** acessa a URL recebida; busca sempre `https://dfe-portal.svrs.rs.gov.br/Dfe/QrCodeNFce?p=<p>`.
- Dependências novas: apenas `httpx==0.28.1` passa de dev para runtime (API) e `jsqr@1.4.0` (FRONT).
- Testes: em cada task rode só os testes listados nela. Suíte completa apenas na Task 11, uma vez. Nunca use `-n auto`/xdist nem rode duas suítes do mesmo projeto ao mesmo tempo (inclusive em worktrees diferentes). Se a suíte esperar por lock/porta/Docker, aguarde.
- Testes do backend exigem Docker (testcontainers). Rodar com `uv run pytest <arquivo>`.
- Não tocar no banco de desenvolvimento. A migração é validada num Postgres descartável via testcontainers (Task 1).
- Sem testes E2E nesta feature.
- Nenhum CPF real nem link/hash real de nota em código, testes ou docs. A fixture HTML é a versão anonimizada.
- Backend: `from __future__ import annotations`; tipos usados em runtime por SQLAlchemy/Pydantic (`uuid`, `date`, `Decimal`) importados em runtime com `# noqa: TC003`; ruff com line-length 100.
- Front: `<script setup lang="ts">`; todo elemento interativo novo tem `data-cy`.
- Commits em português no padrão do repo (`feat: Adiciona ...`, `test: ...`, `fix: ...`), terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Mesmo código de produto em duas linhas da nota** (o caixa registrou o item duas vezes) → salvar não pode falhar no upsert de vínculos ("ON CONFLICT ... cannot affect row a second time"). Teste na Task 5.
2. **Nota sem a linha "Descontos R$"** (compra sem desconto) → o parser devolve desconto `0.00` em vez de falhar. Teste na Task 2.
3. **Vínculo apontando para item inativo/fora do catálogo carregado** → a linha aparece como não vinculada (com a dica da nota) e bloqueia o salvamento, em vez de enviar um `item_id` que o combobox não exibe. Teste na Task 10.
4. **Webcam fechada antes de o navegador conceder a permissão** → a câmera que abre em seguida é desligada (LED não fica aceso). Teste na Task 8.
5. **"Salvar e começar outra" depois de importar** → a despesa seguinte não carrega a chave/CNPJ/códigos da nota anterior. Teste na Task 10.

---

### Task 1 (API): Modelos e migração

**Files:**
- Create: `app/models/vinculo_produto_nfce.py`
- Create: `alembic/versions/5c2e9a1f7b3d_add_importacao_nfce.py`
- Modify: `app/models/estabelecimento.py`
- Modify: `app/models/despesa.py`
- Modify: `app/models/__init__.py`

**Interfaces:**
- Produces: `Estabelecimento.cnpj: str | None` (14 dígitos, único); `Despesa.chave_nfce: str | None` (44 dígitos, único); modelo `VinculoProdutoNfce(cnpj_raiz: str, codigo_produto: str, item_id: uuid.UUID)` com `UNIQUE (cnpj_raiz, codigo_produto)`, exportado em `app.models`.

- [ ] **Step 1: Adicionar `cnpj` ao estabelecimento**

Em `app/models/estabelecimento.py`, abaixo de `tipo_id`:

```python
    cnpj: Mapped[str | None] = mapped_column(String(14), unique=True)
```

- [ ] **Step 2: Adicionar `chave_nfce` à despesa**

Em `app/models/despesa.py`, trocar o import do sqlalchemy por:

```python
from sqlalchemy import CHAR, Date, ForeignKey, Numeric, String, Text, func
```

e, abaixo de `observacao`:

```python
    chave_nfce: Mapped[str | None] = mapped_column(CHAR(44), unique=True)
```

- [ ] **Step 3: Criar o modelo de vínculo**

`app/models/vinculo_produto_nfce.py`:

```python
from __future__ import annotations

import uuid  # noqa: TC003

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class VinculoProdutoNfce(BaseModel):
    __tablename__ = "vinculos_produto_nfce"
    __table_args__ = (UniqueConstraint("cnpj_raiz", "codigo_produto"),)

    cnpj_raiz: Mapped[str] = mapped_column(String(8))
    codigo_produto: Mapped[str] = mapped_column(String(60))
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("itens.id", ondelete="CASCADE"))
```

Em `app/models/__init__.py`, adicionar `from app.models.vinculo_produto_nfce import VinculoProdutoNfce` (após `UnidadeMedida`) e `"VinculoProdutoNfce"` ao final de `__all__`.

- [ ] **Step 4: Escrever a migração**

`alembic/versions/5c2e9a1f7b3d_add_importacao_nfce.py` (os nomes das constraints únicas são os que o Postgres gera para `unique=True`, mantendo modelo e banco iguais):

```python
"""Add importação NFC-e (cnpj, chave_nfce, vinculos_produto_nfce)

Revision ID: 5c2e9a1f7b3d
Revises: 73d7225ddc86
Create Date: 2026-09-30 10:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence  # noqa: TC003

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5c2e9a1f7b3d"
down_revision: str | Sequence[str] | None = "73d7225ddc86"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("estabelecimentos", sa.Column("cnpj", sa.String(length=14), nullable=True))
    op.create_unique_constraint("estabelecimentos_cnpj_key", "estabelecimentos", ["cnpj"])
    op.add_column("despesas", sa.Column("chave_nfce", sa.CHAR(length=44), nullable=True))
    op.create_unique_constraint("despesas_chave_nfce_key", "despesas", ["chave_nfce"])
    op.create_table(
        "vinculos_produto_nfce",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("cnpj_raiz", sa.String(length=8), nullable=False),
        sa.Column("codigo_produto", sa.String(length=60), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=False),
        sa.Column(
            "data_cadastro",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "data_alteracao",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["item_id"], ["itens.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("cnpj_raiz", "codigo_produto"),
    )


def downgrade() -> None:
    op.drop_table("vinculos_produto_nfce")
    op.drop_constraint("despesas_chave_nfce_key", "despesas", type_="unique")
    op.drop_column("despesas", "chave_nfce")
    op.drop_constraint("estabelecimentos_cnpj_key", "estabelecimentos", type_="unique")
    op.drop_column("estabelecimentos", "cnpj")
```

- [ ] **Step 5: Validar a migração num Postgres descartável (nunca no banco de dev)**

Run:

```bash
uv run python - <<'EOF'
import os, subprocess
from testcontainers.postgres import PostgresContainer
with PostgresContainer("postgres:17-alpine", driver="asyncpg") as pg:
    env = {**os.environ, "DATABASE_URL": pg.get_connection_url()}
    for args in (["upgrade", "head"], ["downgrade", "-1"], ["upgrade", "head"]):
        subprocess.run(["alembic", *args], check=True, env=env)
print("migracao ok")
EOF
```

Expected: termina com `migracao ok`, sem traceback.

- [ ] **Step 6: Rodar os testes de despesas (create_all com os modelos novos)**

Run: `uv run pytest tests/test_despesas.py tests/test_itens_despesa.py -q`
Expected: PASS (mesmo resultado de antes; colunas novas são opcionais).

- [ ] **Step 7: Lint e commit**

```bash
uv run ruff check --fix app/models/vinculo_produto_nfce.py app/models/__init__.py alembic/versions/5c2e9a1f7b3d_add_importacao_nfce.py
uv run ruff format app/models/vinculo_produto_nfce.py alembic/versions/5c2e9a1f7b3d_add_importacao_nfce.py
git add app/models alembic/versions/5c2e9a1f7b3d_add_importacao_nfce.py
git commit -m "feat: Adiciona modelos e migração da importação de NFC-e" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(`app/models/despesa.py` tem um `F401` pré-existente — `String` não usado; por isso ele fica fora do `ruff check --fix`.)

---

### Task 2 (API): Parser do DANFE e rateio do desconto

**Files:**
- Create: `app/services/nfce_parser.py`
- Create: `tests/fixtures/nfce_rs.html`
- Test: `tests/test_nfce_parser.py`

**Interfaces:**
- Produces (em `app.services.nfce_parser`):
  - `class NotaInvalidaError(ValueError)`
  - `@dataclass(frozen=True) class ItemNota(codigo: str, descricao: str, quantidade: Decimal, unidade: str, valor_unitario: Decimal, valor_total: Decimal)`
  - `@dataclass(frozen=True) class NotaNfce(chave: str, data_emissao: date, cnpj: str, razao_social: str, endereco: str, itens: list[ItemNota], valor_total: Decimal, desconto: Decimal, valor_pago: Decimal)`
  - `def parse(html: str) -> NotaNfce` — levanta `NotaInvalidaError`
  - `def ratear_desconto(itens: list[ItemNota], desconto: Decimal, valor_pago: Decimal) -> list[Decimal]` — desconto **por unidade** de cada item, mesma ordem
  - `def total_no_banco(item: ItemNota, desconto_unitario: Decimal) -> Decimal`

- [ ] **Step 1: Criar a fixture anonimizada**

```bash
mkdir -p tests/fixtures
cp /tmp/claude-1000/-home-ballico-Projetos-front-cadastro-despesas/d5077a92-044b-4e50-9820-c87a7a958eba/scratchpad/nfce_rs_anonimizado.html tests/fixtures/nfce_rs.html
grep -c "000.000.000-00" tests/fixtures/nfce_rs.html
```

Expected: `1`. Se o arquivo de origem não existir (sessão encerrada), **pare e peça ao usuário** o link da nota de exemplo; baixe com `curl -sSL -A "Mozilla/5.0" '<link>' -o tests/fixtures/nfce_rs.html` e anonimize com `sed -i -E 's/[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}/000.000.000-00/g' tests/fixtures/nfce_rs.html`. Nunca grave o link no repo.

- [ ] **Step 2: Escrever os testes**

`tests/test_nfce_parser.py`:

```python
from __future__ import annotations

from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from app.services.nfce_parser import (
    ItemNota,
    NotaInvalidaError,
    parse,
    ratear_desconto,
    total_no_banco,
)

FIXTURE = Path(__file__).parent / "fixtures" / "nfce_rs.html"
LINHA_DESCONTO = (
    '<div id="linhaTotal"><label>Descontos R$:</label>'
    '<span class="totalNumb">14,65</span></div>'
)


@pytest.fixture(scope="module")
def html() -> str:
    return FIXTURE.read_text(encoding="utf-8")


def test_parse_cabecalho(html: str) -> None:
    nota = parse(html)
    assert nota.chave == "43260801132478002343651080003191521164954990"
    assert nota.cnpj == "01132478002343"
    assert nota.razao_social == "Irmaos Andreazza Ltda"
    assert nota.endereco == "Rua Padre Angelo Tronca, 2150, Sao Luiz, Caxias Do Sul, RS"
    assert nota.data_emissao == date(2026, 8, 19)


def test_parse_totais(html: str) -> None:
    nota = parse(html)
    assert nota.valor_total == Decimal("146.50")
    assert nota.desconto == Decimal("14.65")
    assert nota.valor_pago == Decimal("131.85")


def test_parse_itens(html: str) -> None:
    nota = parse(html)
    assert len(nota.itens) == 14
    assert nota.itens[0] == ItemNota(
        "162558", "Cenoura Kg", Decimal("1.250"), "KG", Decimal("8.99"), Decimal("11.23")
    )
    assert nota.itens[-1] == ItemNota(
        "102881", "Milho Oderich200g", Decimal("3.000"), "UN", Decimal("3.69"), Decimal("11.07")
    )


def test_parse_nota_sem_linha_de_desconto(html: str) -> None:
    assert LINHA_DESCONTO in html
    nota = parse(html.replace(LINHA_DESCONTO, ""))
    assert nota.desconto == Decimal("0.00")


def test_parse_html_sem_estrutura_de_nota() -> None:
    with pytest.raises(NotaInvalidaError):
        parse("<html><body>Nota não encontrada</body></html>")


def test_rateio_fecha_com_o_valor_pago(html: str) -> None:
    nota = parse(html)
    descontos = ratear_desconto(nota.itens, nota.desconto, nota.valor_pago)
    assert descontos[0] == Decimal("0.90")
    total = sum(total_no_banco(i, d) for i, d in zip(nota.itens, descontos, strict=True))
    assert total == nota.valor_pago


def test_rateio_ajusta_centavos_no_primeiro_item_com_quantidade_1() -> None:
    pesado = ItemNota("1", "Banana", Decimal("0.865"), "KG", Decimal("8.99"), Decimal("7.77"))
    unitario = ItemNota("2", "Leite", Decimal("1.000"), "UN", Decimal("10.00"), Decimal("10.00"))
    descontos = ratear_desconto([pesado, unitario], Decimal("0.00"), Decimal("17.77"))
    assert descontos == [Decimal("0.00"), Decimal("0.01")]


def test_rateio_sem_item_com_quantidade_1_mantem_a_diferenca() -> None:
    pesado = ItemNota("1", "Banana", Decimal("0.865"), "KG", Decimal("8.99"), Decimal("7.77"))
    assert ratear_desconto([pesado], Decimal("0.00"), Decimal("7.77")) == [Decimal("0.00")]
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `uv run pytest tests/test_nfce_parser.py -q`
Expected: FAIL com `ModuleNotFoundError: No module named 'app.services.nfce_parser'`.

- [ ] **Step 4: Implementar o parser**

`app/services/nfce_parser.py`:

```python
"""Leitura do DANFE NFC-e (layout da SEFAZ RS) e rateio do desconto total."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from enum import StrEnum
from html.parser import HTMLParser

CENTAVO = Decimal("0.01")
MILESIMO = Decimal("0.001")
TAMANHO_CHAVE = 44
TAMANHO_CNPJ = 14
FORMATO_DATA_NOTA = "%d/%m/%Y"
_TAGS_VAZIAS = frozenset({"br", "img", "meta", "link", "input", "hr"})


class NotaInvalidaError(ValueError):
    pass


class ClasseDanfe(StrEnum):
    RAZAO_SOCIAL = "txtTopo"
    TEXTO_EMITENTE = "text"
    DESCRICAO = "txtTit"
    CODIGO = "RCod"
    QUANTIDADE = "Rqtd"
    UNIDADE = "RUN"
    VALOR_UNITARIO = "RvlUnit"
    VALOR_TOTAL_ITEM = "valor"
    TOTAL = "totalNumb"
    CHAVE = "chave"


class RotuloTotal(StrEnum):
    VALOR_TOTAL = "Valor total R$:"
    DESCONTOS = "Descontos R$:"
    VALOR_A_PAGAR = "Valor a pagar R$:"


_CAMPOS_ITEM = (
    ClasseDanfe.CODIGO,
    ClasseDanfe.QUANTIDADE,
    ClasseDanfe.UNIDADE,
    ClasseDanfe.VALOR_UNITARIO,
    ClasseDanfe.VALOR_TOTAL_ITEM,
)


@dataclass(frozen=True)
class ItemNota:
    codigo: str
    descricao: str
    quantidade: Decimal
    unidade: str
    valor_unitario: Decimal
    valor_total: Decimal


@dataclass(frozen=True)
class NotaNfce:
    chave: str
    data_emissao: date
    cnpj: str
    razao_social: str
    endereco: str
    itens: list[ItemNota]
    valor_total: Decimal
    desconto: Decimal
    valor_pago: Decimal


class _Coletor(HTMLParser):
    """Achata o HTML em (tag, classe, texto); classe = a do elemento com classe mais interno."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._pilha: list[tuple[str, str]] = []
        self.textos: list[tuple[str, str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in _TAGS_VAZIAS:
            return
        self._pilha.append((tag, dict(attrs).get("class") or ""))

    def handle_endtag(self, tag: str) -> None:
        if tag in _TAGS_VAZIAS:
            return
        for i in range(len(self._pilha) - 1, -1, -1):
            if self._pilha[i][0] == tag:
                del self._pilha[i:]
                return

    def handle_data(self, data: str) -> None:
        texto = " ".join(data.split())
        if not texto or not self._pilha:
            return
        tag = self._pilha[-1][0]
        classe = next((c for _, c in reversed(self._pilha) if c), "")
        self.textos.append((tag, classe, texto))


def _decimal_br(texto: str) -> Decimal:
    numero = re.search(r"\d[\d.]*(,\d+)?", texto)
    if numero is None:
        raise NotaInvalidaError(f"Valor numérico ausente em {texto!r}")
    return Decimal(numero.group(0).replace(".", "").replace(",", "."))


def _depois_do_rotulo(texto: str) -> str:
    return texto.split(":", 1)[-1].strip()


def parse(html: str) -> NotaNfce:
    coletor = _Coletor()
    coletor.feed(html)

    razao_social = ""
    textos_emitente: list[str] = []
    chave = ""
    totais: dict[str, str] = {}
    rotulo: str | None = None
    brutos: list[dict[str, str]] = []

    for tag, classe, texto in coletor.textos:
        if classe == ClasseDanfe.RAZAO_SOCIAL and not razao_social:
            razao_social = texto
        elif classe == ClasseDanfe.TEXTO_EMITENTE:
            textos_emitente.append(texto)
        elif classe == ClasseDanfe.DESCRICAO:
            brutos.append({ClasseDanfe.DESCRICAO: texto})
        elif brutos and classe in _CAMPOS_ITEM:
            atual = brutos[-1]
            atual[classe] = f"{atual.get(classe, '')} {texto}".strip()
        elif classe == ClasseDanfe.CHAVE:
            chave = re.sub(r"\D", "", texto)
        elif tag == "label":
            rotulo = texto
        elif ClasseDanfe.TOTAL in classe.split() and rotulo is not None:
            totais[rotulo] = texto
            rotulo = None

    texto_completo = " ".join(t for _, _, t in coletor.textos)
    emissao = re.search(r"Emissão:\s*(\d{2}/\d{2}/\d{4})", texto_completo)
    cnpj = next((re.sub(r"\D", "", t) for t in textos_emitente if "CNPJ" in t), "")

    if not (
        razao_social
        and brutos
        and emissao
        and len(chave) == TAMANHO_CHAVE
        and len(cnpj) == TAMANHO_CNPJ
    ):
        raise NotaInvalidaError("Estrutura da NFC-e não reconhecida")
    if RotuloTotal.VALOR_A_PAGAR not in totais or RotuloTotal.VALOR_TOTAL not in totais:
        raise NotaInvalidaError("Totais da NFC-e ausentes")

    try:
        itens = [
            ItemNota(
                codigo=re.sub(r"[^\w-]", "", _depois_do_rotulo(b[ClasseDanfe.CODIGO])),
                descricao=b[ClasseDanfe.DESCRICAO],
                # ponytail: quantidade com 4 casas é arredondada para as 3 que o banco guarda
                quantidade=_decimal_br(b[ClasseDanfe.QUANTIDADE]).quantize(
                    MILESIMO, ROUND_HALF_UP
                ),
                unidade=_depois_do_rotulo(b[ClasseDanfe.UNIDADE]),
                valor_unitario=_decimal_br(b[ClasseDanfe.VALOR_UNITARIO]),
                valor_total=_decimal_br(b[ClasseDanfe.VALOR_TOTAL_ITEM]),
            )
            for b in brutos
        ]
    except KeyError as exc:
        raise NotaInvalidaError(f"Campo de item ausente: {exc}") from exc

    # Endereço vem como "logradouro, número, complemento, bairro, município, UF" com vazios e "0"
    partes = [p.strip() for p in (textos_emitente[1] if len(textos_emitente) > 1 else "").split(",")]
    endereco = ", ".join(p for p in partes if p and p != "0")

    return NotaNfce(
        chave=chave,
        data_emissao=datetime.strptime(emissao.group(1), FORMATO_DATA_NOTA).date(),
        cnpj=cnpj,
        razao_social=razao_social,
        endereco=endereco,
        itens=itens,
        valor_total=_decimal_br(totais[RotuloTotal.VALOR_TOTAL]),
        desconto=_decimal_br(totais.get(RotuloTotal.DESCONTOS, "0,00")),
        valor_pago=_decimal_br(totais[RotuloTotal.VALOR_A_PAGAR]),
    )


def total_no_banco(item: ItemNota, desconto_unitario: Decimal) -> Decimal:
    """Mesmo cálculo da coluna computada itens_despesa.valor_total (NUMERIC arredonda half-up)."""
    bruto = (item.valor_unitario - desconto_unitario) * item.quantidade
    return bruto.quantize(CENTAVO, ROUND_HALF_UP)


def ratear_desconto(itens: list[ItemNota], desconto: Decimal, valor_pago: Decimal) -> list[Decimal]:
    soma = sum((i.valor_total for i in itens), Decimal(0))
    descontos = [
        (desconto * i.valor_total / soma / i.quantidade).quantize(CENTAVO, ROUND_HALF_UP)
        if soma
        else Decimal(0).quantize(CENTAVO)
        for i in itens
    ]
    total = sum(
        (total_no_banco(i, d) for i, d in zip(itens, descontos, strict=True)), Decimal(0)
    )
    diferenca = total - valor_pago
    # ponytail: sobra de centavos vai para o 1º item com quantidade 1 (centavo exato); sem ele, fica
    idx = next((n for n, i in enumerate(itens) if i.quantidade == 1), None)
    if diferenca and idx is not None and 0 <= descontos[idx] + diferenca < itens[idx].valor_unitario:
        descontos[idx] += diferenca
    return descontos
```

- [ ] **Step 5: Rodar e ver passar**

Run: `uv run pytest tests/test_nfce_parser.py -q`
Expected: 8 passed.

- [ ] **Step 6: Lint e commit**

```bash
uv run ruff check --fix app/services/nfce_parser.py tests/test_nfce_parser.py
uv run ruff format app/services/nfce_parser.py tests/test_nfce_parser.py
git add app/services/nfce_parser.py tests/fixtures/nfce_rs.html tests/test_nfce_parser.py
git commit -m "feat: Adiciona parser do DANFE NFC-e e rateio de desconto" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3 (API): Validação do link e busca na SEFAZ

**Files:**
- Create: `app/services/nfce.py`
- Modify: `pyproject.toml` (+ `uv.lock` via `uv sync`)
- Test: `tests/test_nfce_busca.py`

**Interfaces:**
- Produces (em `app.services.nfce`):
  - `class ErroNfce(StrEnum)` com `LINK_INVALIDO`, `SEFAZ_INDISPONIVEL`, `FORMATO_DESCONHECIDO`, `JA_IMPORTADA` (este com placeholder `{data}`)
  - `URL_CONSULTA_SEFAZ_RS: str`, `TAMANHO_CNPJ_RAIZ = 8`
  - `def extrair_parametro(url: str) -> str` — devolve `p` ou levanta `HTTPException(422, ErroNfce.LINK_INVALIDO)`
  - `async def buscar_html(p: str, transport: httpx.AsyncBaseTransport | None = None) -> str` — levanta `HTTPException(502, ErroNfce.SEFAZ_INDISPONIVEL)`

- [ ] **Step 1: Promover `httpx` a dependência de runtime**

Em `pyproject.toml`, adicionar `"httpx==0.28.1",` ao final de `[project] dependencies` e remover a linha `"httpx==0.28.1",` de `[project.optional-dependencies] dev`. Depois:

Run: `uv sync --extra dev`
Expected: sincroniza sem baixar pacote novo (httpx já estava no lock).

- [ ] **Step 2: Escrever os testes**

`tests/test_nfce_busca.py` (o `p` é sintético — nunca use o hash de uma nota real):

```python
from __future__ import annotations

import httpx
import pytest
from fastapi import HTTPException, status

from app.services.nfce import (
    URL_CONSULTA_SEFAZ_RS,
    ErroNfce,
    buscar_html,
    extrair_parametro,
)

CHAVE = "43" + "0" * 41 + "1"
P_VALIDO = f"{CHAVE}|2|1|2|{'A' * 40}"
URL_VALIDA = f"https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p={P_VALIDO}"


def test_extrai_p_da_url_do_qr() -> None:
    assert extrair_parametro(URL_VALIDA) == P_VALIDO


def test_aceita_barras_codificadas_e_espacos() -> None:
    url = f"  {URL_VALIDA.replace('|', '%7C')}  "
    assert extrair_parametro(url) == P_VALIDO


@pytest.mark.parametrize(
    "url",
    [
        URL_VALIDA.replace("p=43", "p=35"),  # chave de SP
        "https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx",  # sem p
        "https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=abc",  # malformado
        f"https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p={CHAVE}",  # só a chave
    ],
)
def test_rejeita_link_invalido(url: str) -> None:
    with pytest.raises(HTTPException) as erro:
        extrair_parametro(url)
    assert erro.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert erro.value.detail == ErroNfce.LINK_INVALIDO


async def test_busca_na_url_constante_da_sefaz() -> None:
    def responder(request: httpx.Request) -> httpx.Response:
        assert str(request.url).startswith(URL_CONSULTA_SEFAZ_RS)
        assert request.url.params["p"] == P_VALIDO
        return httpx.Response(status.HTTP_200_OK, text="<html>ok</html>")

    html = await buscar_html(P_VALIDO, transport=httpx.MockTransport(responder))
    assert html == "<html>ok</html>"


async def test_timeout_vira_502() -> None:
    def responder(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("timeout", request=request)

    with pytest.raises(HTTPException) as erro:
        await buscar_html(P_VALIDO, transport=httpx.MockTransport(responder))
    assert erro.value.status_code == status.HTTP_502_BAD_GATEWAY
    assert erro.value.detail == ErroNfce.SEFAZ_INDISPONIVEL


async def test_erro_5xx_vira_502() -> None:
    def responder(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status.HTTP_503_SERVICE_UNAVAILABLE)

    with pytest.raises(HTTPException) as erro:
        await buscar_html(P_VALIDO, transport=httpx.MockTransport(responder))
    assert erro.value.status_code == status.HTTP_502_BAD_GATEWAY
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `uv run pytest tests/test_nfce_busca.py -q`
Expected: FAIL com `ModuleNotFoundError: No module named 'app.services.nfce'`.

- [ ] **Step 4: Implementar**

`app/services/nfce.py`:

```python
"""Importação de NFC-e: validação do link, busca na SEFAZ RS e montagem do rascunho."""

from __future__ import annotations

import re
from enum import StrEnum
from urllib.parse import parse_qs, urlsplit

import httpx
from fastapi import HTTPException, status

URL_CONSULTA_SEFAZ_RS = "https://dfe-portal.svrs.rs.gov.br/Dfe/QrCodeNFce"
TIMEOUT_SEFAZ_SEGUNDOS = 10.0
TAMANHO_CNPJ_RAIZ = 8
PARAMETRO_QR = "p"
# chave de 44 dígitos do RS (UF 43) seguida dos campos do QR separados por "|"
_FORMATO_P = re.compile(r"43\d{42}(\|[0-9A-Za-z.]+)+")


class ErroNfce(StrEnum):
    LINK_INVALIDO = "Link de NFC-e inválido (somente RS)"
    SEFAZ_INDISPONIVEL = "SEFAZ indisponível, tente novamente"
    FORMATO_DESCONHECIDO = "Nota não encontrada ou formato desconhecido"
    JA_IMPORTADA = "Nota já importada (despesa de {data})"


def extrair_parametro(url: str) -> str:
    valores = parse_qs(urlsplit(url.strip()).query).get(PARAMETRO_QR, [])
    p = valores[0] if valores else ""
    if not _FORMATO_P.fullmatch(p):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=ErroNfce.LINK_INVALIDO
        )
    return p


async def buscar_html(p: str, transport: httpx.AsyncBaseTransport | None = None) -> str:
    try:
        async with httpx.AsyncClient(
            timeout=TIMEOUT_SEFAZ_SEGUNDOS, follow_redirects=True, transport=transport
        ) as client:
            resposta = await client.get(URL_CONSULTA_SEFAZ_RS, params={PARAMETRO_QR: p})
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=ErroNfce.SEFAZ_INDISPONIVEL
        ) from exc
    if resposta.status_code >= status.HTTP_500_INTERNAL_SERVER_ERROR:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=ErroNfce.SEFAZ_INDISPONIVEL
        )
    return resposta.text
```

- [ ] **Step 5: Rodar e ver passar**

Run: `uv run pytest tests/test_nfce_busca.py -q`
Expected: 9 passed.

- [ ] **Step 6: Lint e commit**

```bash
uv run ruff check --fix app/services/nfce.py tests/test_nfce_busca.py
uv run ruff format app/services/nfce.py tests/test_nfce_busca.py
git add pyproject.toml uv.lock app/services/nfce.py tests/test_nfce_busca.py
git commit -m "feat: Adiciona validação do link e busca da NFC-e na SEFAZ RS" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4 (API): Endpoint `POST /nfce/importar`

**Files:**
- Create: `app/schemas/nfce.py`
- Create: `app/routers/nfce.py`
- Modify: `app/services/nfce.py` (adicionar `garantir_nao_importada` e `importar`)
- Modify: `app/main.py`
- Modify: `tests/conftest.py` (fixtures `gerar_nota` e `sefaz`)
- Test: `tests/test_nfce_importar.py`

**Interfaces:**
- Consumes: `parse`, `ratear_desconto`, `NotaInvalidaError` (Task 2); `extrair_parametro`, `buscar_html`, `ErroNfce`, `TAMANHO_CNPJ_RAIZ` (Task 3); `VinculoProdutoNfce`, `Estabelecimento.cnpj`, `Despesa.chave_nfce` (Task 1).
- Produces:
  - Schemas em `app.schemas.nfce`: `ImportarNfce(url: str)`, `OrigemNfce(chave: str /^\d{44}$/, cnpj: str /^\d{14}$/)`, `ItemRascunhoNfce`, `RascunhoNfce` (campos abaixo).
  - `async def garantir_nao_importada(session: AsyncSession, chave: str) -> None` — levanta 409.
  - `async def importar(session: AsyncSession, url: str) -> RascunhoNfce`.
  - Rota `POST /nfce/importar` → `RascunhoNfce` (JSON: decimais como string, ex. `"1.250"`, `"0.90"`).
  - Fixtures de teste `gerar_nota` → `NotaTeste(html, cnpj, chave, url)` e `sefaz(html)`.

- [ ] **Step 1: Fixtures de teste em `tests/conftest.py`**

Adicionar aos imports do topo:

```python
import random
from dataclasses import dataclass
from pathlib import Path

from app.services import nfce as nfce_service
from app.services.nfce_parser import TAMANHO_CHAVE, TAMANHO_CNPJ
```

e ao final do arquivo:

```python
FIXTURE_NFCE = Path(__file__).parent / "fixtures" / "nfce_rs.html"
CNPJ_FIXTURE_FORMATADO = "01.132.478/0023-43"
CHAVE_FIXTURE_FORMATADA = "4326 0801 1324 7800 2343 6510 8000 3191 5211 6495 4990"
UF_RS = "43"
TAMANHO_GRUPO_CHAVE = 4
HASH_FICTICIO = "A" * 40


@dataclass(frozen=True)
class NotaTeste:
    html: str
    cnpj: str
    chave: str
    url: str


def formatar_cnpj(cnpj: str) -> str:
    return f"{cnpj[:2]}.{cnpj[2:5]}.{cnpj[5:8]}/{cnpj[8:12]}-{cnpj[12:]}"


def _digitos_aleatorios(quantidade: int) -> str:
    return f"{random.randrange(10**quantidade):0{quantidade}d}"


@pytest.fixture
def gerar_nota():
    """HTML da nota de exemplo com CNPJ/chave trocados — isola os testes que compartilham o banco."""
    base = FIXTURE_NFCE.read_text(encoding="utf-8")

    def _gerar(cnpj: str | None = None) -> NotaTeste:
        cnpj = cnpj or _digitos_aleatorios(TAMANHO_CNPJ)
        chave = UF_RS + _digitos_aleatorios(TAMANHO_CHAVE - len(UF_RS))
        chave_formatada = " ".join(
            chave[i : i + TAMANHO_GRUPO_CHAVE]
            for i in range(0, TAMANHO_CHAVE, TAMANHO_GRUPO_CHAVE)
        )
        html = base.replace(CNPJ_FIXTURE_FORMATADO, formatar_cnpj(cnpj)).replace(
            CHAVE_FIXTURE_FORMATADA, chave_formatada
        )
        url = f"https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p={chave}|2|1|2|{HASH_FICTICIO}"
        return NotaTeste(html=html, cnpj=cnpj, chave=chave, url=url)

    return _gerar


@pytest.fixture
def sefaz(monkeypatch: pytest.MonkeyPatch):
    """Substitui a busca na SEFAZ: a próxima importação recebe o HTML informado."""

    def _responder(html: str) -> None:
        async def _buscar(p: str) -> str:
            return html

        monkeypatch.setattr(nfce_service, "buscar_html", _buscar)

    return _responder
```

- [ ] **Step 2: Escrever os testes**

`tests/test_nfce_importar.py`:

```python
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from fastapi import HTTPException, status
from sqlalchemy import update

from app.database import build_session_factory
from app.models import Despesa, Estabelecimento, VinculoProdutoNfce
from app.services import nfce as nfce_service
from app.services.nfce import TAMANHO_CNPJ_RAIZ, ErroNfce

if TYPE_CHECKING:
    import pytest
    from httpx import AsyncClient
    from sqlalchemy.ext.asyncio import AsyncEngine

PREFIX = "/nfce/importar"
CODIGO_CENOURA = "162558"
DATA_NOTA = "2026-08-19"


async def _novo_estabelecimento(client: AsyncClient, tipo_id: str) -> str:
    r = await client.post(
        "/estabelecimentos", json={"descricao": f"Filial {uuid.uuid4()}", "tipo_id": tipo_id}
    )
    assert r.status_code == status.HTTP_201_CREATED
    return r.json()["id"]


async def test_importa_nota_sem_vinculos(client: AsyncClient, gerar_nota, sefaz) -> None:
    nota = gerar_nota()
    sefaz(nota.html)

    r = await client.post(PREFIX, json={"url": nota.url})

    assert r.status_code == status.HTTP_200_OK
    data = r.json()
    assert data["chave"] == nota.chave
    assert data["cnpj"] == nota.cnpj
    assert data["razao_social"] == "Irmaos Andreazza Ltda"
    assert data["endereco"] == "Rua Padre Angelo Tronca, 2150, Sao Luiz, Caxias Do Sul, RS"
    assert data["data_emissao"] == DATA_NOTA
    assert data["estabelecimento_id"] is None
    assert data["valor_pago"] == "131.85"
    assert data["desconto_total"] == "14.65"
    assert len(data["itens"]) == 14
    assert data["itens"][0] == {
        "codigo": CODIGO_CENOURA,
        "descricao_nota": "Cenoura Kg",
        "unidade_nota": "KG",
        "quantidade": "1.250",
        "valor_unitario": "8.99",
        "valor_desconto": "0.90",
        "item_id": None,
    }


async def test_resolve_estabelecimento_e_itens_vinculados(
    client: AsyncClient,
    db_engine: AsyncEngine,
    tipo_estabelecimento_id: str,
    item_id: str,
    gerar_nota,
    sefaz,
) -> None:
    nota = gerar_nota()
    estabelecimento_id = await _novo_estabelecimento(client, tipo_estabelecimento_id)
    async with build_session_factory(db_engine)() as session:
        await session.execute(
            update(Estabelecimento)
            .where(Estabelecimento.id == uuid.UUID(estabelecimento_id))
            .values(cnpj=nota.cnpj)
        )
        session.add(
            VinculoProdutoNfce(
                cnpj_raiz=nota.cnpj[:TAMANHO_CNPJ_RAIZ],
                codigo_produto=CODIGO_CENOURA,
                item_id=uuid.UUID(item_id),
            )
        )
        await session.commit()
    sefaz(nota.html)

    data = (await client.post(PREFIX, json={"url": nota.url})).json()

    assert data["estabelecimento_id"] == estabelecimento_id
    assert data["itens"][0]["item_id"] == item_id
    assert data["itens"][1]["item_id"] is None


async def test_link_invalido_retorna_422(client: AsyncClient) -> None:
    r = await client.post(PREFIX, json={"url": "https://exemplo.com/?p=123"})
    assert r.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert r.json()["detail"] == ErroNfce.LINK_INVALIDO


async def test_pagina_sem_nota_retorna_422(client: AsyncClient, gerar_nota, sefaz) -> None:
    nota = gerar_nota()
    sefaz("<html><body>Nota não encontrada</body></html>")
    r = await client.post(PREFIX, json={"url": nota.url})
    assert r.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert r.json()["detail"] == ErroNfce.FORMATO_DESCONHECIDO


async def test_sefaz_indisponivel_retorna_502(
    client: AsyncClient, gerar_nota, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fora_do_ar(p: str) -> str:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=ErroNfce.SEFAZ_INDISPONIVEL
        )

    monkeypatch.setattr(nfce_service, "buscar_html", _fora_do_ar)
    r = await client.post(PREFIX, json={"url": gerar_nota().url})
    assert r.status_code == status.HTTP_502_BAD_GATEWAY
    assert r.json()["detail"] == ErroNfce.SEFAZ_INDISPONIVEL


async def test_nota_ja_importada_retorna_409(
    client: AsyncClient,
    db_engine: AsyncEngine,
    categoria_despesa_id: str,
    estabelecimento_id: str,
    gerar_nota,
    sefaz,
) -> None:
    nota = gerar_nota()
    r = await client.post(
        "/despesas",
        json={
            "estabelecimento_id": estabelecimento_id,
            "categoria_despesa_id": categoria_despesa_id,
            "valor_total": "131.85",
            "data_despesa": DATA_NOTA,
        },
    )
    async with build_session_factory(db_engine)() as session:
        await session.execute(
            update(Despesa)
            .where(Despesa.id == uuid.UUID(r.json()["id"]))
            .values(chave_nfce=nota.chave)
        )
        await session.commit()
    sefaz(nota.html)

    r = await client.post(PREFIX, json={"url": nota.url})

    assert r.status_code == status.HTTP_409_CONFLICT
    assert r.json()["detail"] == ErroNfce.JA_IMPORTADA.format(data="19/08/2026")
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `uv run pytest tests/test_nfce_importar.py -q`
Expected: FAIL — `404 Not Found` nas chamadas a `/nfce/importar` (rota inexistente) e `ImportError` de `VinculoProdutoNfce`, se a Task 1 não estiver no branch.

- [ ] **Step 4: Schemas**

`app/schemas/nfce.py`:

```python
from __future__ import annotations

import uuid  # noqa: TC003
from datetime import date  # noqa: TC003
from decimal import Decimal  # noqa: TC003

from pydantic import BaseModel, Field

URL_MAX = 2000


class ImportarNfce(BaseModel):
    url: str = Field(min_length=1, max_length=URL_MAX)


class OrigemNfce(BaseModel):
    chave: str = Field(pattern=r"^\d{44}$")
    cnpj: str = Field(pattern=r"^\d{14}$")


class ItemRascunhoNfce(BaseModel):
    codigo: str
    descricao_nota: str
    unidade_nota: str
    quantidade: Decimal
    valor_unitario: Decimal
    valor_desconto: Decimal
    item_id: uuid.UUID | None


class RascunhoNfce(BaseModel):
    chave: str
    data_emissao: date
    cnpj: str
    razao_social: str
    endereco: str
    estabelecimento_id: uuid.UUID | None
    valor_pago: Decimal
    desconto_total: Decimal
    itens: list[ItemRascunhoNfce]
```

- [ ] **Step 5: Serviço `importar`**

Em `app/services/nfce.py`, completar os imports:

```python
from typing import TYPE_CHECKING

from sqlalchemy import select

from app.models import Despesa, Estabelecimento, VinculoProdutoNfce
from app.schemas.nfce import ItemRascunhoNfce, RascunhoNfce
from app.services.nfce_parser import NotaInvalidaError, parse, ratear_desconto

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession
```

Adicionar a constante `FORMATO_DATA_BR = "%d/%m/%Y"` junto das outras e, ao final do arquivo:

```python
async def garantir_nao_importada(session: AsyncSession, chave: str) -> None:
    data = await session.scalar(select(Despesa.data_despesa).where(Despesa.chave_nfce == chave))
    if data is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=ErroNfce.JA_IMPORTADA.format(data=data.strftime(FORMATO_DATA_BR)),
        )


async def importar(session: AsyncSession, url: str) -> RascunhoNfce:
    p = extrair_parametro(url)
    html = await buscar_html(p)
    try:
        nota = parse(html)
    except NotaInvalidaError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=ErroNfce.FORMATO_DESCONHECIDO,
        ) from exc
    await garantir_nao_importada(session, nota.chave)

    estabelecimento_id = await session.scalar(
        select(Estabelecimento.id).where(Estabelecimento.cnpj == nota.cnpj)
    )
    resultado = await session.execute(
        select(VinculoProdutoNfce.codigo_produto, VinculoProdutoNfce.item_id).where(
            VinculoProdutoNfce.cnpj_raiz == nota.cnpj[:TAMANHO_CNPJ_RAIZ],
            VinculoProdutoNfce.codigo_produto.in_([i.codigo for i in nota.itens]),
        )
    )
    vinculos = dict(resultado.tuples().all())
    descontos = ratear_desconto(nota.itens, nota.desconto, nota.valor_pago)

    return RascunhoNfce(
        chave=nota.chave,
        data_emissao=nota.data_emissao,
        cnpj=nota.cnpj,
        razao_social=nota.razao_social,
        endereco=nota.endereco,
        estabelecimento_id=estabelecimento_id,
        valor_pago=nota.valor_pago,
        desconto_total=nota.desconto,
        itens=[
            ItemRascunhoNfce(
                codigo=item.codigo,
                descricao_nota=item.descricao,
                unidade_nota=item.unidade,
                quantidade=item.quantidade,
                valor_unitario=item.valor_unitario,
                valor_desconto=desconto,
                item_id=vinculos.get(item.codigo),
            )
            for item, desconto in zip(nota.itens, descontos, strict=True)
        ],
    )
```

(`importar` chama `buscar_html` pelo nome global do módulo — é isso que permite às fixtures substituí-la com `monkeypatch`.)

- [ ] **Step 6: Router e registro**

`app/routers/nfce.py`:

```python
from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends

from app.database import get_db
from app.schemas.nfce import ImportarNfce, RascunhoNfce
from app.services import nfce as service

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/nfce", tags=["nfce"])


@router.post("/importar", response_model=RascunhoNfce)
async def importar_nfce(
    body: ImportarNfce, session: AsyncSession = Depends(get_db)
) -> RascunhoNfce:
    """Lê a NFC-e do link do QR Code e devolve um rascunho de despesa (nada é gravado)."""
    return await service.importar(session, body.url)
```

Em `app/main.py`: adicionar `nfce,` à lista de `from app.routers import (...)` (ordem alfabética, após `migrations`) e `app.include_router(nfce.router)` após `app.include_router(despesas.router)`.

- [ ] **Step 7: Rodar e ver passar**

Run: `uv run pytest tests/test_nfce_importar.py tests/test_nfce_busca.py tests/test_nfce_parser.py -q`
Expected: todos passam (6 + 9 + 8).

- [ ] **Step 8: Lint e commit**

```bash
uv run ruff check --fix app/schemas/nfce.py app/routers/nfce.py app/services/nfce.py app/main.py tests/test_nfce_importar.py
uv run ruff format app/schemas/nfce.py app/routers/nfce.py app/services/nfce.py tests/test_nfce_importar.py
git add app/schemas/nfce.py app/routers/nfce.py app/services/nfce.py app/main.py tests/conftest.py tests/test_nfce_importar.py
git commit -m "feat: Adiciona endpoint de importação de NFC-e" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5 (API): Gravar origem da nota no `POST /despesas`

**Files:**
- Modify: `app/schemas/despesa.py`
- Modify: `app/schemas/item_despesa.py`
- Modify: `app/services/despesas.py:68-86` (função `criar`)
- Modify: `app/services/nfce.py` (adicionar `registrar_origem`)
- Test: `tests/test_nfce_gravacao.py`

**Interfaces:**
- Consumes: `OrigemNfce` (Task 4), `garantir_nao_importada` (Task 4), `VinculoProdutoNfce` (Task 1), fixtures `gerar_nota`/`sefaz` (Task 4).
- Produces:
  - `CriarDespesa.nfce: OrigemNfce | None = None`
  - `class CriarItemDespesaNfce(CriarItemDespesa)` com `codigo_produto_nfce: str | None = None` (máx. 60); `CriarDespesa.itens: list[CriarItemDespesaNfce]`
  - `async def registrar_origem(session: AsyncSession, origem: OrigemNfce, estabelecimento_id: uuid.UUID, itens: list[CriarItemDespesaNfce]) -> None`

**Por que subclasse e não campo em `CriarItemDespesa`:** `app/services/itens_despesa.py:criar` faz `ItemDespesa(**body.model_dump())` com `CriarItemDespesa` (rota `POST /despesas/{id}/itens`). Um campo novo ali viraria kwarg inválido do modelo. A subclasse fica restrita ao `POST /despesas`.

- [ ] **Step 1: Escrever os testes**

`tests/test_nfce_gravacao.py`:

```python
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from fastapi import status

from app.services.nfce import TAMANHO_CNPJ_RAIZ, ErroNfce

if TYPE_CHECKING:
    from httpx import AsyncClient

CODIGO_CENOURA = "162558"
CODIGO_ALFACE = "879495"
DATA_NOTA = "2026-08-19"
SUFIXO_OUTRA_FILIAL = "999999"


async def _novo_estabelecimento(client: AsyncClient, tipo_id: str) -> str:
    r = await client.post(
        "/estabelecimentos", json={"descricao": f"Filial {uuid.uuid4()}", "tipo_id": tipo_id}
    )
    assert r.status_code == status.HTTP_201_CREATED
    return r.json()["id"]


async def _novo_item(client: AsyncClient, categoria_item_id: str) -> str:
    r = await client.post(
        "/itens",
        json={"descricao": f"Item {uuid.uuid4()}", "categoria_item_id": categoria_item_id},
    )
    assert r.status_code == status.HTTP_201_CREATED
    return r.json()["id"]


def _payload(nota, estabelecimento_id: str, categoria_despesa_id: str, linhas: list[tuple[str, str]]) -> dict:
    """linhas = [(codigo_produto_nfce, item_id), ...]"""
    return {
        "estabelecimento_id": estabelecimento_id,
        "categoria_despesa_id": categoria_despesa_id,
        "valor_total": "10.00",
        "data_despesa": DATA_NOTA,
        "nfce": {"chave": nota.chave, "cnpj": nota.cnpj},
        "itens": [
            {"item_id": item_id, "quantidade": "1", "valor_unitario": "5.00", "codigo_produto_nfce": codigo}
            for codigo, item_id in linhas
        ],
    }


async def _importar(client: AsyncClient, sefaz, nota) -> dict:
    sefaz(nota.html)
    r = await client.post("/nfce/importar", json={"url": nota.url})
    assert r.status_code == status.HTTP_200_OK, r.text
    return r.json()


async def test_salvar_grava_chave_cnpj_e_vinculos(
    client: AsyncClient, tipo_estabelecimento_id: str, categoria_despesa_id: str, item_id: str, gerar_nota, sefaz
) -> None:
    est = await _novo_estabelecimento(client, tipo_estabelecimento_id)
    nota = gerar_nota()
    r = await client.post("/despesas", json=_payload(nota, est, categoria_despesa_id, [(CODIGO_CENOURA, item_id)]))
    assert r.status_code == status.HTTP_201_CREATED, r.text

    sefaz(nota.html)
    repetida = await client.post("/nfce/importar", json={"url": nota.url})
    assert repetida.status_code == status.HTTP_409_CONFLICT

    proxima = await _importar(client, sefaz, gerar_nota(cnpj=nota.cnpj))
    assert proxima["estabelecimento_id"] == est
    assert proxima["itens"][0]["item_id"] == item_id
    assert proxima["itens"][1]["item_id"] is None


async def test_vinculo_vale_para_outra_filial_da_rede(
    client: AsyncClient, tipo_estabelecimento_id: str, categoria_despesa_id: str, item_id: str, gerar_nota, sefaz
) -> None:
    est = await _novo_estabelecimento(client, tipo_estabelecimento_id)
    nota = gerar_nota()
    await client.post("/despesas", json=_payload(nota, est, categoria_despesa_id, [(CODIGO_CENOURA, item_id)]))

    outra_filial = nota.cnpj[:TAMANHO_CNPJ_RAIZ] + SUFIXO_OUTRA_FILIAL
    rascunho = await _importar(client, sefaz, gerar_nota(cnpj=outra_filial))

    assert rascunho["estabelecimento_id"] is None
    assert rascunho["itens"][0]["item_id"] == item_id


async def test_salvar_nota_duplicada_retorna_409(
    client: AsyncClient, tipo_estabelecimento_id: str, categoria_despesa_id: str, item_id: str, gerar_nota
) -> None:
    est = await _novo_estabelecimento(client, tipo_estabelecimento_id)
    payload = _payload(gerar_nota(), est, categoria_despesa_id, [(CODIGO_CENOURA, item_id)])
    assert (await client.post("/despesas", json=payload)).status_code == status.HTTP_201_CREATED

    r = await client.post("/despesas", json=payload)

    assert r.status_code == status.HTTP_409_CONFLICT
    assert r.json()["detail"] == ErroNfce.JA_IMPORTADA.format(data="19/08/2026")


async def test_cnpj_passa_para_o_ultimo_estabelecimento_escolhido(
    client: AsyncClient, tipo_estabelecimento_id: str, categoria_despesa_id: str, item_id: str, gerar_nota, sefaz
) -> None:
    primeiro = await _novo_estabelecimento(client, tipo_estabelecimento_id)
    segundo = await _novo_estabelecimento(client, tipo_estabelecimento_id)
    nota = gerar_nota()
    await client.post("/despesas", json=_payload(nota, primeiro, categoria_despesa_id, [(CODIGO_CENOURA, item_id)]))
    nota2 = gerar_nota(cnpj=nota.cnpj)
    r = await client.post("/despesas", json=_payload(nota2, segundo, categoria_despesa_id, [(CODIGO_CENOURA, item_id)]))
    assert r.status_code == status.HTTP_201_CREATED, r.text

    rascunho = await _importar(client, sefaz, gerar_nota(cnpj=nota.cnpj))

    assert rascunho["estabelecimento_id"] == segundo


async def test_ultima_escolha_do_vinculo_vence(
    client: AsyncClient, tipo_estabelecimento_id: str, categoria_despesa_id: str, categoria_item_id: str, gerar_nota, sefaz
) -> None:
    est = await _novo_estabelecimento(client, tipo_estabelecimento_id)
    errado = await _novo_item(client, categoria_item_id)
    certo = await _novo_item(client, categoria_item_id)
    nota = gerar_nota()
    await client.post("/despesas", json=_payload(nota, est, categoria_despesa_id, [(CODIGO_CENOURA, errado)]))
    nota2 = gerar_nota(cnpj=nota.cnpj)
    await client.post("/despesas", json=_payload(nota2, est, categoria_despesa_id, [(CODIGO_CENOURA, certo)]))

    rascunho = await _importar(client, sefaz, gerar_nota(cnpj=nota.cnpj))

    assert rascunho["itens"][0]["item_id"] == certo


async def test_mesmo_codigo_em_duas_linhas_da_nota(
    client: AsyncClient, tipo_estabelecimento_id: str, categoria_despesa_id: str, item_id: str, gerar_nota
) -> None:
    est = await _novo_estabelecimento(client, tipo_estabelecimento_id)
    linhas = [(CODIGO_ALFACE, item_id), (CODIGO_ALFACE, item_id)]

    r = await client.post("/despesas", json=_payload(gerar_nota(), est, categoria_despesa_id, linhas))

    assert r.status_code == status.HTTP_201_CREATED, r.text
    assert len(r.json()["itens"]) == len(linhas)
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `uv run pytest tests/test_nfce_gravacao.py -q`
Expected: FAIL — a chave/vínculos não são gravados (ex.: `repetida.status_code` é 200 em vez de 409; `item_id` volta `None`).

- [ ] **Step 3: Campos novos nos schemas**

Em `app/schemas/item_despesa.py`, logo após a classe `CriarItemDespesa`:

```python
class CriarItemDespesaNfce(CriarItemDespesa):
    """Item criado junto com a despesa; pode trazer o código do produto na NFC-e."""

    codigo_produto_nfce: str | None = Field(None, max_length=60)
```

Em `app/schemas/despesa.py`:
- no import de `app.schemas.item_despesa`, trocar `CriarItemDespesa,` por `CriarItemDespesaNfce,`;
- logo **depois** desse bloco de import (ordem do isort), adicionar `from app.schemas.nfce import OrigemNfce  # noqa: TC001`;
- em `CriarDespesa`, trocar `itens: list[CriarItemDespesa]` por `itens: list[CriarItemDespesaNfce]` e adicionar, após `abastecimento`:

```python
    nfce: OrigemNfce | None = None
```

- [ ] **Step 4: `registrar_origem` em `app/services/nfce.py`**

Completar os imports:

```python
import uuid

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
```

e, dentro do bloco `if TYPE_CHECKING:`:

```python
    from app.schemas.item_despesa import CriarItemDespesaNfce
    from app.schemas.nfce import OrigemNfce
```

Adicionar ao final do arquivo:

```python
async def registrar_origem(
    session: AsyncSession,
    origem: OrigemNfce,
    estabelecimento_id: uuid.UUID,
    itens: list[CriarItemDespesaNfce],
) -> None:
    """Grava CNPJ no estabelecimento escolhido e os vínculos código → item (última escolha vence)."""
    await session.execute(
        update(Estabelecimento)
        .where(Estabelecimento.cnpj == origem.cnpj, Estabelecimento.id != estabelecimento_id)
        .values(cnpj=None)
    )
    await session.execute(
        update(Estabelecimento)
        .where(Estabelecimento.id == estabelecimento_id)
        .values(cnpj=origem.cnpj)
    )

    # dict deduplica códigos repetidos na nota: o upsert não pode tocar a mesma linha duas vezes
    vinculos = {i.codigo_produto_nfce: i.item_id for i in itens if i.codigo_produto_nfce}
    if not vinculos:
        return
    insercao = pg_insert(VinculoProdutoNfce).values(
        [
            {
                "id": uuid.uuid4(),
                "cnpj_raiz": origem.cnpj[:TAMANHO_CNPJ_RAIZ],
                "codigo_produto": codigo,
                "item_id": item_id,
            }
            for codigo, item_id in vinculos.items()
        ]
    )
    await session.execute(
        insercao.on_conflict_do_update(
            index_elements=[VinculoProdutoNfce.cnpj_raiz, VinculoProdutoNfce.codigo_produto],
            set_={"item_id": insercao.excluded.item_id, "data_alteracao": func.now()},
        )
    )
```

- [ ] **Step 5: Usar no `despesas.criar`**

Em `app/services/despesas.py`, adicionar o import:

```python
from app.services import nfce as nfce_service
```

e substituir o trecho de `criar` desde `despesa = Despesa(...)` até o fim do loop de itens por:

```python
    if body.nfce is not None:
        await nfce_service.garantir_nao_importada(session, body.nfce.chave)

    despesa = Despesa(**body.model_dump(exclude={"abastecimento", "itens", "nfce"}))
    if body.nfce is not None:
        despesa.chave_nfce = body.nfce.chave
    session.add(despesa)
    await session.flush()

    for item_data in body.itens:
        item_despesa = ItemDespesa(
            despesa_id=despesa.id, **item_data.model_dump(exclude={"codigo_produto_nfce"})
        )
        session.add(item_despesa)
        await session.flush()
        await _registrar_historico(session, item_despesa, despesa)

    if body.nfce is not None:
        await nfce_service.registrar_origem(
            session, body.nfce, despesa.estabelecimento_id, body.itens
        )
```

(O bloco do abastecimento e o `return await obter(...)` continuam iguais.)

- [ ] **Step 6: Rodar e ver passar (inclui os chamadores diretos)**

Run: `uv run pytest tests/test_nfce_gravacao.py tests/test_nfce_importar.py tests/test_despesas.py tests/test_itens_despesa.py -q`
Expected: todos passam.

- [ ] **Step 7: Lint e commit**

```bash
uv run ruff check --fix app/schemas/despesa.py app/services/nfce.py app/services/despesas.py tests/test_nfce_gravacao.py
uv run ruff format app/services/nfce.py tests/test_nfce_gravacao.py
git add app/schemas/despesa.py app/schemas/item_despesa.py app/services/nfce.py app/services/despesas.py tests/test_nfce_gravacao.py
git commit -m "feat: Grava chave, CNPJ e vínculos da NFC-e ao criar despesa" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(`ruff check app/schemas/item_despesa.py` acusa um `RUF100` pré-existente; não rode `ruff` nesse arquivo nesta task.)

Nota: `POST /despesas/{id}/itens` já falha na `main` com `MissingGreenlet` ao serializar `item` (e `tests/test_itens_despesa.py` tem 8 falhas pré-existentes por payload desatualizado). Fora do escopo — não corrija; a subclasse garante que esta task não mexe nessa rota.

---

### Task 6 (FRONT): Consertar `DespesaForm.test.ts` (falha pré-existente)

**Files:**
- Modify: `tests/unit/DespesaForm.test.ts`

**Interfaces:**
- Produces: suíte do `DespesaForm` verde, com mock de `@/api/unidades` — base para os testes da Task 10.

Causa: o `onMounted` chama `listarUnidadesMedida()` (sem mock → `fetch is not defined`), e 4 testes esperam um botão `btn-add-item` que não existe mais (o formulário mantém sempre uma linha vazia no final).

- [ ] **Step 1: Confirmar a falha**

Run: `npx jest tests/unit/DespesaForm.test.ts`
Expected: FAIL — 6 failed, 1 passed (`ReferenceError: fetch is not defined`).

- [ ] **Step 2: Adicionar o mock de unidades**

Antes de `jest.mock('@/api/carros', ...)`:

```ts
jest.mock('@/api/unidades', () => ({
  listarUnidadesMedida: jest.fn().mockResolvedValue([]),
  criarUnidadeMedida: jest.fn(),
}))
```

- [ ] **Step 3: Atualizar os testes obsoletos**

Substituir os testes `'renderiza todos os campos obrigatórios'`, `'inicia sem itens na lista'`, `'adiciona uma linha de item ao clicar em Adicionar Item'`, `'adiciona múltiplos itens'` e `'remove item ao clicar no botão de remover'` por:

```ts
  it('renderiza todos os campos obrigatórios', async () => {
    const wrapper = mount(DespesaForm)
    await flushPromises()
    expect(wrapper.find('[data-cy=select-estabelecimento]').exists()).toBe(true)
    expect(wrapper.find('[data-cy=input-data]').exists()).toBe(true)
    expect(wrapper.find('[data-cy=select-categoria]').exists()).toBe(true)
    expect(wrapper.find('[data-cy=input-valor-total]').exists()).toBe(true)
    expect(wrapper.find('[data-cy=btn-submit]').exists()).toBe(true)
  })

  it('inicia com uma linha de item vazia', () => {
    const wrapper = mount(DespesaForm)
    expect(wrapper.findAll('[data-cy=item-row]')).toHaveLength(1)
  })

  it('adiciona uma nova linha vazia ao preencher a última', async () => {
    const wrapper = mount(DespesaForm)
    await flushPromises()
    await wrapper.find('[data-cy=item-quantidade]').setValue('2')
    expect(wrapper.findAll('[data-cy=item-row]')).toHaveLength(2)
  })

  it('remove item ao clicar no botão de remover', async () => {
    const wrapper = mount(DespesaForm)
    await flushPromises()
    await wrapper.find('[data-cy=item-quantidade]').setValue('2')
    expect(wrapper.findAll('[data-cy=item-row]')).toHaveLength(2)

    await wrapper.find('[data-cy=item-remove]').trigger('click')
    expect(wrapper.findAll('[data-cy=item-row]')).toHaveLength(1)
  })
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest tests/unit/DespesaForm.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/DespesaForm.test.ts
git commit -m "test: Corrige testes desatualizados do DespesaForm" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7 (FRONT): Tipos, API e formatação de CNPJ

**Files:**
- Create: `src/api/nfce.ts`
- Modify: `src/types/api.ts`
- Modify: `src/utils/format.ts`
- Test: `tests/unit/nfce.api.test.ts`, `tests/unit/format.test.ts`

**Interfaces:**
- Produces:
  - Tipos `OrigemNfce`, `ItemRascunhoNfce`, `RascunhoNfce`; `CriarItemPayload.codigo_produto_nfce?: string`; `CriarDespesaPayload.nfce?: OrigemNfce`; `ItemFormState.codigo_produto_nfce?: string` e `ItemFormState.descricao_nota?: string`.
  - `importarNfce(url: string): Promise<RascunhoNfce>` e `enum MensagemNfce { CAMERA_INDISPONIVEL, VINCULE_ITENS, ERRO_IMPORTACAO }` em `@/api/nfce`.
  - `formatCnpj(cnpj: string): string` em `@/utils/format`.

- [ ] **Step 1: Escrever os testes**

`tests/unit/nfce.api.test.ts`:

```ts
import { importarNfce } from '@/api/nfce'

function mockFetch(data: unknown, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response)
}

const URL_NOTA = 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=43|2|1|2|ABC'

describe('API: importarNfce', () => {
  it('faz POST para /nfce/importar com a url', async () => {
    mockFetch({ chave: 'x', itens: [] })
    await importarNfce(URL_NOTA)
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/nfce/importar',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ url: URL_NOTA }) })
    )
  })

  it('propaga a mensagem de erro da API', async () => {
    mockFetch({ detail: 'SEFAZ indisponível, tente novamente' }, 502)
    await expect(importarNfce(URL_NOTA)).rejects.toThrow('SEFAZ indisponível, tente novamente')
  })
})
```

Em `tests/unit/format.test.ts`, trocar o import por `import { formatDate, formatCurrency, getCurrentISODate, formatCnpj } from '@/utils/format'` e adicionar dentro do `describe('format utils')`:

```ts
  describe('formatCnpj', () => {
    it('deve formatar CNPJ só com dígitos', () => {
      expect(formatCnpj('01132478002343')).toBe('01.132.478/0023-43')
    })
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest tests/unit/nfce.api.test.ts tests/unit/format.test.ts`
Expected: FAIL — `Cannot find module '@/api/nfce'` e `formatCnpj is not a function`.

- [ ] **Step 3: Tipos**

Em `src/types/api.ts`:
- em `CriarItemPayload`, adicionar `codigo_produto_nfce?: string`;
- em `ItemFormState`, adicionar `codigo_produto_nfce?: string` e `descricao_nota?: string`;
- em `CriarDespesaPayload`, adicionar `nfce?: OrigemNfce`;
- ao final do arquivo:

```ts
export interface OrigemNfce {
  chave: string
  cnpj: string
}

export interface ItemRascunhoNfce {
  codigo: string
  descricao_nota: string
  unidade_nota: string
  quantidade: string
  valor_unitario: string
  valor_desconto: string
  item_id: string | null
}

export interface RascunhoNfce {
  chave: string
  data_emissao: string
  cnpj: string
  razao_social: string
  endereco: string
  estabelecimento_id: string | null
  valor_pago: string
  desconto_total: string
  itens: ItemRascunhoNfce[]
}
```

- [ ] **Step 4: API e formatação**

`src/api/nfce.ts`:

```ts
import { client } from './client'
import type { RascunhoNfce } from '@/types/api'

export enum MensagemNfce {
  CAMERA_INDISPONIVEL = 'Não foi possível acessar a câmera',
  VINCULE_ITENS = 'Vincule todos os itens da nota',
  ERRO_IMPORTACAO = 'Erro ao importar a nota',
}

export function importarNfce(url: string): Promise<RascunhoNfce> {
  return client.post('/nfce/importar', { url })
}
```

Em `src/utils/format.ts`, ao final:

```ts
/**
 * Formata um CNPJ com 14 dígitos para 00.000.000/0000-00.
 */
export function formatCnpj(cnpj: string): string {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx jest tests/unit/nfce.api.test.ts tests/unit/format.test.ts && npm run typecheck`
Expected: testes passam; typecheck sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/api/nfce.ts src/types/api.ts src/utils/format.ts tests/unit/nfce.api.test.ts tests/unit/format.test.ts
git commit -m "feat: Adiciona tipos e cliente da importação de NFC-e" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8 (FRONT): Leitor de QR pela webcam

**Files:**
- Create: `src/components/LeitorQrCode.vue`
- Modify: `package.json`, `package-lock.json` (via `npm install`)
- Test: `tests/unit/LeitorQrCode.test.ts`

**Interfaces:**
- Consumes: `MensagemNfce` (Task 7).
- Produces: componente `LeitorQrCode` sem props; emite `lido: [texto: string]` (conteúdo do QR) e `erro: [mensagem: string]`. Desliga a câmera ao ler, ao falhar e ao desmontar.

- [ ] **Step 1: Instalar `jsqr`**

Run: `npm install jsqr@1.4.0`
Expected: `jsqr` em `dependencies` do `package.json` (traz as próprias tipagens).

- [ ] **Step 2: Escrever os testes**

`tests/unit/LeitorQrCode.test.ts`:

```ts
import { mount, flushPromises } from '@vue/test-utils'
import LeitorQrCode from '@/components/LeitorQrCode.vue'
import { MensagemNfce } from '@/api/nfce'

jest.mock('jsqr', () => ({ __esModule: true, default: jest.fn(() => null) }))

function mockGetUserMedia(impl: () => Promise<MediaStream>) {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: jest.fn(impl) },
    configurable: true,
  })
}

describe('LeitorQrCode', () => {
  it('emite erro quando a câmera é negada', async () => {
    mockGetUserMedia(() => Promise.reject(new DOMException('negado', 'NotAllowedError')))
    const wrapper = mount(LeitorQrCode)
    await flushPromises()
    expect(wrapper.emitted('erro')?.[0]).toEqual([MensagemNfce.CAMERA_INDISPONIVEL])
  })

  it('desliga a câmera se o leitor for fechado antes da permissão', async () => {
    const stop = jest.fn()
    let liberar!: (stream: MediaStream) => void
    mockGetUserMedia(() => new Promise(resolve => { liberar = resolve }))

    const wrapper = mount(LeitorQrCode)
    wrapper.unmount()
    liberar({ getTracks: () => [{ stop }] } as unknown as MediaStream)
    await flushPromises()

    expect(stop).toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx jest tests/unit/LeitorQrCode.test.ts`
Expected: FAIL — `Cannot find module '@/components/LeitorQrCode.vue'`.

- [ ] **Step 4: Implementar**

`src/components/LeitorQrCode.vue`:

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { MensagemNfce } from '@/api/nfce'

const emit = defineEmits<{ lido: [texto: string]; erro: [mensagem: string] }>()

const video = ref<HTMLVideoElement | null>(null)
let stream: MediaStream | null = null
let quadro = 0
let ativo = true

function pararCamera() {
  ativo = false
  cancelAnimationFrame(quadro)
  stream?.getTracks().forEach(track => track.stop())
  stream = null
}

onMounted(async () => {
  try {
    // jsqr só é baixado quando a webcam é aberta
    const [{ default: jsQR }, midia] = await Promise.all([
      import('jsqr'),
      navigator.mediaDevices.getUserMedia({ video: true }),
    ])
    stream = midia
    // fechado enquanto o navegador pedia permissão: desliga a câmera que acabou de abrir
    if (!ativo || !video.value) {
      pararCamera()
      return
    }
    video.value.srcObject = midia
    await video.value.play()

    const canvas = document.createElement('canvas')
    const contexto = canvas.getContext('2d', { willReadFrequently: true })
    const ler = () => {
      const v = video.value
      if (!ativo || !v || !contexto) return
      if (v.readyState >= v.HAVE_ENOUGH_DATA) {
        canvas.width = v.videoWidth
        canvas.height = v.videoHeight
        contexto.drawImage(v, 0, 0)
        const imagem = contexto.getImageData(0, 0, canvas.width, canvas.height)
        const qr = jsQR(imagem.data, imagem.width, imagem.height)
        if (qr) {
          pararCamera()
          emit('lido', qr.data)
          return
        }
      }
      quadro = requestAnimationFrame(ler)
    }
    quadro = requestAnimationFrame(ler)
  } catch {
    pararCamera()
    emit('erro', MensagemNfce.CAMERA_INDISPONIVEL)
  }
})

onBeforeUnmount(pararCamera)
</script>

<template>
  <video
    ref="video"
    muted
    playsinline
    data-cy="leitor-qr-video"
    class="w-full rounded-lg bg-black"
  />
</template>
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx jest tests/unit/LeitorQrCode.test.ts && npm run typecheck`
Expected: 2 passed; typecheck sem erros.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/components/LeitorQrCode.vue tests/unit/LeitorQrCode.test.ts
git commit -m "feat: Adiciona leitor de QR Code pela webcam" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9 (FRONT): Modal de importação

**Files:**
- Create: `src/components/ImportarNfceModal.vue`
- Test: `tests/unit/ImportarNfceModal.test.ts`

**Interfaces:**
- Consumes: `importarNfce`, `MensagemNfce` (Task 7); `LeitorQrCode` (Task 8).
- Produces: componente `ImportarNfceModal` sem props; emite `importado: [rascunho: RascunhoNfce]` e `fechar: []`. `data-cy`: `form-importar-nfce`, `input-nfce-url`, `btn-ler-webcam`, `btn-cancelar-nfce`, `btn-importar-nfce`, `nfce-erro`.

- [ ] **Step 1: Escrever os testes**

`tests/unit/ImportarNfceModal.test.ts`:

```ts
import { mount, flushPromises } from '@vue/test-utils'
import ImportarNfceModal from '@/components/ImportarNfceModal.vue'
import LeitorQrCode from '@/components/LeitorQrCode.vue'
import { importarNfce, MensagemNfce } from '@/api/nfce'
import type { RascunhoNfce } from '@/types/api'

jest.mock('@/api/nfce', () => ({
  ...jest.requireActual('@/api/nfce'),
  importarNfce: jest.fn(),
}))

const URL_NOTA = 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=43|2|1|2|ABC'
const ERRO_SEFAZ = 'SEFAZ indisponível, tente novamente'

const rascunho: RascunhoNfce = {
  chave: '43' + '0'.repeat(41) + '1',
  data_emissao: '2026-08-19',
  cnpj: '01132478002343',
  razao_social: 'Irmaos Andreazza Ltda',
  endereco: 'Rua Padre Angelo Tronca, 2150, Sao Luiz, Caxias Do Sul, RS',
  estabelecimento_id: null,
  valor_pago: '5.00',
  desconto_total: '0.00',
  itens: [],
}

describe('ImportarNfceModal', () => {
  beforeEach(() => jest.mocked(importarNfce).mockReset())

  it('importa o link colado e emite o rascunho', async () => {
    jest.mocked(importarNfce).mockResolvedValue(rascunho)
    const wrapper = mount(ImportarNfceModal)

    await wrapper.find('[data-cy=input-nfce-url]').setValue(`  ${URL_NOTA}  `)
    await wrapper.find('[data-cy=form-importar-nfce]').trigger('submit')
    await flushPromises()

    expect(importarNfce).toHaveBeenCalledWith(URL_NOTA)
    expect(wrapper.emitted('importado')?.[0]).toEqual([rascunho])
  })

  it('mostra o erro da API no modal', async () => {
    jest.mocked(importarNfce).mockRejectedValue(new Error(ERRO_SEFAZ))
    const wrapper = mount(ImportarNfceModal)

    await wrapper.find('[data-cy=input-nfce-url]').setValue(URL_NOTA)
    await wrapper.find('[data-cy=form-importar-nfce]').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[data-cy=nfce-erro]').text()).toBe(ERRO_SEFAZ)
    expect(wrapper.emitted('importado')).toBeUndefined()
  })

  it('importa automaticamente o link lido pela webcam', async () => {
    jest.mocked(importarNfce).mockResolvedValue(rascunho)
    const wrapper = mount(ImportarNfceModal, { global: { stubs: { LeitorQrCode: true } } })

    await wrapper.find('[data-cy=btn-ler-webcam]').trigger('click')
    wrapper.findComponent(LeitorQrCode).vm.$emit('lido', URL_NOTA)
    await flushPromises()

    expect(importarNfce).toHaveBeenCalledWith(URL_NOTA)
    expect(wrapper.findComponent(LeitorQrCode).exists()).toBe(false)
  })

  it('mostra o erro da câmera', async () => {
    const wrapper = mount(ImportarNfceModal, { global: { stubs: { LeitorQrCode: true } } })

    await wrapper.find('[data-cy=btn-ler-webcam]').trigger('click')
    wrapper.findComponent(LeitorQrCode).vm.$emit('erro', MensagemNfce.CAMERA_INDISPONIVEL)
    await flushPromises()

    expect(wrapper.find('[data-cy=nfce-erro]').text()).toBe(MensagemNfce.CAMERA_INDISPONIVEL)
  })

  it('emite fechar ao cancelar', async () => {
    const wrapper = mount(ImportarNfceModal)
    await wrapper.find('[data-cy=btn-cancelar-nfce]').trigger('click')
    expect(wrapper.emitted('fechar')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest tests/unit/ImportarNfceModal.test.ts`
Expected: FAIL — `Cannot find module '@/components/ImportarNfceModal.vue'`.

- [ ] **Step 3: Implementar**

`src/components/ImportarNfceModal.vue` (mesmo visual dos modais existentes do `DespesaForm`):

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { importarNfce, MensagemNfce } from '@/api/nfce'
import type { RascunhoNfce } from '@/types/api'
import LeitorQrCode from './LeitorQrCode.vue'

const emit = defineEmits<{ importado: [rascunho: RascunhoNfce]; fechar: [] }>()

const url = ref('')
const erro = ref<string | null>(null)
const carregando = ref(false)
const lendoWebcam = ref(false)

async function importar() {
  const link = url.value.trim()
  if (!link) return
  carregando.value = true
  erro.value = null
  try {
    emit('importado', await importarNfce(link))
  } catch (e) {
    erro.value = e instanceof Error ? e.message : MensagemNfce.ERRO_IMPORTACAO
  } finally {
    carregando.value = false
  }
}

function onLido(texto: string) {
  lendoWebcam.value = false
  url.value = texto
  importar()
}

function onErroCamera(mensagem: string) {
  lendoWebcam.value = false
  erro.value = mensagem
}
</script>

<template>
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <form
      data-cy="form-importar-nfce"
      class="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4 border border-gray-100"
      @submit.prevent="importar"
    >
      <h4 class="text-lg font-bold text-gray-800">Importar NFC-e</h4>

      <LeitorQrCode v-if="lendoWebcam" @lido="onLido" @erro="onErroCamera" />

      <div>
        <label for="nfce-url" class="block text-sm font-medium text-gray-600 mb-1">Link do QR Code</label>
        <input
          id="nfce-url"
          v-model="url"
          data-cy="input-nfce-url"
          type="text"
          inputmode="url"
          placeholder="https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=..."
          class="block w-full rounded-lg border-gray-300 bg-gray-50/30 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <p v-if="erro" data-cy="nfce-erro" class="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{{ erro }}</p>

      <div class="flex gap-3 pt-2">
        <button
          type="button"
          data-cy="btn-ler-webcam"
          class="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
          @click="lendoWebcam = !lendoWebcam"
        >
          {{ lendoWebcam ? 'Parar webcam' : 'Ler pela webcam' }}
        </button>
        <button
          type="button"
          data-cy="btn-cancelar-nfce"
          class="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          @click="emit('fechar')"
        >
          Cancelar
        </button>
        <button
          type="submit"
          data-cy="btn-importar-nfce"
          :disabled="!url.trim() || carregando"
          class="flex-1 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {{ carregando ? 'Importando...' : 'Importar' }}
        </button>
      </div>
    </form>
  </div>
</template>
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest tests/unit/ImportarNfceModal.test.ts && npm run typecheck`
Expected: 5 passed; typecheck sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/components/ImportarNfceModal.vue tests/unit/ImportarNfceModal.test.ts
git commit -m "feat: Adiciona modal de importação de NFC-e" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10 (FRONT): Preencher o `DespesaForm` a partir da nota

**Files:**
- Modify: `src/components/DespesaForm.vue`
- Modify: `src/components/ItemFormRow.vue`
- Test: `tests/unit/DespesaForm.test.ts`

**Interfaces:**
- Consumes: `ImportarNfceModal` (Task 9); `MensagemNfce` (Task 7); `formatCnpj` (Task 7); tipos `OrigemNfce`, `RascunhoNfce`, campos novos de `ItemFormState`/payloads (Task 7).
- Produces: botão `data-cy="btn-importar-nfce-abrir"` (só em criação); aviso `data-cy="nfce-estabelecimento-aviso"`; dica por linha `data-cy="item-descricao-nota"`; payload de criação com `nfce` e `codigo_produto_nfce`.

- [ ] **Step 1: Escrever os testes**

Em `tests/unit/DespesaForm.test.ts`:

1. Trocar o mock de unidades (Task 6) para devolver uma unidade:

```ts
jest.mock('@/api/unidades', () => ({
  listarUnidadesMedida: jest.fn().mockResolvedValue([{ id: 'und-kg', descricao: 'Kg' }]),
  criarUnidadeMedida: jest.fn(),
}))
```

2. Adicionar o mock da API de NFC-e (junto dos outros `jest.mock`):

```ts
jest.mock('@/api/nfce', () => ({
  ...jest.requireActual('@/api/nfce'),
  importarNfce: jest.fn(),
}))
```

3. Adicionar imports no topo:

```ts
import ImportarNfceModal from '@/components/ImportarNfceModal.vue'
import ItemFormRow from '@/components/ItemFormRow.vue'
import AppCombobox from '@/components/AppCombobox.vue'
import { criarDespesa } from '@/api/despesas'
import { MensagemNfce } from '@/api/nfce'
import type { DespesaDetalhe, RascunhoNfce } from '@/types/api'
import type { VueWrapper } from '@vue/test-utils'
```

4. Adicionar ao final do arquivo:

```ts
const rascunho: RascunhoNfce = {
  chave: '43' + '0'.repeat(41) + '1',
  data_emissao: '2026-08-19',
  cnpj: '01132478002343',
  razao_social: 'Irmaos Andreazza Ltda',
  endereco: 'Rua Padre Angelo Tronca, 2150, Sao Luiz, Caxias Do Sul, RS',
  estabelecimento_id: null,
  valor_pago: '14.00',
  desconto_total: '0.00',
  itens: [
    { codigo: '111', descricao_nota: 'Arroz Tio 1kg', unidade_nota: 'UN', quantidade: '1.000', valor_unitario: '5.00', valor_desconto: '0.00', item_id: 'item-1' },
    { codigo: '222', descricao_nota: 'Feijao Kg', unidade_nota: 'KG', quantidade: '1.000', valor_unitario: '8.00', valor_desconto: '0.00', item_id: null },
    { codigo: '333', descricao_nota: 'Item Antigo', unidade_nota: 'UN', quantidade: '1.000', valor_unitario: '1.00', valor_desconto: '0.00', item_id: 'item-fora-do-catalogo' },
  ],
}

async function abrirComNota(): Promise<VueWrapper> {
  const wrapper = mount(DespesaForm)
  await flushPromises()
  await wrapper.find('[data-cy=btn-importar-nfce-abrir]').trigger('click')
  wrapper.findComponent(ImportarNfceModal).vm.$emit('importado', rascunho)
  await flushPromises()
  return wrapper
}

async function vincularTudo(wrapper: VueWrapper) {
  wrapper.findAllComponents(AppCombobox)
    .find(c => c.props('dataCy') === 'select-estabelecimento')!
    .vm.$emit('update:modelValue', 'est-1')
  const linhas = wrapper.findAllComponents(ItemFormRow)
  linhas[1].findComponent(AppCombobox).vm.$emit('update:modelValue', 'item-2')
  linhas[2].findComponent(AppCombobox).vm.$emit('update:modelValue', 'item-1')
  await flushPromises()
}

describe('DespesaForm — importação de NFC-e', () => {
  beforeEach(() => jest.clearAllMocks())

  it('preenche o formulário a partir da nota', async () => {
    const wrapper = await abrirComNota()

    expect(wrapper.findComponent(ImportarNfceModal).exists()).toBe(false)
    expect(wrapper.findAll('[data-cy=item-row]')).toHaveLength(rascunho.itens.length + 1)
    expect((wrapper.find('[data-cy=input-data]').element as HTMLInputElement).value).toBe('2026-08-19')
    const aviso = wrapper.find('[data-cy=nfce-estabelecimento-aviso]').text()
    expect(aviso).toContain('Irmaos Andreazza Ltda')
    expect(aviso).toContain('01.132.478/0023-43')

    const dicas = wrapper.findAll('[data-cy=item-descricao-nota]')
    expect(dicas).toHaveLength(rascunho.itens.length)
    expect(dicas[1].text()).toContain('Feijao Kg · KG')

    const linhas = wrapper.findAllComponents(ItemFormRow)
    expect(linhas[0].props('modelValue')).toMatchObject({ item_id: 'item-1', codigo_produto_nfce: '111', valor_unitario: '5.00' })
    expect(linhas[1].props('modelValue')).toMatchObject({ item_id: '', unidade_medida_id: 'und-kg' })
    // vínculo para item fora do catálogo carregado (ex.: inativo) aparece como não vinculado
    expect(linhas[2].props('modelValue')).toMatchObject({ item_id: '' })
  })

  it('bloqueia o salvamento enquanto houver item da nota sem vínculo', async () => {
    const wrapper = await abrirComNota()

    await wrapper.find('[data-cy=despesa-form]').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain(MensagemNfce.VINCULE_ITENS)
    expect(criarDespesa).not.toHaveBeenCalled()
  })

  it('envia a origem da nota e os códigos dos produtos ao salvar', async () => {
    const wrapper = await abrirComNota()
    await vincularTudo(wrapper)

    await wrapper.find('[data-cy=despesa-form]').trigger('submit')
    await flushPromises()

    expect(criarDespesa).toHaveBeenCalledWith(expect.objectContaining({
      estabelecimento_id: 'est-1',
      data_despesa: '2026-08-19',
      nfce: { chave: rascunho.chave, cnpj: rascunho.cnpj },
      itens: [
        expect.objectContaining({ item_id: 'item-1', codigo_produto_nfce: '111' }),
        expect.objectContaining({ item_id: 'item-2', codigo_produto_nfce: '222' }),
        expect.objectContaining({ item_id: 'item-1', codigo_produto_nfce: '333' }),
      ],
    }))
  })

  it('"Salvar e começar outra" não leva a nota para a próxima despesa', async () => {
    const wrapper = await abrirComNota()
    await vincularTudo(wrapper)

    await wrapper.find('[data-cy=btn-submit-and-new]').trigger('click')
    await flushPromises()
    expect(jest.mocked(criarDespesa).mock.calls[0][0].nfce).toBeDefined()
    expect(wrapper.findAll('[data-cy=item-descricao-nota]')).toHaveLength(0)
    expect(wrapper.find('[data-cy=nfce-estabelecimento-aviso]').exists()).toBe(false)

    await wrapper.find('[data-cy=despesa-form]').trigger('submit')
    await flushPromises()
    expect(jest.mocked(criarDespesa).mock.calls[1][0].nfce).toBeUndefined()
  })

  it('não oferece importação na edição', async () => {
    const despesa = {
      id: 'd-1', estabelecimento_id: 'est-1', categoria_despesa_id: 'cat-1', valor_total: '10.00',
      data_despesa: '2026-08-19', observacao: null, itens: [], abastecimento: null,
    } as unknown as DespesaDetalhe
    const wrapper = mount(DespesaForm, { props: { despesa } })
    await flushPromises()
    expect(wrapper.find('[data-cy=btn-importar-nfce-abrir]').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest tests/unit/DespesaForm.test.ts`
Expected: os 6 testes da Task 6 passam; os 5 novos falham (`btn-importar-nfce-abrir` não encontrado).

- [ ] **Step 3: Dica da nota no `ItemFormRow`**

Em `src/components/ItemFormRow.vue`, dentro de `<div class="col-span-3">`, logo após o `<AppCombobox ... />` do item:

```vue
      <p
        v-if="model.descricao_nota"
        data-cy="item-descricao-nota"
        :title="model.descricao_nota"
        class="mt-1 truncate text-[11px] text-gray-500"
      >
        Na nota: {{ model.descricao_nota }}
      </p>
```

- [ ] **Step 4: Script do `DespesaForm`**

Em `src/components/DespesaForm.vue`:

1. Imports — trocar `import { getCurrentISODate } from '@/utils/format'` por `import { formatCnpj, getCurrentISODate } from '@/utils/format'` e adicionar:

```ts
import { MensagemNfce } from '@/api/nfce'
import ImportarNfceModal from './ImportarNfceModal.vue'
```

e incluir `OrigemNfce, RascunhoNfce` no `import type { ... } from '@/types/api'`.

2. Estado — após `const indiceItemPendente = ref(-1)`:

```ts
// Importação de NFC-e
const mostrandoModalNfce = ref(false)
const origemNfce = ref<OrigemNfce | null>(null)
const avisoEstabelecimentoNfce = ref<string | null>(null)
```

3. Após a função `popularFormulario()`:

```ts
// Não liga `inicializando`: a sugestão de categoria deve disparar pelo estabelecimento da nota
function popularDeRascunho(r: RascunhoNfce) {
  resetForm()
  mostrandoModalNfce.value = false
  origemNfce.value = { chave: r.chave, cnpj: r.cnpj }
  form.data_despesa = r.data_emissao
  form.estabelecimento_id = r.estabelecimento_id ?? ''
  avisoEstabelecimentoNfce.value = r.estabelecimento_id
    ? null
    : `${r.razao_social} · ${formatCnpj(r.cnpj)} · ${r.endereco}`

  itens.value = [
    ...r.itens.map(item => {
      // vínculo para item ausente do catálogo carregado (ex.: inativo) conta como não vinculado
      const doCatalogo = itensDisponiveis.value.find(i => i.id === item.item_id)
      const unidadeDaNota = unidadesMedida.value.find(
        u => u.descricao.toLowerCase() === item.unidade_nota.toLowerCase()
      )
      return {
        item_id: doCatalogo?.id ?? '',
        unidade_medida_id: doCatalogo ? doCatalogo.unidade_medida_id ?? '' : unidadeDaNota?.id ?? '',
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        valor_desconto: item.valor_desconto,
        codigo_produto_nfce: item.codigo,
        descricao_nota: `${item.descricao_nota} · ${item.unidade_nota}`,
      }
    }),
    { item_id: '', unidade_medida_id: '', quantidade: '', valor_unitario: '', valor_desconto: '' },
  ]
}

function bloqueadoPorNfce(): boolean {
  if (!itens.value.some(i => i.codigo_produto_nfce && !i.item_id)) return false
  error.value = MensagemNfce.VINCULE_ITENS
  return true
}
```

4. Em `resolveItens()`, incluir o código no objeto empurrado:

```ts
    result.push({ item_id: await resolveItemId(formItem), quantidade: formItem.quantidade, valor_unitario: formItem.valor_unitario, valor_desconto: formItem.valor_desconto || '0', codigo_produto_nfce: formItem.codigo_produto_nfce })
```

5. Em `resetForm()`, antes de `error.value = null`:

```ts
  origemNfce.value = null
  avisoEstabelecimentoNfce.value = null
```

6. Substituir a montagem duplicada do payload de criação por uma função (logo após `resetForm`):

```ts
async function montarPayloadCriacao(): Promise<CriarDespesaPayload> {
  return {
    estabelecimento_id: form.estabelecimento_id,
    categoria_despesa_id: form.categoria_despesa_id,
    valor_total: form.valor_total,
    data_despesa: form.data_despesa,
    observacao: form.observacao || undefined,
    itens: await resolveItens(),
    abastecimento: eAbastecimento.value ? {
      carro_id: abastecimento.carro_id,
      quilometragem: parseInt(abastecimento.quilometragem),
      litros: abastecimento.litros,
      observacao: abastecimento.observacao || undefined,
    } : undefined,
    nfce: origemNfce.value ?? undefined,
  }
}
```

7. Em `handleSubmit()`: como primeira linha, `if (!props.despesa && bloqueadoPorNfce()) return`; e trocar todo o bloco `else { const resolvedItens = ...; const payload ...; await criarDespesa(payload) }` por:

```ts
    } else {
      await criarDespesa(await montarPayloadCriacao())
    }
```

8. Em `handleSalvarEComecarOutra()`: como primeira linha, `if (bloqueadoPorNfce()) return`; e trocar o corpo do `try` por:

```ts
    await criarDespesa(await montarPayloadCriacao())
    resetForm()
```

- [ ] **Step 5: Template do `DespesaForm`**

1. Após o bloco `<!-- Modal de Item -->` (antes do cabeçalho), adicionar:

```vue
    <!-- Modal de importação de NFC-e -->
    <ImportarNfceModal
      v-if="mostrandoModalNfce"
      @importado="popularDeRascunho"
      @fechar="mostrandoModalNfce = false"
    />
```

2. No cabeçalho, após o `<h2>`:

```vue
      <button
        v-if="!props.despesa"
        type="button"
        data-cy="btn-importar-nfce-abrir"
        class="ml-auto px-4 py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
        @click="mostrandoModalNfce = true"
      >
        Importar NFC-e
      </button>
```

3. Logo após o `<AppCombobox ... data-cy="select-estabelecimento" ... />`:

```vue
            <p
              v-if="avisoEstabelecimentoNfce && !form.estabelecimento_id"
              data-cy="nfce-estabelecimento-aviso"
              class="mt-1 text-xs text-amber-700"
            >
              Na nota: {{ avisoEstabelecimentoNfce }}
            </p>
```

- [ ] **Step 6: Rodar e ver passar (inclui chamadores diretos)**

Run: `npx jest tests/unit/DespesaForm.test.ts tests/unit/ImportarNfceModal.test.ts && npm run typecheck`
Expected: 11 + 5 passed; typecheck sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/components/DespesaForm.vue src/components/ItemFormRow.vue tests/unit/DespesaForm.test.ts
git commit -m "feat: Preenche nova despesa a partir da NFC-e importada" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11 (API + FRONT): Verificação final

**Files:** nenhum arquivo novo (correções pontuais só se algo falhar).

- [ ] **Step 1: Suíte completa do backend (uma vez, requer Docker)**

Run (no repo API): `uv run pytest -q`
Expected: todos os `tests/test_nfce_*.py` passam. Falhas pré-existentes na `main` (não corrigir, só relatar): `tests/test_itens_despesa.py` (8 falhas — payload antigo com `descricao`, e `POST /despesas/{id}/itens` quebra com `MissingGreenlet`) e possivelmente `tests/test_sugestoes.py` (mesmo payload antigo). Qualquer falha fora desses arquivos é regressão desta feature.

- [ ] **Step 2: Lint dos arquivos tocados no backend**

```bash
uv run ruff check app/models/vinculo_produto_nfce.py app/services/nfce.py app/services/nfce_parser.py app/schemas/nfce.py app/routers/nfce.py tests/test_nfce_parser.py tests/test_nfce_busca.py tests/test_nfce_importar.py tests/test_nfce_gravacao.py alembic/versions/5c2e9a1f7b3d_add_importacao_nfce.py
uv run ruff format --check app/models/vinculo_produto_nfce.py app/services/nfce.py app/services/nfce_parser.py app/schemas/nfce.py app/routers/nfce.py tests/test_nfce_parser.py tests/test_nfce_busca.py tests/test_nfce_importar.py tests/test_nfce_gravacao.py
```

Expected: sem erros nos arquivos novos (erros pré-existentes em outros arquivos ficam fora).

- [ ] **Step 3: Suíte completa do front, typecheck e build (depois que o Step 1 terminar — nunca em paralelo)**

Run (no repo FRONT): `npm run test:unit && npm run typecheck && npm run build`
Expected: tudo verde.

- [ ] **Step 4: Verificação manual (pelo usuário, no ambiente de dev dele)**

Sem E2E. Depois do merge, o usuário:
1. aplica a migração no banco de dev: `uv run alembic upgrade head` (no repo API);
2. com API e front rodando, abre "Nova Despesa" → "Importar NFC-e", cola o link de uma nota real do RS e confere itens, data, aviso do estabelecimento e total igual ao valor pago;
3. vincula os itens, salva, importa outra nota da mesma rede e confere que os itens vêm vinculados;
4. testa "Ler pela webcam" mostrando o QR do cupom para a câmera do PC.

- [ ] **Step 5: Integrar**

Use `superpowers:finishing-a-development-branch` em cada repo (merge na `main`).
