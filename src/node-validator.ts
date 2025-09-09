import { N8nNodeType, N8nNodeProperty, ValidationError, ValidationResult } from './types.js';
import { getNodeType } from './node-registry.js';

/**
 * Validates a node configuration against its type definition
 */
export function validateNodeConfig(nodeType: string, parameters: Record<string, any>): ValidationResult {
  const errors: ValidationError[] = [];
  
  // Get the node type definition
  const nodeTypeDef = getNodeType(nodeType);
  if (!nodeTypeDef) {
    errors.push({
      property: 'type',
      message: `Unknown node type: ${nodeType}`,
      code: 'INVALID_TYPE',
      expected: 'Known node type',
      actual: nodeType,
    });
    return { valid: false, errors };
  }

  // Validate each property in the node type definition
  for (const property of nodeTypeDef.properties) {
    const value = parameters[property.name];
    const propertyErrors = validateProperty(property, value, parameters);
    errors.push(...propertyErrors);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a single property against its definition
 */
function validateProperty(
  property: N8nNodeProperty,
  value: any,
  allParameters: Record<string, any>
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check if property should be shown based on displayOptions
  if (!shouldShowProperty(property, allParameters)) {
    return errors;
  }

  // Check required properties
  if (property.required && (value === undefined || value === null || value === '')) {
    errors.push({
      property: property.name,
      message: `Required property '${property.displayName}' is missing`,
      code: 'MISSING_REQUIRED',
      expected: `Non-empty value of type ${property.type}`,
      actual: value,
    });
    return errors; // Don't validate further if required value is missing
  }

  // Skip validation if value is not provided and not required
  if (value === undefined || value === null) {
    return errors;
  }

  // Type-specific validation
  switch (property.type) {
    case 'string':
      if (typeof value !== 'string') {
        errors.push({
          property: property.name,
          message: `Property '${property.displayName}' must be a string`,
          code: 'INVALID_TYPE',
          expected: 'string',
          actual: typeof value,
        });
      }
      break;

    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        errors.push({
          property: property.name,
          message: `Property '${property.displayName}' must be a number`,
          code: 'INVALID_TYPE',
          expected: 'number',
          actual: typeof value,
        });
      } else {
        // Check number ranges
        if (property.typeOptions?.minValue !== undefined && value < property.typeOptions.minValue) {
          errors.push({
            property: property.name,
            message: `Property '${property.displayName}' must be at least ${property.typeOptions.minValue}`,
            code: 'INVALID_RANGE',
            expected: `>= ${property.typeOptions.minValue}`,
            actual: value,
          });
        }
        if (property.typeOptions?.maxValue !== undefined && value > property.typeOptions.maxValue) {
          errors.push({
            property: property.name,
            message: `Property '${property.displayName}' must be at most ${property.typeOptions.maxValue}`,
            code: 'INVALID_RANGE',
            expected: `<= ${property.typeOptions.maxValue}`,
            actual: value,
          });
        }
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        errors.push({
          property: property.name,
          message: `Property '${property.displayName}' must be a boolean`,
          code: 'INVALID_TYPE',
          expected: 'boolean',
          actual: typeof value,
        });
      }
      break;

    case 'options':
      if (property.options) {
        const validValues = property.options.map(opt => opt.value);
        if (!validValues.includes(value)) {
          errors.push({
            property: property.name,
            message: `Property '${property.displayName}' must be one of: ${validValues.join(', ')}`,
            code: 'INVALID_ENUM',
            expected: validValues,
            actual: value,
          });
        }
      }
      break;

    case 'multiOptions':
      if (property.options) {
        const validValues = property.options.map(opt => opt.value);
        if (!Array.isArray(value)) {
          errors.push({
            property: property.name,
            message: `Property '${property.displayName}' must be an array`,
            code: 'INVALID_TYPE',
            expected: 'array',
            actual: typeof value,
          });
        } else {
          const invalidValues = value.filter(v => !validValues.includes(v));
          if (invalidValues.length > 0) {
            errors.push({
              property: property.name,
              message: `Property '${property.displayName}' contains invalid values: ${invalidValues.join(', ')}`,
              code: 'INVALID_ENUM',
              expected: validValues,
              actual: invalidValues,
            });
          }
        }
      }
      break;

    case 'credentials':
      // Basic credential validation - check if it's a non-empty string
      if (typeof value !== 'string' || value.trim() === '') {
        errors.push({
          property: property.name,
          message: `Property '${property.displayName}' requires a valid credential`,
          code: 'MISSING_CREDENTIAL',
          expected: 'non-empty credential string',
          actual: value,
        });
      }
      break;

    case 'collection':
    case 'fixedCollection':
      if (value !== null && typeof value !== 'object') {
        errors.push({
          property: property.name,
          message: `Property '${property.displayName}' must be an object`,
          code: 'INVALID_TYPE',
          expected: 'object',
          actual: typeof value,
        });
      }
      break;

    case 'hidden':
    case 'notice':
      // These types don't require validation
      break;

    default:
      // Unknown type - log but don't fail validation
      console.warn(`Unknown property type: ${property.type} for property ${property.name}`);
      break;
  }

  return errors;
}

/**
 * Determines if a property should be shown based on display options
 */
function shouldShowProperty(property: N8nNodeProperty, allParameters: Record<string, any>): boolean {
  if (!property.displayOptions) {
    return true; // Show by default if no display options
  }

  // Check show conditions
  if (property.displayOptions.show) {
    for (const [paramName, allowedValues] of Object.entries(property.displayOptions.show)) {
      const paramValue = allParameters[paramName];
      if (!allowedValues.includes(paramValue)) {
        return false; // Hide if show condition not met
      }
    }
  }

  // Check hide conditions
  if (property.displayOptions.hide) {
    for (const [paramName, hiddenValues] of Object.entries(property.displayOptions.hide)) {
      const paramValue = allParameters[paramName];
      if (hiddenValues.includes(paramValue)) {
        return false; // Hide if hide condition met
      }
    }
  }

  return true;
}

/**
 * Validates that required credentials are present
 */
export function validateCredentials(nodeType: string, credentials: Record<string, string> = {}): ValidationError[] {
  const errors: ValidationError[] = [];
  const nodeTypeDef = getNodeType(nodeType);
  
  if (!nodeTypeDef || !nodeTypeDef.credentials) {
    return errors;
  }

  for (const credentialType of nodeTypeDef.credentials) {
    if (credentialType.required && !credentials[credentialType.name]) {
      errors.push({
        property: 'credentials',
        message: `Required credential '${credentialType.name}' is missing`,
        code: 'MISSING_CREDENTIAL',
        expected: credentialType.name,
        actual: 'undefined',
      });
    }
  }

  return errors;
}

/**
 * Performs comprehensive validation of a node configuration including credentials
 */
export function validateFullNodeConfig(
  nodeType: string,
  parameters: Record<string, any>,
  credentials: Record<string, string> = {}
): ValidationResult {
  const parameterValidation = validateNodeConfig(nodeType, parameters);
  const credentialErrors = validateCredentials(nodeType, credentials);
  
  return {
    valid: parameterValidation.valid && credentialErrors.length === 0,
    errors: [...parameterValidation.errors, ...credentialErrors],
  };
}