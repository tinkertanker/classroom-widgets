import { widgetRegistry } from '../../services/WidgetRegistry';
import { WidgetType, WidgetConfig } from '../types';
import { WIDGET_TYPES } from '../constants/widgetTypes';

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
  
  // 3. Check that all widgets have components
  const componentCheck = validateWidgetComponents();
  results.push(componentCheck);
  
  // 4. Check for duplicate widget IDs
  const duplicateCheck = validateNoDuplicateIds();
  results.push(duplicateCheck);
  
  // 5. Check networked widget student components
  const studentCheck = validateStudentComponents();
  results.push(studentCheck);
  
  return results;
}

function validateRegistryCompleteness(): ValidationResult {
  const missingInRegistry: string[] = [];
  
  Object.entries(WIDGET_TYPES).forEach(([name, id]) => {
    const enumType = widgetRegistry.fromLegacyType(id);
    if (!enumType || !widgetRegistry.get(enumType)) {
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
  const networkedWidgets = widgetRegistry.getNetworkedWidgets();
  
  networkedWidgets.forEach(widget => {
    if (!widget.networked) {
      issues.push(`${widget.name}: Missing networked configuration`);
      return;
    }
    
    if (!widget.networked.roomType) {
      issues.push(`${widget.name}: Missing roomType`);
    }
    
    if (!widget.networked.studentComponentName) {
      issues.push(`${widget.name}: Missing studentComponentName`);
    }
    
    if (widget.networked.hasStartStop === undefined) {
      issues.push(`${widget.name}: Missing hasStartStop flag`);
    }
    
    if (widget.networked.startsActive === undefined) {
      issues.push(`${widget.name}: Missing startsActive flag`);
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

function validateWidgetComponents(): ValidationResult {
  const missing: string[] = [];
  const allWidgets = widgetRegistry.getAll();
  
  allWidgets.forEach(widget => {
    if (!widget.component) {
      missing.push(widget.name);
    }
  });
  
  return {
    category: 'Widget Component Configuration',
    status: missing.length === 0 ? 'pass' : 'fail',
    message: missing.length === 0 
      ? 'All widgets have components configured' 
      : `${missing.length} widgets missing components`,
    details: missing
  };
}

function validateNoDuplicateIds(): ValidationResult {
  const idMap = new Map<WidgetType, string[]>();
  const allWidgets = widgetRegistry.getAll();
  
  allWidgets.forEach(widget => {
    if (!idMap.has(widget.type)) {
      idMap.set(widget.type, []);
    }
    idMap.get(widget.type)!.push(widget.name);
  });
  
  const duplicates: string[] = [];
  idMap.forEach((names, id) => {
    if (names.length > 1) {
      duplicates.push(`Type ${id}: ${names.join(', ')}`);
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

function validateStudentComponents(): ValidationResult {
  const expectedComponents = new Set([
    'PollActivity',
    'LinkShareActivity',
    'RTFeedbackActivity',
    'QuestionsActivity'
  ]);
  
  const networkedWidgets = widgetRegistry.getNetworkedWidgets();
  const configuredComponents = new Set(
    networkedWidgets
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
export function runWidgetValidation(): boolean {
  const results = validateCompleteWidgetSetup();
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  
  console.group('🔍 Widget Setup Validation');
  console.log(`✅ Passed: ${passed} | ❌ Failed: ${failed} | ⚠️ Warnings: ${warnings}`);
  console.groupEnd();
  
  results.forEach(result => {
    const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
    console.group(`${icon} ${result.category}`);
    console.log(result.message);
    
    if (result.details && result.details.length > 0) {
      console.group('Details:');
      result.details.forEach(detail => {
        console.log(`  - ${detail}`);
      });
      console.groupEnd();
    }
    console.groupEnd();
  });
  
  // Return overall status
  return failed === 0;
}

// Export for use in development
if (process.env.NODE_ENV === 'development') {
  (window as any).validateWidgets = runWidgetValidation;
}