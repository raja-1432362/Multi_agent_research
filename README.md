# Multi-Agent Research Assistant

A dependency-free Python example that coordinates four roles:

- **planner**: turns a question into focused research questions
- **researcher**: gathers excerpts from supplied sources
- **analyst**: preserves each source as a finding (the current implementation)
- **writer**: produces a concise Markdown report

## Usage

```python
from research_assistant import ResearchAssistant, Source

assistant = ResearchAssistant([
    Source(
        title="Example source",
        content="The project uses multiple specialized agents.",
        url="https://example.com",
    )
])

report = assistant.research("How does this project use agents?")
print(report.as_markdown())
```

Run the built-in demonstration:

```bash
python3 research_assistant.py
```