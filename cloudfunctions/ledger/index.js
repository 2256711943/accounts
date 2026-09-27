// 云函数：ledger —— 一拍记统一数据通道入口
//
// 本文件是「入口胶水层」：只负责双入口归一化 + 身份归一化 + 路由分发，
// 业务逻辑全部在逻辑层 logic.js（可注入 db、可单测）。
//
// 双入口归一化规则 —— 2026-09-26 实测确定，不要凭文档推断：
//   小程序：wx.cloud.callFunction({ name:'ledger', data:{ action, payload } })
//           → event = { action, payload }，OPENID 可用
//   H5：    POST https://<HTTP域名>/ledger/<action>，body 为 payload JSON
//           → event = { httpMethod, path:'/<action>', body:'<payload json>', ... }
//           ⚠️ 网关 enablePathTransmission=false 会剥掉 /ledger 前缀，故 action 取自 path
//           ⚠️ HTTP 入口是匿名身份（x-usertype: NONE / x-userid 空），OPENID 为 undefined
//              → H5 的用户标识为固定 demo 身份（见 logic.js 的 H5_DEMO_OWNER_ID）
//   出参：两个入口都直接返回 { ok, data }，网关会把它当 JSON body 透传（状态码固定 200）
//   CORS：网关自动处理（回显 Origin、OPTIONS 预检返回 204），函数侧不参与

/* eslint-disable @typescript-eslint/no-var-requires -- 云函数 CJS 环境，无打包步骤 */
const cloud = require('wx-server-sdk');
const logic = require('./logic');
const { createLedgerHandlers, ok, fail } = logic;

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const { ERR } = createLedgerHandlers({ db });

/**
 * 把两个入口的 event 归一化成 { source, action, payload }。
 * 判据用 httpMethod：它只由网关触发时存在，callFunction 的 event 里没有。
 */
function normalize(event) {
  if (event && typeof event.httpMethod === 'string') {
    const body = typeof event.body === 'string' ? event.body : '';
    let payload = {};
    if (body) {
      try {
        payload = JSON.parse(body);
      } catch (err) {
        throw new Error('BODY_NOT_JSON');
      }
    }
    return { source: 'http', action: String(event.path || '').replace(/^\/+/, ''), payload };
  }
  return { source: 'mp', action: event && event.action, payload: (event && event.payload) || {} };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();

  let req;
  try {
    req = normalize(event);
  } catch (err) {
    return fail(ERR.INVALID_PARAM, { message: 'payload 不是合法 JSON' });
  }

  // ping 是链路自检 action，不经过业务校验
  if (req.action === 'ping') {
    const ownerId = req.source === 'mp' ? OPENID : logic.H5_DEMO_OWNER_ID;
    return ok({ source: req.source, ownerId, payload: req.payload });
  }

  const ownerId = req.source === 'mp' ? OPENID : logic.H5_DEMO_OWNER_ID;
  if (!ownerId) {
    return fail(ERR.INVALID_PARAM, { message: '无法解析归属身份' });
  }

  const handlers = createLedgerHandlers({ db });

  const v = handlers.validate(req.action, req.payload);
  if (v) return fail(v.code, { message: v.message });

  try {
    switch (req.action) {
      case 'record.upsert':
        return await handlers.handleUpsert(req.payload, ownerId);
      case 'record.list':
        return await handlers.handleList(req.payload, ownerId);
      case 'record.remove':
        return await handlers.handleRemove(req.payload, ownerId);
      default:
        return fail(ERR.UNKNOWN_ACTION, { action: req.action });
    }
  } catch (err) {
    return fail(ERR.DB_ERROR, { message: err.message || '数据库操作失败' });
  }
};