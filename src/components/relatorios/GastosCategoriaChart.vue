<script setup lang="ts">
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import type { GastoCategoria } from '@/types/api'

ChartJS.register(ArcElement, Tooltip, Legend)

const CORES = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

const props = defineProps<{ dados: GastoCategoria[] }>()

const chartData = computed(() => ({
  labels: props.dados.map(d => d.categoria_descricao),
  datasets: [{
    data: props.dados.map(d => parseFloat(d.total)),
    backgroundColor: CORES.slice(0, props.dados.length),
    borderWidth: 0,
  }],
}))

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'right' as const, labels: { boxWidth: 12, font: { size: 12 } } },
    tooltip: {
      callbacks: {
        label: (ctx: { raw: unknown; label: string; dataIndex: number }) => {
          const item = props.dados[ctx.dataIndex]
          return ` ${ctx.label}: R$ ${Number(ctx.raw).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${item.percentual}%)`
        },
      },
    },
  },
}
</script>

<template>
  <div class="h-64">
    <Doughnut :data="chartData" :options="options" />
  </div>
</template>
