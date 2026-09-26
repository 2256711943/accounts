// 云函数：ledger —— 一拍记统一数据通道入口
//
// 现状：action 路由骨架 + 双入口归一化已打通（D4 之前的地基）。
//
// 双入口归一化规则 —— 2026-09-26 实测确定，不要凭文档推断：
//   小程序：wx.cloud.callFunction({ name:'ledger', data:{ action, payload } })
//           → event = { action, payload }，OPENID 可用
//   H5：    POST https://<HTTP域名>/ledger/<action>，body 为 payload JSON
//           → event = { httpMethod, path:'/<action>', body:'<payload json>', ... }
//           ⚠️ 网关 enablePathTransmission=false 会剥掉 /ledger 前缀，故 action 取自 path
//           ⚠️ HTTP 入口是匿名身份（x-usertype: NONE / x-userid 空），OPENID 为 undefined
//              → H5 的用户标识方案待定，见 ARCHITECTURE.md §6 的 user.login
//   出参：两个入口都直接返回 { ok, data }，网关会把它当 JSON body 透传（状态码固定 200），
//         因此无需包装 { statusCode, headers, body }
//   CORS：网关自动处理（回显 Origin、OPTIONS 预检返回 204），函数侧不需要参与
//
// D4 待补齐：
//   - validate()：入参 JSON Schema 校验
//   - §6 的 9 个 action 业务实现（record.* / stats.monthly / recognize.image / perf.report / ...）
//   - 所有查询强制注入 _openid（架构红线 5）
//
// eslint-disable-next-line @typescript-eslint/no-var-requires -- 云函数运行在 Node CJS 环境，无打包/转译步骤
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const ok = (data) => ({ ok: true, data });
const fail = (code, extra) => ({ ok: false, error: { code, ...extra } });

// H5 端是「单用户 demo」身份：HTTP 入口拿不到微信身份，全部 H5 请求归到这一个固定归属下，
// 不做用户隔离。见 ARCHITECTURE.md §1.2 决策 4。
// ⚠️ 这是演示取舍，不是安全设计：任何人打开 H5 都会看到同一份数据。
const H5_DEMO_OWNER_ID = 'h5-demo-single-user';

/**
 * 把两个入口的 event 归一化成 { source, action, payload }。
 * 判据用 httpMethod：它只由网关触发时存在，callFunction 的 event 里没有。
 */
function normalize(event) {
  if (event && typeof event.httpMethod === 'string') {
    const body = typeof event.body === 'string' ? event.body : '';
    return {
      source: 'http',
      action: String(event.path || '').replace(/^\/+/, ''),
      payload: body ? JSON.parse(body) : {},
    };
  }
  return {
    source: 'mp',
    action: event && event.action,
    payload: (event && event.payload) || {},
  };
}

/**
 * 解析归属身份。后续所有读写都必须以 ownerId 作为归属条件（架构红线 5）：
 * 写入时显式落 `_openid: ownerId`，查询时强制过滤 `_openid: ownerId`。
 *
 * 注意：云函数以 admin 身份运行，不会自动注入 `_openid`，必须显式写入。
 */
function resolveOwnerId(source, openid) {
  return source === 'mp' ? openid : H5_DEMO_OWNER_ID;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();

  let req;
  try {
    req = normalize(event);
  } catch (err) {
    return fail('INVALID_PARAM', { message: 'payload 不是合法 JSON' });
  }

  switch (req.action) {
    case 'ping':
      return ok({ source: req.source, ownerId: resolveOwnerId(req.source, OPENID), payload: req.payload });
    default:
      return fail('UNKNOWN_ACTION', { action: req.action });
  }
};
