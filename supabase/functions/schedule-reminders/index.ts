import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface PartnerSettings {
  partner_id: string;
  planning_horizon_days: number;
  manager_reminders_enabled: boolean;
  manager_reminders_every_n_days: number;
  manager_reminders_times_per_day: number;
  manager_reminders_at_times: string[];
  employee_confirm_reminders_enabled: boolean;
  employee_confirm_reminders_every_n_days: number;
  employee_confirm_reminders_times_per_day: number;
  employee_confirm_reminders_at_times: string[];
  schedule_confirm_deadline_hours: number;
  timezone: string;
  employee_bot_token: string | null;
}

interface BranchScheduleSettings {
  branch_id: string;
  min_staff_per_day: number;
}

async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  message: string
): Promise<{ success: boolean; messageId?: number }> {
  try {
    const sendResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
        }),
      }
    );
    const sendResult = await sendResponse.json();
    if (sendResult.ok) {
      return { success: true, messageId: sendResult.result.message_id };
    }
    console.error("Telegram send failed:", sendResult);
    return { success: false };
  } catch (error) {
    console.error("Error sending telegram message:", error);
    return { success: false };
  }
}

async function deleteTelegramMessage(
  botToken: string,
  chatId: string,
  messageId: number
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/deleteMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
        }),
      }
    );
    const result = await response.json();
    return result.ok;
  } catch (error) {
    console.error("Error deleting telegram message:", error);
    return false;
  }
}

function getTodayInTimezone(timezone: string): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const dateStr = formatter.format(now);
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function checkBranchHorizonCoverage(
  partnerId: string,
  branchId: string,
  planningHorizonDays: number,
  minStaffPerDay: number,
  timezone: string = 'Europe/Kiev'
): Promise<{ isCovered: boolean; unfilledDays: string[]; requiredDate: string }> {
  const today = getTodayInTimezone(timezone);

  const requiredDate = new Date(today);
  requiredDate.setDate(requiredDate.getDate() + planningHorizonDays);

  const todayStr = formatDateToYYYYMMDD(today);
  const requiredDateStr = formatDateToYYYYMMDD(requiredDate);

  const { data: shifts } = await supabase
    .from("schedule_shifts")
    .select("date")
    .eq("partner_id", partnerId)
    .eq("branch_id", branchId)
    .gte("date", todayStr)
    .lte("date", requiredDateStr);

  const shiftsByDate: Record<string, number> = {};
  (shifts || []).forEach((s: any) => {
    shiftsByDate[s.date] = (shiftsByDate[s.date] || 0) + 1;
  });

  const unfilledDays: string[] = [];
  const currentDate = new Date(today);

  while (currentDate <= requiredDate) {
    const dateStr = formatDateToYYYYMMDD(currentDate);
    const dayShiftsCount = shiftsByDate[dateStr] || 0;

    if (dayShiftsCount < minStaffPerDay) {
      unfilledDays.push(dateStr);
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return {
    isCovered: unfilledDays.length === 0,
    unfilledDays,
    requiredDate: requiredDateStr,
  };
}

async function deleteExistingReminders(
  partnerId: string,
  managerId: string,
  branchScopeHash: string,
  botToken: string
): Promise<void> {
  const { data: existingLogs } = await supabase
    .from("schedule_manager_reminder_log")
    .select("id, telegram_message_id, telegram_chat_id, event_id")
    .eq("partner_id", partnerId)
    .eq("responsible_manager_id", managerId)
    .eq("branch_scope_hash", branchScopeHash)
    .eq("is_active", true);

  if (!existingLogs || existingLogs.length === 0) return;

  for (const log of existingLogs) {
    if (log.telegram_message_id && log.telegram_chat_id) {
      await deleteTelegramMessage(botToken, log.telegram_chat_id, log.telegram_message_id);
    }

    if (log.event_id) {
      await supabase
        .from("employee_events")
        .delete()
        .eq("id", log.event_id);
    }

    await supabase
      .from("schedule_manager_reminder_log")
      .update({ is_active: false })
      .eq("id", log.id);
  }
}

function getCurrentTimeInTimezone(timezone: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const hour = parts.find(p => p.type === 'hour')?.value || '00';
  const minute = parts.find(p => p.type === 'minute')?.value || '00';
  return `${hour}:${minute}`;
}

function isWithinTimeWindow(currentTime: string, targetTime: string, windowMinutes: number = 5): boolean {
  const [currentHour, currentMin] = currentTime.split(':').map(Number);
  const [targetHour, targetMin] = targetTime.split(':').map(Number);

  const currentMinutes = currentHour * 60 + currentMin;
  const targetMinutes = targetHour * 60 + targetMin;

  const diff = Math.abs(currentMinutes - targetMinutes);
  return diff <= windowMinutes;
}

async function shouldSendManagerReminder(
  partnerId: string,
  everyNDays: number,
  timezone: string
): Promise<boolean> {
  const { data: lastLog } = await supabase
    .from("schedule_manager_reminder_log")
    .select("sent_at")
    .eq("partner_id", partnerId)
    .eq("is_active", true)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastLog?.sent_at) return true;

  const lastSentDate = new Date(lastLog.sent_at);
  const now = new Date();
  const minutesSinceLastSent = (now.getTime() - lastSentDate.getTime()) / (1000 * 60);

  if (minutesSinceLastSent < 10) {
    return false;
  }

  if (everyNDays > 1) {
    const diffDays = Math.floor((now.getTime() - lastSentDate.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= everyNDays;
  }

  return true;
}

async function processManagerReminders(settings: PartnerSettings) {
  if (!settings.manager_reminders_enabled || !settings.employee_bot_token) {
    return { processed: 0, skipped: "disabled" };
  }

  const currentTime = getCurrentTimeInTimezone(settings.timezone || 'Europe/Kiev');
  const shouldSendNow = settings.manager_reminders_at_times.some(time =>
    isWithinTimeWindow(currentTime, time, 5)
  );

  if (!shouldSendNow) {
    return { processed: 0, skipped: "time_not_matched", currentTime, configuredTimes: settings.manager_reminders_at_times };
  }

  const canSend = await shouldSendManagerReminder(
    settings.partner_id,
    settings.manager_reminders_every_n_days,
    settings.timezone || 'Europe/Kiev'
  );

  if (!canSend) {
    return { processed: 0, skipped: "frequency_not_met" };
  }

  const { data: branchSettings } = await supabase
    .from("branch_schedule_settings")
    .select("branch_id, min_staff_per_day")
    .eq("partner_id", settings.partner_id);

  const branchSettingsMap: Record<string, number> = {};
  (branchSettings || []).forEach((bs: BranchScheduleSettings) => {
    branchSettingsMap[bs.branch_id] = bs.min_staff_per_day;
  });

  const { data: managers } = await supabase
    .from("schedule_responsible_managers")
    .select(`
      id, employee_id,
      employee:employees(id, first_name, last_name, telegram_user_id)
    `)
    .eq("partner_id", settings.partner_id)
    .eq("is_active", true);

  if (!managers || managers.length === 0) {
    return { processed: 0, skipped: "no_managers" };
  }

  let processedCount = 0;

  const { data: allPartnerBranches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("partner_id", settings.partner_id);

  for (const manager of managers) {
    const employee = manager.employee as any;
    if (!employee?.telegram_user_id) continue;

    const { data: assignedBranches } = await supabase
      .from("schedule_responsible_branches")
      .select("branch_id, branch:branches(id, name)")
      .eq("responsible_manager_id", manager.id);

    let branchesToCheck: { branch_id: string; branch: { id: string; name: string } | null }[] = [];

    if (assignedBranches && assignedBranches.length > 0) {
      branchesToCheck = assignedBranches;
    } else if (allPartnerBranches && allPartnerBranches.length > 0) {
      branchesToCheck = allPartnerBranches.map(b => ({
        branch_id: b.id,
        branch: { id: b.id, name: b.name }
      }));
    } else {
      continue;
    }

    const branchIds = branchesToCheck.map((b: any) => b.branch_id).sort();
    const branchScopeHash = btoa(branchIds.join(",")).substring(0, 32);

    const unfilledBranches: { name: string; unfilledCount: number }[] = [];
    let allCovered = true;

    for (const branchData of branchesToCheck) {
      const branch = branchData.branch as any;
      if (!branch) continue;

      const minStaff = branchSettingsMap[branchData.branch_id] || 1;
      const coverage = await checkBranchHorizonCoverage(
        settings.partner_id,
        branchData.branch_id,
        settings.planning_horizon_days,
        minStaff,
        settings.timezone || 'Europe/Kiev'
      );

      if (!coverage.isCovered) {
        allCovered = false;
        unfilledBranches.push({
          name: branch.name,
          unfilledCount: coverage.unfilledDays.length,
        });
      }
    }

    if (allCovered) {
      await deleteExistingReminders(
        settings.partner_id,
        manager.id,
        branchScopeHash,
        settings.employee_bot_token
      );
      continue;
    }

    const { data: existingLog } = await supabase
      .from("schedule_manager_reminder_log")
      .select("id, telegram_message_id, event_id")
      .eq("partner_id", settings.partner_id)
      .eq("responsible_manager_id", manager.id)
      .eq("branch_scope_hash", branchScopeHash)
      .eq("is_active", true)
      .maybeSingle();

    if (existingLog?.telegram_message_id) {
      await deleteTelegramMessage(
        settings.employee_bot_token,
        employee.telegram_user_id,
        existingLog.telegram_message_id
      );
    }

    if (existingLog?.event_id) {
      await supabase
        .from("employee_events")
        .delete()
        .eq("id", existingLog.event_id);
    }

    const requiredDate = new Date();
    requiredDate.setDate(requiredDate.getDate() + settings.planning_horizon_days);
    const requiredDateStr = requiredDate.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const branchList = unfilledBranches
      .map((b) => `  - ${b.name} (${b.unfilledCount} дн.)`)
      .join("\n");

    const message =
      `<b>Напоминание: заполните график</b>\n\n` +
      `Нужно составить/дополнить график до <b>${requiredDateStr}</b>\n\n` +
      `<b>Филиалы с незаполненным графиком:</b>\n${branchList}`;

    const telegramResult = await sendTelegramMessage(
      settings.employee_bot_token,
      employee.telegram_user_id,
      message
    );

    const { data: newEvent } = await supabase
      .from("employee_events")
      .insert({
        partner_id: settings.partner_id,
        employee_id: employee.id,
        event_type: "planning_horizon_reminder",
        title: "Напоминание: заполните график",
        message: `Нужно составить/дополнить график до ${requiredDateStr}. Филиалы: ${unfilledBranches.map((b) => b.name).join(", ")}`,
        telegram_chat_id: employee.telegram_user_id,
        telegram_message_id: telegramResult.messageId,
      })
      .select("id")
      .single();

    if (existingLog) {
      await supabase
        .from("schedule_manager_reminder_log")
        .update({
          telegram_message_id: telegramResult.messageId,
          required_date: requiredDate.toISOString().split("T")[0],
          event_id: newEvent?.id,
          sent_at: new Date().toISOString(),
        })
        .eq("id", existingLog.id);
    } else {
      await supabase.from("schedule_manager_reminder_log").insert({
        partner_id: settings.partner_id,
        responsible_manager_id: manager.id,
        branch_scope_hash: branchScopeHash,
        required_date: requiredDate.toISOString().split("T")[0],
        telegram_chat_id: employee.telegram_user_id,
        telegram_message_id: telegramResult.messageId,
        event_id: newEvent?.id,
        is_active: true,
      });
    }

    await supabase.from("schedule_action_logs").insert({
      partner_id: settings.partner_id,
      actor_type: "system",
      action_type: "manager_reminder_sent",
      target_type: "responsible_manager",
      target_id: manager.id,
      details: {
        required_date: requiredDate.toISOString().split("T")[0],
        unfilled_branches: unfilledBranches,
      },
    });

    processedCount++;
  }

  return { processed: processedCount };
}

async function shouldSendEmployeeReminder(
  partnerId: string,
  employeeId: string,
  everyNDays: number,
  timezone: string
): Promise<boolean> {
  const { data: lastLog } = await supabase
    .from("schedule_employee_reminder_log")
    .select("sent_at")
    .eq("partner_id", partnerId)
    .eq("employee_id", employeeId)
    .eq("is_active", true)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastLog?.sent_at) return true;

  const lastSentDate = new Date(lastLog.sent_at);
  const now = new Date();
  const minutesSinceLastSent = (now.getTime() - lastSentDate.getTime()) / (1000 * 60);

  if (minutesSinceLastSent < 10) {
    return false;
  }

  if (everyNDays > 1) {
    const diffDays = Math.floor((now.getTime() - lastSentDate.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= everyNDays;
  }

  return true;
}

async function processEmployeeReminders(settings: PartnerSettings) {
  if (!settings.employee_confirm_reminders_enabled || !settings.employee_bot_token) {
    return { processed: 0, skipped: "disabled" };
  }

  const currentTime = getCurrentTimeInTimezone(settings.timezone || 'Europe/Kiev');
  const shouldSendNow = settings.employee_confirm_reminders_at_times.some(time =>
    isWithinTimeWindow(currentTime, time, 5)
  );

  if (!shouldSendNow) {
    return { processed: 0, skipped: "time_not_matched", currentTime, configuredTimes: settings.employee_confirm_reminders_at_times };
  }

  const today = new Date().toISOString().split("T")[0];

  const { data: pendingShifts } = await supabase
    .from("schedule_shifts")
    .select(`
      id, date, start_time, end_time, staff_member_id,
      branch:branches(name),
      employee:employees!schedule_shifts_employee_id_fkey(id, first_name, last_name, telegram_user_id)
    `)
    .eq("partner_id", settings.partner_id)
    .in("confirmation_status", ["pending", "partially_confirmed"])
    .gte("date", today)
    .order("date", { ascending: true });

  if (!pendingShifts || pendingShifts.length === 0) {
    return { processed: 0, skipped: "no_pending" };
  }

  const shiftsByEmployee = pendingShifts.reduce((acc: any, shift: any) => {
    const empId = shift.staff_member_id;
    if (!empId) return acc;
    if (!acc[empId]) acc[empId] = [];
    acc[empId].push(shift);
    return acc;
  }, {});

  let processedCount = 0;

  for (const [employeeId, shifts] of Object.entries(shiftsByEmployee)) {
    const employee = (shifts as any[])[0].employee as any;
    if (!employee?.telegram_user_id) continue;

    const canSend = await shouldSendEmployeeReminder(
      settings.partner_id,
      employeeId,
      settings.employee_confirm_reminders_every_n_days,
      settings.timezone || 'Europe/Kiev'
    );

    if (!canSend) continue;

    const pendingShiftsList = shifts as any[];

    const shiftDates = pendingShiftsList
      .map((s: any) => {
        const date = new Date(s.date);
        return date.toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "short",
        });
      })
      .slice(0, 5);

    const periodKey = `${new Date().toISOString().split("T")[0]}_confirm`;

    const { data: existingLog } = await supabase
      .from("schedule_employee_reminder_log")
      .select("id, telegram_message_id, event_id")
      .eq("partner_id", settings.partner_id)
      .eq("employee_id", employeeId)
      .eq("schedule_period_key", periodKey)
      .eq("is_active", true)
      .maybeSingle();

    if (existingLog?.telegram_message_id) {
      await deleteTelegramMessage(
        settings.employee_bot_token,
        employee.telegram_user_id,
        existingLog.telegram_message_id
      );
    }

    if (existingLog?.event_id) {
      await supabase
        .from("employee_events")
        .delete()
        .eq("id", existingLog.event_id);
    }

    const message =
      `<b>Подтвердите график</b>\n\n` +
      `У вас есть неподтверждённые смены:\n` +
      `${shiftDates.join(", ")}${pendingShiftsList.length > 5 ? ` и еще ${pendingShiftsList.length - 5}` : ""}\n\n` +
      `Пожалуйста, подтвердите или откажитесь от смен в личном кабинете.`;

    const telegramResult = await sendTelegramMessage(
      settings.employee_bot_token,
      employee.telegram_user_id,
      message
    );

    const { data: newEvent } = await supabase
      .from("employee_events")
      .insert({
        partner_id: settings.partner_id,
        employee_id: employee.id,
        event_type: "schedule_confirm_reminder",
        title: "Подтвердите график",
        message: `У вас ${pendingShiftsList.length} неподтверждённых смен. Подтвердите график.`,
        telegram_chat_id: employee.telegram_user_id,
        telegram_message_id: telegramResult.messageId,
      })
      .select("id")
      .single();

    if (existingLog) {
      await supabase
        .from("schedule_employee_reminder_log")
        .update({
          telegram_message_id: telegramResult.messageId,
          event_id: newEvent?.id,
          sent_at: new Date().toISOString(),
        })
        .eq("id", existingLog.id);
    } else {
      await supabase.from("schedule_employee_reminder_log").insert({
        partner_id: settings.partner_id,
        employee_id: employeeId,
        schedule_period_key: periodKey,
        telegram_chat_id: employee.telegram_user_id,
        telegram_message_id: telegramResult.messageId,
        event_id: newEvent?.id,
        is_active: true,
      });
    }

    await supabase.from("schedule_action_logs").insert({
      partner_id: settings.partner_id,
      actor_type: "system",
      action_type: "employee_confirm_reminder_sent",
      target_type: "employee",
      target_id: employeeId,
      details: {
        pending_count: pendingShiftsList.length,
      },
    });

    processedCount++;
  }

  return { processed: processedCount };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { data: allSettings, error: settingsError } = await supabase
      .from("partner_settings")
      .select(`
        partner_id,
        planning_horizon_days,
        manager_reminders_enabled,
        manager_reminders_every_n_days,
        manager_reminders_times_per_day,
        manager_reminders_at_times,
        employee_confirm_reminders_enabled,
        employee_confirm_reminders_every_n_days,
        employee_confirm_reminders_times_per_day,
        employee_confirm_reminders_at_times,
        schedule_confirm_deadline_hours,
        timezone,
        employee_bot_token
      `);

    if (settingsError) throw settingsError;

    const results = [];

    for (const settings of allSettings || []) {
      try {
        const managerResult = await processManagerReminders(settings as PartnerSettings);
        const employeeResult = await processEmployeeReminders(settings as PartnerSettings);
        results.push({
          partner_id: settings.partner_id,
          status: "ok",
          manager_reminders: managerResult,
          employee_reminders: employeeResult,
        });
      } catch (partnerError) {
        console.error(`Error processing partner ${settings.partner_id}:`, partnerError);
        results.push({
          partner_id: settings.partner_id,
          status: "error",
          error: String(partnerError),
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in schedule-reminders:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});