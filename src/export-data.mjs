import { RESULT_FILTERS, STRATEGIES, summarizeLog } from './simulation.mjs';

export function createSummarySheetRows(log, labels = defaultLabels) {
  const rows = [[
    labels.filter,
    labels.strategy,
    labels.trials,
    labels.wins,
    labels.losses,
    labels.observedWinRate,
    labels.theoreticalRate,
    labels.expectedWins
  ]];

  for (const filter of [RESULT_FILTERS.all, RESULT_FILTERS.play, RESULT_FILTERS.batch]) {
    const summary = summarizeLog(log, filter);

    appendSummaryStrategy(rows, labels, filter, STRATEGIES.stay, summary.observed.stay);
    appendSummaryStrategy(rows, labels, filter, STRATEGIES.switch, summary.observed.switch);
  }

  return rows;
}

export function createTrialSheetRows(log, labels = defaultLabels) {
  const rows = [[
    labels.mode,
    labels.index,
    labels.strategy,
    labels.carDoor,
    labels.firstChoice,
    labels.montyChoice,
    labels.openedDoorCount,
    labels.finalChoice,
    labels.result
  ]];

  for (let index = 0; index < log.length; index += 1) {
    const trial = log.get(index);

    rows.push([
      labelFor(labels.sources, trial.source),
      index + 1,
      labelFor(labels.strategies, trial.strategy),
      trial.carDoor + 1,
      trial.firstChoice + 1,
      trial.montyChoice + 1,
      trial.openedDoorCount,
      trial.finalChoice + 1,
      trial.win ? labels.win : labels.loss
    ]);
  }

  return rows;
}

export function createWorkbookData(log, labels = defaultLabels) {
  return {
    summary: createSummarySheetRows(log, labels),
    trials: createTrialSheetRows(log, labels)
  };
}

function appendSummaryStrategy(rows, labels, filter, strategy, stats) {
  rows.push([
    labelFor(labels.filters, filter),
    labelFor(labels.strategies, strategy),
    stats?.trials ?? 0,
    stats?.wins ?? 0,
    stats?.losses ?? 0,
    stats ? stats.winRate : '',
    stats ? stats.theoreticalRate : '',
    stats ? stats.expectedWins : ''
  ]);
}

function labelFor(labels, key) {
  return labels?.[key] ?? key;
}

const defaultLabels = Object.freeze({
  filter: 'Filter',
  mode: 'Mode',
  index: '#',
  strategy: 'Strategy',
  carDoor: 'Prize door',
  firstChoice: 'First choice',
  montyChoice: 'Door Monty left',
  openedDoorCount: 'Opened losing doors',
  finalChoice: 'Final choice',
  result: 'Result',
  trials: 'Trials',
  wins: 'Wins',
  losses: 'Losses',
  observedWinRate: 'Observed win rate',
  theoreticalRate: 'Theoretical win rate',
  expectedWins: 'Expected wins',
  win: 'Win',
  loss: 'Loss',
  filters: {
    [RESULT_FILTERS.all]: 'All',
    [RESULT_FILTERS.play]: 'Play',
    [RESULT_FILTERS.batch]: 'Batch'
  },
  sources: {
    play: 'Play',
    batch: 'Batch'
  },
  strategies: {
    stay: 'Stay',
    switch: 'Switch'
  }
});
