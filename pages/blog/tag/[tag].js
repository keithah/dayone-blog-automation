import Link from 'next/link'
import { useRouter } from 'next/router'
import { getAllPosts, getPostsByTag } from '../../../lib/posts'

export default function TagPage({ posts, tag }) {
  const router = useRouter()
  
  if (router.isFallback) {
    return <div>Loading...</div>
  }

  return (
    <div className="container">
      <h1>Tag: {tag}</h1>
      
      <nav className="breadcrumb">
        <Link href="/">Home</Link> / <Link href="/blog">Blog</Link> / Tag: {tag}
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
              <span className="category">
                <Link href={`/blog/${post.category}`}>
                  {post.category}
                </Link>
              </span>
            </div>
            <div className="tags">
              {post.tags.map(tagName => (
                <Link 
                  key={tagName} 
                  href={`/blog/tag/${tagName}`} 
                  className={`tag ${tagName === tag ? 'active' : ''}`}
                >
                  {tagName}
                </Link>
              ))}
            </div>
            {post.excerpt && <p className="excerpt">{post.excerpt}</p>}
          </article>
        ))}
      </div>
      
      {posts.length === 0 && (
        <p>No posts found with this tag.</p>
      )}
    </div>
  )
}

export async function getStaticProps({ params }) {
  const { tag } = params
  const posts = getPostsByTag(tag, ['title', 'publishDate', 'category', 'tags', 'slug', 'uuid', 'excerpt'])
  
  return {
    props: {
      posts,
      tag,
    },
  }
}

export async function getStaticPaths() {
  const posts = getAllPosts(['tags'])
  const tags = [...new Set(posts.flatMap(post => post.tags || []))]
  
  const paths = tags.map(tag => ({
    params: { tag }
  }))
  
  return {
    paths,
    fallback: false
  }
}