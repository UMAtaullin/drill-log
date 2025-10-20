class DrillingJournal {
  constructor() {
    this.dbName = 'DrillingJournal';
    this.dbVersion = 2;  // Увеличиваем версию для обновления структуры
    this.apiBase = '/api';
    this.currentWell = null;
    this.init();
  }

  async init() {
    await this.initDB();
    this.setupEventListeners();
    this.loadWells();
    this.checkConnection();
  }

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
        console.log('Обновление БД до версии:', event.newVersion);

        // Удаляем старые хранилища если есть
        if (db.objectStoreNames.contains('wells')) {
          db.deleteObjectStore('wells');
        }
        if (db.objectStoreNames.contains('layers')) {
          db.deleteObjectStore('layers');
        }

        // Создаем новые хранилища
        const wellStore = db.createObjectStore('wells', { keyPath: 'id' });
        wellStore.createIndex('name', 'name', { unique: false });

        const layerStore = db.createObjectStore('layers', { keyPath: 'id' });
        layerStore.createIndex('wellId', 'wellId', { unique: false });

        console.log('Созданы хранилища:', Array.from(db.objectStoreNames));
      };
    });
  }

  // СОХРАНЕНИЕ В ЛОКАЛЬНУЮ БД
  async saveToLocalDB(storeName, data) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      // Генерируем ID если его нет
      const itemWithId = {
        ...data,
        id: data.id || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        synced: false,
        localSaveTime: new Date().toISOString()
      };

      const request = store.put(itemWithId);

      request.onsuccess = () => {
        console.log(`Сохранено в ${storeName}:`, itemWithId);
        resolve(itemWithId);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ЗАГРУЗКА ИЗ ЛОКАЛЬНОЙ БД
  async loadFromLocalDB(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        console.log(`Загружено из ${storeName}:`, request.result.length, 'записей');
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ЗАГРУЗКА СКВАЖИН (ОНЛАЙН + ОФФЛАЙН)
  async loadWells() {
    try {
      const response = await fetch(`${this.apiBase}/wells/`);
      const wells = await response.json();
      console.log('Загружено с сервера:', wells.length, 'скважин');

      // Сохраняем в локальную БД
      for (const well of wells) {
        await this.saveToLocalDB('wells', well);
      }

      this.renderWells(wells);
    } catch (error) {
      console.log('Офлайн режим, загружаем из локальной БД');
      const localWells = await this.loadFromLocalDB('wells');
      this.renderWells(localWells);
    }
  }

  // СОЗДАНИЕ СКВАЖИНЫ (ОНЛАЙН + ОФФЛАЙН)
  async createWell(formData) {
    const wellData = {
      name: formData.get('name'),
      area: formData.get('area'),
      structure: formData.get('structure'),
      planned_depth: parseFloat(formData.get('planned_depth')) || 0
    };

    try {
      const response = await fetch(`${this.apiBase}/wells/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(wellData)
      });

      if (response.ok) {
        const savedWell = await response.json();
        // Сохраняем в локальную БД
        await this.saveToLocalDB('wells', savedWell);
        this.showMessage('✅ Скважина создана!', 'success');
        showPage('home-page');
        this.loadWells();
      }
    } catch (error) {
      // ОФФЛАЙН РЕЖИМ - сохраняем только локально
      console.log('Офлайн режим, сохраняем локально');
      const localWell = await this.saveToLocalDB('wells', {
        ...wellData,
        created_at: new Date().toISOString(),
        created_by: { username: 'local_user' }
      });

      this.showMessage('💾 Скважина сохранена локально', 'info');
      showPage('home-page');
      this.loadWells(); // Перезагружаем список
    }
  }

  // СОЗДАНИЕ СЛОЯ (ОНЛАЙН + ОФФЛАЙН)
  async createLayer(formData) {
    const wellId = parseInt(formData.get('well_id'));
    const layerData = {
      well: wellId,
      depth_from: parseFloat(formData.get('depth_from')),
      depth_to: parseFloat(formData.get('depth_to')),
      lithology: formData.get('lithology'),
      description: formData.get('description'),
      layer_number: 1 // Временно
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
        const savedLayer = await response.json();
        // Сохраняем в локальную БД
        await this.saveToLocalDB('layers', savedLayer);
        this.showMessage('✅ Слой добавлен!', 'success');
        document.getElementById('new-layer-form').reset();
        this.loadWellLayers(wellId);
      }
    } catch (error) {
      // ОФФЛАЙН РЕЖИМ
      console.log('Офлайн режим, сохраняем слой локально');
      const localLayer = await this.saveToLocalDB('layers', {
        ...layerData,
        wellId: wellId, // Дублируем для локального поиска
        created_at: new Date().toISOString(),
        thickness: layerData.depth_to - layerData.depth_from
      });

      this.showMessage('💾 Слой сохранен локально', 'info');
      document.getElementById('new-layer-form').reset();
      this.loadWellLayers(wellId);
    }
  }

  // ЗАГРУЗКА СЛОЕВ СКВАЖИНЫ (ОНЛАЙН + ОФФЛАЙН)
  async loadWellLayers(wellId) {
    try {
      const response = await fetch(`${this.apiBase}/layers/?well_id=${wellId}`);
      const layers = await response.json();
      console.log('Загружено слоев с сервера:', layers.length);

      // Сохраняем в локальную БД
      for (const layer of layers) {
        await this.saveToLocalDB('layers', layer);
      }

      this.renderLayers(layers);
    } catch (error) {
      console.log('Офлайн режим, загружаем слои из локальной БД');
      const allLayers = await this.loadFromLocalDB('layers');
      const wellLayers = allLayers.filter(layer =>
        layer.well === wellId || layer.wellId === wellId
      );
      console.log('Найдено локальных слоев:', wellLayers.length);
      this.renderLayers(wellLayers);
    }
  }

  // ОТОБРАЖЕНИЕ СКВАЖИН (универсальное)
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
            <div class="well-card" onclick="app.showWorkPage(${well.id || well.localId})">
                <h3>${well.name}</h3>
                <div class="well-meta">
                    <p>📍 ${well.area}</p>
                    ${well.structure ? `<p>🏗️ ${well.structure}</p>` : ''}
                    ${well.planned_depth ? `<p>📏 ${well.planned_depth} м</p>` : ''}
                    ${!well.synced ? '<p><small>💾 Локальная версия</small></p>' : ''}
                </div>
                <small>📅 ${new Date(well.created_at || well.localSaveTime).toLocaleDateString('ru-RU')}</small>
            </div>
        `).join('');
  }

  // ОТОБРАЖЕНИЕ СЛОЕВ (универсальное)  
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
                        ${!layer.synced ? ' <small>💾</small>' : ''}
                    </div>
                </div>
                <div class="layer-thickness">
                    ${this.calculateThickness(layer.depth_from, layer.depth_to)} м
                </div>
            </div>
        `).join('');
  }

  // ОСТАЛЬНЫЕ МЕТОДЫ остаются без изменений
  calculateThickness(depthFrom, depthTo) {
    if (depthFrom && depthTo) {
      return (parseFloat(depthTo) - parseFloat(depthFrom)).toFixed(2);
    }
    return '0.00';
  }

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

  showMessage(text, type = 'info') {
    alert(text);
  }

  async syncData() {
    this.showMessage('Синхронизация...', 'info');
    // Здесь будет логика синхронизации
  }

  async exportData() {
    this.showMessage('Экспорт данных...', 'info');
    // Здесь будет логика экспорта
  }

  async showWorkPage(wellId) {
    this.currentWell = wellId;
    document.getElementById('current-well-id').value = wellId;
    await this.loadWellDetails(wellId);
    await this.loadWellLayers(wellId);
    showPage('work-page');
  }

  async loadWellDetails(wellId) {
    try {
      const response = await fetch(`${this.apiBase}/wells/${wellId}/`);
      const well = await response.json();

      document.getElementById('working-well-name').textContent = well.name;
      document.getElementById('working-well-info').textContent = `${well.area} • ${well.structure || ''}`;
      document.getElementById('current-well-name').textContent = well.name;

    } catch (error) {
      console.log('Ошибка загрузки деталей скважины, пробуем локально');
      const localWells = await this.loadFromLocalDB('wells');
      const well = localWells.find(w => w.id == wellId);
      if (well) {
        document.getElementById('working-well-name').textContent = well.name;
        document.getElementById('working-well-info').textContent = `${well.area} • ${well.structure || ''}`;
        document.getElementById('current-well-name').textContent = well.name;
      }
    }
  }
}

// Глобальные функции
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  document.getElementById(pageId).classList.add('active');
}

let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new DrillingJournal();
});