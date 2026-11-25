# Case Files rules

Versioned, declarative rules for `apps/case-files`. The files here are templates. The Rule_Binder in the app binds them to the suspects and statements of one case in memory, so no file contains a suspect id. Every rule is `deducting`, uses one `comparison` condition and reads a count that the Fact_Deriver computed.

The catalog key of a rule is `${id}@${version}` taken from the JSON body. The file name suffix `-v2` is only a hint.

## Versions

| Rule set | Means | Opportunity | Motive | Location lie | Possession lie | Sighting lie | Reliability used |
|---|---|---|---|---|---|---|---|
| v1 (`case-files@1.0.0`) | any | any | not bound | any | not bound | not bound | `...Any` counts |
| v2 (`case-files@2.0.0`) | any | any | any | any | any | not bound | `...Any` counts |
| v3 (`case-files@3.0.0`) | firm | firm | firm | firm | firm | firm | `...Firm` counts |

`statement-sighting-contradicted` has one version (1.0.0) and compares `conflictsFirm`. A suspect is convictable when every bound proof rule fires and at least one bound statement rule fires.

## Verdict matrix

| Case | v1 | v2 | v3 |
|---|---|---|---|
| greenhouse | accepted, [widow] | accepted, [widow] | accepted, [widow] |
| candlesticks | unfair_many, [ada, bram] | accepted, [ada] | accepted, [ada] |
| empty-room | unfair_none, [] | accepted, [dana] | unfair_none, [] |

`accepted` means exactly one suspect can be convicted. `unfair_many` and `unfair_none` mean the case is rejected.
