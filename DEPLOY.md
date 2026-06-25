# 部署说明（交给 Claude Code）

把这个文件夹部署成两样东西：
1. **Cloudflare Worker** —— 给 DeepSeek 当代理（藏 key + 绕过浏览器跨域）。
2. **GitHub Pages 静态站点** —— 网页本体，部署后可加到 iPad 主屏幕。

## 关键事实（照这个来，别猜）
- 代理上游：DeepSeek，OpenAI 兼容接口 `https://api.deepseek.com/chat/completions`
- Worker 配置已写好在 `wrangler.toml`（`UPSTREAM_URL` / `AUTH_STYLE=bearer`），入口是 `worker.js`
- DeepSeek 的密钥是 **Secret**，名字必须叫 `API_KEY`
- 静态站点入口是 `index.html`；仓库要设为 **Public**，Pages 用 `main` 分支 / 根目录

## ⚠️ 唯一需要「人」来做的一步
DeepSeek 的 key 由用户本人在终端粘贴，**Claude Code 不要代填、也不要写进任何文件**：
```
wrangler secret put API_KEY
```
（运行后会提示输入，用户把 sk-... 粘进去。）

## 任务 A：部署 Worker
1. 如未登录：`wrangler login`（浏览器 OAuth）
2. `wrangler deploy`
3. 提示用户执行 `wrangler secret put API_KEY` 并粘入 DeepSeek key
4. 记下部署输出的 Worker 网址（形如 `https://linggan-chuchuang-proxy.<子域>.workers.dev`）

## 任务 B：发布到 GitHub Pages
1. 用 `gh` 新建 **Public** 仓库并把当前文件夹推上去
2. 开启 GitHub Pages（`main` 分支、根目录 `/`）
3. 给出最终访问网址

## 收尾（让换设备也免配置）
把任务 A 得到的 Worker 网址，填进 `index.html` 顶部的 `DEFAULT_PROXY_URL` 常量（引号里），再 commit + push 一次。
这样网页一打开就默认 DeepSeek + 代理，无需在 iPad 设置里手填。

## 用户侧最后一步（在 iPad 上）
打开 Pages 网址 → Safari「分享」→「添加到主屏幕」。
若上一步没填 `DEFAULT_PROXY_URL`：进设置 → AI 服务商选 DeepSeek、调用方式「通过代理」、代理地址填 Worker 网址、内容来源切到「AI 现编」。

## 前置条件
需要 `node`、`wrangler`（`npm i -g wrangler`，或用 `npx wrangler`）、`gh`（GitHub CLI，需已登录）。缺哪个先装哪个。
