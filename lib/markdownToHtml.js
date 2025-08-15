import { marked } from 'marked'

export async function markdownToHtml(markdown) {
  // Configure marked options
  marked.setOptions({
    breaks: true,
    gfm: true,
    sanitize: false, // Be careful with this in production
    smartLists: true,
    smartypants: true
  })

  // Custom renderer for images to add proper classes
  const renderer = new marked.Renderer()
  
  renderer.image = function(href, title, text) {
    return `<img src="${href}" alt="${text}" title="${title || ''}" class="post-image" loading="lazy" />`
  }
  
  renderer.link = function(href, title, text) {
    const isExternal = href.startsWith('http') && !href.includes(process.env.NEXT_PUBLIC_SITE_URL || '')
    const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''
    const titleAttr = title ? ` title="${title}"` : ''
    
    return `<a href="${href}"${titleAttr}${target}>${text}</a>`
  }
  
  renderer.code = function(code, language) {
    const validLanguage = language && /^[a-zA-Z0-9_+-]*$/.test(language) ? language : ''
    return `<pre><code class="language-${validLanguage}">${code}</code></pre>`
  }
  
  marked.use({ renderer })
  
  const result = marked(markdown)
  return result
}