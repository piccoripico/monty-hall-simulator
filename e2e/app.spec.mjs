import { expect, test } from '@playwright/test';

test('starts on Play, shows the shared controls, and keeps local storage empty', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('tab-play')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('tab-batch')).toHaveAttribute('aria-selected', 'false');
  await expect(page.getByRole('heading', { name: 'Play mode' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Simulation results' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trial list' })).toBeVisible();
  await expect(page.getByTestId('play-door-input')).toHaveValue('3');
  await expect(page.getByTestId('filter-all')).toBeChecked();
  await expect(page.getByRole('columnheader', { name: 'Mode' })).toBeVisible();

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

  await page.getByTestId('play-door-input').fill('13');
  await page.getByTestId('play-new-button').click();

  await expect(page.getByTestId('door-grid')).toHaveClass(/compact/);
  await expect(page.locator('[data-door-index]')).toHaveCount(13);
});

test('exports an xlsx workbook and clears the shared results', async ({ page }) => {
  await page.goto('/');
  await playOneRound(page);

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-button').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/monty-hall-simulator-v0\.2\.0-.+\.xlsx$/);

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
  await expect(page.locator('[data-door-index]')).toHaveCount(3);

  await playOneRound(page);
  await expect(page.getByTestId('log-meta')).toContainText('1');
  await expect(page.getByTestId('results-grid')).toContainText('Observed win rate');
});

async function playOneRound(page) {
  await page.locator('[data-door-index="0"]').click();
  await expect(page.getByTestId('play-status')).toContainText('Monty opened');

  const finalChoices = page.locator('#doorGrid button:not([disabled])');
  await expect(finalChoices).toHaveCount(2);
  await finalChoices.nth(1).click();
  await expect(page.getByTestId('play-status')).toContainText(/prize|missed/);
}
