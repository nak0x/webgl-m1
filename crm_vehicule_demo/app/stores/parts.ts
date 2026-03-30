import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import partsData from '~/data/parts.json'

export interface Part {
  id: string
  name: string
  category: string
  quantity: number
  minStock: number
  unitPrice: number
}

export const usePartsStore = defineStore('parts', () => {
  const parts = ref<Part[]>(partsData as Part[])
  const searchQuery = ref<string>('')
  const filterCategory = ref<string>('all')

  const filteredParts = computed(() => {
    let result = parts.value

    if (filterCategory.value !== 'all') {
      result = result.filter((p) => p.category === filterCategory.value)
    }

    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
      )
    }

    return result
  })

  const categories = computed(() => {
    const cats = new Set(parts.value.map((p) => p.category))
    return Array.from(cats).sort()
  })

  const lowStockParts = computed(() => parts.value.filter((p) => p.quantity <= p.minStock))

  const totalValue = computed(() =>
    parts.value.reduce((sum, p) => sum + p.quantity * p.unitPrice, 0),
  )

  function getPartById(id: string): Part | undefined {
    return parts.value.find((p) => p.id === id)
  }

  function updateQuantity(id: string, delta: number) {
    const part = parts.value.find((p) => p.id === id)
    if (part) {
      part.quantity = Math.max(0, part.quantity + delta)
    }
  }

  return {
    parts,
    searchQuery,
    filterCategory,
    filteredParts,
    categories,
    lowStockParts,
    totalValue,
    getPartById,
    updateQuantity,
  }
})
