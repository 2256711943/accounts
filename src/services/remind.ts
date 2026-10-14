/**
 * 订阅消息提醒服务（D14 F7 客户端侧）。
 *
 * 职责：记账成功后申请一次性订阅额度 → 云端 `subscribe.register` 累加额度，
 * 供 `remind` 云函数定时下发「24h 未记账提醒」使用。
 *
 * 模板 ID：`REMIND_TEMPLATE_ID`（已在小程序后台申请「记账提醒」一次性订阅模板）。
 * 该常量同时用于云端 `cloudfunctions/remind/logic.js` 的 `TEMPLATE_ID`。
 *
 * 分层（AGENTS 红线）：本文件不出现 `#ifdef`，平台差异收敛在 `adapters/subscribe.ts`。
 */

import { call } from '@/api/client';
import { requestSubscribe } from '@/adapters/subscribe';

/**
 * 记账提醒订阅模板 ID（后台已申请的一次性订阅模板）。
 */
export const REMIND_TEMPLATE_ID = 'IutL3tfh4xZuWPWzpBm6ZEwppu_PQvAORFVMv2xMWWE';

export interface RegisterRemindQuotaResult {
  ok: boolean;
  /** true = 未申请（模板未配置 / 端能力缺失 / 用户未允许），调用方无需提示 */
  skipped: boolean;
}

/**
 * 记账成功后调用：申请一次订阅授权，得到授权则累加云端额度。
 *
 * `templateId` 可注入（单测覆盖授权路径）；业务调用不传参，默认用 `REMIND_TEMPLATE_ID`。
 * 永不抛未捕获异常 —— 申请失败不影响「已记账」的结果（AGENTS 红线 6 / D8「上传失败不阻塞记账」同款原则）。
 * 各降级路径统一返回 `{ ok, skipped }`，不阻塞主流程。
 */
export async function registerRemindQuota(
  templateId: string = REMIND_TEMPLATE_ID
): Promise<RegisterRemindQuotaResult> {
  try {
    const sub = await requestSubscribe(templateId);
    if (sub.status !== 'accept') {
      return { ok: false, skipped: true };
    }
    await call('subscribe.register', { templateId });
    return { ok: true, skipped: false };
  } catch {
    // 通道失败（网络/云端异常）：不阻塞记账，静默跳过
    return { ok: false, skipped: true };
  }
}
