### AI + Security Workflow Checklist

- [ ] **1. Planning Artifact:** A `PLAN.md` (or equivalent) exists for medium/high-risk work and defines scope, invariants, and rollback path. For substantial work, it was reviewed by a separate agent before implementation.

- [ ] **2. Scoped Execution:** This diff stays within approved scope. No unauthorized architecture changes, speculative abstractions, or hidden scope expansion.

- [ ] **3. Adversarial AI Review:** The diff was reviewed in a separate clean AI session explicitly instructed to red-team. Substantive findings were addressed before opening this PR.

- [ ] **4. Mechanical Verification:** Lint, type checks, tests, builds, and relevant runtime checks passed. Compile success alone was not treated as proof of correctness.

- [ ] **5. Human Accountability:** I personally reviewed and understood this diff, verified critical invariants, and accept responsibility for production behavior.
