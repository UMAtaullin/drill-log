class DrillingJournal {
  constructor() {
    this.dbName = 'DrillingJournal';
    this.dbVersion = 4;  // Увеличиваем версию
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
        console.log('БД инициализирована, хранилища:', Array.from(this.db.objectStoreNames));
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('Обновление БД до версии:', event.newVersion);

        // Создаем хранилища если их нет
        if (!db.objectStoreNames.contains('wells')) {
          const wellStore = db.createObjectStore('wells', { keyPath: 'id' });
          wellStore.createIndex('name', 'name', { unique: false }); // Без уникальности
        }

        if (!db.objectStoreNames.contains('layers')) {
          const layerStore = db.createObjectStore('layers', { keyPath: 'id' });
          layerStore.createIndex('wellId', 'wellId', { unique: false });
        }
      };
    });
  }

  async saveToLocalDB(storeName, data) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      // Создаем объект с гарантированным ID
      const itemWithId = {
        ...data,
        id: data.id || `local_${Date.now()}`,
        synced: false,
        localSaveTime: new Date().toISOString()
      };

      console.log(`Сохранение в ${storeName}:`, itemWithId);
      const request = store.put(itemWithId);

      request.onsuccess = () => resolve(itemWithId);
      request.onerror = (e) => {
        console.error(`Ошибка сохранения в ${storeName}:`, e);
        reject(e);
      };
    });
  }

  async loadFromLocalDB(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => {
        console.error(`Ошибка загрузки из ${storeName}:`, e);
        reject(e);
      };
    });
  }

  async loadWells() {
    try {
      const response = await fetch(`${this.apiBase}/wells/`);
      if (!response.ok) throw new Error('HTTP error');

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
      console.log('Найдено локальных скважин:', localWells.length);
      this.renderWells(localWells);
    }
  }

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
        await this.saveToLocalDB('wells', savedWell);
        this.showMessage('✅ Скважина создана!', 'success');
        showPage('home-page');
        this.loadWells();
      }
    } catch (error) {
      console.log('Офлайн режим, сохраняем локально');
      const localWell = await this.saveToLocalDB('wells', {
        ...wellData,
        created_at: new Date().toISOString(),
        created_by: { username: 'local_user' }
      });

      this.showMessage('💾 Скважина сохранена локально', 'info');
      showPage('home-page');
      this.loadWells();
    }
  }

  async createLayer(formData) {
    const wellId = parseInt(formData.get('well_id'));
    const layerData = {
      well: wellId,
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
        const savedLayer = await response.json();
        await this.saveToLocalDB('layers', savedLayer);
        this.showMessage('✅ Слой добавлен!', 'success');
        document.getElementById('new-layer-form').reset();
        await this.loadWellLayers(wellId); // Ждем загрузки
      }
    } catch (error) {
      console.log('Офлайн режим, сохраняем слой локально');
      const localLayer = await this.saveToLocalDB('layers', {
        ...layerData,
        wellId: wellId,
        created_at: new Date().toISOString(),
        thickness: (layerData.depth_to - layerData.depth_from).toFixed(2)
      });

      this.showMessage('💾 Слой сохранен локально', 'info');
      document.getElementById('new-layer-form').reset();
      await this.loadWellLayers(wellId); // Ждем загрузки
    }
  }

  async loadWellLayers(wellId) {
    console.log('Загрузка слоев для скважины:', wellId);

    try {
      const response = await fetch(`${this.apiBase}/layers/?well_id=${wellId}`);
      if (!response.ok) throw new Error('HTTP error');

      const layers = await response.json();
      console.log('Загружено слоев с сервера:', layers.length);

      for (const layer of layers) {
        await this.saveToLocalDB('layers', layer);
      }

      this.renderLayers(layers);
    } catch (error) {
      console.log('Офлайн режим, загружаем слои из локальной БД');
      const allLayers = await this.loadFromLocalDB('layers');
      console.log('Все локальные слои:', allLayers);

      const wellLayers = allLayers.filter(layer => {
        const layerWellId = layer.well || layer.wellId || (layer.well && layer.well.id);
        return layerWellId == wellId;
      });

      console.log('Найдено локальных слоев для скважины', wellId, ':', wellLayers.length);
      this.renderLayers(wellLayers);
    }
  }

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

    // Сортируем по глубине
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
  }

  async exportData() {
    this.showMessage('Экспорт данных...', 'info');
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