# Play your own audio stream on Amazon Echo

A step-by-step guide to playing a **private audio stream from your home network** on your Amazon Echo devices, using:

- a small **Alexa skill** that you write yourself (free, Alexa-hosted, never published), and
- a **Synology NAS** as the secure HTTPS front door, with a free Let's Encrypt certificate.

> "Alexa, open home radio" → your Echo plays your stream.

Read the write-up on [my website](https://www.matthews.casa/play-your-own-audio-stream-on-amazon-echo/), and find more home projects at [matthews.casa](https://www.matthews.casa/).

The stream itself can come from anything that serves MP3 or AAC over HTTP on your network — an Icecast server, a media server, a Raspberry Pi, a PC app. This guide doesn't care what makes the audio; it gets that audio safely to your Echos.

---

## How it fits together

```
 Your stream source           Synology NAS                    Amazon Echo
 (any PC / Pi / server) ◄──── reverse proxy (HTTPS, 443) ◄─── plays the URL that
  http://192.168.1.50:8000     radio.yourname.synology.me      your skill hands it
        plain HTTP              Let's Encrypt certificate
                                         ▲
                                         │ "Alexa, open home radio"
                                 Your Alexa skill (Alexa-hosted)
                                 replies: play https://radio.yourname.synology.me/stream?key=...
```

The Echo fetches the audio **itself**, straight from the URL the skill gives it. Alexa insists that URL is:

- **HTTPS on port 443**, with a **trusted certificate** (self-signed won't work),
- reachable from the internet,
- MP3, AAC/MP4, HLS, PLS or M3U.

Most home stream sources are plain HTTP on some odd port, which is why the Synology sits in the middle.

---

## What you need

| | |
|---|---|
| A stream on your network | Something like `http://192.168.1.50:8000/stream` that plays in VLC on another device. MP3 at 128–192 kbps is ideal. |
| A Synology NAS on DSM 7 | With a `synology.me` DDNS address (or your own domain pointing at your home). |
| Router access | To forward ports **443** and **80** to the NAS. |
| An Amazon Developer account | Free — sign in at [developer.amazon.com](https://developer.amazon.com/alexa/console/ask) with **the same Amazon account as your Echos**. |

**Strongly recommended:** protect the stream with a secret key in the URL (e.g. `?key=k7Qm2xVp9Lr4`), because it is about to be reachable from the internet. Many stream servers support a password or token; if yours doesn't, put it on an obscure path at least. Use **letters and numbers only** in the key — characters like `+ & # %` get mangled in URLs.

---

## Part 1 — Synology: give the stream an HTTPS address

### 1.1 Pick an address

If your Synology address is `yourname.synology.me`, sub-addresses such as `radio.yourname.synology.me` already point at your home too. Check with:

```
nslookup radio.yourname.synology.me
```

It should return the same IP as `yourname.synology.me`.

> Set up DDNS first if you haven't: **Control Panel → External Access → DDNS → Add**, provider *Synology*.

### 1.2 Forward ports on your router

Forward to the NAS's local IP address:

| Port | Why |
|---|---|
| **TCP 443** | HTTPS — the stream itself |
| **TCP 80** | Let's Encrypt checks it when issuing and renewing the certificate |

Give the NAS **and** the stream source fixed IP addresses (DHCP reservations on your router), so nothing moves.

### 1.3 Create the reverse proxy rule

**Control Panel → Login Portal → Advanced → Reverse Proxy → Create**

| | Protocol | Hostname | Port |
|---|---|---|---|
| **Source** | HTTPS | `radio.yourname.synology.me` | 443 |
| **Destination** | HTTP | your stream source's IP, e.g. `192.168.1.50` | e.g. `8000` |

Leave **Access control profile** as *Not configured* — if it's set to a local-only profile, the stream will work at home and fail from outside (and on the Echo).

### 1.4 Get a Let's Encrypt certificate for that address

**Control Panel → Security → Certificate → Add → Add a new certificate → Get a certificate from Let's Encrypt**

- **Domain name:** `radio.yourname.synology.me`
- **Email:** yours
- **Subject Alternative Name:** leave blank

Then **Settings** (same page) → find `radio.yourname.synology.me` in the list → choose the new certificate → **OK**.

> **Check the certificate list carefully.** The Synology's built-in `synology.com` certificate is **self-signed**. If a service is assigned to it, browsers warn and Alexa refuses to play. Each entry in **Settings** should point at your Let's Encrypt certificate (DSM sometimes shows the issuer as a short code rather than "Let's Encrypt" — what matters is that it isn't the self-signed one).

### 1.5 Test from outside your home

On your phone, **turn Wi-Fi off** and open:

```
https://radio.yourname.synology.me/stream?key=YOUR-KEY
```

You want a padlock, no warning, and audio. Don't move on until this works — the Echo needs exactly the same thing.

---

## Part 2 — The Alexa skill

The skill is tiny: when you say "Alexa, open home radio", it replies with an instruction to play your URL. Pause, resume and stop are handled too.

The code is in the [`skill`](skill) folder:

- [`skill/index.js`](skill/index.js) — the skill code (Node.js)
- [`skill/interaction-model.json`](skill/interaction-model.json) — the phrases it listens for

### 2.1 Create the skill

At [developer.amazon.com/alexa/console/ask](https://developer.amazon.com/alexa/console/ask) → **Create Skill**:

| Setting | Choose |
|---|---|
| Name | anything, e.g. *Home Radio* |
| Primary locale | the language **your Echos are set to** — e.g. *English (UK)* |
| Type of experience | Music & Audio |
| Model | **Custom** |
| Hosting | **Alexa-hosted (Node.js)** — pick the region nearest you (e.g. EU (Ireland)) |
| Template | Start from scratch |

### 2.2 Switch on the Audio Player

**Build → Interfaces → Audio Player: on → Save.**
Without this the Echo can't play audio from your skill.

### 2.3 Paste the interaction model

**Build → Interaction Model → JSON Editor** → replace everything with [`interaction-model.json`](skill/interaction-model.json) → **Save** → **Build skill**.

To change what you say, edit `"invocationName"`. Rules: lower case, at least two words, no "the/a/an" or prepositions, no "alexa", "echo", "skill" or "app". Pick something **easy to pronounce** — if Alexa mishears it, nothing happens.

### 2.4 Paste the code

**Code → index.js** → replace everything with [`index.js`](skill/index.js), then change the two lines at the top:

```js
const STREAM_URL = 'https://radio.yourname.synology.me/stream?key=YOUR-KEY';
const STATION_NAME = 'Home Radio';
```

**Save → Deploy.**

### 2.5 Enable testing

**Test** tab → change *Off* to **Development**. The skill now works on every Echo registered to your Amazon account. You never need to publish it.

### 2.6 Try it

| Say | Does |
|---|---|
| "Alexa, open home radio" | starts the stream |
| "Alexa, ask home radio to play" | starts the stream |
| "Alexa, pause" / "Alexa, stop" | stops |
| "Alexa, resume" | starts again — it's live, so it picks up wherever the stream is now |

---

## Optional extras

### Say whatever you like — with a Routine

Invocation names can't be "the radio". A Routine gets round that:
**Alexa app → More → Routines → +** → *When this happens*: **Voice** → `put the radio on` → *Add action*: **Customised** → `open home radio` → **Save**.

### Play on several Echos at once

Custom skills can't target a speaker group by voice ("…on Everywhere" won't work). The workaround is a room's **Preferred Speakers**:

1. Alexa app → **Devices** → **Groups: See all** → the room your main Echo is in.
2. **Preferred Speakers → Change** → tick the speakers → **Next**.
3. **Playback options → Always** → **Next**.

Asking that Echo to open the skill then plays on the chosen speakers. (Radio stations that support "…on Everywhere" do so through TuneIn/Radioplayer or Amazon's Radio Skills Kit, which are for licensed broadcasters only.)

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Echo: *"I don't know how to help with that"*, but typing works on the **Test** page | Alexa is mishearing the name — check **Alexa app → Settings → Alexa Privacy → Review Voice History** and pick an easier invocation name. Also check the Echo's **Language** matches the skill's locale, and that the skill appears under **Alexa app → Skills & Games → Your Skills → Dev**. |
| Echo says the intro, then silence | Look in **Code → CloudWatch Logs** for `AudioPlayer.PlaybackFailed` (the sample code logs it as `Problem:`). |
| `MEDIA_ERROR_INVALID_REQUEST` | The URL was refused (401/403/404). Check the key, the path, the reverse proxy's access control profile — and give a brand-new certificate or rule a few minutes to settle. |
| `MEDIA_ERROR_SERVICE_UNAVAILABLE` | The NAS couldn't reach the stream source, or the source is off. |
| Works on home Wi-Fi, not on mobile data | Port 443 isn't forwarded to the NAS, the access control profile is local-only, or the Synology firewall only allows your LAN. |
| Certificate warning | The address is still assigned to the self-signed `synology.com` certificate — fix it in **Certificate → Settings**. |
| Is the skill the problem or the stream? | Temporarily point `STREAM_URL` at a known public HTTPS radio stream. If that plays, the skill is fine and the problem is on the stream/Synology side. |

---

## Good to know

- **Keep it private.** A development skill only works on your own account. Don't publish a skill (or list a station) that streams commercial music to the public — that needs broadcast licences (in the UK, PPL and PRS for Music).
- **Delay.** Live streams on Echo typically run 10–30 seconds behind the source.
- **Bandwidth.** 192 kbps is about 85 MB per hour per Echo, out through your home upload.

## Licence

[MIT](LICENSE) — use and adapt freely.
