const https = require('https');

class TradeAIService {
  constructor() {
    this.models = ['gemini-3-flash-preview', 'gemma-4-26b-a4b-it'];
    this.defaultApiKey = process.env.GEMINI_API_KEY || '';
  }

  getApiKey() {
    return process.env.GEMINI_API_KEY || this.defaultApiKey;
  }

  requestGemini(model, apiKey, prompt) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000
        }
      });

      const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey.trim())}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 15000
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const data = JSON.parse(body);
              const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                resolve(text.trim());
              } else {
                reject(new Error('No text returned in Gemini response'));
              }
            } catch (err) {
              reject(new Error(`Failed to parse Gemini response: ${err.message}`));
            }
          } else {
            reject(new Error(`Gemini API returned status ${res.statusCode}: ${body.slice(0, 150)}`));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Gemini request to ${model} timed out`));
      });

      req.write(payload);
      req.end();
    });
  }

  async generateResponse(systemPrompt, userQuery) {
    const apiKey = this.getApiKey();
    const fullPrompt = `${systemPrompt}\n\nUSER QUESTION / REQUEST:\n${userQuery}`;

    // Try primary then fallback models
    for (const model of this.models) {
      try {
        const text = await this.requestGemini(model, apiKey, fullPrompt);
        return {
          success: true,
          model,
          response: text
        };
      } catch (err) {
        console.warn(`[AI SERVICE] Model ${model} failed: ${err.message}. Trying next model...`);
      }
    }

    // Fallback: Resilient offline knowledge base
    console.warn('[AI SERVICE] All remote Gemini models failed. Using offline Nigerian trades fallback.');
    return {
      success: true,
      model: 'offline-artisan-knowledge',
      response: this.getOfflineAdvice(userQuery)
    };
  }

  /**
   * General Trade Advice & Workshop Mentorship
   */
  async getTradeAdvice(query, tradeCategory = 'General Trade') {
    const systemPrompt = `You are 'Job Booking AI', a highly experienced, friendly, and practical Nigerian Trade Master & Workshop Advisor.
You mentor and advise Nigerian artisans and small business owners:
- Tailors & Fashion Designers (Ankara, Senegalese, Agbada, suits, lace, measurements, darting, lining)
- Auto Mechanics & Panel Beaters (Japanese & German cars, Toyota/Honda/Mercedes, engine diagnostics, transmission, Tokunbo parts, painting, suspension)
- Carpenters & Furniture Makers (Hardwood like Iroko, Teak, Obeche, MDF, polishing, varnishing, joinery, hinges)
- Electricians & Solar/Inverter Handiworkers (Wiring, changeover switches, inverters, load balancing, conduit piping)
- Plumbers & Handiworkers (PPR pipes, surface pumps, sanitary fittings, leak repairs)

Guidelines:
1. Always be practical, respectful, and direct. Use friendly professional Nigerian workshop English (e.g. welcoming them warmly, clear terms).
2. Give clear step-by-step points so it is easy to follow on a mobile phone.
3. Mention relevant tools, parts, or material considerations.
4. Include any necessary safety tips (e.g. battery disconnect, eye protection, grounding).
5. If relevant, suggest how to communicate the issue clearly to the customer.`;

    const cleanQuery = `[Trade Category: ${tradeCategory}]\n${query}`;
    return this.generateResponse(systemPrompt, cleanQuery);
  }

  /**
   * Helper to suggest job scope, inspection points, and completion timeframe for New Job Form
   */
  async suggestJobDetails(itemJob) {
    const systemPrompt = `You are 'Job Booking AI', an expert workshop manager for Nigerian artisans and mechanics.
Given an item or repair job name, provide:
1. "Suggested Job Details": A concise, bulleted scope of work, inspection points, and specifications the artisan should write on the job card.
2. "Estimated Turnaround": Recommended realistic completion timeframe in days (taking into account parts sourcing or power fluctuations in Nigeria).
3. "Pro Artisan Tip": One important tip for doing this job cleanly and avoiding customer complaints.

Format your output clearly with headings:
- **Recommended Scope & Inspection:**
- **Estimated Turnaround:** (e.g. 2 to 3 days)
- **Pro Tip:**`;

    return this.generateResponse(systemPrompt, `Item / Job title: ${itemJob}`);
  }

  /**
   * Resilient offline advice generator when offline
   */
  getOfflineAdvice(query) {
    const q = (query || '').toLowerCase();

    if (q.includes('overheat') || q.includes('radiator') || q.includes('camry') || q.includes('car') || q.includes('mechanic')) {
      return `### 🚗 Auto Mechanic Advice & Troubleshooting:
1. **Cooling System Check:** Inspect radiator cap pressure, top-up coolant mix, check thermostat opening temperature.
2. **Fan Operation:** Confirm radiator fans kick in at operating temperature (relay & sensor test).
3. **Water Pump & Belts:** Verify serpentine belt tension and inspect water pump for weeping or play.
4. **Safety First:** Never open a hot radiator cap. Allow the engine to cool down completely before releasing pressure.
5. **Customer Advice:** Explain to the customer that driving with high engine temperature can warp cylinder heads or blow the head gasket.`;
    }

    if (q.includes('sew') || q.includes('agbada') || q.includes('ankara') || q.includes('gown') || q.includes('fabric') || q.includes('tailor')) {
      return `### 🧵 Tailoring & Fashion Design Advice:
1. **Fabric Measurement & Shrinkage:** Always pre-iron and check Ankara or Guinea Brocade for pre-shrinkage before cutting.
2. **Pattern & Symmetry:** Fold fabric in 4 equal parts when cutting Agbada necklines or flared panels to maintain symmetry.
3. **Interfacing & Finishing:** Use good quality collar stay/gumstay on collars and Senator neck bands to prevent bubbling after washing.
4. **Fitting Allowance:** Leave 1.5 to 2 inches inner margin for seam adjustment in case the customer requests fitting adjustments.
5. **Delivery Checklist:** Steam press neatly, trim all loose threads, and inspect all zips and buttonholes before customer collection.`;
    }

    if (q.includes('table') || q.includes('wood') || q.includes('carpenter') || q.includes('chair') || q.includes('furniture')) {
      return `### 🪚 Carpentry & Woodwork Advice:
1. **Timber Moisture & Curing:** Ensure timber (Iroko, Teak, or Mahogany) is properly seasoned to prevent warping or splitting.
2. **Joinery:** Use mortise and tenon or heavy dowels for load-bearing joints like dining table legs and chair stretchers.
3. **Sanding Sequence:** Sand progressively with 80-grit, 120-grit, then 240-grit before applying sanding sealer.
4. **Durable Finish:** Apply 2 to 3 coats of polyurethane lacquer or gloss varnish, sanding lightly between coats for a smooth finish.
5. **Care Tip for Customer:** Advise the customer to keep natural wood away from standing water and clean with a damp microfiber cloth.`;
    }

    return `### 🛠️ Master Artisan Advice:
1. **Detailed Scope:** Confirm exact customer requirements and inspect existing condition before taking deposit.
2. **Quality Materials:** Never compromise on crucial parts (e.g. Tokunbo genuine parts or high-grade thread/screws) as callbacks damage reputation.
3. **Timelines:** Always add 1 extra buffer day to your estimate to cater for power cuts or parts sourcing.
4. **Customer Communication:** Send updates via WhatsApp if additional issues are discovered during disassembly.
5. **Inspection Before Handover:** Double-check every function before the customer arrives on collection date.`;
  }
}

module.exports = new TradeAIService();
