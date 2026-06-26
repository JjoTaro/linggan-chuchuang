// 灵感橱窗 —— 通用 AI 代理 + 跨设备同步（Cloudflare Worker）
// 作用：① 把你的 API Key 放在服务器端，浏览器看不到；
//       ② 解决国产接口不允许浏览器跨域(CORS)的问题；
//       ③ /sync 路由用 KV 在多台设备间同步灵感库（需绑定 KV，见下）。
//
// ===== 代理部署（已完成的可跳过）=====
// 1. Workers & Pages → Create Worker，把本文件粘进去 Deploy。
// 2. Settings → Variables and Secrets：
//    · Secret  API_KEY      = 你的服务商密钥（终端：wrangler secret put API_KEY）
//    · Variable UPSTREAM_URL = 服务商接口地址
//    · Variable AUTH_STYLE   = bearer （仅 Anthropic 填 x-api-key）
//
// ===== 开启跨设备同步（新增）=====
// 1. 终端建一个 KV 命名空间：   wrangler kv namespace create SYNC
//    复制输出里的 id。
// 2. 在 wrangler.toml 里取消注释 [[kv_namespaces]] 段并填入该 id（binding 必须是 SYNC）。
// 3. 重新部署：               wrangler deploy
// 4. 在 App 设置「跨设备同步」里，各设备填同一句口令即可。
// 未绑定 KV 时，/sync 会返回 501，但不影响 AI 代理正常工作。

const ALLOW_ORIGIN = "*"; // 可改成你的 Pages 网址，如 "https://jjotaro.github.io"

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": ALLOW_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    // ---- 跨设备同步：/sync ----
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");
    if (path.endsWith("/sync")) {
      const key = url.searchParams.get("k") || "";
      const jhead = { ...cors, "content-type": "application/json" };
      if (key.length < 8 || key.length > 80) return new Response(JSON.stringify({ error: "bad key" }), { status: 400, headers: jhead });
      if (!env.SYNC) return new Response(JSON.stringify({ error: "KV 未绑定：请在 wrangler.toml 配置 SYNC 后重新部署" }), { status: 501, headers: jhead });
      if (request.method === "GET") {
        const v = await env.SYNC.get(key);
        return new Response(v || "{}", { status: 200, headers: jhead });
      }
      if (request.method === "PUT" || request.method === "POST") {
        const data = await request.text();
        if (data.length > 1500000) return new Response(JSON.stringify({ error: "数据过大" }), { status: 413, headers: jhead });
        await env.SYNC.put(key, data);
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jhead });
      }
      return new Response("method not allowed", { status: 405, headers: cors });
    }

    // ---- AI 代理：POST / ----
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
    // 直接把上游响应体作为流转发：支持 stream:true 的逐字输出，普通 JSON 也照常工作。
    return new Response(resp.body, {
      status: resp.status,
      headers: { ...cors, "content-type": resp.headers.get("content-type") || "application/json" },
    });
  },
};
