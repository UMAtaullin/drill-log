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

  // НОВЫЙ МЕТОД - автоматическая синхронизация при появлении интернета
  setupAutoSync() {
    window.addEventListener('online', async () => {
      console.log('🌐 Интернет появился, запускаем синхронизацию...');
      await this.syncData();
    });
  }

  // ОБНОВЛЕННЫЙ МЕТОД - настоящая синхронизация
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

  // СИНХРОНИЗАЦИЯ СКВАЖИНЫ
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

  // СИНХРОНИЗАЦИЯ СЛОЯ
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

  // ОБНОВЛЯЕМ wellId В СЛОЯХ ПОСЛЕ СИНХРОНИЗАЦИИ СКВАЖИНЫ
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
        originalWellId: oldWellId // сохраняем старый ID для отслеживания
      });
    }

    console.log(`🔄 Обновлено ${layersToUpdate.length} слоев для новой скважины ${newWellId}`);
  }

  // ОБНОВЛЕННЫЙ МЕТОД СОХРАНЕНИЯ СКВАЖИНЫ ОФФЛАЙН
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

  // ОБНОВЛЕННЫЙ МЕТОД СОХРАНЕНИЯ СЛОЯ ОФФЛАЙН
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

  // ОБНОВЛЕННЫЙ МЕТОД СОХРАНЕНИЯ СЛОЯ ОФФЛАЙН
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

  // ОБНОВЛЕННЫЙ МЕТОД ЗАГРУЗКИ СЛОЕВ - показываем и синхронизированные и несинхронизированные
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