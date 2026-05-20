import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CompactTrialLog,
  DEFAULT_CONFIG,
  LIMITS,
  PLAY_STATES,
  RESULT_FILTERS,
  SIMULATION_MODES,
  STRATEGIES,
  TRIAL_SOURCES,
  choosePlayFirstDoor,
  createPlayGame,
  createTrial,
  finishPlayGame,
  getOpenedDoorIndexes,
  simulateTrials,
  summarizeLog,
  summarizeStats,
  strategiesForMode,
  theoreticalRates,
  validateConfig
} from '../src/simulation.mjs';
import { createWorkbookData } from '../src/export-data.mjs';
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

describe('play game flow', () => {
  it('reveals losing doors after the first choice and records a switch win', () => {
    const game = createPlayGame({ nDoors: 4, rng: sequenceRng([0.6]) });
    assert.equal(game.state, PLAY_STATES.choosingFirst);
    assert.equal(game.carDoor, 2);

    const revealed = choosePlayFirstDoor(game, 0);
    assert.equal(revealed.state, PLAY_STATES.choosingFinal);
    assert.equal(revealed.firstChoice, 0);
    assert.equal(revealed.montyChoice, 2);
    assert.deepEqual(getOpenedDoorIndexes(revealed), [1, 3]);

    const { game: finished, trial } = finishPlayGame(revealed, 2);
    assert.equal(finished.state, PLAY_STATES.finished);
    assert.equal(trial.source, TRIAL_SOURCES.play);
    assert.equal(trial.strategy, STRATEGIES.switch);
    assert.equal(trial.win, true);
  });

  it('keeps Monty from opening the prize when the first choice is the prize', () => {
    const game = createPlayGame({ nDoors: 5, rng: sequenceRng([0]) });
    const revealed = choosePlayFirstDoor(game, 0, { rng: sequenceRng([0.5]) });

    assert.equal(revealed.firstChoice, revealed.carDoor);
    assert.notEqual(revealed.montyChoice, revealed.carDoor);
    assert.equal(getOpenedDoorIndexes(revealed).includes(revealed.carDoor), false);
    assert.equal(getOpenedDoorIndexes(revealed).length, 3);
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

  it('keeps source and door count per row and supports filtered views', () => {
    const log = new CompactTrialLog(1);
    log.append(createTrial({ nDoors: 3, strategy: STRATEGIES.stay, source: TRIAL_SOURCES.play, rng: sequenceRng([0, 0, 0]) }));
    log.append(createTrial({ nDoors: 10, strategy: STRATEGIES.switch, source: TRIAL_SOURCES.batch, rng: sequenceRng([0.5, 0]) }));

    assert.equal(log.length, 2);
    assert.equal(log.get(0).source, TRIAL_SOURCES.play);
    assert.equal(log.get(1).nDoors, 10);
    assert.equal(log.get(1).openedDoorCount, 8);

    const playRows = log.filter(RESULT_FILTERS.play);
    assert.equal(playRows.length, 1);
    assert.equal(playRows.get(0).index, 0);
    assert.equal(playRows.get(0).filteredIndex, 0);
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

describe('summarizeLog', () => {
  it('summarizes mixed Play and Batch rows through the common filters', () => {
    const log = new CompactTrialLog(4);
    log.append({
      source: TRIAL_SOURCES.play,
      nDoors: 3,
      strategy: STRATEGIES.stay,
      carDoor: 0,
      firstChoice: 0,
      montyChoice: 1,
      finalChoice: 0,
      win: true
    });
    log.append({
      source: TRIAL_SOURCES.play,
      nDoors: 4,
      strategy: STRATEGIES.switch,
      carDoor: 2,
      firstChoice: 0,
      montyChoice: 2,
      finalChoice: 2,
      win: true
    });
    log.append({
      source: TRIAL_SOURCES.batch,
      nDoors: 10,
      strategy: STRATEGIES.stay,
      carDoor: 9,
      firstChoice: 1,
      montyChoice: 9,
      finalChoice: 1,
      win: false
    });

    const all = summarizeLog(log, RESULT_FILTERS.all);
    const play = summarizeLog(log, RESULT_FILTERS.play);
    const batch = summarizeLog(log, RESULT_FILTERS.batch);

    assert.equal(all.totalTrials, 3);
    assert.equal(all.observed.stay.trials, 2);
    assert.equal(all.observed.switch.trials, 1);
    assert.equal(all.theory.stayExpectedWins, (1 / 3) + (1 / 10));
    assert.equal(play.totalTrials, 2);
    assert.equal(play.observed.comparison.rateGap, 0);
    assert.equal(batch.totalTrials, 1);
    assert.equal(batch.observed.switch, null);
  });
});

describe('Excel export data', () => {
  it('creates summary and trial sheets from the shared log', () => {
    const log = new CompactTrialLog(1);
    log.append(createTrial({ nDoors: 3, strategy: STRATEGIES.switch, source: TRIAL_SOURCES.batch, rng: sequenceRng([0.8, 0]) }));

    const workbookData = createWorkbookData(log);

    assert.equal(workbookData.summary[0][0], 'Filter');
    assert.equal(workbookData.summary.length, 7);
    assert.equal(workbookData.trials[0][0], 'Mode');
    assert.equal(workbookData.trials[1][0], 'Batch');
    assert.equal(workbookData.trials[1][1], 1);
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
