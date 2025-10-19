// Базовые функции приложения
class DrillingJournal {
  constructor() {
    this.apiBase = 'http://localhost:8000/api';
    this.currentWell = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadWells();
    this.checkConnection();
  }

  setupEventListeners() {
    // Форма новой скважины
    document.getElementById('new-well-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.createWell(new FormData(e.target));
    });

    // Форма нового слоя
    document.getElementById('new-layer-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.createLayer(new FormData(e.target));
    });
  }

  async loadWells() {
    try {
      const response = await fetch(`${this.apiBase}/wells/`);
      const wells = await response.json();
      this.renderWells(wells);
    } catch (error) {
      console.log('Офлайн режим, загружаем из локального хранилища');
      this.loadFromLocalStorage();
    }
  }

  renderWells(wells) {
    const container = document.getElementById('wells-list');

    if (wells.length === 0) {
      container.innerHTML = '<p>Нет созданных скважин</p>';
      return;
    }

    container.innerHTML = wells.map(well => `
            <div class="well-item card" onclick="app.showWellDetail(${well.id})">
                <h3>${well.name}</h3>
                <p>Участок: ${well.area}</p>
                <p>Глубина: ${well.planned_depth || '—'} м</p>
                <small>Создана: ${new Date(well.created_at).toLocaleDateString()}</small>
            </div>
        `).join('');
  }

  async createWell(formData) {
    const wellData = {
      name: formData.get('name'),
      area: formData.get('area'),
      structure: formData.get('structure'),
      start_date: formData.get('start_date'),
      planned_depth: formData.get('planned_depth')
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
        alert('Скважина создана!');
        showPage('home-page');
        this.loadWells();
      }
    } catch (error) {
      // Сохраняем в локальное хранилище для офлайн работы
      this.saveToLocalStorage('wells', wellData);
      alert('Скважина сохранена локально (офлайн)');
      showPage('home-page');
    }
  }

  async createLayer(formData) {
    const layerData = {
      well: parseInt(formData.get('well_id')),
      depth_from: parseFloat(formData.get('depth_from')),
      depth_to: parseFloat(formData.get('depth_to')),
      lithology: formData.get('lithology'),
      description: formData.get('description')
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
        alert('Слой добавлен!');
        this.showWellDetail(layerData.well);
      }
    } catch (error) {
      this.saveToLocalStorage('layers', layerData);
      alert('Слой сохранен локально (офлайн)');
      this.showWellDetail(layerData.well);
    }
  }

  showWellDetail(wellId) {
    this.currentWell = wellId;
    document.getElementById('current-well-id').value = wellId;

    // Загружаем данные скважины и показываем страницу
    showPage('well-detail-page');
    // Здесь будет загрузка деталей скважины
  }

  checkConnection() {
    const statusElement = document.getElementById('connection-status');

    if (navigator.onLine) {
      statusElement.innerHTML = '<span>🟢 Онлайн</span>';
    } else {
      statusElement.innerHTML = '<span class="offline-badge">🔴 Офлайн</span>';
    }

    window.addEventListener('online', () => {
      statusElement.innerHTML = '<span>🟢 Онлайн</span>';
    });

    window.addEventListener('offline', () => {
      statusElement.innerHTML = '<span class="offline-badge">🔴 Офлайн</span>';
    });
  }

  saveToLocalStorage(type, data) {
    const key = `offline_${type}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.push({ ...data, id: Date.now(), synced: false });
    localStorage.setItem(key, JSON.stringify(existing));
  }

  loadFromLocalStorage() {
    // Загрузка данных из localStorage
    const wells = JSON.parse(localStorage.getItem('offline_wells') || '[]');
    this.renderWells(wells);
  }
}

// Глобальные функции для навигации
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  document.getElementById(pageId).classList.add('active');

  // Обновляем активную кнопку навигации
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });
}

function syncData() {
  alert('Синхронизация...');
  // Здесь будет логика синхронизации офлайн данных
}

// Инициализация приложения
const app = new DrillingJournal();