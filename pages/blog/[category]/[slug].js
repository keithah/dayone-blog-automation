import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/router'
import Layout from '../../../components/Layout'
import { getAllPosts, getPostBySlug, getAllCategories } from '../../../lib/posts'
import { markdownToHtml } from '../../../lib/markdownToHtml'

export default function PostPage({ post, categories }) {
  const router = useRouter()
  
  if (router.isFallback) {
    return <div>Loading...</div>
  }

  return (
    <Layout categories={categories}>
      <article className="post">
        <header className="post-header">
          <nav className="breadcrumb">
            <Link href="/">Home</Link> / 
            <Link href="/">Posts</Link> / 
            <Link href={`/blog/${post.category}`}>{post.category}</Link> / 
            {post.title}
          </nav>
          
          <h1>{post.title}</h1>
          
          <div className="meta">
            <time>Published: {new Date(post.publishDate).toLocaleDateString()}</time>
            {post.editDate !== post.publishDate && (
              <time>Updated: {new Date(post.editDate).toLocaleDateString()}</time>
            )}
            <span className="category">
              <Link href={`/blog/${post.category}`}>
                {post.category}
              </Link>
            </span>
          </div>
          
          {post.tags.length > 0 && (
            <div className="tags">
              {post.tags.map(tag => (
                <Link key={tag} href={`/blog/tag/${tag}`} className="tag">
                  {tag}
                </Link>
              ))}
            </div>
          )}
        </header>
        
        {post.images && post.images.length > 0 && (
          <div className="post-images">
            {post.images.map((image, index) => (
              <div key={index} className="image-container">
                <Image
                  src={`/images/${image}`}
                  alt={`Image ${index + 1}`}
                  width={800}
                  height={600}
                  style={{ objectFit: 'contain' }}
                />
              </div>
            ))}
          </div>
        )}
        
        <div 
          className="post-content"
          dangerouslySetInnerHTML={{ __html: post.content }} 
        />
        
        <footer className="post-footer">
          <div className="post-nav">
            <Link href="/">
              ← Back to Posts
            </Link>
          </div>
        </footer>
      </article>
    </Layout>
  )
}

export async function getStaticProps({ params }) {
  const { category, slug } = params
  const post = getPostBySlug(category, slug, [
    'title',
    'publishDate', 
    'editDate',
    'category',
    'tags',
    'slug',
    'uuid',
    'images',
    'content'
  ])
  
  const content = await markdownToHtml(post.content || '')
  
  const allPosts = getAllPosts(['category'])
  const allCategories = getAllCategories()
  const categories = allCategories.map(categoryName => {
    const count = allPosts.filter(p => p.category === categoryName).length
    return { name: categoryName, count }
  })
  
  return {
    props: {
      post: {
        ...post,
        content,
      },
      categories,
    },
  }
}

export async function getStaticPaths() {
  const posts = getAllPosts(['slug', 'category'])
  
  const paths = posts.map(post => ({
    params: { 
      category: post.category, 
      slug: post.slug 
    }
  }))
  
  return {
    paths,
    fallback: false
  }
}