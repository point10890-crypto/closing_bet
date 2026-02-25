import { NextRequest, NextResponse } from 'next/server';
import krStocks from '@/data/kr-stocks.json';

const US_POPULAR = [
  ['AAPL', 'Apple'], ['MSFT', 'Microsoft'], ['GOOGL', 'Alphabet'],
  ['AMZN', 'Amazon'], ['NVDA', 'NVIDIA'], ['META', 'Meta Platforms'],
  ['TSLA', 'Tesla'], ['BRK-B', 'Berkshire Hathaway'], ['JPM', 'JPMorgan Chase'],
  ['V', 'Visa'], ['UNH', 'UnitedHealth'], ['MA', 'Mastercard'],
  ['HD', 'Home Depot'], ['PG', 'Procter & Gamble'], ['JNJ', 'Johnson & Johnson'],
  ['COST', 'Costco'], ['ABBV', 'AbbVie'], ['CRM', 'Salesforce'],
  ['MRK', 'Merck'], ['AVGO', 'Broadcom'], ['KO', 'Coca-Cola'],
  ['PEP', 'PepsiCo'], ['TMO', 'Thermo Fisher'], ['AMD', 'AMD'],
  ['NFLX', 'Netflix'], ['ADBE', 'Adobe'], ['DIS', 'Disney'],
  ['INTC', 'Intel'], ['QCOM', 'Qualcomm'], ['CSCO', 'Cisco'],
  ['BA', 'Boeing'], ['GS', 'Goldman Sachs'], ['CAT', 'Caterpillar'],
  ['IBM', 'IBM'], ['GE', 'GE Aerospace'], ['UBER', 'Uber'],
  ['PLTR', 'Palantir'], ['COIN', 'Coinbase'], ['MSTR', 'MicroStrategy'],
  ['ARM', 'ARM Holdings'], ['SMCI', 'Super Micro'], ['MU', 'Micron'],
  ['SNOW', 'Snowflake'], ['PANW', 'Palo Alto Networks'], ['CRWD', 'CrowdStrike'],
  ['SQ', 'Block'], ['SHOP', 'Shopify'], ['ROKU', 'Roku'],
  ['SOFI', 'SoFi'], ['RIVN', 'Rivian'],
];

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') || '').trim().toLowerCase();
  const market = (request.nextUrl.searchParams.get('market') || 'all').trim().toLowerCase();

  if (!q) return NextResponse.json([]);

  const results: Array<{ name: string; ticker: string; code: string; market: string; type: string }> = [];

  // 1) KR stocks
  if ((market === 'kr' || market === 'all') && results.length < 20) {
    for (const s of krStocks as Array<{ t: string; y: string; n: string; m: string }>) {
      if (s.n.toLowerCase().includes(q) || s.t.toLowerCase().includes(q) || s.y.toLowerCase().includes(q)) {
        results.push({ name: s.n, ticker: s.y, code: s.t, market: s.m, type: 'KR' });
        if (results.length >= 20) break;
      }
    }
  }

  // 2) US popular stocks
  if ((market === 'us' || market === 'all') && results.length < 20) {
    for (const [ticker, name] of US_POPULAR) {
      if (ticker.toLowerCase().includes(q) || name.toLowerCase().includes(q)) {
        results.push({ name, ticker, code: ticker, market: 'US', type: 'US' });
        if (results.length >= 20) break;
      }
    }
  }

  // 3) Direct US ticker input
  if (results.length === 0 && /^[a-zA-Z]{1,5}$/.test(q)) {
    results.push({ name: q.toUpperCase(), ticker: q.toUpperCase(), code: q.toUpperCase(), market: 'US', type: 'US_DIRECT' });
  }

  return NextResponse.json(results);
}
