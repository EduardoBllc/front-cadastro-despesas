<script setup lang="ts">
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import type { AbastecimentoMensal } from '@/types/api'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const props = defineProps<{ dados: AbastecimentoMensal[] }>()

const chartData = computed(() => {
  const map = new Map(props.dados.map(d => [d.mes, d]))
  return {
    labels: MESES,
    datasets: [
      {
        label: 'Gasto (R$)',
        data: Array.from({ length: 12 }, (_, i) => {
          const d = map.get(i + 1)
          return d ? parseFloat(d.total_gasto) : 0
        }),
        backgroundColor: '#3b82f6',
        borderRadius: 4,
        yAxisID: 'y',
      },
      {
        label: 'Litros',
        data: Array.from({ length: 12 }, (_, i) => {
          const d = map.get(i + 1)
          return d ? parseFloat(d.total_litros) : 0
        }),
        backgroundColor: '#10b981',
        borderRadius: 4,
        yAxisID: 'y1',
      },
    ],
  }
})

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top' as const, labels: { boxWidth: 12, font: { size: 12 } } },
    tooltip: { mode: 'index' as const, intersect: false },
  },
  scales: {
    x: { grid: { display: false } },
    y: {
      position: 'left' as const,
      grid: { color: '#f1f5f9' },
      ticks: { callback: (v: unknown) => `R$ ${Number(v).toLocaleString('pt-BR')}` },
    },
    y1: {
      position: 'right' as const,
      grid: { drawOnChartArea: false },
      ticks: { callback: (v: unknown) => `${Number(v).toLocaleString('pt-BR')} L` },
    },
  },
}
</script>

<template>
  <div class="h-64">
    <Bar :data="chartData" :options="options" />
  </div>
</template>
