import { prisma } from "@/lib/prisma";

export interface GeneratedLeadDossier {
  recipientName: string;
  companyName: string;
  sector: string;
  location?: string;
  jobTitle?: string;
  signals?: string;
  outreachAngle?: string;
  intelSheet?: string;
  dorkUrls?: string[];
  contactInfo?: {
    email?: string;
    phone?: string;
    linkedin?: string;
  };
  customSystemInstruction: string;
}

export class LeadDossierGenerator {
  static async generateDossier(outreachId: string): Promise<GeneratedLeadDossier | null> {
    try {
      const outreach = await prisma.whatsAppOutreach.findUnique({
        where: { id: outreachId },
      });

      if (!outreach) return null;

      let companyName = "Company";
      let recipientName = outreach.recipientName || "Decision Maker";
      let sector = "B2B";
      let location: string | undefined = undefined;
      let jobTitle: string | undefined = undefined;
      let signals: string | undefined = undefined;
      let outreachAngle: string | undefined = undefined;
      let intelSheet: string | undefined = undefined;
      let dorkUrlsList: string[] = [];
      let email: string | undefined = undefined;
      let phone: string | undefined = outreach.contactPhone;
      let linkedin: string | undefined = undefined;
      let summaryText: string | undefined = undefined;
      let executiveListText: string = "N/A";
      let techStackText: string = "N/A";

      if (outreach.leadType === "icp_prospect") {
        const prospect = await prisma.icpProspect.findUnique({
          where: { id: outreach.leadId },
        });
        if (prospect) {
          companyName = prospect.companyName || companyName;
          sector = prospect.sector || sector;
          location = prospect.region || undefined;
          jobTitle = prospect.targetTitle || undefined;
          signals = prospect.signals || undefined;
          outreachAngle = prospect.outreachAngle || undefined;
          linkedin = prospect.companyLinkedin || undefined;
          
          if (prospect.contacts) {
            try {
              const contactsArr = JSON.parse(prospect.contacts);
              if (Array.isArray(contactsArr) && contactsArr.length > 0) {
                recipientName = contactsArr[0].name || recipientName;
                jobTitle = contactsArr[0].title || jobTitle;
                executiveListText = contactsArr.map((c: any) => `• ${c.name} (${c.title || 'Executive'})${c.linkedin ? ` - ${c.linkedin}` : ''}`).join("\n");
              }
            } catch (e) {}
          }

          if (prospect.dorkUrls) {
            try {
              const parsed = JSON.parse(prospect.dorkUrls);
              if (Array.isArray(parsed)) dorkUrlsList = parsed;
            } catch (e) {
              dorkUrlsList = [prospect.dorkUrls];
            }
          }

          if (prospect.enrichment) {
            try {
              const enrichObj = JSON.parse(prospect.enrichment);
              if (enrichObj.summary) summaryText = enrichObj.summary;
              if (enrichObj.email) email = enrichObj.email;
              if (enrichObj.techStack && Array.isArray(enrichObj.techStack)) {
                techStackText = enrichObj.techStack.join(", ");
              }
            } catch (e) {
              summaryText = prospect.enrichment;
            }
          }
        }
      } 
      else if (outreach.leadType === "maps_lead") {
        const mapsLead = await prisma.mapsLead.findUnique({
          where: { id: outreach.leadId },
        });
        if (mapsLead) {
          companyName = mapsLead.businessName;
          sector = mapsLead.niche || sector;
          location = mapsLead.city || undefined;
          intelSheet = mapsLead.intelSheet || undefined;
          phone = mapsLead.phone || phone;
          linkedin = mapsLead.companyLinkedin || undefined;

          if (mapsLead.employeeLinkedins) {
            try {
              const parsedEmps = JSON.parse(mapsLead.employeeLinkedins);
              if (Array.isArray(parsedEmps) && parsedEmps.length > 0) {
                executiveListText = parsedEmps.map((e: any) => `• ${e.title || 'Executive'}: ${e.url || e}`).join("\n");
              }
            } catch {
              executiveListText = mapsLead.employeeLinkedins;
            }
          }

          if (mapsLead.dorkUrls) {
            try {
              const parsed = JSON.parse(mapsLead.dorkUrls);
              if (Array.isArray(parsed)) dorkUrlsList = parsed;
            } catch (e) {
              dorkUrlsList = [mapsLead.dorkUrls];
            }
          }
        }
      } 
      else if (outreach.leadType === "lead") {
        const hiringLead = await prisma.lead.findUnique({
          where: { id: outreach.leadId },
        });
        if (hiringLead) {
          companyName = hiringLead.companyName || companyName;
          sector = hiringLead.role || sector;
          location = hiringLead.location || undefined;
          jobTitle = hiringLead.jobTitle || hiringLead.role || undefined;
          summaryText = hiringLead.summary || undefined;
          email = hiringLead.contactEmail || undefined;
          phone = hiringLead.contactPhone || phone;
        }
      }

      const customSystemInstruction = `==================================================
TARGET CLIENT KNOWLEDGE BASE & REFERENCE AGENCY DOSSIER
==================================================
• Target Business: ${companyName}
• Sector / Niche: ${sector}
• Primary Contact / Recipient: ${recipientName} (${jobTitle || "Decision Maker"})
• Geography / Location: ${location || "Global"}
• Contact Info: Phone (${phone || "N/A"})${email ? ` | Email (${email})` : ""}${linkedin ? ` | LinkedIn (${linkedin})` : ""}

KEY DECISION MAKERS (C-LEVEL EXECUTIVES):
${executiveListText}

BUSINESS TECH STACK & TOOLS:
${techStackText}

COLLECTED INTELLIGENCE & DORKS:
${signals ? `• Operational Signals: ${signals}` : ""}
${outreachAngle ? `• Hook / Strategic Outreach Angle: ${outreachAngle}` : ""}
${intelSheet ? `• Google Dork Intelligence Sheet: ${intelSheet}` : ""}
${summaryText ? `• Company / Hiring Summary: ${summaryText}` : ""}
${dorkUrlsList.length > 0 ? `• Verified Web Intel URLs: ${dorkUrlsList.slice(0, 3).join(", ")}` : ""}

REFERENCE AGENCY DIRECTIVES FOR THIS CLIENT:
1. Position Reference Agency solutions specifically for ${companyName}'s ${sector} operations: We re-engineer, optimize, and fix manual HR & business workflows FIRST before automating them with custom AI.
2. ZERO TECH JARGON: Do NOT mention technical framework names. Speak with business consulting authority about fixing operational leaks, saving 80% manual time, and enforcing 100% data privacy.
3. STRICT PRICING POLICY: DO NOT quote upfront prices or dollar amounts on WhatsApp. Invite the lead to a Free 30-Minute AI Readiness & Workflow Assessment Meeting first to evaluate their scope.
4. Resolve IP, business continuity (escrow, ADD docs, self-hosted cloud), and low-code objections using official Reference Agency protocols.
5. Primary Goal: Invite ${recipientName} to book a Free 30-Minute AI Readiness & Workflow Assessment Meeting or confirm a Google Calendar demo slot.
6. CRITICAL LANGUAGE RULE: If phone is Egyptian (+20/01) or lead speaks Arabic, YOU MUST RESPOND IN NATURAL EGYPTIAN/ARABIC FIRST!`;

      return {
        recipientName,
        companyName,
        sector,
        location,
        jobTitle,
        signals,
        outreachAngle,
        intelSheet,
        dorkUrls: dorkUrlsList,
        contactInfo: { email, phone, linkedin },
        customSystemInstruction,
      };
    } catch (e: any) {
      console.warn(`[LeadDossierGenerator] Failed to generate dossier for ${outreachId}:`, e?.message);
      return null;
    }
  }

  static async generateAiDorkSystemPrompt(outreachId: string): Promise<GeneratedLeadDossier | null> {
    try {
      const { runDork } = await import("@/lib/search");
      const axios = (await import("axios")).default;

      const outreach = await prisma.whatsAppOutreach.findUnique({
        where: { id: outreachId },
      });
      if (!outreach) return null;

      const baseDossier = await this.generateDossier(outreachId);
      if (!baseDossier) return null;

      const companyName = baseDossier.companyName;
      const sector = baseDossier.sector;
      const recipientName = baseDossier.recipientName;
      const serperApiKey = process.env.SERPER_API_KEY || "";

      let sysSetting: { llmProvider?: string; llmApiKey?: string; llmModel?: string; llmBaseUrl?: string; llmCustomPrompt?: string } | null = null;
      try {
        sysSetting = await prisma.systemSetting.findUnique({ where: { id: "default" } });
      } catch {
        sysSetting = null;
      }
      const globalCustomPrompt = sysSetting?.llmCustomPrompt || "";

      const cleanCompany = companyName.replace(/["']/g, "").trim();
      const leadDorks = [
        `site:linkedin.com/in ("CEO" OR "Founder" OR "Owner" OR "Managing Director" OR "HR Director" OR "الرئيس التنفيذي") "${cleanCompany}"`,
        `"${cleanCompany}" ("hiring" OR "expanding" OR "افتتاح فرع" OR "توسع تشغيلي" OR "وظائف")`,
        `"${cleanCompany}" "${location}" (site:facebook.com OR site:linkedin.com OR site:twitter.com)`,
        `"${cleanCompany}" official website "${sector}"`,
      ];

      if (globalCustomPrompt) {
        globalCustomPrompt.split("\n").forEach((line) => {
          const trimmed = line.trim();
          if (
            trimmed.toLowerCase().includes("site:") ||
            trimmed.toLowerCase().startsWith("dork:") ||
            trimmed.startsWith("ديرك")
          ) {
            const cleanDork = trimmed
              .replace(/^(dork|ديرك)[:\s]*/i, "")
              .replace(/^[-*•]\s*/, "")
              .trim();
            if (cleanDork.length > 5 && !leadDorks.includes(cleanDork)) {
              leadDorks.push(cleanDork);
            }
          }
        });
      }

      const dorkResultsList: string[] = [];
      const discoveredUrls: string[] = [];

      for (const dorkQuery of leadDorks) {
        try {
          const results = await runDork(dorkQuery, "lead_intelligence", sector, {
            serperApiKey,
            maxResults: 3,
          });
          for (const res of results) {
            if (res.snippet) dorkResultsList.push(`• [${res.title}] (${res.url}): ${res.snippet}`);
            if (res.url && !discoveredUrls.includes(res.url)) discoveredUrls.push(res.url);
          }
        } catch {}
      }

      const dorksIntelText = dorkResultsList.length > 0 
        ? dorkResultsList.slice(0, 10).join("\n") 
        : "No live dork search snippets found for this company.";

      const provider = sysSetting?.llmProvider || "openai";
      const apiKey = sysSetting?.llmApiKey || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY || "";
      const isValidLlmKey = apiKey && !apiKey.startsWith("dummy") && !/^[a-f0-9]{40}$/i.test(apiKey);

      let aiSystemPrompt: string | undefined;

      if (isValidLlmKey) {
        const promptPayload = `SYSTEM ROLE: You are an elite B2B Sales Intelligence Director for Reference Agency & WhatsApp AI Sales Agent.
TASK: Using the live Google Dork search findings below for "${companyName}", generate a hyper-custom AI Sales Representative System Prompt tailored specifically to engage "${companyName}" over WhatsApp.

${globalCustomPrompt ? `CLIENT CUSTOM SYSTEM PROMPT RULES:\n${globalCustomPrompt}\n\n` : ""}TARGET LEAD METADATA:
- Business Name: ${companyName}
- Sector/Industry: ${sector}
- Primary Contact: ${recipientName} (${baseDossier.jobTitle || 'Decision Maker'})
- Location: ${location}

LIVE GOOGLE DORK INTELLIGENCE FINDINGS:
${dorksIntelText}

Output ONLY the complete system prompt text without extra markdown wrappers.`;

        try {
          if (provider === "gemini" || process.env.GEMINI_API_KEY) {
            const geminiKey = process.env.GEMINI_API_KEY || apiKey;
            const geminiModel = sysSetting?.llmModel || "gemini-2.5-flash";
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;
            const res = await axios.post(
              geminiUrl,
              { contents: [{ parts: [{ text: promptPayload }] }] },
              { headers: { "Content-Type": "application/json" }, timeout: 15000 }
            );
            aiSystemPrompt = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          } else if (provider === "anthropic" || process.env.ANTHROPIC_API_KEY) {
            const anthropicKey = process.env.ANTHROPIC_API_KEY || apiKey;
            const res = await axios.post(
              "https://api.anthropic.com/v1/messages",
              {
                model: sysSetting?.llmModel || "claude-3-5-haiku-20241022",
                messages: [{ role: "user", content: promptPayload }],
                max_tokens: 1000,
              },
              {
                headers: {
                  "Content-Type": "application/json",
                  "x-api-key": anthropicKey,
                  "anthropic-version": "2023-06-01",
                },
                timeout: 15000,
              }
            );
            aiSystemPrompt = res.data?.content?.[0]?.text?.trim();
          } else {
            const providerUrl =
              sysSetting?.llmBaseUrl ||
              (provider === "openrouter"
                ? "https://openrouter.ai/api/v1/chat/completions"
                : provider === "ollama"
                ? "http://localhost:11434/v1/chat/completions"
                : "https://api.openai.com/v1/chat/completions");
            const res = await axios.post(
              providerUrl,
              {
                model: sysSetting?.llmModel || "gpt-4o-mini",
                messages: [{ role: "user", content: promptPayload }],
                temperature: 0.7,
                max_tokens: 1000,
              },
              {
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${apiKey}`,
                },
                timeout: 15000,
              }
            );
            aiSystemPrompt = res.data?.choices?.[0]?.message?.content?.trim();
          }
        } catch (e: any) {
          console.warn("[LeadDossierGenerator] AI Dork LLM synthesis failed, using fallback:", e?.message);
        }
      }

      if (!aiSystemPrompt) {
        aiSystemPrompt = `${baseDossier.customSystemInstruction}\n\nLIVE GOOGLE DORK FINDINGS:\n${dorksIntelText}`;
      }

      const allDorkUrls = Array.from(new Set([...(baseDossier.dorkUrls || []), ...discoveredUrls]));

      return {
        ...baseDossier,
        dorkUrls: allDorkUrls,
        intelSheet: dorksIntelText,
        customSystemInstruction: aiSystemPrompt,
      };
    } catch (e: any) {
      console.warn(`[LeadDossierGenerator] Failed to generate AI Dork prompt for ${outreachId}:`, e?.message);
      return null;
    }
  }
}

export async function generateLeadIntelligenceDossier(outreachId: string) {
  return LeadDossierGenerator.generateDossier(outreachId);
}

export async function synthesizeLiveDorkPrompt(outreachId: string) {
  return LeadDossierGenerator.generateAiDorkSystemPrompt(outreachId);
}
