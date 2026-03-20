import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ═══════════════════════════════════════════════════════════════════
// Test constants
// ═══════════════════════════════════════════════════════════════════

const CUSTOMER_ID = '00000000-0000-0000-0000-000000000001';
const AGENT_ID = '00000000-0000-0000-0000-000000000002';
const APT_ID = '00000000-0000-0000-0000-000000000099';
const CALL_ID = '00000000-0000-0000-0000-000000000077';
const EL_AGENT_ID = 'el_agent_abc123';

const mockCustomer = {
  id: CUSTOMER_ID,
  timezone: 'Europe/Athens',
  email: 'owner@test.com',
  ownerName: 'Test Owner',
  businessName: 'Test Biz',
  businessHours: null,
};

const mockAgent = {
  id: AGENT_ID,
  customerId: CUSTOMER_ID,
  elevenlabsAgentId: EL_AGENT_ID,
  isDefault: true,
  name: 'Test Agent',
  language: 'el',
  phoneNumber: '+30210000000',
  businessHours: null,
  customer: mockCustomer,
};

function makeMockLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

// ═══════════════════════════════════════════════════════════════════
// A. Schema — Drizzle unique constraint via getTableConfig
// AC: UNIQUE(customer_id, scheduled_at) constraint on appointments table
// ═══════════════════════════════════════════════════════════════════

describe('Schema: UNIQUE(customer_id, scheduled_at) constraint on appointments table', () => {
  it('has a unique constraint named uq_appointments_customer_time on (customer_id, scheduled_at)', async () => {
    const { getTableConfig } = await import('drizzle-orm/pg-core');
    const { appointments } = await import('../src/db/schema/appointments');
    const config = getTableConfig(appointments);

    const uq = config.uniqueConstraints.find(
      (c) => c.name === 'uq_appointments_customer_time',
    );
    expect(uq).toBeDefined();
    const colNames = uq!.columns.map((col) => col.name);
    expect(colNames).toContain('customer_id');
    expect(colNames).toContain('scheduled_at');
    expect(colNames).toHaveLength(2);
  });

  it('imports unique from drizzle-orm/pg-core in the schema file', async () => {
    const schemaSource = fs.readFileSync(
      path.resolve(import.meta.dirname, '../src/db/schema/appointments.ts'),
      'utf-8',
    );
    expect(schemaSource).toContain('unique');
    expect(schemaSource).toContain('uq_appointments_customer_time');
    expect(schemaSource).toContain('.on(table.customerId, table.scheduledAt)');
  });
});

// ═══════════════════════════════════════════════════════════════════
// B. Migration file — hand-written SQL for production
// AC: Drizzle migration created
// ═══════════════════════════════════════════════════════════════════

describe('Migration: 0012_appointment_unique_constraint.sql', () => {
  const migrationPath = path.resolve(
    import.meta.dirname,
    '../../../docker/migrations/0012_appointment_unique_constraint.sql',
  );

  it('exists in docker/migrations/', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it('contains ALTER TABLE appointments ADD CONSTRAINT with UNIQUE (customer_id, scheduled_at)', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    expect(sql).toMatch(/ALTER\s+TABLE\s+appointments/i);
    expect(sql).toMatch(/UNIQUE\s*\(\s*customer_id\s*,\s*scheduled_at\s*\)/i);
    expect(sql).toMatch(/uq_appointments_customer_time/i);
  });

  it('handles existing duplicate rows before adding the constraint', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    expect(sql).toMatch(/DELETE\s+FROM\s+appointments/i);
    const deleteIdx = sql.toLowerCase().indexOf('delete');
    const alterIdx = sql.toLowerCase().indexOf('alter');
    expect(deleteIdx).toBeLessThan(alterIdx);
  });
});

// ═══════════════════════════════════════════════════════════════════
// C. Path 1: POST /calendar/book (Legacy REST)
// AC: All 3 booking paths wrapped in db.transaction() with ON CONFLICT
// ═══════════════════════════════════════════════════════════════════

const bookPayload = {
  date: '2026-04-15',
  time: '10:00',
  caller_name: 'Νίκος Παπαδόπουλος',
  caller_phone: '+306912345678',
  customer_id: CUSTOMER_ID,
};

const mockCustomersFindFirst = vi.fn();
const mockAgentsFindFirst = vi.fn();
const mockAppointmentsFindFirst = vi.fn();

const mockReturning = vi.fn();
const mockOnConflictDoNothing = vi.fn(() => ({ returning: mockReturning }));
const mockValues = vi.fn(() => ({ onConflictDoNothing: mockOnConflictDoNothing, returning: mockReturning }));
const mockInsert = vi.fn(() => ({ values: mockValues }));

const mockTransaction = vi.fn(async (fn: Function) => {
  const tx = {
    query: {
      appointments: { findFirst: mockAppointmentsFindFirst },
    },
    insert: mockInsert,
  };
  return fn(tx);
});

vi.mock('../src/db/connection.js', () => ({
  db: {
    query: {
      customers: { findFirst: mockCustomersFindFirst },
      agents: { findFirst: mockAgentsFindFirst },
      appointments: { findFirst: mockAppointmentsFindFirst, findMany: vi.fn().mockResolvedValue([]) },
    },
    insert: mockInsert,
    transaction: mockTransaction,
  },
}));

vi.mock('../src/config/env.js', () => ({
  env: { DATABASE_URL: 'postgres://test', NODE_ENV: 'test', ENCRYPTION_KEY: '0'.repeat(64) },
}));

vi.mock('../src/config/logger.js', () => ({
  createLogger: () => makeMockLogger(),
}));

describe('Path 1: POST /calendar/book — double-booking prevention', () => {
  let toolRoutes: typeof import('../src/routes/tools.js').toolRoutes;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockCustomersFindFirst.mockResolvedValue(mockCustomer);
    mockAgentsFindFirst.mockResolvedValue(mockAgent);

    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing, returning: mockReturning });
    mockOnConflictDoNothing.mockReturnValue({ returning: mockReturning });

    vi.resetModules();
    const mod = await import('../src/routes/tools.js');
    toolRoutes = mod.toolRoutes;
  });

  const postBook = (routes: typeof toolRoutes, body = bookPayload) =>
    routes.request('http://localhost/calendar/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('books successfully when slot is free — returns success:true and appointment_id', async () => {
    mockAppointmentsFindFirst.mockResolvedValue(null);
    mockReturning.mockResolvedValue([{ id: APT_ID, scheduledAt: new Date('2026-04-15T07:00:00Z') }]);

    const res = await postBook(toolRoutes);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.appointment_id).toBe(APT_ID);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockOnConflictDoNothing).toHaveBeenCalledTimes(1);
  });

  it('rejects when app-level check finds existing appointment — insert never called', async () => {
    mockAppointmentsFindFirst.mockResolvedValue({
      id: 'existing-apt',
      customerId: CUSTOMER_ID,
      scheduledAt: new Date('2026-04-15T07:00:00Z'),
    });

    const res = await postBook(toolRoutes);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(false);
    expect(json.message).toContain('κρατημένη');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('rejects on race condition — onConflictDoNothing returns empty array', async () => {
    mockAppointmentsFindFirst.mockResolvedValue(null);
    mockReturning.mockResolvedValue([]);

    const res = await postBook(toolRoutes);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(false);
    expect(json.message).toContain('κρατημένη');
  });

  it('wraps booking in db.transaction() for atomicity', async () => {
    mockAppointmentsFindFirst.mockResolvedValue(null);
    mockReturning.mockResolvedValue([{ id: APT_ID }]);

    await postBook(toolRoutes);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    const txCallback = mockTransaction.mock.calls[0]![0];
    expect(typeof txCallback).toBe('function');
  });

  it('passes onConflictDoNothing with target [customer_id, scheduled_at]', async () => {
    mockAppointmentsFindFirst.mockResolvedValue(null);
    mockReturning.mockResolvedValue([{ id: APT_ID }]);

    await postBook(toolRoutes);

    expect(mockOnConflictDoNothing).toHaveBeenCalledWith({
      target: expect.arrayContaining([
        expect.objectContaining({ name: 'customer_id' }),
        expect.objectContaining({ name: 'scheduled_at' }),
      ]),
    });
  });

  it('rejects when customer_id is missing — no transaction started', async () => {
    const res = await postBook(toolRoutes, { ...bookPayload, customer_id: '' });
    const json = await res.json();

    expect(json.success).toBe(false);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('rejects when no default agent is found — no transaction started', async () => {
    mockAgentsFindFirst.mockResolvedValue(null);

    const res = await postBook(toolRoutes);
    const json = await res.json();

    expect(json.success).toBe(false);
    expect(json.message).toContain('βοηθός');
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════
// D. Path 2: POST /server-tool book_appointment (ElevenLabs)
// AC: All 3 booking paths wrapped in db.transaction() with ON CONFLICT
// ═══════════════════════════════════════════════════════════════════

describe('Path 2: POST /server-tool book_appointment — double-booking prevention', () => {
  let webhookRoutes: Awaited<typeof import('../src/routes/elevenlabs-webhooks.js')>['elevenlabsWebhookRoutes'];
  let mockTxTransaction: ReturnType<typeof vi.fn>;
  let mockTxInsert: ReturnType<typeof vi.fn>;
  let mockTxFindMany: ReturnType<typeof vi.fn>;
  let mockTxReturning: ReturnType<typeof vi.fn>;
  let mockTxOnConflict: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    mockTxReturning = vi.fn();
    mockTxOnConflict = vi.fn(() => ({ returning: mockTxReturning }));
    mockTxInsert = vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: mockTxOnConflict,
      })),
    }));
    mockTxFindMany = vi.fn().mockResolvedValue([]);
    mockTxTransaction = vi.fn();

    vi.doMock('../src/db/connection.js', () => ({
      db: {
        query: {
          agents: { findFirst: vi.fn().mockResolvedValue(mockAgent) },
          appointments: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
          webhookEvents: { findFirst: vi.fn().mockResolvedValue(null) },
          calls: { findFirst: vi.fn().mockResolvedValue(null) },
          customers: { findFirst: vi.fn().mockResolvedValue(mockCustomer) },
          callerMemories: { findFirst: vi.fn().mockResolvedValue(null) },
        },
        transaction: mockTxTransaction,
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ id: 'record-id' }]),
            onConflictDoNothing: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([]),
            })),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([]),
            })),
          })),
        })),
      },
    }));

    vi.doMock('../src/config/env.js', () => ({
      env: { NODE_ENV: 'test', ENCRYPTION_KEY: '0'.repeat(64), BASE_URL: 'http://localhost:3001' },
    }));

    vi.doMock('../src/config/logger.js', () => ({
      createLogger: () => makeMockLogger(),
    }));

    vi.doMock('../src/services/elevenlabs.js', () => ({
      isConfigured: vi.fn(() => false),
      getConversation: vi.fn(),
      updateAgent: vi.fn(),
    }));

    vi.doMock('../src/services/email.js', () => ({
      notifyCallCompleted: vi.fn().mockResolvedValue(undefined),
      sendTaskNotificationEmail: vi.fn().mockResolvedValue(undefined),
      isEmailConfigured: vi.fn(() => false),
      sendAppointmentInviteEmail: vi.fn().mockResolvedValue(undefined),
    }));

    vi.doMock('../src/services/telephony/index.js', () => ({
      getTelephonyProvider: vi.fn(() => ({
        lookupCallerNumber: vi.fn(),
        isSmsConfigured: vi.fn(() => false),
        sendCallSummarySms: vi.fn().mockResolvedValue(undefined),
      })),
    }));

    vi.doMock('../src/services/task-extraction.js', () => ({
      extractTasksFromTranscript: vi.fn().mockResolvedValue([]),
    }));

    vi.doMock('../src/services/transcript-parser.js', () => ({
      extractAppointmentFromTranscript: vi.fn(() => ({})),
    }));

    vi.doMock('../src/services/business-hours.js', () => ({
      parseBusinessHours: vi.fn(() => ({
        daySchedules: {
          monday: { enabled: true, start: '09:00', end: '17:00' },
          tuesday: { enabled: true, start: '09:00', end: '17:00' },
          wednesday: { enabled: true, start: '09:00', end: '17:00' },
          thursday: { enabled: true, start: '09:00', end: '17:00' },
          friday: { enabled: true, start: '09:00', end: '17:00' },
          saturday: { enabled: false, start: '09:00', end: '17:00' },
          sunday: { enabled: false, start: '09:00', end: '17:00' },
        },
        slotDurationMinutes: 30,
        closedDates: [],
      })),
      generateSlots: vi.fn(() => [
        '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
        '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
        '15:00', '15:30', '16:00', '16:30',
      ]),
      isWorkingDay: vi.fn(() => true),
      formatBusinessHoursForDisplay: vi.fn(() => '09:00-17:00'),
      getBusinessHoursSummary: vi.fn(() => 'Δευ-Παρ 09:00-17:00'),
    }));

    vi.doMock('../src/services/timezone.js', () => ({
      parseDateTimeInTimezone: vi.fn(() => new Date('2025-06-16T07:00:00Z')),
      getDayRangeInTimezone: vi.fn(() => ({
        startDate: new Date('2025-06-15T21:00:00Z'),
        endDate: new Date('2025-06-16T21:00:00Z'),
      })),
      formatTimeInTimezone: vi.fn(() => '10:00'),
      formatGreekDate: vi.fn(() => 'Δευτέρα 16 Ιουνίου'),
      getCurrentDateTime: vi.fn(() => ({ date: '2025-06-16', time: '10:00' })),
    }));

    vi.doMock('../src/services/ical.js', () => ({
      getIcalBusySlots: vi.fn().mockResolvedValue([]),
    }));

    vi.doMock('../src/services/ics-generator.js', () => ({
      generateIcsInvite: vi.fn(() => 'BEGIN:VCALENDAR\nEND:VCALENDAR'),
    }));

    vi.doMock('../src/routes/tasks.js', () => ({
      generateConfirmToken: vi.fn(() => 'mock-token'),
    }));

    const mod = await import('../src/routes/elevenlabs-webhooks.js');
    webhookRoutes = mod.elevenlabsWebhookRoutes;
  });

  const serverToolBody = {
    tool_name: 'book_appointment',
    agent_id: EL_AGENT_ID,
    conversation_id: 'conv_12345',
    parameters: {
      date: '2025-06-16',
      time: '10:00',
      caller_name: 'Μαρία Γεωργίου',
      caller_phone: '+306987654321',
      service_type: 'Γενική εξέταση',
      notes: 'Πρώτη επίσκεψη',
    },
  };

  const postServerTool = (body = serverToolBody) =>
    webhookRoutes.request('http://localhost/server-tool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('books successfully when slot is free — returns success:true with appointment details', async () => {
    mockTxFindMany.mockResolvedValue([]);
    mockTxReturning.mockResolvedValue([{ id: APT_ID }]);
    mockTxTransaction.mockImplementation(async (fn: Function) => {
      return fn({
        query: { appointments: { findMany: mockTxFindMany } },
        insert: mockTxInsert,
      });
    });

    const res = await postServerTool();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.appointment).toBeDefined();
    expect(json.appointment.id).toBe(APT_ID);
  });

  it('rejects with slot_taken:true when slot already booked (app-level busy time check)', async () => {
    mockTxFindMany.mockResolvedValue([
      { id: 'existing', scheduledAt: new Date('2025-06-16T07:00:00Z'), status: 'confirmed' },
    ]);
    mockTxTransaction.mockImplementation(async (fn: Function) => {
      return fn({
        query: { appointments: { findMany: mockTxFindMany } },
        insert: mockTxInsert,
      });
    });

    const res = await postServerTool();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(false);
    expect(json.slot_taken).toBe(true);
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('rejects on race condition — onConflictDoNothing returns empty (slot_taken:true)', async () => {
    mockTxFindMany.mockResolvedValue([]);
    mockTxReturning.mockResolvedValue([]);
    mockTxTransaction.mockImplementation(async (fn: Function) => {
      return fn({
        query: { appointments: { findMany: mockTxFindMany } },
        insert: mockTxInsert,
      });
    });

    const res = await postServerTool();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(false);
    expect(json.slot_taken).toBe(true);
    expect(mockTxOnConflict).toHaveBeenCalledTimes(1);
  });

  it('wraps booking in db.transaction()', async () => {
    mockTxFindMany.mockResolvedValue([]);
    mockTxReturning.mockResolvedValue([{ id: APT_ID }]);
    mockTxTransaction.mockImplementation(async (fn: Function) => {
      return fn({
        query: { appointments: { findMany: mockTxFindMany } },
        insert: mockTxInsert,
      });
    });

    await postServerTool();

    expect(mockTxTransaction).toHaveBeenCalledTimes(1);
    expect(mockTxTransaction).toHaveBeenCalledWith(expect.any(Function));
  });

  it('calls onConflictDoNothing with target [customer_id, scheduled_at]', async () => {
    mockTxFindMany.mockResolvedValue([]);
    mockTxReturning.mockResolvedValue([{ id: APT_ID }]);
    mockTxTransaction.mockImplementation(async (fn: Function) => {
      return fn({
        query: { appointments: { findMany: mockTxFindMany } },
        insert: mockTxInsert,
      });
    });

    await postServerTool();

    expect(mockTxOnConflict).toHaveBeenCalledWith({
      target: expect.arrayContaining([
        expect.objectContaining({ name: 'customer_id' }),
        expect.objectContaining({ name: 'scheduled_at' }),
      ]),
    });
  });

  it('provides nearest_available slot when the requested slot is taken', async () => {
    mockTxFindMany.mockResolvedValue([
      { id: 'existing', scheduledAt: new Date('2025-06-16T07:00:00Z'), status: 'confirmed' },
    ]);
    mockTxTransaction.mockImplementation(async (fn: Function) => {
      return fn({
        query: { appointments: { findMany: mockTxFindMany } },
        insert: mockTxInsert,
      });
    });

    const res = await postServerTool();
    const json = await res.json();

    expect(json.success).toBe(false);
    expect(json.nearest_available).toBeDefined();
    expect(typeof json.nearest_available).toBe('string');
  });
});

// ═══════════════════════════════════════════════════════════════════
// E. Path 3: POST /post-conversation (fallback appointment dedup)
// AC: All 3 booking paths use ON CONFLICT handling
// ═══════════════════════════════════════════════════════════════════

describe('Path 3: POST /post-conversation — appointment dedup with onConflictDoNothing', () => {
  let webhookRoutes: Awaited<typeof import('../src/routes/elevenlabs-webhooks.js')>['elevenlabsWebhookRoutes'];
  let mockPostDbInsert: ReturnType<typeof vi.fn>;
  let mockPostDbUpdate: ReturnType<typeof vi.fn>;
  let mockPostDbQuery: Record<string, any>;
  let mockPostOnConflict: ReturnType<typeof vi.fn>;
  let mockPostInsertReturning: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    mockPostInsertReturning = vi.fn().mockResolvedValue([{ id: APT_ID }]);
    mockPostOnConflict = vi.fn(() => ({
      returning: mockPostInsertReturning,
    }));

    mockPostDbInsert = vi.fn(() => ({
      values: vi.fn((vals: any) => {
        if (vals?.callerName !== undefined) {
          return { onConflictDoNothing: mockPostOnConflict };
        }
        return {
          returning: vi.fn().mockResolvedValue([{ id: 'record-id' }]),
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ id: 'record-id' }]),
          })),
        };
      }),
    }));

    const mockUpdateSetWhereReturning = vi.fn().mockResolvedValue([{ id: CALL_ID }]);
    const mockUpdateSetWhere = vi.fn(() => ({ returning: mockUpdateSetWhereReturning }));
    mockPostDbUpdate = vi.fn(() => ({
      set: vi.fn(() => ({
        where: mockUpdateSetWhere,
      })),
    }));

    mockPostDbQuery = {
      agents: { findFirst: vi.fn().mockResolvedValue(mockAgent) },
      appointments: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      webhookEvents: { findFirst: vi.fn().mockResolvedValue(null) },
      calls: { findFirst: vi.fn().mockResolvedValue(null) },
      customers: { findFirst: vi.fn().mockResolvedValue(mockCustomer) },
      callerMemories: { findFirst: vi.fn().mockResolvedValue(null) },
      agentTaskEmails: { findMany: vi.fn().mockResolvedValue([]) },
    };

    vi.doMock('../src/db/connection.js', () => ({
      db: {
        query: mockPostDbQuery,
        insert: mockPostDbInsert,
        update: mockPostDbUpdate,
        transaction: vi.fn(),
      },
    }));

    vi.doMock('../src/config/env.js', () => ({
      env: { NODE_ENV: 'test', ENCRYPTION_KEY: '0'.repeat(64), BASE_URL: 'http://localhost:3001' },
    }));

    vi.doMock('../src/config/logger.js', () => ({
      createLogger: () => makeMockLogger(),
    }));

    vi.doMock('../src/services/elevenlabs.js', () => ({
      isConfigured: vi.fn(() => false),
      getConversation: vi.fn(),
      updateAgent: vi.fn(),
    }));

    vi.doMock('../src/services/email.js', () => ({
      notifyCallCompleted: vi.fn().mockResolvedValue(undefined),
      sendTaskNotificationEmail: vi.fn().mockResolvedValue(undefined),
      isEmailConfigured: vi.fn(() => false),
      sendAppointmentInviteEmail: vi.fn().mockResolvedValue(undefined),
    }));

    vi.doMock('../src/services/telephony/index.js', () => ({
      getTelephonyProvider: vi.fn(() => ({
        lookupCallerNumber: vi.fn(),
        isSmsConfigured: vi.fn(() => false),
        sendCallSummarySms: vi.fn().mockResolvedValue(undefined),
      })),
    }));

    vi.doMock('../src/services/task-extraction.js', () => ({
      extractTasksFromTranscript: vi.fn().mockResolvedValue({ hasTasks: false, tasks: [] }),
    }));

    vi.doMock('../src/services/transcript-parser.js', () => ({
      extractAppointmentFromTranscript: vi.fn(() => ({})),
    }));

    vi.doMock('../src/services/business-hours.js', () => ({
      parseBusinessHours: vi.fn(() => ({
        daySchedules: {},
        slotDurationMinutes: 30,
        closedDates: [],
      })),
      generateSlots: vi.fn(() => []),
      isWorkingDay: vi.fn(() => true),
      formatBusinessHoursForDisplay: vi.fn(() => ''),
      getBusinessHoursSummary: vi.fn(() => ''),
    }));

    vi.doMock('../src/services/timezone.js', () => ({
      parseDateTimeInTimezone: vi.fn(() => new Date('2025-06-16T07:00:00Z')),
      getDayRangeInTimezone: vi.fn(() => ({
        startDate: new Date('2025-06-15T21:00:00Z'),
        endDate: new Date('2025-06-16T21:00:00Z'),
      })),
      formatTimeInTimezone: vi.fn(() => '10:00'),
      formatGreekDate: vi.fn(() => 'Δευτέρα 16 Ιουνίου'),
      getCurrentDateTime: vi.fn(() => ({ date: '2025-06-16', time: '10:00' })),
    }));

    vi.doMock('../src/services/ical.js', () => ({
      getIcalBusySlots: vi.fn().mockResolvedValue([]),
    }));

    vi.doMock('../src/services/ics-generator.js', () => ({
      generateIcsInvite: vi.fn(() => 'BEGIN:VCALENDAR\nEND:VCALENDAR'),
    }));

    vi.doMock('../src/routes/tasks.js', () => ({
      generateConfirmToken: vi.fn(() => 'mock-token'),
    }));

    const mod = await import('../src/routes/elevenlabs-webhooks.js');
    webhookRoutes = mod.elevenlabsWebhookRoutes;
  });

  function makePostConvPayload(overrides: Record<string, unknown> = {}) {
    return {
      conversation_id: `conv_postconv_${Date.now()}`,
      agent_id: EL_AGENT_ID,
      status: 'done',
      transcript: [
        { role: 'user', message: 'Θα ήθελα ένα ραντεβού αύριο στις 10', time_in_call_secs: 2 },
        { role: 'agent', message: 'Κλείστηκε!', time_in_call_secs: 5 },
      ],
      analysis: {
        call_successful: 'true',
        transcript_summary: 'Κλείστηκε ραντεβού.',
        data_collection: {
          appointment_date: '2025-06-16',
          appointment_time: '10:00',
          caller_name: 'Γιάννης Σταύρου',
          caller_phone: '+306912345678',
          caller_intent: 'appointment_booking',
          appointment_reason: 'Εξέταση',
        },
      },
      metadata: { caller_phone: '+306912345678' },
      ...overrides,
    };
  }

  const postConversation = (body: Record<string, unknown>) =>
    webhookRoutes.request('http://localhost/post-conversation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('links existing appointment to call record when one found within +-30min window — no new insert', async () => {
    const existingApt = {
      id: APT_ID,
      customerId: CUSTOMER_ID,
      agentId: AGENT_ID,
      scheduledAt: new Date('2025-06-16T07:00:00Z'),
      callId: null,
      status: 'pending',
    };
    mockPostDbQuery.appointments.findMany.mockResolvedValue([existingApt]);

    const res = await postConversation(makePostConvPayload());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);

    expect(mockPostDbUpdate).toHaveBeenCalled();
    expect(mockPostOnConflict).not.toHaveBeenCalled();
  });

  it('creates new appointment with onConflictDoNothing when none found in window', async () => {
    mockPostDbQuery.appointments.findMany.mockResolvedValue([]);

    const res = await postConversation(makePostConvPayload());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
    expect(mockPostOnConflict).toHaveBeenCalled();
  });

  it('silently skips when onConflictDoNothing returns empty (race condition dedup)', async () => {
    mockPostDbQuery.appointments.findMany.mockResolvedValue([]);
    mockPostInsertReturning.mockResolvedValue([]);

    const res = await postConversation(makePostConvPayload());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
  });

  it('uses onConflictDoNothing targeting [customer_id, scheduled_at]', async () => {
    mockPostDbQuery.appointments.findMany.mockResolvedValue([]);

    await postConversation(makePostConvPayload());

    expect(mockPostOnConflict).toHaveBeenCalledWith({
      target: expect.arrayContaining([
        expect.objectContaining({ name: 'customer_id' }),
        expect.objectContaining({ name: 'scheduled_at' }),
      ]),
    });
  });
});
