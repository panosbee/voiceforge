// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Voice Preview Routes
// TTS preview so users can hear voices before assigning to agents
// ═══════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware, type AuthUser } from '../middleware/auth.js';
import { createLogger } from '../config/logger.js';
import * as elevenlabsService from '../services/elevenlabs.js';
import type { ApiResponse } from '@voiceforge/shared';

const log = createLogger('voices');

export const voiceRoutes = new Hono<{ Variables: { user: AuthUser } }>();

voiceRoutes.use('*', authMiddleware);

// ── Validation ───────────────────────────────────────────────────

const previewSchema = z.object({
  voiceId: z.string().min(1),
  text: z.string().min(1).max(500).default('Γεια σας, καλωσορίσατε. Πώς μπορώ να σας βοηθήσω σήμερα;'),
  modelId: z.string().optional().default('eleven_flash_v2_5'),
});

// ═══════════════════════════════════════════════════════════════════
// POST /voices/preview — Generate TTS audio preview
// Returns MP3 audio stream for the selected voice
// ═══════════════════════════════════════════════════════════════════

voiceRoutes.post('/preview', zValidator('json', previewSchema), async (c) => {
  const { voiceId, text, modelId } = c.req.valid('json');

  if (!elevenlabsService.isConfigured()) {
    return c.json<ApiResponse>(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'ElevenLabs δεν είναι ρυθμισμένο' } },
      400,
    );
  }

  try {
    log.info({ voiceId, textLength: text.length }, 'Generating voice preview');

    const audioBuffer = await elevenlabsService.generateVoicePreview(voiceId, text, modelId);

    // Return as MP3 audio stream
    c.header('Content-Type', 'audio/mpeg');
    c.header('Content-Length', audioBuffer.byteLength.toString());
    c.header('Cache-Control', 'public, max-age=3600'); // Cache for 1h

    return c.body(audioBuffer);
  } catch (error) {
    log.error({ error, voiceId }, 'Voice preview failed');
    return c.json<ApiResponse>(
      { success: false, error: { code: 'ELEVENLABS_ERROR', message: 'Αποτυχία δημιουργίας voice preview' } },
      500,
    );
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /voices — List available voices from ElevenLabs
// ═══════════════════════════════════════════════════════════════════

voiceRoutes.get('/', async (c) => {
  if (!elevenlabsService.isConfigured()) {
    // Return the hardcoded Greek voices if ElevenLabs not configured
    const { GREEK_VOICES } = await import('@voiceforge/shared');
    return c.json<ApiResponse>({
      success: true,
      data: GREEK_VOICES.map((v) => ({
        voiceId: v.id,
        name: v.name,
        gender: v.gender,
        provider: v.provider,
      })),
    });
  }

  try {
    const voices = await elevenlabsService.listVoices();
    return c.json<ApiResponse>({ success: true, data: voices });
  } catch (error) {
    log.error({ error }, 'Failed to list voices');
    return c.json<ApiResponse>(
      { success: false, error: { code: 'ELEVENLABS_ERROR', message: 'Failed to list voices' } },
      500,
    );
  }
});
