# Example Workflow Orchestration

Build features with a test-first approach using a structured team.

## Team Structure

Create these team members:

- **test-writer**
  - Role: Write failing tests from acceptance criteria. Create `.tdd_lock` file when done.
  - Agent Type: `general-purpose`
  - Skills: Use `/skills:<domain>:question` to understand the domain before writing tests
  - Focus: Test-first development, acceptance criteria coverage, test file creation

- **builder**
  - Role: Implement the feature to make tests pass
  - Agent Type: `general-purpose`
  - Skills: Use `/skills:<domain>:plan_build_improve` for domain-aware implementation
  - Focus: Feature implementation, type safety, code quality
  - Runs after: test-writer completes

- **validator**
  - Role: Validate implementation meets project standards (read-only inspection)
  - Agent Type: `general-purpose`
  - Skills: Use `/skills:<domain>:question` to verify domain patterns
  - Focus: Pattern compliance, type checking, code review
  - Runs after: builder completes

## Execution Pattern

1. **test-writer** writes failing tests from acceptance criteria and creates `.tdd_lock` file
2. **builder** implements the feature to make tests pass (can run in parallel if multiple sub-tasks)
3. **validator** inspects the work -- if issues found, loop back to builder
4. Final validation confirms all acceptance criteria met

## Task Dependencies

```
write-tests ─► implement-feature-1 ─┐
               implement-feature-2 ─┼─► validate-implementation (FINAL GATE)
               implement-feature-3 ─┘
```

**TDD Lock**: test-writer creates `.tdd_lock` file after writing tests. This locks test files from builder modification.

## Quality Gates

The validator MUST be the final step and must:
1. Run the project test suite
2. Run type checking if applicable
3. Check for blocking issues in `.sprint_issues`
4. If any blocking issues found, raise them:
   ```bash
   echo '{"severity":"blocking","reporter":"validator","message":"Description of issue"}' >> .sprint_issues
   ```

The track cannot complete if blocking issues exist.

## Notes

- If the story involves multiple independent sub-tasks, create parallel builder tasks
- The validator runs sequentially after all builders complete
- Customize this template for your project by adding project-specific agent types and skill references
- Replace `<domain>` in skill references with your actual skill names (e.g., `/skills:frontend-dev:question`)
