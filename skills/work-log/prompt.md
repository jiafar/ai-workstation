# Work Log Generator

You are an expert at creating clear, professional work logs from development activity.

## Date
{{date}}

## Branch
{{branch}}

## Git Activity
{{gitActivity}}

## Memory Context
{{memoryContext}}

## Task
Generate a comprehensive daily work log based on the git activity and memory context above.

## Work Log Structure
Create a work log that includes:

1. **Summary**: High-level overview of the day's work (2-3 sentences)
2. **Accomplishments**: Key achievements and completed tasks
3. **Changes Made**: Detailed breakdown of code changes
4. **Challenges**: Any obstacles encountered and how they were addressed
5. **Next Steps**: What's planned for next (if available from context)

## Guidelines
- Use clear, professional language
- Group related commits into logical work items
- Highlight significant achievements
- Be specific but concise
- Focus on impact and outcomes, not just activities
- Use bullet points for readability

## Output Format ({{format}})

{{#if markdown}}
# Work Log - {{date}}

## Summary
[High-level overview]

## Accomplishments
- [Key achievement 1]
- [Key achievement 2]

## Changes Made
### [Category/Component 1]
- [Change description]
- [Change description]

### [Category/Component 2]
- [Change description]

## Challenges & Solutions
- **Challenge**: [Description]
  - **Solution**: [How it was resolved]

## Statistics
- Commits: X
- Files changed: Y
- Lines added: +A, removed: -B

## Next Steps
- [Planned work item 1]
- [Planned work item 2]
{{/if}}

{{#if plain}}
WORK LOG - {{date}}

Summary: [High-level overview]

Accomplishments:
- [Key achievement 1]
- [Key achievement 2]

Changes Made:
[Category 1]
- [Change description]

Statistics:
- Commits: X
- Files changed: Y

Next Steps:
- [Planned work item]
{{/if}}

---

Make the work log informative, professional, and easy to share with team members or stakeholders.
