<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

interface Option {
  id: string
  descricao: string
  label?: string
}

const props = defineProps<{
  modelValue: string
  options: Option[]
  placeholder?: string
  label?: string
  required?: boolean
  disabled?: boolean
  dataCy?: string
}>()

const emit = defineEmits(['update:modelValue', 'create'])

const isOpen = ref(false)
const searchQuery = ref('')
const containerRef = ref<HTMLElement | null>(null)

// Sincroniza o texto do input com a opção selecionada
const selectedOption = computed(() => 
  props.options.find(opt => opt.id === props.modelValue)
)

// Quando a opção selecionada muda (ou a lista de opções é atualizada),
// sincronizamos o campo de texto se o dropdown estiver fechado.
watch([selectedOption, () => props.options], ([newOpt]) => {
  if (!isOpen.value) {
    searchQuery.value = newOpt ? newOpt.descricao : ''
  }
}, { immediate: true, deep: true })

// Limpa erro de validação quando o valor muda
const validationRef = ref<HTMLInputElement | null>(null)
watch(() => props.modelValue, (newVal) => {
  if (newVal && validationRef.value) {
    validationRef.value.setCustomValidity('')
  }
})

// Filtra as opções com base na digitação
const filteredOptions = computed(() => {
  if (!searchQuery.value) return props.options
  const query = searchQuery.value.toLowerCase()
  return props.options.filter(opt =>
    (opt.label ?? opt.descricao).toLowerCase().includes(query)
  )
})

// Verifica se existe uma opção que bate exatamente com a busca (case-insensitive)
const exactMatch = computed(() =>
  props.options.find(opt =>
    opt.descricao.toLowerCase() === searchQuery.value.toLowerCase() ||
    opt.label?.toLowerCase() === searchQuery.value.toLowerCase()
  )
)

function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value) searchQuery.value = ''
}

function selectOption(option: Option) {
  emit('update:modelValue', option.id)
  searchQuery.value = option.descricao
  isOpen.value = false
}

// Fecha o dropdown ao clicar fora
function handleClickOutside(event: MouseEvent) {
  // composedPath() preserva o caminho original mesmo que nós sejam removidos do DOM
  // (ex: o <li> do dropdown é removido quando isOpen=false antes do evento borbulhar)
  if (containerRef.value && !event.composedPath().includes(containerRef.value)) {
    isOpen.value = false
    if (selectedOption.value) {
      searchQuery.value = selectedOption.value.descricao
    } else {
      searchQuery.value = ''
    }
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})
</script>

<template>
  <div class="relative" ref="containerRef">
    <label v-if="label" class="block text-sm font-medium text-gray-600 mb-1">
      {{ label }} {{ required ? '*' : '' }}
    </label>
    
    <div class="relative">
      <!-- Input Invisível para Validação HTML5 -->
      <input
        v-if="required"
        ref="validationRef"
        :value="modelValue"
        required
        tabindex="-1"
        aria-hidden="true"
        class="absolute opacity-0 pointer-events-none w-full h-full left-0 top-0"
        @invalid="e => (e.target as HTMLInputElement).setCustomValidity('Por favor, selecione uma opção da lista.')"
      />

      <input
        type="text"
        :value="isOpen ? searchQuery : (selectedOption?.descricao || searchQuery)"
        @input="e => { searchQuery = (e.target as HTMLInputElement).value; isOpen = true }"
        @focus="!disabled && (isOpen = true)"
        :placeholder="placeholder"
        :disabled="disabled"
        :data-cy="dataCy"
        class="block w-full rounded-lg border-gray-300 bg-white px-4 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-blue-500 pr-10"
        :class="[disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : '']"
      />

      <button
        type="button"
        @click="!disabled && toggle()"
        :disabled="disabled"
        class="absolute inset-y-0 right-0 flex items-center px-2 text-gray-400 hover:text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <svg class="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor">
          <path d="M7 7l3 3 3-3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>

    <!-- Lista de Opções (Dropdown) -->
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <ul
        v-if="isOpen"
        class="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl bg-white py-1 text-base shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
      >
        <li
          v-if="searchQuery && !exactMatch"
          @mousedown.prevent="emit('create', searchQuery); isOpen = false"
          class="relative cursor-pointer select-none py-2.5 px-4 text-blue-600 hover:bg-blue-50 font-medium border-b border-gray-100"
        >
          + Criar "{{ searchQuery }}"
        </li>

        <li
          v-if="filteredOptions.length === 0 && !searchQuery"
          class="relative cursor-default select-none py-3 px-4 text-gray-500 italic"
        >
          Nenhuma opção encontrada
        </li>
        
        <li
          v-for="option in filteredOptions"
          :key="option.id"
          @mousedown.prevent="selectOption(option)"
          :class="[
            'relative cursor-pointer select-none py-2.5 px-4 transition-colors',
            modelValue === option.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-900 hover:bg-gray-50'
          ]"
        >
          {{ option.label ?? option.descricao }}
        </li>
      </ul>
    </Transition>
  </div>
</template>
