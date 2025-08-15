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
      console.log('Email:', this.email ? 'Set' : 'Missing');
      console.log('Password:', this.password ? 'Set' : 'Missing');
      console.log('Journal Name:', this.journalName);
      
      const launchOptions = {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 
                       '/usr/bin/google-chrome-stable' || 
                       '/usr/bin/chromium-browser',
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
      };

      browser = await puppeteer.launch(launchOptions);

      const page = await browser.newPage();
      
      // Set download behavior
      const client = await page.createCDPSession();
      await client.send('Page.setDownloadBehavior', {
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
    
    try {
      // Step 1: First open the journals sidebar and select the specific journal
      console.log(`Selecting journal: ${this.journalName}`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for page to fully load
      
      // Open journals sidebar if it's not visible
      try {
        console.log('Opening journals sidebar...');
        await page.click('button[aria-label="Toggle Journals Sidebar"]');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        console.log('Sidebar toggle not found or already open');
      }
      
      // Try to click on the journal name in sidebar
      try {
        console.log('Looking for journal in sidebar...');
        await page.waitForXPath(`//text()[contains(., '${this.journalName}')]`, { timeout: 5000 });
        const [journalElement] = await page.$x(`//text()[contains(., '${this.journalName}')]/..`);
        if (journalElement) {
          console.log('Found journal, clicking...');
          await journalElement.click();
          await new Promise(resolve => setTimeout(resolve, 2000));
          console.log('Journal selected, waiting for interface to load...');
        }
      } catch (e) {
        console.log('Could not select specific journal, continuing with current journal...');
      }
      
      // Step 2: Click Edit Journal dropdown
      console.log('Clicking Edit Journal dropdown...');
      console.log('Current URL:', page.url());
      
      // Debug: Take screenshot and log available buttons
      await page.screenshot({ path: 'debug-before-edit-journal.png' });
      const buttons = await page.$$eval('button', buttons => 
        buttons.map(btn => ({
          text: btn.textContent?.trim(),
          ariaLabel: btn.getAttribute('aria-label'),
          className: btn.className
        }))
      );
      console.log('Available buttons:', JSON.stringify(buttons, null, 2));
      
      // Try alternative buttons if Edit Journal isn't found
      try {
        await page.waitForSelector('button[aria-label="Edit Journal"]', { timeout: 5000 });
        await page.click('button[aria-label="Edit Journal"]');
      } catch (e) {
        console.log('Edit Journal button not found, trying Open Settings...');
        await page.waitForSelector('button[aria-label="Open Settings"]', { timeout: 5000 });
        await page.click('button[aria-label="Open Settings"]');
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 3: Click Journal Settings from dropdown
      console.log('Clicking Journal Settings...');
      await page.waitForXPath("//text()[contains(., 'Journal Settings')]", { timeout: 5000 });
      const [settingsElement] = await page.$x("//text()[contains(., 'Journal Settings')]/..");
      if (settingsElement) await settingsElement.click();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 4: Click Export Journal button in modal
      console.log('Clicking Export Journal...');
      await page.waitForSelector('button.components-button.abebd-b-e-d-edcdc-xu2lrv', { timeout: 5000 });
      await page.click('button.components-button.abebd-b-e-d-edcdc-xu2lrv');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Successfully navigated to export');
      
    } catch (error) {
      console.error('Failed to navigate to export:', error);
      await page.screenshot({ path: 'export-error-screenshot.png' });
      throw new Error(`Could not navigate to export: ${error.message}`);
    }
  }

  async performExport(page) {
    console.log('Performing export...');
    
    try {
      // Step 5: Click the final export JSON button and handle download
      console.log('Clicking Export journal JSON file button...');
      
      // Wait for the export modal to appear with the JSON button
      await page.waitForXPath("//button[contains(text(), 'Export journal JSON file')]", { timeout: 10000 });
      
      // Set up download monitoring before clicking
      const downloadPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Download timeout after 30 seconds'));
        }, 30000);
        
        page.on('response', async (response) => {
          if (response.url().includes('download') || response.url().includes('export')) {
            console.log('Download response detected:', response.url());
            clearTimeout(timeout);
            
            // Save the response as a file
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${this.journalName}_${timestamp}.json`;
            const filepath = path.join(this.downloadDir, filename);
            
            const buffer = await response.buffer();
            fs.writeFileSync(filepath, buffer);
            
            resolve(filepath);
          }
        });
      });
      
      // Click the export button
      await page.click('button.components-button.abebd-b-e-d-edcdc-9lyp6o.is-primary');
      
      // Wait for download to complete
      const exportFile = await downloadPromise;
      
      console.log(`Export completed successfully! Saved as: ${exportFile}`);
      return exportFile;
      
    } catch (error) {
      console.error('Export execution failed:', error);
      await page.screenshot({ path: 'export-execution-error.png' });
      
      // Fallback: check if file was downloaded to default download directory
      try {
        const files = fs.readdirSync(this.downloadDir);
        const exportFile = files.find(f => 
          f.includes('export') || 
          f.includes('journal') || 
          f.endsWith('.json') || 
          f.endsWith('.zip')
        );
        
        if (exportFile) {
          console.log('Found export file via fallback method:', exportFile);
          return path.join(this.downloadDir, exportFile);
        }
      } catch (fallbackError) {
        console.error('Fallback method also failed:', fallbackError);
      }
      
      throw new Error(`Export failed: ${error.message}`);
    }
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