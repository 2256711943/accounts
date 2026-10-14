// 云函数：remind —— 定时触发 + 订阅消息提醒（D14 F7）
//
// 本文件是「入口胶水层」：初始化 wx-server-sdk、把「发送订阅消息」注入 logic 层，
// 业务逻辑全部在 logic.js（可单测）。
//
// 触发来源（与 ledger 不同，本函数没有客户端数据通道调用）：
//   定时触发器：event = { Type: 'Timer', TriggerName, Time }（云端配置，见 spec_finish §20 dry-run）
//   手动触发：  控制台「云端测试」或 HTTP 网关路由（event = { action: 'timerRun' }）
//
// 发送订阅消息依赖云函数端 openapi（cloud.openapi.subscribeMessage.send），
// 该 API 要求：已申请订阅模板（TEMPLATE_ID）+ 用户在客户端授权过该模板（订阅额度）。

/* eslint-disable @typescript-eslint/no-var-requires -- 云函数 CJS 环境，无打包步骤 */
const cloud = require('wx-server-sdk');
const logic = require('./logic');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const { createRemindHandlers } = logic;

/**
 * 注入 send：真机实现 = 云函数开放 API 订阅消息发送。
 * 返回 { errCode, errMsg? }；errCode 0 成功。永不抛（外层兜底 fail）。
 */
async function sendSubscribeMessage(params) {
  return cloud.openapi.subscribeMessage.send(params);
}

exports.main = async (event) => {
  // 定时触发器事件归一化：Timer 或显式 timerRun 指令都执行主流程
  const isTimer = event && (event.Type === 'Timer' || event.action === 'timerRun');
  if (!isTimer) {
    return logic.fail(logic.ERR.INVALID_PARAM, { message: 'remind 仅接受定时触发或 timerRun 指令' });
  }

  const handlers = createRemindHandlers({ db, send: sendSubscribeMessage });
  try {
    const res = await handlers.handleTimerRun();
    return logic.ok(res.data);
  } catch (err) {
    return logic.fail(logic.ERR.DB_ERROR, { message: err.message || 'remind 执行失败' });
  }
};
