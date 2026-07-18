import Foundation

struct GuidedBriefDraft: Equatable, Sendable {
    var learnerContext = ""
    var learningObjective = ""
    var studentAction = ""
    var sourceContent = ""
    var feedback = ""
    var classroomFit = ""

    var answers: [String] {
        [learnerContext, learningObjective, studentAction, sourceContent, feedback, classroomFit]
    }

    mutating func setAnswer(_ answer: String, at index: Int) {
        switch index {
        case 0: learnerContext = answer
        case 1: learningObjective = answer
        case 2: studentAction = answer
        case 3: sourceContent = answer
        case 4: feedback = answer
        case 5: classroomFit = answer
        default: break
        }
    }

    func answer(at index: Int) -> String {
        answers[index]
    }
}

struct BriefQuestion: Identifiable, Sendable {
    let id: Int
    let eyebrow: String
    let prompt: String
    let supportingText: String
    let placeholder: String
    let suggestions: [String]
    let isOptional: Bool

    static let all: [BriefQuestion] = [
        BriefQuestion(
            id: 0,
            eyebrow: "Learners",
            prompt: "Who are you teaching?",
            supportingText: "A level and subject is enough. You can add language or support needs too.",
            placeholder: "For example, Secondary 3 Physics",
            suggestions: ["Primary 5 Science", "Secondary 2 Mathematics", "Secondary 3 Humanities"],
            isOptional: false
        ),
        BriefQuestion(
            id: 1,
            eyebrow: "Learning intention",
            prompt: "What should they understand or be able to do?",
            supportingText: "Start with the learning, not the screen you want to build.",
            placeholder: "Relate launch angle and speed to projectile range",
            suggestions: ["Recall key ideas", "Explain a relationship", "Practise a procedure"],
            isOptional: false
        ),
        BriefQuestion(
            id: 2,
            eyebrow: "Student action",
            prompt: "What should students do on screen?",
            supportingText: "Choose one focused interaction. Studio can suggest a suitable format later.",
            placeholder: "Adjust two sliders, predict, then compare",
            suggestions: ["Choose and get feedback", "Match or sort items", "Explore a changing graph"],
            isOptional: false
        ),
        BriefQuestion(
            id: 3,
            eyebrow: "Content",
            prompt: "What must the widget include?",
            supportingText: "Add examples, vocabulary, values or instructions. Avoid student names and personal information.",
            placeholder: "Use metres, seconds and Earth gravity",
            suggestions: ["I will add this later", "Use familiar local examples", "Keep the language concise"],
            isOptional: true
        ),
        BriefQuestion(
            id: 4,
            eyebrow: "Feedback",
            prompt: "How should the widget respond?",
            supportingText: "Published V1 widgets work locally and do not collect student responses.",
            placeholder: "Reveal a hint, then explain the answer",
            suggestions: ["Immediate explanation", "Hints before answers", "No marking — exploration only"],
            isOptional: false
        ),
        BriefQuestion(
            id: 5,
            eyebrow: "Classroom fit",
            prompt: "How will this fit into the lesson?",
            supportingText: "A rough duration and mode helps Studio keep the activity focused.",
            placeholder: "Eight minutes, students work in pairs on phones",
            suggestions: ["5 minutes individually", "10 minutes in pairs", "Whole-class discussion"],
            isOptional: false
        )
    ]
}
