// Основной класс приложения
class DrillingJournal {
  constructor() {
    this.dbName = 'DrillingJournal';
    this.dbVersion = 1;
    this.apiBase = '/api';  // Относительный путь
    this.currentWell = null;
    this.init();
  }

  async init() {
    await this.initDB();
    this.setupEventListeners();
    this.loadWells();
    this.checkConnection();
  }

  // Инициализация IndexedDB для офлайн работы
  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Хранилище для скважин
        if (!db.objectStoreNames.contains('wells')) {
          const store = db.createObjectStore('wells', { keyPath: 'id', autoIncrement: true });
          store.createIndex('name', 'name', { unique: true });
        }

        // Хранилище для слоев
        if (!db.objectStoreNames.contains('layers')) {
          const store = db.createObjectStore('layers', { keyPath: 'id', autoIncrement: true });
          store.createIndex('wellId', 'wellId', { unique: false });
        }

        // Очередь синхронизации
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  // Настройка обработчиков событий
  setupEventListeners() {
    // Форма создания скважины
    document.getElementById('new-well-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.createWell(new FormData(e.target));
    });

    // Форма добавления слоя
    document.getElementById('new-layer-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.createLayer(new FormData(e.target));
    });
  }

  // Загрузка списка скважин
  async loadWells() {
    try {
      const response = await fetch(`${this.apiBase}/wells/`);
      const wells = await response.json();
      this.renderWells(wells);
    } catch (error) {
      console.log('Офлайн режим, загружаем из локальной БД');
      const localWells = await this.loadFromLocalDB('wells');
      this.renderWells(localWells);
    }
  }

  // Отображение списка скважин
  renderWells(wells) {
    const container = document.getElementById('wells-list');

    if (!wells || wells.length === 0) {
      container.innerHTML = `
                <div class="empty-state">
                    <p>📝 Нет созданных скважин</p>
                    <p><small>Создайте первую скважину</small></p>
                </div>
            `;
      return;
    }

    container.innerHTML = wells.map(well => `
            <div class="well-card" onclick="app.showWorkPage(${well.id})">
                <h3>${well.name}</h3>
                <div class="well-meta">
                    <p>📍 ${well.area}</p>
                    ${well.structure ? `<p>🏗️ ${well.structure}</p>` : ''}
                    ${well.planned_depth ? `<p>📏 ${well.planned_depth} м</p>` : ''}
                </div>
                <small>📅 ${new Date(well.created_at || well.createdAt).toLocaleDateString('ru-RU')}</small>
            </div>
        `).join('');
  }

  // Создание новой скважины
  async createWell(formData) {
    const wellData = {
      name: formData.get('name'),
      area: formData.get('area'),
      structure: formData.get('structure'),
      planned_depth: formData.get('planned_depth') || 0
    };

    console.log('Отправляемые данные:', wellData);

    try {
      const response = await fetch(`${this.apiBase}/wells/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(wellData)
      });

      if (response.ok) {
        this.showMessage('✅ Скважина создана!', 'success');
        showPage('home-page');
        this.loadWells();
      }
    } catch (error) {
      // Офлайн режим - сохраняем локально
      await this.saveToLocalDB('wells', wellData);
      this.showMessage('💾 Скважина сохранена локально', 'info');
      showPage('home-page');
      this.loadWells();
    }
  }

  // Создание нового слоя
  async createLayer(formData) {
    const layerData = {
      well: parseInt(formData.get('well_id')),
      depth_from: parseFloat(formData.get('depth_from')),
      depth_to: parseFloat(formData.get('depth_to')),
      lithology: formData.get('lithology'),
      description: formData.get('description'),
      layer_number: 1
    };

    try {
      const response = await fetch(`${this.apiBase}/layers/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(layerData)
      });

      if (response.ok) {
        this.showMessage('✅ Слой добавлен!', 'success');
        // Очищаем форму
        document.getElementById('new-layer-form').reset();
        // Обновляем список слоев
        this.loadWellLayers(layerData.well);
      }
    } catch (error) {
      // Офлайн режим
      await this.saveToLocalDB('layers', layerData);
      this.showMessage('💾 Слой сохранен локально', 'info');
      document.getElementById('new-layer-form').reset();
      this.loadWellLayers(layerData.well);
    }
  }

  // Показать рабочую страницу скважины
  async showWorkPage(wellId) {
    this.currentWell = wellId;
    document.getElementById('current-well-id').value = wellId;

    // Загружаем данные скважины
    await this.loadWellDetails(wellId);
    // Загружаем слои
    await this.loadWellLayers(wellId);

    showPage('work-page');
  }

  // Загрузка деталей скважины
  async loadWellDetails(wellId) {
    try {
      const response = await fetch(`${this.apiBase}/wells/${wellId}/`);
      const well = await response.json();

      document.getElementById('working-well-name').textContent = well.name;
      document.getElementById('working-well-info').textContent = `${well.area} • ${well.structure || ''}`;
      document.getElementById('current-well-name').textContent = well.name;

    } catch (error) {
      console.log('Ошибка загрузки деталей скважины:', error);
    }
  }

  // Загрузка слоев скважины
  async loadWellLayers(wellId) {
    try {
      const response = await fetch(`${this.apiBase}/layers/?well_id=${wellId}`);
      const layers = await response.json();
      this.renderLayers(layers);
    } catch (error) {
      console.log('Офлайн режим, загружаем слои из локальной БД');
      const localLayers = await this.loadFromLocalDB('layers');
      const wellLayers = localLayers.filter(layer => layer.wellId == wellId);
      this.renderLayers(wellLayers);
    }
  }

  // Отображение списка слоев
  renderLayers(layers) {
    const container = document.getElementById('layers-list');

    if (!layers || layers.length === 0) {
      container.innerHTML = `
                <div class="empty-state">
                    <p>📝 Нет добавленных слоев</p>
                    <p><small>Добавьте первый слой</small></p>
                </div>
            `;
      return;
    }

    // Сортируем слои по глубине
    layers.sort((a, b) => parseFloat(a.depth_from) - parseFloat(b.depth_from));

    container.innerHTML = layers.map(layer => `
            <div class="layer-item">
                <div class="layer-info">
                    <div class="layer-depth">
                        ${layer.depth_from} - ${layer.depth_to} м
                    </div>
                    <div class="layer-lithology">
                        <span class="lithology-badge ${layer.lithology}">
                            ${this.getLithologyDisplay(layer.lithology)}
                        </span>
                        ${layer.description || ''}
                    </div>
                </div>
                <div class="layer-thickness">
                    ${this.calculateThickness(layer.depth_from, layer.depth_to)} м
                </div>
            </div>
        `).join('');
  }

  // Расчет мощности слоя
  calculateThickness(depthFrom, depthTo) {
    if (depthFrom && depthTo) {
      return (parseFloat(depthTo) - parseFloat(depthFrom)).toFixed(2);
    }
    return '0.00';
  }

  // Получение отображаемого названия литологии
  getLithologyDisplay(lithology) {
    const lithologyMap = {
      'prs': '🟫 ПРС',
      'peat': '🟤 Торф',
      'sand': '🟡 Песок',
      'loam': '🔵 Суглинок',
      'sandy_loam': '🟠 Супесь'
    };
    return lithologyMap[lithology] || lithology;
  }

  // Работа с локальной БД
  async saveToLocalDB(storeName, data) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add({
        ...data,
        localId: Date.now(),
        synced: false,
        createdAt: new Date().toISOString()
      });

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async loadFromLocalDB(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Проверка соединения
  checkConnection() {
    const statusElement = document.getElementById('connection-status');

    const updateStatus = () => {
      if (navigator.onLine) {
        statusElement.textContent = '🟢 Онлайн';
        statusElement.className = 'connection-status online';
      } else {
        statusElement.textContent = '🔴 Офлайн';
        statusElement.className = 'connection-status offline';
      }
    };

    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
  }

  // Показать сообщение
  showMessage(text, type = 'info') {
    // Простой alert для начала
    alert(text);
  }

  // Синхронизация данных
  async syncData() {
    this.showMessage('Синхронизация...', 'info');
    // Здесь будет логика синхронизации
  }

  // Экспорт данных
  async exportData() {
    this.showMessage('Экспорт данных...', 'info');
    // Здесь будет логика экспорта
  }
}

// Глобальные функции
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  document.getElementById(pageId).classList.add('active');
}

// Инициализация приложения
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new DrillingJournal();
});