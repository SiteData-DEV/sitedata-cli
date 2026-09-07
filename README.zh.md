# SiteData CLI

[![npm version](https://img.shields.io/npm/v/@sitedata/cli.svg)](https://www.npmjs.com/package/@sitedata/cli)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933.svg)](https://nodejs.org/)

[English](./README.md) | [中文](./README.zh.md)

[SiteData](https://sitedata.dev) 官方命令行客户端，面向人类用户和 AI Agent。通过安全的 OAuth 鉴权，即可在终端中查询网站排行榜、管理网站及关键词收藏，并获得结构化输出。

[安装](#安装与快速开始) · [AI Agent](#ai-agent-快速开始) · [鉴权](#鉴权) · [命令](#命令) · [进阶用法](#进阶用法) · [安全](#安全)

## 为什么选择 SiteData CLI？

- **面向 Agent 设计** — 命令稳定、Schema 可读取、支持 JSON 输出和明确退出码，API 调用过程中不会弹出交互式问题。
- **能力始终同步** — 命令和参数来自 SiteData 在线 Catalog，不依赖可能过期的本地快照。
- **浏览器登录简单** — 使用 OAuth Authorization Code + PKCE，自动打开浏览器并通过本机回调完成授权。
- **凭证安全存储** — OAuth 凭证保存在 Windows Credential Locker、macOS Keychain 或 Linux Secret Service 中。
- **按安装实例授权** — 每个操作系统用户下的 CLI 安装保存随机客户端标识，同一安装重新登录只替换该安装原有的会话。
- **支持读取与写入** — GET API 使用查询参数，POST API 使用 JSON 请求正文。
- **结构化输出** — 支持格式化 JSON、紧凑 JSON、原始响应以及仅输出响应中的 `data` 字段。

## 适合哪些场景？

| 你是…… | 推荐使用方式 |
| --- | --- |
| 终端用户 | 全局安装后运行 `sitedata login`，然后执行 API 命令。 |
| AI 编程客户端用户 | 登录一次，让 Codex、Claude Code 等具备终端能力的 Agent 执行 `sitedata ... --output json`。 |
| 脚本或自动化任务维护者 | 使用运行自动化任务的同一操作系统用户完成 OAuth，并通过 JSON 输出和退出码处理结果。 |
| MCP 客户端用户 | 原生 MCP 工具调用请使用 [SiteData MCP Server](https://mcp.sitedata.dev/mcp)，CLI OAuth 与 MCP OAuth 相互独立。 |

## 功能

| 分类 | 能力 |
| --- | --- |
| 网站排行榜 | 查询完整的流量增长、Domain Rating 增长和支付流量排行榜，支持当前/历史周期及公开筛选条件。 |
| 收藏 | 查询、新增、更新和删除网站或关键词收藏。 |
| 收藏文件夹 | 创建、重命名、删除文件夹，并按文件夹筛选收藏。 |
| 能力发现 | 列出当前 API Catalog，查看命令 Schema、枚举值、默认值与示例。 |

服务端发布权威命令 Catalog。运行 `sitedata list` 可查看 CLI 当前可用的全部 API。

## 安装与快速开始

### 环境要求

- Node.js 20 或更高版本
- npm 或兼容的包管理器
- 用于 OAuth 授权的 SiteData 账号

### 安装

```bash
npm install --global @sitedata/cli
sitedata --version
```

### 终端用户快速开始

```bash
# 1. 在浏览器中登录
sitedata login

# 2. 检查鉴权状态
sitedata auth status

# 3. 查看当前 API
sitedata list

# 4. 查询流量增长排行榜
sitedata rankings traffic-growth --output json

# 5. 查看已收藏的网站
sitedata favorites list --kind website --output json
```

浏览器登录使用固定公共 OAuth Client `sitedata-cli`、Resource `https://sitedata.dev` 和 Scope `api:invoke`。

## AI Agent 快速开始

> 浏览器授权需要用户交互。Agent 不得读取、打印或复制操作系统凭据库中的凭证。

```bash
# 1. 安装
npm install --global @sitedata/cli

# 2. 请用户在浏览器中完成授权
sitedata login

# 3. 验证鉴权并发现 API
sitedata auth status
sitedata list --output json

# 4. 查看并调用 API
sitedata describe rankings --output json
sitedata rankings traffic-growth --output json
sitedata favorites list --kind all --output json
```

为了让 Agent 稳定调用，可以将以下内容加入 `AGENTS.md`、`CLAUDE.md` 或同类指令文件：

```md
需要 SiteData 排行榜或收藏数据时，使用全局安装的 `sitedata` CLI。
API 命令统一添加 `--output json`。使用 `sitedata list --output json` 获取
当前 API，使用 `sitedata describe <command> --output json` 查看参数。
禁止读取或暴露已保存的 OAuth Token。
```

AI Agent 必须与完成 `sitedata login` 的用户运行在同一个操作系统账户下。Windows 凭证不会自动共享给 WSL、Docker、其他电脑或远程 Agent 运行环境。

## 鉴权

SiteData CLI 使用 OAuth Authorization Code + PKCE：

```bash
sitedata login
sitedata auth status
sitedata logout
```

Access Token 即将过期时会自动刷新。退出登录时，CLI 会尝试在服务端撤销 OAuth 凭证，并始终删除本地凭证。

每个安装实例保存一个以 `sd_` 开头的随机标识。同一安装重新授权时会替换原有 SiteData CLI 会话，不会撤销其他安装实例的会话。

## 命令

### 发现 API 和 Schema

```bash
sitedata list
sitedata list --output json
sitedata describe rankings
sitedata describe favorites --output json
sitedata rankings --help
```

CLI 从所选 API Base URL 的 `/api/v1/mcp/catalog` 加载 Catalog。如果在线 Catalog 不可用或格式无效，命令会直接失败，不会使用过期的本地定义。

### 排行榜查询

`rankings` 命令将 `rankingType` 作为必填参数，枚举值可以使用 kebab-case 别名：

```bash
# 当前流量增长排行榜
sitedata rankings traffic-growth --output json

# 历史 Domain Rating 增长排行榜
sitedata rankings domain-rating-growth --period archive --month 2026-08 --output json

# 按支付网关和语言筛选支付流量排行榜
sitedata rankings payment-traffic --gateway stripe --locale en --output json

# 查询公开标签中新发现的网站
sitedata rankings traffic-growth --new-sites --tag-type category --tag-code ai --output json
```

### 收藏和文件夹

`favorites` 是 POST API。必填的 `action` 可以作为第一个位置参数传入：

```bash
# 查询收藏
sitedata favorites list --kind all --output json
sitedata favorites list --kind website --folder-id <folder-id> --output json

# 新增和更新收藏
sitedata favorites add --kind website --domain example.com --remark Research
sitedata favorites add --kind keyword --keyword "ai tools"
sitedata favorites update --kind website --id <favorite-id> --folder-id <folder-id>
sitedata favorites delete --kind keyword --id <favorite-id>

# 管理文件夹
sitedata favorites create-folder --name Research
sitedata favorites rename-folder --folder-id <folder-id> --name Competitors
sitedata favorites delete-folder --folder-id <folder-id>
```

在线 Catalog 始终是唯一事实来源。编写自动化任务前，建议运行 `sitedata describe favorites` 检查当前 action 枚举和参数。

### 位置参数和参数别名

必填参数既可以按名称传入，也可以在没有歧义时作为位置参数传入：

```bash
sitedata rankings --ranking-type traffic-growth
sitedata rankings traffic-growth
```

Catalog 参数名支持 kebab-case 别名。例如 `rankingType`、`newSites` 和 `folderId` 可分别写成 `--ranking-type`、`--new-sites` 和 `--folder-id`。

## 进阶用法

### 输出模式

```text
--output pretty   缩进格式化 JSON（默认）
--output json     适合 Agent 和脚本的紧凑 JSON
--output raw      原始响应正文
--data-only       仅输出响应中的 data 字段
```

`--data-only` 不能与 `--output raw` 同时使用。正常结果写入 stdout，错误与更新提示写入 stderr。

### 全局参数

```text
    --base-url <url>       API Base URL（或 SITEDATA_BASE_URL）
-o, --output <mode>        pretty、json 或 raw（默认：pretty）
    --data-only            仅输出响应 data 字段
    --timeout <seconds>     请求超时时间（默认：45 秒）
    --no-update             本次命令跳过自动更新
-h, --help                 显示帮助
-V, --version              显示版本
```

### 环境变量

| 变量 | 用途 |
| --- | --- |
| `SITEDATA_BASE_URL` | 覆盖 REST API Base URL |
| `SITEDATA_OAUTH_ISSUER` | 开发时覆盖 OAuth Issuer |
| `SITEDATA_OAUTH_RESOURCE` | 开发时覆盖 OAuth Resource |
| `SITEDATA_NO_UPDATE=1` | 禁用自动更新 |
| `SITEDATA_PACKAGE_MANAGER` | 指定全局更新所用的 `npm`、`pnpm`、`yarn` 或 `bun` |

稳定版默认将 `https://sitedata.dev` 用作 API、OAuth Issuer 和 OAuth Resource。版本号包含 `-next` 时，默认使用 `https://www2.sitedata.dev` 作为 OAuth Issuer，同时保留生产 API Resource 和 Base URL。所有端点均可在本地开发时覆盖。

### 自动升级

CLI 会检查与当前安装版本对应的 npm 发布通道。成功检查结果缓存 1 小时；Registry 查询失败后 5 分钟重试，安装失败后 15 分钟重试。

发现新版本后，CLI 使用检测到的包管理器执行全局更新。当前命令继续使用已加载的旧版本，下次运行开始使用新版本。多个进程并发调用时，更新锁保证只有一个进程执行安装。

自动更新失败只会向 stderr 输出警告，原命令仍会继续执行。`CI=true` 时默认禁用自动更新。

```bash
sitedata update --check  # 立即检查，不安装
sitedata update          # 立即检查并安装
sitedata --no-update rankings traffic-growth
```

`SITEDATA_NO_UPDATE_CHECK=1` 作为旧版兼容开关仍然有效。

### 退出码

| 退出码 | 含义 |
| --- | --- |
| `0` | 成功 |
| `1` | API、鉴权、网络或运行时错误 |
| `2` | 命令或参数使用错误 |

## 开发

```bash
pnpm install
pnpm check
npm pack --dry-run
```

## 安全

- OAuth 使用 Authorization Code + PKCE，公共客户端不包含 Client Secret。
- 回调服务器只监听 `127.0.0.1` 的随机端口。
- OAuth Token 使用操作系统原生凭据服务保存，不会写入项目明文配置。
- 正常命令输出和错误信息不会包含凭证。
- CLI OAuth Token 使用 REST API Audience 和 `api:invoke` Scope，不能作为 MCP Token 使用。
- AI Agent 可能做出错误决策。请审查可能修改收藏或暴露私有业务数据的命令，并只授予必要权限。

## 相关链接

- [SiteData](https://sitedata.dev)
- [SiteData MCP](https://mcp.sitedata.dev/mcp)
- [npm 上的 SiteData CLI](https://www.npmjs.com/package/@sitedata/cli)
- [源代码](https://github.com/SiteData-DEV/sitedata-cli)
- [问题反馈](https://github.com/SiteData-DEV/sitedata-cli/issues)
