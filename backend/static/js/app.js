class DrillingJournal {
  constructor() {
    this.dbName = 'DrillingJournal';
    this.init();
  }

  async init() {
    await this.initDB();
    this.setupEventListeners();
    this.loadWells();
    this.setupOffline();
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('wells')) {
          const store = db.createObjectStore('wells', { keyPath: 'id', autoIncrement: true });
          store.createIndex('name', 'name', { unique: true });
        }

        if (!db.objectStoreNames.contains('layers')) {
          const store = db.createObjectStore('layers', { keyPath: 'id', autoIncrement: true });
          store.createIndex('wellId', 'wellId', { unique: false });
        }
      };
    });
  }

  async saveWell(wellData) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['wells'], 'readwrite');
      const store = transaction.objectStore('wells');
      const request = store.add({
        ...wellData,
        createdAt: new Date().toISOString()
      });

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async loadWells() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['wells'], 'readonly');
      const store = transaction.objectStore('wells');
      const request = store.getAll();

      request.onsuccess = () => {
        this.renderWells(request.result);
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  renderWells(wells) {
    const container = document.getElementById('wells-list');

    if (wells.length === 0) {
      container.innerHTML = `
                <div class="empty-state">
                    <p>📝 Нет созданных скважин</p>
                    <p><small>Создайте первую скважину</small></p>
                </div>
            `;
      return;
    }

    container.innerHTML = wells.map(well => `
            <div class="well-item card">
                <h3>${well.name}</h3>
                <p>📍 ${well.area}</p>
                ${well.structure ? `<p>🏗️ ${well.structure}</p>` : ''}
                ${well.planned_depth ? `<p>📏 ${well.planned_depth} м</p>` : ''}
                <div class="well-meta">
                    <small>📅 ${new Date(well.createdAt).toLocaleDateString('ru-RU')}</small>
                </div>
                <button onclick="app.addLayer(${well.id})" class="btn btn-small">
                    ➕ Добавить слой
                </button>
            </div>
        `).join('');
  }

  async createWell(formData) {
    const wellData = {
      name: formData.get('name'),
      area: formData.get('area'),
      structure: formData.get('structure'),
      planned_depth: formData.get('planned_depth') || 0,
      latitude: formData.get('latitude') || 0,
      longitude: formData.get('longitude') || 0
    };

    await this.saveWell(wellData);
    this.showMessage('✅ Скважина сохранена!', 'success');
    showPage('home-page');
    this.loadWells();
  }

  setupEventListeners() {
    document.getElementById('new-well-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.createWell(new FormData(e.target));
    });
  }

  setupOffline() {
    // Приложение всегда в офлайн режиме
    document.getElementById('connection-status').innerHTML =
      '<span class="status-offline">💾 Локальное хранилище</span>';
  }

  showMessage(text, type = 'info') {
    alert(text); // Простой alert для демонстрации
  }

  addLayer(wellId) {
    const depthFrom = prompt('Глубина от (м):');
    const depthTo = prompt('Глубина до (м):');
    const lithology = prompt('Литология (песок/глина/торф и т.д.):');
    const description = prompt('Описание:');

    if (depthFrom && depthTo && lithology) {
      this.showMessage(`Слой ${depthFrom}-${depthTo}м добавлен!`, 'success');
    }
  }
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/static/js/sw.js');
        console.log('Service Worker зарегистрирован:', registration);

        // Проверяем обновления Service Worker
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('Новая версия Service Worker:', newWorker);
        });
      } catch (error) {
        console.log('Ошибка регистрации Service Worker:', error);
      }
    }
  }

  // Добавляем в init()
  async init() {
    await this.initDB();
    await this.registerServiceWorker();  // ← Добавляем эту строку
    this.setupEventListeners();
    this.loadWells();
    this.checkConnection();
  }

  // Показываем офлайн данные
  async showOfflineData() {
    const offlineWells = await this.loadFromLocalDB('wells');
    const offlineElement = document.getElementById('offline-data');
    const offlineList = document.getElementById('offline-wells-list');

    if (offlineWells.length > 0) {
      offlineElement.style.display = 'block';
      offlineList.innerHTML = offlineWells.map(well => `
            <div class="well-item">
                <strong>${well.name}</strong> - ${well.area}
                ${!well.synced ? ' (не синхронизировано)' : ''}
            </div>
        `).join('');
    }
  }
}

// Глобальные функции
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
}

let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new DrillingJournal();
});