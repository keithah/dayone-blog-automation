#!/usr/bin/env node

const DayOneApiExporter = require('./lib/dayOneApiExporter');

async function testApiExport() {
  console.log('🧪 Testing Day One API Export\n');

  // Check environment variables
  console.log('Environment Check:');
  console.log('- DAYONE_EMAIL:', process.env.DAYONE_EMAIL ? '✓ Set' : '✗ Missing');
  console.log('- DAYONE_PASSWORD:', process.env.DAYONE_PASSWORD ? '✓ Set' : '✗ Missing');
  console.log('- DAYONE_JOURNAL_ID:', process.env.DAYONE_JOURNAL_ID || 'Blog Public');
  console.log();

  if (!process.env.DAYONE_EMAIL || !process.env.DAYONE_PASSWORD) {
    console.log('❌ Missing required environment variables');
    console.log('Please set DAYONE_EMAIL and DAYONE_PASSWORD');
    process.exit(1);
  }

  const exporter = new DayOneApiExporter();

  try {
    console.log('🚀 Starting API export test...\n');

    // Step 1: Export journal
    const exportFile = await exporter.exportJournal();
    console.log(`✅ Export file created: ${exportFile}`);

    // Step 2: Parse the export
    console.log('\n📊 Parsing export file...');
    const entries = await exporter.extractAndParseExport(exportFile);
    console.log(`✅ Found ${entries.length} entries`);

    if (entries.length > 0) {
      console.log('\n📝 Sample entry:');
      const sampleEntry = entries[0];
      console.log('- UUID:', sampleEntry.uuid);
      console.log('- Title:', sampleEntry.title || 'No title');
      console.log('- Created:', sampleEntry.creationDate);
      console.log('- Tags:', sampleEntry.tags || []);
      console.log('- Text preview:', (sampleEntry.text || '').substring(0, 100) + '...');
      console.log('- Attachments:', sampleEntry.attachments?.length || 0);
    }

    console.log('\n🎉 API export test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Export failed:', error.message);
    console.log('Full error:', error);
    process.exit(1);
  } finally {
    console.log('\n🧹 Cleanup completed');
    exporter.cleanup();
  }
}

// Run the test if called directly
if (require.main === module) {
  testApiExport();
}

module.exports = testApiExport;