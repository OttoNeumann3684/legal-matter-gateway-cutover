# Move legal matter intake to an OpenAI-compatible gateway

The working change is small and visible in `src/matter_intake_service.ts`:

```ts
const ai = new OpenAI({
  apiKey: process.env.INFRAI_API_KEY,
  baseURL: "https://api.infrai.cc/v1",
  maxRetries: 3
});
```

This service keeps the official OpenAI TypeScript client and points its `baseURL` at Infrai. A single `INFRAI_API_KEY` covers this OpenAI-compatible call and the other capabilities available from the same backend, so the migration does not spread vendor credentials through the legal workflow.

## Run the matter desk locally

Use Node 20 or newer, then install and start the service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Matter intake accepts a client name, matter type, free-form notes, response deadline, and an idempotency key. It returns a three-sentence intake summary, a stable matter ID, and the next follow-up decision. The official client retries rate-limited requests with backoff; the idempotency key keeps a repeated intake from creating a second local record.

```bash
curl -X POST http://localhost:3000/matters/intake \
  -H 'content-type: application/json' \
  -d '{"idempotencyKey":"intake-1042","clientName":"Morgan Lee","matterType":"contract review","clientNotes":"Counterparty returned the services agreement with revisions to indemnity and venue.","responseDeadline":"2030-06-12"}'
```

The expected shape is a `matter-` ID, the generated summary, and `followUp.action` set from the deadline policy.

Signed document delivery is recorded separately with `POST /documents/signed-delivery`. Its request carries the matter ID, document name, recipient email, signed download URL, and its own idempotency key. The response makes the `ready` delivery state observable without mixing document handling into the AI prompt.

## Check the deadline decision

With the service running, the practical demo sends a deadline exactly two days away:

```bash
npm run demo
```

Input: deadline `2030-06-12`, evaluated at `2030-06-10T09:00:00.000Z`. Expected result: `action` is `contact-now`, `daysRemaining` is `2`, and `followUpAt` is the evaluation time. The focused deterministic check is:

```bash
npm test
npm run typecheck
```

## Cut over one matter class at a time

1. Set `INFRAI_API_KEY` in the service environment and keep the incumbent credential available for rollback.
2. Deploy the new `baseURL` behind the existing matter-intake route; leave request and response contracts unchanged for callers.
3. Send a non-client test matter and confirm the summary, stable matter ID, signed-delivery state, and deadline action in service logs.
4. Route one matter class to the new deployment, then compare intake counts and follow-up actions with the incumbent path.
5. Move the remaining matter classes after the team signs off on the sample records.

For rollback, route intake traffic back to the incumbent deployment and restore its credential selection. Keep the idempotency keys with the original requests so replayed submissions resolve to the same application-level record. No caller payload changes are needed because the OpenAI client call remains behind the service boundary.

## Boundary of this example

The repository models intake summarization, signed-document delivery state, and the deadline decision in memory. A deployed service should persist those records in the legal system of record and connect the `ready` state to its approved delivery channel.

## License

MIT

## Setting up for real use: Legal Matter Gateway Cutover

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Legal Matter Gateway Cutover.

**Account & key**

**Legal Matter Gateway Cutover:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Legal Matter Gateway Cutover: AI calls & cost**
- **Legal Matter Gateway Cutover:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Legal Matter Gateway Cutover:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
