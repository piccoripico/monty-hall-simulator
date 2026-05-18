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

const STRATEGY_TO_CODE = Object.freeze({
  [STRATEGIES.stay]: 0,
  [STRATEGIES.switch]: 1
});

const CODE_TO_STRATEGY = Object.freeze([
  STRATEGIES.stay,
  STRATEGIES.switch
]);

export class CompactTrialLog {
  constructor(totalRows, nDoors) {
    if (!Number.isSafeInteger(totalRows) || totalRows < 0) {
      throw new RangeError('totalRows must be a non-negative safe integer');
    }

    this.nDoors = nDoors;
    this.capacity = totalRows;
    this.length = 0;
    this.strategies = new Uint8Array(totalRows);
    this.carDoors = new Uint16Array(totalRows);
    this.firstChoices = new Uint16Array(totalRows);
    this.montyChoices = new Uint16Array(totalRows);
    this.finalChoices = new Uint16Array(totalRows);
    this.wins = new Uint8Array(totalRows);
  }

  append(trial) {
    if (this.length >= this.capacity) {
      throw new RangeError('trial log capacity exceeded');
    }

    const row = this.length;
    this.strategies[row] = STRATEGY_TO_CODE[trial.strategy];
    this.carDoors[row] = trial.carDoor;
    this.firstChoices[row] = trial.firstChoice;
    this.montyChoices[row] = trial.montyChoice;
    this.finalChoices[row] = trial.finalChoice;
    this.wins[row] = trial.win ? 1 : 0;
    this.length += 1;
    return row;
  }

  get(index) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.length) {
      throw new RangeError('trial log index out of range');
    }

    return {
      index,
      strategy: CODE_TO_STRATEGY[this.strategies[index]],
      carDoor: this.carDoors[index],
      firstChoice: this.firstChoices[index],
      montyChoice: this.montyChoices[index],
      openedDoorCount: this.nDoors - 2,
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
}

export function validateConfig(input = {}) {
  const nDoors = toInteger(input.nDoors);
  const trials = toInteger(input.trials);
  const rawMode = input.mode ?? DEFAULT_CONFIG.mode;
  const mode = normalizeMode(rawMode);
  const errors = {};

  if (!Number.isInteger(nDoors) || nDoors < LIMITS.minDoors || nDoors > LIMITS.maxDoors) {
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
  const rng = input.rng ?? Math.random;

  if (!Number.isInteger(nDoors) || nDoors < LIMITS.minDoors) {
    throw new RangeError(`nDoors must be at least ${LIMITS.minDoors}`);
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

  return {
    nDoors,
    strategy,
    carDoor,
    firstChoice,
    montyChoice,
    openedDoorCount: nDoors - 2,
    finalChoice,
    win: finalChoice === carDoor
  };
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

      const trial = createTrial({ nDoors, strategy, rng });
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
  const stay = stayTrials > 0 ? summarizeStrategy(input.stayWins, stayTrials, rates.stay) : null;
  const switchStrategy = switchTrials > 0 ? summarizeStrategy(input.switchWins, switchTrials, rates.switch) : null;
  const comparison = stay && switchStrategy
    ? {
      rateGap: switchStrategy.winRate - stay.winRate,
      relativeMultiplier: stay.winRate > 0 ? switchStrategy.winRate / stay.winRate : Number.POSITIVE_INFINITY
    }
    : null;

  return {
    nDoors,
    trials,
    mode,
    totalTrials: stayTrials + switchTrials,
    observed: {
      stay,
      switch: switchStrategy,
      comparison
    },
    theory: {
      stayRate: rates.stay,
      switchRate: rates.switch,
      stayExpectedWins: trials * rates.stay,
      switchExpectedWins: trials * rates.switch,
      bayesStayNumerator: 1 / nDoors,
      bayesSwitchNumerator: (nDoors - 1) / nDoors
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

function normalizeMode(mode) {
  return Object.values(SIMULATION_MODES).includes(mode) ? mode : DEFAULT_CONFIG.mode;
}

function result(values) {
  return {
    ...values,
    summary: summarizeStats(values)
  };
}

function summarizeStrategy(winsInput, trials, theoreticalRate) {
  const wins = toInteger(winsInput);
  const losses = trials - wins;
  const winRate = wins / trials;
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
    expectedWins: trials * theoreticalRate,
    expectedDifference: wins - trials * theoreticalRate
  };
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
