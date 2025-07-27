import { WIDGET_REGISTRY, getAllWidgets, getNetworkedWidgets } from '../constants/widgetRegistry';
import { WIDGET_TYPES } from '../constants/widgetTypes';
import { validateLazyWidgets } from '../../features/widgets/shared/LazyWidgetsRegistry';

interface ValidationResult {
  category: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string[];
}

/**
 * Comprehensive validation of widget setup
 * Run this in development to ensure all widgets are properly configured
 */
export function validateCompleteWidgetSetup(): ValidationResult[] {
  const results: ValidationResult[] = [];
  
  // 1. Check that all WIDGET_TYPES have registry entries
  const registryCheck = validateRegistryCompleteness();
  results.push(registryCheck);
  
  // 2. Check that all networked widgets have required properties
  const networkedCheck = validateNetworkedWidgets();
  results.push(networkedCheck);
  
  // 3. Check that all widgets have lazy imports
  const lazyCheck = validateLazyImports();
  results.push(lazyCheck);
  
  // 4. Check for duplicate widget IDs
  const duplicateCheck = validateNoDuplicateIds();
  results.push(duplicateCheck);
  
  // 5. Check component paths match folder structure
  const pathCheck = validateComponentPaths();
  results.push(pathCheck);
  
  // 6. Check networked widget student components
  const studentCheck = validateStudentComponents();
  results.push(studentCheck);
  
  return results;
}

function validateRegistryCompleteness(): ValidationResult {
  const missingInRegistry: string[] = [];
  
  Object.entries(WIDGET_TYPES).forEach(([name, id]) => {
    if (!WIDGET_REGISTRY[id]) {
      missingInRegistry.push(`${name} (ID: ${id})`);
    }
  });
  
  return {
    category: 'Registry Completeness',
    status: missingInRegistry.length === 0 ? 'pass' : 'fail',
    message: missingInRegistry.length === 0 
      ? 'All widget types have registry entries' 
      : `${missingInRegistry.length} widget types missing from registry`,
    details: missingInRegistry
  };
}

function validateNetworkedWidgets(): ValidationResult {
  const issues: string[] = [];
  
  getNetworkedWidgets().forEach(widget => {
    if (!widget.networked) {
      issues.push(`${widget.displayName}: Missing networked configuration`);
      return;
    }
    
    if (!widget.networked.roomType) {
      issues.push(`${widget.displayName}: Missing roomType`);
    }
    
    if (!widget.networked.studentComponentName) {
      issues.push(`${widget.displayName}: Missing studentComponentName`);
    }
    
    if (widget.networked.hasStartStop === undefined) {
      issues.push(`${widget.displayName}: Missing hasStartStop flag`);
    }
    
    if (widget.networked.startsActive === undefined) {
      issues.push(`${widget.displayName}: Missing startsActive flag`);
    }
  });
  
  return {
    category: 'Networked Widget Configuration',
    status: issues.length === 0 ? 'pass' : 'fail',
    message: issues.length === 0 
      ? 'All networked widgets properly configured' 
      : `${issues.length} configuration issues found`,
    details: issues
  };
}

function validateLazyImports(): ValidationResult {
  const { valid, missing } = validateLazyWidgets();
  
  return {
    category: 'Lazy Import Configuration',
    status: valid ? 'pass' : 'fail',
    message: valid 
      ? 'All widgets have lazy imports configured' 
      : `${missing.length} widgets missing lazy imports`,
    details: missing
  };
}

function validateNoDuplicateIds(): ValidationResult {
  const idMap = new Map<number, string[]>();
  
  getAllWidgets().forEach(widget => {
    if (!idMap.has(widget.id)) {
      idMap.set(widget.id, []);
    }
    idMap.get(widget.id)!.push(widget.displayName);
  });
  
  const duplicates: string[] = [];
  idMap.forEach((names, id) => {
    if (names.length > 1) {
      duplicates.push(`ID ${id}: ${names.join(', ')}`);
    }
  });
  
  return {
    category: 'Unique Widget IDs',
    status: duplicates.length === 0 ? 'pass' : 'fail',
    message: duplicates.length === 0 
      ? 'All widget IDs are unique' 
      : `${duplicates.length} duplicate IDs found`,
    details: duplicates
  };
}

function validateComponentPaths(): ValidationResult {
  const warnings: string[] = [];
  
  getAllWidgets().forEach(widget => {
    // Check if component path matches expected pattern
    const expectedPath = widget.name.charAt(0).toLowerCase() + widget.name.slice(1);
    
    // Special cases for widgets with different naming conventions
    const specialCases: Record<string, string> = {
      'volumeLevel': 'volumeLevel',
      'TicTacToe': 'TicTacToe',
      'Poll': 'poll',
      'LinkShare': 'linkShare',
      'RTFeedback': 'rtFeedback',
      'Questions': 'questions'
    };
    
    const expected = specialCases[widget.name] || expectedPath;
    if (widget.componentPath !== expected) {
      warnings.push(`${widget.displayName}: componentPath '${widget.componentPath}' might not match folder '${expected}'`);
    }
  });
  
  return {
    category: 'Component Path Validation',
    status: warnings.length === 0 ? 'pass' : 'warning',
    message: warnings.length === 0 
      ? 'All component paths follow expected patterns' 
      : `${warnings.length} potential path mismatches`,
    details: warnings
  };
}

function validateStudentComponents(): ValidationResult {
  const expectedComponents = new Set([
    'PollActivity',
    'LinkShareActivity',
    'RTFeedbackActivity',
    'QuestionsActivity'
  ]);
  
  const configuredComponents = new Set(
    getNetworkedWidgets()
      .map(w => w.networked?.studentComponentName)
      .filter(Boolean)
  );
  
  const issues: string[] = [];
  
  // Check all configured components are expected
  configuredComponents.forEach(comp => {
    if (!expectedComponents.has(comp!)) {
      issues.push(`Unexpected student component: ${comp}`);
    }
  });
  
  // Check all expected components are configured
  expectedComponents.forEach(comp => {
    if (!configuredComponents.has(comp)) {
      issues.push(`Missing configuration for student component: ${comp}`);
    }
  });
  
  return {
    category: 'Student Component Configuration',
    status: issues.length === 0 ? 'pass' : 'fail',
    message: issues.length === 0 
      ? 'All student components properly configured' 
      : `${issues.length} student component issues`,
    details: issues
  };
}

/**
 * Console utility to run validation and display results
 */
export function runWidgetValidation(): void {
  const results = validateCompleteWidgetSetup();
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  
  
  results.forEach(result => {
    const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
    
    if (result.details && result.details.length > 0) {
      result.details.forEach(detail => {
      });
    }
  });
  
  // Return overall status
  return failed === 0;
}

// Export for use in development
if (process.env.NODE_ENV === 'development') {
  (window as any).validateWidgets = runWidgetValidation;
}