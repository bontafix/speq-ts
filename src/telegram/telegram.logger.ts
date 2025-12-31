function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function clip(s: string, maxLen = 500): string {
  const t = oneLine(s);
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(0, maxLen - 1))}…`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function logIncoming(args: {
  telegramId: number | undefined;
  username: string | undefined;
  kind: "text" | "callback" | "other";
  payload: string;
}) {
  // eslint-disable-next-line no-console
  console.log(
    `${nowIso()} [IN ] tg=${args.telegramId ?? "?"} @${args.username ?? "-"} ${args.kind}: ${clip(args.payload)}`,
  );
}

export function logOutgoing(args: {
  telegramId: number | undefined;
  username: string | undefined;
  kind: "reply" | "edit";
  payload: string;
}) {
  // eslint-disable-next-line no-console
  console.log(
    `${nowIso()} [OUT] tg=${args.telegramId ?? "?"} @${args.username ?? "-"} ${args.kind}: ${clip(args.payload)}`,
  );
}


