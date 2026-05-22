# Project general coding guidelines

## Code style
- Prefer Vue 3 composition API with TypeScript.
- Use semantic HTML elements for structure and accessibility.
- Keep styles scoped to components when possible.
- Use meaningful variable names and avoid abbreviations.

## Task Manager rules
- Validate user input and prevent empty tasks.
- Keep task state in a reactive Vue component.
- Provide clear UI feedback for completed and deleted tasks.
- For multiplayer session state, keep state syncing event-driven and use WebSocket messages carefully.
- When adding goals or champions, keep unlock flow transparent and specify which player receives the unlock.

## Quality
- Use modern TypeScript types and interfaces.
- Keep logic simple and maintainable.
- Add comments only for non-obvious or complex behavior.
