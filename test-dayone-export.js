#!/usr/bin/env node

const DayOneWebExporter = require('./lib/dayOneWebExporter');

async function testDayOneExport() {
  console.log('🧪 Testing Day One Web Export\n');
  
  // Check environment variables
  console.log('Environment Check:');
  console.log('- DAYONE_EMAIL:', process.env.DAYONE_EMAIL ? '✓ Set' : '❌ Missing');
  console.log('- DAYONE_PASSWORD:', process.env.DAYONE_PASSWORD ? '✓ Set' : '❌ Missing');
  console.log('- DAYONE_JOURNAL_ID:', process.env.DAYONE_JOURNAL_ID || 'Blog Public (default)');
  console.log('');

  if (!process.env.DAYONE_EMAIL || !process.env.DAYONE_PASSWORD) {
    console.log('❌ Missing Day One credentials!');
    console.log('Set them with:');
    console.log('export DAYONE_EMAIL="your@email.com"');
    console.log('export DAYONE_PASSWORD="yourpassword"');
    console.log('export DAYONE_JOURNAL_ID="Blog Public"');
    process.exit(1);
  }

  const exporter = new DayOneWebExporter();
  
  try {
    console.log('🚀 Starting export test...\n');
    
    // Test the export
    const exportFile = await exporter.exportJournal();
    console.log('✅ Export file created:', exportFile);
    
    // Test parsing the export
    const entries = await exporter.extractAndParseExport(exportFile);
    console.log('✅ Entries parsed:', entries.length);
    
    if (entries.length > 0) {
      console.log('\n📝 Sample entry:');
      const sample = entries[0];
      console.log('- UUID:', sample.uuid);
      console.log('- Title:', sample.title || 'No title');
      console.log('- Creation Date:', sample.creationDate);
      console.log('- Text Length:', sample.text ? sample.text.length : 0, 'characters');
      console.log('- Tags:', sample.tags || []);
      console.log('- Photos:', sample.photos ? sample.photos.length : 0);
    } else {
      console.log('⚠️  No entries found in export');
      console.log('   Make sure you have entries in your "Blog Public" journal');
    }
    
  } catch (error) {
    console.error('❌ Export failed:', error.message);
    console.error('Full error:', error);
  } finally {
    // Cleanup
    exporter.cleanup();
    console.log('\n🧹 Cleanup completed');
  }
}

// Handle process exit
process.on('SIGINT', () => {
  console.log('\n👋 Test interrupted');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
  process.exit(1);
});

// Run the test
testDayOneExport();