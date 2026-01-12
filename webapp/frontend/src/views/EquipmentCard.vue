<template>
  <div class="equipment-card-page">
    <div v-if="loading" class="loading">
      <p>Загрузка...</p>
    </div>

    <div v-else-if="error" class="error">
      <h2>Ошибка</h2>
      <p>{{ error }}</p>
      <button @click="loadEquipment" class="btn-retry">Попробовать снова</button>
    </div>

    <div v-else-if="equipment" class="equipment-card">
      <div class="card-header">
        <h1>{{ equipment.name }}</h1>
        <div class="card-meta">
          <span class="badge badge-category">{{ equipment.category }}</span>
          <span v-if="equipment.subcategory" class="badge badge-subcategory">
            {{ equipment.subcategory }}
          </span>
          <span v-if="equipment.brand" class="badge badge-brand">{{ equipment.brand }}</span>
          <span v-if="equipment.region" class="badge badge-region">{{ equipment.region }}</span>
        </div>
      </div>

      <div class="card-content">
        <div class="card-section">
          <h2>Основная информация</h2>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">ID:</span>
              <span class="info-value">{{ equipment.id }}</span>
            </div>
            <div v-if="equipment.price" class="info-item">
              <span class="info-label">Цена:</span>
              <span class="info-value price">{{ formatPrice(equipment.price) }}</span>
            </div>
            <div v-else class="info-item">
              <span class="info-label">Цена:</span>
              <span class="info-value">по запросу</span>
            </div>
          </div>
        </div>

        <div v-if="equipment.description" class="card-section">
          <h2>Описание</h2>
          <p class="description">{{ equipment.description }}</p>
        </div>

        <div v-if="hasMainParameters" class="card-section">
          <h2>Основные параметры</h2>
          <div class="parameters-grid">
            <div
              v-for="[key, value] in mainParametersEntries"
              :key="key"
              class="parameter-item"
            >
              <span class="parameter-key">{{ key }}:</span>
              <span class="parameter-value">{{ value }}</span>
            </div>
          </div>
        </div>

        <div v-if="hasNormalizedParameters" class="card-section">
          <h2>Нормализованные параметры</h2>
          <div class="parameters-grid">
            <div
              v-for="[key, value] in normalizedParametersEntries"
              :key="key"
              class="parameter-item"
            >
              <span class="parameter-key">{{ key }}:</span>
              <span class="parameter-value">{{ value }}</span>
            </div>
          </div>
        </div>

        <div class="card-section">
          <h2>Метаданные</h2>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Создано:</span>
              <span class="info-value">{{ formatDate(equipment.createdAt) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Обновлено:</span>
              <span class="info-value">{{ formatDate(equipment.updatedAt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="no-equipment">
      <h2>Оборудование не найдено</h2>
      <p>Введите ID оборудования в URL, например: /equipment/123</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import axios from "axios";

interface Equipment {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  brand: string | null;
  region: string | null;
  description: string | null;
  price: number | null;
  mainParameters: Record<string, any>;
  normalizedParameters: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

const route = useRoute();
const loading = ref(false);
const error = ref<string | null>(null);
const equipment = ref<Equipment | null>(null);

const mainParametersEntries = computed(() => {
  if (!equipment.value?.mainParameters) return [];
  return Object.entries(equipment.value.mainParameters);
});

const normalizedParametersEntries = computed(() => {
  if (!equipment.value?.normalizedParameters) return [];
  return Object.entries(equipment.value.normalizedParameters);
});

const hasMainParameters = computed(() => {
  return mainParametersEntries.value.length > 0;
});

const hasNormalizedParameters = computed(() => {
  return normalizedParametersEntries.value.length > 0;
});

const loadEquipment = async () => {
  const id = route.params.id as string;
  if (!id) {
    error.value = "ID оборудования не указан";
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const response = await axios.get<Equipment>(`/speq-bot/webapp/api/equipment/${id}`);
    equipment.value = response.data;
  } catch (err: any) {
    if (err.response?.status === 404) {
      error.value = "Оборудование не найдено";
    } else {
      error.value = err.response?.data?.error || err.message || "Ошибка загрузки данных";
    }
    equipment.value = null;
  } finally {
    loading.value = false;
  }
};

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
  }).format(price);
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleString("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

onMounted(() => {
  loadEquipment();
});

watch(() => route.params.id, () => {
  loadEquipment();
});
</script>

<style scoped>
.equipment-card-page {
  max-width: 900px;
  margin: 0 auto;
}

.loading,
.error,
.no-equipment {
  text-align: center;
  padding: 3rem 1rem;
}

.error h2,
.no-equipment h2 {
  color: #e74c3c;
  margin-bottom: 1rem;
}

.btn-retry {
  margin-top: 1rem;
  padding: 0.75rem 1.5rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}

.btn-retry:hover {
  background: #5568d3;
}

.equipment-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.card-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2rem;
}

.card-header h1 {
  font-size: 2rem;
  margin-bottom: 1rem;
  font-weight: 600;
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.badge {
  display: inline-block;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
}

.badge-category {
  background: rgba(255, 255, 255, 0.3);
}

.card-content {
  padding: 2rem;
}

.card-section {
  margin-bottom: 2rem;
}

.card-section:last-child {
  margin-bottom: 0;
}

.card-section h2 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: #333;
  border-bottom: 2px solid #667eea;
  padding-bottom: 0.5rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-label {
  font-size: 0.875rem;
  color: #666;
  font-weight: 500;
}

.info-value {
  font-size: 1rem;
  color: #333;
}

.info-value.price {
  font-size: 1.25rem;
  font-weight: 600;
  color: #27ae60;
}

.description {
  line-height: 1.8;
  color: #555;
  font-size: 1.05rem;
}

.parameters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.parameter-item {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 3px solid #667eea;
}

.parameter-key {
  font-weight: 500;
  color: #555;
}

.parameter-value {
  color: #333;
  font-weight: 600;
}

@media (max-width: 768px) {
  .card-header {
    padding: 1.5rem;
  }

  .card-header h1 {
    font-size: 1.5rem;
  }

  .card-content {
    padding: 1.5rem;
  }

  .info-grid,
  .parameters-grid {
    grid-template-columns: 1fr;
  }
}
</style>
