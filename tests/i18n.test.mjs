import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  createTranslator,
  detectLanguage,
  normalizeLanguage,
  translations
} from '../src/i18n.mjs';

describe('language detection', () => {
  it('detects the first supported browser language', () => {
    assert.equal(detectLanguage(['ja-JP', 'en-US']), 'ja');
    assert.equal(detectLanguage(['pt-BR', 'fr-FR']), 'fr');
  });

  it('normalizes simplified and traditional Chinese regions', () => {
    assert.equal(normalizeLanguage('zh-CN'), 'zh-Hans');
    assert.equal(normalizeLanguage('zh-SG'), 'zh-Hans');
    assert.equal(normalizeLanguage('zh-TW'), 'zh-Hant');
    assert.equal(normalizeLanguage('zh-HK'), 'zh-Hant');
  });

  it('falls back to English for unsupported languages', () => {
    assert.equal(detectLanguage(['pt-BR']), DEFAULT_LANGUAGE);
  });
});

describe('translations', () => {
  it('has the planned language set', () => {
    assert.deepEqual(SUPPORTED_LANGUAGES, ['en', 'fr', 'es', 'de', 'ja', 'zh-Hans', 'zh-Hant', 'ko']);
  });

  it('keeps every translation dictionary complete', () => {
    const englishKeys = Object.keys(translations.en).sort();

    for (const language of SUPPORTED_LANGUAGES) {
      assert.deepEqual(Object.keys(translations[language]).sort(), englishKeys, language);
    }
  });

  it('includes the current lead, simulation mode, supplement, trial list, and Bayes keys', () => {
    const requiredKeys = [
      'app.lead1',
      'app.lead2',
      'app.lead3',
      'app.leadQuestion',
      'footer.description',
      'footer.githubLink',
      'tabs.play',
      'tabs.batch',
      'play.title',
      'play.chooseFirst',
      'play.chooseFinal',
      'play.doorPrize',
      'play.doorLosing',
      'batch.title',
      'config.mode',
      'config.modeSwitch',
      'config.modeStay',
      'config.modeBoth',
      'results.filter',
      'filter.all',
      'filter.play',
      'filter.batch',
      'source.play',
      'source.batch',
      'export.excel',
      'log.title',
      'log.headers.source',
      'theory.title',
      'theory.expectedWinsShort',
      'theory.bayesTitle',
      'theory.formulaBayesLabel',
      'theory.formulaFirstPrizeLabel',
      'theory.formulaFirstLosingLabel',
      'theory.formulaStayGivenMontyLabel',
      'theory.formulaSwitchGivenMontyLabel',
      'theory.formulaBayes',
      'theory.formulaFirstPrize',
      'theory.formulaFirstLosing',
      'theory.formulaStayGivenMonty',
      'theory.formulaSwitchGivenMonty'
    ];

    for (const language of SUPPORTED_LANGUAGES) {
      for (const key of requiredKeys) {
        assert.equal(typeof translations[language][key], 'string', `${language} ${key}`);
        assert.notEqual(translations[language][key].length, 0, `${language} ${key}`);
      }
    }
  });

  it('does not keep UI dependencies on removed explanatory strings', () => {
    assert.equal(Object.hasOwn(translations.en, 'app.subtitle'), false);
    assert.equal(Object.hasOwn(translations.en, 'config.totalTrialsHelp'), false);
    assert.equal(Object.hasOwn(translations.en, 'results.subtitle'), false);
    assert.equal(Object.hasOwn(translations.en, 'log.subtitle'), false);
    assert.equal(Object.hasOwn(translations.en, 'theory.standardRule'), false);
    assert.equal(Object.hasOwn(translations.en, 'theory.summary'), false);
    assert.equal(Object.hasOwn(translations.en, 'footer.text'), false);
  });

  it('interpolates values in translated strings', () => {
    const t = createTranslator('en');
    assert.equal(t('config.completed', { total: '200' }), 'Completed 200 trial rows.');
  });

  it('uses the revised Japanese lead, labels, and trial limit text', () => {
    const ja = translations.ja;

    assert.equal(ja['app.lead1'], '(1) モンティ・ホール問題では、複数のドア（3つ以上）のうち1つに当たりが隠れています。');
    assert.equal(ja['app.lead3'], '(3) 当たりを知っているモンティは、あなたが選んだドアと、もう1つドアを残して、はずれドアをすべて開けます。つまり、残されたドア2つのうち1つが、当たりです。');
    assert.equal(ja['app.leadQuestion'], 'このとき、あなたは、ドアの選択を変えるべきでしょうか？');
    assert.equal(ja['config.modeStay'], 'モンティがはずれドアを開けた後、ドアの選択を変えない');
    assert.equal(ja['config.modeSwitch'], 'モンティがはずれドアを開けた後、ドアの選択を変える');
    assert.equal(ja['log.headers.openedDoorCount'], '開けたはずれドア数');
    assert.equal(ja['errors.trialsRange'], '選択した戦略ごとの試行回数は1から100,000の間にしてください。');
  });
});
