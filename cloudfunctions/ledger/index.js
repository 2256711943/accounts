// 云函数：ledger —— 一拍记统一数据通道入口
//
// 现状（D1 提前切片）：只实现 action 路由骨架与 ping，用于验证
// 「cloudfunctionRoot 透传 + 云函数目录随产物同步」这条管线是否打通。
//
// D4 待补齐：
//   - validate()：入参 JSON Schema 校验
//   - record 的 CRUD + 统计聚合
//   - 所有查询强制注入 _openid（架构红线 5）
//
// eslint-disable-next-line @typescript-eslint/no-var-requires -- 云函数运行在 Node CJS 环境，无打包/转译步骤
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { action } = event || {};
  const { OPENID } = cloud.getWXContext();

  switch (action) {
    case 'ping':
      return { ok: true, data: { openid: OPENID } };
    default:
      return { ok: false, code: 'UNKNOWN_ACTION', action };
  }
};
