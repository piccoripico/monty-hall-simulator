import { expect, test } from '@playwright/test';

test.describe('initial Japanese experience', () => {
  test.use({ locale: 'ja-JP', viewport: { width: 1280, height: 800 } });

  test('uses the browser language, revised lead text, and the requested layout/order', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('モンティ');
    await expect(page.getByText('(1) モンティ・ホール問題では、複数のドア（3つ以上）のうち1つに当たりが隠れています。')).toBeVisible();
    await expect(page.getByText('(2) あなたは、最初にドアを1つ選びます')).toBeVisible();
    await expect(page.getByText('(3) 当たりを知っているモンティは、あなたが選んだドアと、もう1つドアを残して、はずれドアをすべて開けます。')).toBeVisible();
    await expect(page.getByText('つまり、残されたドア2つのうち1つが、当たりです。')).toBeVisible();
    await expect(page.getByText('このとき、あなたは、ドアの選択を変えるべきでしょうか？')).toBeVisible();
    await expect(page.getByText('――このとき')).toHaveCount(0);
    await expect(page.getByText('この回数を、選択した各戦略に適用します。')).toHaveCount(0);
    await expect(page.getByRole('contentinfo')).toHaveCount(0);

    await expect(page.getByRole('heading', { name: 'シミュレーション設定' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'シミュレーション結果' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '試行一覧' })).toBeVisible();
    await expect(page.getByTestId('language-select')).toHaveValue('ja');
    await expect(page.getByTestId('door-input')).toHaveValue('3');
    await expect(page.getByTestId('trial-input')).toHaveValue('100');
    await expect(page.getByTestId('trial-input')).toHaveAttribute('max', '100000');
    await expect(page.getByTestId('mode-both')).toBeChecked();
    await expect(page.getByTestId('mode-fieldset')).toContainText('モンティがはずれドアを開けた後、ドアの選択を変えない');
    await expect(page.getByTestId('mode-fieldset')).toContainText('モンティがはずれドアを開けた後、ドアの選択を変える');
    await expect(page.getByRole('columnheader', { name: '開けたはずれドア数' })).toBeVisible();

    const uiState = await page.evaluate(() => {
      const controls = document.querySelector('.control-panel').getBoundingClientRect();
      const results = document.querySelector('.results-panel').getBoundingClientRect();
      const log = document.querySelector('.log-panel').getBoundingClientRect();
      const title = document.querySelector('h1');
      return {
        modeOrder: [...document.querySelectorAll('input[name="simulationMode"]')].map((input) => input.value),
        titleFontSize: Number.parseFloat(getComputedStyle(title).fontSize),
        layout: {
          controlsLeft: controls.left,
          resultsLeft: results.left,
          controlsTop: controls.top,
          resultsTop: results.top,
          logTop: log.top
        }
      };
    });

    expect(uiState.modeOrder).toEqual(['stay', 'switch', 'both']);
    expect(uiState.titleFontSize).toBeLessThanOrEqual(54);
    expect(uiState.layout.controlsLeft).toBeLessThan(uiState.layout.resultsLeft);
    expect(Math.abs(uiState.layout.controlsTop - uiState.layout.resultsTop)).toBeLessThan(8);
    expect(uiState.layout.logTop).toBeGreaterThan(uiState.layout.controlsTop);

    await page.getByTestId('run-button').click();

    await expect(page.getByTestId('status')).toContainText('200');
    await expect(page.getByTestId('results-grid')).toContainText('観測勝率');
    await expect(page.getByTestId('comparison-summary')).toContainText('変える - 変えない');
    await expect(page.getByTestId('log-meta')).toContainText('200');
    await expect(page.locator('[data-row-index="0"]')).toContainText('変えない');
    await expect(page.locator('[data-row-index="1"]')).toContainText('変える');
  });
});

test('rejects more than 100,000 trials per selected strategy', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('language-select').selectOption('ja');
  await page.getByTestId('trial-input').fill('100001');
  await page.getByTestId('run-button').click();

  await expect(page.getByTestId('error-message')).toContainText('選択した戦略ごとの試行回数は1から100,000の間にしてください。');
  await expect(page.getByTestId('status')).toContainText('強調表示された設定を修正してください。');
});

test('runs switch-only mode without stay cards or comparison values', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('mode-switch').check();
  await page.getByTestId('run-button').click();

  await expect(page.getByTestId('status')).toContainText('100');
  await expect(page.getByTestId('log-meta')).toContainText('100');
  await expect(page.getByTestId('results-grid').getByRole('heading', { name: 'Switch' })).toBeVisible();
  await expect(page.getByTestId('results-grid').getByRole('heading', { name: 'Stay' })).toHaveCount(0);
  await expect(page.getByTestId('comparison-summary')).toBeEmpty();
  await expect(page.locator('[data-row-index="0"]')).toContainText('Switch');
});

test('runs stay-only mode without switch cards or comparison values', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('mode-stay').check();
  await page.getByTestId('run-button').click();

  await expect(page.getByTestId('status')).toContainText('100');
  await expect(page.getByTestId('log-meta')).toContainText('100');
  await expect(page.getByTestId('results-grid').getByRole('heading', { name: 'Stay' })).toBeVisible();
  await expect(page.getByTestId('results-grid').getByRole('heading', { name: 'Switch' })).toHaveCount(0);
  await expect(page.getByTestId('comparison-summary')).toBeEmpty();
  await expect(page.locator('[data-row-index="0"]')).toContainText('Stay');
});

test('runs both strategies and shows all trial rows through virtual scrolling without pagination', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('trial-input').fill('600');
  await page.getByTestId('run-button').click();

  await expect(page.getByTestId('status')).toContainText('1,200');
  await expect(page.getByTestId('log-meta')).toContainText('1,200');
  await expect(page.getByTestId('comparison-summary')).toContainText('Switch minus stay');
  await expect(page.getByText(/page|ページ|Seite/i)).toHaveCount(0);

  await page.getByTestId('trial-log-scroller').evaluate((node) => {
    node.scrollTop = node.scrollHeight;
    node.dispatchEvent(new Event('scroll'));
  });

  await expect(page.locator('[data-row-index="1199"]')).toBeVisible();
});

test('keeps theory out of the main cards and renders Bayes formulas with KaTeX', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('run-button').click();
  await expect(page.getByTestId('results-grid')).toContainText('Observed win rate');
  await expect(page.getByTestId('results-grid')).not.toContainText('Theoretical win rate');

  await page.locator('[data-testid="theory-details"] summary').click();
  await expect(page.getByText('Standard rule: Monty knows the prize door')).toHaveCount(0);
  await expect(page.getByTestId('theory-rates')).toContainText('stay = 1 / n');
  await expect(page.getByTestId('theory-stats')).toContainText('Theoretical win rate');
  await expect(page.getByTestId('bayes-formula').locator('.katex')).toHaveCount(5);
  await expect(page.getByTestId('bayes-formula')).toContainText('Bayes theorem');
});

test('updates the page language without writing local browser storage', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('run-button').click();
  await page.getByTestId('language-select').selectOption('de');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Monty-Hall');
  await expect(page.getByRole('heading', { name: 'Simulationsergebnisse' })).toBeVisible();
  await expect(page.getByTestId('results-grid')).toContainText('Beobachtete Gewinnrate');
  await expect(page.getByTestId('trial-log-body')).toContainText('Nicht wechseln');

  await page.locator('[data-testid="theory-details"] summary').click();
  await expect(page.locator('[data-testid="theory-details"] summary')).toContainText('Ergänzung');
  await expect(page.getByTestId('theory-rates')).toContainText('Theoretische Gewinnraten');

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
