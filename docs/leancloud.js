// Leancloud REST API 封装（免费开发版，无云函数，纯前端调用）
// 依赖：config.js 提供 window.MEIZU_FISSION_CONFIG
(function (global) {
  'use strict';

  var cfg = global.MEIZU_FISSION_CONFIG;
  var BASE = cfg.apiServer + '/1.1';
  var CLASS_PARTICIPANT = BASE + '/classes/Participant';
  var CLASS_INVITELOG = BASE + '/classes/InviteLog';
  var CLASS_ADMINCONFIG = BASE + '/classes/AdminConfig';

  // Leancloud 要求请求头带 X-LC-Id / X-LC-Key
  function headers(json) {
    var h = {
      'X-LC-Id': cfg.appId,
      'X-LC-Key': cfg.appKey,
    };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  async function req(url, method, body) {
    var opt = { method: method, headers: headers(!!body) };
    if (body) opt.body = JSON.stringify(body);
    var res = await fetch(url, opt);
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      var err = new Error((data && data.error) || ('HTTP ' + res.status));
      err.code = data && data.code;
      err.response = data;
      throw err;
    }
    return data;
  }

  // ---- Participant ----

  // 按 systemId 查单个参与者
  async function findBySystemId(systemId) {
    var where = encodeURIComponent(JSON.stringify({ systemId: systemId }));
    var data = await req(CLASS_PARTICIPANT + '?where=' + where + '&limit=1', 'GET');
    return (data.results && data.results[0]) || null;
  }

  // 按 refCode 查单个参与者
  async function findByRefCode(refCode) {
    var where = encodeURIComponent(JSON.stringify({ refCode: refCode }));
    var data = await req(CLASS_PARTICIPANT + '?where=' + where + '&limit=1', 'GET');
    return (data.results && data.results[0]) || null;
  }

  // 拉全部参与者（分页，免费版单次上限1000）
  async function findAllParticipants() {
    var all = [];
    var skip = 0;
    var limit = 1000;
    while (true) {
      var url = CLASS_PARTICIPANT + '?limit=' + limit + '&skip=' + skip + '&order=-createdAt';
      var data = await req(url, 'GET');
      var batch = data.results || [];
      all = all.concat(batch);
      if (batch.length < limit) break;
      skip += limit;
      if (skip >= 10000) break; // 兜底
    }
    return all;
  }

  // 统计总数（用于生成推荐码序号）
  async function countParticipants() {
    var data = await req(CLASS_PARTICIPANT + '?count=1&limit=0', 'GET');
    return data.count || 0;
  }

  // 生成唯一推荐码 MR001 ~ MR999（移植自 meizu-referral generateRefCode）
  // 逻辑：取总数N→序号N+1→MR+padStart(3)；若已存在则序号+1重试，最多10次
  async function generateRefCode() {
    var total = await countParticipants();
    var seq = total + 1;
    var code = 'MR' + String(seq).padStart(3, '0');
    var retry = 0;
    while (retry < 10) {
      var exist = await findByRefCode(code);
      if (!exist) return code;
      seq++;
      code = 'MR' + String(seq).padStart(3, '0');
      retry++;
    }
    return code;
  }

  // 注册参与者（含唯一冲突重试：systemId / refCode 唯一索引冲突时序号+1重试）
  async function createParticipant(payload) {
    // 先防重复：同 systemId 已存在直接返回已有记录
    var exist = await findBySystemId(payload.systemId);
    if (exist) {
      var dupErr = new Error('该系统号已注册');
      dupErr.code = 'DUPLICATE_SYSTEMID';
      dupErr.existing = exist;
      throw dupErr;
    }

    // 生成 refCode（若调用方未传）
    if (!payload.refCode) {
      payload.refCode = await generateRefCode();
    }

    var retry = 0;
    while (retry < 10) {
      try {
        var created = await req(CLASS_PARTICIPANT, 'POST', payload);
        return Object.assign({}, payload, { objectId: created.objectId, createdAt: created.createdAt });
      } catch (e) {
        // 137 = 唯一索引冲突
        if (e.code === 137) {
          // 若是 refCode 冲突，换一个 refCode 重试
          payload.refCode = await bumpRefCode(payload.refCode);
          retry++;
          continue;
        }
        throw e;
      }
    }
    throw new Error('注册失败：推荐码冲突重试超限，请重试');
  }

  // refCode 序号+1（用于冲突重试）
  async function bumpRefCode(code) {
    var num = parseInt(code.replace('MR', ''), 10) + 1;
    var next = 'MR' + String(num).padStart(3, '0');
    // 确保新码未被占用
    var exist = await findByRefCode(next);
    if (exist) return bumpRefCode(next);
    return next;
  }

  // ---- InviteLog ----

  async function createInviteLog(payload) {
    return await req(CLASS_INVITELOG, 'POST', payload);
  }

  // 某邀请人名下所有邀请记录
  async function findInviteesByInviter(refCode) {
    var where = encodeURIComponent(JSON.stringify({ inviterRefCode: refCode }));
    var data = await req(CLASS_INVITELOG + '?where=' + where + '&order=-createdAt&limit=1000', 'GET');
    return data.results || [];
  }

  // 全部邀请记录（后台用）
  async function findAllInviteLogs() {
    var all = [];
    var skip = 0;
    var limit = 1000;
    while (true) {
      var url = CLASS_INVITELOG + '?limit=' + limit + '&skip=' + skip + '&order=-createdAt';
      var data = await req(url, 'GET');
      var batch = data.results || [];
      all = all.concat(batch);
      if (batch.length < limit) break;
      skip += limit;
      if (skip >= 10000) break;
    }
    return all;
  }

  // ---- AdminConfig（口令校验）----

  async function findAdminByPasscode(passcode) {
    var where = encodeURIComponent(JSON.stringify({ passcode: passcode }));
    var data = await req(CLASS_ADMINCONFIG + '?where=' + where + '&limit=1', 'GET');
    return (data.results && data.results[0]) || null;
  }

  global.MZLC = {
    req: req,
    headers: headers,
    // Participant
    findBySystemId: findBySystemId,
    findByRefCode: findByRefCode,
    findAllParticipants: findAllParticipants,
    countParticipants: countParticipants,
    generateRefCode: generateRefCode,
    createParticipant: createParticipant,
    // InviteLog
    createInviteLog: createInviteLog,
    findInviteesByInviter: findInviteesByInviter,
    findAllInviteLogs: findAllInviteLogs,
    // Admin
    findAdminByPasscode: findAdminByPasscode,
    // 常量
    CLASS: { PARTICIPANT: CLASS_PARTICIPANT, INVITELOG: CLASS_INVITELOG, ADMINCONFIG: CLASS_ADMINCONFIG },
  };
})(window);
