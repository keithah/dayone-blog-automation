import Link from 'next/link'
import Layout from '../components/Layout'
import { getAllPosts, getAllCategories } from '../lib/posts'

export default function Home({ posts, categories }) {
  return (
    <Layout categories={categories}>
      <div className="posts-grid">
        {posts.map((post) => (
          <article key={post.uuid} className="post-card">
            <Link href={`/blog/${post.category}/${post.slug}`} className="post-link">
              <div className="post-content">
                <h2 className="post-title">{post.title}</h2>
                <div className="post-meta">
                  <time className="post-date">
                    {new Date(post.publishDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </time>
                  <span className="post-category">{post.category}</span>
                </div>
                <div className="post-tags">
                  {post.tags.map(tag => (
                    <span key={tag} className="post-tag">
                      {tag}
                    </span>
                  ))}
                </div>
                {post.excerpt && <p className="post-excerpt">{post.excerpt}</p>}
              </div>
            </Link>
          </article>
        ))}
      </div>
    </Layout>
  )
}

export async function getStaticProps() {
  const posts = getAllPosts(['title', 'publishDate', 'category', 'tags', 'slug', 'uuid', 'excerpt'])
  const allCategories = getAllCategories()
  
  // Count posts per category
  const categories = allCategories.map(categoryName => {
    const count = posts.filter(post => post.category === categoryName).length
    return { name: categoryName, count }
  })
  
  return {
    props: {
      posts,
      categories,
    },
  }
}