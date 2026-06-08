import Anthropic from "@anthropic-ai/sdk";
import fs from "fs/promises";
import path from "path";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function fetchCryptoPrices() {
  const ids = "bitcoin,ethereum,solana,binancecoin,chainlink";
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetch(url);
  return await res.json();
}

async function fetchNews() {
  const topics = ["artificial intelligence technology","bitcoin cryptocurrency","space technology NASA","biotech drug discovery","stock market finance tech"];
  const key = process.env.NEWS_API_KEY;
  const yesterday = new Date(Date.now() - 48*60*60*1000).toISOString().split("T")[0];
  const articles = [];
  for (const q of topics) {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&from=${yesterday}&sortBy=relevancy&language=en&pageSize=3&apiKey=${key}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.articles) articles.push(...data.articles.slice(0,2));
    } catch(e) { console.warn("news error:", e.message); }
  }
  return articles.filter(a => a.title && a.description)
    .map(a => `TITLE: ${a.title}\nSOURCE: ${a.source?.name}\nDATE: ${a.publishedAt?.split("T")[0]}\nSUMMARY: ${a.description}`)
    .join("\n\n---\n\n");
}

async function generateNewsletter(prices, news) {
  const today = new Date().toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
  const template = await fs.readFile(path.join(process.cwd(), "index.html"), "utf-8");

  const btc = prices.bitcoin;
  const eth = prices.ethereum;
  const sol = prices.solana;

  const prompt = `You are the editor of Data Sinapsis, a world-class daily intelligence newsletter for academics, researchers, investors and technologists covering AI, technology, stocks, space, biotech, DeFi, Web3 and innovation.

Today is ${today}.

LIVE PRICES:
- Bitcoin: $${btc?.usd?.toLocaleString()} (${btc?.usd_24h_change?.toFixed(2)}% 24h)
- Ethereum: $${eth?.usd?.toLocaleString()} (${eth?.usd_24h_change?.toFixed(2)}% 24h)
- Solana: $${sol?.usd?.toFixed(1)} (${sol?.usd_24h_change?.toFixed(2)}% 24h)

TODAY'S NEWS:
${news}

YOUR TASK:
Using the HTML template provided, update ALL content sections with today's real news. Keep ALL CSS, styles, nav, and structure identical. Only replace:
1. The date and issue number
2. The promo banner headline
3. All article headlines, deks, and body text
4. Market prices in the sidebar widget
5. The 8 digest items at the bottom

Pick the most impactful story as the lead. Tone: analytical, sophisticated, global. English only.

OUTPUT: Return ONLY complete valid HTML starting with <!DOCTYPE html>. No markdown, no explanation.

TEMPLATE:
${template}`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }]
  });

  return response.content.filter(b => b.type === "text").map(b => b.text).join("").replace(/^```html\n?/i,"").replace(/\n?```$/i,"").trim();
}

async function main() {
  console.log("🚀 Data Sinapsis generating...");
  const [prices, news] = await Promise.all([fetchCryptoPrices(), fetchNews()]);
  const html = await generateNewsletter(prices, news);
  await fs.writeFile(path.join(process.cwd(), "index.html"), html);
  console.log("✅ Done! index.html updated.");
}

main().catch(e => { console.error(e); process.exit(1); });
