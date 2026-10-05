import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { MESSAGES, MESSAGE_KEYS } from './messages.js'
import { translate } from './i18n.js'
import { DEMO_WATERMARK } from './access.js'
import { drawStepText } from './drawInput.js'

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('shell and editor copy is keyed in every language', () => {
  const required = [
    'shell.hero',
    'shell.login',
    'shell.pricing',
    'tool.exterior',
    'tool.interior',
    'tool.passage',
    'opening.merge',
    'draw.start',
    'watermark.demo',
    'stale.message',
    'legend.title',
    'bom.title',
  ]
  required.forEach((key) => {
    assert.equal(MESSAGE_KEYS.includes(key), true, key)
    const values = ['fi', 'en', 'sv', 'es', 'et'].map((id) => MESSAGES[id][key])
    values.forEach((value) => assert.equal(typeof value, 'string'))
    assert.notEqual(values[0], values[1], key)
  })
  assert.equal(MESSAGES.fi['watermark.demo'], DEMO_WATERMARK)
  assert.equal(translate('et', 'shell.hero').includes('Joonista'), true)
  assert.equal(translate('en', 'tool.exterior'), 'Exterior wall')
  assert.equal(drawStepText(undefined, 0, 'en').includes('Klikkaa'), false)
  assert.equal(drawStepText(undefined, 0, 'et').includes('Klikkaa'), false)
  assert.equal(drawStepText({ x: 0, z: 0 }, 2, 'en').includes('Close'), true)
})

test('product shell and editor chrome route visible copy through t()', () => {
  const banned = [
    ['../app/LandingClient.jsx', ['Hinnasto', 'Kirjaudu', 'Aloita piirtäminen']],
    ['../app/login/LoginClient.jsx', ['Tervetuloa takaisin', 'Kirjaudu sisään']],
    ['../app/projects/ProjectsClient.jsx', ['Projektit', 'Uusi projekti', 'Ei vielä projekteja']],
    ['../app/admin/page.jsx', ['Käyttäjät ja maksut', 'Odottaa maksun vahvistusta', 'Uusi / kuittaa']],
    ['../app/uusi/page.jsx', ['Valitse hanketyyppi']],
    ['../app/suunnittelu/page.jsx', ['Kylmätekniikka kuuluu']],
    ['../components/floorplan/PlanChrome.jsx', ['Siivoa päällekkäiset', 'Suorista seinät', 'Kylmätekniikka', 'Reititä automaattisesti', 'Valikko']],
    ['../components/floorplan/FloorPlanApp.jsx', ['Klikkaa aloituspiste', "'Ulkoseinä'", "'Oviaukko'", 'Ulkopinta', 'Vaihda puoli', '>Työkalut<']],
    ['../components/floorplan/FloorMenus.jsx', ["'Yhdistä tilat'", "'Erota tilat'", "'Kätisyys:'", '>Ulkoseinä<']],
    ['../components/designer/DesignerApp.jsx', ['>Autoputkitus<', '>Väliseinä (W)<', 'Työkalut</button>']],
  ]
  banned.forEach(([path, phrases]) => {
    const file = source(path)
    phrases.forEach((phrase) => assert.equal(file.includes(phrase), false, `${path} still contains ${phrase}`))
  })
  assert.equal(source('../app/LandingClient.jsx').includes('ShellLanguage'), true)
  assert.equal(source('../app/projects/ProjectsClient.jsx').includes('ShellLanguage'), true)
  assert.equal(source('../components/floorplan/PlanChrome.jsx').includes("t('chrome.menu')"), true)
  assert.equal(source('../components/designer/DesignerApp.jsx').includes('compact-only'), true)
  assert.equal(source('../components/StaleDeployNotice.jsx').includes('STALE_DEPLOY_MESSAGE'), true)
  assert.equal(source('../components/StaleDeployNotice.jsx').includes('stale.message'), true)
})
