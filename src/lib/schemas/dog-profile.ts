import { z } from "zod";
import { Constants, type Database } from "@/types";

type DogActivityLevel = Database["public"]["Enums"]["dog_activity_level"];
type DogInterest = Database["public"]["Enums"]["dog_interest"];

const dogActivityLevels = Constants.public.Enums.dog_activity_level as readonly [
  DogActivityLevel,
  ...DogActivityLevel[],
];
const dogInterests = Constants.public.Enums.dog_interest as readonly [DogInterest, ...DogInterest[]];

export const dogProfileBounds = {
  name: {
    min: 1,
    max: 100,
  },
  ageYears: {
    min: 0,
    max: 40,
  },
  description: {
    max: 500,
  },
  breed: {
    max: 100,
  },
} as const;

export const dogProfileSchema = z.object({
  name: z.string().min(dogProfileBounds.name.min).max(dogProfileBounds.name.max),
  age_years: z.number().int().min(dogProfileBounds.ageYears.min).max(dogProfileBounds.ageYears.max),
  description: z.string().max(dogProfileBounds.description.max).optional(),
  breed: z.string().max(dogProfileBounds.breed.max).optional(),
  temperament: z.array(z.string()).optional(),
  activity_level: z.enum(dogActivityLevels).optional(),
  interests: z.array(z.enum(dogInterests)).optional(),
});

export type DogProfileInput = z.infer<typeof dogProfileSchema>;
