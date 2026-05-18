import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CompactTrialLog,
  DEFAULT_CONFIG,
  LIMITS,
  SIMULATION_MODES,
  STRATEGIES,
  createTrial,
  simulateTrials,
  summarizeStats,
  strategiesForMode,
  theoreticalRates,
  validateConfig
} from '../src/simulation.mjs';
import { calculateVisibleRange } from '../src/virtual-log.mjs';

describe('simulation defaults and validation', () => {
  it('uses the planned initial values', () => {
    assert.deepEqual(DEFAULT_CONFIG, { nDoors: 3, trials: 100, mode: SIMULATION_MODES.both });
    assert.equal(LIMITS.maxTrials, 100000);
  });

  it('accepts integer-like input inside the configured limits', () => {
    const validation = validateConfig({ nDoors: '100', trials: '100000', mode: SIMULATION_MODES.switch });
    assert.equal(validation.ok, true);
    assert.deepEqual(validation.config, { nDoors: 100, trials: 100000, mode: SIMULATION_MODES.switch });
  });

  it('rejects values outside the configured limits', () => {
    assert.equal(validateConfig({ nDoors: LIMITS.minDoors - 1, trials: 100 }).ok, false);
    assert.equal(validateConfig({ nDoors: 3, trials: 100000 }).ok, true);
    assert.equal(validateConfig({ nDoors: 3, trials: 100001 }).ok, false);
    assert.equal(validateConfig({ nDoors: 3, trials: LIMITS.maxTrials + 1 }).ok, false);
    assert.equal(validateConfig({ nDoors: '3.5', trials: 100 }).ok, false);
    assert.equal(validateConfig({ nDoors: 3, trials: 100, mode: 'random' }).ok, false);
  });

  it('maps simulation modes to the strategies that should run', () => {
    assert.deepEqual(strategiesForMode(SIMULATION_MODES.switch), [STRATEGIES.switch]);
    assert.deepEqual(strategiesForMode(SIMULATION_MODES.stay), [STRATEGIES.stay]);
    assert.deepEqual(strategiesForMode(SIMULATION_MODES.both), [STRATEGIES.stay, STRATEGIES.switch]);
  });
});

describe('theoreticalRates', () => {
  it('returns the Monty Hall rates for any supported door count', () => {
    assert.deepEqual(theoreticalRates(100), {
      stay: 0.01,
      switch: 0.99
    });
  });
});

describe('createTrial', () => {
  it('records a procedural stay trial when the first choice is the prize', () => {
    const trial = createTrial({ nDoors: 3, strategy: STRATEGIES.stay, rng: sequenceRng([0, 0, 0]) });

    assert.equal(trial.carDoor, 0);
    assert.equal(trial.firstChoice, 0);
    assert.equal(trial.montyChoice, 1);
    assert.equal(trial.openedDoorCount, 1);
    assert.equal(trial.finalChoice, 0);
    assert.equal(trial.win, true);
  });

  it('records a procedural switch trial when the first choice is losing', () => {
    const trial = createTrial({ nDoors: 3, strategy: STRATEGIES.switch, rng: sequenceRng([0.8, 0]) });

    assert.equal(trial.carDoor, 2);
    assert.equal(trial.firstChoice, 0);
    assert.equal(trial.montyChoice, 2);
    assert.equal(trial.openedDoorCount, 1);
    assert.equal(trial.finalChoice, 2);
    assert.equal(trial.win, true);
  });

  it('never opens the prize and always opens n - 2 losing doors', () => {
    const trial = createTrial({ nDoors: 100, strategy: STRATEGIES.switch, rng: sequenceRng([0.42, 0.1]) });

    assert.equal(trial.montyChoice, trial.carDoor);
    assert.equal(trial.openedDoorCount, 98);
    assert.notEqual(trial.firstChoice, trial.montyChoice);
  });
});

describe('simulateTrials', () => {
  it('runs only switch trials when switch mode is selected', async () => {
    const result = await simulateTrials(
      { nDoors: 3, trials: 3, mode: SIMULATION_MODES.switch },
      { rng: sequenceRng([0, 0.5, 0.8, 0, 0.4, 0]) }
    );

    assert.equal(result.totalTrials, 3);
    assert.equal(result.completed, 3);
    assert.equal(result.stayTrials, 0);
    assert.equal(result.switchTrials, 3);
    assert.equal(result.log.length, 3);
    assert.equal(result.summary.observed.stay, null);
    assert.equal(result.summary.observed.switch.trials, 3);
    assert.equal(result.summary.observed.comparison, null);

    for (let index = 0; index < result.log.length; index += 1) {
      assert.equal(result.log.get(index).strategy, STRATEGIES.switch);
    }
  });

  it('runs only stay trials when stay mode is selected', async () => {
    const result = await simulateTrials(
      { nDoors: 3, trials: 3, mode: SIMULATION_MODES.stay },
      { rng: sequenceRng([0, 0, 0, 0.8, 0, 0.4, 0]) }
    );

    assert.equal(result.totalTrials, 3);
    assert.equal(result.completed, 3);
    assert.equal(result.stayTrials, 3);
    assert.equal(result.switchTrials, 0);
    assert.equal(result.log.length, 3);
    assert.equal(result.summary.observed.stay.trials, 3);
    assert.equal(result.summary.observed.switch, null);
    assert.equal(result.summary.observed.comparison, null);

    for (let index = 0; index < result.log.length; index += 1) {
      assert.equal(result.log.get(index).strategy, STRATEGIES.stay);
    }
  });

  it('runs stay and switch independently for the same number of trials', async () => {
    const result = await simulateTrials(
      { nDoors: 3, trials: 2, mode: SIMULATION_MODES.both },
      { rng: sequenceRng([0, 0, 0, 0.8, 0, 0.4, 0, 0, 0, 0]) }
    );

    assert.equal(result.trials, 2);
    assert.equal(result.totalTrials, 4);
    assert.equal(result.completed, 4);
    assert.equal(result.stayWins, 1);
    assert.equal(result.switchWins, 1);
    assert.equal(result.log.length, 4);
    assert.equal(result.log.get(0).strategy, STRATEGIES.stay);
    assert.equal(result.log.get(1).strategy, STRATEGIES.switch);
  });
});

describe('CompactTrialLog', () => {
  it('returns first, middle, and final rows from compact arrays', () => {
    const log = new CompactTrialLog(3, 10);
    log.append(createTrial({ nDoors: 10, strategy: STRATEGIES.stay, rng: sequenceRng([0, 0, 0]) }));
    log.append(createTrial({ nDoors: 10, strategy: STRATEGIES.switch, rng: sequenceRng([0.5, 0]) }));
    log.append(createTrial({ nDoors: 10, strategy: STRATEGIES.stay, rng: sequenceRng([0.9, 0.1]) }));

    assert.equal(log.get(0).index, 0);
    assert.equal(log.get(1).strategy, STRATEGIES.switch);
    assert.equal(log.get(2).openedDoorCount, 8);
    assert.equal(log.slice(1, 3).length, 2);
  });
});

describe('summarizeStats', () => {
  it('keeps observed results separate from theory values', () => {
    const summary = summarizeStats({
      nDoors: 3,
      trials: 100,
      mode: SIMULATION_MODES.both,
      stayWins: 34,
      switchWins: 66
    });

    assert.equal(summary.observed.stay.wins, 34);
    assert.equal(summary.observed.switch.wins, 66);
    assert.equal(summary.observed.stay.winRate, 0.34);
    assert.equal(summary.theory.stayRate, 1 / 3);
    assert.equal(summary.theory.switchRate, 2 / 3);
    assert.ok(Math.abs(summary.theory.stayExpectedWins - (100 / 3)) < Number.EPSILON * 100);
    assert.equal(summary.observed.comparison.rateGap, 0.32);
  });

  it('omits unexecuted strategies and comparison values', () => {
    const summary = summarizeStats({
      nDoors: 3,
      trials: 100,
      mode: SIMULATION_MODES.switch,
      switchWins: 68
    });

    assert.equal(summary.observed.stay, null);
    assert.equal(summary.observed.switch.trials, 100);
    assert.equal(summary.observed.switch.wins, 68);
    assert.equal(summary.observed.comparison, null);
  });
});

describe('calculateVisibleRange', () => {
  it('calculates ranges at the top, middle, and end of the log', () => {
    assert.deepEqual(calculateVisibleRange({
      totalRows: 1000,
      scrollTop: 0,
      viewportHeight: 420,
      rowHeight: 42,
      buffer: 2
    }), {
      start: 0,
      end: 12,
      topSpacerHeight: 0,
      bottomSpacerHeight: 41496
    });

    const middle = calculateVisibleRange({ totalRows: 1000, scrollTop: 4200, viewportHeight: 420, rowHeight: 42, buffer: 2 });
    assert.equal(middle.start, 98);
    assert.equal(middle.end, 112);

    const end = calculateVisibleRange({ totalRows: 1000, scrollTop: 42000, viewportHeight: 420, rowHeight: 42, buffer: 2 });
    assert.equal(end.end, 1000);
    assert.equal(end.bottomSpacerHeight, 0);
  });
});

function sequenceRng(values) {
  let index = 0;

  return () => {
    const value = values[index];
    index = (index + 1) % values.length;
    return value;
  };
}
