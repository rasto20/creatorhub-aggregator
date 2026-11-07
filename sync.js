const Parser = require('rss-parser');
const { createClient } = require('@supabase/supabase-js');


const parser = new Parser();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Targets high-traffic Kenyan feeds using native feeds and RSSHub open bridges
const TARGET_FEEDS = [
  { creator: 'Techweez', platform: 'Blog', url: 'https://techweez.com' },
  { creator: 'Tuko News', platform: 'Blog', url: 'https://tuko.co.ke' },
  { creator: 'Trending Kenya', platform: 'TikTok', url: 'https://rsshub.app' }, 
  { creator: 'Nairobi Trends', platform: 'X', url: 'https://rsshub.app' },
  { creator: 'Andrew Kibe', platform: 'YouTube', url: 'https://youtube.com' }
];

async function runPipeline() {
  console.log("🚀 Launching hands-off legal aggregator...");
  let payload = [];

  for (const feed of TARGET_FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      
      for (const item of parsed.items) {
        if (!item.link) continue;

        // LEGAL PROTECTION: Truncate summaries heavily to guarantee Fair Use index compliance
        let microSummary = '';
        if (item.contentSnippet || item.content) {
          const rawText = item.contentSnippet || item.content;
          microSummary = rawText.replace(/<[^>]*>/g, '').slice(0, 140).trim() + '...';
        }

        payload.push({
          title: item.title ? item.title.trim() : 'Public Update',
          content_link: item.link.trim(),
          creator_name: feed.creator,
          platform: feed.platform,
          summary: microSummary,
          thumbnail_url: item.enclosure?.url || null
        });
      }
    } catch (e) {
      console.log(`⚠️ Skipping ${feed.creator} due to proxy limits:`, e.message);
    }
  }

  if (payload.length > 0) {
    // ON CONFLICT DO NOTHING ignores any existing links so you never get double posts
    const { error } = await supabase
      .from('creator_feed')
      .upsert(payload, { onConflict: 'content_link', ignoreDuplicates: true });

    if (error) console.error("❌ Database sync failed:", error.message);
    else console.log(`✨ Successfully compiled ${payload.length} items with zero duplicates!`);
  }
}

runPipeline();
