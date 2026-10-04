import type { APIRoute } from "astro";
import { sendMessageSchema } from "@/lib/schemas/message";
import { captureServerFailure } from "@/lib/sentry";
import { createClient } from "@/lib/supabase";
import type { Database, Dog, Message } from "@/types";

const DOG_PHOTOS_BUCKET = "dog-photos";
const ROUTE = "/api/messages";

export const prerender = false;

type MatchParticipantRecord = Pick<Database["public"]["Tables"]["matches"]["Row"], "dog_a_id" | "dog_b_id" | "id">;
type ServerSupabaseClient = NonNullable<ReturnType<typeof createClient>>;
interface MessageResponse {
  id: Message["id"];
  body: Message["body"];
  createdAt: Message["created_at"];
  senderDogId: Message["sender_dog_id"];
  isMine: boolean;
}

function jsonResponse(body: object, status = 200) {
  return Response.json(body, { status });
}

function toMessageResponse(
  message: Pick<Message, "id" | "body" | "created_at" | "sender_dog_id">,
  ownDogId: string,
): MessageResponse {
  return {
    id: message.id,
    body: message.body,
    createdAt: message.created_at,
    senderDogId: message.sender_dog_id,
    isMine: message.sender_dog_id === ownDogId,
  };
}

async function findOwnDogId(supabase: ServerSupabaseClient, ownerId: string) {
  return supabase.from("dogs").select("id").eq("owner_id", ownerId).maybeSingle();
}

async function findAuthorizedMatch(supabase: ServerSupabaseClient, matchId: string, ownDogId: string) {
  return supabase
    .from("matches")
    .select("id, dog_a_id, dog_b_id")
    .eq("id", matchId)
    .or(`dog_a_id.eq.${ownDogId},dog_b_id.eq.${ownDogId}`)
    .maybeSingle();
}

function getOtherDogId(match: MatchParticipantRecord, ownDogId: string) {
  return match.dog_a_id === ownDogId ? match.dog_b_id : match.dog_a_id;
}

function getDogPhotoUrl(supabase: ServerSupabaseClient, dog: Dog) {
  return dog.photo_path ? supabase.storage.from(DOG_PHOTOS_BUCKET).getPublicUrl(dog.photo_path).data.publicUrl : null;
}

export const GET: APIRoute = async (context) => {
  const user = context.locals.user;

  if (!user) {
    return jsonResponse({ status: "unauthenticated" }, 401);
  }

  const matchId = context.url.searchParams.get("matchId");
  const parsedMatchId = sendMessageSchema.shape.matchId.safeParse(matchId);

  if (!parsedMatchId.success) {
    return jsonResponse({ status: "invalid_request" }, 400);
  }

  const supabase = createClient(context.request.headers, context.cookies);

  if (!supabase) {
    captureServerFailure(new Error("Supabase is not configured"), ROUTE);
    return jsonResponse({ status: "error", message: "Supabase is not configured" }, 500);
  }

  const { data: ownDog, error: ownDogError } = await findOwnDogId(supabase, user.id);

  if (ownDogError) {
    captureServerFailure(ownDogError, ROUTE);
    return jsonResponse({ status: "error", message: ownDogError.message }, 500);
  }

  if (!ownDog) {
    return jsonResponse({ status: "not_participant" }, 404);
  }

  const { data: match, error: matchError } = await findAuthorizedMatch(supabase, parsedMatchId.data, ownDog.id);

  if (matchError) {
    captureServerFailure(matchError, ROUTE);
    return jsonResponse({ status: "error", message: matchError.message }, 500);
  }

  if (!match) {
    return jsonResponse({ status: "not_participant" }, 404);
  }

  const otherDogId = getOtherDogId(match, ownDog.id);
  const [{ data: otherDog, error: otherDogError }, { data: messages, error: messagesError }] = await Promise.all([
    supabase.from("dogs").select("*").eq("id", otherDogId).maybeSingle(),
    supabase
      .from("messages")
      .select("id, body, created_at, sender_dog_id")
      .eq("match_id", match.id)
      .order("created_at", { ascending: true }),
  ]);

  if (otherDogError) {
    captureServerFailure(otherDogError, ROUTE);
    return jsonResponse({ status: "error", message: otherDogError.message }, 500);
  }

  if (!otherDog) {
    captureServerFailure(new Error("Matched dog not found"), ROUTE);
    return jsonResponse({ status: "error", message: "Matched dog not found" }, 500);
  }

  if (messagesError) {
    captureServerFailure(messagesError, ROUTE);
    return jsonResponse({ status: "error", message: messagesError.message }, 500);
  }

  return jsonResponse({
    status: "ok",
    otherDog,
    otherDogPhotoUrl: getDogPhotoUrl(supabase, otherDog),
    messages: messages.map((message) => toMessageResponse(message, ownDog.id)),
  });
};

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;

  if (!user) {
    return jsonResponse({ status: "unauthenticated" }, 401);
  }

  let requestBody: unknown;

  try {
    requestBody = await context.request.json();
  } catch {
    return jsonResponse({ status: "invalid_body" }, 400);
  }

  const parsedRequest = sendMessageSchema.safeParse(requestBody);

  if (!parsedRequest.success) {
    return jsonResponse({ status: "invalid_body" }, 400);
  }

  const supabase = createClient(context.request.headers, context.cookies);

  if (!supabase) {
    captureServerFailure(new Error("Supabase is not configured"), ROUTE);
    return jsonResponse({ status: "error", message: "Supabase is not configured" }, 500);
  }

  const { data: ownDog, error: ownDogError } = await findOwnDogId(supabase, user.id);

  if (ownDogError) {
    captureServerFailure(ownDogError, ROUTE);
    return jsonResponse({ status: "error", message: ownDogError.message }, 500);
  }

  if (!ownDog) {
    return jsonResponse({ status: "not_participant" }, 404);
  }

  const { matchId, body } = parsedRequest.data;
  const { data: match, error: matchError } = await findAuthorizedMatch(supabase, matchId, ownDog.id);

  if (matchError) {
    captureServerFailure(matchError, ROUTE);
    return jsonResponse({ status: "error", message: matchError.message }, 500);
  }

  if (!match) {
    return jsonResponse({ status: "not_participant" }, 404);
  }

  const { data: message, error: insertError } = await supabase
    .from("messages")
    .insert({
      match_id: match.id,
      sender_dog_id: ownDog.id,
      body,
    })
    .select("id, body, created_at, sender_dog_id")
    .single();

  if (insertError) {
    if (insertError.code === "23503" || insertError.code === "42501") {
      return jsonResponse({ status: "not_participant" }, 404);
    }

    captureServerFailure(insertError, ROUTE);
    return jsonResponse({ status: "error", message: insertError.message }, 500);
  }

  return jsonResponse({
    status: "ok",
    message: toMessageResponse(message, ownDog.id),
  });
};
