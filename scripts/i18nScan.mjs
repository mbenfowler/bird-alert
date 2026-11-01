// Lists user-facing text written straight into JSX (text, labels, placeholders, alt and title
// attributes, and strings or templates shown as children) instead of coming from the catalog.
// Run `node scripts/i18nScan.mjs` for a per-file count; src/i18nGuard.test.ts fails on any.
import ts from 'typescript'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ATTRS = new Set(['aria-label', 'title', 'placeholder', 'alt', 'label', 'aria-description', 'ariaLabel', 'emptyText', 'hint', 'heading'])
// Names, not words: the app's name in the bar and xeno-canto's catalogue prefix.
const ALLOWED = new Set(['Bird', 'Alert!', 'XC'])
const hasWords = (s) => !ALLOWED.has(s.trim()) && /[A-Za-z]{2,}/.test(s)

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.tsx') && !p.includes('.test.')) out.push(p)
  }
  return out
}

const isText = (e) => ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) || ts.isTemplateExpression(e)

export const scanFile = (file) => {
  const src = readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found = []
  const add = (node, text) => found.push({ file, line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, text: text.trim().replace(/\s+/g, ' ').slice(0, 90) })
  const visit = (node) => {
    if (ts.isJsxText(node) && hasWords(node.text)) add(node, node.text)
    if (ts.isJsxAttribute(node) && node.initializer && ATTRS.has(node.name.getText())) {
      const init = node.initializer
      if (ts.isStringLiteral(init) && hasWords(init.text)) add(node, `${node.name.getText()}="${init.text}"`)
      else if (ts.isJsxExpression(init) && init.expression && isText(init.expression) && hasWords(init.expression.getText().replace(/\$\{[^}]*\}/g, ''))) add(node, `${node.name.getText()}=${init.expression.getText()}`)
    }
    if (ts.isJsxExpression(node) && node.expression && node.parent && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      const e = node.expression
      if (isText(e) && hasWords(e.getText().replace(/\$\{[^}]*\}/g, ''))) add(node, e.getText())
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

export const scanAll = (root = 'src') => walk(root).flatMap(scanFile)

if (process.argv[1] && process.argv[1].endsWith('i18nScan.mjs')) {
  const all = scanAll(process.argv[2] || 'src')
  const byFile = {}
  for (const f of all) (byFile[f.file] ??= []).push(f)
  for (const [file, list] of Object.entries(byFile).sort((a, b) => b[1].length - a[1].length)) console.log(list.length, file)
  console.log('total', all.length)
}
