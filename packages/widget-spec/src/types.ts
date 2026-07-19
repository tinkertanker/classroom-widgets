export const WIDGET_SPEC_VERSION = "1.0" as const;

export const SUPPORTED_WIDGET_SPEC_VERSIONS = [WIDGET_SPEC_VERSION] as const;

export type WidgetSpecVersion = (typeof SUPPORTED_WIDGET_SPEC_VERSIONS)[number];

/**
 * Identifiers are stable, human-readable kebab-case tokens. They are local to
 * one widget specification and are not database or publication identifiers.
 */
export type SpecId = string;

export type Subject =
  | "science"
  | "mathematics"
  | "english"
  | "humanities"
  | "languages"
  | "other";

export type EducationLevel = "upper-primary" | "secondary" | "other";

export interface WidgetMetadata {
  title: string;
  summary: string;
  subject?: Subject;
  level?: EducationLevel;
  locale?: string;
  learningObjective?: string;
  estimatedMinutes?: number;
  tags?: string[];
}

export type AccentColour =
  | "sage"
  | "terracotta"
  | "sky"
  | "indigo"
  | "amber"
  | "rose";

export interface WidgetTheme {
  accent: AccentColour;
  colourScheme: "light" | "dark" | "system";
  density: "comfortable" | "compact";
}

export interface ImageAssetSpec {
  id: SpecId;
  kind: "image";
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
  byteLength: number;
  sha256: string;
}

export type AssetSpec = ImageAssetSpec;

export interface NumberVariableSpec {
  id: SpecId;
  kind: "number";
  label: string;
  initial: number;
  minimum: number;
  maximum: number;
  step: number;
  unit?: string;
}

export interface BooleanVariableSpec {
  id: SpecId;
  kind: "boolean";
  label: string;
  initial: boolean;
}

export interface ChoiceVariableOption {
  id: SpecId;
  label: string;
}

export interface ChoiceVariableSpec {
  id: SpecId;
  kind: "choice";
  label: string;
  options: ChoiceVariableOption[];
  initialOptionId: SpecId;
}

export type VariableSpec =
  | NumberVariableSpec
  | BooleanVariableSpec
  | ChoiceVariableSpec;

/**
 * A deliberately small arithmetic abstract syntax tree. Renderers must walk
 * this tree directly; turning it into JavaScript or calling eval is forbidden.
 */
export type NumericExpression =
  | { kind: "literal"; value: number }
  | { kind: "constant"; name: "pi" | "e" }
  | { kind: "variable"; variableId: SpecId }
  | {
      kind: "unary";
      operator:
        | "negate"
        | "absolute"
        | "squareRoot"
        | "sine"
        | "cosine"
        | "tangent"
        | "floor"
        | "ceiling"
        | "round";
      operand: NumericExpression;
    }
  | {
      kind: "binary";
      operator:
        | "add"
        | "subtract"
        | "multiply"
        | "divide"
        | "power"
        | "minimum"
        | "maximum";
      left: NumericExpression;
      right: NumericExpression;
    }
  | {
      kind: "clamp";
      value: NumericExpression;
      minimum: NumericExpression;
      maximum: NumericExpression;
    };

export interface TextContent {
  kind: "text";
  text: string;
}

export interface ImageContent {
  kind: "image";
  assetId: SpecId;
  altText: string;
}

export type ItemContent = TextContent | ImageContent;

export interface FeedbackSpec {
  correct: string;
  incorrect: string;
  explanation?: string;
}

interface ComponentBase {
  id: SpecId;
}

export interface TextComponent extends ComponentBase {
  kind: "text";
  role: "title" | "heading" | "body" | "instruction" | "caption";
  text: string;
}

export interface ImageComponent extends ComponentBase {
  kind: "image";
  assetId: SpecId;
  altText: string;
  decorative: boolean;
  fit: "contain" | "crop";
  caption?: string;
}

export interface TimerComponent extends ComponentBase {
  kind: "timer";
  label: string;
  durationSeconds: number;
  completionMessage: string;
}

export interface RandomiserItemSpec {
  id: SpecId;
  label: string;
}

export interface RandomiserComponent extends ComponentBase {
  kind: "randomiser";
  prompt: string;
  items: RandomiserItemSpec[];
  allowRepeats: boolean;
}

export interface TaskListItemSpec {
  id: SpecId;
  text: string;
}

export interface TaskListComponent extends ComponentBase {
  kind: "taskList";
  title: string;
  items: TaskListItemSpec[];
  showProgress: boolean;
}

export type TrafficLightState = "red" | "amber" | "green";

export interface TrafficLightComponent extends ComponentBase {
  kind: "trafficLight";
  title: string;
  initialState: TrafficLightState;
  redLabel: string;
  amberLabel: string;
  greenLabel: string;
}

export interface ChoiceOptionSpec {
  id: SpecId;
  content: ItemContent;
}

export interface ChoiceQuestionComponent extends ComponentBase {
  kind: "choiceQuestion";
  prompt: string;
  selectionMode: "single" | "multiple";
  options: ChoiceOptionSpec[];
  correctOptionIds: SpecId[];
  shuffleOptions: boolean;
  feedback: FeedbackSpec;
}

export interface AnswerNormalisationSpec {
  trimWhitespace: boolean;
  collapseWhitespace: boolean;
  caseSensitive: boolean;
}

export interface ShortAnswerQuestionComponent extends ComponentBase {
  kind: "shortAnswerQuestion";
  prompt: string;
  acceptedAnswers: string[];
  placeholder?: string;
  normalisation: AnswerNormalisationSpec;
  feedback: FeedbackSpec;
}

export interface MatchingItemSpec {
  id: SpecId;
  content: ItemContent;
}

export interface MatchingPairSpec {
  itemId: SpecId;
  targetId: SpecId;
}

export interface MatchingComponent extends ComponentBase {
  kind: "matching";
  prompt: string;
  items: MatchingItemSpec[];
  targets: MatchingItemSpec[];
  correctMatches: MatchingPairSpec[];
  shuffleItems: boolean;
  feedback: FeedbackSpec;
}

export interface SortingCategorySpec {
  id: SpecId;
  label: string;
  description?: string;
}

export interface SortingPlacementSpec {
  itemId: SpecId;
  categoryId: SpecId;
}

export interface SortingComponent extends ComponentBase {
  kind: "sorting";
  prompt: string;
  items: MatchingItemSpec[];
  categories: SortingCategorySpec[];
  correctPlacements: SortingPlacementSpec[];
  shuffleItems: boolean;
  feedback: FeedbackSpec;
}

export interface SequencingComponent extends ComponentBase {
  kind: "sequencing";
  prompt: string;
  items: MatchingItemSpec[];
  correctOrder: SpecId[];
  feedback: FeedbackSpec;
}

export interface CircleHotspotShape {
  kind: "circle";
  centreX: number;
  centreY: number;
  radius: number;
}

export interface RectangleHotspotShape {
  kind: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
}

export type HotspotShape = CircleHotspotShape | RectangleHotspotShape;

export interface HotspotSpec {
  id: SpecId;
  label: string;
  reveal: string;
  shape: HotspotShape;
}

export interface HotspotsComponent extends ComponentBase {
  kind: "hotspots";
  prompt: string;
  imageAssetId: SpecId;
  altText: string;
  hotspots: HotspotSpec[];
}

export interface NumberControlComponent extends ComponentBase {
  kind: "numberControl";
  variableId: SpecId;
  presentation: "slider" | "stepper";
}

export interface ToggleControlComponent extends ComponentBase {
  kind: "toggleControl";
  variableId: SpecId;
}

export interface SelectControlComponent extends ComponentBase {
  kind: "selectControl";
  variableId: SpecId;
}

export interface ValueDisplayComponent extends ComponentBase {
  kind: "valueDisplay";
  label: string;
  expression: NumericExpression;
  decimalPlaces: number;
  unit?: string;
}

export interface PlotDomainSpec {
  variableId: SpecId;
  label: string;
  minimum: number;
  maximum: number;
  step: number;
  unit?: string;
}

export interface PlotRangeSpec {
  label: string;
  minimum: number;
  maximum: number;
  unit?: string;
}

export interface PlotSeriesSpec {
  id: SpecId;
  label: string;
  colour: AccentColour;
  yExpression: NumericExpression;
}

export interface PlotComponent extends ComponentBase {
  kind: "plot";
  title: string;
  description?: string;
  domain: PlotDomainSpec;
  range: PlotRangeSpec;
  series: PlotSeriesSpec[];
  showGrid: boolean;
  showLegend: boolean;
}

export type WidgetComponent =
  | TextComponent
  | ImageComponent
  | TimerComponent
  | RandomiserComponent
  | TaskListComponent
  | TrafficLightComponent
  | ChoiceQuestionComponent
  | ShortAnswerQuestionComponent
  | MatchingComponent
  | SortingComponent
  | SequencingComponent
  | HotspotsComponent
  | NumberControlComponent
  | ToggleControlComponent
  | SelectControlComponent
  | ValueDisplayComponent
  | PlotComponent;

export interface WidgetScreen {
  id: SpecId;
  title?: string;
  components: WidgetComponent[];
}

export interface WidgetSpec {
  schemaVersion: typeof WIDGET_SPEC_VERSION;
  id: SpecId;
  metadata: WidgetMetadata;
  theme: WidgetTheme;
  assets: AssetSpec[];
  variables: VariableSpec[];
  screens: WidgetScreen[];
}

export interface ValidationIssue {
  /** JSON Pointer to the failing value. */
  path: string;
  /** Stable machine-readable code. */
  code: string;
  message: string;
}

export type ValidationResult =
  | { valid: true; value: WidgetSpec; errors: [] }
  | { valid: false; errors: ValidationIssue[] };

export type ExpressionEvaluationResult =
  | { ok: true; value: number }
  | { ok: false; code: string; message: string };

export type WidgetSpecMigrationResult =
  | {
      ok: true;
      value: WidgetSpec;
      fromVersion: WidgetSpecVersion;
      toVersion: typeof WIDGET_SPEC_VERSION;
      migrated: boolean;
      notes: string[];
    }
  | { ok: false; errors: ValidationIssue[] };
