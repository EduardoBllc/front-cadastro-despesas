<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Tooltip,
} from 'chart.js'
import type { AbastecimentoEficiencia } from '@/types/api'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip)

const props = defineProps<{ dados: AbastecimentoEficiencia[] }>()

function formatarData(iso: string) {
  const [, mes, dia] = iso.split('-')
  return `${dia}/${mes}`
}

const chartData = computed(() => ({
  labels: props.dados.map(d => formatarData(d.data_abastecimento)),
  datasets: [{
    label: 'km/L',
    data: props.dados.map(d => d.km_por_litro != null ? parseFloat(d.km_por_litro) : null),
    borderColor: '#3b82f6',
    backgroundColor: '#93c5fd',
    pointRadius: 5,
    pointHoverRadius: 7,
    tension: 0.3,
    spanGaps: false,
  }],
}))

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: { raw: unknown }) => `${Number(ctx.raw).toFixed(2)} km/L`,
      },
    },
  },
  scales: {
    x: { grid: { display: false } },
    y: {
      grid: { color: '#f1f5f9' },
      ticks: { callback: (v: unknown) => `${Number(v).toFixed(1)}` },
    },
  },
}
</script>

<template>
  <div class="h-64">
    <Line :data="chartData" :options="options" />
  </div>
</template>
