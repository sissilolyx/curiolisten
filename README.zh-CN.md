# 原声精听 · Meeting Listening Lab

[English](README.md) · **简体中文**

**把想看的 YouTube、想听的播客，变成 AI 英语精听练习。**

同一句话重听了几遍，还是没听清？导入视频、播客或自己的录音，先听原声、试着听写，再核对文本，让 AI 解释卡住你的词句。值得记住的表达可以连同原句和原声一起留到复习里。

[在 Mac 上开始](#最简单把-github-链接交给-codex-或-cursor) · [查看界面](#产品一览) · [常见问题](#使用前你可能想问) · [反馈问题](https://github.com/sissilolyx/meeting-listening-lab/issues)

面向中文使用者的英语学习工具。macOS 本地运行，当前界面与 AI 讲解以中文为主。

![AI 英语精听工作区：原声视频、分段听写和逐句讲解；图中为虚构演示材料](docs/images/overview.png)

*截图使用虚构演示数据。当前界面以实际版本为准。*

## 用自己感兴趣的内容练听力

- **YouTube 英语精听**：导入公开视频或 Shorts，用原声练习访谈、演讲和真实对话。
- **播客精听**：粘贴 Apple Podcasts 公开单集链接，把一长集拆成可以逐段练习的材料。
- **本地音视频与会议复盘**：拖入录音、录屏，或导入自己的飞书/Lark 妙记。
- **听写与逐句核对**：先隐藏文本认真听，再核对漏听的词；按自然句播放，减少半句话被切断的干扰。
- **AI 讲解与追问**：看中文意思、表达和语法，选中不懂的内容继续问；讲解始终围绕当前原句。
- **保存表达，再听一次**：把知识点加入原句复习，保留学习位置，并查看本机学习时长。

从一小段开始：**导入 → 听原声 → 听写核对 → AI 讲解 → 保存复习**。

> 适合愿意在 Mac 上安装本地工具的英语学习者。AI 讲解需要你自己的 Codex 或 Cursor 账号，并消耗对应额度；原始音视频留在本机，讲解所需文本会发给你选定的 AI 服务。[数据边界](PRIVACY.md)

## 最简单：把 GitHub 链接交给 Codex 或 Cursor

仓库已经公开。把 [meeting-listening-lab 仓库链接](https://github.com/sissilolyx/meeting-listening-lab) 发给运行在**你自己 Mac 上**、能够使用本地终端和浏览器的 Codex 或 Cursor。可以只说：

> 请在我的 Mac 上安装或更新这个项目并打开网站：https://github.com/sissilolyx/meeting-listening-lab 。先完整阅读 README.zh-CN.md 的“给安装代理的执行契约”。复用已有安装目录和本机数据；先运行 `./setup.command` 检测环境。你是 Codex 就只准备 Codex，你是 Cursor 就只准备 Cursor。若当前服务的官方 CLI 或项目必需依赖缺失，我授权你按 README 列出的官方方式执行安装；需要系统审批时直接向我发起审批，不要只把命令交给我。账号登录时请启动官方浏览器登录流程，等我完成账号选择、SSO/MFA 或授权后主动重新检测。读取我账号当前可用的模型后在这个对话里让我选，或者打开网页让我选。不要删除、清理或上传 `.data/`、`.models/`，不要索取或读取 Token，也不要替我运行会消耗额度的连接测试。

代理完成后会打开同一个本地网站。不是两套应用，也不需要“从 Codex 打开一个版本、从 Cursor 打开另一个版本”：Codex/Cursor 只是这个网站所调用的 AI 讲解服务。

> 仓库不会捆绑或静默安装 Codex/Cursor CLI，也不假定它们一定缺失。Agent 会先检测：已经安装并登录的就直接复用，只安装当前 Agent 对应且确实缺失的一个服务。Cursor 桌面应用与 Cursor Agent CLI 是两项独立安装；从 Cursor 打开仓库不代表后台所需的 CLI 已经安装。最终以 `./setup.command` / `npm run doctor` 的检测结果为准。

> 云端 Agent 不能替你保存或打开 Mac 上的本地材料；这条安装方式要求代理能够操作你当前这台电脑。系统依赖安装、约 466 MB 的 Whisper 模型下载以及官方账号登录，仍可能需要你本人确认。

<details>
<summary>安装代理详细说明（Codex / Cursor 接手时请完整阅读）</summary>

### 给安装代理的执行契约

如果你是接手上述链接的 Codex 或 Cursor，请严格遵守：

1. **先找旧安装，再决定是否 clone。** 查找 remote 指向本仓库的现有目录；找到后必须在原目录更新，不要另建一份 clone，否则新目录会显示空材料库。已有 `update.command` 时直接运行 `./update.command`。很老的版本没有这个文件时，先只获取远端并从远端版本取出安全更新器，再让它检查和更新当前目录：

   ```bash
   git fetch --prune
   git show "@{upstream}:scripts/safe-update.mjs" > /private/tmp/meeting-listening-safe-update.mjs
   node /private/tmp/meeting-listening-safe-update.mjs "$PWD"
   ```

   这条兼容路径也会在合并前检查远端完整目录。确实没有旧安装时才 `git clone`。
2. **不得“清理后重装”。** 禁止 `git reset --hard`、`git clean -fd`、`git clean -fdx`、删除旧目录、自动 stash 或用新 clone 覆盖旧目录。遇到公开代码的本地改动时停止并请用户决定。
3. **本机数据不可读、不可传、不可改。** `.data/` 包含材料、逐字稿、学习进度、复习、问问、学习偏好以及 AI provider/model 设置；`.models/` 包含 Whisper 模型。安装或更新不需要读取其中内容。
4. **检测后由代理完成安装，不要只给命令。** 先运行 `./setup.command`。若当前代理对应的官方 CLI 或项目必需依赖缺失，说明官方来源、将执行的命令、下载规模和系统改动；用户已使用上方模板明确授权时，直接发起必要的系统审批并在获批后执行。安装后刷新 PATH，再重新运行 `./setup.command` / `npm run doctor`。Codex 代理只准备 Codex，Cursor 代理只准备 Cursor，不安装另一服务。Homebrew、官方远程安装脚本和约 466 MB Whisper 模型下载都必须遵守当前 Agent 与系统的权限确认。
5. **登录由代理发起、用户确认、代理复检。** 代理运行 `codex login` 或 `agent login`（旧版兼容命令可能是 `cursor-agent login`）并打开官方登录页；账号选择、密码、SSO、MFA、浏览器授权和 macOS 安全弹窗必须由用户本人完成。绝不索取、复制或写入 Token。用户确认完成后，代理主动检查登录状态与动态模型列表，不要让用户再手动输入检查命令。
6. **当前版本只支持 Codex 和 Cursor；当前代理决定 provider，用户决定模型。** 首次设置为空时，Codex 会话只建议 `codex`，Cursor 会话只建议 `cursor`；不得静默换用另一个服务。读取该账号的动态模型目录，让用户在当前对话明确选择模型；用户也可以选择在首次打开的网页中设置。
7. **对话内选择不消耗模型额度。** 启动后可从实际本地地址 `GET /api/ai-settings` 读取状态和模型；用户选定后，以 `PATCH /api/ai-settings` 仅保存 `{provider, model}`，再 GET 校验。已有设置时不得覆盖，除非用户明确要求切换。不要调用 `POST /api/ai-settings/test`，也不要为了验收触发讲解或“问问”。
8. **打开实际地址。** 使用 `./start.command`，等待服务可访问后打开脚本实际打印的 `http://127.0.0.1:<端口>/`；端口不一定是 4173，运行终端需要保持打开。

</details>

公开仓库的 clone/pull 不需要受邀权限；GitHub 登录只在提交代码等写操作时需要。Codex 或 Cursor CLI 登录决定使用谁的 AI 额度；Lark 登录只用于可选的妙记导入。这三类账号彼此独立，每位使用者都使用自己的账号。

> 这是一个公开提供源代码、在 **macOS 本机自托管** 的英语精听工具。GitHub 仓库只分发代码；它不是 GitHub Pages，也不是云端网站。任何人都可以下载代码并在自己的 Mac 上启动；每位使用者的材料、学习数据和账号彼此隔离。

> 当前版本的 AI 讲解只支持 **Codex** 和 **Cursor**。选择 Codex 时，生成任务会计入当前登录的 Codex/ChatGPT 账号额度；选择 Cursor 时，会计入当前登录的 Cursor 账号额度。项目不提供共享 Token，也不代管任何账号凭据。

> 本项目源码公开，但仅授权用于非商业目的。可以按许可证使用、修改和分发；商业用途需要另行取得权利人的许可。

## 当前版本状态

- **精听主流程已可用。** 原声播放、分段听写、逐句核对与讲解、表达学习和 AI 问问等核心训练流程已经可用，仍会继续优化细节与稳定性。
- **复习模式：仍在持续打磨。** 当前可以体验，但交互和复习策略还不是最终版本；打磨完成后会随后续版本更新。
- **欢迎反馈。** 如果你遇到问题，或对训练流程、复习方式有任何建议，欢迎提交 [GitHub Issue](https://github.com/sissilolyx/meeting-listening-lab/issues)。

## 产品一览

> 以下截图来自真实产品界面，但材料标题、说话人、逐字稿和学习记录均为专门制作的虚构演示数据，不包含维护者的真实会议内容。

上方总览展示画面精听；下面是纯听和 AI 追问的界面示例。

### 纯听模式：音频固定，讲解纵向滚动

![纯听工作区：固定原声音频控制和可滚动逐句讲解](docs/images/listen-only.png)

### AI 辅助：表达讲解、例句与独立问问卡片

![表达展开讲解、例句与右侧独立问问卡片](docs/images/ask-and-explain.png)

## 先了解数据边界

- 材料、音视频、逐字稿、学习进度、复习内容和“问问”记录默认保存在当前项目的 `.data/`，只在这台电脑的这个项目副本中使用。
- 不同使用者之间没有账号数据同步，也不会同步你的材料。换电脑、换项目目录或删除 `.data/` 后，原来的学习数据不会自动出现。
- 本地音视频由 `whisper.cpp` 在电脑上转写，不会上传到 GitHub，也不会由本项目上传到自建云存储。
- 这是同一个本地网页，不需要分别安装 Codex 版和 Cursor 版。通过本机代理安装时，代理会建议使用它自身对应的服务，并让你在对话里选择模型；手动安装时可在首次打开的网页中选择。以后会记住上次选择，也可以从左侧全局入口随时切换。
- 讲解和“问问”通过本机登录的 Codex CLI 或 Cursor Agent CLI 生成。项目只把完成当前请求所需的逐字稿片段、问题和语境交给你主动选择的服务；原始音频和视频不交给 AI 服务。请只导入符合你所在组织及所选服务使用规则的内容。若内容完全不能离开电脑，请不要使用讲解或“问问”功能。
- 当前版本只支持 Codex 和 Cursor。每位使用者通过自己的官方 CLI 登录并消耗自己的账号额度或 Token；选择 Codex 不会消耗 Cursor 额度，选择 Cursor 也不会消耗 Codex 额度。本项目不提供共享 Token，不要求把 API Key 写进项目，也不会把 Codex/Cursor 凭据写入仓库、`.data/` 或项目配置；登录凭据由各自的官方 CLI 管理。应用不会在两个服务之间静默回退。
- 飞书/Lark 导入是可选能力。使用者需要在自己的电脑上安装并登录 `lark-cli`；本项目不会共享仓库维护者或其他使用者的 Lark 登录。
- 服务默认只监听 `127.0.0.1`。不要把 `HOST` 改成 `0.0.0.0`，不要做端口转发，也不要把它部署到公网服务器。

### 绝对不要提交的本地内容

提交代码或反馈前先运行 `git status`，确认以下内容没有进入 Git：

- `.data/`：所有材料、逐字稿、进度、复习和问问记录
- `.models/`：本地 Whisper 模型
- `.env`、`.env.*`：可能包含个人路径或本地配置
- `.auth/`、`.credentials/`、`.settings/` 及 `*.local`：本机账号或设置残留（正常使用不需要在项目中创建这些文件）

不要为了“方便测试”移除这些忽略规则，也不要在 Issue、截图或日志中暴露会议内容。

## 5 分钟 Quick Start

以下 5 分钟指依赖已经安装后的首次启动；第一次下载约 466 MB 的 Whisper 模型可能需要更久。

如果已经把链接交给 Codex/Cursor，可由代理按前文的 [“给安装代理的执行契约”](#给安装代理的执行契约) 完成这些步骤；下面是手动安装方式。

1. 从公开 GitHub 仓库克隆代码：

   ```bash
   git clone https://github.com/sissilolyx/meeting-listening-lab.git
   cd meeting-listening-lab
   ```

2. 双击 `setup.command`，或在终端运行：

   ```bash
   ./setup.command
   ```

   它只检查本机环境并给出修复提示，不会替你修改系统或自动安装软件。

3. 下载本地英文 Whisper 模型；AI 讲解服务可以先准备 Codex、Cursor Agent，或两者都准备：

   ```bash
   npm run setup:model
   ```

   `setup.command` 本身只检测，不会被网页静默触发去安装或登录 AI 服务。若是把仓库链接交给本地 Agent，Agent 会按上方执行契约在获批后完成安装、发起登录并复检；手动安装时可使用下方“AI 讲解服务”的命令。即使暂时没有可用的 AI 登录，本地网页和听音能力仍可启动；讲解和“问问”会等到你完成选择与登录后再使用。

4. 双击 `start.command`。它会选择本机可用端口、启动服务并打开正确的本地页面。也可以在终端运行：

   ```bash
   ./start.command
   ```

5. 选择一种材料开始：有 `yt-dlp` 时可粘贴 YouTube 或 Apple Podcasts 单集链接；也可在“本地文件”中选择、拖入或按 `⌘V` 粘贴 MP3、M4A、WAV、MP4、MOV。飞书妙记需要可选的 Lark 设置。

关闭运行 `start.command` 的终端窗口，或在该终端按 `Control-C`，即可停止服务。

## 系统要求

第一版仅验证 macOS，不保证 Windows 或 Linux 可用。

必需：

- Git
- Node.js 22 或更高版本
- FFmpeg（同时需要 `ffmpeg` 和 `ffprobe`）
- `whisper-cli`（whisper.cpp）
- 本地 Whisper 英文模型 `.models/ggml-small.en.bin`

可选：

- `yt-dlp`，仅在导入 YouTube 或 Apple Podcasts 链接时需要；使用 `brew install yt-dlp` 安装（会一并准备其运行依赖）
- Codex CLI 或 Cursor Agent CLI；当前版本的讲解和“问问”只支持这两种服务，至少需要其中一个已使用当前使用者自己的账号登录
- `lark-cli`，仅在粘贴飞书/Lark 妙记链接时需要

使用 Homebrew 的 Mac 可以先安装常见依赖：

```bash
brew install node@22 ffmpeg whisper-cpp
```

## AI 讲解服务

网页始终通过同一个 `start.command` 启动。当前版本只支持 Codex 和 Cursor。安装代理可以把自身对应的服务作为建议，并在原对话中让你选择模型；也可以不预设，直接由你在第一次打开网页时选择。以后会记住上次选择，并可从左侧全局入口切换。切换服务只影响之后新生成的内容，不会把已有讲解自动重新生成；新任务会计入所选服务当前登录账号的额度或 Token。

无需同时安装两个服务。设置页会分别显示检测结果：一个显示“已登录”、另一个显示“未安装”，只表示当前 Mac 只准备好了前者；选择后者前再让安装 Agent 按下方官方方式补齐即可。

### Codex

按照 [Codex CLI 官方说明](https://developers.openai.com/codex/cli) 安装后，由当前使用者本人完成官方浏览器登录。登录方式和凭据保存规则见 [Codex 认证说明](https://developers.openai.com/codex/auth)：

```bash
curl -fsSL https://chatgpt.com/codex/install.sh | sh
codex login
codex login status
```

官方也提供 npm / Homebrew 安装选项；安装 Agent 应以当时官方文档和本机已有安装为准，不重复安装已有的 Codex CLI。

### Cursor

Cursor 桌面应用和供本项目后台调用的 Cursor Agent CLI 不是同一个命令。按照 [Cursor Agent CLI 官方安装说明](https://cursor.com/docs/cli/installation) 安装后，由当前使用者本人完成官方浏览器登录；认证说明见 [Cursor CLI Authentication](https://cursor.com/docs/cli/reference/authentication)：

```bash
curl https://cursor.com/install -fsS | bash
agent login
agent status
```

Cursor 当前官方命令名是 `agent`；旧版安装可能仍提供 `cursor-agent`，本项目兼容两者。

上面的命令供手动安装使用。把仓库链接交给能够操作当前 Mac 的本地 Agent 时，Agent 应完成“检测 → 执行获准的官方安装 → 发起登录 → 等用户完成浏览器确认 → 重新检测 → 让用户选模型 → 启动网站”，用户无需复制粘贴安装或检查命令。`setup.command` 本身仍只做检测，不会由网页静默安装软件。

需要飞书妙记导入时，再安装并登录可选的 Lark CLI：

```bash
npm install -g @larksuite/cli
lark-cli auth login
```

安装后以 `npm run doctor` 的实际检查结果为准。Lark 缺失或未登录不应影响本地文件导入。

## 环境检查

随时运行：

```bash
npm run doctor
```

它会先检查启动和本地听音所必需的 Node.js、FFmpeg、`whisper-cli` 与 Whisper 模型，再分别报告可选的 Codex、Cursor Agent 和 Lark 状态。Codex/Cursor 均未安装或未登录时，环境检查仍可通过并启动网站，只是 AI 讲解尚不可用。

也可以单独确认账号状态：

```bash
codex login status
agent status
lark-cli auth status --json
```

## 日常启动

推荐双击 `start.command`，它会自动选择空闲端口并打开浏览器。

也可以运行：

```bash
npm start
```

手动启动默认地址为 [http://127.0.0.1:4173](http://127.0.0.1:4173)。如端口被占用，可以改用另一个仅限本机的端口：

```bash
PORT=4174 npm start
```

可选环境变量：

- `PORT`：本地端口，默认 `4173`
- `LISTENING_DATA_DIR`：材料和学习数据目录，默认是项目内的 `.data/`
- `WHISPER_MODEL_PATH`：自定义 Whisper 模型文件路径
- `CODEX_ANALYSIS_BATCH_SIZE`：兼容旧版的讲解批大小设置，默认 `60`
- `SKIP_CODEX_ANALYSIS=1`：只做本地转写，不生成 AI 讲解

请保留默认主机 `127.0.0.1`，不要设置 `HOST=0.0.0.0`。

## 主要能力

- 粘贴 YouTube 普通视频、短链接或 Shorts 链接，下载原声到本机后生成精听材料
- 粘贴 Apple Podcasts 单集链接，下载公开的完整原声并进行本地转写
- 导入本地 MP3、M4A、WAV、MP4、MOV，或从 macOS「语音备忘录」复制后在页面中按 `⌘V` 粘贴
- 可选导入飞书/Lark 妙记链接，保留官方逐字稿和说话人时间戳
- 链接提交成功或文件保存到本机后，即可继续添加材料；多份材料在后台独立处理、分别显示进度，完成时不会跳走当前页面
- 本地 Whisper 转写和时间校准；训练时播放真实原声
- 修正原文时可记住这次纠错，为后续本地识别提供名字、术语和简短表达提示；左侧“识别记忆”可查看、停用或重新启用
- 按自然分段听写、拖动进度、1× 原速播放、手动循环、续听和独立滚动
- 核对听写差异，并按自然句展示中文意思、表达与语法
- “表达与语法”讲解可独立加入复习，保存当前讲解，并关联原句和原声
- 对选中表达继续问所选 AI 服务，将生成的知识点加入精确原句复习
- 每句原文旁都有“深入问问”，讲解待生成或未提取表达时也能进入；右侧常驻入口可新建本段问答或继续已有问答，点击入口仅打开草稿，发送问题后才调用 AI
- 本地记录已听覆盖度、需复习内容、材料排序、问问历史和最近位置
- 材料删除后进入本地垃圾桶，30 天内可以恢复

### 学习显示偏好

听写输入框右侧可「收起听写 / 展开听写」，收起不会清空已输入内容。勾选下方「默认展开原文与逐句讲解」后，进入每个片段都会直接显示已有讲解，无需逐段点击；取消勾选即可恢复手动查看。这两个独立偏好保存在当前浏览器，切换片段、材料、精听/复习模式和刷新页面时都会沿用。

### 每日学习时长

左侧「学习统计」显示今日精听、复习、合计，以及最近 7 / 30 / 90 天的每日记录和累计时长。按当前学习模式分类，按本机时区跨零点拆分。

只有实际播放音频或点击、输入、滚动等交互才会启动计时；页面打开本身不计时。最后一次听音或交互后的 1 分钟仍算活跃，超过后暂停，下一次操作再继续。按真实经过的时间统计，倍速和拖动进度不会增加播放时长，休眠不会补算。每 15 秒通过本机心跳保存到 `.data/study-time.json`，短暂断线或刷新会从浏览器暂存补记；多个标签页重叠时间只算一次，优先归入正在听音的模式，否则归入最近交互的模式。仅记录功能启用后的时间，不推算历史学习时长。

### 完整句断句

YouTube、Apple Podcasts、本地音视频和飞书妙记都按句号、问号、感叹号等句尾标点组织自然句；同一说话人的跨转写块续句会先合并，再划分练习段落。逗号、换行、转写块长度和段落字数上限不会单独截断一句话；常见称谓缩写和小数点会保留在句内。

旧材料会兼容合并未结束的续句，整句原声覆盖合并后的时间范围。原分句和学习记录保存在材料中，复习、问问与已生成讲解继续保留；已有讲解会注明来自原分句，不会仅为调整断句而重新调用 AI。

### 找回材料来源

精听页标题下方的「材料来源」可以打开或复制 YouTube、Apple Podcasts、飞书妙记的来源链接，也可以「在访达中显示」这份材料保存在本机的音视频文件。新上传的本地文件会保留上传时的文件名；定位的是工具保存的副本，浏览器不会提供上传前的原文件夹路径。旧材料无需重新导入即可定位已有的音视频副本。

### 本机纠错记忆

保存原文修正时，默认勾选“记住这次纠错，用于以后的识别”。输入框下方会预览提取到的词语；如果只是在润色句子，可取消勾选。标点、常见功能词和大段改写不会作为词语提示。

纠错前后文本与启用状态随原材料保存在本机，下次 Whisper 全段转写或片段补录会通过 `--prompt` 与 `--carry-initial-prompt` 参考已启用的词语。提示按最近修正优先、去重并限制长度；同一句再次修正会停用旧提示。它不训练模型、不自动替换其他句子、不追加 AI 请求，也不会重跑已完成或正在识别的材料。已有材料的历史修改不会被猜测还原成记忆。

服务重启后会保留已完成的讲解，并根据中断任务保存的账号服务及模型接着生成缺少的部分；包括已完成转写的链接和本地导入。维护时可设置 `LISTENING_PRESERVE_DATA=1`，跳过垃圾桶到期清理。

### YouTube 链接导入

首次使用时通过 Homebrew 安装 [yt-dlp](https://github.com/yt-dlp/yt-dlp)：

```bash
brew install yt-dlp
```

在首页最前面的“YouTube 链接”选项中粘贴视频链接，点击“开始解析”。支持 `youtube.com/watch?v=...`、`youtu.be/...` 和 `youtube.com/shorts/...`。只导入链接指定的单个视频，播放列表和分享参数会被忽略；视频需已发布，最长 4 小时，单个下载文件上限 4 GB。

应用优先下载最高 720p 的 H.264 视频和原始音轨；无法获取兼容画面时会使用原声音频。原声保存在此项目的 `.data/`，由本地 Whisper 转写，并接入与本地文件相同的精听和 AI 讲解流程。点击开始导入后，AI 讲解会使用你已选择的账号和模型。开发验证可在独立临时数据目录中设置 `SKIP_CODEX_ANALYSIS=1`，避免调用 AI。

导入组件不会读取浏览器 Cookie、账号凭据或自定义 yt-dlp 配置。需要登录、年龄验证、尚未结束的直播或受地区限制的视频会显示失败原因，可改用有权使用的本地文件。网络环境也可能影响下载；持续失败时可执行 `brew upgrade yt-dlp` 后重试。

### Apple Podcasts 单集导入

在首页选择“Apple Podcasts”，粘贴从播客单集“分享”中复制的 `podcasts.apple.com` 链接，然后点击“开始解析”。链接必须包含 `i=单集编号`；节目主页链接会提示重新选择单集，不会自动下载整个节目或误选最新一期。

此功能复用 YouTube 的 `yt-dlp` 组件，无需 Apple 账号、Cookie 或新的 AI 服务。只下载单集可公开获取的原声音频，保留 MP3/M4A 等格式，并接入本地 Whisper、原声播放和已有的 AI 讲解流程。单集最长 4 小时、文件上限 4 GB；不支持订阅专享、已下架或没有公开原声的单集。AI 讲解仍使用当前选择的账号和模型。

## 更新代码而不丢学习数据

更新必须在原来的项目目录中进行。`.data/` 和 `.models/` 已被 Git 忽略，其中的材料、逐字稿、学习进度、问问、复习、AI provider/model 设置和 Whisper 模型都会继续使用。

推荐双击 `update.command`，或在原项目目录运行：

```bash
./update.command
```

它会先获取远端版本，但在改动本地代码前执行失败即停止的安全检查：

- 公开代码有本地改动时停止，不 reset、clean、stash 或覆盖；
- 远端版本误带 `.data/`、`.models/`、凭据路径或媒体文件时拒绝更新；
- 只接受 fast-forward 更新；
- 更新后运行本机环境检查，并提示重新启动。

安全更新本身不会读取或复制材料内容。更新前仍建议做一次额外备份，尤其是保存了不可重新获取的会议材料时。

1. 停止本地服务。
2. 在 Finder 中复制一份 `.data/` 到项目目录之外，或在项目目录运行下面的时间戳备份命令：

   ```bash
   backup_dir="../meeting-listening-lab-data-backup-$(date +%Y%m%d-%H%M%S)"
   cp -R .data "$backup_dir"
   ```

3. 运行安全更新：

   ```bash
   ./update.command
   ```

4. 再次双击 `start.command`。

不要用 `git reset --hard`、`git clean -fd`、`git clean -fdx` 或直接删除整个旧目录来“更新”。不要为了更新而另建 clone；它不会自动知道旧目录中的材料。如果必须迁移目录，请先停止服务并完整复制旧目录中的 `.data/`；`.models/` 可以复制，也可以重新运行 `npm run setup:model` 下载。

## 使用前你可能想问

### 可以用 YouTube 或播客练英语听力吗？

可以。YouTube 支持公开视频和 Shorts；Apple Podcasts 需要从“分享单集”复制带单集编号的链接。安装可选的 `yt-dlp` 后，应用下载原声并用本地 Whisper 转写，再进入听写、讲解和复习流程。单条材料最长 4 小时、文件上限 4 GB；付费、登录受限或下架内容不支持。首次可先选一段短材料体验。

### AI 英语精听具体帮我做什么？

Whisper 把原声转成带时间信息的文字；你选定的 Codex 或 Cursor 再提供中文意思、表达和语法讲解，并回答围绕原句的追问。你仍然先听原声、再核对。AI 转写和解释都可能出错，可以手动修正转写，并把常见识别错误加入本机“识别记忆”。

### 和看双语字幕有什么区别？

这里把“先听、再看答案”做成一个连续练习：隐藏文本听一段，输入听写后核对，再回到具体句子理解表达。想复习的知识点会保留原句和原声，方便下次重听。

### 免费吗？可以直接在线使用吗？

项目按非商业许可证提供源码，不收取软件订阅费。AI 讲解使用你自己的服务账号，额度或费用由对应服务决定。当前需要安装到 Mac 后在本地浏览器使用，没有免安装在线版；Windows、Linux 和手机尚未验证。

### 录音和学习记录会被上传吗？

本项目不会把原始音视频、学习记录或账号凭据上传到 GitHub。转写在本机完成；生成 AI 讲解或追问时，会把所需文本交给你选择的服务，因此并非完全离线。完整说明见 [PRIVACY.md](PRIVACY.md)。

## 故障排查

### 页面显示“无法访问此网站”或 `ERR_CONNECTION_REFUSED`

- 确认运行 `start.command` 的终端仍然打开且没有报错。
- 重新双击 `start.command`，使用它实际打开或打印的地址；端口不一定总是 `4173`。
- 运行 `npm run doctor`，先修复标为缺失的必需项。

### macOS 不允许打开 `.command` 文件

第一次可在 Finder 中右键文件并选择“打开”。若文件没有执行权限，在项目目录运行：

```bash
chmod +x setup.command start.command update.command
```

### 提示缺少模型

```bash
npm run setup:model
```

网络中断后可以重新运行；模型保存在 `.models/`，不会进入 Git。

### AI 服务未登录或讲解一直失败

先在网页左侧全局入口确认当前选择的是 Codex 还是 Cursor，并只检查对应服务。应用不会在失败时偷偷改用另一账号。

Codex：

```bash
codex login
codex login status
npm run doctor
```

Cursor：

```bash
agent login
agent status
npm run doctor
```

若旧版安装只提供 `cursor-agent`，将上面两条命令中的 `agent` 替换为 `cursor-agent`。

确认显示的是你自己的账号。不要在项目内创建或粘贴 API Key、访问 token 或 Cursor/Codex 登录文件。

### 本地文件可用，但飞书链接不可用

这是可选的 Lark 环境未准备好。安装 `lark-cli` 后，使用自己的 Lark 账号登录，再用 `lark-cli auth status --json` 和 `npm run doctor` 检查。没有 Lark CLI 时仍可继续使用本地音视频。

### `ffmpeg`、`ffprobe` 或 `whisper-cli` 找不到

```bash
brew install ffmpeg whisper-cpp
npm run doctor
```

如果终端能找到命令但双击启动仍找不到，关闭并重新打开 Terminal 后再试。

### 手动 `npm start` 提示端口被占用

优先改用 `start.command` 自动选择空闲端口，或手动指定其他端口：

```bash
PORT=4174 npm start
```

## 删除材料与卸载

- 删除单份材料：在左侧材料库使用“删除”，材料会先进入本机垃圾桶，可在 30 天内恢复。
- 停止工具：关闭启动终端，或按 `Control-C`。本项目不会安装常驻云服务。
- 卸载但保留数据：先把 `.data/` 复制到项目目录之外，再把 `meeting-listening-lab` 文件夹移到 macOS 废纸篓。
- 永久删除全部本地材料：停止服务后，在 Finder 中显示隐藏文件并删除项目内的 `.data/`；模型位于 `.models/`，可以单独删除。

卸载项目不会自动卸载 Node.js、FFmpeg、whisper.cpp、Codex CLI、Cursor Agent CLI 或 Lark CLI，因为其他本地工具也可能在使用它们。

## 开发者检查

```bash
npm run check
npm test
```

提交前再次确认：

```bash
git status
```

仓库中只能出现代码和公开文档，不能出现任何使用者的 `.data/`、`.models/`、`.env`、会议音视频、逐字稿或学习记录。

## 许可证

本项目采用 [PolyForm Noncommercial License 1.0.0](LICENSE)（SPDX：`PolyForm-Noncommercial-1.0.0`）。

任何个人或实体均可在非商业目的下使用、修改和分发本软件及其修改版本，但须遵守许可证条款，并在分发时保留许可证文本或其官方链接，以及所有 `Required Notice:` 声明。

本许可证不授予商业用途权利。如需将本软件用于商业目的，请另行联系仓库所有者取得许可。由于限制商业使用，本项目属于源码公开、源代码可用（source-available）的软件，并非 OSI 定义下的开源软件。
