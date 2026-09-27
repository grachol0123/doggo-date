import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import type { TablesInsert } from "@/types";

const swipeRequestSchema = z.object({
  targetDogId: z.uuid(),
  decision: z.enum(["like", "pass"]),
});

export const prerender = false;

function jsonResponse(body: object, status = 200) {
  return Response.json(body, { status });
}

function buildSwipePayload(actorDogId: string, targetDogId: string, decision: "like" | "pass"): TablesInsert<"swipes"> {
  return {
    actor_dog_id: actorDogId,
    target_dog_id: targetDogId,
    decision,
  };
}

function orderDogIds(leftDogId: string, rightDogId: string) {
  return leftDogId < rightDogId ? ([leftDogId, rightDogId] as const) : ([rightDogId, leftDogId] as const);
}

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;

  if (!user) {
    return jsonResponse({ status: "unauthenticated" }, 401);
  }

  let requestBody: unknown;

  try {
    requestBody = await context.request.json();
  } catch {
    return jsonResponse({ status: "invalid" }, 400);
  }

  const parsedRequest = swipeRequestSchema.safeParse(requestBody);

  if (!parsedRequest.success) {
    return jsonResponse({ status: "invalid" }, 400);
  }

  const supabase = createClient(context.request.headers, context.cookies);

  if (!supabase) {
    return jsonResponse({ status: "error", message: "Supabase is not configured" }, 500);
  }

  const { data: ownDog, error: ownDogError } = await supabase
    .from("dogs")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (ownDogError) {
    return jsonResponse({ status: "error", message: ownDogError.message }, 500);
  }

  if (!ownDog) {
    return jsonResponse({ status: "no_own_dog" });
  }

  const { targetDogId, decision } = parsedRequest.data;
  const swipePayload = buildSwipePayload(ownDog.id, targetDogId, decision);
  const { error: swipeError } = await supabase.from("swipes").insert(swipePayload);

  if (swipeError) {
    if (swipeError.code === "23505") {
      return jsonResponse({ status: "already_swiped" });
    }

    if (swipeError.code === "23514" || swipeError.code === "23503") {
      return jsonResponse({ status: "invalid" }, 400);
    }

    return jsonResponse({ status: "error", message: swipeError.message }, 500);
  }

  if (decision === "pass") {
    return jsonResponse({ status: "ok", matched: false });
  }

  const [dogAId, dogBId] = orderDogIds(ownDog.id, targetDogId);
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id")
    .eq("dog_a_id", dogAId)
    .eq("dog_b_id", dogBId)
    .maybeSingle();

  if (matchError) {
    return jsonResponse({ status: "error", message: matchError.message }, 500);
  }

  return jsonResponse({
    status: "ok",
    matched: Boolean(match),
  });
};
