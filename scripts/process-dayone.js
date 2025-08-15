#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const matter = require('gray-matter');
const sharp = require('sharp');
const exifr = require('exifr');
const cheerio = require('cheerio');
const yaml = require('js-yaml');
const JournalStateTracker = require('../lib/journalStateTracker');

class DayOneProcessor {
  constructor() {
    this.apiKey = process.env.DAYONE_API_KEY;
    this.journalId = process.env.DAYONE_JOURNAL_ID;
    this.processedEntriesPath = path.join(__dirname, '..', 'data', 'processed.json');
    this.postsDir = path.join(__dirname, '..', 'posts');
    this.imagesDir = path.join(__dirname, '..', 'images');
    
    this.ensureDirectories();
    this.processedEntries = this.loadProcessedEntries();
    this.stateTracker = new JournalStateTracker();
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
      console.log('Starting 3-journal workflow...');
      
      const JournalManager = require('../lib/journalManager');
      const journalManager = new JournalManager();
      
      try {
        // Process the 3-journal workflow
        const { newEntries, entriesToMove, allPublicEntries } = await journalManager.processJournalWorkflow();
        
        // Update state tracking
        this.stateTracker.updateJournalSnapshot('Blog Public', allPublicEntries);
        
        // Store journal management data for later use
        this.journalData = {
          newEntries,
          entriesToMove,
          allPublicEntries
        };
        
        console.log(`Returning ${newEntries.length} new entries for processing`);
        return newEntries;
        
      } finally {
        // Clean up temporary files
        journalManager.cleanup();
      }
      
    } catch (error) {
      console.error('Error in journal workflow:', error);
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

      // Process new entries from Blog Public
      for (const entry of entries) {
        await this.processEntry(entry);
      }

      // Handle journal migration after processing
      await this.handleJournalMigration();

      this.saveProcessedEntries();
      console.log('Day One processing completed successfully');
      
    } catch (error) {
      console.error('Day One processing failed:', error);
      await this.createGitHubIssue('Day One Processing Failed', error);
      process.exit(1);
    }
  }

  async handleJournalMigration() {
    if (!this.journalData || !this.journalData.entriesToMove || this.journalData.entriesToMove.length === 0) {
      console.log('No entries to migrate between journals');
      return;
    }

    try {
      console.log(`Processing journal migration for ${this.journalData.entriesToMove.length} entries...`);
      
      const JournalManager = require('../lib/journalManager');
      const journalManager = new JournalManager();
      
      // Track this migration request
      const migrationId = this.stateTracker.trackMigrationRequest(this.journalData.entriesToMove);
      
      // Generate migration commands/instructions
      const migrationCommands = await journalManager.createJournalMigrationCommands(this.journalData.entriesToMove);
      
      // Create a migration report
      const migrationReport = {
        migrationId,
        timestamp: new Date().toISOString(),
        totalEntries: this.journalData.entriesToMove.length,
        commands: migrationCommands,
        instructions: [
          'The following entries have been published and should be moved from Blog Public to Blog Published:',
          '',
          'Manual steps required:',
          '1. Open Day One app',
          '2. Select the entries listed below from Blog Public journal',
          '3. Move them to Blog Published journal',
          '',
          'Entries to move:'
        ]
      };

      // Save migration report
      const reportPath = path.join(__dirname, '..', 'data', `migration-report-${Date.now()}.json`);
      const reportDir = path.dirname(reportPath);
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      
      fs.writeFileSync(reportPath, JSON.stringify(migrationReport, null, 2));
      
      // Create GitHub issue with migration instructions
      await this.createJournalMigrationIssue(migrationReport);
      
      console.log(`Migration report saved: ${reportPath}`);
      
    } catch (error) {
      console.error('Journal migration handling failed:', error);
      await this.createGitHubIssue('Journal Migration Failed', error);
    }
  }

  async createJournalMigrationIssue(migrationReport) {
    const issueBody = `## Journal Migration Required

${migrationReport.totalEntries} entries have been published and need to be moved from **Blog Public** to **Blog Published**.

### Entries to Move:

${migrationReport.commands.map(cmd => 
  `- **${cmd.title}** (UUID: \`${cmd.uuid}\`)`
).join('\n')}

### Manual Steps:
1. Open Day One app
2. Go to **Blog Public** journal  
3. Select the entries listed above
4. Move them to **Blog Published** journal
5. Close this issue when complete

**Migration Report:** Generated at ${migrationReport.timestamp}

🤖 Automated journal migration tracking`;

    try {
      // In GitHub Actions, this would use the GitHub API
      console.log('Would create GitHub issue for journal migration:');
      console.log('Title: Journal Migration Required - Move Published Entries');
      console.log('Body:', issueBody);
      
      // For now, just log the issue content
      // In real implementation, use GitHub REST API to create issue
      
    } catch (error) {
      console.error('Failed to create migration issue:', error);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const processor = new DayOneProcessor();
  processor.run();
}

module.exports = DayOneProcessor;