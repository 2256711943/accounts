/**
 * 订阅消息能力适配层（D14 F7）。
 *
 * ⚠️ 本文件是 `#ifdef` 的合法发生地（AGENTS.md 架构红线 2）。
 * 单文件 + 函数体内 `#ifdef`；适配层方法永不抛未捕获异常（红线 6）。
 */

/** 申请结果。`status` 语义：
 *  - 'accept'     用户点了允许 → 获得一次下发额度（服务端 subscribe.register 累加）
 *  - 'other'      拒绝 / 被过滤 / 调用失败 → 不产生额度
 *  - 'unsupported'当前端无订阅消息能力（H5）→ 调用方直接跳过，不阻塞主流程
 */
export interface SubscribeRequestResult {
  status: 'accept' | 'other' | 'unsupported';
}

/**
 * 请求订阅授权（微信一次性订阅消息）。
 *
 * - MP：`uni.requestSubscribeMessage({ tmplIds: [templateId] })`，用户同意 → accept
 * - H5：无该能力 → `unsupported`
 *
 * 契约：永不抛未捕获异常（红线 6）。能力缺失一律以 `unsupported` 返回，
 * 由 `services/remind.ts` 决定「跳过申请、不阻塞记账」的降级路径。
 */
export async function requestSubscribe(templateId: string): Promise<SubscribeRequestResult> {
  // 默认 = 当前端无订阅消息能力（H5）
  let result: SubscribeRequestResult = { status: 'unsupported' };

  // #ifdef MP-WEIXIN
  result = await requestSubscribeMp(templateId);
  // #endif

  return result;
}

// #ifdef MP-WEIXIN
/** 小程序端实现。仅保留在 MP-WEIXIN 的编译产物中。 */
async function requestSubscribeMp(templateId: string): Promise<SubscribeRequestResult> {
  try {
    if (typeof uni.requestSubscribeMessage !== 'function') {
      return { status: 'unsupported' };
    }
    const res = (await uni.requestSubscribeMessage({ tmplIds: [templateId] })) as unknown as Record<string, string>;
    const state = res[templateId];
    return { status: state === 'accept' ? 'accept' : 'other' };
  } catch {
    // 调用失败（如模板 ID 非法/未配置、用户取消）：按「无额度」处理，不抛
    return { status: 'other' };
  }
}
// #endif
