<template>
  <div class="vehicle-detail" v-if="vehicle">
    <header class="detail-header animate-fade-in">
      <div class="detail-back">
        <NuxtLink to="/dashboard" class="btn btn-ghost btn-sm">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M10 4L6 8l4 4"/>
          </svg>
          Retour
        </NuxtLink>
      </div>
      <div class="detail-title-row">
        <div class="detail-title">
          <VehicleTypeIcon :type="vehicle.type" :type-label="vehicle.typeLabel" />
          <div>
            <h1>{{ vehicle.name }}</h1>
            <span class="detail-type">{{ vehicle.typeLabel }}</span>
          </div>
        </div>
        <StatusBadge :status="vehicle.status" />
      </div>
    </header>

    <div class="detail-grid animate-fade-in">
      <!-- Info Card -->
      <div class="card detail-card">
        <h3>Informations</h3>
        <div class="detail-rows">
          <div class="detail-row">
            <span class="detail-label">Assigné à</span>
            <span class="detail-value">{{ vehicle.assignedTo }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Kilométrage</span>
            <span class="detail-value">{{ vehicle.mileage.toLocaleString() }} km</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Dernier entretien</span>
            <span class="detail-value">{{ formatDate(vehicle.lastMaintenance) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Prochain entretien</span>
            <span class="detail-value" :class="{ overdue: isOverdue }">
              {{ formatDate(vehicle.nextMaintenance) }}
              <span v-if="isOverdue" class="overdue-tag">En retard</span>
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Position actuelle</span>
            <span class="detail-value">X: {{ vehicle.position.x }}, Z: {{ vehicle.position.z }}</span>
          </div>
        </div>
      </div>

      <!-- Status Management Card -->
      <div class="card detail-card">
        <h3>Gestion du statut</h3>
        <p class="status-desc">Modifier le statut de maintenance de ce véhicule :</p>
        <div class="status-options">
          <button
            v-for="opt in statusOptions"
            :key="opt.value"
            class="status-option"
            :class="{ active: vehicle.status === opt.value, [opt.class]: true }"
            @click="store.updateVehicleStatus(vehicle.id, opt.value)"
          >
            <span class="status-option-dot"></span>
            {{ opt.label }}
          </button>
        </div>
      </div>

      <!-- Parts Card -->
      <div class="card detail-card">
        <h3>Pièces associées</h3>
        <div class="parts-list" v-if="associatedParts.length > 0">
          <div v-for="part in associatedParts" :key="part.id" class="part-item">
            <div class="part-info">
              <span class="part-name">{{ part.name }}</span>
              <span class="part-category">{{ part.category }}</span>
            </div>
            <div class="part-stock">
              <span class="part-qty" :class="{ low: part.quantity <= part.minStock }">
                {{ part.quantity }}
              </span>
              <span class="part-unit">en stock</span>
            </div>
          </div>
        </div>
        <p v-else class="no-parts">Aucune pièce associée</p>
      </div>

      <!-- Map Link Card -->
      <div class="card detail-card map-link-card">
        <h3>Localisation</h3>
        <p>Voir ce véhicule sur la carte 3D interactive.</p>
        <NuxtLink to="/" class="btn btn-primary" @click="store.selectVehicle(vehicle.id)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M2 6l6-4 6 4v5l-6 4-6-4V6z"/>
            <path d="M2 6l6 4m0 0l6-4m-6 4v6"/>
          </svg>
          Voir sur la carte
        </NuxtLink>
      </div>
    </div>
  </div>

  <div v-else class="not-found animate-fade-in">
    <h2>Véhicule non trouvé</h2>
    <NuxtLink to="/dashboard" class="btn btn-primary">Retour au dashboard</NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { useVehiclesStore } from '~/stores/vehicles'
import { usePartsStore } from '~/stores/parts'
import type { Vehicle } from '~/stores/vehicles'

definePageMeta({ layout: 'default' })

const route = useRoute()
const store = useVehiclesStore()
const partsStore = usePartsStore()

const vehicle = computed(() => store.getVehicleById(route.params.id as string))

const isOverdue = computed(() => {
  if (!vehicle.value) return false
  return new Date(vehicle.value.nextMaintenance) < new Date()
})

const associatedParts = computed(() => {
  if (!vehicle.value) return []
  return vehicle.value.parts
    .map((pid) => partsStore.getPartById(pid))
    .filter(Boolean)
})

const statusOptions: { value: Vehicle['status']; label: string; class: string }[] = [
  { value: 'bon_etat', label: 'Bon état', class: 'opt-ok' },
  { value: 'warning', label: 'Attention', class: 'opt-warning' },
  { value: 'reparation_obligatoire', label: 'Réparation obligatoire', class: 'opt-danger' },
]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}
</script>

<style scoped>
.vehicle-detail {
  padding: var(--space-6) var(--space-8);
  max-width: 1200px;
}

.detail-header {
  margin-bottom: var(--space-6);
}

.detail-back {
  margin-bottom: var(--space-4);
}

.detail-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.detail-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.detail-title h1 {
  font-size: 1.5rem;
  margin: 0;
}

.detail-type {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

.detail-card {
  padding: var(--space-5);
}

.detail-card h3 {
  font-size: 1rem;
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border-light);
}

.detail-rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.detail-value {
  font-weight: 500;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.detail-value.overdue {
  color: var(--solar-500);
}

.overdue-tag {
  font-size: 0.7rem;
  background: var(--status-danger-bg);
  color: var(--status-danger-text);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-weight: 600;
}

/* Status options */
.status-desc {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: var(--space-3);
}

.status-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.status-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-light);
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.status-option:hover {
  border-color: var(--green-400);
}

.status-option.active {
  border-color: currentColor;
  font-weight: 600;
}

.status-option-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.opt-ok .status-option-dot { background: var(--status-ok); }
.opt-warning .status-option-dot { background: var(--status-warning); }
.opt-danger .status-option-dot { background: var(--status-danger); }

.opt-ok.active { color: var(--status-ok-text); background: var(--status-ok-bg); border-color: var(--status-ok); }
.opt-warning.active { color: var(--status-warning-text); background: var(--status-warning-bg); border-color: var(--status-warning); }
.opt-danger.active { color: var(--status-danger-text); background: var(--status-danger-bg); border-color: var(--status-danger); }

/* Parts */
.parts-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.part-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--border-light);
}

.part-item:last-child {
  border-bottom: none;
}

.part-name {
  font-weight: 500;
  font-size: 0.85rem;
}

.part-category {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.part-stock {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.part-qty {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--green-700);
}

.part-qty.low {
  color: var(--solar-500);
}

.part-unit {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.no-parts {
  color: var(--text-muted);
  font-size: 0.85rem;
}

/* Map link */
.map-link-card p {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: var(--space-3);
}

/* Not found */
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: var(--space-4);
}

@media (max-width: 768px) {
  .vehicle-detail {
    padding: var(--space-4);
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
