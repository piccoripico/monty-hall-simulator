import { expect, test } from '@playwright/test';

test('starts on Play, shows the shared controls, and keeps local storage empty', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('tab-play')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('tab-batch')).toHaveAttribute('aria-selected', 'false');
  await expect(page.getByRole('heading', { name: 'Play mode' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Simulation results' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trial list' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'About' })).toHaveCount(0);
  await expect(page.getByText('A browser-based Monty Hall simulator')).toBeVisible();
  await expect(page.getByRole('link', { name: 'GitHub repository' })).toHaveAttribute(
    'href',
    'https://github.com/piccoripico/monty-hall-simulator'
  );
  await expect(page.getByTestId('play-door-input')).toHaveValue('3');
  await expect(page.getByTestId('filter-all')).toBeChecked();
  await expect(page.getByRole('columnheader', { name: 'Mode' })).toBeVisible();
  await expect(page.getByTestId('door-board-panel')).toBeVisible();
  await expect(page.getByTestId('door-board')).toBeVisible();

  const layout = await page.evaluate(() => {
    const tabs = document.querySelector('.tab-list').getBoundingClientRect();
    const mode = document.querySelector('.mode-panel:not([hidden])').getBoundingClientRect();
    const results = document.querySelector('.results-panel').getBoundingClientRect();
    const board = document.querySelector('.door-board-panel').getBoundingClientRect();
    const log = document.querySelector('.log-panel').getBoundingClientRect();

    return {
      tabsTop: tabs.top,
      shellActiveTab: document.querySelector('.app-shell').dataset.activeTab,
      modeLeft: mode.left,
      modeRight: mode.right,
      modeWidth: mode.width,
      modeTop: mode.top,
      resultsLeft: results.left,
      resultsRight: results.right,
      resultsWidth: results.width,
      resultsTop: results.top,
      boardLeft: board.left,
      boardRight: board.right,
      boardTop: board.top,
      logLeft: log.left,
      logRight: log.right,
      logTop: log.top
    };
  });

  expect(layout.shellActiveTab).toBe('play');
  expect(layout.modeLeft).toBeLessThan(layout.resultsLeft);
  expect(layout.modeRight).toBeLessThanOrEqual(layout.resultsLeft + 24);
  expect(layout.resultsWidth).toBeGreaterThan(layout.modeWidth);
  expect(Math.abs(layout.modeTop - layout.resultsTop)).toBeLessThan(8);
  expect(layout.boardTop).toBeGreaterThan(layout.modeTop);
  expect(layout.boardLeft).toBeLessThanOrEqual(layout.modeLeft + 2);
  expect(layout.boardRight).toBeGreaterThan(layout.resultsRight - 2);
  expect(layout.logTop).toBeGreaterThan(layout.boardTop);
  expect(layout.logLeft).toBeLessThanOrEqual(layout.modeLeft + 2);
  expect(layout.logRight).toBeGreaterThan(layout.resultsLeft);

  const playDoorWidth = await page.getByTestId('play-door-input').evaluate((node) => node.getBoundingClientRect().width);
  await page.getByTestId('tab-batch').click();
  const batchDoorWidth = await page.getByTestId('door-input').evaluate((node) => node.getBoundingClientRect().width);
  expect(Math.abs(playDoorWidth - batchDoorWidth)).toBeLessThanOrEqual(1);
  await page.getByTestId('tab-play').click();

  const storageState = await page.evaluate(() => ({
    localStorageLength: localStorage.length,
    sessionStorageLength: sessionStorage.length,
    cookie: document.cookie
  }));

  expect(storageState).toEqual({
    localStorageLength: 0,
    sessionStorageLength: 0,
    cookie: ''
  });
});

test('plays one manual game and appends a Play row to the shared trial list', async ({ page }) => {
  await page.goto('/');
  await playOneRound(page);

  await expect(page.getByTestId('log-meta')).toContainText('1');
  await expect(page.locator('[data-row-index="0"]')).toContainText('Play');
  await expect(page.locator('[data-row-index="0"]')).toContainText(/Stay|Switch/);
  await expect(page.getByTestId('results-grid')).toContainText('Observed win rate');
});

test('runs Batch after Play and filters results and trial rows together', async ({ page }) => {
  await page.goto('/');
  await playOneRound(page);

  await page.getByTestId('tab-batch').click();
  await expect(page.getByTestId('door-board-panel')).toBeHidden();

  const batchLayout = await page.evaluate(() => {
    const mode = document.querySelector('.mode-panel:not([hidden])').getBoundingClientRect();
    const results = document.querySelector('.results-panel').getBoundingClientRect();
    const log = document.querySelector('.log-panel').getBoundingClientRect();
    return {
      shellActiveTab: document.querySelector('.app-shell').dataset.activeTab,
      modeLeft: mode.left,
      modeWidth: mode.width,
      resultsLeft: results.left,
      resultsWidth: results.width,
      modeTop: mode.top,
      resultsTop: results.top,
      logTop: log.top
    };
  });

  expect(batchLayout.shellActiveTab).toBe('batch');
  expect(batchLayout.modeLeft).toBeLessThan(batchLayout.resultsLeft);
  expect(batchLayout.resultsWidth).toBeGreaterThan(batchLayout.modeWidth);
  expect(Math.abs(batchLayout.modeTop - batchLayout.resultsTop)).toBeLessThan(8);
  expect(batchLayout.logTop).toBeGreaterThan(batchLayout.modeTop);

  await page.getByTestId('run-button').click();

  await expect(page.getByTestId('status')).toContainText('200');
  await expect(page.getByTestId('log-meta')).toContainText('201');
  await expect(page.locator('[data-row-index="0"]')).toContainText('Play');
  await expect(page.locator('[data-row-index="1"]')).toContainText('Batch');

  await page.getByTestId('filter-play').check();
  await expect(page.getByTestId('log-meta')).toContainText('1 of 201');
  await expect(page.locator('[data-row-index="0"]')).toContainText('Play');
  await expect(page.locator('[data-row-index="1"]')).toHaveCount(0);
  await expect(page.getByTestId('results-grid')).toContainText('Observed win rate');

  await page.getByTestId('filter-batch').check();
  await expect(page.getByTestId('log-meta')).toContainText('200 of 201');
  await expect(page.locator('[data-row-index="1"]')).toContainText('Batch');
  await expect(page.getByTestId('results-grid').getByRole('heading', { name: 'Stay' })).toBeVisible();
  await expect(page.getByTestId('results-grid').getByRole('heading', { name: 'Switch' })).toBeVisible();
});

test('uses a compact door grid for larger Play door counts', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('play-door-input').fill('80');
  await page.getByTestId('play-new-button').click();

  await expect(page.getByTestId('door-grid')).toHaveClass(/compact/);
  await expect(page.locator('[data-door-index]')).toHaveCount(80);

  const boardMetrics = await page.getByTestId('door-board').evaluate((node) => ({
    clientHeight: node.clientHeight,
    scrollHeight: node.scrollHeight,
    overflowY: getComputedStyle(node).overflowY
  }));

  expect(boardMetrics.clientHeight).toBeLessThanOrEqual(530);
  expect(boardMetrics.scrollHeight).toBeGreaterThan(boardMetrics.clientHeight);
  expect(boardMetrics.overflowY).toBe('auto');
});

test('exports an xlsx workbook and clears the shared results', async ({ page }) => {
  await page.goto('/');
  await playOneRound(page);

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-button').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/monty-hall-simulator-v1\.0\.0-.+\.xlsx$/);

  await page.getByTestId('clear-button').click();
  await expect(page.getByTestId('log-meta')).toBeEmpty();
  await expect(page.getByTestId('trial-log-body')).toContainText('Run the simulation to fill the trial list.');
  await expect(page.getByTestId('export-button')).toBeDisabled();
});

test('renders Bayes formulas with KaTeX after the v0.2 layout changes', async ({ page }) => {
  await page.goto('/');

  await page.locator('[data-testid="theory-details"] summary').click();
  await expect(page.getByTestId('theory-rates')).toContainText('stay = 1 / n');
  await expect(page.getByTestId('bayes-formula').locator('.katex')).toHaveCount(5);
});

test('keeps Play controls usable on a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 820 });
  await page.goto('/');

  await expect(page.getByTestId('tab-play')).toBeVisible();
  await expect(page.getByTestId('tab-batch')).toBeVisible();
  await expect(page.getByTestId('door-board-panel')).toBeVisible();
  await expect(page.getByTestId('door-board')).toBeVisible();
  await expect(page.locator('[data-door-index]')).toHaveCount(3);

  await expectNoPageHorizontalOverflow(page);

  await playOneRound(page);
  await expect(page.getByTestId('log-meta')).toContainText('1');
  await expect(page.getByTestId('results-grid')).toContainText('Observed win rate');
  await expectNoPageHorizontalOverflow(page);

  await page.setViewportSize({ width: 320, height: 820 });
  await expectNoPageHorizontalOverflow(page);
});

async function playOneRound(page) {
  await page.locator('[data-door-index="0"]').click();
  await expect(page.getByTestId('play-status')).toContainText('Monty opened');

  const finalChoices = page.locator('#doorGrid button:not([disabled])');
  await expect(finalChoices).toHaveCount(2);
  await finalChoices.nth(1).click();
  await expect(page.getByTestId('play-status')).toContainText(/prize|missed/);
  await expect(page.locator('.door-card.prize .door-visual')).toBeVisible();

  const prizeMarker = await page.locator('.door-card.prize .door-visual').evaluate((node) => (
    getComputedStyle(node, '::before').content
  ));
  expect(prizeMarker).toContain('★');
}

async function expectNoPageHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const scroller = document.querySelector('#trialLogScroller');

    return {
      viewportWidth: root.clientWidth,
      pageScrollWidth: root.scrollWidth,
      logClientWidth: scroller.clientWidth,
      logScrollWidth: scroller.scrollWidth
    };
  });

  expect(metrics.pageScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
  expect(metrics.logScrollWidth).toBeGreaterThan(metrics.logClientWidth);
}
