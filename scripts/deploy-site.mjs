#!/usr/bin/env node
/**
 * deploy-site.mjs — gate pré-deploy da landing TrueLive.
 *
 * 1. Cache-busting determinístico: reescreve `assets/<nome>?v=<hash>` nos dois
 *    HTMLs usando 8 chars do sha256 do conteúdo de cada asset.
 * 2. Check estrutural PT×EN: compara marcadores estruturais entre
 *    site/index.html e site/en/index.html. Divergência → exit 1.
 * 3. Tudo OK → imprime os comandos scp prontos (NÃO executa scp).
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SITE = join(ROOT, 'site')
const ASSETS_DIR = join(SITE, 'assets')
const HTML_PT = join(SITE, 'index.html')
const HTML_EN = join(SITE, 'en', 'index.html')
const REMOTE = 'vitor_server:/srv/sites/truelive'

// ---------------------------------------------------------------- utilities

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const shortHash = (filePath) =>
  createHash('sha256').update(readFileSync(filePath)).digest('hex').slice(0, 8)

// ------------------------------------------------- 1. cache-busting por hash

const listAssets = () =>
  readdirSync(ASSETS_DIR)
    .filter((name) => statSync(join(ASSETS_DIR, name)).isFile())
    .sort()

const hashAssets = () =>
  listAssets().reduce(
    (acc, name) => ({ ...acc, [name]: shortHash(join(ASSETS_DIR, name)) }),
    {},
  )

/**
 * Substitui APENAS a query string ?v= das referências a assets/<nome>.
 * Cobre `assets/x`, `../assets/x` e URLs absolutas (todas contêm "assets/<nome>").
 */
const rewriteVersions = (html, hashes) =>
  Object.entries(hashes).reduce(({ out, changes }, [name, hash]) => {
    const re = new RegExp(
      `(assets/${escapeRegex(name)})(\\?v=[^"'\\s<>]*)?`,
      'g',
    )
    const replaced = out.replace(re, `$1?v=${hash}`)
    const count = (out.match(re) ?? []).length
    return {
      out: replaced,
      changes: count > 0 ? [...changes, { name, hash, count }] : changes,
    }
  }, { out: html, changes: [] })

// ------------------------------------------------- 2. check estrutural PT×EN

const countMatches = (html, re) => (html.match(re) ?? []).length

const structuralMetrics = (html) => ({
  '.bar-row': countMatches(html, /class="[^"]*\bbar-row\b[^"]*"/g),
  'data-count': countMatches(html, /\bdata-count=/g),
  'data-delay': countMatches(html, /\bdata-delay=/g),
  '.lane': countMatches(html, /class="[^"]*\blane\b[^"]*"/g),
  '.tab-btn': countMatches(html, /class="[^"]*\btab-btn\b[^"]*"/g),
  details: countMatches(html, /<details\b/g),
})

const sectionIds = (html) =>
  [...html.matchAll(/<section\b[^>]*\bid="([^"]*)"/g)].map((m) => m[1])

const compareStructure = (ptHtml, enHtml) => {
  const pt = structuralMetrics(ptHtml)
  const en = structuralMetrics(enHtml)
  const countDiffs = Object.keys(pt)
    .filter((key) => pt[key] !== en[key])
    .map((key) => `  ${key}: PT=${pt[key]} vs EN=${en[key]}`)

  // Ids são traduzidos entre os idiomas — compara CONTAGEM de sections.
  // Exceção deliberada: PT tem a seção de doação PIX (#apoiar) que o EN não
  // tem (PIX é impagável fora do BR), então PT = EN + 1 também passa.
  const ptIds = sectionIds(ptHtml)
  const enIds = sectionIds(enHtml)
  const delta = ptIds.length - enIds.length
  const idDiffs =
    delta === 0 || (delta === 1 && ptIds.includes('apoiar'))
      ? []
      : [`  sections: PT=[${ptIds.join(', ')}] (${ptIds.length}) vs EN=[${enIds.join(', ')}] (${enIds.length})`]

  return [...countDiffs, ...idDiffs]
}

// --------------------------------------------------------------------- main

const main = () => {
  const hashes = hashAssets()

  console.log('== Cache-busting (sha256[0:8] por asset) ==')
  Object.entries(hashes).forEach(([name, hash]) =>
    console.log(`  ${name} -> ?v=${hash}`),
  )

  const htmlFiles = [HTML_PT, HTML_EN]
  htmlFiles.forEach((file) => {
    const original = readFileSync(file, 'utf8')
    const { out, changes } = rewriteVersions(original, hashes)
    if (out !== original) writeFileSync(file, out)
    const total = changes.reduce((sum, c) => sum + c.count, 0)
    console.log(
      `  ${relative(ROOT, file)}: ${total} referência(s) atualizadas` +
        (changes.length > 0
          ? ` (${changes.map((c) => `${c.name}×${c.count}`).join(', ')})`
          : ''),
    )
  })

  console.log('\n== Check estrutural PT×EN ==')
  const diffs = compareStructure(
    readFileSync(HTML_PT, 'utf8'),
    readFileSync(HTML_EN, 'utf8'),
  )

  if (diffs.length > 0) {
    console.error('DIVERGÊNCIAS entre site/index.html e site/en/index.html:')
    diffs.forEach((line) => console.error(line))
    console.error('\nGate pré-deploy FALHOU — corrija a paridade PT×EN antes do deploy.')
    process.exit(1)
  }

  console.log('  OK — estruturas PT e EN idênticas.')

  console.log('\n== Deploy (execute manualmente) ==')
  const scpCommands = [
    `scp ${relative(ROOT, HTML_PT)} ${REMOTE}/index.html`,
    `scp ${relative(ROOT, HTML_EN)} ${REMOTE}/en/index.html`,
    `scp site/sitemap.xml ${REMOTE}/sitemap.xml`,
    ...listAssets().map(
      (name) => `scp site/assets/${name} ${REMOTE}/assets/${name}`,
    ),
  ]
  scpCommands.forEach((cmd) => console.log(`  ${cmd}`))
}

main()
