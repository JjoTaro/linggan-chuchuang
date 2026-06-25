// 灵感橱窗 —— 通用 AI 代理（Cloudflare Worker）
// 作用：① 把你的 API Key 放在服务器端，浏览器看不到；
//       ② 解决国产接口不允许浏览器跨域(CORS)的问题。
//
// 部署步骤：
// 1. 登录 https://dash.cloudflare.com → Workers & Pages → Create → Create Worker，
//    把本文件全部内容粘贴进去，点 Deploy。
// 2. 进入该 Worker 的 Settings → Variables and Secrets：
//    · 新增 Secret：  API_KEY      = 你的服务商密钥
//    · 新增 Variable：UPSTREAM_URL = 服务商接口地址（见下表）
//    · 新增 Variable：AUTH_STYLE   = bearer   （仅 Anthropic 填 x-api-key）
// 3. 把 Worker 网址（https://xxx.workers.dev）填进 App 设置的「代理地址」，
//    «调用方式» 选「通过代理」，«AI 服务商» 选对应的那个即可。
//
// 常用 UPSTREAM_URL 对照：
//   DeepSeek     https://api.deepseek.com/chat/completions                          AUTH_STYLE=bearer
//   智谱 GLM     https://open.bigmodel.cn/api/paas/v4/chat/completions              AUTH_STYLE=bearer
//   通义 Qwen    https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions AUTH_STYLE=bearer
//   Moonshot     https://api.moonshot.cn/v1/chat/completions                        AUTH_STYLE=bearer
//   OpenRouter   https://openrouter.ai/api/v1/chat/completions                      AUTH_STYLE=bearer
//   Anthropic    https://api.anthropic.com/v1/messages                              AUTH_STYLE=x-api-key
//
// 安全建议：把下面的 ALLOW_ORIGIN 改成你自己的 GitHub Pages 网址，
// 例如 "https://yourname.github.io"，别人就无法借用你的代理。

const ALLOW_ORIGIN = "*";

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": ALLOW_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return new Response("Only POST is allowed", { status: 405, headers: cors });

    const upstream = env.UPSTREAM_URL || "https://api.deepseek.com/chat/completions";
    const style = (env.AUTH_STYLE || "bearer").toLowerCase();

    const headers = { "content-type": "application/json" };
    if (style === "x-api-key") {
      headers["x-api-key"] = env.API_KEY;
      headers["anthropic-version"] = "2023-06-01";
    } else {
      headers["authorization"] = "Bearer " + env.API_KEY;
    }

    const body = await request.text();
    const resp = await fetch(upstream, { method: "POST", headers, body });
    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: { ...cors, "content-type": "application/json" },
    });
  },
};
