# Ein gelebter Prozess — der Mandant und seine Menschen

Wie aus einer Anfrage ein Arbeitsbereich wird und aus einer E-Mail-Adresse
jemand, der etwas darf. Dreimal erzählt: aus Sicht des **Plattform-Betreibers**,
der den Mandanten anlegt und ihm Module gibt, des **Mandanten-Administrators**,
der Menschen hereinlässt und ihre Rechte setzt, und **des Neuen**, der beitritt
und seine Rolle kennenlernt.

Dies ist der Ablauf **vor** allen anderen. Er hat als einziger eine echte
Zustandsmaschine — Anfrage, Freigabe, Beitritt, Rolle —, und er ist der einzige,
in dem entschieden wird, wer die übrigen acht überhaupt sehen kann.

Elf Dokumente beschreiben die Abläufe von Pulse und verweisen aufeinander:
[Mandant](tenant-onboarding-walkthrough.md) — wer hereinkommt und was er darf ·
[Aufbau](portfolio-setup-walkthrough.md) — woraus alles besteht ·
[Intake](epic-intake-walkthrough.md) — wie eine Idee hereinkommt ·
[Halbjahr](portfolio-cycle-walkthrough.md) — wie der Takt schlägt ·
[Epic](epic-lifecycle-walkthrough.md) — was gebaut wird ·
[Budget](budgeting-walkthrough.md) — womit ·
[ART-Budget](art-epic-budget-walkthrough.md) — womit, wenn es klein ist ·
[PI](pi-walkthrough.md) — wann geliefert wird ·
[Lieferung](delivery-walkthrough.md) — was liefert und was blockiert ·
[Wirkung](benefit-walkthrough.md) — ob es etwas gebracht hat ·
[Risiko](risk-walkthrough.md) — was dazwischenkommt. Den Rahmen führt
[Struktur](structure-walkthrough.md) vor.

## Die gemeinsame Mechanik

### Drei Schranken, nicht eine

Ob jemand eine Fläche sieht, entscheidet sich an **drei** unabhängigen Stellen,
und sie werden regelmäßig verwechselt:

| Schranke                | Was sie regelt                         | Wer sie stellt              |
| ----------------------- | -------------------------------------- | --------------------------- |
| **Entitlement** (Modul) | ob der Mandant den Bereich gebucht hat | der Plattform-Betreiber     |
| **Practice**            | ob der Mandant so arbeiten will        | der Mandant selbst          |
| **Capability** (Recht)  | ob **diese Rolle** es darf             | der Mandanten-Administrator |

Die Regel ist ein **Und**: sichtbar ist, was alle drei zulassen. Und sie ist
**fail-closed** — ein Pfad, den die Registry nicht kennt, ist gesperrt, nicht
offen.

Fünf Module gibt es: `core` (Ziele, Struktur, Administration), `work`
(Portfolio, Epics), `drumbeat` (Umsetzung, PIs, Abhängigkeiten), `budgeting` und
`risks`. Drei davon setzen `work` voraus; ein privater Bereich bekommt nur
`core`, eine Organisation alle fünf.

### Der Default gilt nur, solange nichts gespeichert ist

Das ist die Aussage, die diesen ganzen Text trägt, und sie überrascht jeden
einmal.

Die Rechte einer Rolle stehen zweimal: als **Code-Vorgabe** in `POLICIES` und
als **Zeilen** in der Tabelle `role_capabilities`. Beim Anmelden werden die
Zeilen geladen — und der Rückfall auf die Code-Vorgabe ist
**alles-oder-nichts**:

```
hat der Mandant KEINE Zeile für die Rollen des Nutzers
    → die Code-Vorgabe gilt, vollständig
hat er auch nur EINE
    → sein gespeichertes Bündel gilt, vollständig,
      und die Code-Vorgabe wird gar nicht erst gelesen
```

Das ist kein Fehler, sondern der Preis dafür, dass ein Mandant seine Rollen
selbst schneiden darf. Es hat aber eine Folge, die man kennen muss: **eine neue
Vorgabe im Code erreicht nur die Mandanten, die ihre Rollen nie angefasst
haben.**

> **Gemessen, September 2026.** Als `art.create` vom Tenant-Admin zum Portfolio
> Manager wanderte, erbten **16 von 20** Mandanten das Recht sofort — sie hatten
> keine Zeilen. Von den vier übrigen trug einer es zufällig schon; **drei
> bekamen es nicht** und mussten es unter _Rollen & Capabilities_ nachtragen.

### Wer die drei sind

| Wer                         | Sein Bereich                                         | Recht                                                    |
| --------------------------- | ---------------------------------------------------- | -------------------------------------------------------- |
| **Plattform-Betreiber**     | alle Mandanten: anlegen, Module, Lifecycle           | `platform_admin` — **keine** Capability                  |
| **Mandanten-Administrator** | ein Mandant: Menschen, Rollen, Rechte, Integrationen | `tenant.users.manage`, `role.capability.manage`, …       |
| **Der Neue**                | sich selbst: beitreten, Rolle annehmen, Tour         | `role.onboarding.manage` — **jede** Rolle, auch `viewer` |

> **Die Plattform-Rechte laufen nicht über `authorize()`.** `tenant.create`,
> `platform.tenants.manage` und `platform.users.manage` stehen zwar in der
> `Action`-Union, haben aber eine **leere** Grant-Liste: kein Tenant-Admin-Pfad,
> keine Rolle. Durchgesetzt werden sie allein durch den globalen
> `requirePlatformAdmin`-Wächter; in der Union stehen sie fürs Audit und fürs
> Nav-Gating. Wer die Rollen-Matrix als vollständige Berechtigungs-Doku liest,
> wird hier in die Irre geführt.

---

# 1 · Der Plattform-Betreiber

Meine Frage lautet: **wer bekommt einen Bereich, und was ist darin drin?**

## Die Anfrage

Jemand füllt auf `/request-tenant` das Formular **„Organisation anfragen"** aus.
Bei mir landet das unter **Tenant-Anfragen** (`/platform/provision-requests`) —
„Provisioning-Anträge für neue Organisationen — genehmigen legt den Tenant an
und lädt den Antragsteller ein."

Der Untertitel sagt schon, dass das **eine** Handlung ist und nicht drei: die
Genehmigung erzeugt den Mandanten **und** die Einladung.

## Der Mandant und seine Module

Auf der Detailseite eines Mandanten (`/platform/tenants/[tenantId]`) liegen drei
Abschnitte: **Module**, **Mitglieder**, **Lifecycle**.

**Module** ist der Ort, an dem die erste der drei Schranken gesetzt wird. Was
hier nicht freigeschaltet ist, existiert für diesen Mandanten nicht — die Route
ist gesperrt, nicht bloß leer. Voraussetzungen werden dabei automatisch erfüllt:
wer `budgeting` bucht, bekommt `work` dazu, weil ohne Epics nichts zu
budgetieren wäre.

**Lifecycle** trägt die Zustände eines Mandanten. Ein gesperrter
(`suspended`) leitet seine Nutzer auf eine eigene Seite um; ein stillgelegter
(`archived`) ist der Ersatz fürs Löschen, sobald etwas drinsteht.

## Was ich ausdrücklich nicht tue

Die Beitritts-Anfragen aller Mandanten sehe ich unter `/platform/join-requests`
— „**read-only** — Freigabe beim jeweiligen Tenant-Admin." Ich sehe, dass jemand
anklopft; ich öffne die Tür nicht. Das ist bewusst: wer in einen Bereich
gehört, weiß der Bereich, nicht die Plattform.

---

# 2 · Der Mandanten-Administrator

Meine Frage lautet: **wer arbeitet hier mit, und was darf er?**

## Zwei Wege herein

**Der erste ist die Einladung.** Unter `/admin/users` öffne ich
**„Neue:n Benutzer:in einladen"** und trage E-Mail-Adresse und Rolle ein. Die
Rolle steht damit von Anfang an fest — es gibt keinen rollenlosen Zwischenstand.

**Der zweite ist der Selbst-Beitritt.** Unter `/admin/anfragen` —
„Offener Einladungslink und Beitrittscode für diesen Bereich — plus Freigabe
offener Anfragen." — führe ich beides:

| Sache                                               | Was ich damit tue                                                    |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| **Einladungslink**                                  | erstellen, kopieren, **Neu generieren**, **Deaktivieren**            |
| **Beitrittscode**                                   | dieselbe Sache in kurz, zum Vorlesen                                 |
| **Beitritt automatisch bestätigen (ohne Freigabe)** | ein Haken, der die Freigabe überspringt                              |
| **Offene Anfragen (n)**                             | je Zeile E-Mail, ob via Link oder Code, **Freigeben** / **Ablehnen** |

Wer den Link öffnet, landet auf `/join/[token]` — „Gib deine E-Mail ein, um
beizutreten." Wer nur den Code hat, geht auf `/join`: **„Einem Bereich
beitreten"**. Ist der Link tot, sagt die Seite **„Link ungültig"** statt eines
leeren Formulars.

> **„Neu generieren" ist kein Aufräumen, sondern ein Widerruf.** Der alte Link
> gilt danach nicht mehr. Wer ihn in einer Mail von letzter Woche stehen hat,
> kommt nicht mehr herein — das ist der Zweck.

## Rollen zuweisen und entziehen

Auf der Detailseite eines Nutzers vergebe und entziehe ich Rollen. **Das
Rollenmodell kennt keine Vererbung** — eine höhere Rolle enthält die niedrigere
nicht. Wer zwei Dinge tun soll, bekommt zwei Rollen.

Manche Rollen tragen einen **Scope**: der Wertstrom-Owner darf `epic.update`
nur in seinen Wertströmen, der RTE `art_budget.distribute` nur auf seinen ARTs.
Der Scope wird beim Zuweisen gesetzt, nicht beim Recht.

Es gibt acht Rollen: `platform_admin`, `tenant_admin`, `portfolio_manager`,
`value_stream_owner`, `epic_owner`, `rte`, `feature_owner`, `viewer`. Ältere
Bezeichnungen — `transformation_lead`, `vmo`, `team_editor` — sind darin
aufgegangen; „VMO" lebt nur noch als Feldname `ValueStream.vmoId` und in
Freigabe-Texten weiter.

## Rechte nachjustieren

`/admin/roles` — **„Rollen & Capabilities"**, Untertitel: „Pro Rolle einzelne
Capabilities zuweisen oder entziehen. Das Default-Bundle stammt aus dem Code;
Tenant-Anpassungen leben in der Datenbank."

Je Rolle steht der Unterschied zur Vorgabe ausgeschrieben:

```
Δ vs. Default: +2 hinzugefügt · −1 entzogen · 0 Scope
```

und daneben **„Auf Default zurücksetzen"**, mit Rückfrage. Genau hier trägt man
nach, was eine neue Code-Vorgabe nicht mehr erreicht hat — siehe oben.

> **Funktionstrennung, absichtlich.** „Wer Menschen einlädt"
> (`tenant.users.manage`) und „wer Berechtigungen vergibt"
> (`role.capability.manage`) sind zwei verschiedene Rechte. Sie liegen im
> Standard bei derselben Rolle, aber sie **müssen** es nicht.

## Der Rest des Bereichs

| Fläche                                    | Wofür                                                                                     | Recht                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------- |
| **Custom Fields** (`/admin/goal-fields`)  | eigene Felder an Zielen **definieren** — gefüllt werden sie von den Ziel-Verantwortlichen | `goal.custom_field.manage` |
| **Integrationen** (`/admin/integrations`) | Projekt-Zuordnung zu Jira und Azure DevOps; „Disconnect" trennt sie samt Mapping          | `integration.manage`       |
| **Audit-Log** (`/admin/audit-log`)        | wer wann was geändert hat                                                                 | `admin.audit-log.read`     |

Dazu die **DSGVO-Löschung** eines Nutzers auf seiner Detailseite — kein
Deaktivieren, sondern Löschen.

## Der Setup-Leitfaden

`/setup` ist der einzige Eintrag der Gruppe **Administration**, der
**kein Recht verlangt** — jeder sieht ihn. Acht Meilensteine von **M1 · Tenant
Live** bis **M8 · First PI startet**, jeder mit Ergebnis, Zuständigem und den
Flächen, auf denen er passiert.

Die Häkchen sind **tenantweit geteilt**, nicht persönlich: es ist der Stand des
Programms, nicht meine To-do-Liste. Abhaken darf nur, wer
`tenant.users.manage` trägt; alle anderen lesen mit.

---

# 3 · Der Neue

Meine Frage lautet: **was soll ich hier eigentlich tun?**

## Ankommen

Ich klicke den Link oder gebe den Code ein, bestätige meine E-Mail — und je
nachdem, wie der Bereich eingestellt ist, bin ich sofort drin oder warte auf die
Freigabe. Danach lande ich nicht auf einer Startseite für alle, sondern auf der,
die zu meinen Modulen passt.

## Das Fenster, das ich nicht wegklicken kann

Sobald mir eine Rolle zugewiesen ist, öffnet sich ein Fenster. Es zeigt, wofür
die Rolle steht, und bietet zwei Knöpfe: **„Rolle annehmen & Tour starten"**
oder **„Annehmen, Tour später"**.

**Das Fenster ist bei einer neuen Rolle nicht wegklickbar.** Man kann die Tour
verschieben, nicht aber die Kenntnisnahme. Der Gedanke dahinter ist schlicht:
eine Rolle ist eine Zuschreibung von Verantwortung, und die sollte man einmal
gelesen haben.

Ein zweites, milderes Fenster erscheint, wenn sich mein **Zuschnitt** ändert —
ein Modul kommt dazu, eine Practice wird eingeschaltet, ein Recht wird
nachgetragen. Dann stehen genau die **neuen** Schritte darin, und der Knopf
heißt **„Ansehen"**.

## Die Tour

Die Tour ist kein Video und keine Pop-up-Kette. Sie **navigiert** in die
Anwendung, hebt ein echtes Bedienelement hervor und sagt in zwei Sätzen, was es
tut. Findet sie das Element nicht, zeigt sie die Erklärung mittig statt
abzubrechen.

Sie zeigt mir nur, was ich auch wirklich habe: Schritte zu abgeschalteten
Modulen, ausgeschalteten Practices oder fehlenden Rechten fallen weg, und die
Nummerierung bleibt trotzdem lückenlos. Ebenso fallen Schritte weg, für die es
noch keinen Bestand gibt — ein Schritt über Epics wartet, bis es Epics gibt.

> **Gespeichert wird kein Fortschritt, sondern eine Menge.** Nicht „bei Schritt
> 4 stehengeblieben", sondern „diese Schritte gesehen". Deshalb ist der
> Wiedereinstieg der **erste offene** Schritt, nicht der nächste nach dem
> letzten — und deshalb kann ein später zugeschaltetes Modul genau seine
> Schritte nachreichen, ohne alles zu wiederholen.

## Meine Rolle als Nachschlagewerk

`/meine-rolle` steht in keinem Menü — der Weg führt über das Benutzer-Menü. Die
Seite trägt je Rolle vier Abschnitte: die **Mission** in einem Satz,
**Deine Verantwortung**, **Zusammenspiel** (wovon ich übernehme, an wen ich
übergebe) und **Deine Flächen** als abgehakte Liste mit Fortschrittspille.
Darunter **„Tour erneut starten"**.

Wer mehrere Rollen trägt, bekommt mehrere solche Tafeln — nicht eine
zusammengemischte.

> `role.onboarding.manage` trägt **jede** Rolle, ausdrücklich auch `viewer` —
> gerade der Nur-Leser braucht eine Einführung. Und es ist reine
> Selbstbedienung: geschrieben wird nur die eigene Zeile.

---

## Die Nähte

**Zum Aufbau.** Ohne Modul `work` kein Portfolio, ohne `core` keine Ziele. Und
ohne besetzte Rollen kein Freigabelauf: der Finance Approver und der Portfolio
Manager eines Wertstroms sind Personen, und Personen kommen hier herein.

**Zu allen anderen.** Jede Fläche, die die übrigen acht Dokumente beschreiben,
steht unter den drei Schranken dieses Dokuments. Wer eine Fläche nicht findet,
sucht die Ursache in dieser Reihenfolge: Modul gebucht? Practice an? Recht
erteilt?

## Sätze, die naheliegen und nicht stimmen

| Satz                                                      | Warum er nicht stimmt                                                                                            |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| „Eine neue Rechte-Vorgabe im Code gilt für alle."         | Nur für Mandanten **ohne** gespeicherte Zeilen. Wer je eine Rolle angepasst hat, behält sein Bündel vollständig. |
| „Die Rollen-Matrix zeigt alle Berechtigungen."            | Die Plattform-Rechte haben leere Grant-Listen und laufen an `authorize()` vorbei.                                |
| „Der Plattform-Betreiber lässt Leute in einen Bereich."   | Er sieht die Anfragen, entscheidet aber nicht. Das tut der Tenant-Admin.                                         |
| „Eine höhere Rolle enthält die niedrigere."               | Das Rollenmodell kennt keine Vererbung. Zwei Aufgaben, zwei Rollen.                                              |
| „Der Setup-Leitfaden ist meine persönliche Liste."        | Die Häkchen sind tenantweit geteilt — es ist der Stand des Programms.                                            |
| „Ein abgeschaltetes Modul macht die Seite leer."          | Es macht sie **gesperrt**. Nicht registrierte Pfade sind fail-closed.                                            |
| „Custom Fields anlegen und ausfüllen ist dasselbe Recht." | Definieren ist Admin-Sache, Füllen Sache der Ziel-Verantwortlichen.                                              |
| „Die Tour merkt sich, wo ich war."                        | Sie merkt sich, **was ich gesehen habe**. Der Wiedereinstieg ist der erste offene Schritt.                       |
| „Das Willkommensfenster kann man wegklicken."             | Bei einer neuen Rolle nicht. Die Tour lässt sich verschieben, die Kenntnisnahme nicht.                           |

## Wer welchen Schritt macht

| Schritt                                                                   | Wer                           | Recht                                                   |
| ------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------- |
| Mandant anlegen, Module setzen, sperren, stilllegen                       | Plattform-Betreiber           | `platform.tenants.manage` (über `requirePlatformAdmin`) |
| Tenant-Anfrage entscheiden                                                | Plattform-Betreiber           | dito                                                    |
| Einladen, Rollen zuweisen und entziehen, DSGVO-Löschung                   | Tenant-Admin                  | `tenant.users.manage`                                   |
| Einladungslink erzeugen, neu generieren, deaktivieren; Anfragen freigeben | Tenant-Admin                  | `tenant.users.manage`                                   |
| Capabilities je Rolle setzen, entziehen, zurücksetzen                     | Tenant-Admin                  | `role.capability.manage`                                |
| Custom-Field-Definitionen                                                 | Tenant-Admin                  | `goal.custom_field.manage`                              |
| Integrationen verbinden und trennen                                       | Tenant-Admin                  | `integration.manage`                                    |
| Audit-Log lesen                                                           | Tenant-Admin                  | `admin.audit-log.read`                                  |
| Setup-Meilensteine abhaken                                                | Tenant-Admin                  | `tenant.users.manage`                                   |
| Rolle annehmen, Tour sehen und neu starten                                | **jede Rolle**, auch `viewer` | `role.onboarding.manage`                                |

## Nachschlagepunkte im Code

| Aussage                                       | Quelle                                                                  |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| Die drei Schranken und die Modul-Registry     | `src/modules/core/kernel/domain/modules.ts`                             |
| Practices und Operating-Model-Templates       | `src/modules/core/kernel/domain/operating-model.ts`                     |
| Die acht Rollen                               | `src/modules/core/kernel/domain/roles.ts`                               |
| Rechte je Rolle (die Code-Vorgabe)            | `src/server/auth/policies/index.ts`                                     |
| Der Alles-oder-nichts-Rückfall                | `src/server/auth/principal.ts` (`resolveCapabilities`)                  |
| Fast-Path für Admins, Scope-Prüfung           | `src/server/auth/authorize.ts`                                          |
| Δ gegen die Vorgabe, Auffang-Domäne „Weitere" | `src/server/views/admin-roles.ts`                                       |
| Capabilities setzen, entziehen, zurücksetzen  | `src/features/admin/actions/role-capability.ts`                         |
| Einladen, Rollen zuweisen, DSGVO-Löschung     | `src/features/admin/actions/{invite-user,role-assignment,gdpr}.ts`      |
| Einladungslink, Code, Auto-Freigabe, Anfragen | `src/features/admin/actions/join-request-actions.ts`                    |
| Mandant anlegen, Module, Lifecycle            | `src/features/platform/actions/tenant-actions.ts`                       |
| Tenant-Anfragen entscheiden                   | `src/features/platform/actions/provision-actions.ts`                    |
| Die acht Setup-Meilensteine                   | `src/features/setup/data/milestones.ts`                                 |
| Der Fortschritt als geteilter Stand           | `src/server/services/setup-progress.ts`                                 |
| Die Playbooks aller acht Rollen               | `src/modules/onboarding/domain/role-playbook.ts`                        |
| Filterung, offene Schritte, die zwei Fenster  | `src/modules/onboarding/domain/role-tour.ts`                            |
| Annehmen, Schritte merken, Tour neu starten   | `src/modules/onboarding/features/onboarding/actions/role-onboarding.ts` |
| Warum das Onboarding kein Entitlement hat     | `docs/adr/0017-onboarding-module-without-entitlement.md`                |
