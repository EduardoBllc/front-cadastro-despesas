<script setup lang="ts">
defineOptions({ inheritAttrs: false })

defineProps<{
  variant: 'editar' | 'detalhes' | 'excluir'
  loading?: boolean
  disabled?: boolean
}>()

defineEmits<{ click: [] }>()

const variantClasses = {
  editar:   'border-gray-200 text-gray-700 hover:bg-gray-50',
  detalhes: 'border-blue-200 text-blue-600 hover:bg-blue-50',
  excluir:  'border-red-200 text-red-600 hover:bg-red-50',
}

const variantLabels = {
  editar:   'Editar',
  detalhes: 'Visualizar',
  excluir:  'Excluir',
}

const variantIcons = {
  editar:   `<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  detalhes: `<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  excluir:  `<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
}
</script>

<template>
  <div class="relative group inline-flex">
    <button
      v-bind="$attrs"
      type="button"
      :disabled="disabled || loading"
      @click="$emit('click')"
      :class="[
        'px-2 py-1 border rounded transition-colors disabled:opacity-50 flex items-center justify-center',
        variantClasses[variant],
      ]"
    >
      <span v-if="loading" class="text-xs">...</span>
      <span v-else v-html="variantIcons[variant]" />
    </button>
    <div class="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100 z-10">
      {{ variantLabels[variant] }}
      <div class="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
    </div>
  </div>
</template>
