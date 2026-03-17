const express = require('express');
const router = express.Router();
const axios = require('axios');

const NEWS_FEED = 'https://www.starazagora.bg/bg/rss/news/4';
const EVENTS_FEED = 'https://www.starazagora.bg/bg/rss/news/181';

function parseItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`));
      return m ? (m[1] || m[2] || '').trim() : '';
    };
    const imgMatch = block.match(/enclosure url="([^"]+)"/);
    items.push({
      title: get('title'),
      link: get('link'),
      description: get('description').replace(/&amp;[a-z#0-9]+;/g, ' ').replace(/<[^>]+>/g, '').trim(),
      pubDate: get('pubDate'),
      image: imgMatch ? imgMatch[1] : null,
    });
  }
  return items;
}

// GET /api/news
router.get('/', async (req, res) => {
  try {
    const [newsRes, eventsRes] = await Promise.allSettled([
      axios.get(NEWS_FEED, { timeout: 8000, responseType: 'text' }),
      axios.get(EVENTS_FEED, { timeout: 8000, responseType: 'text' }),
    ]);

    const news = newsRes.status === 'fulfilled' ? parseItems(newsRes.value.data).slice(0, 5) : [];
    const events = eventsRes.status === 'fulfilled' ? parseItems(eventsRes.value.data).slice(0, 5) : [];

    res.json({ success: true, news, events });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
