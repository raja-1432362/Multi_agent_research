import unittest

from research_assistant import ResearchAssistant, Source


class ResearchAssistantTests(unittest.TestCase):
    def test_research_requires_a_question(self) -> None:
        with self.assertRaisesRegex(ValueError, "required"):
            ResearchAssistant().research("  ")

    def test_research_returns_markdown_findings(self) -> None:
        assistant = ResearchAssistant(
            [
                Source(
                    title="Agent guide",
                    content="Specialized agents divide research work.",
                    url="https://example.com/guide",
                )
            ]
        )

        report = assistant.research("How do agents divide work?")

        self.assertEqual(len(report.sub_questions), 2)
        self.assertIn("Agent guide", report.as_markdown())
        self.assertIn("https://example.com/guide", report.as_markdown())
        self.assertIn("Specialized agents", report.as_markdown())

    def test_research_without_sources_reports_no_evidence(self) -> None:
        report = ResearchAssistant().research("What is known?")

        self.assertEqual(report.summary, "No evidence was available to answer: What is known?")
        self.assertIn("No sources", report.as_markdown())


if __name__ == "__main__":
    unittest.main()
