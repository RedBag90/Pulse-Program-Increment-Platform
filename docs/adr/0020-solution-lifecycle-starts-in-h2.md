# ADR-0020: Der Lebenszyklus einer Solution beginnt in H2

- Status: accepted
- Date: 2026-09-10

## Context

Das Modell trug zwei Aussagen über H3, die einander widersprachen.

Die eine steht als Erklärtext an der Horizont-Achse selbst und ist in jedem
Tooltip und jeder Legende zu lesen —
`src/modules/work/domain/portfolio-guardrails.ts`:

> „Evaluating / R&D — **noch keine Solution**, nur Ideen, Spikes und
> Prototypen."

Dieselbe Aussage steht in `docs/concepts/portfolio-setup-walkthrough.md`: R&D
heisst „Anwärter, noch keine eigene Solution".

Die andere steht im Code daneben: `SOLUTION_STATUSES` kannte den Wert `rd`, der
Anlege-Dialog bot ihn an, die Lebenszyklus-Leiste sprang ihn an, das
Zod-Schema liess ihn durch, und der Service speicherte ihn ohne Rückfrage. Die
Seeds legten folgerichtig H3-Solutions an — gemessen am 2026-09-10 hingen
**58 von 176 Epics** in `Large Test Corp` an einer solchen, `Pulse Demo Corp`
trug drei weitere, und im Offsite-Mandanten war die **einzige** Solution eine
H3.

Fachlich ist die erste Aussage die richtige. Eine Solution ist das langlebige
Produkt zwischen Wertstrom und Epic: sie verursacht Betriebskosten
(`RunTheBusinessItem.solutionId`), sie hat einen Produkt-Manager, der bei den
Reifegrad-Abnahmen ihrer Epics mitzeichnet, und sie trägt eine Grow-/Run-Rechnung.
In H3 gibt es nichts davon. Dort wird geforscht, und ob daraus je ein Produkt
wird, ist offen — genau deshalb steht dort ein Vorhaben und kein Produkt.

Zwei Vorarbeiten machen die Trennung überhaupt tragfähig:

- **ADR-0019 / `epic-horizon.ts`** löst den Horizont eines Epics als „explizit
  schlägt abgeleitet" auf. Ein Epic **ohne** Solution ist damit kein Sonderfall
  mehr, sondern ein regulärer Zustand mit einem benannten Autor.
- **`stampsForAdvance`** friert den Horizont bei L3.1 **set-once** ein: ein von
  Hand gesetzter Wert wird nicht überschrieben. Ein R&D-Epic lief also schon
  vorher korrekt durch alle Tore — es gab nur keines.

## Decision

**Eine Solution existiert frühestens in H2.** `SOLUTION_STATUSES` verliert den
Wert `rd`; die Leiter beginnt bei `emerging` und hat vier Stufen über drei
Horizonte:

```
H2 Emerging → H1.1 Investing ⇄ H1.2 Extracting → H0 Decommissioning
                    ↑ das Beförderungs-Tor mit den vier Kriterien
```

Daraus folgt:

1. **Ein neuer Typ trennt die zwei Achsen.**
   `SolutionHorizon = Exclude<Horizon, "h3">` steht neben dem unveränderten
   `Horizon`. Der Horizont eines **Vorhabens** und der Lebenszyklus eines
   **Produkts** sind zwei Skalen; sie überlappen sich in H2, H1 und H0.
2. **`Emerging → Decommissioning` ersetzt die Rückwärts-Kante nach H3.** Ein
   Anwärter, der sich nicht bewährt, wird geordnet stillgelegt statt in einen
   Zustand zurückgeschoben, den es nicht mehr gibt. Aus H0 führt bereits ein Weg
   zurück ins Investieren — der Fall bleibt umkehrbar, die Historie sichtbar.
3. **Die Guardrail bleibt vierwertig.** `HORIZONS` und `STATIONS` sind
   unverändert; die H3-Quote misst weiter, künftig Epics mit eigenem Horizont
   statt Epics an einer H3-Solution. Ein R&D-Vorhaben trägt
   `Initiative.investmentHorizon = "h3"`.
4. **Die Regel steht in der Domäne, nicht in der Spalte.** `Solution.horizon`
   bleibt ein freier String ohne CHECK-Constraint — dort liesse sich die
   Begründung nicht mitlesen, und ein Constraint machte den Altbestand
   unlesbar statt ihn zu deuten.

## Consequences

- **Die Kanten werden jetzt geprüft.** `setSolutionLifecycle` liess bis hierher
  **jeden** Sprung zu, auch `Decommissioning → R&D`: `SOLUTION_TRANSITIONS`
  existierte allein in der Lebenszyklus-Leiste. Ohne diesen Guard wäre „keine
  Solution in H3" eine reine UI-Zusage geblieben. `createSolution` und
  `updateSolution` weisen H3 mit sprechendem Grund ab — im Stil, den
  `promoteSolution` für das Beförderungs-Tor schon vorgab.
- **Eine Quelle statt zweier.** Das Zod-Schema der Solution-Actions führte die
  Statusliste abgeschrieben; genau deshalb hing `rd` an drei Actions
  gleichzeitig. Es leitet sich jetzt aus `SOLUTION_STATUSES` ab.
- **Altbestand wird gedeutet, nicht verschoben.** Ein gespeichertes `h3` liest
  sich als _Emerging_ — der Anwärter bleibt ein Anwärter. Ein Backfill, der die
  Zeile nach H2 verschöbe, würde **alle nicht eingefrorenen Epics still
  mitziehen**; das ist genau die rückwirkende Umschreibung, gegen die
  `epic-horizon.ts` gebaut wurde. Wer ihn will, materialisiert zuerst
  `investmentHorizon` an den betroffenen Epics.
- **Ein Beleg zieht um.** Der Fall „kein Produkt-Manager benannt ⇒ der Sitz
  fällt still weg" hing in beiden Story-Mandanten an den H3-Solutions. Er liegt
  jetzt auf je einer H2-Solution — und daneben steht der stärkere Fall: ein
  R&D-Epic hat **gar keine** Solution, und derselbe Sitz fällt ebenso weg.
- **Ein Nebenbefund wurde mitrepariert.** Die Gate-Faltung der Seeds
  (`prisma/seed-gate-history.ts`) reichte `solutionHorizon`/`investmentHorizon`
  hart als `null` durch. Der L3.1-Freeze fand dadurch **nie** statt:
  `investment_horizon` war an jedem geseedeten Epic leer, auch jenseits von
  L3.1. Gemessen nach der Umstellung tragen 123 der 176 Epics in
  `Large Test Corp` einen eingefrorenen Horizont.
- **Der Trichter bleibt unberührt.** Er zeigt Solutions und Solution-lose Epics
  als zwei Symbolsorten auf einer Skala; die H3-Bahn trägt danach nur noch
  Epic-Symbole — fachlich genau das gewünschte Bild, ohne eine Zeile Änderung.

---

## Nachtrag 2026-09-19 — jede Solution braucht ab H2 ein ART

Diese Entscheidung sagt, dass eine Solution **in H2 entsteht**, als „Emerging".
Die Seeds haben daraus gefolgert, dass ein ART erst in H1 sinnvoll ist, und
geben nur den h1-Solutions eines (`seed-demo.ts`, `seed-large.ts`).

Mit `art-budget-consolidation.md` fällt diese Folgerung: **`solutions.art_id`
wird Pflicht**, und damit braucht auch eine gerade entstehende Solution von
Anfang an ein ART. Der Grund liegt im Geld, nicht im Lebenszyklus — eine
Betriebsposition an einer Solution löst sich über deren ART auf, und ohne ART
bricht dieser Weg.

**Mein Einwand dazu, überstimmt und hier festgehalten**, weil er beim nächsten
Lesen sonst fehlt: die Pflicht verlangt die Zuordnung im **unsichersten
Moment**. In H2 weiß niemand sicher, welcher Zug das bauen wird; das ist der
Punkt von „Emerging". Gemessen löst die Pflicht **eine** heutige Position über
7.500 € je Halbjahr — die Alternative „ART erst ab H1, Position bis dahin
sichtbar offen" hätte dasselbe ohne Schemaänderung erreicht.

Die Entscheidung ist gefallen. Was bleibt: **ein ART in H2 ist eine Absicht,
keine Zusage.** Wer ihn später ändert, korrigiert keine Falschangabe, sondern
folgt dem Erkenntnisstand — und die Fläche soll das nicht wie einen Fehler
aussehen lassen.
