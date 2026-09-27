import React, { useCallback, useEffect, useState } from "react";
import { Heart, LoaderCircle, PawPrint, RefreshCcw, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { dogActivityLevelOptions, dogInterestOptions } from "@/lib/dog-enums";
import { cn } from "@/lib/utils";
import type { Dog } from "@/types";

type BrowseViewState = "loading" | "no_own_dog" | "no_candidates" | "candidate" | "swipe_error";
type SwipeDecision = "like" | "pass";

type NextCandidateResponse =
  | { status: "ok"; dog: Dog; photoUrl: string | null }
  | { status: "no_own_dog" }
  | { status: "no_candidates" }
  | { status: "unauthenticated" }
  | { status: "error"; message?: string };

type SwipeResponse =
  | { status: "ok"; matched: boolean }
  | { status: "already_swiped" }
  | { status: "no_own_dog" }
  | { status: "invalid" }
  | { status: "unauthenticated" }
  | { status: "error"; message?: string };

interface SwipeRequest {
  targetDogId: string;
  decision: SwipeDecision;
}

const activityLevelLabels = Object.fromEntries(dogActivityLevelOptions.map((option) => [option.value, option.label]));
const interestLabels = Object.fromEntries(dogInterestOptions.map((option) => [option.value, option.label]));

function getAgeLabel(ageYears: number) {
  const remainder10 = ageYears % 10;
  const remainder100 = ageYears % 100;

  if (ageYears === 1) {
    return "rok";
  }

  if (remainder10 >= 2 && remainder10 <= 4 && (remainder100 < 12 || remainder100 > 14)) {
    return "lata";
  }

  return "lat";
}

async function readJsonResponse<T>(response: Response) {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export default function BrowseDogs() {
  const [viewState, setViewState] = useState<BrowseViewState>("loading");
  const [candidate, setCandidate] = useState<Dog | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [swipeError, setSwipeError] = useState<string | null>(null);
  const [pendingSwipe, setPendingSwipe] = useState<SwipeRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMatchBanner, setShowMatchBanner] = useState(false);

  const fetchNextCandidate = useCallback(async () => {
    try {
      const response = await fetch("/api/dogs/next-candidate", {
        headers: {
          Accept: "application/json",
        },
      });
      const payload = await readJsonResponse<NextCandidateResponse>(response);

      if (!payload) {
        throw new Error("Missing next-candidate response body");
      }

      switch (payload.status) {
        case "ok":
          setCandidate(payload.dog);
          setPhotoUrl(payload.photoUrl);
          setViewState("candidate");
          return;
        case "no_own_dog":
          setCandidate(null);
          setPhotoUrl(null);
          setViewState("no_own_dog");
          return;
        case "no_candidates":
          setCandidate(null);
          setPhotoUrl(null);
          setViewState("no_candidates");
          return;
        case "unauthenticated":
          setLoadError("Sesja wygasła. Odśwież stronę i zaloguj się ponownie.");
          return;
        case "error":
          setLoadError(payload.message ?? "Nie udało się wczytać kolejnego profilu.");
          return;
      }
    } catch {
      setLoadError("Nie udało się wczytać kolejnego profilu. Spróbuj ponownie.");
    }
  }, []);

  const loadNextCandidate = useCallback(async () => {
    setLoadError(null);
    setSwipeError(null);
    setPendingSwipe(null);
    setViewState("loading");
    await fetchNextCandidate();
  }, [fetchNextCandidate]);

  useEffect(() => {
    // fetch-on-mount data loading; the compiler heuristic can't see that every setState
    // inside fetchNextCandidate runs after an `await`, so it flags this call as if it were synchronous.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchNextCandidate();
  }, [fetchNextCandidate]);

  const submitSwipe = useCallback(
    async (request: SwipeRequest) => {
      if (!candidate || isSubmitting) {
        return;
      }

      setIsSubmitting(true);
      setSwipeError(null);
      setPendingSwipe(request);

      try {
        const response = await fetch("/api/swipes", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
        });
        const payload = await readJsonResponse<SwipeResponse>(response);

        if (!payload) {
          throw new Error("Missing swipe response body");
        }

        switch (payload.status) {
          case "ok":
            setShowMatchBanner(payload.matched);
            await loadNextCandidate();
            return;
          case "already_swiped":
            setShowMatchBanner(false);
            await loadNextCandidate();
            return;
          case "no_own_dog":
            setCandidate(null);
            setPhotoUrl(null);
            setPendingSwipe(null);
            setShowMatchBanner(false);
            setViewState("no_own_dog");
            return;
          case "invalid":
            setSwipeError("Nie udało się zapisać tej decyzji. Spróbuj ponownie.");
            setViewState("swipe_error");
            return;
          case "unauthenticated":
            setSwipeError("Sesja wygasła. Odśwież stronę i zaloguj się ponownie.");
            setViewState("swipe_error");
            return;
          case "error":
            setSwipeError(payload.message ?? "Nie udało się zapisać tej decyzji. Spróbuj ponownie.");
            setViewState("swipe_error");
            return;
        }
      } catch {
        setSwipeError("Wystąpił problem z połączeniem. Spróbuj ponownie.");
        setViewState("swipe_error");
      } finally {
        setIsSubmitting(false);
      }
    },
    [candidate, isSubmitting, loadNextCandidate],
  );

  function handleSwipe(decision: SwipeDecision) {
    if (!candidate) {
      return;
    }

    void submitSwipe({
      targetDogId: candidate.id,
      decision,
    });
  }

  function handleRetrySwipe() {
    if (!pendingSwipe) {
      return;
    }

    void submitSwipe(pendingSwipe);
  }

  function renderCandidateCard() {
    if (!candidate) {
      return null;
    }

    const trimmedDescription = candidate.description?.trim();
    const hasDescription = trimmedDescription !== undefined && trimmedDescription.length > 0;
    const description = hasDescription ? trimmedDescription : "Ten psiak jeszcze nie ma opisu.";
    const temperament = candidate.temperament ?? [];
    const interests = candidate.interests ?? [];
    const activityLevelLabel = candidate.activity_level ? activityLevelLabels[candidate.activity_level] : null;

    return (
      <Card className="mx-auto w-full max-w-4xl">
        <CardHeader>
          <p className="text-muted-foreground text-xs tracking-[0.3em] uppercase">Przeglądaj profile</p>
          <CardTitle className="text-3xl font-bold">Poznaj nowego psiaka</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {showMatchBanner ? (
            <Alert role="status" className="border-success/30 bg-success/10">
              <AlertDescription className="text-success flex w-full items-start justify-between gap-3">
                <span>To dopasowanie! Wasze psy polubiły się nawzajem.</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="hover:bg-success/15 h-auto px-2 py-1 text-current hover:text-current"
                  onClick={() => {
                    setShowMatchBanner(false);
                  }}
                >
                  <X className="size-4" />
                  Zamknij
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {viewState === "swipe_error" && swipeError ? (
            <Alert variant="destructive">
              <AlertDescription className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{swipeError}</span>
                <Button type="button" variant="outline" size="sm" onClick={handleRetrySwipe} disabled={isSubmitting}>
                  <RefreshCcw className="size-4" />
                  Spróbuj ponownie
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <div
              className={cn(
                "bg-muted flex aspect-square items-center justify-center overflow-hidden rounded-2xl border",
                photoUrl ? "p-0" : "p-6",
              )}
            >
              {photoUrl ? (
                <img src={photoUrl} alt={`Zdjęcie psa ${candidate.name}`} className="h-full w-full object-cover" />
              ) : (
                <div className="text-muted-foreground flex flex-col items-center gap-3 text-center">
                  <PawPrint className="size-10" />
                  <p className="text-sm">Ten psiak nie dodał jeszcze zdjęcia.</p>
                </div>
              )}
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold">{candidate.name}</h2>
                  <Badge variant="secondary">
                    {candidate.age_years} {getAgeLabel(candidate.age_years)}
                  </Badge>
                  {candidate.breed ? <Badge variant="outline">{candidate.breed}</Badge> : null}
                  {activityLevelLabel ? <Badge variant="outline">{activityLevelLabel}</Badge> : null}
                </div>
                <p className="text-muted-foreground leading-relaxed">{description}</p>
              </div>

              {temperament.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Temperament</h3>
                  <div className="flex flex-wrap gap-2">
                    {temperament.map((trait) => (
                      <Badge key={trait} variant="secondary">
                        {trait}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <h3 className="text-sm font-medium">Zainteresowania</h3>
                {interests.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {interests.map((interest) => (
                      <Badge key={interest} variant="outline">
                        {interestLabels[interest] ?? interest}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Ten psiak nie dodał jeszcze zainteresowań.</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 border-t pt-6 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full sm:flex-1"
            onClick={() => {
              handleSwipe("pass");
            }}
            disabled={isSubmitting}
          >
            <X className="size-4" />
            Pomiń
          </Button>
          <Button
            type="button"
            size="lg"
            className="w-full sm:flex-1"
            onClick={() => {
              handleSwipe("like");
            }}
            disabled={isSubmitting}
          >
            <Heart className="size-4" />
            Lubię
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (viewState === "no_own_dog") {
    return (
      <Card className="mx-auto w-full max-w-3xl">
        <CardHeader>
          <p className="text-muted-foreground text-xs tracking-[0.3em] uppercase">Przeglądaj profile</p>
          <CardTitle className="text-3xl font-bold">Najpierw uzupełnij profil swojego psa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Aby przeglądać inne psy, najpierw utwórz profil swojego pupila w panelu właściciela.
          </p>
          <Button asChild>
            <a href="/dashboard/dog">Przejdź do profilu psa</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (viewState === "no_candidates") {
    return (
      <Card className="mx-auto w-full max-w-3xl">
        <CardHeader>
          <p className="text-muted-foreground text-xs tracking-[0.3em] uppercase">Przeglądaj profile</p>
          <CardTitle className="text-3xl font-bold">Brak nowych profili do przejrzenia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            To już wszystkie dostępne psy na teraz. Wróć później, gdy pojawią się nowe profile.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (viewState === "candidate" || viewState === "swipe_error") {
    return renderCandidateCard();
  }

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <p className="text-muted-foreground text-xs tracking-[0.3em] uppercase">Przeglądaj profile</p>
        <CardTitle className="text-3xl font-bold">Szukamy kolejnego psiaka</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-muted-foreground flex items-center gap-3">
          <LoaderCircle className="size-5 animate-spin" />
          <p>Ładujemy kolejny profil do przejrzenia...</p>
        </div>

        {loadError ? (
          <Alert variant="destructive">
            <AlertDescription className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{loadError}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadNextCandidate()}>
                <RefreshCcw className="size-4" />
                Spróbuj ponownie
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
