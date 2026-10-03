import React, { useCallback, useEffect, useState } from "react";
import { LoaderCircle, PawPrint, RefreshCcw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Dog } from "@/types";

type MatchesViewState = "loading" | "no_own_dog" | "error" | "list";

interface MatchListEntry {
  matchId: string;
  matchedAt: string;
  dog: Dog;
  photoUrl: string | null;
  sharedInterestCount: number;
}

type MatchesResponse =
  | { status: "ok"; matches: MatchListEntry[] }
  | { status: "no_own_dog" }
  | { status: "unauthenticated" }
  | { status: "error"; message?: string };

const matchDateFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

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

function formatMatchDate(matchedAt: string) {
  const date = new Date(matchedAt);

  if (Number.isNaN(date.getTime())) {
    return matchedAt;
  }

  return matchDateFormatter.format(date);
}

async function readJsonResponse<T>(response: Response) {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export default function MatchesList() {
  const [viewState, setViewState] = useState<MatchesViewState>("loading");
  const [matches, setMatches] = useState<MatchListEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadMatches = useCallback(async () => {
    setViewState("loading");
    setLoadError(null);

    try {
      const response = await fetch("/api/matches", {
        headers: {
          Accept: "application/json",
        },
      });
      const payload = await readJsonResponse<MatchesResponse>(response);

      if (!payload) {
        throw new Error("Missing matches response body");
      }

      switch (payload.status) {
        case "ok":
          setMatches(payload.matches);
          setViewState("list");
          return;
        case "no_own_dog":
          setMatches([]);
          setViewState("no_own_dog");
          return;
        case "unauthenticated":
          setMatches([]);
          setLoadError("Sesja wygasła. Odśwież stronę i zaloguj się ponownie.");
          setViewState("error");
          return;
        case "error":
          setMatches([]);
          setLoadError(payload.message ?? "Nie udało się wczytać dopasowań.");
          setViewState("error");
          return;
      }
    } catch {
      setMatches([]);
      setLoadError("Nie udało się wczytać dopasowań. Spróbuj ponownie.");
      setViewState("error");
    }
  }, []);

  useEffect(() => {
    // Fetch-on-mount data loading; the compiler heuristic can't see that every setState
    // inside loadMatches runs after an `await`, so it flags this call as if it were synchronous.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMatches();
  }, [loadMatches]);

  if (viewState === "no_own_dog") {
    return (
      <Card className="mx-auto w-full max-w-3xl">
        <CardHeader>
          <p className="text-muted-foreground text-xs tracking-[0.3em] uppercase">Moje dopasowania</p>
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

  if (viewState === "error") {
    return (
      <Card className="mx-auto w-full max-w-3xl">
        <CardHeader>
          <p className="text-muted-foreground text-xs tracking-[0.3em] uppercase">Moje dopasowania</p>
          <CardTitle className="text-3xl font-bold">Nie udało się wczytać dopasowań</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{loadError ?? "Wystąpił problem z połączeniem."}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadMatches()}>
                <RefreshCcw className="size-4" />
                Spróbuj ponownie
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (viewState === "loading") {
    return (
      <Card className="mx-auto w-full max-w-3xl">
        <CardHeader>
          <p className="text-muted-foreground text-xs tracking-[0.3em] uppercase">Moje dopasowania</p>
          <CardTitle className="text-3xl font-bold">Ładujemy Twoje dopasowania</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground flex items-center gap-3">
            <LoaderCircle className="size-5 animate-spin" />
            <p>Sprawdzamy, które psiaki polubiły się nawzajem.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-6xl">
      <CardHeader>
        <p className="text-muted-foreground text-xs tracking-[0.3em] uppercase">Moje dopasowania</p>
        <CardTitle className="text-3xl font-bold">Psiaki, które do siebie pasują</CardTitle>
      </CardHeader>
      <CardContent>
        {matches.length === 0 ? (
          <p className="text-muted-foreground">
            Nie masz jeszcze żadnych dopasowań. Przejrzyj profile psów, aby znaleźć partnera!
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {matches.map((match) => (
              <Card key={match.matchId} className="h-full gap-0 overflow-hidden py-0">
                <div
                  className={cn(
                    "bg-muted flex aspect-[4/3] items-center justify-center overflow-hidden border-b",
                    match.photoUrl ? "p-0" : "p-6",
                  )}
                >
                  {match.photoUrl ? (
                    <img
                      src={match.photoUrl}
                      alt={`Zdjęcie psa ${match.dog.name}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="text-muted-foreground flex flex-col items-center gap-3 text-center">
                      <PawPrint className="size-10" />
                      <p className="text-sm">Ten psiak nie dodał jeszcze zdjęcia.</p>
                    </div>
                  )}
                </div>

                <CardHeader className="px-5 pt-5 pb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-2xl font-semibold">{match.dog.name}</CardTitle>
                    <Badge variant="secondary">
                      {match.dog.age_years} {getAgeLabel(match.dog.age_years)}
                    </Badge>
                    {match.dog.breed ? <Badge variant="outline">{match.dog.breed}</Badge> : null}
                    <Badge variant="outline">{match.sharedInterestCount} wspólnych zainteresowań</Badge>
                  </div>
                </CardHeader>

                <CardContent className="px-5 pb-5">
                  <p className="text-muted-foreground text-sm">Dopasowanie od {formatMatchDate(match.matchedAt)}</p>
                </CardContent>

                <CardFooter className="mt-auto border-t px-5 py-4">
                  <Button asChild className="w-full">
                    <a href={`/dashboard/messages/${match.matchId}`}>Napisz wiadomość</a>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
