import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import katex from 'katex'
import MarkdownIt from 'markdown-it'
import anchor from 'markdown-it-anchor'
import { defineConfig } from 'vite'

// Write-ups (src/writeups/*.md) become HTML when the site builds: an import of one
// gives its HTML as a string. The maths is typeset here with KaTeX, so the page
// needs only KaTeX's CSS; ```mermaid blocks are left as <pre class="mermaid"> for the
// page to draw (WriteUp.jsx). Heading ids follow GitHub's, so a write-up's own
// "#1-introduction" links work both here and on GitHub.
const WRITEUP = /\/src\/writeups\/[^/]+\.md$/

// GitHub's heading ids: lower case, punctuation dropped, spaces to hyphens.
const githubSlug = (text) =>
  text.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-')

function renderWriteup(source) {
  // Take the maths out before Markdown sees it ("_" and "\" mean other things
  // there), outside fenced code; put it back typeset afterwards.
  const math = []
  const keep = (tex, displayMode) => {
    math.push(katex.renderToString(tex.trim(), { displayMode, throwOnError: true }))
    return `MATHSLOT${math.length - 1}END`
  }
  const text = source
    .split(/(^```[\s\S]*?^```$)/m)
    .map((part, i) =>
      i % 2
        ? part
        : part
            .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => keep(tex, true))
            .replace(/\$([^$\n]+?)\$/g, (_, tex) => keep(tex, false))
    )
    .join('')

  const md = new MarkdownIt({ html: false, typographer: false })
  md.use(anchor, { slugify: githubSlug, tabIndex: false })

  const fence = md.renderer.rules.fence
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    if (token.info.trim() !== 'mermaid') return fence(tokens, idx, options, env, self)
    return `<figure class="writeup-figure"><pre class="mermaid">${md.utils.escapeHtml(token.content)}</pre></figure>\n`
  }
  // Wide tables scroll inside their own box, never the page.
  md.renderer.rules.table_open = () => '<div class="writeup-table"><table>\n'
  md.renderer.rules.table_close = () => '</table></div>\n'

  // A display formula on its own becomes the whole paragraph: drop the <p> around it.
  return md
    .render(text)
    .replace(/<p>(MATHSLOT\d+END)<\/p>/g, '$1')
    .replace(/MATHSLOT(\d+)END/g, (_, i) => math[i])
}

function writeups() {
  return {
    name: 'writeups',
    load(id) {
      if (!WRITEUP.test(id)) return null
      this.addWatchFile(id)
      return `export default ${JSON.stringify(renderWriteup(readFileSync(id, 'utf8')))}`
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [writeups(), react()],
})
