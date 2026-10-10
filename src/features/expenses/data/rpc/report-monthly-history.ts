import "server-only";

import { createSupabaseServerClient } from "@/infra/supabase/server";
import { parseRpcResponse } from "@/infra/supabase/rpc-response";
import { z } from "@/infra/validation/zod";

const AmountRowSchema = z.object({
  amount: z.union([z.number(), z.string()]).nullish(),
});

const MonthlyHistorySchema = z
  .object({
    expenseGroups: z.array(AmountRowSchema).nullish(),
    purchaseMonths: z.array(AmountRowSchema).nullish(),
  })
  .nullish();

export type MonthlyHistoryPayload = z.infer<typeof MonthlyHistorySchema>;

export interface ReportMonthlyHistoryRpcInput {
  salonId: string;
  start: string;
  end: string;
  timezone: string;
}

/** Historico mensual de gastos y compras del salón (lectura). Un resultado vacio devuelve {}. */
export async function reportMonthlyHistoryRpc(
  input: ReportMonthlyHistoryRpcInput
): Promise<NonNullable<MonthlyHistoryPayload>> {
  const supabase = await createSupabaseServerClient();
  const response = await supabase.rpc("report_monthly_history", {
    p_salon_id: input.salonId,
    p_start: input.start,
    p_end: input.end,
    p_timezone: input.timezone,
  });
  return parseRpcResponse("report_monthly_history", response, MonthlyHistorySchema) ?? {};
}
