# TreegenNFT Smart Contract Audit

## Overview
- **Contract name:** `TreegenNFT`
- **Network:** Ethereum (intended)
- **Source file:** [`contracts/TreegenNFT.sol`](../contracts/TreegenNFT.sol)
- **Audit type:** Targeted security review based on provided source

## Scope and Objectives
The review focused on the application-specific logic implemented in `TreegenNFT`. Inherited dependencies from LayerZero's `ONFT721Enumerable` and OpenZeppelin libraries were treated as trusted and audited separately by their maintainers. The primary objectives were:

1. Identify vulnerabilities that could lead to asset loss, locked tokens, or unauthorized privilege escalation.
2. Check for logic flaws affecting metadata management and cross-chain NFT operations.
3. Highlight code-quality and upgradeability risks that could impact maintainability or integration.

## Key Assumptions
- The owner account is trusted and secured off-chain.
- LayerZero endpoint and delegate parameters passed to the constructor are valid.
- Tokens are minted via inherited ONFT/ ERC721 mechanisms outside the reviewed file.

## Findings Summary
| ID | Severity | Title |
| --- | --- | --- |
| TG-01 | **High** | `totalSupply` override breaks ERC721Enumerable invariants |
| TG-02 | Medium | Missing existence check in `_setTokenURI` allows metadata writes for nonexistent tokens |
| TG-03 | Informational | Lack of emitted events when administrative configuration changes |

## Detailed Findings

### TG-01: `totalSupply` override breaks ERC721Enumerable invariants (High)
`TreegenNFT` overrides `totalSupply` to always return `1000`, described as a maximum supply sourced from another facet.【F:contracts/TreegenNFT.sol†L89-L94】 This contradicts the expected behavior of `ERC721Enumerable`, which relies on `totalSupply` returning the number of minted tokens tracked by the enumerable extension. Consequences include:
- Integrators iterating `for (uint i = 0; i < totalSupply(); ++i)` will read past the actual minted range, leading to out-of-bounds reverts when calling `tokenByIndex`.
- Cross-chain messaging in `ONFT721Enumerable` could misbehave if it depends on accurate supply counts.
- Secondary markets and analytics ingesting supply data will report an incorrect circulating supply of 1000 even when fewer tokens exist.

**Recommendation:** Remove the override and reintroduce a separate `maxSupply()` view that returns the management facet constant, or use an immutable variable that is respected during minting logic instead of hijacking `totalSupply`.

### TG-02: Missing existence check in `_setTokenURI` allows metadata writes for nonexistent tokens (Medium)
The internal `_setTokenURI` helper writes to the `_tokenURIs` mapping without verifying that the token exists.【F:contracts/TreegenNFT.sol†L75-L88】 While callers currently derive token IDs from `tokenOfOwnerByIndex`, the public `updateURI` function accepts arbitrary `tokenId` values. If the updater mistakenly supplies an ID that is not minted, the contract silently stores metadata that becomes visible immediately after minting that ID, potentially exposing stale or incorrect data.

**Recommendation:** Call `_requireOwned(tokenId)` (already available from `ERC721`) or `require(_exists(tokenId))` within `_setTokenURI` to ensure only live tokens can receive metadata.

### TG-03: Lack of emitted events when administrative configuration changes (Informational)
`setNFTUpdater` and `setDefaultURI` modify critical configuration yet emit no events.【F:contracts/TreegenNFT.sol†L31-L48】 Off-chain indexers benefit from explicit events to track updater rotations and default metadata changes.

**Recommendation:** Emit dedicated events (`NFTUpdaterChanged`, `DefaultURISet`) whenever these setters execute.

## Additional Recommendations
- Validate `_nftUpdater` against the zero address in the constructor to avoid accidentally deploying with an unusable updater account.【F:contracts/TreegenNFT.sol†L20-L30】
- Consider rate-limiting or batching strategies for `batchMetadataUpdate` to prevent exceeding gas limits when notifying large token sets.【F:contracts/TreegenNFT.sol†L66-L74】
- Document the trust model around `nftUpdater`, since it can arbitrarily rewrite metadata.

## Conclusion
The primary blocker to production deployment is the incorrect `totalSupply` override. Addressing TG-01 is critical to maintain ERC721 compatibility. TG-02 and TG-03 are recommended to strengthen safety and observability. After remediating these issues, a follow-up audit should verify the fixes and reassess any new functionality introduced during the mitigation process.
