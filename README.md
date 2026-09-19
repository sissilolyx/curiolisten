# CurioListen

**Turn what you’re curious about into English listening practice.**

**English** · [简体中文](README.zh-CN.md)

An interview you can’t stop watching. A podcast about your latest obsession. A talk you want to understand without subtitles. **CurioListen turns the English content you choose into AI-assisted listening practice.**

Bring a YouTube video, podcast episode, or recording. Listen before reading, try dictation, and let AI explain the parts you missed. Build your own collection of useful expressions, with the original sentences and audio ready to revisit.

[Get started on your Mac](#get-started-on-your-mac) · [See it in action](#see-it-in-action) · [How it works](#how-it-works) · [FAQ](#common-questions) · [Report an issue](https://github.com/sissilolyx/curiolisten/issues)

Built for **Chinese-speaking English learners**. The app's interface and AI explanations are currently in Chinese. Runs locally on **macOS**.

![English listening workspace: original video, dictation, and AI sentence explanations in Chinese](docs/images/overview.png)

*Screenshots use fictional demo material. The current interface may differ.*

## Practice with content you actually want to understand

| Bring your own content | Make it a listening lesson |
| --- | --- |
| **YouTube videos and Shorts** | Work through interviews, talks, and real conversations one segment at a time. |
| **Apple Podcasts episodes** | Turn a long episode into shorter listening and dictation sessions. |
| **Your own audio or video** | Revisit difficult moments in recordings you are authorized to use. |
| **Feishu/Lark Minutes** | Practice with the original recording and its official transcript. |

## How it works

**Import → Listen → Dictate and compare → Understand → Review**

1. **Listen before reading.** Keep the transcript hidden and replay a natural segment. Optionally type what you heard.
2. **Find what you missed.** Reveal the transcript, compare your dictation, and replay the original sentence.
3. **Ask about the difficult part.** Get Chinese meanings, expression and grammar notes. Select text to ask a follow-up question in context.
4. **Remember it in context.** Save an expression for review with its source sentence and original audio.
5. **Continue where you stopped.** Your listening position, notes, review items, and study time stay on your Mac.

Local Whisper handles transcription. You can correct recognition errors and keep recurring word corrections as local hints for future transcriptions. AI explanations use your own **Codex or Cursor account** and its allowance.

## See it in action

<details>
<summary>Audio listening: keep playback controls visible while reading explanations</summary>

![Audio listening view with fixed playback controls and scrollable sentence explanations](docs/images/listen-only.png)

</details>

<details>
<summary>Understand an expression: expand the explanation and ask a follow-up</summary>

![Expression notes, examples, and separate AI question cards beside the original sentence](docs/images/ask-and-explain.png)

</details>

## Get started on your Mac

### Install with Codex or Cursor

If you already use Codex or Cursor on your Mac, paste this request into an assistant that can use your local terminal and browser:

> Install or update https://github.com/sissilolyx/curiolisten on my Mac and open the app. Read the installation-agent contract in README.md first. Reuse any existing installation and preserve its data. Run ./setup.command to check dependencies. Use only your corresponding AI provider and install missing required tools from official sources with any necessary system approval. Start the official browser login if needed and recheck after I finish. Let me choose from my account's available models. Do not read, delete, clean, modify, or upload .data/ or .models/. Never request or read tokens, and do not run quota-consuming AI connection tests.

Setup includes system dependencies and a roughly **466 MB Whisper model** download. The assistant must operate on your own Mac; a cloud coding session cannot open your local materials.

### Install manually

With Git and Homebrew available on your Mac:

```bash
brew install node@22 ffmpeg whisper-cpp yt-dlp
git clone https://github.com/sissilolyx/curiolisten.git
cd curiolisten
./setup.command
npm run setup:model
./start.command
```

`setup.command` checks dependencies and reports anything missing; it does not install software. A missing-model warning is expected before the model download. `start.command` opens the app on an available local port. Keep its terminal window running; close it or press Control-C to stop.

For AI explanations, install and sign in to your own **Codex CLI or Cursor Agent CLI**, then choose the provider and model in the app. You only need one provider. Follow the official [Codex CLI](https://developers.openai.com/codex/cli) or [Cursor CLI](https://cursor.com/docs/cli/installation) instructions. The [中文安装指南](README.zh-CN.md#ai-讲解服务) includes login and troubleshooting steps. Local playback can start before AI is configured.

`yt-dlp` is needed for YouTube and Apple Podcasts imports. Feishu/Lark import separately needs your own signed-in `lark-cli`; both are optional if you only use local files. Required runtime: Node.js 22+, FFmpeg, whisper.cpp, and the local Whisper English model. Windows, Linux, and mobile are not verified.

### Try one short clip first

Import a short public video, a podcast episode, or a local English recording. Once transcription finishes, listen to one segment, reveal the text, explore one expression, and save it for review.

YouTube supports individual public videos and Shorts. Apple Podcasts needs an **episode share link containing `i=`**, rather than a show homepage. Link imports are limited to **four hours and 4 GB per item**. Private, paid-only, removed, and login-restricted content is unsupported; source availability and your network can also affect imports.

<details>
<summary>Installation-agent contract — read before installing or updating</summary>

<a id="给安装代理的执行契约"></a>

### Installation-agent contract

1. **Find an existing installation first.** Recognize both `sissilolyx/curiolisten` and the former `sissilolyx/meeting-listening-lab` Git remote, and reuse that directory. Run `./update.command` for updates; clone only when no installation exists. For older installations without the updater, follow the compatibility procedure in the [Chinese contract](README.zh-CN.md#给安装代理的执行契约).
2. **Never clean and reinstall.** Do not use destructive Git resets or clean commands, delete the installation, automatically stash changes, or replace it with a new clone. If public code has local modifications, stop and ask the user how to handle them.
3. **Keep private data untouched.** Do not read, edit, delete, copy, or upload `.data/` or `.models/` during installation or updates. These contain learning materials, transcripts, progress, review, questions, preferences, AI settings, and the Whisper model. Only the explicitly requested model setup may download its model into `.models/`.
4. **Check first, then complete authorized installation.** Run `./setup.command`. Reuse installed tools. Explain the official source, command, download size, and system changes for missing dependencies, obtain required system approvals, install, refresh PATH, and recheck. A Codex agent prepares Codex only; a Cursor agent prepares Cursor only. Do not silently install both providers.
5. **Start official login and recheck afterward.** Use the selected provider's official login flow. The user completes account choice, passwords, SSO, MFA, and browser or macOS approval. Never request, read, copy, or store tokens. After the user finishes, recheck login and available models.
6. **The user chooses the model.** Only Codex and Cursor are supported. Suggest the current agent's corresponding provider for a new setup, and let the user choose an available model in the conversation or app. Do not overwrite existing settings or silently switch providers.
7. **Do not spend AI quota for verification.** Read status and models from `GET /api/ai-settings` on the actual local server. After an explicit choice, save only `{provider, model}` with `PATCH /api/ai-settings`, then verify with GET. Do not call `/api/ai-settings/test` or trigger analysis or questions to test the installation.
8. **Open the actual local address.** Run `./start.command`, wait for the server, and open the printed `http://127.0.0.1:<port>/` address. Do not assume port 4173. Keep the server terminal running.

</details>

## Common questions

**How is this different from watching subtitles?**

Each session starts with listening before reading. Dictation helps you spot missed words, while AI explanations and saved expressions stay connected to the sentence and original audio.

**Is there an English interface?**

Not yet. The current interface and AI explanations are primarily in Chinese. This English guide makes the project easier to evaluate and install; it does not change the app's supported interface language. [完整中文说明](README.zh-CN.md).

**Is it free? Can I try it online?**

There is no software subscription charge. The source is available under a noncommercial license, and AI usage draws on your own provider account, whose limits and charges apply. This version runs locally on your Mac; there is no hosted app or installation-free demo.

**Does everything stay offline?**

Recordings and learning data are stored locally, and Whisper transcribes on your Mac. AI explanations and questions send the necessary text to your selected Codex or Cursor service; original audio and video are not sent to that AI service. Link imports contact the source platform. See [PRIVACY.md](PRIVACY.md) for the full data boundaries.

**Can I fix a wrong transcript or explanation?**

Transcription and AI explanations can be wrong. You can edit the transcript and keep recurring word corrections in local recognition memory. You can also ask follow-up questions about an explanation; AI output still needs your judgment.

## Updates and project status

The core listening workflow is usable. Review interactions and stability are still being refined. Feedback is welcome in [GitHub Issues](https://github.com/sissilolyx/curiolisten/issues); use fictional examples and remove personal content from screenshots and logs.

**Already using Meeting Listening Lab?** This is the same project, now called CurioListen. Keep your existing installation folder; there is no need to rename it or clone again. Your materials, progress, and browser preferences continue to use the same local storage. The old GitHub URL redirects here.

Update from your **existing installation directory**:

```bash
./update.command
```

The updater stops on local code changes or unsafe incoming files and accepts only fast-forward updates. It preserves `.data/` and `.models/`. Back up valuable materials separately before updating. Do not replace the installation with a new clone or use destructive Git cleanup. See the [Chinese update guide](README.zh-CN.md#更新代码而不丢学习数据) for backup and older-installation instructions.

## Development

```bash
npm run check
npm test
npm run check:privacy
```

Publish only code, public documentation, and fictional fixtures. Never commit recordings, transcripts, learning records, models, credentials, or local settings. Keep the server bound to `127.0.0.1`; it has no public authentication layer.

## License

[PolyForm Noncommercial 1.0.0](LICENSE). Source-available for noncommercial use under the license terms; commercial use requires separate permission. This is not an OSI open-source license.
