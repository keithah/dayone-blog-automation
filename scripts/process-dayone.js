#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const matter = require('gray-matter');
const sharp = require('sharp');
const exifr = require('exifr');
const cheerio = require('cheerio');
const yaml = require('js-yaml');

class DayOneProcessor {
  constructor() {
    this.apiKey = process.env.DAYONE_API_KEY;
    this.journalId = process.env.DAYONE_JOURNAL_ID;
    this.processedEntriesPath = path.join(__dirname, '..', 'data', 'processed.json');
    this.postsDir = path.join(__dirname, '..', 'posts');
    this.imagesDir = path.join(__dirname, '..', 'images');
    
    this.ensureDirectories();
    this.processedEntries = this.loadProcessedEntries();
  }

  ensureDirectories() {
    const dirs = [
      path.dirname(this.processedEntriesPath),
      this.postsDir,
      this.imagesDir
    ];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  loadProcessedEntries() {
    if (fs.existsSync(this.processedEntriesPath)) {
      return JSON.parse(fs.readFileSync(this.processedEntriesPath, 'utf8'));
    }
    return {};
  }

  saveProcessedEntries() {
    fs.writeFileSync(
      this.processedEntriesPath, 
      JSON.stringify(this.processedEntries, null, 2)
    );
  }

  async fetchDayOneEntries() {
    try {
      // Mock Day One API call - replace with actual Day One export/API
      console.log('Fetching Day One entries...');
      
      // For now, simulate API response
      // In real implementation, use Day One's JSON export or API
      return [];
      
    } catch (error) {
      console.error('Error fetching Day One entries:', error);
      throw error;
    }
  }

  async processEntry(entry) {
    const uuid = entry.uuid;
    const lastModified = entry.modifiedDate || entry.creationDate;
    
    // Check if entry needs processing
    if (this.processedEntries[uuid] && 
        this.processedEntries[uuid].lastModified >= lastModified) {
      console.log(`Skipping unchanged entry: ${entry.title || uuid}`);
      return;
    }

    console.log(`Processing entry: ${entry.title || uuid}`);

    try {
      // Process content
      const processedContent = await this.processContent(entry);
      const processedImages = await this.processImages(entry);
      const processedLinks = await this.processLinks(entry);

      // Generate frontmatter and markdown
      const frontmatter = this.generateFrontmatter(entry, processedImages);
      const markdown = this.generateMarkdown(processedContent, processedLinks);
      
      // Write post file
      const postPath = this.generatePostPath(entry);
      this.writePost(postPath, frontmatter, markdown);

      // Update processed entries
      this.processedEntries[uuid] = {
        lastModified,
        postPath,
        title: entry.title,
        processedAt: new Date().toISOString()
      };

      console.log(`Successfully processed: ${entry.title || uuid}`);
      
    } catch (error) {
      console.error(`Error processing entry ${uuid}:`, error);
      await this.createGitHubIssue(`Processing Error for Entry: ${entry.title || uuid}`, error);
      throw error;
    }
  }

  async processContent(entry) {
    // Convert Day One rich text to Markdown
    // This is a simplified version - real implementation would need
    // to handle Day One's rich text format properly
    let content = entry.text || entry.richText || '';
    
    // Basic rich text to markdown conversion
    content = content
      .replace(/\*\*(.*?)\*\*/g, '**$1**')  // Bold
      .replace(/\*(.*?)\*/g, '*$1*')        // Italic
      .replace(/^# (.*$)/gm, '# $1')        // Headers
      .replace(/^## (.*$)/gm, '## $1')
      .replace(/^### (.*$)/gm, '### $1');

    return content;
  }

  async processImages(entry) {
    const processedImages = [];
    
    if (!entry.photos || entry.photos.length === 0) {
      return processedImages;
    }

    for (const photo of entry.photos) {
      try {
        const imageInfo = await this.downloadAndProcessImage(photo, entry);
        processedImages.push(imageInfo);
      } catch (error) {
        console.error(`Error processing image ${photo.identifier}:`, error);
        await this.createGitHubIssue(
          `Image Processing Error: ${photo.identifier}`, 
          error
        );
      }
    }

    return processedImages;
  }

  async downloadAndProcessImage(photo, entry) {
    const date = new Date(entry.creationDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    const imageDir = path.join(this.imagesDir, String(year), month);
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }

    const filename = `${photo.identifier}.png`;
    const imagePath = path.join(imageDir, filename);
    const relativePath = `images/${year}/${month}/${filename}`;

    // Download image (mock implementation)
    console.log(`Processing image: ${filename}`);
    
    // In real implementation:
    // 1. Download image from Day One
    // 2. Strip EXIF data using exifr
    // 3. Optimize with sharp if needed
    // 4. Save to disk

    return {
      filename,
      path: relativePath,
      altText: photo.caption || '',
      originalId: photo.identifier
    };
  }

  async processLinks(entry) {
    // Extract and process links from content
    const content = entry.text || '';
    const $ = cheerio.load(`<div>${content}</div>`);
    const links = [];

    $('a').each((i, elem) => {
      const url = $(elem).attr('href');
      if (url) {
        links.push({
          original: url,
          cleaned: this.cleanUrl(url),
          text: $(elem).text()
        });
      }
    });

    return links;
  }

  cleanUrl(url) {
    try {
      const urlObj = new URL(url);
      
      // Remove tracking parameters
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'gclid', 'msclkid', 'twclid',
        'ref', 'source', 'campaign'
      ];

      trackingParams.forEach(param => {
        urlObj.searchParams.delete(param);
      });

      // Clean Amazon URLs
      if (urlObj.hostname.includes('amazon.')) {
        const pathParts = urlObj.pathname.split('/');
        const dpIndex = pathParts.indexOf('dp');
        if (dpIndex !== -1 && pathParts[dpIndex + 1]) {
          urlObj.pathname = `/dp/${pathParts[dpIndex + 1]}/`;
          urlObj.search = '';
        }
      }

      return urlObj.toString();
    } catch (error) {
      console.warn(`Failed to clean URL: ${url}`, error);
      return url;
    }
  }

  generateFrontmatter(entry, images) {
    const date = new Date(entry.creationDate);
    
    return {
      title: entry.title || 'Untitled',
      publishDate: entry.creationDate,
      editDate: entry.modifiedDate || entry.creationDate,
      uuid: entry.uuid,
      tags: entry.tags || [],
      category: this.determineCategory(entry.tags || []),
      images: images.map(img => img.filename)
    };
  }

  determineCategory(tags) {
    const categories = ['hardware', 'software', 'hacking'];
    const categoryTag = tags.find(tag => categories.includes(tag.toLowerCase()));
    return categoryTag ? categoryTag.toLowerCase() : 'general';
  }

  generateMarkdown(content, links) {
    // Replace original links with cleaned versions
    let processedContent = content;
    
    links.forEach(link => {
      if (link.original !== link.cleaned) {
        processedContent = processedContent.replace(link.original, link.cleaned);
      }
    });

    return processedContent;
  }

  generatePostPath(entry) {
    const date = new Date(entry.creationDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    const slug = this.generateSlug(entry.title || 'untitled');
    
    return path.join(this.postsDir, String(year), month, `${slug}.md`);
  }

  generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  writePost(postPath, frontmatter, content) {
    const dir = path.dirname(postPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const fileContent = matter.stringify(content, frontmatter);
    fs.writeFileSync(postPath, fileContent);
  }

  async createGitHubIssue(title, error) {
    // In GitHub Actions, this would use the GitHub API
    console.error(`Would create GitHub issue: ${title}`, error);
  }

  async run() {
    try {
      console.log('Starting Day One processing...');
      
      const entries = await this.fetchDayOneEntries();
      console.log(`Found ${entries.length} entries to process`);

      for (const entry of entries) {
        await this.processEntry(entry);
      }

      this.saveProcessedEntries();
      console.log('Day One processing completed successfully');
      
    } catch (error) {
      console.error('Day One processing failed:', error);
      await this.createGitHubIssue('Day One Processing Failed', error);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const processor = new DayOneProcessor();
  processor.run();
}

module.exports = DayOneProcessor;