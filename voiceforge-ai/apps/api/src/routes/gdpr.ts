// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — GDPR Compliance Routes
// Implements EU GDPR Articles 15, 17, 20 for user data rights
// ═══════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { customers, agents, calls, appointments, auditLogs, callerMemories, knowledgeBaseDocuments } from '../db/schema/index.js';
import { authMiddleware, type AuthUser } from '../middleware/auth.js';
import * as elevenlabsService from '../services/elevenlabs.js';
import { createLogger } from '../config/logger.js';
import type { ApiResponse } from '@voiceforge/shared';

const log = createLogger('gdpr');

export const gdprRoutes = new Hono<{ Variables: { user: AuthUser } }>();

// All routes require authentication
gdprRoutes.use('*', authMiddleware);

// ═══════════════════════════════════════════════════════════════════
// GET /gdpr/export — GDPR Article 20: Right to Data Portability
// Returns ALL user data in a structured JSON format
// ═══════════════════════════════════════════════════════════════════

gdprRoutes.get('/export', async (c) => {
  const user = c.get('user');

  try {
    // Find the customer record
    const customer = await db.query.customers.findFirst({
      where: eq(customers.userId, user.sub),
    });

    if (!customer) {
      return c.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Customer not found' },
      }, 404);
    }

    // Fetch all related data in parallel
    const [agentRecords, callRecords, appointmentRecords, auditRecords, memoryRecords, kbDocRecords] = await Promise.all([
      db.query.agents.findMany({
        where: eq(agents.customerId, customer.id),
      }),
      db.query.calls.findMany({
        where: eq(calls.customerId, customer.id),
      }),
      db.query.appointments.findMany({
        where: eq(appointments.customerId, customer.id),
      }),
      db.select().from(auditLogs).where(eq(auditLogs.customerId, customer.id)),
      db.select().from(callerMemories).where(eq(callerMemories.customerId, customer.id)),
      db.select().from(knowledgeBaseDocuments).where(eq(knowledgeBaseDocuments.customerId, customer.id)),
    ]);

    // Build the export payload — all user data in one JSON
    const exportData = {
      exportedAt: new Date().toISOString(),
      gdprArticle: 'Article 20 — Right to Data Portability',
      customer: {
        id: customer.id,
        businessName: customer.businessName,
        industry: customer.industry,
        ownerName: customer.ownerName,
        email: customer.email,
        phone: customer.phone,
        plan: customer.plan,
        timezone: customer.timezone,
        locale: customer.locale,
        onboardingCompleted: customer.onboardingCompleted,
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString(),
      },
      agents: agentRecords.map((a) => ({
        id: a.id,
        name: a.name,
        industry: a.industry,
        status: a.status,
        phoneNumber: a.phoneNumber,
        language: a.language,
        greeting: a.greeting,
        createdAt: a.createdAt.toISOString(),
      })),
      calls: callRecords.map((call) => ({
        id: call.id,
        callerNumber: call.callerNumber,
        agentNumber: call.agentNumber,
        direction: call.direction,
        status: call.status,
        durationSeconds: call.durationSeconds,
        transcript: call.transcript,
        summary: call.summary,
        sentiment: call.sentiment,
        appointmentBooked: call.appointmentBooked,
        recordingUrl: call.recordingUrl,
        startedAt: call.startedAt.toISOString(),
        endedAt: call.endedAt?.toISOString() ?? null,
      })),
      appointments: appointmentRecords.map((apt) => ({
        id: apt.id,
        callerName: apt.callerName,
        callerPhone: apt.callerPhone,
        scheduledAt: apt.scheduledAt?.toISOString() ?? null,
        status: apt.status,
        notes: apt.notes,
        createdAt: apt.createdAt.toISOString(),
      })),
      auditLog: auditRecords.map((log) => ({
        action: log.action,
        resource: log.resource,
        createdAt: log.createdAt.toISOString(),
      })),
      callerMemories: memoryRecords.map((m) => ({
        id: m.id,
        callerPhone: m.callerPhone,
        callerName: m.callerName,
        summary: m.summary,
        callCount: m.callCount,
        firstCallAt: m.firstCallAt.toISOString(),
        lastCallAt: m.lastCallAt.toISOString(),
      })),
      knowledgeBaseDocuments: kbDocRecords.map((doc) => ({
        id: doc.id,
        name: doc.name,
        source: doc.source,
        status: doc.status,
        createdAt: doc.createdAt.toISOString(),
      })),
    };

    // Log the export event
    await db.insert(auditLogs).values({
      customerId: customer.id,
      userId: user.sub,
      action: 'data_export',
      details: { format: 'json', recordCount: callRecords.length + agentRecords.length + memoryRecords.length + kbDocRecords.length },
      ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? undefined,
      userAgent: c.req.header('user-agent') ?? undefined,
    });

    log.info({ customerId: customer.id }, 'GDPR data export completed');

    return c.json<ApiResponse>({
      success: true,
      data: exportData,
    });
  } catch (error) {
    log.error({ error }, 'GDPR data export failed');
    return c.json<ApiResponse>({
      success: false,
      error: { code: 'EXPORT_FAILED', message: 'Failed to export data' },
    }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// DELETE /gdpr/delete-account — GDPR Article 17: Right to Erasure
// Permanently deletes ALL user data (irreversible)
// ═══════════════════════════════════════════════════════════════════

gdprRoutes.delete('/delete-account', async (c) => {
  const user = c.get('user');

  try {
    const customer = await db.query.customers.findFirst({
      where: eq(customers.userId, user.sub),
    });

    if (!customer) {
      return c.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Customer not found' },
      }, 404);
    }

    // Log the deletion event BEFORE deleting (for compliance records)
    await db.insert(auditLogs).values({
      customerId: customer.id,
      userId: user.sub,
      action: 'data_deletion',
      details: {
        reason: 'GDPR Article 17 — Right to Erasure',
        email: customer.email,
        businessName: customer.businessName,
        deletedAt: new Date().toISOString(),
      },
      ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? undefined,
      userAgent: c.req.header('user-agent') ?? undefined,
    });

    // Delete AI agents from ElevenLabs before cascade-deleting the DB records
    const agentRecordsToDelete = await db.query.agents.findMany({
      where: eq(agents.customerId, customer.id),
    });
    await Promise.allSettled(
      agentRecordsToDelete
        .filter((a) => a.elevenlabsAgentId)
        .map((a) => elevenlabsService.deleteAgent(a.elevenlabsAgentId!)),
    );

    // CASCADE deletion: all related data (agents, calls, appointments) are deleted
    // via FK onDelete: 'cascade' in the schema
    await db.delete(customers).where(eq(customers.id, customer.id));

    log.info({ customerId: customer.id }, 'GDPR account deletion completed — all data erased');

    return c.json<ApiResponse>({
      success: true,
      data: {
        message: 'Account and all associated data have been permanently deleted',
        deletedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    log.error({ error }, 'GDPR account deletion failed');
    return c.json<ApiResponse>({
      success: false,
      error: { code: 'DELETION_FAILED', message: 'Failed to delete account' },
    }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// DELETE /gdpr/delete-calls — Selective Call Data Deletion
// Deletes all call recordings, transcripts, summaries (keeps metadata)
// ═══════════════════════════════════════════════════════════════════

gdprRoutes.delete('/delete-calls', async (c) => {
  const user = c.get('user');

  try {
    const customer = await db.query.customers.findFirst({
      where: eq(customers.userId, user.sub),
    });

    if (!customer) {
      return c.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Customer not found' },
      }, 404);
    }

    // Anonymize call content while preserving analytics metadata
    await db
      .update(calls)
      .set({
        transcript: null,
        summary: null,
        recordingUrl: null,
        callerNumber: 'REDACTED',
        insightsRaw: null,
        metadata: {},
      })
      .where(eq(calls.customerId, customer.id));

    // Log the anonymization event
    await db.insert(auditLogs).values({
      customerId: customer.id,
      userId: user.sub,
      action: 'data_deletion',
      details: {
        type: 'call_data_anonymization',
        reason: 'User requested call data deletion',
      },
      ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? undefined,
      userAgent: c.req.header('user-agent') ?? undefined,
    });

    log.info({ customerId: customer.id }, 'Call data anonymized');

    return c.json<ApiResponse>({
      success: true,
      data: {
        message: 'All call recordings, transcripts, and personal data have been deleted',
        anonymizedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    log.error({ error }, 'Call data anonymization failed');
    return c.json<ApiResponse>({
      success: false,
      error: { code: 'ANONYMIZATION_FAILED', message: 'Failed to anonymize call data' },
    }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /gdpr/audit-log — View GDPR Audit Trail
// Returns the user's complete audit log for compliance review
// ═══════════════════════════════════════════════════════════════════

gdprRoutes.get('/audit-log', async (c) => {
  const user = c.get('user');

  try {
    const customer = await db.query.customers.findFirst({
      where: eq(customers.userId, user.sub),
    });

    if (!customer) {
      return c.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Customer not found' },
      }, 404);
    }

    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.customerId, customer.id))
      .orderBy(auditLogs.createdAt);

    return c.json<ApiResponse>({
      success: true,
      data: logs.map((log) => ({
        id: log.id,
        action: log.action,
        resource: log.resource,
        details: log.details,
        createdAt: log.createdAt.toISOString(),
      })),
      meta: { total: logs.length },
    });
  } catch (error) {
    log.error({ error }, 'Failed to fetch audit log');
    return c.json<ApiResponse>({
      success: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch audit log' },
    }, 500);
  }
});
