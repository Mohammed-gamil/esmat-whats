import axios from "axios";
import FormData from "form-data";

export class VoiceTranscriptionService {
  static async transcribeUrl(
    mediaUrl: string,
    mimeType: string = "audio/ogg; codecs=opus"
  ): Promise<string> {
    const deepgramKey = process.env.DEEPGRAM_API_KEY;
    if (deepgramKey) {
      try {
        const res = await axios.post(
          "https://api.deepgram.com/v1/listen?model=nova-2&language=ar&detect_language=true&punctuate=true",
          { url: mediaUrl },
          {
            headers: {
              Authorization: `Token ${deepgramKey}`,
              "Content-Type": "application/json",
            },
            timeout: 20000,
          }
        );
        const transcript =
          res.data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
        if (transcript.trim()) {
          console.log("[VoiceTranscription] Deepgram OK:", transcript.slice(0, 80));
          return transcript.trim();
        }
      } catch (err: any) {
        console.warn(
          "[VoiceTranscription] Deepgram failed, trying Whisper:",
          err?.message
        );
      }
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      try {
        const audioRes = await axios.get<Buffer>(mediaUrl, {
          responseType: "arraybuffer",
          timeout: 20000,
        });
        const buffer = Buffer.from(audioRes.data);

        const form = new FormData();
        form.append("file", buffer, {
          filename: "voice.ogg",
          contentType: mimeType,
        });
        form.append("model", "whisper-1");
        form.append("language", "ar");

        const res = await axios.post(
          "https://api.openai.com/v1/audio/transcriptions",
          form,
          {
            headers: {
              ...form.getHeaders(),
              Authorization: `Bearer ${openaiKey}`,
            },
            timeout: 30000,
          }
        );
        const transcript = res.data?.text || "";
        if (transcript.trim()) {
          console.log("[VoiceTranscription] Whisper OK:", transcript.slice(0, 80));
          return transcript.trim();
        }
      } catch (err: any) {
        console.warn(
          "[VoiceTranscription] Whisper failed, using empty fallback:",
          err?.message
        );
      }
    }

    console.warn(
      "[VoiceTranscription] No transcription provider available (set DEEPGRAM_API_KEY or OPENAI_API_KEY)."
    );
    return "";
  }

  static isVoiceMessage(msgType: string): boolean {
    return ["audio", "ptt", "voice", "voice_note", "document"].includes(
      msgType.toLowerCase()
    );
  }
}
