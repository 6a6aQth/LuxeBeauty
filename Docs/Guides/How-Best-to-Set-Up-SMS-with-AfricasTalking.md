# How Best to Set Up SMS with Africa's Talking

Use this when any system needs to send a text: a receipt, a one-time code, a delivery update, an appointment reminder. The application calls Africa's Talking. Africa's Talking delivers the text. The same steps apply whether the app is a website, a backend job, or a script.

Start in the sandbox. Move to a live app only after a sandbox send is accepted. A sandbox key never works on the live host, and a live key never works on the sandbox host.

## Create the two apps

Sign in at [account.africastalking.com](https://account.africastalking.com).

The sandbox app is the one with the orange Sandbox label: [account.africastalking.com/apps/sandbox](https://account.africastalking.com/apps/sandbox). Its API username is always the word `sandbox`, no matter what the app is called on screen.

The live app is a separate application you create without that label. It has two names. The app name is only a label in the dashboard. The username is what the API expects, and it is different from the app name. Copy the username from the live dashboard. Do not guess it from the app name.

Generate an API key under Settings → API Key on the app you are about to call. The key is shown once. Generating a new key disables the previous key for that app immediately. A fresh key can take 5 minutes, and sometimes up to about 20, before the API accepts it. A correct key tested too early returns `The supplied authentication is invalid`.

## Store two values

```env
AFRICAS_TALKING_USERNAME="sandbox"
AFRICAS_TALKING_API_KEY="the-key-from-that-same-app"
```

For live traffic, set the username to the live app username and the key to a key generated on that live app. Mixing the pairs returns HTTP 401.

Put them in the environment of whatever runs the code: a local `.env` file, a server secret store, or the host's environment settings. Do not commit the key, and do not paste it into documentation.

On Vercel, open the project → Settings → Environment Variables, add both names, choose Production (and Preview if preview deployments should send texts), then redeploy. A variable added after a deployment is already running is invisible to that deployment. A local env file is not uploaded with the code.

## Send one message

```http
POST https://api.sandbox.africastalking.com/version1/messaging
```

Live traffic uses `https://api.africastalking.com/version1/messaging` instead. If you use the official Node SDK, passing the username `sandbox` selects the sandbox host for you. Any other username selects the live host. A raw HTTP client must choose the host itself.

Headers:

| Header | Value |
| --- | --- |
| `apiKey` | The key for this app |
| `Content-Type` | `application/x-www-form-urlencoded` |
| `Accept` | `application/json` |

Body fields, form-encoded, not JSON:

| Field | Required | Value |
| --- | --- | --- |
| `username` | Yes | `sandbox` in the sandbox, otherwise the live app username |
| `to` | Yes | Recipient in international form, such as `+265995228264`. Several numbers are comma-separated. |
| `message` | Yes | The text. Avoid a raw `%` character. |
| `from` | No | Omit this to use Africa's Talking's default sender. |

```bash
curl -sS -X POST "https://api.sandbox.africastalking.com/version1/messaging" \
  -H "Accept: application/json" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "apiKey: ${AFRICAS_TALKING_API_KEY}" \
  --data-urlencode "username=${AFRICAS_TALKING_USERNAME}" \
  --data-urlencode "to=+265995228264" \
  --data-urlencode "message=Your order 1042 is confirmed."
```

HTTP 201 is the success status for this endpoint. HTTP 200 is also possible. Read the JSON either way. Africa's Talking can return a successful HTTP status and still reject the recipient.

```json
{
  "SMSMessageData": {
    "Message": "Sent to 1/1 Total Cost: MWK 21.0000",
    "Recipients": [
      {
        "statusCode": 100,
        "number": "+265995228264",
        "status": "Success",
        "cost": "MWK 21.0000",
        "messageId": "ATXid_..."
      }
    ]
  }
}
```

Treat recipient `statusCode` `100` (Processed), `101` (Sent), or `102` (Queued) as accepted. Store `messageId` if you want to match a later delivery report. An empty `Recipients` list, or a code of `401` or higher, means that number was not accepted.

| statusCode | Meaning |
| --- | --- |
| 100 | Processed |
| 101 | Sent |
| 102 | Queued |
| 401 | RiskHold |
| 402 | InvalidSenderId |
| 403 | InvalidPhoneNumber |
| 404 | UnsupportedNumberType |
| 405 | InsufficientBalance |
| 406 | UserInBlacklist |
| 407 | CouldNotRoute |
| 500 | InternalServerError |
| 501 | GatewayError |
| 502 | RejectedByGateway |

`100`, `101`, and `102` mean the request was accepted. They do not yet mean the handset displayed the text. That comes later, from a delivery report, if you ask for one.

A failed text should not undo the action that triggered it. Save the order, the booking, or the login, and record the SMS error beside it.

## Which number to send to

Send to the person who should read the message. If the product also collects a payment number, a delivery number, or a next-of-kin number, those are different fields. Store the notification number on its own, in international form, and pass that value as `to`.

Malawi numbers are `+265` plus 9 digits. `099…` is Airtel and `088…` is TNM once the leading `0` is replaced with `+265`. Other countries follow the same rule: `+`, country code, subscriber number, with no spaces.

## Where a sandbox message appears

Sandbox does not deliver to a real handset. Open [developers.africastalking.com/simulator](https://developers.africastalking.com/simulator), choose the country, enter the same number you put in `to`, and press Connect. Leave that tab open. The sandbox network code for these messages is `99999` (Athena).

You can also find the `messageId` under SMS → Outbox on the sandbox dashboard.

## Sender ID

Omit `from` until you have a sender approved on the same app that owns the API key. A sandbox alphanumeric does not exist on the live app. Using it there returns `InvalidSenderId` and an empty recipient list.

The default sender is Africa's Talking's own generic ID. It is enough to prove the integration, including on live, and it is what you should ship until a branded sender is approved. Africa's Talking documents the default test sender as Kenya Airtel only. In practice a live Malawi Airtel number can still be accepted. Check the handset and the outbox rather than assuming the country note blocks every other network.

When you do register a sender, create it on the live app under SMS → Alphanumerics. The value is case-sensitive. After it is approved, add it as `from`.

## The application URL

Do not register the website or callback URL in order to send notifications. The application calls Africa's Talking. Africa's Talking does not need to call back.

Add a callback only when the product must hear about a later event:

| Notification | Dashboard path | When you need it |
| --- | --- | --- |
| Delivery reports | SMS → SMS Callback URLs → Delivery Reports | You must know whether the handset got the text |
| Incoming messages | SMS → SMS Callback URLs → Incoming Messages | People reply to a short code |
| Bulk SMS opt out | SMS → SMS Callback URLs → Bulk SMS Opt Out | You must record opt-outs |
| Subscription notifications | SMS → SMS Callback URLs → Subscription Notifications | You sell premium subscriptions |

Each callback is a public `https` URL that can accept `application/x-www-form-urlencoded` POST requests. `http://localhost` cannot receive them. A deployed URL can. Until you need one of those events, leave the fields empty.

## Checklist

- [ ] Sandbox app open, username exactly `sandbox`, key generated on that app.
- [ ] One curl to the sandbox host returns recipient status `100`, `101`, or `102`.
- [ ] The same `messageId` shows in the sandbox outbox or on the simulator for that number.
- [ ] Live app created. Its username, not its app name, is in the environment.
- [ ] Live key generated on the live app, and the environment no longer contains the sandbox key.
- [ ] `from` is omitted, or it is an alphanumeric approved on this same live app.
- [ ] The notification number is stored separately from any payment number.
- [ ] The host that runs production has both variables, and it was redeployed after they were saved.
- [ ] One real send arrives on the intended handset.
- [ ] A failed send is logged and does not roll back the business action.
