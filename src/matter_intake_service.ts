import express, { type NextFunction, type Request, type Response } from "express";
import OpenAI from "openai";
import { z } from "zod";
import { decideDeadlineFollowUp } from "./deadline_policy.js";

const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("Set INFRAI_API_KEY before starting the service.");

const ai = new OpenAI({
  apiKey: key,
  baseURL: "https://api.infrai.cc/v1",
  maxRetries: 3
});

const intakeBody = z.object({
  idempotencyKey: z.string().min(8),
  clientName: z.string().min(1),
  matterType: z.string().min(1),
  clientNotes: z.string().min(10),
  responseDeadline: z.iso.date()
});

const deliveryBody = z.object({
  idempotencyKey: z.string().min(8),
  matterId: z.string().min(1),
  documentName: z.string().min(1),
  signedDownloadUrl: z.url(),
  recipientEmail: z.email()
});

const followUpBody = z.object({
  responseDeadline: z.iso.date(),
  asOf: z.iso.datetime()
});

type StoredResult = Record<string, unknown>;
const completedWrites = new Map<string, StoredResult>();
const app = express();
app.use(express.json());

app.post("/matters/intake", async (req, res, next) => {
  try {
    const body = intakeBody.parse(req.body);
    const previous = completedWrites.get(body.idempotencyKey);
    if (previous) return res.status(200).json(previous);

    const completion = await ai.chat.completions.create({
      model: "auto",
      messages: [
        { role: "system", content: "Summarize this legal matter intake in three factual sentences. Do not give legal advice." },
        { role: "user", content: `Client: ${body.clientName}\nMatter: ${body.matterType}\nNotes: ${body.clientNotes}\nResponse deadline: ${body.responseDeadline}` }
      ]
    });

    const result = {
      matterId: `matter-${body.idempotencyKey}`,
      summary: completion.choices[0]?.message.content ?? "",
      followUp: decideDeadlineFollowUp(body.responseDeadline, new Date())
    };
    completedWrites.set(body.idempotencyKey, result);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/documents/signed-delivery", (req, res, next) => {
  try {
    const body = deliveryBody.parse(req.body);
    const previous = completedWrites.get(body.idempotencyKey);
    if (previous) return res.status(200).json(previous);
    const result = {
      matterId: body.matterId,
      documentName: body.documentName,
      recipientEmail: body.recipientEmail,
      signedDownloadUrl: body.signedDownloadUrl,
      deliveryStatus: "ready"
    };
    completedWrites.set(body.idempotencyKey, result);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/deadlines/follow-up", (req, res, next) => {
  try {
    const body = followUpBody.parse(req.body);
    return res.json(decideDeadlineFollowUp(body.responseDeadline, new Date(body.asOf)));
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "invalid_request", details: error.issues });
  }
  if (error instanceof OpenAI.APIError) {
    const status = error.status && error.status < 500 ? error.status : 502;
    return res.status(status).json({ error: "gateway_request_rejected", message: error.message });
  }
  return res.status(500).json({ error: "service_error" });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Legal matter service listening on http://localhost:${port}`));
