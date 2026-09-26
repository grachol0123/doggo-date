import { Constants, type Database } from "@/types";

interface EnumOption<T extends string> {
  value: T;
  label: string;
}

type DogActivityLevel = Database["public"]["Enums"]["dog_activity_level"];
type DogInterest = Database["public"]["Enums"]["dog_interest"];

const dogActivityLevelLabels = {
  homebody: "Kanapowiec",
  walker: "Spacerowicz",
  runner: "Biegacz",
} satisfies Record<DogActivityLevel, string>;

const dogInterestLabels = {
  walks: "Spacery",
  running: "Bieganie",
  fetch: "Aportowanie",
  swimming: "Pływanie",
  agility: "Agility",
  obedience_training: "Trening posłuszeństwa",
  playing_with_other_dogs: "Zabawa z innymi psami",
  hiking: "Wędrówki",
  camping: "Kemping",
  car_rides: "Przejażdżki samochodem",
} satisfies Record<DogInterest, string>;

export const dogActivityLevelOptions: EnumOption<DogActivityLevel>[] = Constants.public.Enums.dog_activity_level.map(
  (value) => ({
    value,
    label: dogActivityLevelLabels[value],
  }),
);

export const dogInterestOptions: EnumOption<DogInterest>[] = Constants.public.Enums.dog_interest.map((value) => ({
  value,
  label: dogInterestLabels[value],
}));
