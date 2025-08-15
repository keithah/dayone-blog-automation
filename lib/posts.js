import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const postsDirectory = path.join(process.cwd(), 'posts')

export function getPostSlugs() {
  const slugs = []
  
  function traverseDir(dir, category = '') {
    if (!fs.existsSync(dir)) return
    
    const items = fs.readdirSync(dir)
    
    items.forEach(item => {
      const fullPath = path.join(dir, item)
      const stat = fs.statSync(fullPath)
      
      if (stat.isDirectory()) {
        traverseDir(fullPath, category)
      } else if (item.endsWith('.md')) {
        const slug = item.replace(/\.md$/, '')
        const relativePath = path.relative(postsDirectory, fullPath)
        const pathParts = relativePath.split(path.sep)
        
        slugs.push({
          slug,
          category: pathParts[pathParts.length - 4] || 'general', // Assuming YYYY/MM/slug.md structure
          fullPath
        })
      }
    })
  }
  
  traverseDir(postsDirectory)
  return slugs
}

export function getPostBySlug(category, slug, fields = []) {
  const slugs = getPostSlugs()
  const postInfo = slugs.find(p => p.slug === slug && p.category === category)
  
  if (!postInfo) {
    return null
  }
  
  const fullPath = postInfo.fullPath
  const fileContents = fs.readFileSync(fullPath, 'utf8')
  const { data, content } = matter(fileContents)
  
  const items = {}
  
  fields.forEach((field) => {
    if (field === 'slug') {
      items[field] = slug
    }
    if (field === 'content') {
      items[field] = content
    }
    if (field === 'category') {
      items[field] = category
    }
    if (typeof data[field] !== 'undefined') {
      items[field] = data[field]
    }
  })
  
  return items
}

export function getAllPosts(fields = []) {
  const slugs = getPostSlugs()
  const posts = slugs
    .map((postInfo) => getPostBySlug(postInfo.category, postInfo.slug, fields))
    .filter(post => post !== null)
    .sort((post1, post2) => (post1.publishDate > post2.publishDate ? -1 : 1))
  
  return posts
}

export function getPostsByCategory(category, fields = []) {
  const allPosts = getAllPosts(fields)
  return allPosts.filter(post => post.category === category)
}

export function getPostsByTag(tag, fields = []) {
  const allPosts = getAllPosts(fields)
  return allPosts.filter(post => 
    post.tags && post.tags.includes(tag)
  )
}

export function getAllCategories() {
  const posts = getAllPosts(['category'])
  return [...new Set(posts.map(post => post.category))]
}

export function getAllTags() {
  const posts = getAllPosts(['tags'])
  return [...new Set(posts.flatMap(post => post.tags || []))]
}