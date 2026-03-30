<template>
  <div class="parts-page">
    <header class="parts-header animate-fade-in">
      <div>
        <h1>Pièces détachées</h1>
        <p class="parts-subtitle">Gestion du stock de pièces de maintenance</p>
      </div>
    </header>

    <!-- Stats -->
    <div class="parts-stats stagger">
      <StatCard
        :value="partsStore.parts.length"
        label="Références"
        :icon="icons.ref"
        icon-bg="#EDF7F0"
        icon-color="#40916C"
      />
      <StatCard
        :value="partsStore.lowStockParts.length"
        label="Stock bas"
        :icon="icons.low"
        icon-bg="#FFF3D4"
        icon-color="#F4A261"
      />
      <StatCard
        :value="formatCurrency(partsStore.totalValue)"
        label="Valeur totale"
        :icon="icons.value"
        icon-bg="#D8F3DC"
        icon-color="#2D6A4F"
      />
    </div>

    <!-- Parts Table -->
    <section class="card table-section animate-fade-in">
      <div class="section-header">
        <h2>Inventaire</h2>
        <div class="section-actions">
          <input
            v-model="partsStore.searchQuery"
            class="input"
            placeholder="Rechercher une pièce..."
            style="width: 220px"
          />
          <select v-model="partsStore.filterCategory" class="input" style="width: 180px">
            <option value="all">Toutes catégories</option>
            <option v-for="cat in partsStore.categories" :key="cat" :value="cat">{{ cat }}</option>
          </select>
        </div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Pièce</th>
              <th>Catégorie</th>
              <th>Stock</th>
              <th>Stock min.</th>
              <th>État</th>
              <th>Prix unitaire</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="part in partsStore.filteredParts" :key="part.id">
              <td>
                <span class="part-name-cell">{{ part.name }}</span>
              </td>
              <td>
                <span class="category-tag">{{ part.category }}</span>
              </td>
              <td>
                <span class="stock-value" :class="{ low: part.quantity <= part.minStock }">
                  {{ part.quantity }}
                </span>
              </td>
              <td>{{ part.minStock }}</td>
              <td>
                <span
                  class="badge"
                  :class="part.quantity <= part.minStock ? 'badge-warning' : 'badge-ok'"
                >
                  <span class="badge-dot"></span>
                  {{ part.quantity <= part.minStock ? 'Stock bas' : 'OK' }}
                </span>
              </td>
              <td>{{ part.unitPrice }} €</td>
              <td>
                <div class="qty-actions">
                  <button class="qty-btn" @click="partsStore.updateQuantity(part.id, -1)">−</button>
                  <button class="qty-btn add" @click="partsStore.updateQuantity(part.id, 1)">+</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { usePartsStore } from '~/stores/parts'

definePageMeta({ layout: 'default' })

const partsStore = usePartsStore()

const icons = {
  ref: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="3"/><path d="M11 3v3m0 10v3M3 11h3m10 0h3"/></svg>',
  low: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 3L3 19h16L11 3z"/><path d="M11 9v4M11 15v.5"/></svg>',
  value: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="6" width="16" height="12" rx="2"/><path d="M3 10h16"/><path d="M7 14h3"/></svg>',
}

function formatCurrency(value: number) {
  return value.toLocaleString('fr-FR') + ' €'
}
</script>

<style scoped>
.parts-page {
  padding: var(--space-6) var(--space-8);
  max-width: 1200px;
}

.parts-header {
  margin-bottom: var(--space-6);
}

.parts-subtitle {
  color: var(--text-muted);
  font-size: 0.9rem;
  margin-top: var(--space-1);
}

.parts-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.table-section {
  padding: var(--space-5);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
  gap: var(--space-3);
}

.section-header h2 {
  font-size: 1.15rem;
}

.section-actions {
  display: flex;
  gap: var(--space-2);
}

.part-name-cell {
  font-weight: 600;
}

.category-tag {
  background: var(--gray-100);
  color: var(--text-secondary);
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 500;
}

.stock-value {
  font-weight: 700;
  font-size: 1rem;
  color: var(--green-700);
}

.stock-value.low {
  color: var(--solar-500);
}

.qty-actions {
  display: flex;
  gap: var(--space-1);
}

.qty-btn {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.qty-btn:hover {
  background: var(--bg-hover);
  border-color: var(--green-400);
  color: var(--text-primary);
}

.qty-btn.add {
  color: var(--green-700);
}

.qty-btn.add:hover {
  background: var(--green-200);
}

@media (max-width: 768px) {
  .parts-page {
    padding: var(--space-4);
  }

  .parts-stats {
    grid-template-columns: 1fr;
  }

  .section-actions {
    width: 100%;
    flex-direction: column;
  }

  .section-actions .input {
    width: 100% !important;
  }
}
</style>
