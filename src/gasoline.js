const axios = require('axios');
const cheerio = require('cheerio');

async function getGasolinePrices() {
  try {
    console.log('Fetching gasoline prices from giaxanghomnay.com...');
    const { data } = await axios.get('https://giaxanghomnay.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000 // 10s timeout
    });

    const $ = cheerio.load(data);
    const prices = [];

    const table = $('table').first();
    if (!table.length) {
      console.error('Could not find any tables on the page.');
      return null;
    }

    table.find('tr').each((i, el) => {
      if (i === 0) return; // Skip header

      const cols = $(el).find('td');
      if (cols.length >= 5) {
        const name = $(cols[0]).text().trim();
        const zone1 = $(cols[3]).text().trim();
        const zone2 = $(cols[4]).text().trim();
        
        if (name && zone1 && zone2) {
          prices.push({ name, zone1, zone2 });
        }
      }
    });

    if (prices.length === 0) {
      console.warn('Scraped successfully but found 0 prices. Check if the table structure has changed.');
    } else {
      console.log(`Successfully scraped ${prices.length} gasoline products.`);
    }

    return prices;
  } catch (error) {
    console.error('Error fetching gasoline prices:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
    }
    return null;
  }
}

module.exports = { getGasolinePrices };
