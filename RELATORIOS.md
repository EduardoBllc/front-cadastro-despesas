# Plano: Dashboard de Relatórios

## Dependências

```bash
npm install chart.js vue-chartjs
```

---

## Novos tipos em `src/types/api.ts`

```typescript
export interface GastoMensal {
  mes: number
  total: string
  quantidade: number
  ticket_medio: string | null
}

export interface GastoCategoria {
  categoria_id: string
  categoria_descricao: string
  total: string
  quantidade: number
  percentual: string
}

export interface AbastecimentoMensal {
  mes: number
  total_gasto: string
  total_litros: string
  quantidade: number
}

export interface AbastecimentoEficiencia {
  data_abastecimento: string
  quilometragem: number
  km_rodados: number | null
  km_por_litro: string | null
  valor_por_litro: string
  total_gasto: string
}
```

---

## Novo arquivo: `src/api/relatorios.ts`

Funções de chamada para cada endpoint seguindo o padrão de `src/api/despesas.ts`.

---

## Novos componentes

### `src/components/RelatorioView.vue`
- Página principal — seletor de ano, tabs/seções: Geral | Delivery | Abastecimentos
- Orquestra chamadas de API e passa dados para sub-componentes

### `src/components/relatorios/GastosMensaisChart.vue`
- **Tipo**: Bar chart
- **Dados**: `/relatorios/gastos-mensais?ano=`
- Eixo X = meses, Eixo Y = total gasto

### `src/components/relatorios/GastosCategoriaChart.vue`
- **Tipo**: Doughnut chart
- **Dados**: `/relatorios/gastos-por-categoria?ano=&mes=`
- Fatias por categoria, percentual no tooltip

### `src/components/relatorios/DeliveryChart.vue`
- **Tipo**: Bar (valor) + Line (frequência) sobrepostos
- **Dados**: `/relatorios/gastos-mensais-por-categoria?ano=&categoria_despesa_id=`
- Usuário seleciona qual categoria representa "delivery"

### `src/components/relatorios/AbastecimentosMensaisChart.vue`
- **Tipo**: Bar chart com dois datasets
- **Dados**: `/relatorios/abastecimentos-mensais?ano=&carro_id=`
- Dataset 1: total gasto (R$) | Dataset 2: total litros (eixo Y secundário)

### `src/components/relatorios/EficienciaChart.vue`
- **Tipo**: Line chart
- **Dados**: `/relatorios/abastecimentos-eficiencia?carro_id=&limite=`
- Eixo X = data do abastecimento, Eixo Y = km/L
- Filtrável por carro

---

## Arquivos modificados

### `App.vue`
Estender `currentView` de `'lista' | 'nova'` para `'lista' | 'nova' | 'relatorios'` e adicionar entrada de navegação.
