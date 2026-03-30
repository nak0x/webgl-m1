<template>
  <div class="dashboard">
    <header class="dashboard-header animate-fade-in">
      <div>
        <h1>Dashboard</h1>
        <p class="dashboard-subtitle">Vue d'ensemble de la flotte communautaire</p>
      </div>
    </header>

    <!-- Stats -->
    <div class="stats-grid stagger">
      <StatCard
        :value="store.stats.total"
        label="Total véhicules"
        :icon="icons.total"
        icon-bg="#EDF7F0"
        icon-color="#40916C"
      />
      <StatCard
        :value="store.stats.bonEtat"
        label="En bon état"
        :icon="icons.ok"
        icon-bg="#D8F3DC"
        icon-color="#2D6A4F"
      />
      <StatCard
        :value="store.stats.warning"
        label="Attention requise"
        :icon="icons.warning"
        icon-bg="#FFF3D4"
        icon-color="#E76F51"
      />
      <StatCard
        :value="store.stats.reparation"
        label="En réparation"
        :icon="icons.danger"
        icon-bg="#FDEAE5"
        icon-color="#E76F51"
      />
    </div>

    <!-- Content Grid -->
    <div class="dashboard-grid">
      <!-- Vehicle Table -->
      <section class="card table-section animate-fade-in">
        <div class="section-header">
          <h2>Véhicules</h2>
          <div class="section-actions">
            <input
              v-model="store.searchQuery"
              class="input"
              placeholder="Rechercher..."
              style="width: 200px"
            />
            <select v-model="store.filterStatus" class="input" style="width: 160px">
              <option value="all">Tous les statuts</option>
              <option value="bon_etat">Bon état</option>
              <option value="warning">Attention</option>
              <option value="reparation_obligatoire">Réparation</option>
            </select>
            <select v-model="store.filterType" class="input" style="width: 180px">
              <option value="all">Tous les types</option>
              <option value="velo_cargo">Vélo Cargo</option>
              <option value="triporteur_elec">Triporteur Élec.</option>
              <option value="camionnette_hydro">Camionnette H₂</option>
            </select>
          </div>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Véhicule</th>
                <th>Type</th>
                <th>Statut</th>
                <th>Assigné à</th>
                <th>Kilométrage</th>
                <th>Prochain entretien</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="v in store.filteredVehicles" :key="v.id">
                <td>
                  <div class="vehicle-cell">
                    <VehicleTypeIcon :type="v.type" :type-label="v.typeLabel" />
                    <span class="vehicle-cell-name">{{ v.name }}</span>
                  </div>
                </td>
                <td>{{ v.typeLabel }}</td>
                <td><StatusBadge :status="v.status" /></td>
                <td>{{ v.assignedTo }}</td>
                <td>{{ v.mileage.toLocaleString() }} km</td>
                <td>{{ formatDate(v.nextMaintenance) }}</td>
                <td>
                  <NuxtLink :to="`/dashboard/vehicles/${v.id}`" class="btn btn-ghost btn-sm">
                    Détails
                  </NuxtLink>
                </td>
              </tr>
              <tr v-if="store.filteredVehicles.length === 0">
                <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px;">
                  Aucun véhicule trouvé
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Alerts Sidebar -->
      <aside class="alerts-section animate-fade-in">
        <!-- Urgent Vehicles -->
        <div class="card alert-card" v-if="store.urgentVehicles.length > 0">
          <h3 class="alert-title">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#E76F51" stroke-width="1.5">
              <path d="M9 2L1.5 16h15L9 2z"/>
              <path d="M9 7v4M9 13v.5"/>
            </svg>
            Réparation obligatoire
          </h3>
          <div class="alert-list">
            <NuxtLink
              v-for="v in store.urgentVehicles"
              :key="v.id"
              :to="`/dashboard/vehicles/${v.id}`"
              class="alert-item"
            >
              <div class="alert-item-info">
                <span class="alert-item-name">{{ v.name }}</span>
                <span class="alert-item-detail">{{ v.typeLabel }} · {{ v.assignedTo }}</span>
              </div>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M5 3l4 4-4 4"/>
              </svg>
            </NuxtLink>
          </div>
        </div>

        <!-- Low Stock Parts -->
        <div class="card alert-card" v-if="partsStore.lowStockParts.length > 0">
          <h3 class="alert-title">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#F4A261" stroke-width="1.5">
              <rect x="2" y="5" width="14" height="11" rx="1.5"/>
              <path d="M6 5V3.5A2.5 2.5 0 0111 3.5V5"/>
              <path d="M9 9v3"/>
            </svg>
            Stock bas
          </h3>
          <div class="alert-list">
            <NuxtLink
              v-for="p in partsStore.lowStockParts"
              :key="p.id"
              to="/parts"
              class="alert-item"
            >
              <div class="alert-item-info">
                <span class="alert-item-name">{{ p.name }}</span>
                <span class="alert-item-detail">{{ p.quantity }}/{{ p.minStock }} min · {{ p.category }}</span>
              </div>
              <span class="alert-qty" :class="{ critical: p.quantity < p.minStock }">
                {{ p.quantity }}
              </span>
            </NuxtLink>
          </div>
        </div>

        <!-- Vehicle Type Distribution -->
        <div class="card distribution-card">
          <h3>Répartition par type</h3>
          <div class="distribution-bars">
            <div v-for="(count, type) in store.vehiclesByType" :key="type" class="dist-row">
              <span class="dist-label">{{ type }}</span>
              <div class="dist-bar-track">
                <div
                  class="dist-bar-fill"
                  :style="{ width: (count / store.stats.total) * 100 + '%' }"
                ></div>
              </div>
              <span class="dist-value">{{ count }}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useVehiclesStore } from '~/stores/vehicles'
import { usePartsStore } from '~/stores/parts'

definePageMeta({ layout: 'default' })

const store = useVehiclesStore()
const partsStore = usePartsStore()

const icons = {
  total: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="16" height="16" rx="3"/><path d="M8 11h6M11 8v6"/></svg>',
  ok: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="M8 11l2 2 4-4"/></svg>',
  warning: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 3L2 19h18L11 3z"/><path d="M11 9v4M11 15v.5"/></svg>',
  danger: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="M11 7v5M11 14v.5"/></svg>',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
</script>

<style scoped>
.dashboard {
  padding: var(--space-6) var(--space-8);
  max-width: 1400px;
}

.dashboard-header {
  margin-bottom: var(--space-6);
}

.dashboard-subtitle {
  color: var(--text-muted);
  font-size: 0.9rem;
  margin-top: var(--space-1);
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

/* Dashboard Grid */
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: var(--space-6);
  align-items: start;
}

/* Table Section */
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
  flex-wrap: wrap;
}

.vehicle-cell {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.vehicle-cell-name {
  font-weight: 600;
}

/* Alerts */
.alerts-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.alert-card {
  padding: var(--space-4);
}

.alert-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.9rem;
  margin-bottom: var(--space-3);
}

.alert-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.alert-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  text-decoration: none;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.alert-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.alert-item-info {
  display: flex;
  flex-direction: column;
}

.alert-item-name {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--text-primary);
}

.alert-item-detail {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.alert-qty {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--solar-400);
}

.alert-qty.critical {
  color: var(--solar-500);
}

/* Distribution */
.distribution-card {
  padding: var(--space-4);
}

.distribution-card h3 {
  font-size: 0.9rem;
  margin-bottom: var(--space-4);
}

.distribution-bars {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.dist-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.dist-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  width: 120px;
  flex-shrink: 0;
}

.dist-bar-track {
  flex: 1;
  height: 8px;
  background: var(--gray-100);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.dist-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--green-600), var(--green-400));
  border-radius: var(--radius-full);
  transition: width 0.6s ease;
}

.dist-value {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--text-primary);
  width: 24px;
  text-align: right;
}

/* Responsive */
@media (max-width: 1200px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .dashboard {
    padding: var(--space-4);
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .section-actions {
    width: 100%;
  }

  .section-actions .input {
    width: 100% !important;
  }
}
</style>
