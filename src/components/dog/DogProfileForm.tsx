import React, { useEffect, useState } from "react";
import { PawPrint } from "lucide-react";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
    } else if (name.length > dogProfileBounds.name.max) {
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
      <div>
        <Label htmlFor="name">
          Imię <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          name="name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clearError("name");
          }}
          placeholder="Imię psa"
          aria-invalid={Boolean(errors.name)}
        />
        {errors.name ? <p className="text-destructive mt-1 text-xs">{errors.name}</p> : null}
      </div>

      <div>
        <Label htmlFor="age_years">
          Wiek (w latach) <span className="text-destructive">*</span>
        </Label>
        <Input
          id="age_years"
          name="age_years"
          type="number"
          required
          value={ageYears}
          onChange={(e) => {
            setAgeYears(e.target.value);
            clearError("age_years");
          }}
          placeholder="np. 3"
          aria-invalid={Boolean(errors.age_years)}
        />
        {errors.age_years ? <p className="text-destructive mt-1 text-xs">{errors.age_years}</p> : null}
      </div>

      <div>
        <Label htmlFor="breed">Rasa</Label>
        <Input
          id="breed"
          name="breed"
          value={breed}
          onChange={(e) => {
            setBreed(e.target.value);
            clearError("breed");
          }}
          placeholder="np. Labrador"
          aria-invalid={Boolean(errors.breed)}
        />
        {errors.breed ? <p className="text-destructive mt-1 text-xs">{errors.breed}</p> : null}
      </div>

      <div>
        <Label htmlFor="description" className="mb-1 block">
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
        {errors.description ? <p className="text-destructive mt-1 text-xs">{errors.description}</p> : null}
      </div>

      <div>
        <Label htmlFor="temperament" className="mb-1 block">
          Temperament (oddzielony przecinkami)
        </Label>
        <Input
          id="temperament"
          name="temperament"
          value={temperament}
          onChange={(e) => {
            setTemperament(e.target.value);
          }}
          placeholder="np. przyjazny, spokojny, energiczny"
        />
      </div>

      <div>
        <Label className="mb-1 block">Poziom aktywności</Label>
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
        <Label className="mb-2 block">Zainteresowania</Label>
        <div className="grid grid-cols-2 gap-2">
          {dogInterestOptions.map((option) => (
            <label key={option.value} className="text-muted-foreground flex items-center gap-2 text-sm">
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
        <Label htmlFor="photo" className="mb-1 block">
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
          className="text-muted-foreground file:bg-secondary file:text-secondary-foreground w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-2"
        />
      </div>

      {serverError ? (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <SubmitButton pendingText="Zapisywanie..." icon={<PawPrint className="size-4" />}>
        Zapisz profil
      </SubmitButton>
    </form>
  );
}
