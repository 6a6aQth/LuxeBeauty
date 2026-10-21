# Africa's Talking SMS sandbox

How to prove the sandbox key works, then how that result plugs into this app. The key stays in `.env.local` as `AFRICAS_TALKING_API_KEY`. Do not paste it into this file, a commit, or chat.

Sources used for the steps below:

- [How do I get started on the Africa's Talking Sandbox?](https://help.africastalking.com/en/articles/1170660-how-do-i-get-started-on-the-africa-s-talking-sandbox)
- [What is my Username and API Key?](http://help.africastalking.com/quick-guide-to-africa-s-talking/what-is-my-username-and-api-key) — on sandbox, the username is always `sandbox`
- [Africa's Talking Node.js SDK](https://github.com/AfricasTalkingLtd/africastalking-node.js) — username `sandbox` selects the test environment
- Sandbox send host `https://api.sandbox.africastalking.com/version1/messaging`, from the [API endpoints list](https://africastalkingltd.gitbooks.io/mobile-communication-apis/content/downloads.html)

## Do we need localhost:3000?

No, not for the first test.

Sending an SMS is an outbound call from this machine to Africa's Talking. Their servers do not call back for that request, so the Next.js site does not have to be running, and it does not have to be public.

`localhost:3000` is the wrong first step for another reason. Confirmation SMS is still Twilio:

- `lib/sms.ts` reads `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER`.
- `lib/confirm-booking.ts` calls `sendBookingSMS` after a booking is marked successful.
- `package.json` depends on `twilio`. The `africastalking` package is not installed.
- `AFRICAS_TALKING_API_KEY` is already in `.env.local`, and nothing reads it.

A paid booking on `localhost:3000` would try Twilio. It would not exercise the sandbox key.

A public URL (ngrok or a deployed host) is only needed later, and only if we want Africa's Talking to POST delivery reports or inbound replies to this app. Outbound send does not need that.

## What sandbox does and does not do

| Fact | Detail |
| --- | --- |
| Dashboard | [account.africastalking.com/apps/sandbox](https://account.africastalking.com/apps/sandbox) |
| Username | Always the literal string `sandbox`. A live app username will fail against a sandbox key. |
| API key | Generated under the sandbox app. It is a different key from any live app. |
| Send URL | `POST https://api.sandbox.africastalking.com/version1/messaging` |
| Body | `application/x-www-form-urlencoded`, not JSON |
| Auth header | `apiKey: <sandbox key>` |
| Phone | International form with a leading `+`, for example `+265991234567` |
| Handset | Sandbox does not deliver to a real TNM or Airtel phone, and it does not charge. |
| Where to look | The JSON response, then SMS → Outbox on the sandbox dashboard. The phone simulator is for two-way short codes and USSD, not for this first send. |

The Node SDK picks the sandbox host itself when `username` is `sandbox`. A raw `curl` must use the sandbox host explicitly.

## 1. Confirm the key belongs to sandbox

1. Open [the sandbox apps page](https://account.africastalking.com/apps/sandbox) and sign in.
2. Open the sandbox app. The username shown for API calls is `sandbox`.
3. Settings → API Key. The value already stored as `AFRICAS_TALKING_API_KEY` should be a key from this screen. Sandbox keys are shown once at creation; if this one was copied into chat, generate a replacement here and update `.env.local`.
4. Check the sandbox SMS balance. A zero balance comes back as `InsufficientBalance` (`statusCode` 405) even in sandbox.

Optional, and not required for a one-way confirmation text: create a sandbox short code if you later want replies. Those replies are handled in the simulator at [simulator.africastalking.com:1517](https://simulator.africastalking.com:1517/), and the number you register there must match the number in the request. Africa's Talking says those interactions happen in the simulator, not on a handset.

## 2. Send one message from the terminal

From the project root, with `.env.local` loaded, send to a Malawi number in the same shape this app already stores (`+265` plus 9 digits). Replace the number. Leave `from` off for this first call so a missing sender ID cannot hide an auth or number problem.

```bash
set -a
source .env.local
set +a

curl -sS -X POST "https://api.sandbox.africastalking.com/version1/messaging" \
  -H "Accept: application/json" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "apiKey: ${AFRICAS_TALKING_API_KEY}" \
  --data-urlencode "username=sandbox" \
  --data-urlencode "to=+2659XXXXXXXX" \
  --data-urlencode "message=Lauryn Luxe sandbox test"
```

HTTP 200 is not enough. Africa's Talking returns 200 and then reports each recipient inside `SMSMessageData.Recipients`.

A accepted send looks like this:

```json
{
  "SMSMessageData": {
    "Message": "Sent to 1/1 Total Cost: ...",
    "Recipients": [
      {
        "statusCode": 101,
        "number": "+2659XXXXXXXX",
        "status": "Success",
        "cost": "...",
        "messageId": "ATXid_..."
      }
    ]
  }
}
```

`100` means processed, `101` means sent, `102` means queued. Any of those three means the sandbox accepted the message. Then open the sandbox dashboard and check SMS → Outbox for that `messageId`. The real phone will stay quiet. That is the expected sandbox result.

## 3. Read a rejection before changing the app

| statusCode | status | What to fix |
| --- | --- | --- |
| 401 | RiskHold | The message was held. Check the dashboard, do not retry in a loop. |
| 402 | InvalidSenderId | The `from` value is not registered on this app. Omit `from` for the first test. |
| 403 | InvalidPhoneNumber | The number is not `+` plus country code and subscriber number. `099…` and `265…` without `+` fail here. |
| 405 | InsufficientBalance | Top up the sandbox wallet, or confirm you are on the sandbox app. |
| 406 | UserInBlacklist | That number has opted out of the sender. |
| 407 | CouldNotRoute | The sandbox could not route that destination. Try another `+265` number, then check the outbox. |
| 500+ | Internal / account errors | Auth, suspended app, or an outage. Confirm the header is `apiKey` and the username is exactly `sandbox`. |

An HTML or `401`/`403` at the HTTP layer, before `SMSMessageData`, means the key or host is wrong: sandbox key on `api.africastalking.com`, or a live key on `api.sandbox.africastalking.com`.

Two body rules that cause empty or `400` results: send form fields, not `JSON.stringify`, and do not put a raw `%` in `message` (encode it, or avoid it). The studio confirmation text does not need `%`.

## 4. Only then run it through the site

After step 2 returns `101` and the outbox shows the message:

1. Add `africastalking`.
2. Add `AFRICAS_TALKING_USERNAME=sandbox` next to the existing key. The SDK uses that username to choose the sandbox host.
3. Change `sendBookingSMS` in `lib/sms.ts` so it calls `AfricasTalking.SMS.send({ to, message })` and throws unless `Recipients[0].statusCode` is 100, 101, or 102. Keep the same function signature. `confirm-booking.ts` already treats a throw as a logged SMS failure and still leaves the booking successful.
4. Pass the stored booking phone. `canonicalPhone` in `lib/phone.ts` already produces `+265` plus 9 digits, which is the form the API wants.
5. Start the app on `localhost:3000` and complete one sandbox PayChangu payment so `confirmPaidBooking` runs. Watch the server log for `sms_sent` / `sent`, and match `messageId` in the Africa's Talking outbox.

That is the point at which `localhost:3000` matters. It tests the booking path, not the carrier.

Skip a sender ID until the no-`from` call works. If a later call returns `402`, register a sandbox sender (people often use a short alphanumeric such as `Sandbox`) and pass it as `senderId` / `from`. A live Malawi sender ID is a separate product request on the live app. Africa's Talking lists Malawi for SMS, and a dedicated sender is approved with the networks. The shared default sender is not a Malawi production sender. Approval is not part of this sandbox test.

Delivery-report and inbox callbacks stay off until we want them. Those need a public HTTPS URL in the sandbox dashboard (SMS callback URLs). `localhost:3000` cannot receive them.

## Checklist

- [ ] Sandbox dashboard shows username `sandbox` and the key in `.env.local` belongs to that app.
- [ ] `curl` to `api.sandbox.africastalking.com` returns recipient `statusCode` 101 (or 100 / 102).
- [ ] The same `messageId` appears under SMS → Outbox.
- [ ] The handset received nothing. That is correct for sandbox.
- [ ] `lib/sms.ts` is switched only after the curl result is good.
- [ ] One local booking then writes `sms_sent` and a matching outbox row.
