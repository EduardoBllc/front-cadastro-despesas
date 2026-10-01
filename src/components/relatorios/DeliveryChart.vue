<script setup lang="ts">
import { computed } from 'vue'
import { Chart } from 'vue-chartjs'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, PointElement, LineElement, Tooltip, Legend,
} from 'chart.js'
import type { GastoMensal } from '@/types/api'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend)

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const props = defineProps<{ dados: GastoMensal[] }>()

const chartData = computed(() => {
  const map = new Map(props.dados.map(d => [d.mes, d]))
  const totais = Array.from({ length: 12 }, (_, i) => {
    const d = map.get(i + 1)
    return d ? parseFloat(d.total) : 0
  })
  const qtds = Array.from({ length: 12 }, (_, i) => map.get(i + 1)?.quantidade ?? 0)
  return {
    labels: MESES,
    datasets: [
      {
        type: 'bar' as const,
        label: 'Valor (R$)',
        data: totais,
        backgroundColor: '#3b82f6',
        borderRadius: 4,
        yAxisID: 'y',
      },
      {
        type: 'line' as const,
        label: 'Pedidos',
        data: qtds,
        borderColor: '#f59e0b',
        backgroundColor: '#f59e0b',
        pointRadius: 4,
        tension: 0.3,
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
      ticks: { stepSize: 1 },
    },
  },
}
</script>

<template>
  <div class="h-64">
    <Chart type="bar" :data="chartData" :options="options" />
  </div>
</template>
