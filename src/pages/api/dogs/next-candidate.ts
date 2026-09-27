import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import type { Dog } from "@/types";

const DOG_PHOTOS_BUCKET = "dog-photos";

export const prerender = false;

function jsonResponse(body: object, status = 200) {
  return Response.json(body, { status });
}

function countSharedInterests(viewerInterests: Set<string>, candidateInterests: Dog["interests"]) {
  if (!candidateInterests || viewerInterests.size === 0) {
    return 0;
  }

  return candidateInterests.reduce((count, interest) => count + Number(viewerInterests.has(interest)), 0);
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

  const ownDogProfile = ownDog;

  const { data: swipes, error: swipesError } = await supabase
    .from("swipes")
    .select("target_dog_id")
    .eq("actor_dog_id", ownDogProfile.id);

  if (swipesError) {
    return jsonResponse({ status: "error", message: swipesError.message }, 500);
  }

  const swipeTargets = swipes;
  const excludedDogIds = new Set(swipeTargets.map((swipe) => swipe.target_dog_id));
  let candidatesQuery = supabase
    .from("dogs")
    .select("*")
    .neq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (excludedDogIds.size > 0) {
    const excludedIdFilter = Array.from(excludedDogIds)
      .map((dogId) => JSON.stringify(dogId))
      .join(",");

    candidatesQuery = candidatesQuery.not("id", "in", `(${excludedIdFilter})`);
  }

  const { data: candidates, error: candidatesError } = await candidatesQuery;

  if (candidatesError) {
    return jsonResponse({ status: "error", message: candidatesError.message }, 500);
  }

  const candidateRows = candidates;
  const remainingCandidates =
    excludedDogIds.size > 0 ? candidateRows.filter((candidate) => !excludedDogIds.has(candidate.id)) : candidateRows;

  if (remainingCandidates.length === 0) {
    return jsonResponse({ status: "no_candidates" });
  }

  const viewerInterests = new Set(ownDogProfile.interests ?? []);
  const nextCandidate = remainingCandidates
    .map((dog) => ({
      dog,
      sharedInterestCount: countSharedInterests(viewerInterests, dog.interests),
    }))
    .sort((left, right) => {
      if (left.dog.created_at !== right.dog.created_at) {
        return 0;
      }

      return right.sharedInterestCount - left.sharedInterestCount;
    })[0];

  const photoUrl = nextCandidate.dog.photo_path
    ? supabase.storage.from(DOG_PHOTOS_BUCKET).getPublicUrl(nextCandidate.dog.photo_path).data.publicUrl
    : null;

  return jsonResponse({
    status: "ok",
    dog: nextCandidate.dog,
    photoUrl,
  });
};
