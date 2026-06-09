$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$EnvFile = Join-Path $Root "api.env"

if (Test-Path $EnvFile) {
  Get-Content $EnvFile | ForEach-Object {
    $Line = $_.Trim()

    if ($Line -and -not $Line.StartsWith("#") -and $Line.Contains("=")) {
      $Parts = $Line.Split("=", 2)
      $Name = $Parts[0].Trim()
      $Value = $Parts[1].Trim().Trim('"').Trim("'")

      if ($Name) {
        [System.Environment]::SetEnvironmentVariable($Name, $Value, "Process")
      }
    }
  }
}

$Port = if ($env:PORT) { [int]$env:PORT } else { 3000 }
$ApiKey = if ($env:API_KEY) { $env:API_KEY } elseif ($env:GITHUB_TOKEN) { $env:GITHUB_TOKEN } elseif ($env:NVIDIA_API_KEY) { $env:NVIDIA_API_KEY } else { $env:GROQ_API_KEY }
$Provider = if ($env:AI_PROVIDER) {
  $env:AI_PROVIDER.ToLower()
} elseif ($ApiKey -like "github_pat_*") {
  "github"
} elseif ($ApiKey -like "nvapi-*") {
  "nvidia"
} else {
  "groq"
}
$Model = if ($env:AI_MODEL) {
  $env:AI_MODEL
} elseif ($env:GITHUB_MODEL) {
  $env:GITHUB_MODEL
} elseif ($env:NVIDIA_MODEL) {
  $env:NVIDIA_MODEL
} elseif ($env:GROQ_MODEL) {
  $env:GROQ_MODEL
} elseif ($Provider -eq "github") {
  "openai/gpt-4.1"
} elseif ($Provider -eq "nvidia") {
  "nvidia/llama-3.3-nemotron-super-49b-v1.5"
} else {
  "llama-3.1-8b-instant"
}
$ChatEndpoint = if ($Provider -eq "github") {
  "https://models.github.ai/inference/chat/completions"
} elseif ($Provider -eq "nvidia") {
  "https://integrate.api.nvidia.com/v1/chat/completions"
} else {
  "https://api.groq.com/openai/v1/chat/completions"
}
$SystemPrompt = "You are Nova, a clear and helpful AI assistant. Your name is Nova only. Use the requested tone. Answer like a polished ChatGPT-style assistant: conversational, interactive, neatly spaced, and easy to scan. Use short paragraphs and bullets when helpful. Use actual native Unicode emoji characters only, so the user's operating system can render them. Never write emoji names, emoji shortcodes like :smile:, HTML entities, replacement boxes, or mojibake text like broken emoji gibberish. When the user sends emojis, mirror a small number of those same emojis when they fit naturally. Include 1 to 3 relevant emojis in most friendly answers, especially in greetings, summaries, encouragement, lists, or follow-up questions. Do not spam emojis. Ask a useful follow-up question when the user might want to continue. If you use or know reliable source URLs, include them as Markdown links near the relevant claims or in a short Sources section. Do not invent sources. If you do not have source links, answer normally without fake citations."
$Prefix = "http://localhost:$Port/"

$MimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
}

function Send-Text {
  param (
    [System.Net.HttpListenerContext]$Context,
    [int]$StatusCode,
    [string]$ContentType,
    [string]$Text
  )

  $Bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  $Context.Response.StatusCode = $StatusCode
  $Context.Response.ContentType = $ContentType
  $Context.Response.ContentLength64 = $Bytes.Length
  $Context.Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
  $Context.Response.Close()
}

function Send-Json {
  param (
    [System.Net.HttpListenerContext]$Context,
    [int]$StatusCode,
    [object]$Data
  )

  Send-Text $Context $StatusCode "application/json; charset=utf-8" ($Data | ConvertTo-Json -Depth 20)
}

function Read-RequestJson {
  param ([System.Net.HttpListenerRequest]$Request)

  $Reader = [System.IO.StreamReader]::new($Request.InputStream, $Request.ContentEncoding)
  try {
    $Body = $Reader.ReadToEnd()
  }
  finally {
    $Reader.Close()
  }

  if ([string]::IsNullOrWhiteSpace($Body)) {
    return @{}
  }

  return $Body | ConvertFrom-Json
}

function Handle-Chat {
  param ([System.Net.HttpListenerContext]$Context)

  if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    Send-Json $Context 500 @{
      error = "Missing API key. Add API_KEY=your_key_here to api.env, then restart the app."
    }
    return
  }

  try {
    $Body = Read-RequestJson $Context.Request
    $Tone = if ($Body.tone) { [string]$Body.tone } else { "Simple" }
    $Messages = @()

    if ($Body.messages) {
      $Messages = @($Body.messages) | Select-Object -Last 16 | ForEach-Object {
        @{
          role = if ($_.role -eq "assistant") { "assistant" } else { "user" }
          content = ([string]$_.content).Substring(0, [Math]::Min(([string]$_.content).Length, 8000))
        }
      }
    }

    $Payload = @{
      model = $Model
      temperature = 0.7
      max_tokens = 1200
      messages = @(
        @{
          role = "system"
          content = "$SystemPrompt Current tone: $($Tone.ToLower())."
        }
      ) + $Messages
    }

    $Headers = @{
      Authorization = "Bearer $ApiKey"
    }

    if ($Provider -eq "github") {
      $Headers["Accept"] = "application/vnd.github+json"
      $Headers["X-GitHub-Api-Version"] = "2026-03-10"
    }

    $AiResponse = Invoke-RestMethod `
      -Uri $ChatEndpoint `
      -Method Post `
      -Headers $Headers `
      -ContentType "application/json" `
      -Body ($Payload | ConvertTo-Json -Depth 20)

    Send-Json $Context 200 @{
      reply = $AiResponse.choices[0].message.content
    }
  }
  catch {
    Send-Json $Context 500 @{
      error = $_.Exception.Message
    }
  }
}

function Serve-Static {
  param ([System.Net.HttpListenerContext]$Context)

  $RequestPath = $Context.Request.Url.AbsolutePath
  if ($RequestPath -eq "/") {
    $RequestPath = "/index.html"
  }

  $RelativePath = [System.Uri]::UnescapeDataString($RequestPath.TrimStart("/"))
  $FilePath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($Root, $RelativePath))
  $RootPath = [System.IO.Path]::GetFullPath($Root)

  if (-not $FilePath.StartsWith($RootPath, [System.StringComparison]::OrdinalIgnoreCase)) {
    Send-Text $Context 403 "text/plain; charset=utf-8" "Forbidden"
    return
  }

  if (-not [System.IO.File]::Exists($FilePath)) {
    Send-Text $Context 404 "text/plain; charset=utf-8" "Not found"
    return
  }

  $Extension = [System.IO.Path]::GetExtension($FilePath)
  $ContentType = if ($MimeTypes.ContainsKey($Extension)) { $MimeTypes[$Extension] } else { "application/octet-stream" }
  $Bytes = [System.IO.File]::ReadAllBytes($FilePath)

  $Context.Response.StatusCode = 200
  $Context.Response.ContentType = $ContentType
  $Context.Response.ContentLength64 = $Bytes.Length
  $Context.Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
  $Context.Response.Close()
}

$Listener = [System.Net.HttpListener]::new()
$Listener.Prefixes.Add($Prefix)

try {
  $Listener.Start()
  Write-Host "Nova is running at $Prefix"
  Write-Host "Provider: $Provider"
  Write-Host "Model: $Model"
  Write-Host "Press Ctrl+C to stop."

  while ($Listener.IsListening) {
    $Context = $Listener.GetContext()

    if ($Context.Request.HttpMethod -eq "POST" -and $Context.Request.Url.AbsolutePath -eq "/api/chat") {
      Handle-Chat $Context
    }
    elseif ($Context.Request.HttpMethod -eq "GET") {
      Serve-Static $Context
    }
    else {
      Send-Text $Context 405 "text/plain; charset=utf-8" "Method not allowed"
    }
  }
}
finally {
  if ($Listener.IsListening) {
    $Listener.Stop()
  }
  $Listener.Close()
}
