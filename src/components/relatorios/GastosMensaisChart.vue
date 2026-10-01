<script setup lang="ts">
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js'
import type { GastoMensal } from '@/types/api'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const props = defineProps<{ dados: GastoMensal[] }>()

const chartData = computed(() => {
  const map = new Map(props.dados.map(d => [d.mes, parseFloat(d.total)]))
  return {
    labels: MESES,
    datasets: [{
      data: Array.from({ length: 12 }, (_, i) => map.get(i + 1) ?? 0),
      backgroundColor: '#3b82f6',
      borderRadius: 4,
    }],
  }
})

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: { raw: unknown }) =>
          `R$ ${Number(ctx.raw).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      },
    },
  },
  scales: {
    x: { grid: { display: false } },
    y: {
      grid: { color: '#f1f5f9' },
      ticks: {
        callback: (v: unknown) => `R$ ${Number(v).toLocaleString('pt-BR')}`,
      },
    },
  },
}
</script>

<template>
  <div class="h-64">
    <Bar :data="chartData" :options="options" />
  </div>
</template>
