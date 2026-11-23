"""A small, dependency-free multi-agent research assistant."""

from dataclasses import dataclass, field
from typing import Iterable, Mapping, Sequence


@dataclass(frozen=True)
class Source:
    title: str
    content: str
    url: str = ""


@dataclass(frozen=True)
class AgentResult:
    agent: str
    output: str


@dataclass
class ResearchReport:
    question: str
    sub_questions: list[str] = field(default_factory=list)
    findings: list[AgentResult] = field(default_factory=list)
    summary: str = ""

    def as_markdown(self) -> str:
        lines = [f"# Research report: {self.question}", "", "## Summary", self.summary]
        if self.sub_questions:
            lines.extend(["", "## Research questions"])
            lines.extend(f"- {question}" for question in self.sub_questions)
        if self.findings:
            lines.extend(["", "## Findings"])
            for finding in self.findings:
                lines.extend(
                    [
                        f"### {finding.agent}",
                        finding.output,
                        "",
                    ]
                )
        return "\n".join(lines).rstrip() + "\n"


class ResearchAssistant:
    """Coordinates planning, retrieval, analysis, and synthesis agents."""

    def __init__(self, sources: Iterable[Source | Mapping[str, str]] = ()) -> None:
        self.sources = [self._source(source) for source in sources]

    @staticmethod
    def _source(source: Source | Mapping[str, str]) -> Source:
        if isinstance(source, Source):
            return source
        return Source(
            title=str(source.get("title", "Untitled")),
            content=str(source.get("content", "")),
            url=str(source.get("url", "")),
        )

    def research(self, question: str) -> ResearchReport:
        question = question.strip()
        if not question:
            raise ValueError("A research question is required")

        report = ResearchReport(question=question)
        report.sub_questions = self.plan(question)
        report.findings = self.retrieve(report.sub_questions)
        report.summary = self.synthesize(question, report.findings)
        return report

    def plan(self, question: str) -> list[str]:
        words = [word for word in question.rstrip("?").split() if word]
        topic = " ".join(words)
        return [
            f"What are the key facts about {topic}?",
            f"What evidence and sources support findings about {topic}?",
        ]

    def retrieve(self, questions: Sequence[str]) -> list[AgentResult]:
        if not self.sources:
            return [AgentResult("researcher", "No sources were provided.")]

        findings: list[str] = []
        for source in self.sources:
            excerpt = " ".join(source.content.split())
            if len(excerpt) > 300:
                excerpt = excerpt[:297].rstrip() + "..."
            citation = f"[{source.title}]"
            if source.url:
                citation = f"[{source.title}]({source.url})"
            findings.append(f"- {citation}: {excerpt}")
        return [AgentResult("researcher", "\n".join(findings))]

    def synthesize(
        self, question: str, findings: Sequence[AgentResult]
    ) -> str:
        if not findings or findings[0].output == "No sources were provided.":
            return f"No evidence was available to answer: {question}"
        return f"Based on {len(self.sources)} provided source(s), the available evidence is summarized below."


def _demo() -> None:
    assistant = ResearchAssistant(
        [
            Source(
                title="Introduction",
                content="A multi-agent research assistant assigns planning, retrieval, analysis, and synthesis work to specialized agents.",
                url="https://example.com",
            )
        ]
    )
    print(assistant.research("How does a multi-agent research assistant work?").as_markdown())


if __name__ == "__main__":
    _demo()
