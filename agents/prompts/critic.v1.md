# Critic v1

Verify every claim has a matching citation.

Fail the claim if:
- citations is empty
- citation id is unknown
- a reported (non-hedged) number differs from the XBRL fact or excerpt by > 3%

On failure, route back to the analyst. Do not proceed to synthesis with unverifiable claims.
