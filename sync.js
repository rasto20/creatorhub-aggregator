const Parser = require('rss-parser');
const { createClient } = require('@supabase/supabase-js');

// Configure parser with real browser headers to bypass 403 blocks
const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/rdf+xml, application/xml;q=0.9, text/xml;q=0.8'
  }
});

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Targets high-traffic Kenyan feeds using alternative open proxy bridges
const TARGET_FEEDS = [
  { creator: 'Techweez', platform: 'Blog', url: 'https://techweez.com' },
  { creator: 'Tuko News', platform: 'Blog', url: 'https://tuko.co.ke' },
  { creator: 'Trending Kenya', platform: 'TikTok', url: 'https://vercel.app' }, // Stable backup proxy
  { creator: 'Nairobi Trends', platform: 'X', url: 'https://vercel.app' },     // Stable backup proxy
  { creator: 'Andrew Kibe', platform: 'YouTube', url: 'https://youtube.com' }
];

async function runPipeline() {
  console.log("🚀 Launching hands-off legal aggregator with headers...");
  let payload = [];

  for (const feed of TARGET_FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      
      for (const item of parsed.items) {
        if (!item.link) continue;

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
      console.log(`✅ Successfully parsed ${feed.creator}`);
    } catch (e) {
      console.log(`⚠️ Skipping ${feed.creator} due to proxy limits:`, e.message);
    }
  }

  if (payload.length > 0) {
    const { error } = await supabase
      .from('creator_feed')
      .upsert(payload, { onConflict: 'content_link', ignoreDuplicates: true });

    if (error) console.error("❌ Database sync failed:", error.message);
    else console.log(`✨ Successfully compiled ${payload.length} items into Supabase!`);
  } else {
    console.log("⚠️ No items were compiled during this run.");
  }
}

runPipeline();
