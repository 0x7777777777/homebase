# Treegens DST-Contracts Audit (mainnet branch)

## Overview
- **Repository:** [Treegens/SmartContracts](https://github.com/Treegens/SmartContracts)
- **Commit examined:** `mainnet` branch latest (commit `5d02b79d933796013312bdb157b599465a0303b2`, cloned 2025-10-16)
- **Scope:** Contracts under `DST-Contracts/src`, focusing on governance, staking, and bridging components (Management diamond, MGRO token flows, MGROVerification, TGNVault).

## Summary of Findings
| ID | Title | Severity |
| --- | --- | --- |
| H-01 | Slashing trigger can permanently brick proposals when percentage is unset | High |
| M-01 | Proposal execution can be DOSed by unbounded voter loops | Medium |
| L-01 | Ack fee funding on Celo side can silently stall state sync | Low |

## Detailed Findings

### H-01 Slashing trigger can permanently brick proposals when percentage is unset
**Severity:** High  
**Affected components:** `MGroverification.executeVerification`, `TGNVault.slash`  
**Description:**  
`executeVerification` calls `_countErrorVote`, which increments each loser's `strikeCount` and, once it exceeds two, attempts to slash that address through the vault (see `MGroverification.sol`, lines 195-204). The vault's `slash` function requires `slashingPercentage` to be non-zero; otherwise it reverts with `ZeroPercentSlashing` (see `TGNVault.sol`, lines 122-132). Because the vault constructor leaves `slashingPercentage` at its default value (`0`), any execution that tries to slash a third-time offender will revert unless the DAO has proactively configured slashing. The revert unwinds the whole `executeVerification` transaction, keeping the proposal marked active, leaving all voters' `maxOpenVotes` counters unchanged, and blocking future executions. An attacker only needs to accrue two strikes and keep voting on the losing side to prevent any subsequent proposal from completing until governance intervenes off-chain.

**Recommendation:**  
Initialize a non-zero `slashingPercentage` during deployment or guard `_countErrorVote` so it skips slashing when the percentage is unset (while still marking the voter blacklisted). Alternatively, treat `ZeroPercentSlashing` as a soft failure and continue so that proposals cannot be bricked.

### M-01 Proposal execution can be DOSed by unbounded voter loops
**Severity:** Medium  
**Affected components:** `MGroverification.executeVerification`, `_countErrorVote`, `_clearOpenVoteCounters`  
**Description:**  
Executing a proposal iterates over the full `yesVoters` and `noVoters` arrays to update strike counts and to decrement each voter's `maxOpenVotes` (see `MGroverification.sol`, lines 163-170 and 216-230). These arrays grow linearly with the number of unique voters and are never pruned. For a sufficiently popular proposal, the loops can exceed the block gas limit and make the proposal unexecutable, locking every voter's stake (because `maxOpenVotes` stays elevated and `unlockStake` is never called). Attackers can exacerbate this by sybil voting with many staked addresses.

**Recommendation:**  
Adopt a pattern that avoids iterating over unbounded dynamic arrays on-chain. Options include: capping the voter set, migrating to bitmap tracking with incremental clearing, or letting voters claim strike updates/unlocks individually via separate transactions.

### L-01 Ack fee funding on Celo side can silently stall state sync
**Severity:** Low  
**Affected components:** `CeloMgroOapp._lzReceive`  
**Description:**  
After minting/burning on Celo, the bridge attempts to send an ACK back to Base. If the contract balance lacks enough native tokens to pay the LayerZero fee, it simply emits `AckInsufficientFunds` and returns without reverting (see `CeloMgroOapp.sol`, lines 57-86). Because no ack is sent, the Base management facet never calls `confirmMint`/`confirmBurn`, so off-chain statistics remain stale. There is no alert or retry mechanism besides the event, making this easy to miss in production.

**Recommendation:**  
Add active monitoring for the `AckInsufficientFunds` event, top up the contract automatically (e.g., via keeper), or consider reverting when fees are unavailable so operators are forced to fund the contract before execution.

## Positive Observations
- Consistent use of `Ownable` access control in token and vault contracts.
- Cross-chain messaging relies on LayerZero v2 with enforced options, reducing misconfiguration risk.
- Management diamond routes critical configuration changes through DAO-only functions where appropriate.

## Suggested Hardening Tasks
- Add deployment checklists to ensure slashing parameters are configured before governance opens to the public.
- Provide off-chain tooling to monitor LayerZero ack balances and outstanding proposals.
- Consider unit tests that cover failure paths for proposal execution when voter lists are large or when slashing is disabled.
