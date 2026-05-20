export const DEFAULT_CONFIG = Object.freeze({
  nDoors: 3,
  trials: 100,
  mode: 'both'
});

export const LIMITS = Object.freeze({
  minDoors: 3,
  maxDoors: 1000,
  minTrials: 1,
  maxTrials: 100_000
});

export const STRATEGIES = Object.freeze({
  stay: 'stay',
  switch: 'switch'
});

export const SIMULATION_MODES = Object.freeze({
  both: 'both',
  stay: STRATEGIES.stay,
  switch: STRATEGIES.switch
});

export const TRIAL_SOURCES = Object.freeze({
  play: 'play',
  batch: 'batch'
});

export const RESULT_FILTERS = Object.freeze({
  all: 'all',
  play: TRIAL_SOURCES.play,
  batch: TRIAL_SOURCES.batch
});

export const PLAY_STATES = Object.freeze({
  choosingFirst: 'choosing-first',
  choosingFinal: 'choosing-final',
  finished: 'finished'
});

const STRATEGY_TO_CODE = Object.freeze({
  [STRATEGIES.stay]: 0,
  [STRATEGIES.switch]: 1
});

const CODE_TO_STRATEGY = Object.freeze([
  STRATEGIES.stay,
  STRATEGIES.switch
]);

const SOURCE_TO_CODE = Object.freeze({
  [TRIAL_SOURCES.play]: 0,
  [TRIAL_SOURCES.batch]: 1
});

const CODE_TO_SOURCE = Object.freeze([
  TRIAL_SOURCES.play,
  TRIAL_SOURCES.batch
]);

export class CompactTrialLog {
  constructor(initialCapacity = 0, defaultNDoors = DEFAULT_CONFIG.nDoors) {
    if (!Number.isSafeInteger(initialCapacity) || initialCapacity < 0) {
      throw new RangeError('initialCapacity must be a non-negative safe integer');
    }

    this.defaultNDoors = defaultNDoors;
    this.capacity = initialCapacity;
    this.length = 0;
    this.sources = new Uint8Array(initialCapacity);
    this.nDoors = new Uint16Array(initialCapacity);
    this.strategies = new Uint8Array(initialCapacity);
    this.carDoors = new Uint16Array(initialCapacity);
    this.firstChoices = new Uint16Array(initialCapacity);
    this.montyChoices = new Uint16Array(initialCapacity);
    this.finalChoices = new Uint16Array(initialCapacity);
    this.wins = new Uint8Array(initialCapacity);
  }

  append(trial) {
    const nDoors = toInteger(trial.nDoors ?? this.defaultNDoors);
    const source = normalizeSource(trial.source ?? TRIAL_SOURCES.batch);

    if (!Number.isInteger(nDoors) || nDoors < LIMITS.minDoors || nDoors > LIMITS.maxDoors) {
      throw new RangeError(`nDoors must be between ${LIMITS.minDoors} and ${LIMITS.maxDoors}`);
    }

    if (!Object.values(STRATEGIES).includes(trial.strategy)) {
      throw new RangeError('strategy must be stay or switch');
    }

    this.ensureCapacity(this.length + 1);

    const row = this.length;
    this.sources[row] = SOURCE_TO_CODE[source];
    this.nDoors[row] = nDoors;
    this.strategies[row] = STRATEGY_TO_CODE[trial.strategy];
    this.carDoors[row] = trial.carDoor;
    this.firstChoices[row] = trial.firstChoice;
    this.montyChoices[row] = trial.montyChoice;
    this.finalChoices[row] = trial.finalChoice;
    this.wins[row] = trial.win ? 1 : 0;
    this.length += 1;
    return row;
  }

  appendLog(log) {
    for (let index = 0; index < log.length; index += 1) {
      this.append(log.get(index));
    }
  }

  clear() {
    this.length = 0;
  }

  get(index) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.length) {
      throw new RangeError('trial log index out of range');
    }

    const nDoors = this.nDoors[index];

    return {
      index,
      source: CODE_TO_SOURCE[this.sources[index]],
      nDoors,
      strategy: CODE_TO_STRATEGY[this.strategies[index]],
      carDoor: this.carDoors[index],
      firstChoice: this.firstChoices[index],
      montyChoice: this.montyChoices[index],
      openedDoorCount: nDoors - 2,
      finalChoice: this.finalChoices[index],
      win: this.wins[index] === 1
    };
  }

  slice(start, end) {
    const safeStart = clampInteger(start, 0, this.length);
    const safeEnd = clampInteger(end, safeStart, this.length);
    const rows = [];

    for (let index = safeStart; index < safeEnd; index += 1) {
      rows.push(this.get(index));
    }

    return rows;
  }

  filter(filter = RESULT_FILTERS.all) {
    return new FilteredTrialLogView(this, filter);
  }

  ensureCapacity(requiredCapacity) {
    if (requiredCapacity <= this.capacity) {
      return;
    }

    const nextCapacity = Math.max(requiredCapacity, this.capacity === 0 ? 16 : this.capacity * 2);
    this.sources = growUint8(this.sources, nextCapacity);
    this.nDoors = growUint16(this.nDoors, nextCapacity);
    this.strategies = growUint8(this.strategies, nextCapacity);
    this.carDoors = growUint16(this.carDoors, nextCapacity);
    this.firstChoices = growUint16(this.firstChoices, nextCapacity);
    this.montyChoices = growUint16(this.montyChoices, nextCapacity);
    this.finalChoices = growUint16(this.finalChoices, nextCapacity);
    this.wins = growUint8(this.wins, nextCapacity);
    this.capacity = nextCapacity;
  }
}

export class FilteredTrialLogView {
  constructor(log, filter = RESULT_FILTERS.all) {
    this.log = log;
    this.filter = normalizeFilter(filter);
    this.indexes = [];

    for (let index = 0; index < log.length; index += 1) {
      const row = log.get(index);

      if (this.filter === RESULT_FILTERS.all || row.source === this.filter) {
        this.indexes.push(index);
      }
    }

    this.length = this.indexes.length;
  }

  get(index) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.length) {
      throw new RangeError('filtered trial log index out of range');
    }

    return {
      ...this.log.get(this.indexes[index]),
      filteredIndex: index
    };
  }

  slice(start, end) {
    const safeStart = clampInteger(start, 0, this.length);
    const safeEnd = clampInteger(end, safeStart, this.length);
    const rows = [];

    for (let index = safeStart; index < safeEnd; index += 1) {
      rows.push(this.get(index));
    }

    return rows;
  }
}

export function validateConfig(input = {}) {
  const nDoors = toInteger(input.nDoors);
  const trials = toInteger(input.trials);
  const rawMode = input.mode ?? DEFAULT_CONFIG.mode;
  const mode = normalizeMode(rawMode);
  const errors = {};

  if (!isValidDoorCount(nDoors)) {
    errors.nDoors = 'errors.doorsRange';
  }

  if (!Number.isInteger(trials) || trials < LIMITS.minTrials || trials > LIMITS.maxTrials) {
    errors.trials = 'errors.trialsRange';
  }

  if (!Object.values(SIMULATION_MODES).includes(rawMode)) {
    errors.mode = 'errors.mode';
  }

  return {
    ok: Object.keys(errors).length === 0,
    config: { nDoors, trials, mode },
    errors
  };
}

export function validatePlayConfig(input = {}) {
  const nDoors = toInteger(input.nDoors);
  const errors = {};

  if (!isValidDoorCount(nDoors)) {
    errors.nDoors = 'errors.doorsRange';
  }

  return {
    ok: Object.keys(errors).length === 0,
    config: { nDoors },
    errors
  };
}

export function theoreticalRates(nDoors) {
  const doors = toInteger(nDoors);

  if (!Number.isInteger(doors) || doors < LIMITS.minDoors) {
    throw new RangeError(`nDoors must be at least ${LIMITS.minDoors}`);
  }

  return {
    stay: 1 / doors,
    switch: (doors - 1) / doors
  };
}

export function createTrial(input = {}) {
  const nDoors = toInteger(input.nDoors ?? DEFAULT_CONFIG.nDoors);
  const strategy = input.strategy ?? STRATEGIES.stay;
  const source = normalizeSource(input.source ?? TRIAL_SOURCES.batch);
  const rng = input.rng ?? Math.random;

  if (!isValidDoorCount(nDoors)) {
    throw new RangeError(`nDoors must be between ${LIMITS.minDoors} and ${LIMITS.maxDoors}`);
  }

  if (!Object.values(STRATEGIES).includes(strategy)) {
    throw new RangeError('strategy must be stay or switch');
  }

  const carDoor = randomInt(nDoors, rng);
  const firstChoice = randomInt(nDoors, rng);
  const montyChoice = firstChoice === carDoor
    ? chooseDoorExcept(nDoors, firstChoice, rng)
    : carDoor;
  const finalChoice = strategy === STRATEGIES.switch ? montyChoice : firstChoice;

  return createTrialRecord({
    source,
    nDoors,
    strategy,
    carDoor,
    firstChoice,
    montyChoice,
    finalChoice
  });
}

export function createPlayGame(input = {}) {
  const nDoors = toInteger(input.nDoors ?? DEFAULT_CONFIG.nDoors);
  const rng = input.rng ?? Math.random;

  if (!isValidDoorCount(nDoors)) {
    throw new RangeError(`nDoors must be between ${LIMITS.minDoors} and ${LIMITS.maxDoors}`);
  }

  return {
    state: PLAY_STATES.choosingFirst,
    nDoors,
    carDoor: randomInt(nDoors, rng),
    firstChoice: null,
    montyChoice: null,
    finalChoice: null,
    win: null
  };
}

export function choosePlayFirstDoor(game, firstChoiceInput, input = {}) {
  const firstChoice = toInteger(firstChoiceInput);
  const rng = input.rng ?? Math.random;

  assertPlayState(game, PLAY_STATES.choosingFirst);
  assertDoorIndex(game.nDoors, firstChoice);

  const montyChoice = firstChoice === game.carDoor
    ? chooseDoorExcept(game.nDoors, firstChoice, rng)
    : game.carDoor;

  return {
    ...game,
    state: PLAY_STATES.choosingFinal,
    firstChoice,
    montyChoice
  };
}

export function finishPlayGame(game, finalChoiceInput) {
  const finalChoice = toInteger(finalChoiceInput);

  assertPlayState(game, PLAY_STATES.choosingFinal);
  assertDoorIndex(game.nDoors, finalChoice);

  if (finalChoice !== game.firstChoice && finalChoice !== game.montyChoice) {
    throw new RangeError('final choice must be the first choice or the door Monty left');
  }

  const strategy = finalChoice === game.firstChoice ? STRATEGIES.stay : STRATEGIES.switch;
  const trial = createTrialRecord({
    source: TRIAL_SOURCES.play,
    nDoors: game.nDoors,
    strategy,
    carDoor: game.carDoor,
    firstChoice: game.firstChoice,
    montyChoice: game.montyChoice,
    finalChoice
  });

  return {
    game: {
      ...game,
      state: PLAY_STATES.finished,
      finalChoice,
      win: trial.win
    },
    trial
  };
}

export function getOpenedDoorIndexes(gameOrTrial) {
  if (gameOrTrial.firstChoice === null || gameOrTrial.montyChoice === null) {
    return [];
  }

  const opened = [];

  for (let index = 0; index < gameOrTrial.nDoors; index += 1) {
    if (index !== gameOrTrial.firstChoice && index !== gameOrTrial.montyChoice) {
      opened.push(index);
    }
  }

  return opened;
}

export async function simulateTrials(input = {}, options = {}) {
  const validation = validateConfig(input);

  if (!validation.ok) {
    throw new RangeError('Invalid simulation configuration');
  }

  const { nDoors, trials } = validation.config;
  const mode = validation.config.mode;
  const strategies = strategiesForMode(mode);
  const rng = options.rng ?? Math.random;
  const totalTrials = trials * strategies.length;
  const chunkSize = Math.max(1, Math.floor(options.chunkSize ?? totalTrials));
  const yieldToEventLoop = options.yieldToEventLoop ?? false;
  const signal = options.signal;
  const log = new CompactTrialLog(totalTrials, nDoors);
  let stayWins = 0;
  let switchWins = 0;
  let stayTrials = 0;
  let switchTrials = 0;
  let completed = 0;

  for (let trialIndex = 0; trialIndex < trials; trialIndex += 1) {
    for (const strategy of strategies) {
      if (signal?.aborted) {
        return result({ nDoors, trials, mode, totalTrials, completed, stayTrials, switchTrials, stayWins, switchWins, canceled: true, log });
      }

      const trial = createTrial({ nDoors, strategy, source: TRIAL_SOURCES.batch, rng });
      log.append(trial);
      completed += 1;

      if (strategy === STRATEGIES.stay) {
        stayTrials += 1;

        if (trial.win) {
          stayWins += 1;
        }
      } else {
        switchTrials += 1;

        if (trial.win) {
          switchWins += 1;
        }
      }

      if (completed % chunkSize === 0 || completed === totalTrials) {
        options.onProgress?.({
          nDoors,
          trials,
          mode,
          totalTrials,
          completed,
          stayTrials,
          switchTrials,
          stayWins,
          switchWins,
          ratio: completed / totalTrials
        });

        if (yieldToEventLoop && completed < totalTrials) {
          await waitForFrame();
        }
      }
    }
  }

  return result({ nDoors, trials, mode, totalTrials, completed, stayTrials, switchTrials, stayWins, switchWins, canceled: false, log });
}

export function summarizeStats(input = {}) {
  const nDoors = toInteger(input.nDoors);
  const trials = toInteger(input.trials);
  const mode = normalizeMode(input.mode ?? DEFAULT_CONFIG.mode);
  const strategies = strategiesForMode(mode);
  const rates = theoreticalRates(nDoors);
  const stayTrials = input.stayTrials ?? (strategies.includes(STRATEGIES.stay) ? trials : 0);
  const switchTrials = input.switchTrials ?? (strategies.includes(STRATEGIES.switch) ? trials : 0);
  const stayExpectedWins = stayTrials * rates.stay;
  const switchExpectedWins = switchTrials * rates.switch;
  const stay = stayTrials > 0 ? summarizeStrategy(input.stayWins, stayTrials, stayExpectedWins) : null;
  const switchStrategy = switchTrials > 0 ? summarizeStrategy(input.switchWins, switchTrials, switchExpectedWins) : null;
  const comparison = createComparison(stay, switchStrategy);

  return {
    nDoors,
    trials,
    mode,
    filter: RESULT_FILTERS.all,
    totalTrials: stayTrials + switchTrials,
    observed: {
      stay,
      switch: switchStrategy,
      comparison
    },
    theory: {
      stayRate: rates.stay,
      switchRate: rates.switch,
      stayExpectedWins,
      switchExpectedWins,
      bayesStayNumerator: 1 / nDoors,
      bayesSwitchNumerator: (nDoors - 1) / nDoors
    }
  };
}

export function summarizeLog(log, filter = RESULT_FILTERS.all) {
  const view = log.filter(filter);
  const counts = {
    [STRATEGIES.stay]: { wins: 0, trials: 0, expectedWins: 0 },
    [STRATEGIES.switch]: { wins: 0, trials: 0, expectedWins: 0 }
  };
  const nDoorValues = new Set();

  for (let index = 0; index < view.length; index += 1) {
    const row = view.get(index);
    const bucket = counts[row.strategy];
    const rates = theoreticalRates(row.nDoors);

    bucket.trials += 1;
    bucket.expectedWins += rates[row.strategy];
    bucket.wins += row.win ? 1 : 0;
    nDoorValues.add(row.nDoors);
  }

  const stay = counts.stay.trials > 0
    ? summarizeStrategy(counts.stay.wins, counts.stay.trials, counts.stay.expectedWins)
    : null;
  const switchStrategy = counts.switch.trials > 0
    ? summarizeStrategy(counts.switch.wins, counts.switch.trials, counts.switch.expectedWins)
    : null;

  return {
    nDoors: nDoorValues.size === 1 ? [...nDoorValues][0] : null,
    trials: view.length,
    filter: normalizeFilter(filter),
    totalTrials: view.length,
    observed: {
      stay,
      switch: switchStrategy,
      comparison: createComparison(stay, switchStrategy)
    },
    theory: {
      stayRate: stay ? stay.theoreticalRate : null,
      switchRate: switchStrategy ? switchStrategy.theoreticalRate : null,
      stayExpectedWins: counts.stay.expectedWins,
      switchExpectedWins: counts.switch.expectedWins
    }
  };
}

export function strategiesForMode(mode) {
  const normalized = normalizeMode(mode);

  if (normalized === SIMULATION_MODES.stay) {
    return [STRATEGIES.stay];
  }

  if (normalized === SIMULATION_MODES.switch) {
    return [STRATEGIES.switch];
  }

  return [STRATEGIES.stay, STRATEGIES.switch];
}

function createTrialRecord(values) {
  return {
    source: normalizeSource(values.source),
    nDoors: values.nDoors,
    strategy: values.strategy,
    carDoor: values.carDoor,
    firstChoice: values.firstChoice,
    montyChoice: values.montyChoice,
    openedDoorCount: values.nDoors - 2,
    finalChoice: values.finalChoice,
    win: values.finalChoice === values.carDoor
  };
}

function normalizeMode(mode) {
  return Object.values(SIMULATION_MODES).includes(mode) ? mode : DEFAULT_CONFIG.mode;
}

function normalizeSource(source) {
  return Object.values(TRIAL_SOURCES).includes(source) ? source : TRIAL_SOURCES.batch;
}

function normalizeFilter(filter) {
  return Object.values(RESULT_FILTERS).includes(filter) ? filter : RESULT_FILTERS.all;
}

function result(values) {
  return {
    ...values,
    summary: summarizeStats(values)
  };
}

function summarizeStrategy(winsInput, trials, expectedWinsInput) {
  const wins = toInteger(winsInput);
  const expectedWins = Number(expectedWinsInput);
  const losses = trials - wins;
  const winRate = wins / trials;
  const theoreticalRate = expectedWins / trials;
  const standardError = Math.sqrt((winRate * (1 - winRate)) / trials);
  const margin = 1.96 * standardError;

  return {
    trials,
    wins,
    losses,
    winRate,
    theoreticalRate,
    rateDifference: winRate - theoreticalRate,
    standardError,
    confidence95: {
      low: clamp(winRate - margin, 0, 1),
      high: clamp(winRate + margin, 0, 1)
    },
    expectedWins,
    expectedDifference: wins - expectedWins
  };
}

function createComparison(stay, switchStrategy) {
  return stay && switchStrategy
    ? {
      rateGap: switchStrategy.winRate - stay.winRate,
      relativeMultiplier: stay.winRate > 0 ? switchStrategy.winRate / stay.winRate : Number.POSITIVE_INFINITY
    }
    : null;
}

function isValidDoorCount(nDoors) {
  return Number.isInteger(nDoors) && nDoors >= LIMITS.minDoors && nDoors <= LIMITS.maxDoors;
}

function assertPlayState(game, expectedState) {
  if (!game || game.state !== expectedState) {
    throw new RangeError(`play game must be in ${expectedState} state`);
  }
}

function assertDoorIndex(nDoors, index) {
  if (!Number.isInteger(index) || index < 0 || index >= nDoors) {
    throw new RangeError('door index out of range');
  }
}

function toInteger(value) {
  const text = String(value).trim();

  if (!/^\d+$/.test(text)) {
    return Number.NaN;
  }

  const number = Number(text);
  return Number.isSafeInteger(number) ? number : Number.NaN;
}

function randomInt(maxExclusive, rng) {
  return Math.min(maxExclusive - 1, Math.floor(rng() * maxExclusive));
}

function chooseDoorExcept(nDoors, excludedDoor, rng) {
  const offset = randomInt(nDoors - 1, rng);
  return offset >= excludedDoor ? offset + 1 : offset;
}

function growUint8(array, length) {
  const next = new Uint8Array(length);
  next.set(array);
  return next;
}

function growUint16(array, length) {
  const next = new Uint16Array(length);
  next.set(array);
  return next;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampInteger(value, min, max) {
  const number = Number.isFinite(value) ? Math.floor(value) : min;
  return Math.min(max, Math.max(min, number));
}

function waitForFrame() {
  if (typeof requestAnimationFrame === 'function') {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  return new Promise((resolve) => setTimeout(resolve, 0));
}
