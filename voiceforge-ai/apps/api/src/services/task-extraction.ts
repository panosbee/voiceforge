// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Post-Call Task Extraction Service
// Uses OpenAI to analyze transcripts and extract actionable tasks,
// then routes them to the correct department email.
// ═══════════════════════════════════════════════════════════════════

import { env } from '../config/env.js';
import { createLogger } from '../config/logger.js';

const log = createLogger('task-extraction');

// ── Types ────────────────────────────────────────────────────────

export interface ExtractedTask {
  title: string;
  description: string;
  actionRequired: string;
  matchedRole: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  callerName: string | null;
  callerPhone: string | null;
}

export interface TaskExtractionResult {
  tasks: ExtractedTask[];
  hasTasks: boolean;
}

// ── OpenAI Task Extraction ───────────────────────────────────────

/**
 * Analyze a call transcript and extract actionable tasks,
 * matching each to the most appropriate department role.
 */
export async function extractTasksFromTranscript(params: {
  transcript: string;
  agentName: string;
  roles: Array<{ roleLabel: string; roleDescription?: string | null }>;
  callerPhone?: string;
  language?: string;
}): Promise<TaskExtractionResult> {
  if (!env.OPENAI_API_KEY) {
    log.warn('OPENAI_API_KEY not configured — skipping task extraction');
    return { tasks: [], hasTasks: false };
  }

  if (!params.transcript || params.transcript.trim().length < 20) {
    return { tasks: [], hasTasks: false };
  }

  if (params.roles.length === 0) {
    log.debug('No task email roles configured for agent — skipping extraction');
    return { tasks: [], hasTasks: false };
  }

  const rolesDescription = params.roles
    .map((r, i) => `${i + 1}. "${r.roleLabel}"${r.roleDescription ? ` — ${r.roleDescription}` : ''}`)
    .join('\n');

  const isGreek = params.language === 'el';

  const systemPrompt = `You are a task extraction AI for a business phone call system.
Analyze the call transcript and identify any actionable tasks or requests that require follow-up by the business.

Available departments/roles:
${rolesDescription}

RULES:
1. Only extract REAL tasks — things the caller explicitly requested or that clearly need action.
2. Do NOT create tasks for greetings, general inquiries that were already answered, or small talk.
3. Match each task to the MOST appropriate role from the list above.
4. If a task doesn't match any role, use the closest match.
5. Extract caller name and phone if mentioned in the transcript.
6. Set priority: "urgent" for time-sensitive requests, "high" for important, "normal" for standard, "low" for nice-to-have.
7. ${isGreek ? 'Write titles and descriptions in Greek.' : 'Write titles and descriptions in the same language as the transcript.'}

Respond with VALID JSON only. Schema:
{
  "tasks": [
    {
      "title": "Short task title",
      "description": "What the caller needs",
      "actionRequired": "What the department should do",
      "matchedRole": "Exact role label from the list",
      "priority": "normal",
      "callerName": "Name or null",
      "callerPhone": "Phone or null"
    }
  ]
}

If there are NO actionable tasks, respond: {"tasks": []}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Transcript:\n\n${params.transcript}` },
        ],
        temperature: 0.2,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error({ status: response.status, error: errorText }, 'OpenAI API error during task extraction');
      return { tasks: [], hasTasks: false };
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      log.warn('Empty response from OpenAI task extraction');
      return { tasks: [], hasTasks: false };
    }

    const parsed = JSON.parse(content) as { tasks: ExtractedTask[] };

    // Validate each task has required fields
    const validTasks = (parsed.tasks || []).filter(
      (t) => t.title && t.matchedRole && t.actionRequired,
    );

    // Inject caller phone from metadata if not found in transcript
    for (const task of validTasks) {
      if (!task.callerPhone && params.callerPhone) {
        task.callerPhone = params.callerPhone;
      }
      // Ensure priority is valid
      if (!['low', 'normal', 'high', 'urgent'].includes(task.priority)) {
        task.priority = 'normal';
      }
    }

    log.info(
      { taskCount: validTasks.length, roles: validTasks.map((t) => t.matchedRole) },
      'Tasks extracted from transcript',
    );

    return { tasks: validTasks, hasTasks: validTasks.length > 0 };
  } catch (error) {
    log.error({ error }, 'Failed to extract tasks from transcript');
    return { tasks: [], hasTasks: false };
  }
}
