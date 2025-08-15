import Link from 'next/link'
import { getAllPosts } from '../lib/posts'

export default function Home({ posts }) {
  return (
    <div className="container">
      <h1>Blog</h1>
      
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
    </div>
  )
}

export async function getStaticProps() {
  const posts = getAllPosts(['title', 'publishDate', 'category', 'tags', 'slug', 'uuid', 'excerpt'])
  
  return {
    props: {
      posts,
    },
  }
}