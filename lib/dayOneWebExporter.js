const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class DayOneWebExporter {
  constructor() {
    this.email = process.env.DAYONE_EMAIL;
    this.password = process.env.DAYONE_PASSWORD;
    this.journalName = process.env.DAYONE_JOURNAL_ID || 'Blog Public';
    this.downloadDir = path.join(__dirname, '..', 'temp');
    
    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
    }
  }

  async exportJournal() {
    let browser;
    
    try {
      console.log('Starting Day One web export...');
      
      browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      });

      const page = await browser.newPage();
      
      // Set download behavior
      await page._client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: this.downloadDir
      });

      // Navigate to Day One web
      await page.goto('https://dayone.me/login', { waitUntil: 'networkidle2' });
      
      // Login
      await this.login(page);
      
      // Navigate to export
      await this.navigateToExport(page);
      
      // Select journal and export
      const exportedFile = await this.performExport(page);
      
      console.log(`Export completed: ${exportedFile}`);
      return exportedFile;
      
    } catch (error) {
      console.error('Day One web export failed:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async login(page) {
    console.log('Logging into Day One...');
    
    // Wait for login form
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    
    // Enter credentials
    await page.type('input[type="email"]', this.email);
    await page.type('input[type="password"]', this.password);
    
    // Submit login
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.click('button[type="submit"], input[type="submit"]')
    ]);
    
    // Check if login was successful
    const currentUrl = page.url();
    if (currentUrl.includes('login')) {
      throw new Error('Login failed - check credentials');
    }
    
    console.log('Login successful');
  }

  async navigateToExport(page) {
    console.log('Navigating to export page...');
    
    // Look for export/settings menu
    const exportSelectors = [
      'a[href*="export"]',
      'button[aria-label*="export"]',
      'button[aria-label*="Export"]',
      '.export-button',
      '[data-testid*="export"]'
    ];
    
    let exportButton = null;
    for (const selector of exportSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        exportButton = await page.$(selector);
        if (exportButton) break;
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (!exportButton) {
      // Try to find export through menu
      const menuSelectors = [
        'button[aria-label*="menu"]',
        'button[aria-label*="Menu"]',
        '.menu-button',
        '[data-testid*="menu"]'
      ];
      
      for (const selector of menuSelectors) {
        try {
          const menuButton = await page.$(selector);
          if (menuButton) {
            await menuButton.click();
            await page.waitForTimeout(1000);
            
            // Look for export option in menu
            for (const exportSelector of exportSelectors) {
              try {
                exportButton = await page.$(exportSelector);
                if (exportButton) break;
              } catch (e) {
                // Continue
              }
            }
            if (exportButton) break;
          }
        } catch (e) {
          // Continue to next menu selector
        }
      }
    }
    
    if (!exportButton) {
      throw new Error('Could not find export button on Day One web interface');
    }
    
    await exportButton.click();
    await page.waitForTimeout(2000);
  }

  async performExport(page) {
    console.log('Performing export...');
    
    // Select journal if needed
    const journalSelector = `option[value*="${this.journalName}"], option:contains("${this.journalName}")`;
    try {
      await page.waitForSelector('select', { timeout: 5000 });
      await page.select('select', this.journalName);
    } catch (e) {
      console.log('No journal selector found, using default');
    }
    
    // Select JSON format if available
    const formatSelectors = [
      'input[value="json"]',
      'option[value="json"]',
      'button[data-format="json"]'
    ];
    
    for (const selector of formatSelectors) {
      try {
        const formatOption = await page.$(selector);
        if (formatOption) {
          await formatOption.click();
          break;
        }
      } catch (e) {
        // Continue
      }
    }
    
    // Click export button
    const exportButtonSelectors = [
      'button:contains("Export")',
      'input[value*="Export"]',
      'button[type="submit"]',
      '.export-submit'
    ];
    
    let exportSubmitted = false;
    for (const selector of exportButtonSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          await button.click();
          exportSubmitted = true;
          break;
        }
      } catch (e) {
        // Continue
      }
    }
    
    if (!exportSubmitted) {
      throw new Error('Could not find export submit button');
    }
    
    // Wait for download
    console.log('Waiting for download...');
    await page.waitForTimeout(10000); // Wait for export to process
    
    // Check for downloaded file
    const files = fs.readdirSync(this.downloadDir);
    const exportFile = files.find(f => 
      f.includes('export') || 
      f.includes('journal') || 
      f.endsWith('.json') || 
      f.endsWith('.zip')
    );
    
    if (!exportFile) {
      throw new Error('Export file not found in download directory');
    }
    
    return path.join(this.downloadDir, exportFile);
  }

  async extractAndParseExport(filePath) {
    try {
      let jsonData;
      
      if (filePath.endsWith('.zip')) {
        // Handle ZIP file
        const AdmZip = require('adm-zip');
        const zip = new AdmZip(filePath);
        const entries = zip.getEntries();
        
        const jsonEntry = entries.find(entry => entry.entryName.endsWith('.json'));
        if (!jsonEntry) {
          throw new Error('No JSON file found in export ZIP');
        }
        
        jsonData = JSON.parse(jsonEntry.getData().toString('utf8'));
      } else {
        // Handle direct JSON file
        jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
      
      // Filter entries for the specific journal
      const entries = jsonData.entries || [];
      const blogEntries = entries.filter(entry => {
        const journal = entry.journal || entry.journalName || '';
        return journal.toLowerCase().includes(this.journalName.toLowerCase());
      });
      
      console.log(`Found ${blogEntries.length} entries in ${this.journalName} journal`);
      return blogEntries;
      
    } catch (error) {
      console.error('Error parsing export file:', error);
      throw error;
    }
  }

  cleanup() {
    // Clean up temporary files
    if (fs.existsSync(this.downloadDir)) {
      const files = fs.readdirSync(this.downloadDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(this.downloadDir, file));
      });
    }
  }
}

module.exports = DayOneWebExporter;