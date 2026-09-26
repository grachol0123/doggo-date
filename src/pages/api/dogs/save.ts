import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { dogProfileSchema, type DogProfileInput } from "@/lib/schemas/dog-profile";
import type { TablesInsert, TablesUpdate } from "@/types";

const DOG_PROFILE_PATH = "/dashboard/dog";
const DOG_PHOTOS_BUCKET = "dog-photos";

function redirectWithError(context: Parameters<APIRoute>[0], message: string) {
  return context.redirect(`${DOG_PROFILE_PATH}?error=${encodeURIComponent(message)}`);
}

function getFormString(form: FormData, key: string) {
  const value = form.get(key);

  return typeof value === "string" ? value : "";
}

function parseOptionalString(value: string) {
  return value === "" ? undefined : value;
}

function parseOptionalStringArray(form: FormData, key: string) {
  const values = form.getAll(key).filter((value): value is string => typeof value === "string");

  if (values.length > 1) {
    const repeatedValues = values.map((value) => value.trim()).filter(Boolean);

    return repeatedValues.length > 0 ? repeatedValues : undefined;
  }

  const [singleValue = ""] = values;
  const trimmedValue = singleValue.trim();

  if (!trimmedValue) {
    return undefined;
  }

  // Phase 4 should submit repeated fields for multi-value inputs; this fallback also accepts
  // a single JSON array or comma-delimited string so the server can handle simple HTML forms.
  if (trimmedValue.startsWith("[")) {
    try {
      const parsedValue: unknown = JSON.parse(trimmedValue);

      if (Array.isArray(parsedValue)) {
        const jsonValues = parsedValue
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean);

        return jsonValues.length > 0 ? jsonValues : undefined;
      }
    } catch {
      // Malformed JSON — fall through to comma-delimited parsing below.
    }
  }

  const delimitedValues = trimmedValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return delimitedValues.length > 0 ? delimitedValues : undefined;
}

function parseAgeYears(value: string) {
  if (value.trim() === "") {
    return Number.NaN;
  }

  return Number(value);
}

function getPhotoFile(form: FormData) {
  const photo = form.get("photo");

  if (!(photo instanceof File) || photo.size === 0) {
    return null;
  }

  return photo;
}

function resolvePhotoExtension(file: File) {
  const extensionFromName = file.name.split(".").pop()?.trim().toLowerCase();

  if (extensionFromName && extensionFromName !== file.name.toLowerCase()) {
    return extensionFromName.replace(/[^a-z0-9]/g, "");
  }

  const extensionByMimeType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  return extensionByMimeType[file.type] ?? null;
}

function buildDogProfileInput(form: FormData) {
  return {
    name: getFormString(form, "name"),
    age_years: parseAgeYears(getFormString(form, "age_years")),
    description: parseOptionalString(getFormString(form, "description")),
    breed: parseOptionalString(getFormString(form, "breed")),
    activity_level: parseOptionalString(getFormString(form, "activity_level")),
    temperament: parseOptionalStringArray(form, "temperament"),
    interests: parseOptionalStringArray(form, "interests"),
  };
}

function buildInsertPayload(userId: string, profile: DogProfileInput, photoPath: string | null): TablesInsert<"dogs"> {
  return {
    owner_id: userId,
    name: profile.name,
    age_years: profile.age_years,
    description: profile.description ?? null,
    breed: profile.breed ?? null,
    temperament: profile.temperament ?? null,
    activity_level: profile.activity_level ?? null,
    interests: profile.interests ?? null,
    photo_path: photoPath,
  };
}

function buildUpdatePayload(profile: DogProfileInput, photoPath: string | null): TablesUpdate<"dogs"> {
  return {
    name: profile.name,
    age_years: profile.age_years,
    description: profile.description ?? null,
    breed: profile.breed ?? null,
    temperament: profile.temperament ?? null,
    activity_level: profile.activity_level ?? null,
    interests: profile.interests ?? null,
    photo_path: photoPath,
  };
}

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;

  if (!user) {
    return context.redirect("/auth/signin");
  }

  const form = await context.request.formData();
  const parsedProfile = dogProfileSchema.safeParse(buildDogProfileInput(form));

  if (!parsedProfile.success) {
    const validationMessage = parsedProfile.error.issues[0]?.message ?? "Invalid dog profile data";

    return redirectWithError(context, validationMessage);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return redirectWithError(context, "Supabase is not configured");
  }

  const { data: existingDog, error: existingDogError } = await supabase
    .from("dogs")
    .select("id, photo_path")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (existingDogError) {
    return redirectWithError(context, existingDogError.message);
  }

  const photoFile = getPhotoFile(form);
  let uploadedPhotoPath: string | null = null;

  if (photoFile) {
    const photoExtension = resolvePhotoExtension(photoFile);

    if (!photoExtension) {
      return redirectWithError(context, "Photo file extension is not supported");
    }

    uploadedPhotoPath = `${user.id}/${crypto.randomUUID()}.${photoExtension}`;

    const { error: uploadError } = await supabase.storage.from(DOG_PHOTOS_BUCKET).upload(uploadedPhotoPath, photoFile, {
      contentType: photoFile.type,
    });

    if (uploadError) {
      return redirectWithError(context, uploadError.message);
    }
  }

  const nextPhotoPath = uploadedPhotoPath ?? existingDog?.photo_path ?? null;
  const dogPayload = existingDog
    ? buildUpdatePayload(parsedProfile.data, nextPhotoPath)
    : buildInsertPayload(user.id, parsedProfile.data, nextPhotoPath);

  const saveQuery = existingDog
    ? supabase.from("dogs").update(dogPayload).eq("id", existingDog.id)
    : supabase.from("dogs").insert(dogPayload);
  const { error: saveError } = await saveQuery;

  if (saveError) {
    if (uploadedPhotoPath) {
      const { error: rollbackError } = await supabase.storage.from(DOG_PHOTOS_BUCKET).remove([uploadedPhotoPath]);

      if (rollbackError) {
        console.error("Failed to delete uploaded dog photo after save error", rollbackError);
      }
    }

    return redirectWithError(context, saveError.message);
  }

  if (uploadedPhotoPath && existingDog?.photo_path && existingDog.photo_path !== uploadedPhotoPath) {
    const { error: cleanupError } = await supabase.storage.from(DOG_PHOTOS_BUCKET).remove([existingDog.photo_path]);

    if (cleanupError) {
      console.error("Failed to delete replaced dog photo", cleanupError);
    }
  }

  return context.redirect(`${DOG_PROFILE_PATH}?saved=1`);
};
