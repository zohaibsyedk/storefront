import { STEP_IDS, type ChangeRequest, type StepId } from "@storefront/core";
import { approvePlan, bakeryDraft, chainFor, chat, confirmProfile, fundAndLaunch, loadBusiness, requestChange, runDays, saveStep, withBusiness } from "@storefront/agent";
import { killSwitch, logAction, withdrawUnspent } from "@storefront/treasury";
import { viewOf } from "@/lib/view";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const state = loadBusiness(id);
  if (!state) return Response.json({ error: "We could not find that business." }, { status: 404 });
  return Response.json(await viewOf(state));
}

const AREAS = ["strategy", "budget", "campaigns", "creative", "site", "domain", "listing", "autonomy"];

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  try {
    const view = await withBusiness(id, async (state) => {
      switch (body.action) {
        case "saveStep": {
          const step = String(body.step) as StepId;
          if (!STEP_IDS.includes(step)) throw new Error("Unknown step");
          if (state.status !== "onboarding" && state.status !== "review") throw new Error("Your details are locked while a campaign is running.");
          saveStep(state, step, body.data, typeof body.lastStep === "number" ? body.lastStep : undefined);
          break;
        }
        case "setStep":
          state.draft.lastStep = Number(body.lastStep) || 0;
          break;
        case "useExample":
          if (state.status !== "onboarding") throw new Error("Already set up");
          state.draft = { ...bakeryDraft(), lastStep: 8 };
          break;
        case "edit":
          if (state.status !== "review") throw new Error("The plan is already approved.");
          state.status = "onboarding";
          break;
        case "confirm":
          if (state.status !== "onboarding") throw new Error("Already confirmed");
          await confirmProfile(state);
          break;
        case "change": {
          const area = AREAS.includes(String(body.area)) ? (String(body.area) as ChangeRequest["area"]) : "strategy";
          if (!String(body.text ?? "").trim()) throw new Error("Say what you would like changed.");
          await requestChange(state, area, String(body.text));
          break;
        }
        case "autonomy": {
          const plan = state.plans.at(-1);
          if (!plan || state.status !== "review") throw new Error("The plan is already approved.");
          const clamp = (v: unknown, lo: number, hi: number, d: number) => Math.min(hi, Math.max(lo, Number.isFinite(Number(v)) ? Number(v) : d));
          const a = body.autonomy as Record<string, unknown>;
          plan.autonomy = {
            intraPlatformDailyShiftPct: clamp(a.intraPlatformDailyShiftPct, 0, 50, 30),
            crossPlatformWeeklyShiftPct: clamp(a.crossPlatformWeeklyShiftPct, 0, 40, 20),
            maxPlatformSharePct: clamp(a.maxPlatformSharePct, 50, 90, 70),
            notifyOn: { ...plan.autonomy.notifyOn, ...((a.notifyOn as object) ?? {}) },
          };
          plan.settings.autonomy = plan.autonomy;
          break;
        }
        case "approve":
          await approvePlan(state, String(body.by || "the owner"));
          break;
        case "launch":
          await fundAndLaunch(state);
          break;
        case "runDays":
          await runDays(state, Math.min(90, Math.max(1, Number(body.days) || 1)));
          break;
        case "kill":
          if (state.status !== "live") throw new Error("Nothing is running.");
          await killSwitch(state, chainFor(state), "owner");
          break;
        case "withdraw":
          await withdrawUnspent(state, chainFor(state));
          break;
        case "chat":
          await chat(state, String(body.text ?? ""));
          break;
        case "taskDone": {
          const t = state.ownerTasks.find((x) => x.id === body.taskId);
          if (t) {
            t.status = "done";
            logAction(state, { actor: "Owner", kind: "task_done", title: `Marked done: ${t.title}`, reason: "Confirmed by you." });
          }
          break;
        }
        default:
          throw new Error("Unknown action");
      }
      return viewOf(state);
    });
    return Response.json(view);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Something went wrong" }, { status: 400 });
  }
}
