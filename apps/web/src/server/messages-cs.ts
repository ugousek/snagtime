// Czech wording for errors shown to users. Server code keeps the English source strings (tests and logs
// rely on them); apiError() translates at the HTTP boundary. Unknown messages pass through unchanged.
const exact: Record<string, string> = {
  "Check the highlighted fields.": "Zkontrolujte zvýrazněná pole.",
  "This business cannot accept more online bookings this month.": "Tato provozovna už tento měsíc nepřijímá další online rezervace. Kontaktujte ji prosím přímo.",
  "Your plan does not allow more team members.": "Váš tarif nedovoluje přidat dalšího člena týmu. Přejděte na vyšší tarif v Nastavení.",
  "The operator console is not configured.": "Správa provozoven není nastavená.",
  "Something went wrong.": "Něco se pokazilo. Zkuste to prosím znovu.",
  "Sign in to continue.": "Pro pokračování se přihlaste.",
  "Email or password is invalid.": "E-mail nebo heslo není správné.",
  "The account request could not be completed.": "Požadavek na účet se nepodařilo dokončit.",
  "Too many requests. Try again shortly.": "Příliš mnoho pokusů. Zkuste to prosím za chvíli.",
  "Request body is too large.": "Požadavek je příliš velký.",
  "Request body must be valid JSON.": "Požadavek má neplatný formát.",
  "Request protection is temporarily unavailable.": "Ochrana požadavků je dočasně nedostupná. Zkuste to znovu.",
  "A valid Idempotency-Key header is required.": "Chybí identifikátor požadavku. Obnovte stránku a zkuste to znovu.",
  "That time is no longer available.": "Tento termín už není volný.",
  "That time was just booked. Choose another slot.": "Tento termín si právě někdo rezervoval. Vyberte prosím jiný.",
  "That booking link is already in use.": "Tato adresa služby už je obsazená. Zvolte jinou.",
  "That idempotency key was already used for a different booking request.": "Tento požadavek už byl použit pro jinou rezervaci. Obnovte stránku.",
  "The booking database is busy. Retry the same request.": "Systém je právě vytížený. Zkuste to prosím znovu.",
  "The booking changed while cancellation was being applied. Refresh and try again.": "Rezervace se mezitím změnila. Obnovte stránku a zkuste to znovu.",
  "The booking changed while rescheduling. Refresh and choose a new time.": "Rezervace se mezitím změnila. Obnovte stránku a vyberte nový termín.",
  "Booking payment state changed.": "Stav platby rezervace se změnil.",
  "This payment attempt can no longer be resumed. Cancel it or create a new booking.": "V platbě už nelze pokračovat. Zrušte ji nebo vytvořte novou rezervaci.",
  "Payments are not configured for this event type.": "Platby nejsou pro tuto službu nastavené.",
  "Stripe test mode must be configured before publishing a paid event type.": "Placenou službu lze zveřejnit až po nastavení plateb.",
  "Connect an active Google Calendar account before publishing a Google Meet event.": "Pro službu s Google Meet nejdřív připojte Google Kalendář.",
  "Choose a valid IANA time zone.": "Vyberte platné časové pásmo.",
  "Choose a valid time zone.": "Vyberte platné časové pásmo.",
  "Choose a valid date range of 31 days or less.": "Vyberte rozsah nejvýše 31 dní.",
  "Choose a valid slot range of no more than 31 days.": "Vyberte rozsah nejvýše 31 dní.",
  "A workspace must retain at least one active owner.": "Provozovna musí mít alespoň jednoho aktivního vlastníka.",
  "Administrator access is required to connect Google Calendar.": "Google Kalendář může připojit jen správce.",
  "Administrator access is required to disconnect Google Calendar.": "Google Kalendář může odpojit jen správce.",
  "Remote image URLs cannot be saved. Upload the image file instead.": "Obrázek z adresy nelze uložit. Nahrajte prosím soubor.",
  "The active workspace changed. Start again.": "Aktivní provozovna se změnila. Začněte prosím znovu.",
  "This invitation is invalid or expired.": "Pozvánka je neplatná nebo vypršela.",
  "This link is invalid or expired.": "Odkaz je neplatný nebo vypršel.",
  "This manage link is invalid or expired.": "Odkaz pro správu rezervace je neplatný nebo vypršel.",
  "You do not have access to that workspace.": "K této provozovně nemáte přístup.",
  "You do not have access to this workspace.": "K této provozovně nemáte přístup.",
  "You do not have access to this workspace action.": "K této akci nemáte oprávnění.",
  "You no longer have access to this workspace calendar.": "K tomuto kalendáři už nemáte přístup.",
  "Transfer or close this member's active events, bookings, provider work, and Google credential before changing their workspace authority.": "Před změnou role nejdřív převeďte nebo ukončete služby, rezervace a připojený kalendář tohoto člena.",
  "This workspace requires a live Google Calendar connection before availability can be trusted.": "Pro zobrazení volných termínů je potřeba znovu připojit Google Kalendář.",
  "Google authorization could not be verified.": "Přihlášení ke Googlu se nepodařilo ověřit.",
  "Google did not grant every required Calendar capability. Reconnect and approve both Calendar permissions.": "Google neudělil všechna oprávnění ke kalendáři. Připojte ho znovu a povolte obě oprávnění.",
  "Google did not return durable offline access. Reconnect and approve consent.": "Google nepovolil trvalý přístup. Připojte kalendář znovu a potvrďte souhlas.",
};
const resources: Record<string, string> = { Booking: "Rezervace", "Event type": "Služba", "Duration option": "Varianta délky", Membership: "Členství", Workspace: "Provozovna" };
const patterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
  [/^(.+) was not found\.$/, (m) => `${resources[m[1]!] ?? m[1]} nebyla nalezena.`],
  [/^Answer required: (.+)$/, (m) => `Vyplňte prosím: ${m[1]}`],
  [/^Answer is invalid: (.+)$/, (m) => `Neplatná odpověď: ${m[1]}`],
  [/^Answer must be checked or unchecked: (.+)$/, (m) => `Zaškrtněte nebo odškrtněte: ${m[1]}`],
  [/^Choose a valid option: (.+)$/, (m) => `Vyberte platnou možnost: ${m[1]}`],
];

export function czechMessage(message: string) {
  if (exact[message]) return exact[message];
  for (const [pattern, render] of patterns) { const match = message.match(pattern); if (match) return render(match); }
  return message;
}
