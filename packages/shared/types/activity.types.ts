/**
 * Interactive Activity Types
 *
 * Defines types for the dynamic UI recipe-based activity framework.
 * The server sends UI recipes and available actions (HATEOAS), and the
 * student app renders activities from foundation blocks.
 */

// ============================================================================
// Activity Types
// ============================================================================

export type ActivityType = 'fill-blank' | 'sorting' | 'sequencing' | 'matching' | 'code-fill-blank';

// ============================================================================
// Foundation UI Blocks
// ============================================================================

export type UIBlockType = 'text' | 'draggable-item' | 'drop-zone' | 'text-input' | 'container' | 'code-editor';

/**
 * Base interface for all UI blocks
 */
export interface UIBlock {
  id: string;
  type: UIBlockType;
  props: Record<string, unknown>;
  children?: UIBlock[];
}

/**
 * Text/Label block - displays static text
 */
export interface TextBlock extends UIBlock {
  type: 'text';
  props: {
    content: string;
    variant?: 'heading' | 'body' | 'caption' | 'inline';
    className?: string;
  };
}

/**
 * Draggable item block - items that can be dragged to drop zones
 */
export interface DraggableItemBlock extends UIBlock {
  type: 'draggable-item';
  props: {
    itemId: string;
    content: string;
    imageUrl?: string;
    disabled?: boolean;
  };
}

/**
 * Drop zone block - targets where items can be dropped
 */
export interface DropZoneBlock extends UIBlock {
  type: 'drop-zone';
  props: {
    targetId: string;
    label?: string;
    placeholder?: string;
    accepts?: 'single' | 'multiple';
    showFeedback?: boolean;
    inline?: boolean;
  };
}

/**
 * Text input block - for typed answers
 */
export interface TextInputBlock extends UIBlock {
  type: 'text-input';
  props: {
    targetId: string;
    placeholder?: string;
    maxLength?: number;
  };
}

/**
 * Container block - for layout
 */
export interface ContainerBlock extends UIBlock {
  type: 'container';
  props: {
    layout: 'row' | 'column' | 'grid' | 'inline';
    gap?: string;
    className?: string;
    wrap?: boolean;
  };
  children: UIBlock[];
}

/**
 * Code editor block - for code activities with syntax highlighting
 */
export interface CodeEditorBlock extends UIBlock {
  type: 'code-editor';
  props: {
    targetId: string;
    language: 'python' | 'javascript' | 'text';
    placeholder?: string;
    prefillCode?: string;
    maxLines?: number;
    showLineNumbers?: boolean;
  };
}

// Union type for all specific block types
export type SpecificUIBlock = TextBlock | DraggableItemBlock | DropZoneBlock | TextInputBlock | ContainerBlock | CodeEditorBlock;

// ============================================================================
// Activity Data Types
// ============================================================================

/**
 * An item that can be placed/matched in an activity
 */
export interface ActivityItem {
  id: string;
  content: string;
  imageUrl?: string;
  order?: number; // For sequencing activities
}

/**
 * A target/drop zone in an activity
 */
export interface ActivityTarget {
  id: string;
  label?: string;
  accepts: string[]; // Item IDs that are correct for this target
  order?: number; // For sequencing activities
  evaluationMode?: 'exact' | 'whitespace-flexible' | 'case-insensitive'; // For code evaluation
}

/**
 * Activity definition sent from server
 */
export interface ActivityDefinition {
  id: string;
  type: ActivityType;
  title: string;
  instructions?: string;

  // Data
  items: ActivityItem[];
  targets: ActivityTarget[];

  // UI Recipe - how to render this activity
  uiRecipe: UIBlock[];

  // Settings
  showImmediateFeedback: boolean;
  allowRetry: boolean;
  shuffleItems?: boolean;
}

// ============================================================================
// HATEOAS Actions
// ============================================================================

export type ActivityActionType = 'submit' | 'retry' | 'reveal-answers' | 'reset';

/**
 * An action available to the student
 */
export interface ActivityAction {
  type: ActivityActionType;
  enabled: boolean;
  label?: string;
}

/**
 * Result of evaluating student's submission
 */
export interface ActivityResults {
  score: number;
  total: number;
  correct: string[]; // Target IDs that were correct
  incorrect: string[]; // Target IDs that were incorrect
  submitted: boolean;
}

/**
 * Full activity state response from server (HATEOAS)
 */
export interface ActivityStateResponse {
  activity: ActivityDefinition;
  isActive: boolean;
  actions: ActivityAction[];
  results?: ActivityResults;
  correctAnswers?: Record<string, string>; // targetId -> correct itemId (only if revealed)
}

// ============================================================================
// Student Placement/Answer Types
// ============================================================================

/**
 * Represents where a student has placed an item
 */
export interface ItemPlacement {
  itemId: string;
  targetId: string;
}

/**
 * Student's current answer state
 */
export interface StudentAnswers {
  placements: ItemPlacement[];
  textInputs: Record<string, string>; // targetId -> text value
}

// ============================================================================
// Teacher-side Activity Editor Types
// ============================================================================

/**
 * Fill-in-the-blank template with markers
 */
export interface FillBlankTemplate {
  text: string; // Text with {{blank}} markers
  distractors?: string[]; // Additional wrong answers to include
}

/**
 * Sorting activity category
 */
export interface SortingCategory {
  id: string;
  label: string;
  items: string[]; // Item IDs that belong to this category
}

/**
 * Matching pair
 */
export interface MatchingPair {
  id: string;
  left: string; // Term
  right: string; // Definition
}
