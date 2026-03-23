// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Transcript Parser (Fallback Extraction)
// When ElevenLabs AI data collection is not configured on an agent
// (e.g. agents created before platformSettings were added), this
// module parses the transcript text for date/time/name/phone
// patterns in both Greek and English.
// ═══════════════════════════════════════════════════════════════════

export interface FallbackExtraction {
  appointment_date?: string;
  appointment_time?: string;
  caller_name?: string;
  caller_phone?: string;
  appointment_reason?: string;
  caller_intent?: string;
}

export function extractAppointmentFromTranscript(transcript: string): FallbackExtraction {
  const result: FallbackExtraction = {};
  if (!transcript) return result;

  const text = transcript.toLowerCase();

  // Date patterns: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
  const isoDateMatch = transcript.match(/(\d{4}-\d{2}-\d{2})/);
  const euDateMatch = transcript.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);

  if (isoDateMatch) {
    result.appointment_date = isoDateMatch[1];
  } else if (euDateMatch) {
    const day = euDateMatch[1]!.padStart(2, '0');
    const month = euDateMatch[2]!.padStart(2, '0');
    const year = euDateMatch[3];
    result.appointment_date = `${year}-${month}-${day}`;
  }

  // Relative dates: αύριο/tomorrow, μεθαύριο/day after tomorrow
  if (!result.appointment_date) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);

    if (text.includes('αύριο') || text.includes('αυριο') || text.includes('tomorrow')) {
      result.appointment_date = tomorrow.toISOString().split('T')[0];
    } else if (text.includes('μεθαύριο') || text.includes('μεθαυριο') || text.includes('day after tomorrow')) {
      result.appointment_date = dayAfter.toISOString().split('T')[0];
    }
  }

  // Greek day names → next occurrence
  if (!result.appointment_date) {
    const dayMap: Record<string, number> = {
      'δευτέρα': 1, 'δευτερα': 1, 'monday': 1,
      'τρίτη': 2, 'τριτη': 2, 'tuesday': 2,
      'τετάρτη': 3, 'τεταρτη': 3, 'wednesday': 3,
      'πέμπτη': 4, 'πεμπτη': 4, 'thursday': 4,
      'παρασκευή': 5, 'παρασκευη': 5, 'friday': 5,
      'σάββατο': 6, 'σαββατο': 6, 'saturday': 6,
      'κυριακή': 7, 'κυριακη': 7, 'sunday': 0,
    };
    for (const [dayName, dayNum] of Object.entries(dayMap)) {
      if (text.includes(dayName)) {
        const now = new Date();
        const currentDay = now.getDay();
        let diff = dayNum - currentDay;
        if (diff <= 0) diff += 7;
        const target = new Date(now);
        target.setDate(target.getDate() + diff);
        result.appointment_date = target.toISOString().split('T')[0];
        break;
      }
    }
  }

  // Time patterns: HH:MM, "στις X", "at X o'clock", "X η ώρα"
  const timeMatch = transcript.match(/(\d{1,2}):(\d{2})/);
  const greekTimeMatch = transcript.match(/(?:στις|στη)\s+(\d{1,2})(?::(\d{2}))?/i);
  const enTimeMatch = transcript.match(/(?:at)\s+(\d{1,2})(?::(\d{2}))?\s*(?:o'clock|pm|am)?/i);
  const greekOraMatch = transcript.match(/(\d{1,2})\s*(?:η ώρα|η ωρα|το πρωί|το πρωι|το απόγευμα|το απογευμα)/i);

  if (timeMatch) {
    result.appointment_time = `${timeMatch[1]!.padStart(2, '0')}:${timeMatch[2]}`;
  } else if (greekTimeMatch) {
    const h = greekTimeMatch[1]!.padStart(2, '0');
    const m = greekTimeMatch[2] ?? '00';
    result.appointment_time = `${h}:${m}`;
  } else if (enTimeMatch) {
    const h = enTimeMatch[1]!.padStart(2, '0');
    const m = enTimeMatch[2] ?? '00';
    result.appointment_time = `${h}:${m}`;
  } else if (greekOraMatch) {
    const h = greekOraMatch[1]!.padStart(2, '0');
    result.appointment_time = `${h}:00`;
  }

  // Name patterns
  const namePatterns = [
    /(?:με λένε|ονομάζομαι|λέγομαι|ειμαι (?:ο|η))\s+([Α-Ωα-ωάέήίόύώϊϋΐΰA-Za-z]+(?:\s+[Α-Ωα-ωάέήίόύώϊϋΐΰA-Za-z]+)?)/i,
    /(?:my name is|i am|i'm|this is)\s+([A-Za-zΑ-Ωα-ωάέήίόύώϊϋΐΰ]+(?:\s+[A-Za-zΑ-Ωα-ωάέήίόύώϊϋΐΰ]+)?)/i,
  ];
  for (const pattern of namePatterns) {
    const nameMatch = transcript.match(pattern);
    if (nameMatch?.[1]) {
      result.caller_name = nameMatch[1].trim();
      break;
    }
  }

  // Phone pattern
  const phoneMatch = transcript.match(/(\+?\d[\d\s-]{8,14}\d)/);
  if (phoneMatch) {
    result.caller_phone = phoneMatch[1]!.replace(/[\s-]/g, '');
  }

  // Detect intent
  const appointmentKeywords = ['ραντεβού', 'ραντεβου', 'appointment', 'book', 'schedule', 'κλείσω', 'κλεισω', 'κλείστε', 'κλειστε'];
  const complaintKeywords = ['παράπονο', 'παραπονο', 'complaint', 'πρόβλημα', 'προβλημα', 'problem'];
  const callbackKeywords = ['callback', 'πάρε με', 'παρε με', 'call me back', 'επικοινωνήστε', 'επικοινωνηστε'];

  if (appointmentKeywords.some(k => text.includes(k))) {
    result.caller_intent = 'appointment_booking';
  } else if (complaintKeywords.some(k => text.includes(k))) {
    result.caller_intent = 'complaint';
  } else if (callbackKeywords.some(k => text.includes(k))) {
    result.caller_intent = 'callback_request';
  } else {
    result.caller_intent = 'inquiry';
  }

  // Reason: first caller message as a simple heuristic
  const callerMessages = transcript.match(/\[(Πελάτης|Caller)\]:\s*(.+)/g);
  if (callerMessages && callerMessages.length > 0) {
    const firstMsg = callerMessages[0]!.replace(/\[(Πελάτης|Caller)\]:\s*/, '').trim();
    if (firstMsg.length > 5 && firstMsg.length < 200) {
      result.appointment_reason = firstMsg;
    }
  }

  return result;
}
