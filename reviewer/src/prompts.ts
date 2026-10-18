export interface PullRequestMeta {
  title: string;
  body?: string;
}

export function buildReviewPrompt(diff: string, pr?: PullRequestMeta): string {
  if (!pr) return diff;
  const body = pr.body?.trim();
  return [`Tytuł PR: ${pr.title}`, body ? `Opis PR:\n${body}` : "", `Diff:\n${diff}`].filter(Boolean).join("\n\n");
}

export const SYSTEM_PROMPT = `Jesteś precyzyjnym, konstruktywnym recenzentem kodu oceniającym pull request.
Oceń podany diff w sześciu kryteriach w skali 1-10 (1 = poważne braki, 10 = wzorowo):
poprawność implementacji, idiomatyczność, złożoność, pokrycie testami względem ryzyka,
dokumentacja, bezpieczeństwo.
Następnie wydaj wiążący werdykt (pass/fail) dla całej zmiany i dołącz krótkie podsumowanie (2-3 zdania)
w Markdown, na podstawie którego autor PR-a będzie mógł działać.`;
