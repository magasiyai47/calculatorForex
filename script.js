(function() {
  "use strict";

  // ---------- ВАШ URL ИЗ GOOGLE APPS SCRIPT ----------
  const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbyVIWZGh5m1PA-k_USZE9XUDySMxgihYFbZN8HYRdzEGKwsyirQde1z0Jei3VARwEXvKA/exec';

  // Кэширование
  const CACHE_KEY = 'forex_instruments_cache';
  const CACHE_TIME_KEY = 'forex_cache_time';
  const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 часа

  // Ручные инструменты (фиксированная стоимость пункта)
  const manualInstruments = [
    { symbol: "XAUUSD", name: "Золото / USD", type: 'gold' },
    { symbol: "XAGUSD", name: "Серебро / USD", type: 'silver' },
    { symbol: "US30", name: "Dow Jones", type: 'index', tickValue: 1.0 },
    { symbol: "NAS100", name: "NASDAQ 100", type: 'index', tickValue: 1.0 },
    { symbol: "SPX500", name: "S&P 500", type: 'index', tickValue: 1.0 },
    { symbol: "GER40", name: "DAX 40", type: 'index', tickValue: 1.1 },
    { symbol: "UK100", name: "FTSE 100", type: 'index', tickValue: 1.2 },
    { symbol: "JPN225", name: "Nikkei 225", type: 'index', tickValue: 0.9 },
    { symbol: "AUS200", name: "ASX 200", type: 'index', tickValue: 0.7 },
    { symbol: "US2000", name: "Russell 2000", type: 'index', tickValue: 0.5 },
    { symbol: "FRA40", name: "CAC 40", type: 'index', tickValue: 1.1 },
    { symbol: "ESTX50", name: "Euro Stoxx 50", type: 'index', tickValue: 1.1 },
    { symbol: "HK50", name: "Hang Seng", type: 'index', tickValue: 0.5 }
  ];

  let globalRates = {};
  let instruments = [];
  let currentInstrument = null;
  let isRiskPercent = true;
  let filteredInstruments = [];
  let activeIndex = -1;

  const pipSizes = {
    default: 0.0001,
    jpy: 0.01,
    gold: 0.10,
    silver: 0.01,
    index: 1.0
  };

  // DOM элементы
  const symbolSearch = document.getElementById('symbolSearch');
  const clearSymbolBtn = document.getElementById('clearSymbolBtn');
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
  const ratesGrid = document.getElementById('ratesGrid');
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const lastUpdateTime = document.getElementById('lastUpdateTime');
  const statusLog = document.getElementById('statusLog');
  const refreshRatesBtn = document.getElementById('refreshRatesBtn');
  const calculatorTabBtn = document.getElementById('calculatorTabBtn');
  const copyTabBtn = document.getElementById('copyTabBtn');
  const calculatorPanel = document.getElementById('calculatorPanel');
  const copyPanel = document.getElementById('copyPanel');
  const copyEntryPriceInput = document.getElementById('copyEntryPrice');
  const copyDirectionSelect = document.getElementById('copyDirection');
  const copySlPipsSelect = document.getElementById('copySlPips');
  const copyTpPipsSelect = document.getElementById('copyTpPips');
  const calculateCopyBtn = document.getElementById('calculateCopyBtn');
  const copyResultBox = document.getElementById('copyResultBox');
  const copyEntryResult = document.getElementById('copyEntryResult');
  const copySlResult = document.getElementById('copySlResult');
  const copyTpResult = document.getElementById('copyTpResult');
  const copySlDistance = document.getElementById('copySlDistance');
  const copyTpDistance = document.getElementById('copyTpDistance');
  const copyResultActions = document.querySelectorAll('.copy-result-action');

  // ---------- Вспомогательные функции ----------
  function getPipSize(inst) {
    if (inst.symbol.includes('JPY')) return pipSizes.jpy;
    if (inst.symbol === 'XAUUSD') return pipSizes.gold;
    if (inst.symbol === 'XAGUSD') return pipSizes.silver;
    if (inst.type === 'index') return pipSizes.index;
    return pipSizes.default;
  }

  function getForexType(symbol) {
    const quote = symbol.substring(3, 6);
    const base = symbol.substring(0, 3);
    if (quote === 'USD') return 'fixed10';
    if (base === 'USD') return (quote === 'JPY') ? 'jpy' : 'inverse';
    return 'cross';
  }

  // Точная стоимость пункта
  function getPointValue(inst) {
    const rates = globalRates;
    const symbol = inst.symbol;
    const quote = symbol.substring(3, 6);
    const base = symbol.substring(0, 3);

    switch (inst.type) {
      case 'fixed10': return 10.0;
      case 'inverse': return 10.0 / rates[symbol];
      case 'jpy': return 1000.0 / rates.USDJPY;
      case 'cross': {
        // Кроссы с CAD, CHF
        if (quote === 'CAD') return 10.0 / rates.USDCAD;
        if (quote === 'CHF') return 10.0 / rates.USDCHF;
        
        // JPY кроссы: точная формула через базовую валюту
        if (quote === 'JPY') {
          let baseRate;
          if (base === 'USD') {
            baseRate = 1;
          } else {
            // Прямой курс XXXUSD или обратный USDXXX
            baseRate = rates[base + 'USD'] || (1.0 / rates['USD' + base]);
          }
          return baseRate * 1000.0 / rates.USDJPY;
        }

        // Общий случай (EURGBP, AUDNZD и т.д.)
        const baseUsd = (base === 'USD') ? 1 : rates[base + 'USD'] || (1 / rates['USD' + base]);
        const quoteUsd = (quote === 'USD') ? 1 : rates[quote + 'USD'] || (1 / rates['USD' + quote]);
        return (baseUsd / quoteUsd) * 10.0;
      }
      case 'gold': return 10.0;
      case 'silver': return 50.0;
      case 'index': return inst.tickValue || 1.0;
      default: return 10.0;
    }
  }

  // ---------- Загрузка данных из кэша или API ----------
  async function fetchForexDataFromAPI() {
    const response = await fetch(GAS_API_URL);
    const data = await response.json();
    const rates = {};
    const forexPairs = [];
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('CURRENCY:')) {
        const symbol = key.replace('CURRENCY:', '');
        rates[symbol] = value;
        forexPairs.push({
          symbol: symbol,
          name: `${symbol.substring(0,3)} / ${symbol.substring(3,6)}`,
          type: getForexType(symbol)
        });
      }
    }
    return { rates, forexPairs };
  }

  function loadFromCache() {
    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
    if (!cachedData || !cachedTime) return null;
    if (Date.now() - parseInt(cachedTime) > CACHE_DURATION_MS) {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_TIME_KEY);
      return null;
    }
    try { return JSON.parse(cachedData); } catch { return null; }
  }

  function saveToCache(rates, forexPairs) {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rates, forexPairs }));
    localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
  }

  async function loadForexData(forceRefresh = false) {
    try {
      if (!forceRefresh) {
        const cached = loadFromCache();
        if (cached) {
          globalRates = cached.rates;
          instruments = [...cached.forexPairs, ...manualInstruments];
          statusIndicator.textContent = '🟢';
          statusText.textContent = `Загружено из кэша (${cached.forexPairs.length} пар)`;
          lastUpdateTime.textContent = `Кэш от: ${new Date(parseInt(localStorage.getItem(CACHE_TIME_KEY))).toLocaleString('ru-RU')}`;
          statusLog.textContent = '✅ Использованы сохранённые данные.';
          renderGlobalRatesPanel(globalRates);
          return true;
        }
      }

      statusIndicator.textContent = '🔄';
      statusText.textContent = 'Загрузка из Google Таблицы...';
      const { rates, forexPairs } = await fetchForexDataFromAPI();
      globalRates = rates;
      instruments = [...forexPairs, ...manualInstruments];
      saveToCache(rates, forexPairs);
      
      lastUpdateTime.textContent = `Обновлено: ${new Date().toLocaleString('ru-RU')}`;
      statusIndicator.textContent = '🟢';
      statusText.textContent = `Загружено ${forexPairs.length} валютных пар`;
      statusLog.textContent = '✅ Данные успешно получены из Google Таблицы.';
      renderGlobalRatesPanel(rates);
      return true;
    } catch (error) {
      console.error('Ошибка загрузки:', error);
      statusIndicator.textContent = '🔴';
      statusText.textContent = 'Ошибка загрузки данных';
      statusLog.textContent = 'Не удалось загрузить курсы. Проверьте подключение и URL.';
      instruments = [...manualInstruments];
      return false;
    }
  }

  function renderGlobalRatesPanel(rates) {
    ratesGrid.innerHTML = '';
    Object.keys(rates).sort().forEach(symbol => {
      const div = document.createElement('div');
      div.className = 'rate-item';
      div.innerHTML = `
        <label>${symbol}</label>
        <div class="rate-value">${Number(rates[symbol]).toFixed(5)}</div>
      `;
      ratesGrid.appendChild(div);
    });
  }

  // ---------- Поиск и выбор ----------
  function renderDropdown(items) {
    dropdownList.innerHTML = '';
    if (!items.length) {
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
    return instruments.filter(i => i.symbol.toUpperCase().includes(q) || i.name.toUpperCase().includes(q));
  }

  function showDropdown() { dropdownList.classList.remove('hidden'); }
  function hideDropdown() { dropdownList.classList.add('hidden'); activeIndex = -1; }

  function updateClearSymbolButton() {
    clearSymbolBtn.classList.toggle('hidden', !symbolSearch.value.trim());
  }

  function clearSelectedInstrument() {
    currentInstrument = null;
    selectedSymbolInput.value = '';
    symbolSearch.value = '';
    lotSizeDisplay.textContent = '0.00';
    riskMoneySpan.textContent = '$0.00';
    pipsCountSpan.textContent = '0.0';
    updateClearSymbolButton();
    hideDropdown();
    symbolSearch.focus();
  }

  function selectInstrument(inst) {
    currentInstrument = inst;
    selectedSymbolInput.value = inst.symbol;
    symbolSearch.value = inst.symbol + ' — ' + inst.name;
    updateClearSymbolButton();
    setPlaceholders(inst);
    hideDropdown();
    calculateAll();
  }

  function setPlaceholders(inst) {
    if (inst.symbol.includes('JPY')) {
      entryPriceInput.placeholder = '150.50'; stopPriceInput.placeholder = '150.00';
    } else if (inst.symbol === 'XAUUSD') {
      entryPriceInput.placeholder = '2350.00'; stopPriceInput.placeholder = '2348.00';
    } else if (inst.type === 'index') {
      entryPriceInput.placeholder = '39200'; stopPriceInput.placeholder = '39180';
    } else {
      entryPriceInput.placeholder = '1.0850'; stopPriceInput.placeholder = '1.0830';
    }
  }

  function calculatePips() {
    const entry = parseFloat(entryPriceInput.value);
    const stop = parseFloat(stopPriceInput.value);
    if (isNaN(entry) || isNaN(stop) || !currentInstrument) return 0;
    return Math.abs(entry - stop) / getPipSize(currentInstrument);
  }

  function calculateAll() {
    if (!currentInstrument) return;
    const balance = parseFloat(balanceInput.value) || 0;
    const riskVal = parseFloat(riskValueInput.value) || 0;
    const pips = calculatePips();
    const pointVal = getPointValue(currentInstrument);
    const riskMoney = isRiskPercent ? balance * (riskVal / 100) : riskVal;
    const lotSize = (pips > 0 && pointVal > 0 && riskMoney > 0) ? riskMoney / (pips * pointVal) : 0;
    lotSizeDisplay.textContent = lotSize.toFixed(2);
    riskMoneySpan.textContent = `$${riskMoney.toFixed(2)}`;
    pipsCountSpan.textContent = pips.toFixed(1);
  }

  function switchTab(tabName) {
    const isCalculator = tabName === 'calculator';
    const isCopy = tabName === 'copy';
    const isRates = tabName === 'rates';

    calculatorTabBtn.classList.toggle('active', isCalculator);
    copyTabBtn.classList.toggle('active', isCopy);
    calculatorPanel.classList.toggle('active', isCalculator);
    copyPanel.classList.toggle('active', isCopy);
    globalRatesPanel.classList.toggle('hidden', !isRates);
  }

  function getPriceDecimals(rawValue) {
    const value = String(rawValue).trim().replace(',', '.');
    const decimalPart = value.includes('.') ? value.split('.')[1] : '';
    return Math.min(Math.max(decimalPart.length || 2, 2), 5);
  }

  function getCopyPipSize(decimals, entry) {
    if (entry >= 1000 && decimals <= 2) return 0.1;
    if (decimals === 3) return 0.01;
    if (decimals === 2) return 0.1;
    return 0.0001;
  }

  function randomInt(min, max) {
    return Math.floor(randomFloat() * (max - min + 1)) + min;
  }

  function randomFloat() {
    if (window.crypto && window.crypto.getRandomValues) {
      const values = new Uint32Array(1);
      window.crypto.getRandomValues(values);
      return values[0] / 4294967295;
    }
    return Math.random();
  }

  function getRandomizedPips(basePips) {
    const points = basePips * 10;
    const maxSpread = 50;
    const spread = randomInt(1, maxSpread);
    const sign = randomFloat() < 0.5 ? -1 : 1;
    const randomizedPoints = Math.max(1, points + (sign * spread));
    return randomizedPoints / 10;
  }

  function calculateCopyTrade() {
    const rawEntry = copyEntryPriceInput.value;
    const entry = parseFloat(rawEntry);
    const direction = copyDirectionSelect.value;
    const decimals = getPriceDecimals(rawEntry);
    const slBasePips = parseFloat(copySlPipsSelect.value);
    const tpBasePips = parseFloat(copyTpPipsSelect.value);

    if (isNaN(entry) || entry <= 0) {
      alert('Введите корректную цену входа');
      return;
    }

    if (isNaN(slBasePips) || slBasePips <= 0 || isNaN(tpBasePips) || tpBasePips <= 0) {
      alert('Введите корректные значения SL и TP в пипсах');
      return;
    }

    const pipSize = getCopyPipSize(decimals, entry);
    const slPips = getRandomizedPips(slBasePips);
    const tpPips = getRandomizedPips(tpBasePips);
    const isBuy = direction === 'buy';
    const sl = isBuy ? entry - (slPips * pipSize) : entry + (slPips * pipSize);
    const tp = isBuy ? entry + (tpPips * pipSize) : entry - (tpPips * pipSize);

    copyEntryResult.textContent = entry.toFixed(decimals);
    copySlResult.textContent = sl.toFixed(decimals);
    copyTpResult.textContent = tp.toFixed(decimals);
    copySlDistance.textContent = `${slPips.toFixed(1)} пипс.`;
    copyTpDistance.textContent = `${tpPips.toFixed(1)} пипс.`;
    copyResultBox.classList.remove('hidden');
  }

  async function copyTextValue(text, message) {
    if (!text || text === '-') return;

    try {
      await navigator.clipboard.writeText(text);
      copyToast.textContent = message;
      copyToast.classList.remove('hidden');
      setTimeout(() => copyToast.classList.add('hidden'), 1500);
    } catch {
      alert('Не удалось скопировать');
    }
  }

  // ---------- Инициализация ----------
  async function init() {
    balanceInput.value = '';
    riskValueInput.value = '';
    entryPriceInput.value = '';
    stopPriceInput.value = '';
    symbolSearch.value = '';
    selectedSymbolInput.value = '';
    lotSizeDisplay.textContent = '0.00';
    riskMoneySpan.textContent = '$0.00';
    pipsCountSpan.textContent = '0.0';

    balanceInput.placeholder = '10000';
    riskValueInput.placeholder = '1.0';
    entryPriceInput.placeholder = '1.0850';
    stopPriceInput.placeholder = '1.0830';
    copyEntryPriceInput.value = '';
    copyResultBox.classList.add('hidden');

    await loadForexData();

    calculatorTabBtn.addEventListener('click', () => switchTab('calculator'));
    copyTabBtn.addEventListener('click', () => switchTab('copy'));
    toggleRatesBtn.addEventListener('click', () => switchTab('rates'));
    calculateCopyBtn.addEventListener('click', calculateCopyTrade);
    copyEntryPriceInput.addEventListener('input', () => copyResultBox.classList.add('hidden'));
    [copyDirectionSelect, copySlPipsSelect, copyTpPipsSelect].forEach(el => {
      el.addEventListener('change', () => copyResultBox.classList.add('hidden'));
      el.addEventListener('input', () => copyResultBox.classList.add('hidden'));
    });
    copyResultActions.forEach(row => {
      row.addEventListener('click', () => {
        const target = row.dataset.copyTarget;
        const value = target === 'entry'
          ? copyEntryResult.textContent
          : target === 'sl'
            ? copySlResult.textContent
            : copyTpResult.textContent;
        copyTextValue(value, `${row.querySelector('span').textContent} скопирован`);
      });
    });

    symbolSearch.addEventListener('input', () => {
      updateClearSymbolButton();
      selectedSymbolInput.value = '';
      currentInstrument = null;
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
      if (!symbolSearch.contains(e.target) && !dropdownList.contains(e.target) && !clearSymbolBtn.contains(e.target)) hideDropdown();
    });
    clearSymbolBtn.addEventListener('click', clearSelectedInstrument);

    riskPercentBtn.addEventListener('click', () => {
      riskPercentBtn.classList.add('active');
      riskFixedBtn.classList.remove('active');
      isRiskPercent = true;
      riskLabel.textContent = 'Риск (%)';
      riskValueInput.placeholder = '1.0';
      riskValueInput.step = '0.1';
      calculateAll();
    });
    riskFixedBtn.addEventListener('click', () => {
      riskFixedBtn.classList.add('active');
      riskPercentBtn.classList.remove('active');
      isRiskPercent = false;
      riskLabel.textContent = 'Риск ($)';
      riskValueInput.placeholder = '100';
      riskValueInput.step = '1';
      calculateAll();
    });

    [balanceInput, riskValueInput, entryPriceInput, stopPriceInput].forEach(el => el.addEventListener('input', calculateAll));

    copyLotBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(lotSizeDisplay.textContent);
        copyToast.textContent = 'Лот скопирован';
        copyToast.classList.remove('hidden');
        setTimeout(() => copyToast.classList.add('hidden'), 1500);
      } catch { alert('Не удалось скопировать'); }
    });

    refreshRatesBtn.addEventListener('click', async () => {
      await loadForexData(true);
      if (currentInstrument) calculateAll();
    });
  }

  init();
})();
