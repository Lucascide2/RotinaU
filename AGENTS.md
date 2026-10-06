<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Domain logic (routine generation, stats, early/overdue rules) lives in src/lib/rotina.ts; UI state persists in localStorage. Why: keeps pure logic testable and separate from screens.
- Calendar display offsets live in src/lib/calendar.ts. Why: presentation date windows can be tested without changing routine domain logic.
- Store independent session lists in State.weeks keyed by Monday ISO, with State.sessions mirroring the current week. Why: date navigation and rollover preserve completion history without weekday aliasing.
