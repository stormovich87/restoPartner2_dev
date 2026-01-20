import { supabase } from './supabase';

export async function checkBotTokenUniqueness(
  partnerId: string,
  botToken: string,
  excludeType?: string,
  excludeId?: string,
  skipBranchCheck?: boolean
): Promise<{ isUnique: boolean; conflictType?: string }> {
  if (!botToken.trim()) {
    return { isUnique: true };
  }

  const token = botToken.trim();

  try {
    const checks = [
      { type: 'branch', query: supabase.from('branches').select('id').eq('partner_id', partnerId).eq('telegram_bot_token', token) },
      { type: 'executor', query: supabase.from('executors').select('id').eq('partner_id', partnerId).eq('telegram_bot_token', token) },
      { type: 'courier', query: supabase.from('partner_settings').select('id').eq('partner_id', partnerId).eq('courier_bot_token', token) },
      { type: 'external_courier', query: supabase.from('partner_settings').select('id').eq('partner_id', partnerId).eq('external_courier_bot_token', token) },
    ];

    for (const check of checks) {
      if (excludeType && check.type === excludeType) continue;
      if (skipBranchCheck && check.type === 'branch') continue;

      const { data, error } = await check.query;

      if (error) throw error;

      if (data && data.length > 0) {
        if (excludeType === check.type && excludeId) {
          const filteredData = data.filter(item => item.id !== excludeId);
          if (filteredData.length > 0) {
            return { isUnique: false, conflictType: check.type };
          }
        } else {
          return { isUnique: false, conflictType: check.type };
        }
      }
    }

    return { isUnique: true };
  } catch (error) {
    console.error('Error checking bot token uniqueness:', error);
    throw error;
  }
}

export function getConflictMessage(conflictType: string): string {
  const messages: { [key: string]: string } = {
    branch: 'этот токен уже используется для филиала',
    executor: 'этот токен уже используется для исполнителя',
    courier: 'этот токен уже используется для бота регистрации курьеров',
    external_courier: 'этот токен уже используется для бота сторонних курьеров',
  };
  return messages[conflictType] || 'этот токен уже используется в другом месте';
}
