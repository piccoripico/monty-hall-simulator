import { render as renderMath } from './vendor/katex/katex.mjs';
import { DEFAULT_CONFIG, SIMULATION_MODES, STRATEGIES, simulateTrials, strategiesForMode, validateConfig } from './simulation.mjs';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, createTranslator, detectLanguage } from './i18n.mjs';
import { TRIAL_ROW_HEIGHT, calculateVisibleRange } from './virtual-log.mjs';

const elements = {
  languageSelect: document.querySelector('#languageSelect'),
  configForm: document.querySelector('#configForm'),
  doorInput: document.querySelector('#doorInput'),
  trialInput: document.querySelector('#trialInput'),
  modeInputs: [...document.querySelectorAll('input[name="simulationMode"]')],
  runButton: document.querySelector('#runButton'),
  cancelButton: document.querySelector('#cancelButton'),
  errorMessage: document.querySelector('#errorMessage'),
  progressBar: document.querySelector('#progressBar'),
  statusText: document.querySelector('#statusText'),
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

let currentLanguage = detectLanguage(navigator.languages);
let t = createTranslator(currentLanguage);
let numberFormatter = createNumberFormatter();
let percentFormatter = createPercentFormatter();
let lastResult = null;
let activeController = null;
let pendingLogRender = false;

initialize();

function initialize() {
  populateLanguageSelect();
  elements.doorInput.value = DEFAULT_CONFIG.nDoors;
  elements.trialInput.value = DEFAULT_CONFIG.trials;
  setSelectedMode(DEFAULT_CONFIG.mode);
  elements.languageSelect.value = currentLanguage;

  elements.languageSelect.addEventListener('change', handleLanguageChange);
  elements.configForm.addEventListener('submit', handleRunSubmit);
  elements.cancelButton.addEventListener('click', handleCancel);
  elements.modeInputs.forEach((input) => input.addEventListener('change', renderTheoryFromConfig));
  elements.trialLogScroller.addEventListener('scroll', scheduleTrialLogRender);
  window.addEventListener('resize', scheduleTrialLogRender);

  applyTranslations();
  renderEmptyResults();
  renderTrialLog();
  renderTheoryFromConfig();
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

  if (lastResult) {
    renderResults(lastResult.summary);
  } else {
    renderEmptyResults();
  }

  renderTrialLog();
  renderTheory(lastResult?.summary);
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
}

function handleRunSubmit(event) {
  event.preventDefault();
  runSimulation();
}

function handleCancel() {
  activeController?.abort();
}

async function runSimulation() {
  const validation = validateConfig({
    nDoors: elements.doorInput.value,
    trials: elements.trialInput.value,
    mode: getSelectedMode()
  });

  renderValidation(validation);

  if (!validation.ok) {
    setStatus('config.invalid');
    return;
  }

  const totalRows = validation.config.trials * strategiesForMode(validation.config.mode).length;
  activeController = new AbortController();
  lastResult = null;
  renderEmptyResults();
  renderTrialLog();
  renderTheoryFromConfig();
  setRunning(true);
  setProgress(0);
  setStatus('config.running', {
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
        setStatus('config.running', {
          completed: numberFormatter.format(completed),
          total: numberFormatter.format(totalTrials)
        });
      }
    });

    if (result.canceled) {
      lastResult = result;
      setStatus('config.canceled', { completed: numberFormatter.format(result.completed) });
      renderResults(result.summary);
      renderTrialLog();
      renderTheory(result.summary);
      return;
    }

    lastResult = result;
    setProgress(100);
    setStatus('config.completed', { total: numberFormatter.format(result.totalTrials) });
    renderResults(result.summary);
    elements.trialLogScroller.scrollTop = 0;
    renderTrialLog();
    renderTheory(result.summary);
  } finally {
    setRunning(false);
    activeController = null;
  }
}

function renderValidation(validation) {
  const messages = Object.values(validation.errors).map((key) => t(key));
  elements.errorMessage.textContent = messages.join(' ');
  elements.doorInput.setAttribute('aria-invalid', validation.errors.nDoors ? 'true' : 'false');
  elements.trialInput.setAttribute('aria-invalid', validation.errors.trials ? 'true' : 'false');
}

function setRunning(isRunning) {
  elements.runButton.disabled = isRunning;
  elements.cancelButton.disabled = !isRunning;
  elements.doorInput.disabled = isRunning;
  elements.trialInput.disabled = isRunning;
  elements.modeInputs.forEach((input) => {
    input.disabled = isRunning;
  });
}

function setProgress(value) {
  elements.progressBar.value = Math.max(0, Math.min(100, value));
}

function setStatus(key, values = {}) {
  elements.statusText.dataset.statusKey = key;
  elements.statusText.dataset.statusValues = JSON.stringify(values);
  elements.statusText.textContent = t(key, values);
}

function renderEmptyResults() {
  const empty = document.createElement('p');
  empty.className = 'empty-state';
  empty.textContent = t('results.empty');
  elements.resultsGrid.replaceChildren(empty);
  elements.comparisonSummary.replaceChildren();
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

  elements.resultsGrid.replaceChildren(...cards);

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
  const log = lastResult?.log;

  if (!log || log.length === 0) {
    elements.logMeta.textContent = '';
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.className = 'empty-log';
    cell.colSpan = 8;
    cell.textContent = t('log.empty');
    row.append(cell);
    elements.trialLogBody.replaceChildren(row);
    return;
  }

  elements.logMeta.textContent = t('log.totalRows', { count: formatNumber(log.length) });

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
  cell.colSpan = 8;
  cell.style.height = `${height}px`;
  row.append(cell);
  fragment.append(row);
}

function renderTrialRow(trial) {
  const row = document.createElement('tr');
  row.dataset.rowIndex = String(trial.index);

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

function renderTheoryFromConfig() {
  const validation = validateConfig({
    nDoors: elements.doorInput.value,
    trials: elements.trialInput.value,
    mode: getSelectedMode()
  });

  if (!validation.ok) {
    elements.theoryRates.textContent = '';
    elements.theoryExpected.textContent = '';
    elements.theoryStats.replaceChildren();
    elements.bayesFormula.replaceChildren();
    return;
  }

  renderTheory({
    nDoors: validation.config.nDoors,
    trials: validation.config.trials,
    mode: validation.config.mode,
    theory: {
      stayRate: 1 / validation.config.nDoors,
      switchRate: (validation.config.nDoors - 1) / validation.config.nDoors,
      stayExpectedWins: validation.config.trials / validation.config.nDoors,
      switchExpectedWins: validation.config.trials * ((validation.config.nDoors - 1) / validation.config.nDoors)
    }
  });
}

function renderTheory(summary) {
  if (!summary) {
    renderTheoryFromConfig();
    return;
  }

  elements.theoryRates.textContent = t('theory.rates');
  elements.theoryExpected.textContent = t('theory.expectedWins', {
    trials: formatNumber(summary.trials),
    stay: formatNumber(summary.theory.stayExpectedWins, 2),
    switch: formatNumber(summary.theory.switchExpectedWins, 2)
  });
  renderBayesFormula(summary.nDoors);

  if (!summary.observed) {
    elements.theoryStats.replaceChildren();
    return;
  }

  const table = document.createElement('table');
  table.className = 'theory-table';
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

function renderBayesFormula(nDoors) {
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

function strategyKey(strategy) {
  return strategy === 'switch' ? 'results.strategySwitch' : 'results.strategyStay';
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
