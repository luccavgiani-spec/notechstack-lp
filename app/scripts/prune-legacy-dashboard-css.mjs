// Mechanical removal of retired home components, after checking source references.
import fs from 'node:fs'
import postcss from 'postcss'
const file = 'src/client-dashboard/client-dashboard.css'
const obsolete = /\.(?:architecture-[\w-]+|estimator-[\w-]+|chart-(?:current|plot|grid|y-labels|x-labels)|hero-scene[\w-]*)(?![\w-])/
const root = postcss.parse(fs.readFileSync(file, 'utf8'))
let removed = 0
root.walkRules(rule => {
  const keep = rule.selectors.filter(selector => !obsolete.test(selector))
  removed += rule.selectors.length - keep.length
  if (!keep.length) rule.remove()
  else rule.selectors = keep
})
root.walkAtRules(rule => { if (rule.nodes?.length === 0) rule.remove() })
if (process.argv.includes('--write')) fs.writeFileSync(file, root.toString())
console.log(`${removed} obsolete selectors ${process.argv.includes('--write') ? 'removed' : 'identified'}`)
