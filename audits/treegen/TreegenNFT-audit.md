# TreegenNFT Audit Notes

## Summary
| ID | Title | Severity |
| --- | --- | --- |
| TG-01 | Supply cap is not enforced | High |
| TG-02 | Constructor accepts zero addresses for privileged roles | Medium |

## Findings

### TG-01 Supply cap is not enforced (High)
`TreegenNFT` overrides `totalSupply()` to always return `1000`, apparently to signal a hard cap, but `safeMint` never checks how many tokens have already been minted. The inherited enumerable bookkeeping still allows minting past 1,000 tokens, so the observable supply can silently exceed the advertised limit. A compromised or malicious `management` account can therefore inflate supply without restriction, breaking any guarantees that downstream integrations or users rely on. 【F:audits/treegen/TreegenNFT.sol†L14-L18】【F:audits/treegen/TreegenNFT.sol†L51-L57】【F:audits/treegen/TreegenNFT.sol†L108-L110】

*Recommendation:* Track minted supply (e.g., via a counter or the inherited enumerable total) and revert whenever minting would exceed the intended cap.

### TG-02 Constructor accepts zero addresses for privileged roles (Medium)
The constructor copies `_management` and `_nftUpdater` without validating them. Deploying with the zero address (accidentally or via bad parameters) bricks privileged flows: no one can call `safeMint` or the updater functions because their modifiers require specific senders. This creates an avoidable denial of service at deployment time. 【F:audits/treegen/TreegenNFT.sol†L20-L41】【F:audits/treegen/TreegenNFT.sol†L43-L74】

*Recommendation:* Reject zero addresses (and, if desired, non-contract addresses) during construction to ensure the contract comes online with usable role assignments.
