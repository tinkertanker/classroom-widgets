import type {
  DesignCard,
  Exemplar,
  ModelProvider,
  ModerationDecision,
  TeacherBrief,
} from "./provider";
function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
}

function page(title: string, detail: string) {
  const safeTitle = escapeHtml(title);
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${safeTitle}</title><style>body{font-family:system-ui;max-width:48rem;margin:3rem auto;padding:1rem}button{padding:.7rem}</style></head><body><main><h1>${safeTitle}</h1><p>${escapeHtml(detail)}</p><button onclick="this.textContent='Well done'">Check</button></main></body></html>`;
}
export class FixtureModelProvider implements ModelProvider {
  readonly name = "fixture";
  async generate(b: TeacherBrief, _e: Exemplar[]) {
    return {
      html: page(b.learningObjective, b.studentAction),
      designCard: { title: b.learningObjective, description: b.subject },
    };
  }
  async revise(
    _h: string,
    c: DesignCard | undefined,
    i: string,
    _b: TeacherBrief,
  ) {
    return { html: page(c?.title ?? "Classroom widget", i), designCard: c };
  }
  async repair(candidate: unknown) {
    return candidate;
  }
  async moderate(): Promise<ModerationDecision> {
    return { safe: true, categories: [] };
  }
}
