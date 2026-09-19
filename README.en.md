# AI English Listening Practice · 原声精听

**Turn the videos, podcasts, and conversations you want to understand into English you can practice.**

Meeting Listening Lab is a local macOS app for intensive listening: play the original audio, try dictation, reveal the transcript, ask AI about a sentence, and save useful expressions for review.

[中文](README.md) · [Get started](#get-started-on-your-mac) · [Privacy](PRIVACY.md) · [Report an issue](https://github.com/sissilolyx/meeting-listening-lab/issues)

The interface and explanations are primarily in Chinese, for learners practicing English. The source is available for noncommercial use. AI explanations use your own Codex or Cursor account and its allowance.

![AI English listening workspace with original video, dictation, and sentence explanations; fictional demo material](docs/images/overview.png)

*Screenshots use fictional demo content. The current interface may differ.*

## Practice with content you care about

| Start with | Practice |
| --- | --- |
| A public YouTube video or Short | Listen closely to interviews, talks, and real conversations. |
| A public Apple Podcasts episode | Work through a longer episode in manageable segments. |
| A local recording or screen recording | Revisit difficult moments in audio you are authorized to use. |
| Your Feishu/Lark Minutes | Practice with the original voices and official transcript. |

The learning flow is simple: **import → listen → dictate and compare → understand → review**.

- **Original audio throughout.** Replay natural segments or individual sentences. Audio is never replaced with generated speech.
- **Listen before reading.** Keep the transcript hidden, optionally type what you heard, then reveal and compare.
- **AI explanations in context.** Get Chinese meanings, expression and grammar notes, and ask follow-up questions about selected text.
- **Review the exact sentence.** Save a useful expression with its source sentence and audio.
- **Pick up where you left off.** Keep listening progress, notes, study time, and your last position locally.
- **Correct recognition mistakes.** Edit the transcript and keep recurring corrections in local recognition memory.

## Get started on your Mac

### Ask a local coding assistant to install it

Send this repository link to Codex or Cursor running on your Mac with terminal and browser access:

> Install or update https://github.com/sissilolyx/meeting-listening-lab on my Mac and open the local app. First read the installation-agent contract in README.md in full. Reuse any existing installation and preserve its data. Run ./setup.command to check dependencies. Use only your corresponding AI provider, reuse an existing CLI installation, and install missing required tools from their official sources with any necessary system approval. Start the official browser login if needed, then recheck after I finish. Let me choose from my account's available models. Do not read, delete, clean, modify, or upload .data/ or .models/. Never request or read tokens, and do not run quota-consuming AI connection tests.

This requires an assistant operating on your own computer. A cloud coding session cannot open your local materials. Initial setup includes system dependencies and a roughly 466 MB Whisper model download.

### Install manually

Requirements: macOS, Git, Node.js 22+, FFmpeg, whisper.cpp (`whisper-cli`), and the local Whisper English model. Only macOS has been verified.

With Homebrew already installed:

```bash
brew install node@22 ffmpeg whisper-cpp
git clone https://github.com/sissilolyx/meeting-listening-lab.git
cd meeting-listening-lab
./setup.command
npm run setup:model
./start.command
```

`setup.command` checks the environment and reports missing dependencies. `start.command` selects an available loopback port and opens the app; keep its terminal window running. Close that window or press Control-C to stop.

For YouTube and Apple Podcasts imports, also install the optional downloader:

```bash
brew install yt-dlp
```

For AI explanations, install and sign in to your own **Codex CLI or Cursor Agent CLI**, then choose the provider and model in the app. See the [AI setup guide](README.md#ai-讲解服务) for official installation and login links. You only need one provider; the app does not silently switch accounts or providers. Local playback can start before AI is configured.

Feishu/Lark import separately requires your own signed-in `lark-cli`; it is optional.

### Your first practice session

1. Start with a short public video, a public podcast episode, or a local English recording.
2. Wait for downloading and local transcription to finish.
3. Listen to one segment with the text hidden. Type what you heard if you want dictation practice.
4. Reveal the transcript, compare, and read the explanation. Select an expression to ask a follow-up question.
5. Save one useful expression for review and continue when you are ready.

YouTube imports accept individual public videos and Shorts. Apple Podcasts imports require an **episode** share link containing `i=`, rather than a show homepage. Link imports are limited to four hours and 4 GB per item; private, paid-only, removed, and login-restricted content is unsupported. Availability also depends on the source platform and your network.

## Common questions

**How is this different from watching subtitles?**

The practice starts with listening, before revealing text. Dictation helps you identify missed words; explanations and review stay connected to the original sentence and audio.

**What does AI do?**

Whisper transcribes audio locally. Your selected Codex or Cursor account generates explanations and answers questions from the required text context. Transcription and explanations can be wrong; you can correct the transcript.

**Is it free? Is there an online demo?**

The project does not charge a software subscription and provides its source under a noncommercial license. AI usage draws on your own provider account, whose limits and charges apply. This version runs on your Mac in a local browser; there is no hosted app or installation-free demo. Windows, Linux, and mobile are not verified.

**Does everything stay offline?**

Original recordings, transcripts, progress, and review history are stored locally. Original audio and video are not sent to the AI provider. Requested AI explanations and questions send the necessary text to the provider you choose, so those features require an external service. Link imports contact the source platform. See [PRIVACY.md](PRIVACY.md).

## Updates and project status

The core intensive-listening flow is usable. Review interactions and stability are still being refined. Bug reports and suggestions are welcome in [GitHub Issues](https://github.com/sissilolyx/meeting-listening-lab/issues); use fictional examples and remove personal content from screenshots and logs.

Update from the **existing installation directory**:

```bash
./update.command
```

The updater checks for local code changes and unsafe incoming files, then accepts only a fast-forward update. It preserves `.data/` and `.models/`. Back up valuable materials separately before updating; do not use destructive Git cleanup or replace the installation with a fresh clone. The [Chinese guide](README.md#更新代码而不丢学习数据) covers backups and older installations.

## Development

```bash
npm run check
npm test
npm run check:privacy
```

Publish only code, public documentation, and fictional fixtures. Never commit recordings, transcripts, learning records, models, credentials, or local settings. Keep the server bound to `127.0.0.1`; it is designed for local use and has no public authentication layer.

## License

[PolyForm Noncommercial 1.0.0](LICENSE). Source-available for noncommercial use under the license terms; commercial use requires separate permission. This is not an OSI open-source license.
