# Holdout evaluation — BLOCKED on independent human annotation

No held-out human-labelled data was supplied. The 12 fixed fixtures are regression tests, not a holdout. Do not reuse them as evidence of generalization.

Prepare at least 20 additional synthetic invitations, covering EN and VI, annotated by people before running the evaluator. Keep them independent of prompt/rule development. Record provenance and disagreements separately; the tool cannot verify that an annotation was performed by a person.

JSON shape:

```json
{
  "annotationMethod": "human",
  "records": [
    {
      "id": "independent-record-id",
      "locale": "vi",
      "text": "The independently authored synthetic invitation goes here.",
      "selectedSupports": ["live_captions"],
      "expectedStatuses": {"live_captions": "unknown"},
      "expectedInterview": {"date": null, "timezone": null}
    }
  ]
}
```

The single record above illustrates format only; it is not a labelled evaluation corpus. Run `node scripts/evaluate-holdout.mjs path/to/holdout.json`. The report counts false confirmations, missing selected supports, exact support statuses and exact detail extraction. Report these counts and denominator; do not replace them with overall accuracy alone. Any live-AI holdout evaluation additionally requires provider configuration and explicit data-sharing consent. Participant pilot and screen-reader user testing remain separate from automated evaluation.
