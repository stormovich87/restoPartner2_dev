import { supabase } from './supabase';

export type LogLevel = 'info' | 'warning' | 'error' | 'critical';

export type LogSection =
  | 'orders'
  | 'branches'
  | 'couriers'
  | 'payment_methods'
  | 'settings'
  | 'auth'
  | 'system'
  | 'general'
  | 'poster'
  | 'menu';

interface LogParams {
  partnerId: string;
  section: LogSection;
  level: LogLevel;
  message: string;
  details?: any;
  userId?: string;
  action?: string;
}

export async function log(params: LogParams) {
  try {
    const logEntry: any = {
      partner_id: params.partnerId,
      section: params.section,
      log_level: params.level,
      message: params.message,
      details: params.details || null,
      action: params.action || null,
    };

    if (params.userId) {
      logEntry.user_id = params.userId;
    }

    const { error } = await supabase
      .from('logs')
      .insert(logEntry);

    if (error) {
      console.error('Failed to write log:', error);
    }
  } catch (err) {
    console.error('Logger error:', err);
  }
}

export const logger = {
  info: (partnerId: string, section: LogSection, message: string, details?: any) =>
    log({ partnerId, section, level: 'info', message, details }),

  warning: (partnerId: string, section: LogSection, message: string, details?: any) =>
    log({ partnerId, section, level: 'warning', message, details }),

  error: (partnerId: string, section: LogSection, message: string, details?: any) =>
    log({ partnerId, section, level: 'error', message, details }),

  critical: (partnerId: string, section: LogSection, message: string, details?: any) =>
    log({ partnerId, section, level: 'critical', message, details }),
};
