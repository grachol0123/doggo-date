import React, { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, PawPrint, RefreshCcw, SendHorizontal } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { messageBounds } from "@/lib/schemas/message";
import { createBrowserClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";
import type { Dog, Message } from "@/types";

type MessageThreadViewState = "loading" | "not_participant" | "error" | "ready";

interface Props {
  accessToken: string | null;
  matchId: string;
}

interface ThreadMessage {
  id: Message["id"];
  body: Message["body"];
  createdAt: Message["created_at"];
  senderDogId: Message["sender_dog_id"];
  isMine: boolean;
}

type LoadThreadResponse =
  | { status: "ok"; otherDog: Dog; otherDogPhotoUrl: string | null; messages: ThreadMessage[] }
  | { status: "not_participant" }
  | { status: "unauthenticated" }
  | { status: "invalid_request" }
  | { status: "error"; message?: string };

type SendThreadResponse =
  | { status: "ok"; message: ThreadMessage }
  | { status: "not_participant" }
  | { status: "unauthenticated" }
  | { status: "invalid_body" }
  | { status: "error"; message?: string };

const threadDateFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
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

function formatMessageDate(createdAt: string) {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return createdAt;
  }

  return threadDateFormatter.format(date);
}

async function readJsonResponse<T>(response: Response) {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export default function MessageThread({ accessToken, matchId }: Props) {
  const [viewState, setViewState] = useState<MessageThreadViewState>("loading");
  const [otherDog, setOtherDog] = useState<Dog | null>(null);
  const [otherDogPhotoUrl, setOtherDogPhotoUrl] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmedDraftBody = useMemo(() => draftBody.trim(), [draftBody]);
  const remainingCharacters = messageBounds.body.max - draftBody.length;

  const appendIncomingMessage = useCallback(
    (incomingMessage: Pick<Message, "id" | "body" | "created_at" | "sender_dog_id">) => {
      setMessages((currentMessages) => {
        if (currentMessages.some((message) => message.id === incomingMessage.id)) {
          return currentMessages;
        }

        return [
          ...currentMessages,
          {
            id: incomingMessage.id,
            body: incomingMessage.body,
            createdAt: incomingMessage.created_at,
            senderDogId: incomingMessage.sender_dog_id,
            isMine: incomingMessage.sender_dog_id !== otherDog?.id,
          },
        ];
      });
    },
    [otherDog?.id],
  );

  const loadThread = useCallback(async () => {
    setViewState("loading");
    setLoadError(null);
    setSubmitError(null);

    try {
      const response = await fetch(`/api/messages?matchId=${encodeURIComponent(matchId)}`, {
        headers: {
          Accept: "application/json",
        },
      });
      const payload = await readJsonResponse<LoadThreadResponse>(response);

      if (!payload) {
        throw new Error("Missing message thread response body");
      }

      switch (payload.status) {
        case "ok":
          setOtherDog(payload.otherDog);
          setOtherDogPhotoUrl(payload.otherDogPhotoUrl);
          setMessages(payload.messages);
          setViewState("ready");
          return;
        case "not_participant":
          setOtherDog(null);
          setOtherDogPhotoUrl(null);
          setMessages([]);
          setViewState("not_participant");
          return;
        case "unauthenticated":
          setOtherDog(null);
          setOtherDogPhotoUrl(null);
          setMessages([]);
          setLoadError("Sesja wygasła. Odśwież stronę i zaloguj się ponownie.");
          setViewState("error");
          return;
        case "invalid_request":
          setOtherDog(null);
          setOtherDogPhotoUrl(null);
          setMessages([]);
          setLoadError("Nieprawidłowy identyfikator rozmowy.");
          setViewState("error");
          return;
        case "error":
          setOtherDog(null);
          setOtherDogPhotoUrl(null);
          setMessages([]);
          setLoadError(payload.message ?? "Nie udało się wczytać wiadomości.");
          setViewState("error");
          return;
      }
    } catch {
      setOtherDog(null);
      setOtherDogPhotoUrl(null);
      setMessages([]);
      setLoadError("Nie udało się wczytać wiadomości. Spróbuj ponownie.");
      setViewState("error");
    }
  }, [matchId]);

  useEffect(() => {
    // Fetch-on-mount data loading; the compiler heuristic can't see that every setState
    // inside loadThread runs after an `await`, so it flags this call as if it were synchronous.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadThread();
  }, [loadThread]);

  useEffect(() => {
    if (viewState !== "ready" || !otherDog || !accessToken) {
      return;
    }

    const browserClient = createBrowserClient();

    if (!browserClient) {
      return;
    }

    void browserClient.realtime.setAuth(accessToken);

    const channel = browserClient
      .channel(`messages:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          appendIncomingMessage(payload.new as Pick<Message, "id" | "body" | "created_at" | "sender_dog_id">);
        },
      )
      .subscribe();

    return () => {
      void browserClient.removeChannel(channel);
    };
  }, [accessToken, appendIncomingMessage, matchId, otherDog, viewState]);

  const sendMessage = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    if (trimmedDraftBody.length < messageBounds.body.min) {
      setSubmitError("Wiadomość nie może być pusta.");
      return;
    }

    if (trimmedDraftBody.length > messageBounds.body.max) {
      setSubmitError(`Wiadomość może mieć maksymalnie ${messageBounds.body.max} znaków.`);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matchId,
          body: trimmedDraftBody,
        }),
      });
      const payload = await readJsonResponse<SendThreadResponse>(response);

      if (!payload) {
        throw new Error("Missing send message response body");
      }

      switch (payload.status) {
        case "ok":
          setMessages((currentMessages) => {
            if (currentMessages.some((message) => message.id === payload.message.id)) {
              return currentMessages;
            }

            return [...currentMessages, payload.message];
          });
          setDraftBody("");
          return;
        case "not_participant":
          setViewState("not_participant");
          return;
        case "unauthenticated":
          setSubmitError("Sesja wygasła. Odśwież stronę i zaloguj się ponownie.");
          return;
        case "invalid_body":
          setSubmitError(
            `Wiadomość musi mieć od ${messageBounds.body.min} do ${messageBounds.body.max} znaków po usunięciu spacji z początku i końca.`,
          );
          return;
        case "error":
          setSubmitError(payload.message ?? "Nie udało się wysłać wiadomości. Spróbuj ponownie.");
          return;
      }
    } catch {
      setSubmitError("Wystąpił problem z połączeniem. Spróbuj ponownie.");
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, matchId, trimmedDraftBody]);

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  if (viewState === "not_participant") {
    return (
      <Card className="mx-auto w-full max-w-4xl">
        <CardHeader>
          <p className="text-muted-foreground text-xs tracking-[0.3em] uppercase">Wiadomości</p>
          <CardTitle className="text-3xl font-bold">Nie masz dostępu do tej rozmowy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Ten wątek nie należy do Twoich dopasowań albo został już usunięty.</p>
          <Button asChild>
            <a href="/dashboard/matches">Wróć do dopasowań</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (viewState === "error") {
    return (
      <Card className="mx-auto w-full max-w-4xl">
        <CardHeader>
          <p className="text-muted-foreground text-xs tracking-[0.3em] uppercase">Wiadomości</p>
          <CardTitle className="text-3xl font-bold">Nie udało się wczytać rozmowy</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{loadError ?? "Wystąpił problem z połączeniem."}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadThread()}>
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
      <Card className="mx-auto w-full max-w-4xl">
        <CardHeader>
          <p className="text-muted-foreground text-xs tracking-[0.3em] uppercase">Wiadomości</p>
          <CardTitle className="text-3xl font-bold">Ładujemy rozmowę</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground flex items-center gap-3">
            <LoaderCircle className="size-5 animate-spin" />
            <p>Pobieramy historię wiadomości i sprawdzamy nowe odpowiedzi.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-4xl">
      <CardHeader className="border-b">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "bg-muted flex size-16 items-center justify-center overflow-hidden rounded-full border",
                otherDogPhotoUrl ? "p-0" : "p-4",
              )}
            >
              {otherDogPhotoUrl ? (
                <img
                  src={otherDogPhotoUrl}
                  alt={`Zdjęcie psa ${otherDog?.name}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <PawPrint className="text-muted-foreground size-7" />
              )}
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs tracking-[0.3em] uppercase">Wiadomości</p>
              <CardTitle className="text-3xl font-bold">{otherDog?.name}</CardTitle>
              <p className="text-muted-foreground text-sm">
                {otherDog?.age_years} {getAgeLabel(otherDog?.age_years ?? 0)}
                {otherDog?.breed ? ` • ${otherDog.breed}` : ""}
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={() => void loadThread()}>
            <RefreshCcw className="size-4" />
            Odśwież
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 py-6">
        <div className="bg-muted/20 flex min-h-72 flex-col gap-3 rounded-2xl border p-4">
          {messages.length === 0 ? (
            <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-8 text-center">
              <PawPrint className="size-10" />
              <div className="space-y-1">
                <p className="text-foreground font-medium">Tu jeszcze nie ma żadnych wiadomości</p>
                <p className="text-sm">Napisz pierwszą wiadomość i rozpocznij rozmowę.</p>
              </div>
            </div>
          ) : (
            <div className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto pr-1">
              {messages.map((message) => (
                <div key={message.id} className={cn("flex", message.isMine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3 shadow-xs sm:max-w-[75%]",
                      message.isMine ? "bg-primary text-primary-foreground" : "bg-background border",
                    )}
                  >
                    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{message.body}</p>
                    <p
                      className={cn(
                        "mt-2 text-right text-xs",
                        message.isMine ? "text-primary-foreground/80" : "text-muted-foreground",
                      )}
                    >
                      {formatMessageDate(message.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {submitError ? (
          <Alert variant="destructive">
            <AlertDescription className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{submitError}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void sendMessage()}
                disabled={isSubmitting}
              >
                <RefreshCcw className="size-4" />
                Spróbuj ponownie
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>

      <CardFooter className="border-t py-6">
        <form className="w-full space-y-3" onSubmit={handleSubmit} noValidate>
          <div className="space-y-2">
            <label htmlFor="message-body" className="text-sm font-medium">
              Nowa wiadomość
            </label>
            <Textarea
              id="message-body"
              value={draftBody}
              onChange={(event) => {
                setDraftBody(event.target.value);
                if (submitError) {
                  setSubmitError(null);
                }
              }}
              placeholder="Napisz wiadomość do właściciela tego psiaka..."
              rows={4}
              maxLength={messageBounds.body.max}
              disabled={isSubmitting}
            />
            <p
              className={cn(
                "text-right text-xs",
                remainingCharacters < 0 ? "text-destructive" : "text-muted-foreground",
              )}
            >
              Pozostało {remainingCharacters} znaków
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-sm">Wiadomość trafi do rozmowy po potwierdzeniu przez serwer.</p>
            <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
              {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
              Wyślij wiadomość
            </Button>
          </div>
        </form>
      </CardFooter>
    </Card>
  );
}
