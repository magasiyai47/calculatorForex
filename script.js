(function() {
  "use strict";

  // ---------- ГЛОБАЛЬНЫЕ КУРСЫ (ручной ввод для индексов и металлов) ----------
  const globalRates = {
    EURUSD: 1.0850,
    GBPUSD: 1.2650,
    AUDUSD: 0.6520,
    NZDUSD: 0.5980,
    USDCAD: 1.3580,
    USDCHF: 0.9030,
    USDJPY: 158.00,
    XAUUSD: 2350.00,
    US30: 39200,
    NAS100: 18300,
    SPX500: 5220.0
  };

  // ---------- КЭШИРОВАНИЕ КУРСОВ ВАЛЮТ ----------
  const CACHE_KEY = 'forex_rates_cache';
  const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 часа

  let currencyRates = {}; // загруженные из API или кэша

  // ---------- БАЗА ИНСТРУМЕНТОВ ----------
  const instruments = [
    // Прямые котировки
    { symbol: "EURUSD", name: "Евро / Доллар", type: 'fixed10' },
    { symbol: "GBPUSD", name: "Фунт / Доллар", type: 'fixed10' },
    { symbol: "AUDUSD", name: "Австралиец / USD", type: 'fixed10' },
    { symbol: "NZDUSD", name: "Киви / USD", type: 'fixed10' },
    
    // Обратные котировки
    { symbol: "USDCAD", name: "Доллар / Канадец", type: 'inverse', base: 'USDCAD' },
    { symbol: "USDCHF", name: "Доллар / Франк", type: 'inverse', base: 'USDCHF' },
    { symbol: "USDJPY", name: "Доллар / Иена", type: 'jpy', base: 'USDJPY' },
    
    // Кроссы
    { symbol: "EURGBP", name: "Евро / Фунт", type: 'cross', base1: 'EURUSD', base2: 'GBPUSD', divisor: true },
    { symbol: "EURJPY", name: "Евро / Иена", type: 'crossJpy', base: 'EURUSD' },
    { symbol: "EURCHF", name: "Евро / Франк", type: 'crossChf', base: 'EURUSD' },
    { symbol: "EURAUD", name: "Евро / AUSD", type: 'cross', base1: 'EURUSD', base2: 'AUDUSD', divisor: true },
    { symbol: "EURNZD", name: "Евро / NZD", type: 'cross', base1: 'EURUSD', base2: 'NZDUSD', divisor: true },
    { symbol: "EURCAD", name: "Евро / CAD", type: 'crossCad', base: 'EURUSD' },
    { symbol: "GBPJPY", name: "Фунт / Иена", type: 'crossJpy', base: 'GBPUSD' },
    { symbol: "GBPCHF", name: "Фунт / Франк", type: 'crossChf', base: 'GBPUSD' },
    { symbol: "GBPAUD", name: "Фунт / AUSD", type: 'cross', base1: 'GBPUSD', base2: 'AUDUSD', divisor: true },
    { symbol: "GBPCAD", name: "Фунт / CAD", type: 'crossCad', base: 'GBPUSD' },
    { symbol: "GBPNZD", name: "Фунт / NZD", type: 'cross', base1: 'GBPUSD', base2: 'NZDUSD', divisor: true },
    { symbol: "AUDCAD", name: "AUD / CAD", type: 'crossCad', base: 'AUDUSD' },
    { symbol: "AUDCHF", name: "AUD / CHF", type: 'crossChf', base: 'AUDUSD' },
    { symbol: "AUDJPY", name: "AUD / JPY", type: 'crossJpy', base: 'AUDUSD' },
    { symbol: "AUDNZD", name: "AUD / NZD", type: 'cross', base1: 'AUDUSD', base2: 'NZDUSD', divisor: true },
    { symbol: "CADCHF", name: "CAD / CHF", type: 'crossChf', base: 'USDCAD', inverseBase: true },
    { symbol: "CADJPY", name: "CAD / JPY", type: 'crossJpy', base: 'USDCAD', inverseBase: true },
    { symbol: "CHFJPY", name: "CHF / JPY", type: 'crossJpy', base: 'USDCHF', inverseBase: true },
    { symbol: "NZDCAD", name: "NZD / CAD", type: 'crossCad', base: 'NZDUSD' },
    { symbol: "NZDCHF", name: "NZD / CHF", type: 'crossChf', base: 'NZDUSD' },
    { symbol: "NZDJPY", name: "NZD / JPY", type: 'crossJpy', base: 'NZDUSD' },
    
    // Металлы (фикс)
    { symbol: "XAUUSD", name: "Золото / USD", type: 'gold' },
    { symbol: "XAGUSD", name: "Серебро / USD", type: 'silver' },
    
    // Индексы (ручной ввод)
    { symbol: "US30", name: "Dow Jones", type: 'index', base: 'US30', tickValue: 1.0 },
    { symbol: "NAS100", name: "NASDAQ 100", type: 'index', base: 'NAS100', tickValue: 1.0 },
    { symbol: "SPX500", name: "S&P 500", type: 'index', base: 'SPX500', tickValue: 1.0 },
    { symbol: "GER40", name: "DAX 40", type: 'index', base: null, tickValue: 1.1 },
    { symbol: "UK100", name: "FTSE 100", type: 'index', base: null, tickValue: 1.2 },
    { symbol: "JPN225", name: "Nikkei 225", type: 'index', base: null, tickValue: 0.9 },
    { symbol: "AUS200", name: "ASX 200", type: 'index', base: null, tickValue: 0.7 },
    { symbol: "US2000", name: "Russell 2000", type: 'index', base: null, tickValue: 0.5 },
    { symbol: "FRA40", name: "CAC 40", type: 'index', base: null, tickValue: 1.1 },
    { symbol: "ESTX50", name: "Euro Stoxx 50", type: 'index', base: null, tickValue: 1.1 },
    { symbol: "HK50", name: "Hang Seng", type: 'index', base: null, tickValue: 0.5 },
  ];

  // Размеры пункта
  const pipSizes = {
    default: 0.0001,
    jpy: 0.01,
    gold: 0.10,
    silver: 0.01,
    index: 1.0
  };

  function getPipSize(inst) {
    if (inst.symbol.includes('JPY')) return pipSizes.jpy;
    if (inst.symbol === 'XAUUSD') return pipSizes.gold;
    if (inst.symbol === 'XAGUSD') return pipSizes.silver;
    if (inst.type === 'index') return pipSizes.index;
    return pipSizes.default;
  }

  // Получение стоимости пункта
  function getPointValue(inst) {
    const rates = { ...globalRates, ...currencyRates };
    switch (inst.type) {
      case 'fixed10': return 10.0;
      case 'inverse': return 10.0 / rates[inst.base];
      case 'jpy': return 1000.0 / rates.USDJPY;
      case 'cross':
        const val1 = rates[inst.base1];
        const val2 = rates[inst.base2];
        return inst.divisor ? (val1 / val2) * 10.0 : (val1 * val2) * 10.0;
      case 'crossJpy':
        let baseRate = rates[inst.base];
        if (inst.inverseBase) baseRate = 1.0 / rates[inst.base];
        return (baseRate * 1000.0) / rates.USDJPY;
      case 'crossChf':
        let chfBase = rates[inst.base];
        if (inst.inverseBase) chfBase = 1.0 / rates[inst.base];
        return chfBase * (10.0 / rates.USDCHF);
      case 'crossCad':
        let cadBase = rates[inst.base];
        if (inst.inverseBase) cadBase = 1.0 / rates[inst.base];
        return cadBase * (10.0 / rates.USDCAD);
      case 'gold': return 10.0;
      case 'silver': return 50.0;
      case 'index': return inst.tickValue || 1.0;
      default: return 10.0;
    }
  }

  // ---------- DOM элементы ----------
  const symbolSearch = document.getElementById('symbolSearch');
  const dropdownList = document.getElementById('dropdownList');
  const selectedSymbolInput = document.getElementById('selectedSymbol');
  const balanceInput = document.getElementById('balance');
  const riskPercentBtn = document.getElementById('riskPercentBtn');
  const riskFixedBtn = document.getElementById('riskFixedBtn');
  const riskLabel = document.getElementById('riskLabel');
  const riskValueInput = document.getElementById('riskValue');
  const entryPriceInput = document.getElementById('entryPrice');
  const stopPriceInput = document.getElementById('stopPrice');
  const lotSizeDisplay = document.getElementById('lotSizeDisplay');
  const riskMoneySpan = document.getElementById('riskMoney');
  const pipsCountSpan = document.getElementById('pipsCount');
  const copyLotBtn = document.getElementById('copyLotBtn');
  const copyToast = document.getElementById('copyToast');
  const toggleRatesBtn = document.getElementById('toggleRatesBtn');
  const globalRatesPanel = document.getElementById('globalRatesPanel');
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const lastUpdateTime = document.getElementById('lastUpdateTime');
  const statusLog = document.getElementById('statusLog');
  const refreshRatesBtn = document.getElementById('refreshRatesBtn');

  const rateInputs = {
    EURUSD: document.getElementById('rateEURUSD'),
    GBPUSD: document.getElementById('rateGBPUSD'),
    AUDUSD: document.getElementById('rateAUDUSD'),
    NZDUSD: document.getElementById('rateNZDUSD'),
    USDCAD: document.getElementById('rateUSDCAD'),
    USDCHF: document.getElementById('rateUSDCHF'),
    USDJPY: document.getElementById('rateUSDJPY'),
    XAUUSD: document.getElementById('rateXAUUSD'),
    US30: document.getElementById('rateUS30'),
    NAS100: document.getElementById('rateNAS100'),
    SPX500: document.getElementById('rateSPX500')
  };

  let currentInstrument = instruments.find(i => i.symbol === 'EURUSD');
  let isRiskPercent = true;
  let filteredInstruments = [...instruments];
  let activeIndex = -1;

  // ---------- Работа с API и кэшем ----------
  async function fetchCurrencyRates() {
    try {
      const response = await fetch('https://api.frankfurter.dev/latest?base=USD');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data.rates;
    } catch (error) {
      console.warn('Ошибка получения курсов:', error);
      return null;
    }
  }

  function saveToCache(rates) {
    const cache = {
      timestamp: Date.now(),
      rates: rates
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  }

  function loadFromCache() {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    try {
      return JSON.parse(cached);
    } catch {
      return null;
    }
  }

  function isCacheValid(cache) {
    if (!cache || !cache.timestamp) return false;
    return (Date.now() - cache.timestamp) < CACHE_EXPIRY_MS;
  }

  function updateStatusUI(valid, ratesObj, errorMsg = null) {
    if (valid && ratesObj) {
      statusIndicator.textContent = '🟢';
      statusText.textContent = 'Курсы валют актуальны';
      const cache = loadFromCache();
      if (cache) {
        lastUpdateTime.textContent = `Обновлено: ${new Date(cache.timestamp).toLocaleString('ru-RU')}`;
      }
      const missing = [];
      const required = ['EUR', 'GBP', 'AUD', 'NZD', 'CAD', 'CHF', 'JPY'];
      required.forEach(curr => {
        if (!ratesObj[curr]) missing.push(`USD${curr}`);
      });
      if (missing.length) {
        statusLog.textContent = `⚠️ Не получены курсы: ${missing.join(', ')}`;
      } else {
        statusLog.textContent = '✅ Все валютные курсы загружены.';
      }
    } else {
      statusIndicator.textContent = '🟡';
      statusText.textContent = errorMsg || 'Используются кэшированные/ручные курсы';
      const cache = loadFromCache();
      if (cache) {
        lastUpdateTime.textContent = `Кэш от: ${new Date(cache.timestamp).toLocaleString('ru-RU')}`;
      } else {
        lastUpdateTime.textContent = 'Нет данных';
      }
      statusLog.textContent = errorMsg || 'Проверьте подключение к интернету.';
    }
  }

  async function loadRates(forceRefresh = false) {
    const cache = loadFromCache();
    if (!forceRefresh && isCacheValid(cache)) {
      currencyRates = cache.rates;
      updateStatusUI(true, currencyRates);
      return;
    }

    if (forceRefresh && isCacheValid(cache)) {
      statusLog.textContent = 'ℹ️ Данные и так актуальны (прошло менее 24 часов).';
      currencyRates = cache.rates;
      updateStatusUI(true, currencyRates);
      return;
    }

    statusIndicator.textContent = '🔄';
    statusText.textContent = 'Загрузка курсов...';
    const rates = await fetchCurrencyRates();
    if (rates) {
      currencyRates = rates;
      saveToCache(rates);
      updateStatusUI(true, rates);
    } else {
      if (cache) {
        currencyRates = cache.rates;
        updateStatusUI(false, null, 'Не удалось обновить. Используется кэш.');
      } else {
        updateStatusUI(false, null, 'Нет соединения и кэша. Введите курсы вручную.');
      }
    }
  }

  // ---------- Обновление глобальных курсов из полей ----------
  function updateGlobalRatesFromInputs() {
    for (let key in rateInputs) {
      const val = parseFloat(rateInputs[key].value);
      if (!isNaN(val)) globalRates[key] = val;
    }
  }

  function syncInputsWithRates() {
    for (let key in rateInputs) {
      rateInputs[key].value = globalRates[key];
    }
  }

  function onRatesChanged() {
    updateGlobalRatesFromInputs();
    setExamplePrices(currentInstrument);
    calculateAll();
  }

  // ---------- Выбор инструмента и расчёт ----------
  function renderDropdown(items) {
    dropdownList.innerHTML = '';
    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'dropdown-item';
      empty.style.color = '#6b7c9e';
      empty.style.cursor = 'default';
      empty.textContent = '❌ Не найдено';
      dropdownList.appendChild(empty);
      return;
    }
    items.forEach((inst, idx) => {
      const div = document.createElement('div');
      div.className = 'dropdown-item' + (activeIndex === idx ? ' active' : '');
      div.innerHTML = `<span class="symbol-code">${inst.symbol}</span><span class="symbol-name">${inst.name}</span>`;
      div.dataset.symbol = inst.symbol;
      div.addEventListener('click', () => selectInstrument(inst));
      dropdownList.appendChild(div);
    });
  }

  function filterInstruments(query) {
    if (!query.trim()) return instruments;
    const q = query.trim().toUpperCase();
    return instruments.filter(inst => inst.symbol.toUpperCase().includes(q) || inst.name.toUpperCase().includes(q));
  }

  function showDropdown() { dropdownList.classList.remove('hidden'); }
  function hideDropdown() { dropdownList.classList.add('hidden'); activeIndex = -1; }

  function selectInstrument(inst) {
    currentInstrument = inst;
    selectedSymbolInput.value = inst.symbol;
    symbolSearch.value = inst.symbol + ' — ' + inst.name;
    setExamplePrices(inst);
    hideDropdown();
    calculateAll();
  }

  function setExamplePrices(inst) {
    if (inst.symbol.includes('JPY')) {
      entryPriceInput.value = '150.50'; stopPriceInput.value = '150.00';
    } else if (inst.symbol === 'XAUUSD') {
      entryPriceInput.value = '2350.00'; stopPriceInput.value = '2348.00';
    } else if (inst.type === 'index') {
      entryPriceInput.value = '39200'; stopPriceInput.value = '39180';
    } else {
      entryPriceInput.value = '1.0850'; stopPriceInput.value = '1.0830';
    }
  }

  function calculatePips() {
    const entry = parseFloat(entryPriceInput.value);
    const stop = parseFloat(stopPriceInput.value);
    if (isNaN(entry) || isNaN(stop) || !currentInstrument) return 0;
    const diff = Math.abs(entry - stop);
    return diff / getPipSize(currentInstrument);
  }

  function calculateAll() {
    const balance = parseFloat(balanceInput.value) || 0;
    const riskVal = parseFloat(riskValueInput.value) || 0;
    const pips = calculatePips();
    const pointVal = getPointValue(currentInstrument);

    let riskMoney = isRiskPercent ? balance * (riskVal / 100) : riskVal;
    let lotSize = (pips > 0 && pointVal > 0 && riskMoney > 0) ? riskMoney / (pips * pointVal) : 0;

    lotSizeDisplay.textContent = lotSize.toFixed(2);
    riskMoneySpan.textContent = `$${riskMoney.toFixed(2)}`;
    pipsCountSpan.textContent = pips.toFixed(1);
  }

  // ---------- Инициализация ----------
  async function init() {
    // Загружаем курсы валют (из кэша или API)
    await loadRates();

    // Синхронизируем поля глобальных курсов
    syncInputsWithRates();

    // Устанавливаем инструмент по умолчанию
    const def = instruments.find(i => i.symbol === 'EURUSD') || instruments[0];
    selectInstrument(def);

    // Обработчики событий
    symbolSearch.addEventListener('input', () => {
      filteredInstruments = filterInstruments(symbolSearch.value);
      activeIndex = -1;
      renderDropdown(filteredInstruments);
      showDropdown();
    });
    symbolSearch.addEventListener('focus', () => {
      filteredInstruments = filterInstruments(symbolSearch.value);
      renderDropdown(filteredInstruments);
      showDropdown();
    });
    symbolSearch.addEventListener('keydown', (e) => {
      const items = dropdownList.querySelectorAll('.dropdown-item:not([style*="cursor: default"])');
      if (!dropdownList.classList.contains('hidden')) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (items.length) { activeIndex = (activeIndex + 1) % items.length; renderDropdown(filteredInstruments); }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (items.length) { activeIndex = (activeIndex - 1 + items.length) % items.length; renderDropdown(filteredInstruments); }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (activeIndex >= 0 && items[activeIndex]) {
            const sym = items[activeIndex].dataset.symbol;
            const inst = instruments.find(i => i.symbol === sym);
            if (inst) selectInstrument(inst);
          } else if (filteredInstruments.length) {
            selectInstrument(filteredInstruments[0]);
          }
          hideDropdown();
        } else if (e.key === 'Escape') hideDropdown();
      }
    });
    document.addEventListener('click', (e) => {
      if (!symbolSearch.contains(e.target) && !dropdownList.contains(e.target)) hideDropdown();
    });

    riskPercentBtn.addEventListener('click', () => {
      riskPercentBtn.classList.add('active');
      riskFixedBtn.classList.remove('active');
      isRiskPercent = true;
      riskLabel.textContent = 'Риск (%)';
      riskValueInput.step = '0.1';
      riskValueInput.min = '0.1';
      calculateAll();
    });
    riskFixedBtn.addEventListener('click', () => {
      riskFixedBtn.classList.add('active');
      riskPercentBtn.classList.remove('active');
      isRiskPercent = false;
      riskLabel.textContent = 'Риск ($)';
      riskValueInput.step = '1';
      riskValueInput.min = '1';
      calculateAll();
    });

    [balanceInput, riskValueInput, entryPriceInput, stopPriceInput].forEach(el => el.addEventListener('input', calculateAll));

    copyLotBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(lotSizeDisplay.textContent);
        copyToast.classList.remove('hidden');
        setTimeout(() => copyToast.classList.add('hidden'), 1500);
      } catch { alert('Не удалось скопировать'); }
    });

    toggleRatesBtn.addEventListener('click', () => {
      globalRatesPanel.classList.toggle('hidden');
    });

    refreshRatesBtn.addEventListener('click', async () => {
      await loadRates(true);
      syncInputsWithRates();
      calculateAll();
    });

    for (let key in rateInputs) {
      rateInputs[key].addEventListener('input', () => {
        onRatesChanged();
      });
    }

    calculateAll();
  }

  init();
})();