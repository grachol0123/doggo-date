import React, { useEffect, useState } from "react";
import { PawPrint, Calendar, Dog as DogIcon } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { ServerError } from "@/components/auth/ServerError";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dogActivityLevelOptions, dogInterestOptions } from "@/lib/dog-enums";
import { dogProfileBounds } from "@/lib/schemas/dog-profile";
import type { Dog } from "@/types";

interface Props {
  dog: Dog | null;
  existingPhotoUrl?: string | null;
  serverError?: string | null;
}

interface FormErrors {
  name?: string;
  age_years?: string;
  description?: string;
  breed?: string;
}

export default function DogProfileForm({ dog, existingPhotoUrl, serverError }: Props) {
  const [name, setName] = useState(dog?.name ?? "");
  const [ageYears, setAgeYears] = useState(dog?.age_years != null ? String(dog.age_years) : "");
  const [description, setDescription] = useState(dog?.description ?? "");
  const [breed, setBreed] = useState(dog?.breed ?? "");
  const [temperament, setTemperament] = useState((dog?.temperament ?? []).join(", "));
  const [activityLevel, setActivityLevel] = useState<string | undefined>(dog?.activity_level ?? undefined);
  const [interests, setInterests] = useState<string[]>(dog?.interests ?? []);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  function validate() {
    const next: FormErrors = {};
    const trimmedName = name.trim();

    if (!trimmedName) {
      next.name = "Imię jest wymagane";
    } else if (trimmedName.length > dogProfileBounds.name.max) {
      next.name = `Imię może mieć maksymalnie ${dogProfileBounds.name.max} znaków`;
    }

    const ageValue = Number(ageYears);

    if (ageYears.trim() === "" || !Number.isInteger(ageValue)) {
      next.age_years = "Wiek jest wymagany";
    } else if (ageValue < dogProfileBounds.ageYears.min || ageValue > dogProfileBounds.ageYears.max) {
      next.age_years = `Wiek musi być w przedziale ${dogProfileBounds.ageYears.min}-${dogProfileBounds.ageYears.max}`;
    }

    if (description.length > dogProfileBounds.description.max) {
      next.description = `Opis może mieć maksymalnie ${dogProfileBounds.description.max} znaków`;
    }

    if (breed.length > dogProfileBounds.breed.max) {
      next.breed = `Rasa może mieć maksymalnie ${dogProfileBounds.breed.max} znaków`;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: keyof FormErrors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  function toggleInterest(value: string, checked: boolean) {
    setInterests((prev) => (checked ? [...prev, value] : prev.filter((interest) => interest !== value)));
  }

  return (
    <form
      method="POST"
      action="/api/dogs/save"
      encType="multipart/form-data"
      className="space-y-4"
      onSubmit={handleSubmit}
      noValidate
    >
      <FormField
        id="name"
        label="Imię"
        required
        value={name}
        onChange={(v) => {
          setName(v);
          clearError("name");
        }}
        placeholder="Imię psa"
        error={errors.name}
        icon={<PawPrint className="size-4" />}
      />

      <FormField
        id="age_years"
        type="number"
        label="Wiek (w latach)"
        required
        value={ageYears}
        onChange={(v) => {
          setAgeYears(v);
          clearError("age_years");
        }}
        placeholder="np. 3"
        error={errors.age_years}
        icon={<Calendar className="size-4" />}
      />

      <FormField
        id="breed"
        label="Rasa"
        value={breed}
        onChange={(v) => {
          setBreed(v);
          clearError("breed");
        }}
        placeholder="np. Labrador"
        error={errors.breed}
        icon={<DogIcon className="size-4" />}
      />

      <div>
        <Label htmlFor="description" className="mb-1 block text-sm text-blue-100/80">
          Opis
        </Label>
        <Textarea
          id="description"
          name="description"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            clearError("description");
          }}
          placeholder="Opowiedz coś o swoim psie..."
          rows={4}
        />
        {errors.description ? <p className="mt-1 text-xs text-red-300">{errors.description}</p> : null}
      </div>

      <div>
        <Label htmlFor="temperament" className="mb-1 block text-sm text-blue-100/80">
          Temperament (oddzielony przecinkami)
        </Label>
        <input
          id="temperament"
          name="temperament"
          value={temperament}
          onChange={(e) => {
            setTemperament(e.target.value);
          }}
          placeholder="np. przyjazny, spokojny, energiczny"
          className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/40 focus:ring-2 focus:ring-purple-400 focus:outline-none"
        />
      </div>

      <div>
        <Label className="mb-1 block text-sm text-blue-100/80">Poziom aktywności</Label>
        <Select name="activity_level" value={activityLevel} onValueChange={setActivityLevel}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Wybierz poziom aktywności" />
          </SelectTrigger>
          <SelectContent>
            {dogActivityLevelOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-2 block text-sm text-blue-100/80">Zainteresowania</Label>
        <div className="grid grid-cols-2 gap-2">
          {dogInterestOptions.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm text-blue-100/80">
              <Checkbox
                name="interests"
                value={option.value}
                checked={interests.includes(option.value)}
                onCheckedChange={(checked) => {
                  toggleInterest(option.value, checked === true);
                }}
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="photo" className="mb-1 block text-sm text-blue-100/80">
          Zdjęcie
        </Label>
        {(photoPreview ?? existingPhotoUrl) ? (
          <img
            src={photoPreview ?? existingPhotoUrl ?? ""}
            alt="Podgląd zdjęcia psa"
            className="mb-2 size-24 rounded-lg object-cover"
          />
        ) : null}
        <input
          id="photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handlePhotoChange}
          className="w-full text-sm text-blue-100/80 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white"
        />
      </div>

      <ServerError message={serverError} />

      <SubmitButton pendingText="Zapisywanie..." icon={<PawPrint className="size-4" />}>
        Zapisz profil
      </SubmitButton>
    </form>
  );
}
