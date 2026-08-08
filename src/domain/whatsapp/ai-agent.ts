import axios from "axios";
import { prisma } from "@/lib/prisma";
import { ConversationMemory } from "./conversation-memory";
import { CalendarBookingService } from "@/services/calendar-booking-service";
import { WhatsAppService } from "@/services/whatsapp-service";
import { AiAgentDecision } from "./types";

interface KnowledgeBaseItem {
  sectorMatch: RegExp;
  responseAr: string;
  responseEn: string;
}

const KNOWLEDGE_BASE: KnowledgeBaseItem[] = [
  {
    sectorMatch: /logistics|transport|shipping|fleet|delivery|لوجستيك|لوجستيات|شحن|أسطول|توصيل|نقل/i,
    responseAr:
      "أهلاً بك! بالنسبة لشركات اللوجستيات والشحن، منصتنا تساعد في أتمتة تنسيق السائقين، تتبع الطلبات عبر الواتساب، وتوفير 80% من الهدر الإداري في إدارة الأسطول الميداني. هل تحب نحدد مكالمة توضيحية لمدة 15 دقيقة؟",
    responseEn:
      "Logistics operations thrive on efficiency! We automate field dispatching, driver coordination, and order updates via WhatsApp—cutting administrative overhead by 80%. Would a quick 15-min call this week work for your team?",
  },
  {
    sectorMatch: /contracting|construction|engineering|building|مقاولات|إنشاءات|هندسة|بناء|مباني/i,
    responseAr:
      "حلولنا لشركات المقاولات تتمحور حول إدارة الفنيين والعمالة الميدانية، وتوثيق استلام المواقع، ومتابعة مقاولي الباطن عبر الواتساب. هل يناسبك موعد 15 دقيقة هذا الأسبوع لعرض توضيحي؟",
    responseEn:
      "For contracting firms, we streamline field labor coordination, sub-contractor updates, and job site logs right inside WhatsApp. Would a 15-minute demo fit your schedule?",
  },
  {
    sectorMatch: /retail|fmcg|distribution|wholesale|trade|تجزئة|توزيع|جملة|استيراد|تجارة|سلع/i,
    responseAr:
      "أهلاً بك! لقطاع التجزئة والتوزيع، نوفر أتمتة لإعادة الطلب، متابعة مندوبي المبيعات، ومزامنة بيانات العملاء تلقائياً عبر الواتساب. هل نحدد 15 دقيقة هذا الأسبوع لعرض إمكانيات النظام؟",
    responseEn:
      "For retail & distribution, our suite automates store replenishment, sales rep tracking, and CRM syncing over WhatsApp. How does a quick 15-minute demo sound?",
  },
  {
    sectorMatch: /manufacturing|factory|production|plant|تصنيع|إنتاج|مصنع|صناعة/i,
    responseAr:
      "أهلاً بك! للمصانع والمنشآت الإنتاجية، نساعد في ربط خطوط الإنتاج والطلبات ومتابعة الصيانة الميدانية تلقائياً. هل يناسبك مكالمة 15 دقيقة للاستكشاف؟",
    responseEn:
      "For manufacturing operations, we eliminate paper logs and automate production/maintenance updates over WhatsApp. Would a 15-min call work for you?",
  },
  {
    sectorMatch: /health|clinic|hospital|medical|عيادة|مستشفى|طبي|مركز طبي|صحة/i,
    responseAr:
      "أهلاً بك! للمراكز الطبية والعيادات، نوفر تأكيد المواعيد التلقائي، متابعة المرضى، وتقليل نسبة الإلغاء عبر الواتساب. هل تحب نحدد 15 دقيقة لاستعراض التفاصيل؟",
    responseEn:
      "For healthcare & clinics, we automate appointment confirmations and patient follow-ups via WhatsApp to slash no-show rates. Would a 15-min demo suit you?",
  },
  {
    sectorMatch: /restaurant|food|f&b|cafe|catering|مطعم|أغذية|مشروبات|كافيه|إعاشة/i,
    responseAr:
      "أهلاً بك! لقطاع المطاعم والأغذية، نساعد في أتمتة توريد المواد الخام، تنسيق الفروع، وإدارة العمالة الميدانية. هل نحدد مكالمة 15 دقيقة للتفاصيل؟",
    responseEn:
      "For F&B & restaurant chains, we streamline branch supply coordination and staff dispatch via WhatsApp. Would a 15-min demo work for you?",
  },
];

const GREETING_REGEX_AR = /حبيبي|حبيب|يا غالي|رد|سلام|مرحبا|أهلا|اهلاً|مساء الخير|صباح الخير|استفسار|ممكن/i;
const GREETING_REGEX_EN = /^hi\b|^hello\b|^hey\b|good morning|good afternoon|good evening|anybody there|anyone/i;

const BROCHURE_PDF_URL = process.env.BROCHURE_PDF_URL || "";

function calcScoreDelta(body: string): number {
  let delta = 0;
  if (/price|cost|pricing|how much|rate|plan|سعر|تكلفة|بكام|أسعار/i.test(body)) delta += 30;
  if (/demo|call|meeting|book|schedule|\binterested\b|مكالمة|مواعيد|موافق|تم|عرض/i.test(body)) delta += 40;
  if (/yes|sure|sounds good|نعم|تمام|موافق|صح/i.test(body)) delta += 20;
  if (/logistics|transport|manufacturing|retail|contracting|health|لوجستيك|تصنيع|مقاولات|تجزئة/i.test(body)) delta += 10;
  return Math.min(delta, 50);
}

function isArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

function reflectAndSanitizeResponse(
  rawText: string,
  arabicInput: boolean,
  pastAssistantTurns: string[]
): string {
  let cleaned = rawText
    .replace(/\[insert [^\]]+\]/gi, "")
    .replace(/\[your name\]/gi, "Mohammed Gamil")
    .replace(/\[your title\]/gi, "AI Solutions Engineer")
    .replace(/\[company name\]/gi, "Reference Agency")
    .replace(/\[[^\]]+\]/g, "")
    .trim();

  if (pastAssistantTurns.some((past) => past.trim() === cleaned)) {
    cleaned += arabicInput
      ? " هل تناسبك مواعيد هذا الأسبوع لمكالمة توضيحية؟"
      : " Would a quick call this week work for your team?";
  }

  if (cleaned.length > 400) {
    const sentences = cleaned.split(/(?<=[.!?؟])\s+/);
    cleaned = sentences.slice(0, 3).join(" ");
  }

  return cleaned;
}

export class WhatsAppAiAgent {
  static async generateReply(
    outreachId: string,
    incomingBody: string
  ): Promise<AiAgentDecision> {
    const memoryHistory = await ConversationMemory.getHistory(outreachId, 15);
    const leadContext = await ConversationMemory.buildLeadContext(outreachId);
    const settings = await prisma.whatsAppSetting.findUnique({ where: { id: "default" } });
    let sysSetting: { llmProvider?: string; llmApiKey?: string; llmModel?: string; llmBaseUrl?: string; llmCustomPrompt?: string } | null = null;
    try {
      sysSetting = await prisma.systemSetting.findUnique({ where: { id: "default" } });
    } catch {
      sysSetting = null;
    }

    const arabicInput = isArabic(incomingBody);
    const scoreDelta = calcScoreDelta(incomingBody);

    const isBrochureRequest = /pdf|brochure|catalog|deck|profile|company overview|كتالوج|بروفايل|ملف|نبذة|معلومات الشركة/i.test(incomingBody);
    if (isBrochureRequest) {
      const brochureUrl = BROCHURE_PDF_URL ||
        (sysSetting?.llmCustomPrompt?.match(/BROCHURE_URL=([^\s]+)/)?.[1]) ||
        "";

      const responseText = arabicInput
        ? `بكل سرور! هذا هو ملف تعريف LeadScrape AI يوضح قدرات المنصة والتكاملات والحالات العملية. هل تحب نحدد 15 دقيقة للمناقشة بعد الاطلاع عليه؟`
        : `Absolutely! Here is our company overview deck covering platform capabilities, integrations, and real-world case studies. Would you like to schedule a quick 15-minute call after reviewing it?`;

      return {
        response: responseText,
        intent: "brochure",
        sentiment: "positive",
        leadScore: scoreDelta + 10,
        ...(brochureUrl ? { attachmentUrl: brochureUrl } : {}),
      };
    }

    const isAskingForSlots = /slots|calendar|available times|which day|what time|مواعيد|متاحة|إيه المواعيد|أوقات|متى|اي وقت/i.test(incomingBody);
    const isConfirmingBooking = /book|confirm|option 1|option 2|option 3|tomorrow at|غدا|غداً|احجزلي|احجز لي|أكد الحجز/i.test(incomingBody);

    if (isAskingForSlots) {
      const slots = await CalendarBookingService.getAvailableSlots();
      const formattedSlots = slots.map((s, idx) => `${idx + 1}️⃣ ${s.formatted}`).join("\n");

      if (arabicInput) {
        return {
          response: `المواعيد المتاحة حالياً للحجز عبر Google Calendar:\n${formattedSlots}\n\nيرجى الرد برقم الموعد أو اليوم الأنسب لك لتأكيد الحجز وتلقي دعوة التقويم تلقائياً!`,
          sentiment: "positive",
          intent: "demo",
          leadScore: scoreDelta + 40,
        };
      } else {
        return {
          response: `Here are our upcoming available slots on Google Calendar:\n${formattedSlots}\n\nPlease reply with your preferred slot number or time to confirm your calendar invite!`,
          sentiment: "positive",
          intent: "demo",
          leadScore: scoreDelta + 40,
        };
      }
    }

    if (isConfirmingBooking) {
      const booking = await CalendarBookingService.bookCalendarSlot({
        clientName: leadContext?.recipientName || "Lead",
        clientPhone: leadContext?.contactPhone || outreachId,
        slotText: incomingBody,
        sector: leadContext?.sector,
      });

      if (arabicInput) {
        return {
          response: `تم الحجز بنجاح على Google Calendar! 📅\nالموعد: ${booking.formattedTime}\nتم تسجيل دعوة الاجتماع وإرسال تفاصيل العرض التوضيحي. ننتظرك في الموعد المحدّد!`,
          sentiment: "positive",
          intent: "demo",
          leadScore: scoreDelta + 50,
        };
      } else {
        return {
          response: `Your demo has been successfully booked on Google Calendar! 📅\nSlot: ${booking.formattedTime}\nCalendar invitation has been created. Looking forward to our call!`,
          sentiment: "positive",
          intent: "demo",
          leadScore: scoreDelta + 50,
        };
      }
    }

    const provider = sysSetting?.llmProvider || "openai";
    const apiKey =
      sysSetting?.llmApiKey ||
      process.env.OPENAI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      "";

    const whatsappSysPrompt = settings?.systemPrompt || WhatsAppService.MASTER_SYSTEM_PROMPT;
    const globalCustomPrompt = sysSetting?.llmCustomPrompt ? `\n\nCLIENT CUSTOM SYSTEM PROMPT & RULES:\n${sysSetting.llmCustomPrompt}` : '';
    const systemPrompt = `${whatsappSysPrompt}${globalCustomPrompt}`;

    const isValidLlmKey =
      apiKey &&
      !apiKey.startsWith("dummy") &&
      !/^[a-f0-9]{40}$/i.test(apiKey);

    const forceArabic = arabicInput;

    if (isValidLlmKey) {
      try {
        const slots = await CalendarBookingService.getAvailableSlots();
        const slotsText = slots.map((s) => s.formatted).join(", ");

        let contextInstruction = leadContext?.dossierPrompt
          ? `${leadContext.dossierPrompt}\n\nCONSULTANT CONTACT: Mohammed Gamil, AI Solutions Engineer (+201003789522)\nREAL-TIME GOOGLE CALENDAR SLOTS:\n${slotsText}\n\nBASE REFERENCE AGENCY INSTRUCTIONS:\n${systemPrompt}\n\n${forceArabic ? "CRITICAL: Prospect replied in ARABIC. RESPOND IN NATURAL ARABIC!" : "CRITICAL: Default language is ENGLISH."}`
          : `${systemPrompt}\n\nCONSULTANT IDENTITY:\n- Name: Mohammed Gamil (AI Solutions Engineer at Reference Agency)\n- Phone: +201003789522\n\nLEAD CONTEXT:\n- Name: ${leadContext?.recipientName || "Lead"}\n- Company: ${leadContext?.companyName || "Unknown"}\n- Sector: ${leadContext?.sector || "B2B"}\n\nREAL-TIME SLOTS:\n${slotsText}`;

        const historyMessages = memoryHistory.map((turn) => ({
          role: turn.role,
          content: turn.content,
        }));

        let aiText: string | undefined;

        if (provider === "gemini" || process.env.GEMINI_API_KEY) {
          const geminiKey = process.env.GEMINI_API_KEY || apiKey;
          const geminiModel = sysSetting?.llmModel || "gemini-2.5-flash";
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;
          const formattedHistory = historyMessages.map(m => `${m.role === "assistant" ? "AI Sales Rep" : "Prospect"}: ${m.content}`).join("\n");
          const promptPayload = `SYSTEM CONTEXT:\n${contextInstruction}\n\nPAST CONVERSATION:\n${formattedHistory}\n\nPROSPECT LATEST MESSAGE:\n${incomingBody}`;

          const res = await axios.post(
            geminiUrl,
            {
              contents: [{ parts: [{ text: promptPayload }] }],
              generationConfig: { temperature: 0.7, maxOutputTokens: 250 },
            },
            { headers: { "Content-Type": "application/json" }, timeout: 10000 }
          );
          aiText = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        } else if (provider === "anthropic" || process.env.ANTHROPIC_API_KEY) {
          const anthropicKey = process.env.ANTHROPIC_API_KEY || apiKey;
          const anthropicModel = sysSetting?.llmModel || "claude-3-5-haiku-20241022";
          const res = await axios.post(
            "https://api.anthropic.com/v1/messages",
            {
              model: anthropicModel,
              system: contextInstruction,
              messages: [
                ...historyMessages.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
                { role: "user", content: incomingBody },
              ],
              max_tokens: 250,
            },
            {
              headers: {
                "Content-Type": "application/json",
                "x-api-key": anthropicKey,
                "anthropic-version": "2023-06-01",
              },
              timeout: 10000,
            }
          );
          aiText = res.data?.content?.[0]?.text?.trim();
        } else {
          const providerUrl =
            sysSetting?.llmBaseUrl ||
            (provider === "openrouter"
              ? "https://openrouter.ai/api/v1/chat/completions"
              : provider === "ollama"
              ? "http://localhost:11434/v1/chat/completions"
              : "https://api.openai.com/v1/chat/completions");
          const model = sysSetting?.llmModel || "gpt-4o-mini";

          const messages = [
            { role: "system", content: contextInstruction },
            ...historyMessages,
            { role: "user", content: incomingBody },
          ];

          const res = await axios.post(
            providerUrl,
            { model, messages, temperature: 0.7, max_tokens: 200 },
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              timeout: 10000,
            }
          );
          aiText = res.data?.choices?.[0]?.message?.content?.trim();
        }

        if (aiText) {
          const pastAssistantTexts = memoryHistory
            .filter((m) => m.role === "assistant")
            .map((m) => m.content);

          const sanitizedText = reflectAndSanitizeResponse(aiText, arabicInput, pastAssistantTexts);

          let sentiment: "positive" | "negative" | "objection" | undefined = undefined;
          if (/no\b|stop|not interested|unsubscribe|مش مهتم|لا/i.test(incomingBody)) {
            sentiment = "negative";
          } else if (/call|demo|schedule|yes|interested|book|meeting|مكالمة|مواعيد|تم|موافق/i.test(incomingBody)) {
            sentiment = "positive";
          }
          return { response: sanitizedText, sentiment, leadScore: scoreDelta };
        }
      } catch (e: any) {
        console.warn("[WhatsAppAiAgent] LLM chatbot completion fallback to rule engine:", e?.message);
      }
    }

    for (const kb of KNOWLEDGE_BASE) {
      if (kb.sectorMatch.test(incomingBody)) {
        return {
          response: arabicInput ? kb.responseAr : kb.responseEn,
          sentiment: "positive",
        };
      }
    }

    if (GREETING_REGEX_AR.test(incomingBody) || GREETING_REGEX_EN.test(incomingBody)) {
      if (arabicInput) {
        return {
          response: `أهلاً وسهلاً بك ${
            leadContext?.recipientName && leadContext.recipientName !== "Lead" ? leadContext.recipientName : ""
          }! معك مستشار النمو في LeadScrape AI. إحنا بنساعد الشركات التشغيلية في أتمتة العمليات، إدارة العمالة الميدانية، واستخراج العملاء بالذكاء الاصطناعي. ما هو المجال التشغيلي لشركتكم؟`,
        };
      } else {
        return {
          response: `Hello ${
            leadContext?.recipientName && leadContext.recipientName !== "Lead" ? leadContext.recipientName : "there"
          }! I'm your growth advisor from LeadScrape AI. We help operational businesses automate lead extraction and field workflow coordination over WhatsApp. What line of business are you in?`,
        };
      }
    }

    if (/price|cost|pricing|how much|rate|plan|fees|سعر|تكلفة|بكام|كم السعر|أسعار/i.test(incomingBody)) {
      if (arabicInput) {
        return {
          response:
            "تبدأ باقات LeadScrape AI من 99 دولار شهرياً شاملة محرك استخراج البيانات الميدانية، وتدقيق خرائط جوجل، ومساعد المبيعات للواتساب. هل تحب تحجز جلسة تجريبية لمدة 15 دقيقة؟",
        };
      } else {
        return {
          response:
            "Our LeadScrape AI platform starts at $99/mo for automated lead extraction, Playwright discovery, and the WhatsApp AI sales agent. Would you like to schedule a quick 15-minute live demo?",
        };
      }
    }

    if (/\bnot interested\b|no thanks|unsubscribe|don'?t contact|please remove|مش مهتم|إلغاء|توقف/i.test(incomingBody)) {
      if (arabicInput) {
        return {
          response: "تم الفهم، شكراً لوقتك! نتمنى لك التوفيق، وإذا احتجت أي استشارة مستقبلاً نتشرف بتواصلك.",
          sentiment: "negative",
        };
      } else {
        return {
          response: "Understood, thanks for your time! Let us know if your requirements change in the future. Have a great day.",
          sentiment: "negative",
        };
      }
    }

    if (/demo|call|meeting|book|schedule|\binterested\b|yes|sure|ok|sounds good|مكالمة|ميعاد|مواعيد|موافق|تم|عرض/i.test(incomingBody)) {
      if (arabicInput) {
        return {
          response:
            "ممتاز جداً! هل يناسبك مكالمة استكشافية لمدة 15 دقيقة هذا الأسبوع؟ يرجى تحديد اليوم والوقت الأنسب لك لإرسال دعوة التقويم.",
          sentiment: "positive",
        };
      } else {
        return {
          response:
            "Great! Would a 15-minute discovery call this week work for you? Please let me know a day and time that works best for you.",
          sentiment: "positive",
        };
      }
    }

    const assistantTurns = memoryHistory.filter((m) => m.role === "assistant");
    const turnCount = assistantTurns.length;

    if (turnCount >= 2) {
      if (arabicInput) {
        return {
          response: `شكراً لتواصلك معنا ${
            leadContext?.recipientName && leadContext.recipientName !== "Lead" ? leadContext.recipientName : ""
          }! هل يناسبك نحدد مكالمة سريعة لمدة 15 دقيقة نوضح فيها بالتفصيل كيف ينطبق النظام على طبيعة عملكم؟`,
        };
      } else {
        return {
          response: `Thanks for the details! Would a quick 15-minute live demo this week work for your team so we can demonstrate how it fits your workflow?`,
        };
      }
    }

    if (arabicInput) {
      return {
        response: `أهلاً بك! يسعدنا التعرف على طبيعة العمليات لديكم في ${
          leadContext?.companyName || "شركتكم"
        } وتوضيح كيف يقوم نظام الذكاء الاصطناعي بنمو المبيعات وأتمتة المهام. هل يناسبكم مكالمة 15 دقيقة هذا الأسبوع؟`,
      };
    }

    return {
      response: `Thanks for reaching out! We'd love to learn more about ${
        leadContext?.companyName ? leadContext.companyName + "'s" : "your"
      } current operational setup and demonstrate how our B2B AI lead suite automates your workflow. Would a 15-minute call this week work for you?`,
    };
  }

  static async evaluateTurn(
    turns: Array<{ direction: string; body: string; createdAt: string }>,
    leadProfile: { contactPhone: string; recipientName?: string }
  ): Promise<AiAgentDecision> {
    const lastMsg = turns.length > 0 ? turns[turns.length - 1].body : "";
    const isAr = turns.some((t) => /[\u0600-\u06FF]/.test(t.body));
    const isBrochure = turns.some((t) => /pdf|brochure|catalog|deck|profile|كتالوج|بروفايل|ملف/i.test(t.body));
    const text = isAr
      ? `أهلاً بك يا فندم! سعداء بالتواصل معك مع Reference Agency للحلول والاستشارات. كيف يمكننا مساعدتك اليوم؟`
      : `Hello! Thank you for contacting Reference Agency. How can we assist your business workflow today?`;
    return {
      action: "REPLY",
      response: text,
      replyText: text,
      sendBrochure: isBrochure,
      confidence: 0.95,
    };
  }
}
