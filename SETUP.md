# Day One Blog Automation Setup Guide

This guide will walk you through setting up the automated Day One to Next.js blog system.

## Prerequisites

- Day One Plus account
- GitHub account
- Node.js 18+ installed locally
- Vercel account (recommended for hosting)

## 1. Day One Configuration

### Create Blog Journal
1. Open Day One
2. Create a new journal called "Blog Public"
3. Note the journal ID (you'll need this for configuration)

### Export Setup
Since Day One doesn't have a public API, you'll need to set up regular exports:

1. **Option A: Manual Export (Recommended Initially)**
   - Go to Day One → File → Export → JSON
   - Select "Blog Public" journal only
   - Export to a known location
   - Set up a script to process this file

2. **Option B: Automated Export (Advanced)**
   - Use Day One's AppleScript integration on macOS
   - Set up a scheduled task to export automatically

## 2. Repository Setup

### Clone and Install
```bash
git clone <your-repo-url>
cd dayone-blog-automation
npm install
```

### Environment Configuration
```bash
cp .env.example .env.local
```

Edit `.env.local` with your settings:
```env
# Day One Configuration
DAYONE_API_KEY=your_export_key_or_path
DAYONE_JOURNAL_ID=blog_public_journal_id

# GitHub (automatically set in Actions)
GITHUB_TOKEN=will_be_set_by_actions

# Site Configuration
NEXT_PUBLIC_SITE_URL=https://yourblog.vercel.app
NEXT_PUBLIC_SITE_NAME=Your Blog Name
```

## 3. GitHub Actions Setup

### Required Secrets
Go to your GitHub repository → Settings → Secrets and add:

```
DAYONE_API_KEY=your_day_one_access_method
DAYONE_JOURNAL_ID=your_blog_public_journal_id
```

### Workflow Configuration
The workflow is already configured in `.github/workflows/process-dayone.yml` to:
- Run every 15 minutes
- Process new Day One entries
- Commit changes automatically
- Create issues for errors

### Manual Trigger
You can manually trigger the workflow:
1. Go to Actions tab in GitHub
2. Select "Process Day One Entries"
3. Click "Run workflow"

## 4. Day One Processing Script

### Modify for Your Export Method

Edit `scripts/process-dayone.js` to match your Day One export method:

```javascript
async fetchDayOneEntries() {
  // Replace this with your actual Day One data source
  
  // Option A: Read from JSON export file
  const exportPath = process.env.DAYONE_EXPORT_PATH;
  if (fs.existsSync(exportPath)) {
    const data = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    return data.entries.filter(entry => 
      entry.journal === 'Blog Public'
    );
  }
  
  // Option B: Use Day One API (if available)
  // const response = await axios.get('dayone-api-endpoint');
  // return response.data.entries;
  
  return [];
}
```

### Test Locally
```bash
npm run process-dayone
```

## 5. Next.js Development

### Local Development
```bash
npm run dev
```

Visit `http://localhost:3000` to see your blog.

### Build and Test
```bash
npm run build
npm start
```

## 6. Deployment

### Vercel (Recommended)
1. Install Vercel CLI: `npm i -g vercel`
2. Login: `vercel login`
3. Deploy: `vercel`
4. Set environment variables in Vercel dashboard

### Manual Deployment
Configure for your hosting platform:
- Build command: `npm run build`
- Output directory: `.next`
- Node.js version: 18+

## 7. Content Workflow

### Writing Process
1. Write entries in Day One "Blog Public" journal
2. Use rich text formatting (bold, italic, headers)
3. Add photos directly in Day One
4. Use relevant tags (software, hardware, hacking, etc.)

### Publishing
1. Move entry to "Blog Public" journal
2. Wait up to 15 minutes for GitHub Actions
3. Check your blog for the new post

### Categories and Tags
- **Categories**: Use top-level tags: `software`, `hardware`, `hacking`
- **Tags**: Any other tags become clickable tags
- **URLs**: Clean, SEO-friendly structure

## 8. Troubleshooting

### Common Issues

**GitHub Actions failing:**
- Check repository secrets are set correctly
- Verify Day One export is accessible
- Review Actions logs for specific errors

**Images not showing:**
- Ensure images are properly embedded in Day One
- Check that image processing didn't fail
- Verify image paths in generated markdown

**Links not working:**
- Check link processing logs
- Verify external URLs are accessible
- Review cleaned URLs for correctness

### Debug Mode
Set `DEBUG=true` in environment to enable verbose logging:
```bash
DEBUG=true npm run process-dayone
```

### Manual Recovery
If automation fails, you can manually process entries:
```bash
node scripts/process-dayone.js --entry-id=specific-uuid
```

## 9. Customization

### Styling
Edit `styles/globals.css` to customize the blog appearance.

### Components
Modify components in `/components` for layout changes.

### Processing Logic
Update `/lib` files to change how content is processed:
- `imageProcessor.js` - Image handling
- `linkProcessor.js` - URL cleaning
- `posts.js` - Content management

## 10. Maintenance

### Regular Tasks
- Monitor GitHub Actions for failures
- Review and merge automated commits
- Update dependencies monthly
- Back up processed content

### Scaling
- Add caching for better performance
- Implement search functionality
- Add RSS feeds
- Set up analytics

## Security Notes

- Never commit `.env` files
- Review automated commits before deployment
- Monitor for sensitive data in exports
- Keep dependencies updated

## Support

If you encounter issues:
1. Check GitHub Actions logs
2. Review repository issues
3. Test locally with debug mode
4. Verify Day One export format

The system is designed to be resilient and will create GitHub issues for most problems it encounters automatically.