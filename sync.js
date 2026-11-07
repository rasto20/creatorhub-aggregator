const Parser = require('rss-parser');
const { createClient } = require('@supabase/supabase-js');

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Accept': 'application/rss+xml, application/xml'
  }
});

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// High-availability open content feeds that never block server automated requests
const TARGET_FEEDS = [
  { creator: 'DevTo Open Tech', platform: 'Blog', url: 'https://dev.to' },
  { creator: 'FreeCodeCamp Core', platform: 'Blog', url: 'https://freecodecamp.org' },
  { creator: 'TechCrunch Trends', platform: 'Blog', url: 'https://techcrunch.com' }
];

async function runPipeline() {
  console.log("🚀 Launching high-availability legal aggregator pipeline...");
  let payload = [];

  for (const feed of TARGET_FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      console.log(`✅ Connection established with ${feed.creator}`);
      
      // Limit to top 5 items per source to prevent database bloat
      const topItems = parsed.items.slice(0, 5);
      
      for (const item of topItems) {
        if (!item.link) continue;

        let microSummary = '';
        if (item.contentSnippet || item.content) {
          const rawText = item.contentSnippet || item.content;
          microSummary = rawText.replace(/<[^>]*>/g, '').slice(0, 140).trim() + '...';
        }

        payload.push({
          title: item.title ? item.title.trim() : 'Global Update',
          content_link: item.link.trim(),
          creator_name: feed.creator,
          platform: feed.platform,
          summary: microSummary,
          thumbnail_url: item.enclosure?.url || null
        });
      }
    } catch (e) {
      console.log(`⚠️ Connection limit on ${feed.creator}:`, e.message);
    }
  }

  if (payload.length > 0) {
    const { error } = await supabase
      .from('creator_feed')
      .upsert(payload, { onConflict: 'content_link', ignoreDuplicates: true });

    if (error) console.error("❌ Database synchronization error:", error.message);
    else console.log(`✨ Successfully written ${payload.length} content nodes to Supabase cluster!`);
  } else {
    console.log("⚠️ No raw item arrays compiled during this processing track.");
  }
}

runPipeline();
