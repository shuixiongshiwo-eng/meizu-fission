// 美租裂变系统配置
// ⚠️ 阶段0完成后，把 Leancloud 控制台「设置→应用凭证」里的值填进来
window.MEIZU_FISSION_CONFIG = {
  // Leancloud 应用凭证
  appId: 'YOUR_LEANCLOUD_APP_ID',
  appKey: 'YOUR_LEANCLOUD_APP_KEY',

  // Leancloud REST API 域名：控制台「应用凭证」里的「API Server 域名」
  // 国内开发版通常形如 https://xxxxxxxxxxxxxxxx.leancloud.cn
  // 国际节点形如 https://us.leancloud.app
  apiServer: 'https://REPLACE_ME.leancloud.cn',

  // GitHub Pages 线上地址（部署后回填，用于生成分享链接）
  siteUrl: 'https://shuixiongshiwo-eng.github.io/meizu-fission/',

  // 后台管理口令（admin.html 登录用，可自行修改）
  adminPasscode: 'meizu2026',
};
