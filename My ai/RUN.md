# Run Nova

Run Nova with the local server.

1. Open PowerShell in this folder.
2. Add your API key to `api.env`.

For NVIDIA:

```text
API_KEY=your_nvidia_key_here
AI_PROVIDER=nvidia
AI_MODEL=nvidia/llama-3.3-nemotron-super-49b-v1.5
```

For GitHub Models:

```text
API_KEY=your_github_pat_here
AI_PROVIDER=github
AI_MODEL=openai/gpt-4.1
```

For Groq:

```text
API_KEY=your_groq_key_here
AI_PROVIDER=groq
AI_MODEL=llama-3.1-8b-instant
```

3. Start the app:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-chat.ps1
```

4. Open:

```text
http://localhost:3000
```

Press `Ctrl+C` in PowerShell to stop the server.
