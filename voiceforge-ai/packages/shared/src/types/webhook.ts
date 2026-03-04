/** Telnyx Dynamic Variables Webhook — incoming payload */
export interface DynamicVariablesWebhookPayload {
  data: {
    record_type: 'event';
    id: string;
    event_type: 'assistant.initialization';
    occurred_at: string;
    payload: {
      telnyx_conversation_channel: 'phone_call' | 'web_call' | 'sms_chat';
      telnyx_agent_target: string;
      telnyx_end_user_target: string;
      telnyx_end_user_target_verified: boolean;
      call_control_id: string;
      assistant_id: string;
    };
  };
}

/** Our response to dynamic variables webhook (must respond <1s) */
export interface DynamicVariablesResponse {
  dynamic_variables: Record<string, string>;
  memory?: {
    conversation_query?: string;
    insight_query?: string;
  };
  conversation?: {
    metadata?: Record<string, string>;
  };
}

/** Telnyx Post-Call Insights webhook payload */
export interface InsightsWebhookPayload {
  data: {
    record_type: 'event';
    id: string;
    event_type: 'call.conversation_insights.generated';
    occurred_at: string;
    payload: {
      conversation_id: string;
      assistant_id: string;
      insights: Record<string, unknown>;
    };
  };
}

/** Telnyx Conversation Ended webhook payload */
export interface ConversationEndedPayload {
  data: {
    record_type: 'event';
    id: string;
    event_type: 'call.conversation.ended';
    occurred_at: string;
    payload: {
      conversation_id: string;
      assistant_id: string;
      call_control_id: string;
      duration_seconds: number;
      transcript: string;
      telnyx_agent_target: string;
      telnyx_end_user_target: string;
    };
  };
}

/** Tool webhook payload — calendar check */
export interface CalendarCheckPayload {
  requested_date: string;
  service_type?: string;
  customer_id?: string;
}

/** Tool webhook response — calendar check */
export interface CalendarCheckResponse {
  available_slots: string[];
  message: string;
}

/** Tool webhook payload — appointment booking */
export interface AppointmentBookPayload {
  date: string;
  time: string;
  caller_name: string;
  caller_phone: string;
  service_type?: string;
  notes?: string;
  customer_id?: string;
}

/** Tool webhook response — appointment booking */
export interface AppointmentBookResponse {
  success: boolean;
  appointment_id?: string;
  message: string;
  confirmation: string;
}

/** Standardized API response envelope */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    year?: number;
    month?: number;
  };
}
