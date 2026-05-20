import { render as renderMath } from './vendor/katex/katex.mjs';
import {
  CompactTrialLog,
  DEFAULT_CONFIG,
  PLAY_STATES,
  RESULT_FILTERS,
  SIMULATION_MODES,
  STRATEGIES,
  TRIAL_SOURCES,
  choosePlayFirstDoor,
  createPlayGame,
  finishPlayGame,
  getOpenedDoorIndexes,
  simulateTrials,
  strategiesForMode,
  summarizeLog,
  validateConfig,
  validatePlayConfig
} from './simulation.mjs';
import { createWorkbookData } from './export-data.mjs';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, createTranslator, detectLanguage } from './i18n.mjs';
import { TRIAL_ROW_HEIGHT, calculateVisibleRange } from './virtual-log.mjs';

const elements = {
  languageSelect: document.querySelector('#languageSelect'),
  tabButtons: [...document.querySelectorAll('[data-tab-target]')],
  tabPanels: [...document.querySelectorAll('[data-tab-panel]')],
  playForm: document.querySelector('#playForm'),
  playDoorInput: document.querySelector('#playDoorInput'),
  playNewButton: document.querySelector('#playNewButton'),
  playErrorMessage: document.querySelector('#playErrorMessage'),
  playStatusText: document.querySelector('#playStatusText'),
  playOutcome: document.querySelector('#playOutcome'),
  doorGrid: document.querySelector('#doorGrid'),
  batchForm: document.querySelector('#batchForm'),
  batchDoorInput: document.querySelector('#batchDoorInput'),
  trialInput: document.querySelector('#trialInput'),
  modeInputs: [...document.querySelectorAll('input[name="simulationMode"]')],
  runButton: document.querySelector('#runButton'),
  cancelButton: document.querySelector('#cancelButton'),
  batchErrorMessage: document.querySelector('#batchErrorMessage'),
  progressBar: document.querySelector('#progressBar'),
  statusText: document.querySelector('#statusText'),
  filterInputs: [...document.querySelectorAll('input[name="resultFilter"]')],
  exportButton: document.querySelector('#exportButton'),
  clearButton: document.querySelector('#clearButton'),
  resultsGrid: document.querySelector('#resultsGrid'),
  comparisonSummary: document.querySelector('#comparisonSummary'),
  logMeta: document.querySelector('#logMeta'),
  trialLogScroller: document.querySelector('#trialLogScroller'),
  trialLogBody: document.querySelector('#trialLogBody'),
  theoryRates: document.querySelector('#theoryRates'),
  theoryExpected: document.querySelector('#theoryExpected'),
  theoryStats: document.querySelector('#theoryStats'),
  bayesFormula: document.querySelector('#bayesFormula')
};

const sharedLog = new CompactTrialLog(0);

let currentLanguage = detectLanguage(navigator.languages);
let t = createTranslator(currentLanguage);
let numberFormatter = createNumberFormatter();
let percentFormatter = createPercentFormatter();
let playGame = null;
let activeTab = 'play';
let activeFilter = RESULT_FILTERS.all;
let activeController = null;
let pendingLogRender = false;

initialize();

function initialize() {
  populateLanguageSelect();
  elements.playDoorInput.value = DEFAULT_CONFIG.nDoors;
  elements.batchDoorInput.value = DEFAULT_CONFIG.nDoors;
  elements.trialInput.value = DEFAULT_CONFIG.trials;
  setSelectedMode(DEFAULT_CONFIG.mode);
  setSelectedFilter(RESULT_FILTERS.all);
  elements.languageSelect.value = currentLanguage;

  elements.languageSelect.addEventListener('change', handleLanguageChange);
  elements.tabButtons.forEach((button) => button.addEventListener('click', () => setActiveTab(button.dataset.tabTarget)));
  elements.playForm.addEventListener('submit', handlePlayNewGame);
  elements.doorGrid.addEventListener('click', handleDoorClick);
  elements.batchForm.addEventListener('submit', handleBatchSubmit);
  elements.cancelButton.addEventListener('click', handleCancel);
  elements.filterInputs.forEach((input) => input.addEventListener('change', handleFilterChange));
  elements.exportButton.addEventListener('click', handleExport);
  elements.clearButton.addEventListener('click', handleClear);
  elements.trialLogScroller.addEventListener('scroll', scheduleTrialLogRender);
  window.addEventListener('resize', scheduleTrialLogRender);

  applyTranslations();
  setActiveTab(activeTab);
  startPlayGame();
  renderSharedData();
  setBatchStatus('config.ready');
}

function populateLanguageSelect() {
  elements.languageSelect.replaceChildren(
    ...SUPPORTED_LANGUAGES.map((language) => {
      const option = document.createElement('option');
      option.value = language;
      option.textContent = LANGUAGE_NAMES[language];
      return option;
    })
  );
}

function handleLanguageChange(event) {
  currentLanguage = event.target.value;
  t = createTranslator(currentLanguage);
  numberFormatter = createNumberFormatter();
  percentFormatter = createPercentFormatter();
  applyTranslations();
  renderPlayGame();
  renderSharedData();
}

function applyTranslations() {
  document.documentElement.lang = currentLanguage;
  document.title = t('app.title');

  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });

  elements.statusText.textContent = elements.statusText.dataset.statusKey
    ? t(elements.statusText.dataset.statusKey, JSON.parse(elements.statusText.dataset.statusValues ?? '{}'))
    : t('config.ready');

  elements.playStatusText.textContent = elements.playStatusText.dataset.statusKey
    ? t(elements.playStatusText.dataset.statusKey, JSON.parse(elements.playStatusText.dataset.statusValues ?? '{}'))
    : '';
}

function setActiveTab(tabName) {
  activeTab = tabName === 'batch' ? 'batch' : 'play';

  elements.tabButtons.forEach((button) => {
    const isActive = button.dataset.tabTarget === activeTab;
    button.setAttribute('aria-selected', String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });

  elements.tabPanels.forEach((panel) => {
    panel.hidden = panel.dataset.tabPanel !== activeTab;
  });
}

function handlePlayNewGame(event) {
  event.preventDefault();
  startPlayGame();
}

function startPlayGame() {
  const validation = validatePlayConfig({ nDoors: elements.playDoorInput.value });
  renderPlayValidation(validation);

  if (!validation.ok) {
    playGame = null;
    renderPlayGame();
    return;
  }

  playGame = createPlayGame({ nDoors: validation.config.nDoors });
  setPlayStatus('play.chooseFirst');
  elements.playOutcome.textContent = '';
  renderPlayGame();
}

function renderPlayValidation(validation) {
  const messages = Object.values(validation.errors).map((key) => t(key));
  elements.playErrorMessage.textContent = messages.join(' ');
  elements.playDoorInput.setAttribute('aria-invalid', validation.errors.nDoors ? 'true' : 'false');
}

function handleDoorClick(event) {
  const button = event.target.closest('[data-door-index]');

  if (!button || !playGame) {
    return;
  }

  const doorIndex = Number(button.dataset.doorIndex);

  if (playGame.state === PLAY_STATES.choosingFirst) {
    playGame = choosePlayFirstDoor(playGame, doorIndex);
    setPlayStatus('play.chooseFinal');
    elements.playOutcome.textContent = '';
    renderPlayGame();
    return;
  }

  if (playGame.state === PLAY_STATES.choosingFinal) {
    const { game, trial } = finishPlayGame(playGame, doorIndex);
    playGame = game;
    sharedLog.append(trial);
    setPlayStatus(trial.win ? 'play.finishedWin' : 'play.finishedLoss');
    elements.playOutcome.textContent = trial.win ? t('play.winMessage') : t('play.lossMessage');
    renderPlayGame();
    renderSharedData();
  }
}

function renderPlayGame() {
  elements.doorGrid.replaceChildren();

  if (!playGame) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = t('play.empty');
    elements.doorGrid.append(empty);
    return;
  }

  elements.doorGrid.classList.toggle('compact', playGame.nDoors >= 13);

  const openedDoors = new Set(getOpenedDoorIndexes(playGame));

  for (let index = 0; index < playGame.nDoors; index += 1) {
    elements.doorGrid.append(renderDoorButton(index, openedDoors));
  }
}

function renderDoorButton(index, openedDoors) {
  const button = document.createElement('button');
  const doorState = getDoorState(index, openedDoors);

  button.type = 'button';
  button.className = `door-card ${doorState.className}`;
  button.dataset.doorIndex = String(index);
  button.disabled = !isDoorSelectable(index);
  button.setAttribute('aria-label', `${formatDoor(index)} ${doorState.label}`);

  const visual = document.createElement('span');
  visual.className = 'door-visual';

  const number = document.createElement('span');
  number.className = 'door-number';
  number.textContent = formatDoor(index);

  const label = document.createElement('span');
  label.className = 'door-state';
  label.textContent = doorState.label;

  button.append(visual, number, label);
  return button;
}

function getDoorState(index, openedDoors) {
  if (playGame.state === PLAY_STATES.finished) {
    if (index === playGame.carDoor) {
      return { className: 'prize', label: t('play.doorPrize') };
    }

    if (index === playGame.finalChoice) {
      return { className: 'chosen losing', label: t('play.doorLosing') };
    }

    return { className: 'losing', label: t('play.doorLosing') };
  }

  if (openedDoors.has(index)) {
    return { className: 'open-losing', label: t('play.doorOpenedLosing') };
  }

  if (index === playGame.firstChoice) {
    return { className: 'chosen', label: t('play.doorFirstChoice') };
  }

  if (index === playGame.montyChoice) {
    return { className: 'left', label: t('play.doorMontyLeft') };
  }

  return { className: 'closed', label: t('play.doorClosed') };
}

function isDoorSelectable(index) {
  if (playGame.state === PLAY_STATES.choosingFirst) {
    return true;
  }

  if (playGame.state === PLAY_STATES.choosingFinal) {
    return index === playGame.firstChoice || index === playGame.montyChoice;
  }

  return false;
}

function setPlayStatus(key, values = {}) {
  elements.playStatusText.dataset.statusKey = key;
  elements.playStatusText.dataset.statusValues = JSON.stringify(values);
  elements.playStatusText.textContent = t(key, values);
}

function handleBatchSubmit(event) {
  event.preventDefault();
  runBatchSimulation();
}

function handleCancel() {
  activeController?.abort();
}

async function runBatchSimulation() {
  const validation = validateConfig({
    nDoors: elements.batchDoorInput.value,
    trials: elements.trialInput.value,
    mode: getSelectedMode()
  });

  renderBatchValidation(validation);

  if (!validation.ok) {
    setBatchStatus('config.invalid');
    return;
  }

  const totalRows = validation.config.trials * strategiesForMode(validation.config.mode).length;
  activeController = new AbortController();
  setRunning(true);
  setProgress(0);
  setBatchStatus('config.running', {
    completed: numberFormatter.format(0),
    total: numberFormatter.format(totalRows)
  });

  try {
    const chunkSize = Math.max(100, Math.min(10000, Math.ceil(totalRows / 30)));
    const result = await simulateTrials(validation.config, {
      chunkSize,
      signal: activeController.signal,
      yieldToEventLoop: true,
      onProgress: ({ completed, totalTrials, ratio }) => {
        setProgress(ratio * 100);
        setBatchStatus('config.running', {
          completed: numberFormatter.format(completed),
          total: numberFormatter.format(totalTrials)
        });
      }
    });

    sharedLog.appendLog(result.log);

    if (result.canceled) {
      setBatchStatus('config.canceled', { completed: numberFormatter.format(result.completed) });
    } else {
      setProgress(100);
      setBatchStatus('config.completed', { total: numberFormatter.format(result.totalTrials) });
    }

    elements.trialLogScroller.scrollTop = 0;
    renderSharedData();
  } finally {
    setRunning(false);
    activeController = null;
  }
}

function renderBatchValidation(validation) {
  const messages = Object.values(validation.errors).map((key) => t(key));
  elements.batchErrorMessage.textContent = messages.join(' ');
  elements.batchDoorInput.setAttribute('aria-invalid', validation.errors.nDoors ? 'true' : 'false');
  elements.trialInput.setAttribute('aria-invalid', validation.errors.trials ? 'true' : 'false');
}

function setRunning(isRunning) {
  elements.runButton.disabled = isRunning;
  elements.cancelButton.disabled = !isRunning;
  elements.batchDoorInput.disabled = isRunning;
  elements.trialInput.disabled = isRunning;
  elements.modeInputs.forEach((input) => {
    input.disabled = isRunning;
  });
}

function setProgress(value) {
  elements.progressBar.value = Math.max(0, Math.min(100, value));
}

function setBatchStatus(key, values = {}) {
  elements.statusText.dataset.statusKey = key;
  elements.statusText.dataset.statusValues = JSON.stringify(values);
  elements.statusText.textContent = t(key, values);
}

function handleFilterChange(event) {
  activeFilter = event.target.value;
  elements.trialLogScroller.scrollTop = 0;
  renderSharedData();
}

function setSelectedFilter(filter) {
  elements.filterInputs.forEach((input) => {
    input.checked = input.value === filter;
  });
}

function handleClear() {
  sharedLog.clear();
  setProgress(0);
  setBatchStatus('config.ready');
  elements.playOutcome.textContent = '';
  renderSharedData();
}

function handleExport() {
  if (sharedLog.length === 0) {
    return;
  }

  if (!globalThis.XLSX) {
    elements.batchErrorMessage.textContent = t('export.unavailable');
    return;
  }

  const workbookData = createWorkbookData(sharedLog, createExportLabels());
  const workbook = globalThis.XLSX.utils.book_new();
  globalThis.XLSX.utils.book_append_sheet(workbook, globalThis.XLSX.utils.aoa_to_sheet(workbookData.summary), 'Summary');
  globalThis.XLSX.utils.book_append_sheet(workbook, globalThis.XLSX.utils.aoa_to_sheet(workbookData.trials), 'Trials');
  globalThis.XLSX.writeFile(workbook, `monty-hall-simulator-v0.2.0-${createTimestamp()}.xlsx`);
}

function createExportLabels() {
  return {
    filter: t('results.filter'),
    mode: t('log.headers.source'),
    index: t('log.headers.index'),
    strategy: t('log.headers.strategy'),
    carDoor: t('log.headers.carDoor'),
    firstChoice: t('log.headers.firstChoice'),
    montyChoice: t('log.headers.montyChoice'),
    openedDoorCount: t('log.headers.openedDoorCount'),
    finalChoice: t('log.headers.finalChoice'),
    result: t('log.headers.result'),
    trials: t('results.trials'),
    wins: t('results.wins'),
    losses: t('results.losses'),
    observedWinRate: t('results.observedWinRate'),
    theoreticalRate: t('results.theoreticalRate'),
    expectedWins: t('theory.expectedWinsShort'),
    win: t('log.win'),
    loss: t('log.loss'),
    filters: {
      [RESULT_FILTERS.all]: t('filter.all'),
      [RESULT_FILTERS.play]: t('filter.play'),
      [RESULT_FILTERS.batch]: t('filter.batch')
    },
    sources: {
      [TRIAL_SOURCES.play]: t('source.play'),
      [TRIAL_SOURCES.batch]: t('source.batch')
    },
    strategies: {
      [STRATEGIES.stay]: t('results.strategyStay'),
      [STRATEGIES.switch]: t('results.strategySwitch')
    }
  };
}

function renderSharedData() {
  const summary = summarizeLog(sharedLog, activeFilter);
  renderResults(summary);
  renderTrialLog();
  renderTheory(summary);
  elements.exportButton.disabled = sharedLog.length === 0;
  elements.clearButton.disabled = sharedLog.length === 0;
}

function renderResults(summary) {
  const { observed } = summary;
  const cards = [];

  if (observed.stay) {
    cards.push(renderStrategyCard('results.strategyStay', 'stay', observed.stay));
  }

  if (observed.switch) {
    cards.push(renderStrategyCard('results.strategySwitch', 'switch', observed.switch));
  }

  if (cards.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = sharedLog.length === 0 ? t('results.empty') : t('results.emptyFilter');
    elements.resultsGrid.replaceChildren(empty);
  } else {
    elements.resultsGrid.replaceChildren(...cards);
  }

  if (observed.comparison) {
    const comparison = document.createElement('dl');
    comparison.className = 'comparison-list';
    appendDefinition(comparison, 'results.observedRateGap', formatSignedPercent(observed.comparison.rateGap));
    appendDefinition(comparison, 'results.observedMultiplier', formatMultiplier(observed.comparison.relativeMultiplier));
    elements.comparisonSummary.replaceChildren(comparison);
  } else {
    elements.comparisonSummary.replaceChildren();
  }
}

function renderStrategyCard(titleKey, className, stats) {
  const card = document.createElement('article');
  card.className = `strategy-card ${className}`;

  const kicker = document.createElement('p');
  kicker.className = 'card-kicker';
  kicker.textContent = t('results.simulationOnly');

  const title = document.createElement('h3');
  title.textContent = t(titleKey);

  const rate = document.createElement('p');
  rate.className = 'rate-value';
  rate.textContent = formatPercent(stats.winRate);

  const bar = document.createElement('div');
  bar.className = 'rate-bar';
  const fill = document.createElement('span');
  fill.style.width = `${stats.winRate * 100}%`;
  bar.append(fill);

  const list = document.createElement('dl');
  list.className = 'stat-list';
  appendDefinition(list, 'results.trials', formatNumber(stats.trials));
  appendDefinition(list, 'results.wins', formatNumber(stats.wins));
  appendDefinition(list, 'results.losses', formatNumber(stats.losses));
  appendDefinition(list, 'results.observedWinRate', formatPercent(stats.winRate));

  card.append(kicker, title, rate, bar, list);
  return card;
}

function scheduleTrialLogRender() {
  if (pendingLogRender) {
    return;
  }

  pendingLogRender = true;
  requestAnimationFrame(() => {
    pendingLogRender = false;
    renderTrialLog();
  });
}

function renderTrialLog() {
  const log = sharedLog.filter(activeFilter);

  if (log.length === 0) {
    elements.logMeta.textContent = '';
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.className = 'empty-log';
    cell.colSpan = 9;
    cell.textContent = sharedLog.length === 0 ? t('log.empty') : t('log.emptyFilter');
    row.append(cell);
    elements.trialLogBody.replaceChildren(row);
    return;
  }

  elements.logMeta.textContent = activeFilter === RESULT_FILTERS.all
    ? t('log.totalRows', { count: formatNumber(log.length) })
    : t('log.totalFilteredRows', { count: formatNumber(log.length), total: formatNumber(sharedLog.length) });

  const range = calculateVisibleRange({
    totalRows: log.length,
    scrollTop: elements.trialLogScroller.scrollTop,
    viewportHeight: elements.trialLogScroller.clientHeight,
    rowHeight: TRIAL_ROW_HEIGHT
  });

  const fragment = document.createDocumentFragment();
  appendSpacerRow(fragment, range.topSpacerHeight);

  for (const trial of log.slice(range.start, range.end)) {
    fragment.append(renderTrialRow(trial));
  }

  appendSpacerRow(fragment, range.bottomSpacerHeight);
  elements.trialLogBody.replaceChildren(fragment);
}

function appendSpacerRow(fragment, height) {
  if (height <= 0) {
    return;
  }

  const row = document.createElement('tr');
  row.className = 'spacer-row';
  const cell = document.createElement('td');
  cell.colSpan = 9;
  cell.style.height = `${height}px`;
  row.append(cell);
  fragment.append(row);
}

function renderTrialRow(trial) {
  const row = document.createElement('tr');
  row.dataset.rowIndex = String(trial.index);
  row.dataset.filteredIndex = String(trial.filteredIndex ?? trial.index);

  appendCell(row, t(sourceKey(trial.source)));
  appendCell(row, formatNumber(trial.index + 1), 'numeric');
  appendCell(row, t(strategyKey(trial.strategy)));
  appendCell(row, formatDoor(trial.carDoor));
  appendCell(row, formatDoor(trial.firstChoice));
  appendCell(row, formatDoor(trial.montyChoice));
  appendCell(row, formatNumber(trial.openedDoorCount), 'numeric');
  appendCell(row, formatDoor(trial.finalChoice));
  appendCell(row, trial.win ? t('log.win') : t('log.loss'), trial.win ? 'win-cell' : 'loss-cell');
  return row;
}

function appendCell(row, text, className = '') {
  const cell = document.createElement('td');
  cell.textContent = text;

  if (className) {
    cell.className = className;
  }

  row.append(cell);
}

function renderTheory(summary) {
  elements.theoryRates.textContent = t('theory.rates');
  elements.theoryExpected.textContent = t('theory.expectedWins', {
    trials: formatNumber(summary.totalTrials),
    stay: formatNumber(summary.theory.stayExpectedWins, 2),
    switch: formatNumber(summary.theory.switchExpectedWins, 2)
  });
  renderBayesFormula();

  const strategies = [];

  if (summary.observed.stay) {
    strategies.push([STRATEGIES.stay, t('results.strategyStay'), summary.observed.stay]);
  }

  if (summary.observed.switch) {
    strategies.push([STRATEGIES.switch, t('results.strategySwitch'), summary.observed.switch]);
  }

  if (strategies.length === 0) {
    elements.theoryStats.replaceChildren();
    return;
  }

  const table = document.createElement('table');
  table.className = 'theory-table';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['', ...strategies.map(([, label]) => label)].forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    headRow.append(th);
  });
  thead.append(headRow);

  const tbody = document.createElement('tbody');
  const rows = [
    ['results.observedWinRate', (stats) => formatPercent(stats.winRate)],
    ['results.theoreticalRate', (stats) => formatPercent(stats.theoreticalRate)],
    ['theory.rateDifference', (stats) => formatSignedPercent(stats.rateDifference)],
    ['theory.standardError', (stats) => formatNumber(stats.standardError, 5)],
    ['theory.confidence95', (stats) => formatInterval(stats.confidence95)]
  ];

  rows.forEach(([labelKey, formatter]) => {
    const row = document.createElement('tr');
    [t(labelKey), ...strategies.map(([, , stats]) => formatter(stats))].forEach((value) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    });
    tbody.append(row);
  });

  table.append(thead, tbody);
  elements.theoryStats.replaceChildren(table);
}

function renderBayesFormula() {
  const formulas = [
    ['theory.formulaBayesLabel', 'theory.formulaBayes'],
    ['theory.formulaFirstPrizeLabel', 'theory.formulaFirstPrize'],
    ['theory.formulaFirstLosingLabel', 'theory.formulaFirstLosing'],
    ['theory.formulaStayGivenMontyLabel', 'theory.formulaStayGivenMonty'],
    ['theory.formulaSwitchGivenMontyLabel', 'theory.formulaSwitchGivenMonty']
  ];

  elements.bayesFormula.replaceChildren(...formulas.map(([labelKey, formulaKey]) => {
    const row = document.createElement('div');
    row.className = 'formula-row';

    const label = document.createElement('span');
    label.className = 'formula-label';
    label.textContent = t(labelKey);

    const math = document.createElement('div');
    math.className = 'formula-math';
    renderMath(t(formulaKey), math, {
      displayMode: true,
      throwOnError: false
    });

    row.append(label, math);
    return row;
  }));
}

function getSelectedMode() {
  return elements.modeInputs.find((input) => input.checked)?.value ?? SIMULATION_MODES.both;
}

function setSelectedMode(mode) {
  elements.modeInputs.forEach((input) => {
    input.checked = input.value === mode;
  });
}

function appendDefinition(list, labelKey, value) {
  const dt = document.createElement('dt');
  const dd = document.createElement('dd');
  dt.textContent = t(labelKey);
  dd.textContent = value;
  list.append(dt, dd);
}

function sourceKey(source) {
  return source === TRIAL_SOURCES.play ? 'source.play' : 'source.batch';
}

function strategyKey(strategy) {
  return strategy === STRATEGIES.switch ? 'results.strategySwitch' : 'results.strategyStay';
}

function formatDoor(index) {
  return t('doorNumber', { number: numberFormatter.format(index + 1) });
}

function formatNumber(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat(currentLanguage, {
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits > 0 ? 0 : 0
  }).format(value);
}

function formatPercent(value) {
  return percentFormatter.format(value);
}

function formatSignedPercent(value) {
  const formatted = percentFormatter.format(Math.abs(value));

  if (Object.is(value, -0) || value === 0) {
    return formatted;
  }

  return `${value > 0 ? '+' : '-'}${formatted}`;
}

function formatInterval(interval) {
  return `${formatPercent(interval.low)} - ${formatPercent(interval.high)}`;
}

function formatMultiplier(value) {
  if (!Number.isFinite(value)) {
    return 'N/A';
  }

  return `${formatNumber(value, 2)}x`;
}

function createNumberFormatter() {
  return new Intl.NumberFormat(currentLanguage);
}

function createPercentFormatter() {
  return new Intl.NumberFormat(currentLanguage, {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function createTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
