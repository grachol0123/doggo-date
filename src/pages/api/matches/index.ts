import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import type { Dog } from "@/types";

const DOG_PHOTOS_BUCKET = "dog-photos";

export const prerender = false;

interface MatchListEntry {
  matchId: string;
  matchedAt: string;
  dog: Dog;
  photoUrl: string | null;
  sharedInterestCount: number;
}

function jsonResponse(body: object, status = 200) {
  return Response.json(body, { status });
}

function countSharedInterests(viewerInterests: Set<string>, otherInterests: Dog["interests"]) {
  if (!otherInterests || viewerInterests.size === 0) {
    return 0;
  }

  return otherInterests.reduce((count, interest) => count + Number(viewerInterests.has(interest)), 0);
}

export const GET: APIRoute = async (context) => {
  const user = context.locals.user;

  if (!user) {
    return jsonResponse({ status: "unauthenticated" }, 401);
  }

  const supabase = createClient(context.request.headers, context.cookies);

  if (!supabase) {
    return jsonResponse({ status: "error", message: "Supabase is not configured" }, 500);
  }

  const { data: ownDog, error: ownDogError } = await supabase
    .from("dogs")
    .select("id, interests")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (ownDogError) {
    return jsonResponse({ status: "error", message: ownDogError.message }, 500);
  }

  if (!ownDog) {
    return jsonResponse({ status: "no_own_dog" });
  }

  const { data: matchRows, error: matchesError } = await supabase
    .from("matches")
    .select("id, dog_a_id, dog_b_id, created_at")
    .or(`dog_a_id.eq.${ownDog.id},dog_b_id.eq.${ownDog.id}`);

  if (matchesError) {
    return jsonResponse({ status: "error", message: matchesError.message }, 500);
  }

  if (matchRows.length === 0) {
    return jsonResponse({ status: "ok", matches: [] });
  }

  const otherDogIds = matchRows.map((row) => (row.dog_a_id === ownDog.id ? row.dog_b_id : row.dog_a_id));

  const { data: otherDogs, error: otherDogsError } = await supabase.from("dogs").select("*").in("id", otherDogIds);

  if (otherDogsError) {
    return jsonResponse({ status: "error", message: otherDogsError.message }, 500);
  }

  const otherDogById = new Map(otherDogs.map((dog) => [dog.id, dog]));
  const viewerInterests = new Set(ownDog.interests ?? []);

  const matches: MatchListEntry[] = matchRows
    .map((row) => {
      const otherDogId = row.dog_a_id === ownDog.id ? row.dog_b_id : row.dog_a_id;
      const otherDog = otherDogById.get(otherDogId);

      if (!otherDog) {
        return null;
      }

      const photoUrl = otherDog.photo_path
        ? supabase.storage.from(DOG_PHOTOS_BUCKET).getPublicUrl(otherDog.photo_path).data.publicUrl
        : null;

      return {
        matchId: row.id,
        matchedAt: row.created_at,
        dog: otherDog,
        photoUrl,
        sharedInterestCount: countSharedInterests(viewerInterests, otherDog.interests),
      };
    })
    .filter((entry): entry is MatchListEntry => entry !== null)
    .sort((left, right) => right.matchedAt.localeCompare(left.matchedAt));

  return jsonResponse({ status: "ok", matches });
};
