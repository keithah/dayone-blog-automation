import Link from 'next/link'
import { useRouter } from 'next/router'
import { getAllPosts, getPostsByCategory } from '../../../lib/posts'

export default function CategoryPage({ posts, category }) {
  const router = useRouter()
  
  if (router.isFallback) {
    return <div>Loading...</div>
  }

  return (
    <div className="container">
      <h1>Category: {category}</h1>
      
      <nav className="breadcrumb">
        <Link href="/">Home</Link> / <Link href="/blog">Blog</Link> / {category}
      </nav>
      
      <div className="posts">
        {posts.map((post) => (
          <article key={post.uuid} className="post-preview">
            <h2>
              <Link href={`/blog/${post.category}/${post.slug}`}>
                {post.title}
              </Link>
            </h2>
            <div className="meta">
              <time>{new Date(post.publishDate).toLocaleDateString()}</time>
            </div>
            <div className="tags">
              {post.tags.map(tag => (
                <Link key={tag} href={`/blog/tag/${tag}`} className="tag">
                  {tag}
                </Link>
              ))}
            </div>
            {post.excerpt && <p className="excerpt">{post.excerpt}</p>}
          </article>
        ))}
      </div>
      
      {posts.length === 0 && (
        <p>No posts found in this category.</p>
      )}
    </div>
  )
}

export async function getStaticProps({ params }) {
  const { category } = params
  const posts = getPostsByCategory(category, ['title', 'publishDate', 'category', 'tags', 'slug', 'uuid', 'excerpt'])
  
  return {
    props: {
      posts,
      category,
    },
  }
}

export async function getStaticPaths() {
  const posts = getAllPosts(['category'])
  const categories = [...new Set(posts.map(post => post.category))]
  
  const paths = categories.map(category => ({
    params: { category }
  }))
  
  return {
    paths,
    fallback: false
  }
}