const https = require('https');

class TradeAIService {
  constructor() {
    this.models = ['gemini-3-flash-preview', 'gemma-4-26b-a4b-it'];
    this.defaultApiKey = process.env.GEMINI_API_KEY || '';
  }

  getApiKey() {
    return process.env.GEMINI_API_KEY || this.defaultApiKey;
  }

  getSystemPrompt(tradeCategory = 'General Trade') {
    return `You are 'Job Booking AI', an expert, highly experienced, and warm Nigerian Trade Master & Workshop Partner.
You are chatting with a Nigerian business owner, artisan, or mechanic in their workshop.
Trades you specialize in:
- Tailors & Fashion Designers (Ankara, Agbada, Senator, Senator collar, suit darting, lining, lace, fabric cuts)
- Auto Mechanics & Panel Beaters (Toyota, Honda, Mercedes, Tokunbo parts, engine diagnostics, electrical, transmission, brake boosters, cooling systems)
- Carpenters & Furniture Makers (Iroko, Teak, Obeche, Mahogany, MDF, sanding, joinery, varnishing, polyurethane, cabinet hinges)
- Electricians & Solar/Inverter Technicians (Pure sine wave inverters, deep cycle/lithium batteries, cable sizing, conduit piping, changeover switches)
- Plumbers & Handiworkers (PPR pipes, surface/submersible pumps, valves, leak detection)

Personality & Conversational Style:
1. Speak naturally, warmly, and respectfully (e.g. welcoming them as 'boss' or 'my friend', clear Nigerian workshop English).
2. Answer conversationally. If they ask a follow-up, build on what was previously discussed in the chat.
3. Be direct, practical, and step-by-step.
4. Highlight safety precautions when relevant (disconnecting battery, safety goggles, circuit breakers).
5. Give pro workshop tips that save time and prevent customer disputes.
[Active Trade Focus: ${tradeCategory}]`;
  }

  requestGemini(model, apiKey, contents, systemPrompt = null) {
    return new Promise((resolve, reject) => {
      const payloadObj = {
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1200
        }
      };

      if (systemPrompt) {
        payloadObj.systemInstruction = {
          parts: [{ text: systemPrompt }]
        };
      }

      const payload = JSON.stringify(payloadObj);

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
                reject(new Error('No response text returned by model'));
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

  /**
   * Multi-turn conversational chat with Gemini
   */
  async chat(messages, tradeCategory = 'General Trade') {
    const apiKey = this.getApiKey();
    const systemPrompt = this.getSystemPrompt(tradeCategory);

    // Format conversation messages for Gemini API
    const formattedContents = messages.map(m => ({
      role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content || m.text || '').trim() }]
    })).filter(c => c.parts[0].text.length > 0);

    if (formattedContents.length === 0) {
      throw new Error('No message provided.');
    }

    // Try primary model then fallback model
    for (const model of this.models) {
      try {
        const text = await this.requestGemini(model, apiKey, formattedContents, systemPrompt);
        return {
          success: true,
          model,
          response: text
        };
      } catch (err) {
        console.warn(`[AI SERVICE] Model ${model} chat failed: ${err.message}. Trying next model...`);
      }
    }

    // Offline fallback if network is completely down
    const lastUserMsg = messages.filter(m => m.role === 'user').pop();
    const query = lastUserMsg ? lastUserMsg.content : '';
    return {
      success: true,
      model: 'offline-artisan-knowledge',
      response: this.getOfflineAdvice(query)
    };
  }

  /**
   * Single-turn trade advice (wraps into chat format)
   */
  async getTradeAdvice(query, tradeCategory = 'General Trade') {
    return this.chat([{ role: 'user', content: query }], tradeCategory);
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

    const contents = [{
      role: 'user',
      parts: [{ text: `Item / Job title: ${itemJob}` }]
    }];

    const apiKey = this.getApiKey();
    for (const model of this.models) {
      try {
        const text = await this.requestGemini(model, apiKey, contents, systemPrompt);
        return { success: true, model, response: text };
      } catch (err) {
        console.warn(`[AI SERVICE] Suggest details on ${model} failed: ${err.message}`);
      }
    }

    return {
      success: true,
      model: 'offline-artisan-knowledge',
      response: this.getOfflineAdvice(itemJob)
    };
  }

  /**
   * Resilient offline advice generator when offline
   */
  getOfflineAdvice(query) {
    const q = (query || '').toLowerCase();

    if (q.includes('overheat') || q.includes('radiator') || q.includes('camry') || q.includes('car') || q.includes('mechanic') || q.includes('brake') || q.includes('oil')) {
      return `### 🚗 Auto Mechanic Advice & Troubleshooting:
1. **Cooling & Oil System:** Inspect radiator cap pressure, check coolant level and oil viscosity.
2. **Fan Operation:** Confirm radiator fans kick in at operating temperature (relay & sensor test).
3. **Safety First:** Never open a hot radiator cap. Allow the engine to cool down completely before releasing pressure.
4. **Customer Communication:** Explain to the customer that driving with high engine temperature can warp cylinder heads.`;
    }

    if (q.includes('sew') || q.includes('agbada') || q.includes('ankara') || q.includes('gown') || q.includes('fabric') || q.includes('tailor') || q.includes('senator')) {
      return `### 🧵 Tailoring & Fashion Design Advice:
1. **Fabric Measurement & Shrinkage:** Always pre-iron and check Ankara or Guinea Brocade for pre-shrinkage before cutting.
2. **Pattern & Symmetry:** Fold fabric in 4 equal parts when cutting Agbada necklines or flared panels to maintain symmetry.
3. **Interfacing:** Use good quality gumstay on collars and Senator neck bands to prevent bubbling after washing.
4. **Fitting Allowance:** Leave 1.5 to 2 inches inner margin for seam adjustment in case the customer requests adjustments.`;
    }

    if (q.includes('table') || q.includes('wood') || q.includes('carpenter') || q.includes('chair') || q.includes('furniture')) {
      return `### 🪚 Carpentry & Woodwork Advice:
1. **Timber Moisture:** Ensure timber (Iroko, Teak, or Mahogany) is properly seasoned to prevent warping.
2. **Joinery:** Use mortise and tenon or heavy dowels for load-bearing joints.
3. **Durable Finish:** Apply 2 to 3 coats of polyurethane lacquer or gloss varnish, sanding lightly between coats.`;
    }

    return `### 🛠️ Master Artisan Advice:
1. **Detailed Scope:** Confirm exact customer requirements and inspect existing condition before taking deposit.
2. **Quality Materials:** Never compromise on crucial parts as callbacks damage workshop reputation.
3. **Timelines:** Always add 1 extra buffer day to your estimate to cater for power cuts or parts sourcing.
4. **Inspection Before Handover:** Double-check every function before the customer arrives on collection date.`;
  }
}

module.exports = new TradeAIService();
