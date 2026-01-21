import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface PartnerSettings {
  partner_id: string;
  employee_bot_token: string;
  timezone: string;
  shift_reminders_enabled: boolean;
  shift_reminder_offset_minutes: number;
  shift_reminder_comment: string | null;
  shift_close_reminder_enabled: boolean;
  shift_auto_close_enabled: boolean;
  shift_auto_close_offset_minutes: number;
  no_show_threshold_minutes: number;
  shift_grace_minutes: number;
  employee_cabinet_url: string | null;
  app_url: string | null;
  no_show_responsible_enabled: boolean;
  no_show_responsible_position_id: string | null;
  no_show_responsible_employee_ids: string[];
  replacement_search_enabled: boolean;
  replacement_notify_scope: string;
  replacement_branch_scope: string;
  replacement_branch_groups: { id: string; name: string; branch_ids: string[] }[];
}

interface ShiftToRemind {
  id: string;
  partner_id: string;
  branch_id: string;
  staff_member_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  attendance_status: string | null;
  actual_start_at: string | null;
  late_minutes: number;
  no_show_at: string | null;
  no_show_notified_at: string | null;
  no_show_reason_text: string | null;
  no_show_reason_status: string | null;
  reminder_before_sent_at: string | null;
  reminder_late_sent_at: string | null;
  reminder_message_ids: number[];
  reminder_chat_id: string | null;
  close_reminder_sent_at: string | null;
  close_reminder_message_id: number | null;
  close_reminder_chat_id: string | null;
  auto_closed: boolean;
  replacement_status: string | null;
  replacement_offered_at: string | null;
  branch: { name: string } | null;
  employee: {
    id: string;
    first_name: string;
    last_name: string | null;
    telegram_user_id: string | null;
    cabinet_slug: string | null;
    photo_url: string | null;
    position_id: string | null;
  } | null;
}

function getPartnerNow(timezone: string): Date {
  const nowUTC = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(nowUTC);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  const hour = parts.find((p) => p.type === "hour")!.value;
  const minute = parts.find((p) => p.type === "minute")!.value;
  const second = parts.find((p) => p.type === "second")!.value;

  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
}

function formatTime(time: string): string {
  return time.slice(0, 5);
}

async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  replyMarkup?: unknown
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          reply_markup: replyMarkup,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok || !result.ok) {
      console.error("Telegram API error:", result);
      return {
        success: false,
        error: result.description || "Unknown error",
      };
    }

    return {
      success: true,
      messageId: result.result.message_id,
    };
  } catch (error) {
    console.error("Error sending Telegram message:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function notifyResponsibleEmployees(
  partner: PartnerSettings,
  shift: ShiftToRemind,
  branchName: string,
  cabinetBaseUrl: string
): Promise<{ messageIds: number[] }> {
  const messageIds: number[] = [];

  if (!partner.no_show_responsible_enabled) {
    console.log(`[NO-SHOW] Partner ${partner.partner_id}: no_show_responsible_enabled is false, skipping`);
    return { messageIds };
  }

  const responsibleEmployeeIds = partner.no_show_responsible_employee_ids || [];

  if (responsibleEmployeeIds.length === 0) {
    console.log(`[NO-SHOW] Partner ${partner.partner_id}: no responsible employees configured`);
    return { messageIds };
  }

  console.log(`[NO-SHOW] Partner ${partner.partner_id}: notifying ${responsibleEmployeeIds.length} responsible employees`);

  const { data: responsibleEmployees, error: empError } = await supabase
    .from("employees")
    .select("id, first_name, last_name, telegram_user_id, cabinet_slug")
    .in("id", responsibleEmployeeIds)
    .eq("is_active", true);

  if (empError) {
    console.error("[NO-SHOW] Error fetching responsible employees:", empError);
    return { messageIds };
  }

  if (!responsibleEmployees || responsibleEmployees.length === 0) {
    console.log("[NO-SHOW] No active responsible employees found");
    return { messageIds };
  }

  const employeeName = shift.employee
    ? `${shift.employee.first_name}${shift.employee.last_name ? " " + shift.employee.last_name : ""}`
    : "\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a";

  for (const responsible of responsibleEmployees) {
    let message = `<b>\u041d\u0435\u0432\u044b\u0445\u043e\u0434 \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430 \u043d\u0430 \u0441\u043c\u0435\u043d\u0443</b>\n\n` +
      `\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a: ${employeeName}\n` +
      `\u0424\u0438\u043b\u0438\u0430\u043b: ${branchName}\n` +
      `\u0412\u0440\u0435\u043c\u044f \u043d\u0430\u0447\u0430\u043b\u0430: ${formatTime(shift.start_time)}\n` +
      `\u0414\u0430\u0442\u0430: ${shift.date}`;

    const cabinetUrl = responsible.cabinet_slug
      ? `${cabinetBaseUrl}/${responsible.cabinet_slug}`
      : null;

    const eventMessage = `${employeeName} \u043d\u0435 \u0432\u044b\u0448\u0435\u043b \u043d\u0430 \u0441\u043c\u0435\u043d\u0443 \u0432 ${branchName}. \u041f\u043b\u0430\u043d\u043e\u0432\u043e\u0435 \u043d\u0430\u0447\u0430\u043b\u043e: ${formatTime(shift.start_time)}`;

    const { data: eventData, error: eventError } = await supabase
      .from("employee_events")
      .insert({
        partner_id: partner.partner_id,
        employee_id: responsible.id,
        event_type: "no_show_alert",
        title: "\u041d\u0435\u0432\u044b\u0445\u043e\u0434 \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430 \u043d\u0430 \u0441\u043c\u0435\u043d\u0443",
        message: eventMessage,
        related_shift_id: shift.id,
        related_employee_id: shift.employee?.id || null,
        related_employee_photo_url: shift.employee?.photo_url || null,
        related_employee_name: employeeName,
        related_branch_name: branchName,
        related_shift_time: `${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}`,
        action_type: shift.no_show_reason_text ? "approve_reject_reason" : null,
        telegram_chat_id: responsible.telegram_user_id,
      })
      .select("id")
      .single();

    const eventId = eventData?.id || "";

    const replyMarkup = cabinetUrl ? {
      inline_keyboard: [
        [
          { text: "\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043a\u0430\u0431\u0438\u043d\u0435\u0442", web_app: { url: cabinetUrl } }
        ]
      ]
    } : undefined;

    if (responsible.telegram_user_id) {
      const result = await sendTelegramMessage(
        partner.employee_bot_token,
        responsible.telegram_user_id,
        message,
        replyMarkup
      );

      if (result.success && result.messageId) {
        messageIds.push(result.messageId);

        await supabase
          .from("employee_events")
          .update({ telegram_message_id: result.messageId })
          .eq("id", eventId);

        console.log(`[NO-SHOW] Telegram notification sent to ${responsible.first_name} (${responsible.telegram_user_id})`);
      } else {
        console.error(`[NO-SHOW] Failed to send Telegram to ${responsible.first_name}: ${result.error}`);
      }
    }

    if (eventError) {
      console.error(`[NO-SHOW] Error creating employee_event for ${responsible.first_name}:`, eventError);
    } else {
      console.log(`[NO-SHOW] Cabinet event created for ${responsible.first_name}`);
    }
  }

  return { messageIds };
}

interface ReplacementCandidateInfo {
  id: string;
  first_name: string;
  last_name: string | null;
}

async function sendReplacementNotifications(
  partner: PartnerSettings,
  shift: ShiftToRemind,
  branchName: string,
  cabinetBaseUrl: string
): Promise<{ candidates: ReplacementCandidateInfo[] }> {
  if (!partner.replacement_search_enabled) {
    console.log(`[REPLACEMENT] Partner ${partner.partner_id}: replacement_search_enabled is false, skipping`);
    return { candidates: [] };
  }

  console.log(`[REPLACEMENT] Partner ${partner.partner_id}: searching for replacements`);
  console.log(`[REPLACEMENT] Notify scope: ${partner.replacement_notify_scope}, Branch scope: ${partner.replacement_branch_scope}`);

  let positionName = "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u0430";
  if (shift.employee?.position_id) {
    const { data: position } = await supabase
      .from("positions")
      .select("name")
      .eq("id", shift.employee.position_id)
      .maybeSingle();
    if (position) {
      positionName = position.name;
    }
  }

  let candidateQuery = supabase
    .from("employees")
    .select(`
      id, first_name, last_name, telegram_user_id, cabinet_slug, position_id
    `)
    .eq("partner_id", partner.partner_id)
    .eq("is_active", true)
    .in("current_status", ["working", "on_vacation"])
    .neq("id", shift.employee?.id || "");

  if (partner.replacement_notify_scope === "same_position" && shift.employee?.position_id) {
    candidateQuery = candidateQuery.eq("position_id", shift.employee.position_id);
    console.log(`[REPLACEMENT] Filtering by position: ${shift.employee.position_id}`);
  }

  const { data: candidates, error: candError } = await candidateQuery;

  if (candError) {
    console.error("[REPLACEMENT] Error fetching candidates:", candError);
    return { candidates: [] };
  }

  if (!candidates || candidates.length === 0) {
    console.log("[REPLACEMENT] No candidates found");
    return { candidates: [] };
  }

  console.log(`[REPLACEMENT] Found ${candidates.length} potential candidates`);

  let filteredCandidates = candidates;

  if (partner.replacement_branch_scope === "same_branch" || partner.replacement_branch_scope === "branch_groups") {
    const { data: scheduleRows } = await supabase
      .from("schedule_rows")
      .select("employee_id, branch_id")
      .eq("partner_id", partner.partner_id);

    const employeeBranches = new Map<string, string[]>();
    if (scheduleRows) {
      for (const row of scheduleRows) {
        const branches = employeeBranches.get(row.employee_id) || [];
        if (!branches.includes(row.branch_id)) {
          branches.push(row.branch_id);
        }
        employeeBranches.set(row.employee_id, branches);
      }
    }

    if (partner.replacement_branch_scope === "same_branch") {
      filteredCandidates = candidates.filter((c) => {
        const branches = employeeBranches.get(c.id) || [];
        return branches.includes(shift.branch_id);
      });
      console.log(`[REPLACEMENT] After same_branch filter: ${filteredCandidates.length} candidates`);
    } else if (partner.replacement_branch_scope === "branch_groups") {
      const groups = partner.replacement_branch_groups || [];
      const shiftGroup = groups.find((g) => g.branch_ids.includes(shift.branch_id));

      if (shiftGroup) {
        filteredCandidates = candidates.filter((c) => {
          const branches = employeeBranches.get(c.id) || [];
          return branches.some((b) => shiftGroup.branch_ids.includes(b));
        });
        console.log(`[REPLACEMENT] After branch_groups filter (group: ${shiftGroup.name}): ${filteredCandidates.length} candidates`);
      } else {
        filteredCandidates = candidates.filter((c) => {
          const branches = employeeBranches.get(c.id) || [];
          return branches.includes(shift.branch_id);
        });
        console.log(`[REPLACEMENT] Branch not in any group, using same_branch: ${filteredCandidates.length} candidates`);
      }
    }
  }

  if (filteredCandidates.length === 0) {
    console.log("[REPLACEMENT] No candidates after filtering");
    return { candidates: [] };
  }

  const employeeName = shift.employee
    ? `${shift.employee.first_name}${shift.employee.last_name ? " " + shift.employee.last_name : ""}`
    : "\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a";

  for (const candidate of filteredCandidates) {
    const message = `<b>\u0421\u0440\u043e\u0447\u043d\u0430\u044f \u0441\u043c\u0435\u043d\u0430!</b>\n\n` +
      `${employeeName} \u043d\u0435 \u0432\u044b\u0448\u0435\u043b \u043d\u0430 \u0441\u043c\u0435\u043d\u0443.\n\n` +
      `\u0424\u0438\u043b\u0438\u0430\u043b: ${branchName}\n` +
      `\u0414\u043e\u043b\u0436\u043d\u043e\u0441\u0442\u044c: ${positionName}\n` +
      `\u0414\u0430\u0442\u0430: ${shift.date}\n` +
      `\u0412\u0440\u0435\u043c\u044f: ${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}\n\n` +
      `\u0412\u044b \u043c\u043e\u0436\u0435\u0442\u0435 \u043f\u0440\u0438\u043d\u044f\u0442\u044c \u044d\u0442\u0443 \u0441\u043c\u0435\u043d\u0443 \u0432 \u0441\u0432\u043e\u0451\u043c \u043a\u0430\u0431\u0438\u043d\u0435\u0442\u0435.`;

    let telegramMessageId: number | null = null;

    if (candidate.telegram_user_id) {
      const cabinetUrl = candidate.cabinet_slug
        ? `${cabinetBaseUrl}/${candidate.cabinet_slug}`
        : null;

      const replyMarkup = cabinetUrl ? {
        inline_keyboard: [[
          { text: "\u041f\u0440\u0438\u043d\u044f\u0442\u044c \u0441\u043c\u0435\u043d\u0443", web_app: { url: cabinetUrl } }
        ]]
      } : undefined;

      const result = await sendTelegramMessage(
        partner.employee_bot_token,
        candidate.telegram_user_id,
        message,
        replyMarkup
      );

      if (result.success && result.messageId) {
        telegramMessageId = result.messageId;
        console.log(`[REPLACEMENT] Telegram notification sent to ${candidate.first_name} (${candidate.telegram_user_id})`);
      } else {
        console.error(`[REPLACEMENT] Failed to send Telegram to ${candidate.first_name}: ${result.error}`);
      }
    }

    const { data: eventData, error: eventError } = await supabase
      .from("employee_events")
      .insert({
        partner_id: partner.partner_id,
        employee_id: candidate.id,
        event_type: "urgent_shift",
        title: "\u0421\u0440\u043e\u0447\u043d\u0430\u044f \u0441\u043c\u0435\u043d\u0430!",
        message: `${employeeName} \u043d\u0435 \u0432\u044b\u0448\u0435\u043b \u043d\u0430 \u0441\u043c\u0435\u043d\u0443 \u0432 ${branchName}. \u041f\u0440\u0438\u043c\u0438\u0442\u0435 \u0441\u043c\u0435\u043d\u0443, \u0435\u0441\u043b\u0438 \u043c\u043e\u0436\u0435\u0442\u0435 \u0432\u044b\u0439\u0442\u0438.`,
        related_shift_id: shift.id,
        related_employee_id: shift.employee?.id || null,
        related_employee_photo_url: shift.employee?.photo_url || null,
        related_employee_name: employeeName,
        related_branch_name: branchName,
        related_shift_time: `${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}`,
        action_type: "accept_shift",
        telegram_message_id: telegramMessageId,
        telegram_chat_id: candidate.telegram_user_id,
      })
      .select("id")
      .single();

    if (eventError) {
      console.error(`[REPLACEMENT] Error creating employee_event for ${candidate.first_name}:`, eventError);
    } else {
      console.log(`[REPLACEMENT] Cabinet event created for ${candidate.first_name}`);

      await supabase
        .from("shift_replacement_messages")
        .insert({
          partner_id: partner.partner_id,
          shift_id: shift.id,
          employee_id: candidate.id,
          telegram_message_id: telegramMessageId,
          telegram_chat_id: candidate.telegram_user_id,
          event_id: eventData?.id || null,
          message_type: "urgent_shift",
          is_active: true,
        });
    }
  }

  await supabase
    .from("schedule_shifts")
    .update({
      replacement_status: "offered",
      replacement_offered_at: new Date().toISOString(),
    })
    .eq("id", shift.id);

  console.log(`[REPLACEMENT] Sent ${filteredCandidates.length} replacement notifications for shift ${shift.id}`);

  return {
    candidates: filteredCandidates.map(c => ({
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
    })),
  };
}

Deno.serve(async (req: Request) => {
  console.log("[SHIFT REMINDERS] Function invoked");

  const origin = new URL(req.url).origin;
  const cabinetBaseUrl = `${origin}/employee`;
  console.log(`[SHIFT REMINDERS] Using cabinet base URL: ${cabinetBaseUrl}`);

  let processed = 0;
  let errors = 0;

  try {
    const { data: partners, error: partnersError } = await supabase
      .from("partner_settings")
      .select("*")
      .not("employee_bot_token", "is", null);

    if (partnersError) {
      console.error("Error fetching partners:", partnersError);
      return new Response(
        JSON.stringify({
          success: false,
          error: partnersError.message,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!partners || partners.length === 0) {
      console.log("No partners with employee_bot_token configured");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No partners with employee_bot_token configured",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Found ${partners.length} partners with bot configured`);

    for (const partner of partners as PartnerSettings[]) {
      try {
        const partnerNow = getPartnerNow(partner.timezone);
        const today = partnerNow.toISOString().split("T")[0];

        const tomorrow = new Date(partnerNow);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split("T")[0];

        console.log(`Processing partner ${partner.partner_id}, current time: ${partnerNow.toISOString()}`);

        const { data: shifts, error: shiftsError } = await supabase
          .from("schedule_shifts")
          .select(`
            id, partner_id, branch_id, staff_member_id, date, start_time, end_time, status,
            attendance_status, actual_start_at, late_minutes, no_show_at, no_show_notified_at,
            no_show_reason_text, no_show_reason_status,
            reminder_before_sent_at, reminder_late_sent_at, reminder_message_ids, reminder_chat_id,
            close_reminder_sent_at, close_reminder_message_id, close_reminder_chat_id, auto_closed,
            replacement_status, replacement_offered_at,
            branch:branches(name),
            employee:employees!schedule_shifts_employee_id_fkey(id, first_name, last_name, telegram_user_id, cabinet_slug, photo_url, position_id)
          `)
          .eq("partner_id", partner.partner_id)
          .in("date", [today, tomorrowStr])
          .in("status", ["scheduled", "opened"]);

        if (shiftsError) {
          console.error(`Error fetching shifts for partner ${partner.partner_id}:`, shiftsError);
          errors++;
          continue;
        }

        if (!shifts || shifts.length === 0) {
          console.log(`No scheduled/opened shifts for partner ${partner.partner_id} today/tomorrow`);
          continue;
        }

        console.log(`Found ${shifts.length} shifts for partner ${partner.partner_id}`);

        for (const shift of shifts as unknown as ShiftToRemind[]) {
          if (!shift.employee?.telegram_user_id) {
            console.log(`Shift ${shift.id}: employee has no telegram_user_id, skipping personal reminders`);
          }

          const shiftStartTime = new Date(`${shift.date}T${shift.start_time}`);
          const shiftEndTime = new Date(`${shift.date}T${shift.end_time}`);

          const branchName = (shift.branch as { name: string } | null)?.name || "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d";

          let cabinetUrl: string | null = null;
          if (shift.employee?.cabinet_slug) {
            cabinetUrl = `${cabinetBaseUrl}/${shift.employee.cabinet_slug}`;
          }

          const noShowThreshold = partner.no_show_threshold_minutes || 30;
          const graceMinutes = partner.shift_grace_minutes || 0;

          const noShowDeadlineTime = new Date(shiftStartTime.getTime() + (graceMinutes + noShowThreshold) * 60000);

          if (shift.status === "scheduled" && !shift.actual_start_at && shift.date === today) {
            if (!shift.staff_member_id || !shift.employee) {
              console.log(`Shift ${shift.id}: no employee assigned (staff_member_id is null), skipping no-show/late check`);
            } else if (partnerNow >= noShowDeadlineTime && !shift.no_show_at) {
              console.log(`Shift ${shift.id}: marking as no_show (deadline passed)`);

              const lateMinutes = Math.floor((partnerNow.getTime() - shiftStartTime.getTime() - graceMinutes * 60000) / 60000);

              const updateData: Record<string, unknown> = {
                attendance_status: "no_show",
                no_show_at: new Date().toISOString(),
                late_minutes: Math.max(0, lateMinutes),
              };

              const { error: updateError } = await supabase
                .from("schedule_shifts")
                .update(updateData)
                .eq("id", shift.id);

              if (updateError) {
                console.error(`Shift ${shift.id}: error updating to no_show:`, updateError);
                errors++;
              } else {
                processed++;
                console.log(`Shift ${shift.id}: marked as no_show successfully`);

                if (!shift.no_show_notified_at) {
                  console.log(`[NO-SHOW] Shift ${shift.id}: sending notifications to responsible employees`);

                  const { messageIds } = await notifyResponsibleEmployees(partner, shift, branchName, cabinetBaseUrl);

                  await supabase
                    .from("schedule_shifts")
                    .update({
                      no_show_notified_at: new Date().toISOString(),
                      no_show_telegram_message_ids: messageIds,
                    })
                    .eq("id", shift.id);

                  console.log(`Shift ${shift.id}: notified responsible employees, messageIds: ${messageIds.length}`);

                  if (partner.replacement_search_enabled && (!shift.replacement_status || shift.replacement_status === "none")) {
                    console.log(`[REPLACEMENT] Shift ${shift.id}: initiating replacement search`);
                    const { candidates } = await sendReplacementNotifications(partner, shift, branchName, cabinetBaseUrl);

                    if (candidates.length > 0) {
                      const candidateNames = candidates
                        .slice(0, 5)
                        .map(c => `${c.first_name}${c.last_name ? ' ' + c.last_name : ''}`)
                        .join(', ');
                      const candidatesText = candidates.length > 5
                        ? `${candidateNames} и еще ${candidates.length - 5}`
                        : candidateNames;

                      await supabase
                        .from("employee_events")
                        .update({
                          message: `${shift.employee?.first_name || 'Сотрудник'} не вышел на смену в ${branchName}. Плановое начало: ${formatTime(shift.start_time)}. Предложено для подмены: ${candidatesText}`,
                        })
                        .eq("related_shift_id", shift.id)
                        .eq("event_type", "no_show_alert");

                      console.log(`[NO-SHOW] Updated no_show_alert events with ${candidates.length} candidates info`);
                    }
                  }
                }
              }
            } else {
              const graceDeadlineTime = new Date(shiftStartTime.getTime() + graceMinutes * 60000);

              if (partnerNow >= graceDeadlineTime && partnerNow < noShowDeadlineTime) {
                if (shift.attendance_status !== "late") {
                  console.log(`Shift ${shift.id}: marking as late`);

                  const lateMinutes = Math.floor((partnerNow.getTime() - shiftStartTime.getTime() - graceMinutes * 60000) / 60000);

                  await supabase
                    .from("schedule_shifts")
                    .update({
                      attendance_status: "late",
                      late_minutes: Math.max(0, lateMinutes),
                    })
                    .eq("id", shift.id);

                  console.log(`Shift ${shift.id}: marked as late`);
                }
              }
            }
          }

          if (!shift.employee?.telegram_user_id) {
            continue;
          }

          if (partner.shift_reminders_enabled && shift.status === "scheduled") {
            const reminderTime = new Date(shiftStartTime.getTime() - partner.shift_reminder_offset_minutes * 60000);

            if (!shift.reminder_before_sent_at && partnerNow >= reminderTime && partnerNow < shiftStartTime) {
              console.log(`[SHIFT REMINDER] Shift ${shift.id}: sending before-shift reminder to ${shift.employee.first_name}, telegram_id: ${shift.employee.telegram_user_id}`);
              console.log(`[SHIFT REMINDER] Current time: ${partnerNow.toISOString()}, Reminder time: ${reminderTime.toISOString()}, Shift start: ${shiftStartTime.toISOString()}`);

              let message = `<b>\u041d\u0430\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u0435: \u0443 \u0432\u0430\u0441 \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u0430 \u0441\u043c\u0435\u043d\u0430</b>\n\n`;
              message += `\u0424\u0438\u043b\u0438\u0430\u043b: ${branchName}\n`;
              message += `\u0412\u0440\u0435\u043c\u044f \u043d\u0430\u0447\u0430\u043b\u0430: ${formatTime(shift.start_time)}\n\n`;
              message += `\u041d\u0435 \u0437\u0430\u0431\u0443\u0434\u044c\u0442\u0435 \u0432\u043e\u0432\u0440\u0435\u043c\u044f \u043e\u0442\u043a\u0440\u044b\u0442\u044c \u0441\u043c\u0435\u043d\u0443 \u0432 \u043a\u0430\u0431\u0438\u043d\u0435\u0442\u0435`;

              if (partner.shift_reminder_comment) {
                message += `\n\n${partner.shift_reminder_comment}`;
              }

              const result = await sendTelegramMessage(
                partner.employee_bot_token!,
                shift.employee.telegram_user_id,
                message
              );

              if (result.success && result.messageId) {
                const messageIds = shift.reminder_message_ids || [];
                messageIds.push(result.messageId);

                await supabase
                  .from("schedule_shifts")
                  .update({
                    reminder_before_sent_at: new Date().toISOString(),
                    reminder_message_ids: messageIds,
                    reminder_chat_id: shift.employee.telegram_user_id,
                  })
                  .eq("id", shift.id);

                processed++;
                console.log(`[SHIFT REMINDER] Before-shift reminder sent successfully, message_id: ${result.messageId}`);
              } else {
                errors++;
                console.error(`[SHIFT REMINDER] Failed to send before-shift reminder: ${result.error || 'Unknown error'}`);
                if (result.error && result.error.includes('bot was blocked')) {
                  console.error(`[SHIFT REMINDER] Employee has BLOCKED the bot`);
                } else if (result.error && result.error.includes('chat not found')) {
                  console.error(`[SHIFT REMINDER] Employee has NOT STARTED the bot (no /start command)`);
                }
              }
            }

            if (!shift.reminder_late_sent_at && partnerNow >= shiftStartTime && shift.attendance_status !== "no_show" && shift.date === today) {
              console.log(`[SHIFT REMINDER] Shift ${shift.id}: sending late reminder to ${shift.employee.first_name}, telegram_id: ${shift.employee.telegram_user_id}`);

              let message = `<b>\u0421\u043c\u0435\u043d\u0430 \u043d\u0435 \u043e\u0442\u043a\u0440\u044b\u0442\u0430</b>\n\n`;
              message += `\u0424\u0438\u043b\u0438\u0430\u043b: ${branchName}\n`;
              message += `\u0412\u0440\u0435\u043c\u044f \u043d\u0430\u0447\u0430\u043b\u0430: ${formatTime(shift.start_time)}\n\n`;
              message += `\u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u043e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u0441\u043c\u0435\u043d\u0443 \u0432 \u043a\u0430\u0431\u0438\u043d\u0435\u0442\u0435 \u043a\u0430\u043a \u043c\u043e\u0436\u043d\u043e \u0441\u043a\u043e\u0440\u0435\u0435`;

              const result = await sendTelegramMessage(
                partner.employee_bot_token!,
                shift.employee.telegram_user_id,
                message
              );

              if (result.success && result.messageId) {
                const messageIds = shift.reminder_message_ids || [];
                messageIds.push(result.messageId);

                await supabase
                  .from("schedule_shifts")
                  .update({
                    reminder_late_sent_at: new Date().toISOString(),
                    reminder_message_ids: messageIds,
                    reminder_chat_id: shift.employee.telegram_user_id,
                  })
                  .eq("id", shift.id);

                processed++;
                console.log(`[SHIFT REMINDER] Late reminder sent successfully, message_id: ${result.messageId}`);
              } else {
                errors++;
                console.error(`[SHIFT REMINDER] Failed to send late reminder: ${result.error || 'Unknown error'}`);
              }
            }
          }

          if (partner.shift_close_reminder_enabled && shift.status === "opened" && shift.date === today) {
            const autoCloseTime = new Date(shiftEndTime.getTime() + partner.shift_auto_close_offset_minutes * 60000);
            console.log(`Shift ${shift.id}: close reminder check - sent_at: ${shift.close_reminder_sent_at}, current: ${partnerNow.toISOString()}, end: ${shiftEndTime.toISOString()}, should send: ${!shift.close_reminder_sent_at && partnerNow >= shiftEndTime}`);

            if (!shift.close_reminder_sent_at && partnerNow >= shiftEndTime) {
              console.log(`[CLOSE REMINDER] Shift ${shift.id}: sending close reminder to ${shift.employee.first_name}, telegram_id: ${shift.employee.telegram_user_id}, cabinetUrl: ${cabinetUrl}`);

              let message = `<b>\u0421\u043c\u0435\u043d\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0430 \u043f\u043e \u0433\u0440\u0430\u0444\u0438\u043a\u0443</b>\n\n`;
              message += `\u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u043d\u0435 \u0437\u0430\u0431\u0443\u0434\u044c\u0442\u0435 \u0437\u0430\u043a\u0440\u044b\u0442\u044c \u0441\u043c\u0435\u043d\u0443.\n\n`;
              message += `\u0424\u0438\u043b\u0438\u0430\u043b: ${branchName}\n`;
              message += `\u041f\u043b\u0430\u043d\u043e\u0432\u043e\u0435 \u043e\u043a\u043e\u043d\u0447\u0430\u043d\u0438\u0435: ${formatTime(shift.end_time)}`;

              const replyMarkup = cabinetUrl ? {
                inline_keyboard: [[
                  { text: "\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043a\u0430\u0431\u0438\u043d\u0435\u0442", web_app: { url: cabinetUrl } }
                ]]
              } : undefined;

              console.log(`[CLOSE REMINDER] Shift ${shift.id}: sending message with markup: ${JSON.stringify(replyMarkup)}`);

              const result = await sendTelegramMessage(
                partner.employee_bot_token!,
                shift.employee.telegram_user_id,
                message,
                replyMarkup
              );

              if (result.success && result.messageId) {
                await supabase
                  .from("schedule_shifts")
                  .update({
                    close_reminder_sent_at: new Date().toISOString(),
                    close_reminder_message_id: result.messageId,
                    close_reminder_chat_id: shift.employee.telegram_user_id,
                  })
                  .eq("id", shift.id);

                processed++;
                console.log(`[CLOSE REMINDER] Close reminder sent successfully, message_id: ${result.messageId}`);
              } else {
                errors++;
                console.error(`[CLOSE REMINDER] Failed to send close reminder: ${result.error || 'Unknown error'}`);
                if (result.error && result.error.includes('bot was blocked')) {
                  console.error(`[CLOSE REMINDER] Employee has BLOCKED the bot`);
                } else if (result.error && result.error.includes('chat not found')) {
                  console.error(`[CLOSE REMINDER] Employee has NOT STARTED the bot (no /start command)`);
                }
              }
            }

            if (!shift.auto_closed && partnerNow >= autoCloseTime) {
              console.log(`Shift ${shift.id}: auto-closing shift`);

              const { data: openSegments } = await supabase
                .from("work_segments")
                .select("id, segment_start_at, segment_end_at")
                .eq("shift_id", shift.id)
                .is("segment_end_at", null);

              const closeTime = new Date().toISOString();

              if (openSegments && openSegments.length > 0) {
                const segmentToClose = openSegments[0];
                await supabase
                  .from("work_segments")
                  .update({ segment_end_at: closeTime })
                  .eq("id", segmentToClose.id);

                console.log(`Shift ${shift.id}: closed open segment ${segmentToClose.id}`);
              }

              await supabase
                .from("schedule_shifts")
                .update({
                  status: "closed",
                  attendance_status: "closed",
                  actual_end_at: closeTime,
                  auto_closed: true,
                })
                .eq("id", shift.id);

              processed++;
              console.log(`Shift ${shift.id}: auto-closed successfully`);
            }
          }
        }
      } catch (partnerError) {
        console.error(`Error processing partner ${partner.partner_id}:`, partnerError);
        errors++;
      }
    }

    console.log(`[SHIFT REMINDERS] Completed. Processed: ${processed}, Errors: ${errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        errors,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[SHIFT REMINDERS] Fatal error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});