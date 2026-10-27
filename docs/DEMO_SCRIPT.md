# Field Notes — Demo run sheet (4–5 minutes)

Record the app on the iPhone 14 Pro in Expo Go, with the backend reachable over the same LAN. This run sheet is a recording plan, not evidence that the phone flows have already passed. Rehearse the actions first; show only results the team can reproduce. Use a test account and keep passwords, tokens, personal photos and private notes out of frame.

## Setup before recording

- Start PostgreSQL and the Gin API with Docker Compose. Set `EXPO_PUBLIC_API_URL` to the computer's LAN address and confirm `/health` responds.
- Start Metro with `npx.cmd expo start --lan`, open the project in Expo Go, and sign in with a disposable test account.
- Prepare one existing note with a location for the map/detail scenes. Confirm iPhone and computer can reach each other on the LAN.
- Keep a second test note ready to create offline. If airplane-mode recovery or any later action fails during rehearsal, fix it before recording; do not narrate it as successful.

## Timed recording

| Time | Show | Narration / proof |
|---|---|---|
| 0:00–0:20 | App title and iPhone running Expo Go | Introduce Field Notes as an offline-first journal for field observations. State that the demo is recorded on iPhone 14 Pro with Expo Go. |
| 0:20–0:50 | Sign-in and Notes screen | Sign in with the test account. Point out the note list, search, status filters and sync indicators. Do not show the password. |
| 0:50–1:30 | Create note | Add a short title/body, attach a sample photo and optional location. Save and show the detail page. Mention permissions only if the prompt and resulting behavior were rehearsed. |
| 1:30–2:10 | Offline capture and restart | Enable Airplane Mode, create another note, force-close/reopen the app, and show that the note remains queued locally. Keep the recording continuous enough to establish the sequence. |
| 2:10–2:40 | Restore network and sync | Disable Airplane Mode and show the note status change after synchronization. If showing backend evidence, use Docker logs or a database query with test data and redact account identifiers. |
| 2:40–3:20 | Search, detail and share link | Search/filter notes, open one detail and tap “Chia sẻ liên kết”. In Expo Go, show the `exp://.../--/notes/<id>` URL. With Metro running, open the shared URL and confirm the same note appears. |
| 3:20–4:05 | Map and export | Open the map and select a located note. Export a chosen date to CSV and show the share sheet or resulting file. Skip either action if it has not been verified on the iPhone. |
| 4:05–4:35 | Theme and motion | Switch light/dark/system appearance and show the note-card press effect. Mention reduced-motion behavior only if it was checked on the phone. |
| 4:35–4:55 | Architecture and close | Summarize Expo/React Native, SQLite offline queue, Gin/JWT API and PostgreSQL. End with the tested scope and name any untested feature accurately. |

## Rehearsal record

Before filming, record the date, Expo Go version, app commit/tag, API URL mode (LAN; do not record credentials), and pass/fail for each scene. The `fieldnotes://` custom scheme is for an installed native app; use the Expo Go development URL during this recording. Keep the raw take until the team confirms the final video length is 3–5 minutes.
