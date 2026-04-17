# Channels

IntraClaw talks to you wherever you already are. One agent, one brain, many
surfaces — all six adapters speak the same `ChannelAdapter` interface
(`src/channels/types.ts`) and funnel through a single `Gateway`
(`src/channels/gateway.ts`).

## Supported channels

| Channel  | Module                         | Status       | Transport                    |
| -------- | ------------------------------ | ------------ | ---------------------------- |
| Telegram | `src/channels/telegram.ts`     | stable       | Long-polling (grammy)        |
| Discord  | `src/channels/discord.ts`      | stable       | REST + Gateway WebSocket     |
| Slack    | `src/channels/slack.ts`        | beta         | REST + Events API webhooks   |
| WhatsApp | `src/channels/whatsapp.ts`     | beta         | Twilio REST + webhook        |
| SMS      | `src/channels/sms.ts`          | beta         | Twilio REST + webhook        |
| Email    | `src/channels/email-channel.ts`| experimental | IMAP poll + SMTP             |

Every adapter **degrades gracefully**: if its env vars are missing, it logs
a warning and stays disabled. You enable only what you need.

## Environment variables

### Telegram
```bash
TELEGRAM_BOT_TOKEN=123456:ABC...         # from @BotFather
TELEGRAM_ALLOWED_USER_ID=12345678        # your numeric Telegram user id
```

### Discord
```bash
DISCORD_BOT_TOKEN=...                    # bot application token
DISCORD_AUTHORIZED_USERS=111,222         # comma-separated user IDs (empty = deny all)
DISCORD_NOTIFICATION_CHANNEL=...         # optional, for broadcasts
```

### Slack
```bash
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...                 # verifies Events API requests
SLACK_AUTHORIZED_USERS=U0123,U0456
SLACK_NOTIFICATION_CHANNEL=C0123
```
Point Slack's Events API at `POST /webhooks/slack/events` and slash commands
at `POST /webhooks/slack/commands`.

### WhatsApp (via Twilio)
```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
WHATSAPP_AUTHORIZED_NUMBERS=+32470123456
```
Webhook: `POST /webhooks/whatsapp/incoming`.

### SMS (via Twilio)
```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=...
TWILIO_SMS_FROM=+14155551212
SMS_AUTHORIZED_NUMBERS=+32470123456
```
Webhook: `POST /webhooks/sms/incoming`.

### Email
```bash
EMAIL_IMAP_HOST=imap.gmail.com
EMAIL_IMAP_USER=you@example.com
EMAIL_IMAP_PASS=app-password
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_AUTHORIZED_SENDERS=you@example.com
EMAIL_POLL_INTERVAL_MS=60000
```

## Unified gateway pattern

All inbound messages are normalized to a `UniversalMessage` — same shape
regardless of origin — and dispatched to one global handler registered via
`setMessageHandler()`. The gateway also handles:

- per-channel message length limits (Telegram 4096, Discord 2000, SMS 1600, …)
  with automatic chunking on newlines
- `broadcastToAll()` for morning briefs and alerts
- conversation history persistence per `(channelId, senderId)` pair

## Auth model

**Default-deny whitelist**, per channel. The whitelist lives in
`data/sessions/authorized-users.json` (managed via `session-store.ts`). An
empty list means the channel is locked — no message is processed until a
sender is explicitly added. This prevents accidental public exposure of a
freshly deployed bot. Per-channel env vars (`*_AUTHORIZED_USERS`) are
layered on top as a second guard, checked inside each adapter before it
even hands the message to the gateway.

## Adding a new channel

Implement `ChannelAdapter` from `src/channels/types.ts`:

```ts
export class MyAdapter implements ChannelAdapter {
  readonly channelId = 'mychannel' as const;

  async init(): Promise<void> { /* connect */ }
  async send(recipientId: string, text: string, opts?: SendOptions): Promise<void> { /* send */ }
  onMessage(handler: (msg: UniversalMessage) => Promise<void>): void { /* wire inbound */ }
  isReady(): boolean { return this._ready; }
  async destroy?(): Promise<void> { /* cleanup */ }
}
```

Then register it in `src/channels/init-channels.ts`:

```ts
if (MyAdapter.isAvailable()) registerAdapter(new MyAdapter());
```

That's it — the gateway handles auth, history, length splitting, and
routing to the global message handler automatically.
