class DrillingJournal {
  constructor() {
    this.dbName = 'DrillingJournal';
    this.dbVersion = 8;
    this.apiBase = '/api';
    this.currentWell = null;
    this.syncInProgress = false;
    this.init();
  }

  async init() {
    await this.initDB();
    this.setupEventListeners();
    this.loadWells();
    this.checkConnection();
    this.setupAutoSync();
  }

  // МЕТОД ИНИЦИАЛИЗАЦИИ БАЗЫ ДАННЫХ
  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ БД инициализирована');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('🔄 Обновление БД до версии:', event.newVersion);

        if (!db.objectStoreNames.contains('wells')) {
          const wellStore = db.createObjectStore('wells', { keyPath: 'id' });
          wellStore.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains('layers')) {
          const layerStore = db.createObjectStore('layers', { keyPath: 'id' });
          layerStore.createIndex('wellId', 'wellId', { unique: false });
        }
      };
    });
  }

  // МЕТОД НАСТРОЙКИ ОБРАБОТЧИКОВ СОБЫТИЙ
  setupEventListeners() {
    console.log('🔄 Настройка обработчиков событий');

    // Форма создания скважины
    const wellForm = document.getElementById('new-well-form');
    if (wellForm) {
      wellForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.createWell(new FormData(e.target));
      });
    }

    // Форма добавления слоя
    const layerForm = document.getElementById('new-layer-form');
    if (layerForm) {
      layerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.createLayer(new FormData(e.target));
      });
    }

    console.log('✅ Обработчики событий настроены');
  }

  // МЕТОД АВТОМАТИЧЕСКОЙ СИНХРОНИЗАЦИИ
  setupAutoSync() {
    window.addEventListener('online', async () => {
      console.log('🌐 Интернет появился, запускаем синхронизацию...');
      await this.syncData();
    });
  }

  // МЕТОД СОХРАНЕНИЯ В ЛОКАЛЬНУЮ БД
  async saveToLocalDB(storeName, data) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      const itemWithId = {
        ...data,
        id: data.id || `local_${Date.now()}`,
        synced: data.synced || false,
        localSaveTime: new Date().toISOString()
      };

      console.log(`💾 Сохранение в ${storeName}:`, itemWithId.name || itemWithId.id);
      const request = store.put(itemWithId);

      request.onsuccess = () => resolve(itemWithId);
      request.onerror = (e) => {
        console.error(`❌ Ошибка сохранения в ${storeName}:`, e);
        reject(e);
      };
    });
  }

  // МЕТОД ЗАГРУЗКИ ИЗ ЛОКАЛЬНОЙ БД
  async loadFromLocalDB(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => {
        console.error(`❌ Ошибка загрузки из ${storeName}:`, e);
        reject(e);
      };
    });
  }

  // МЕТОД ЗАГРУЗКИ СКВАЖИН
  async loadWells() {
    // ЕСЛИ ОФЛАЙН - СРАЗУ ГРУЗИМ ИЗ ЛОКАЛЬНОЙ БД
    if (!navigator.onLine) {
      console.log('📴 Офлайн режим - загружаем скважины из локальной БД');
      const localWells = await this.loadFromLocalDB('wells');
      console.log('📂 Найдено локальных скважин:', localWells.length);
      this.renderWells(localWells);
      return;
    }

    // ЕСЛИ ОНЛАЙН - пробуем загрузить с сервера
    try {
      const response = await fetch(`${this.apiBase}/wells/`);
      if (!response.ok) throw new Error('HTTP error');

      const wells = await response.json();
      console.log('✅ Загружено с сервера:', wells.length, 'скважин');

      for (const well of wells) {
        await this.saveToLocalDB('wells', {
          ...well,
          synced: true
        });
      }

      this.renderWells(wells);
    } catch (error) {
      console.log('❌ Ошибка загрузки скважин, используем локальные данные');
      const localWells = await this.loadFromLocalDB('wells');
      this.renderWells(localWells);
    }
  }

  // МЕТОД СОЗДАНИЯ СКВАЖИНЫ
  async createWell(formData) {
    const wellData = {
      name: formData.get('name'),
      area: formData.get('area'),
      structure: formData.get('structure'),
      planned_depth: parseFloat(formData.get('planned_depth')) || 0
    };

    // ПРОВЕРЯЕМ ОНЛАЙН СТАТУС
    if (navigator.onLine) {
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
          await this.saveToLocalDB('wells', {
            ...savedWell,
            synced: true
          });
          this.showMessage('✅ Скважина создана!', 'success');
          showPage('home-page');
          this.loadWells();
          return;
        }
      } catch (error) {
        console.log('❌ Ошибка при онлайн создании, сохраняем локально');
      }
    }

    // ОФЛАЙН РЕЖИМ ИЛИ ОШИБКА ОНЛАЙН
    console.log('📴 Сохраняем скважину локально');
    const localWell = await this.saveToLocalDB('wells', {
      ...wellData,
      id: `local_well_${Date.now()}`,
      created_at: new Date().toISOString(),
      created_by: { username: 'local_user' },
      synced: false
    });

    this.showMessage('💾 Скважина сохранена локально', 'info');
    showPage('home-page');
    this.loadWells();
  }

  // МЕТОД СОЗДАНИЯ СЛОЯ
  async createLayer(formData) {
    const wellId = parseInt(formData.get('well_id'));
    const depthFrom = parseFloat(formData.get('depth_from'));
    const depthTo = parseFloat(formData.get('depth_to'));

    const layerData = {
      well: wellId,
      wellId: wellId,
      depth_from: depthFrom,
      depth_to: depthTo,
      lithology: formData.get('lithology'),
      description: formData.get('description'),
      layer_number: 1,
      thickness: (depthTo - depthFrom).toFixed(2)
    };

    // ПРОВЕРЯЕМ ОНЛАЙН СТАТУС
    if (navigator.onLine) {
      console.log('🌐 Онлайн режим - отправляем на сервер');
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
          await this.saveToLocalDB('layers', {
            ...savedLayer,
            wellId: savedLayer.well,
            synced: true
          });
          this.showMessage('✅ Слой добавлен!', 'success');
          document.getElementById('new-layer-form').reset();
          await this.loadWellLayers(wellId);
          return;
        }
      } catch (error) {
        console.log('❌ Ошибка при онлайн отправке, сохраняем локально');
      }
    }

    // ОФЛАЙН РЕЖИМ ИЛИ ОШИБКА ОНЛАЙН
    console.log('📴 Сохраняем слой локально');
    await this.saveLayerOffline(layerData, wellId);
  }

  // МЕТОД СОХРАНЕНИЯ СЛОЯ ОФФЛАЙН
  async saveLayerOffline(layerData, wellId) {
    const localLayer = await this.saveToLocalDB('layers', {
      ...layerData,
      id: `local_layer_${Date.now()}`,
      created_at: new Date().toISOString(),
      synced: false
    });

    console.log('💾 Локальный слой сохранен:', localLayer);
    this.showMessage('💾 Слой сохранен локально', 'info');
    document.getElementById('new-layer-form').reset();

    // ОБНОВЛЯЕМ ИНТЕРФЕЙС БЕЗ ЗАПРОСА К СЕРВЕРУ
    await this.updateLayersUI(wellId);
  }

  // МЕТОД ОБНОВЛЕНИЯ ИНТЕРФЕЙСА СЛОЕВ
  async updateLayersUI(wellId) {
    console.log('🔄 Обновление интерфейса для скважины:', wellId);

    const allLayers = await this.loadFromLocalDB('layers');
    const wellLayers = allLayers.filter(layer => {
      return layer.well === wellId || layer.wellId === wellId;
    });

    console.log(`🎯 Отображаем ${wellLayers.length} слоев`);
    this.renderLayers(wellLayers);
  }

  // МЕТОД ЗАГРУЗКИ СЛОЕВ СКВАЖИНЫ
  async loadWellLayers(wellId) {
    console.log('🔄 Загрузка слоев для скважины:', wellId);

    // ЕСЛИ ОФЛАЙН - СРАЗУ ГРУЗИМ ИЗ ЛОКАЛЬНОЙ БД
    if (!navigator.onLine) {
      console.log('📴 Офлайн режим - загружаем только из локальной БД');
      await this.updateLayersUI(wellId);
      return;
    }

    // ЕСЛИ ОНЛАЙН - пробуем загрузить с сервера
    try {
      const response = await fetch(`${this.apiBase}/layers/?well_id=${wellId}`);
      if (!response.ok) throw new Error('HTTP error');

      const serverLayers = await response.json();
      console.log('✅ Загружено слоев с сервера:', serverLayers.length);

      // Сохраняем серверные слои
      for (const layer of serverLayers) {
        await this.saveToLocalDB('layers', {
          ...layer,
          wellId: layer.well,
          synced: true
        });
      }

      // ДОБАВЛЯЕМ ЛОКАЛЬНЫЕ НЕСИНХРОНИЗИРОВАННЫЕ СЛОИ
      const allLocalLayers = await this.loadFromLocalDB('layers');
      const localUnsyncedLayers = allLocalLayers.filter(layer =>
        (layer.well === wellId || layer.wellId === wellId) && !layer.synced
      );

      const allLayers = [...serverLayers, ...localUnsyncedLayers];
      console.log(`🎯 Всего слоев: ${allLayers.length} (${serverLayers.length} с сервера + ${localUnsyncedLayers.length} локальных)`);

      this.renderLayers(allLayers);

    } catch (error) {
      console.log('❌ Ошибка загрузки с сервера, используем локальные данные');
      await this.updateLayersUI(wellId);
    }
  }

  // МЕТОД СИНХРОНИЗАЦИИ ДАННЫХ
  async syncData() {
    if (this.syncInProgress) {
      console.log('🔄 Синхронизация уже выполняется');
      return;
    }

    this.syncInProgress = true;
    this.showMessage('🔄 Синхронизация данных...', 'info');

    try {
      // СИНХРОНИЗАЦИЯ СКВАЖИН
      const localWells = await this.loadFromLocalDB('wells');
      const unsyncedWells = localWells.filter(well => !well.synced && well.id.toString().startsWith('local_'));

      for (const well of unsyncedWells) {
        await this.syncWell(well);
      }

      // СИНХРОНИЗАЦИЯ СЛОЕВ
      const localLayers = await this.loadFromLocalDB('layers');
      const unsyncedLayers = localLayers.filter(layer => !layer.synced && layer.id.toString().startsWith('local_'));

      for (const layer of unsyncedLayers) {
        await this.syncLayer(layer);
      }

      // ПЕРЕЗАГРУЖАЕМ ДАННЫЕ С СЕРВЕРА
      await this.loadWells();
      if (this.currentWell) {
        await this.loadWellLayers(this.currentWell);
      }

      this.showMessage('✅ Синхронизация завершена!', 'success');

    } catch (error) {
      console.error('❌ Ошибка синхронизации:', error);
      this.showMessage('❌ Ошибка синхронизации', 'error');
    } finally {
      this.syncInProgress = false;
    }
  }

  // МЕТОД СИНХРОНИЗАЦИИ СКВАЖИНЫ
  async syncWell(localWell) {
    try {
      const wellData = {
        name: localWell.name,
        area: localWell.area,
        structure: localWell.structure,
        planned_depth: localWell.planned_depth
      };

      const response = await fetch(`${this.apiBase}/wells/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(wellData)
      });

      if (response.ok) {
        const serverWell = await response.json();

        // ОБНОВЛЯЕМ ЛОКАЛЬНУЮ ЗАПИСЬ
        await this.saveToLocalDB('wells', {
          ...serverWell,
          synced: true
        });

        console.log('✅ Скважина синхронизирована:', serverWell.name);

        // ОБНОВЛЯЕМ СЛОИ ЭТОЙ СКВАЖИНЫ
        await this.updateLayersWellId(localWell.id, serverWell.id);

      }
    } catch (error) {
      console.error('❌ Ошибка синхронизации скважины:', localWell.name, error);
      throw error;
    }
  }

  // МЕТОД СИНХРОНИЗАЦИИ СЛОЯ
  async syncLayer(localLayer) {
    try {
      // Получаем актуальный wellId (может измениться после синхронизации скважины)
      const wells = await this.loadFromLocalDB('wells');
      const originalWell = wells.find(w => w.id === localLayer.originalWellId || w.id === localLayer.wellId);
      const actualWellId = originalWell?.synced ? originalWell.id : localLayer.well;

      const layerData = {
        well: actualWellId,
        depth_from: localLayer.depth_from,
        depth_to: localLayer.depth_to,
        lithology: localLayer.lithology,
        description: localLayer.description,
        layer_number: localLayer.layer_number
      };

      const response = await fetch(`${this.apiBase}/layers/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(layerData)
      });

      if (response.ok) {
        const serverLayer = await response.json();

        // ОБНОВЛЯЕМ ЛОКАЛЬНУЮ ЗАПИСЬ
        await this.saveToLocalDB('layers', {
          ...serverLayer,
          wellId: serverLayer.well,
          synced: true
        });

        console.log('✅ Слой синхронизирован:', serverLayer.id);
      }
    } catch (error) {
      console.error('❌ Ошибка синхронизации слоя:', localLayer.id, error);
      throw error;
    }
  }

  // МЕТОД ОБНОВЛЕНИЯ wellId В СЛОЯХ
  async updateLayersWellId(oldWellId, newWellId) {
    const allLayers = await this.loadFromLocalDB('layers');
    const layersToUpdate = allLayers.filter(layer =>
      (layer.well === oldWellId || layer.wellId === oldWellId) && !layer.synced
    );

    for (const layer of layersToUpdate) {
      await this.saveToLocalDB('layers', {
        ...layer,
        well: newWellId,
        wellId: newWellId,
        originalWellId: oldWellId
      });
    }

    console.log(`🔄 Обновлено ${layersToUpdate.length} слоев для новой скважины ${newWellId}`);
  }

  // МЕТОД ОТОБРАЖЕНИЯ СКВАЖИН
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
                    ${!well.synced ? '<p><small>💾 Локальная версия</small></p>' : ''}
                </div>
                <small>📅 ${new Date(well.created_at || well.localSaveTime).toLocaleDateString('ru-RU')}</small>
            </div>
        `).join('');
  }

  // МЕТОД ОТОБРАЖЕНИЯ СЛОЕВ
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
                    ${layer.thickness || this.calculateThickness(layer.depth_from, layer.depth_to)} м
                </div>
            </div>
        `).join('');
  }

  // МЕТОД РАСЧЕТА МОЩНОСТИ СЛОЯ
  calculateThickness(depthFrom, depthTo) {
    if (depthFrom && depthTo) {
      return (parseFloat(depthTo) - parseFloat(depthFrom)).toFixed(2);
    }
    return '0.00';
  }

  // МЕТОД ПОЛУЧЕНИЯ ОТОБРАЖАЕМОГО НАЗВАНИЯ ЛИТОЛОГИИ
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

  // МЕТОД ПРОВЕРКИ СОЕДИНЕНИЯ
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

  // МЕТОД ПОКАЗА СООБЩЕНИЙ
  showMessage(text, type = 'info') {
    alert(text);
  }

  // МЕТОД ЭКСПОРТА ДАННЫХ
  async exportData() {
    this.showMessage('Экспорт данных...', 'info');
  }

  // МЕТОД ПЕРЕХОДА НА СТРАНИЦУ РАБОТЫ СО СКВАЖИНОЙ
  async showWorkPage(wellId) {
    this.currentWell = wellId;
    document.getElementById('current-well-id').value = wellId;
    await this.loadWellDetails(wellId);
    await this.loadWellLayers(wellId);
    showPage('work-page');
  }

  // МЕТОД ЗАГРУЗКИ ДЕТАЛЕЙ СКВАЖИНЫ
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

// ГЛОБАЛЬНЫЕ ФУНКЦИИ
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  document.getElementById(pageId).classList.add('active');
}

function syncData() {
  app.syncData();
}

function exportData() {
  app.exportData();
}

// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new DrillingJournal();
});