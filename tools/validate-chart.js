#!/usr/bin/env node
/**
 * validate-chart.js
 * Validates a chart JSON against spec/chart.schema.json (JSON Schema draft-07)
 * No external dependencies.
 * CLI: node tools/validate-chart.js <chart.json>
 * Export: validateChart(chart) -> { ok: boolean, errors: string[] }
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Minimal JSON Schema draft-07 validator (subset needed for chart.schema.json) ──

function typeCheck(value, type) {
  if (type === 'string') return typeof value === 'string';
  if (type === 'number') return typeof value === 'number' && isFinite(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'null') return value === null;
  return false;
}

function validateValue(schema, value, path, errors) {
  if (schema === true) return;
  if (schema === false) { errors.push(`${path}: schema forbids any value`); return; }

  // type check
  if (schema.type !== undefined) {
    if (!typeCheck(value, schema.type)) {
      errors.push(`${path}: expected type "${schema.type}", got ${Array.isArray(value) ? 'array' : typeof value}`);
      return;
    }
  }

  // const
  if ('const' in schema) {
    if (value !== schema.const) {
      errors.push(`${path}: expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);
    }
  }

  // enum
  if (schema.enum !== undefined) {
    if (!schema.enum.includes(value)) {
      errors.push(`${path}: value ${JSON.stringify(value)} not in enum ${JSON.stringify(schema.enum)}`);
    }
  }

  // string constraints
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${path}: string length ${value.length} < minLength ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${path}: string length ${value.length} > maxLength ${schema.maxLength}`);
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${path}: string does not match pattern ${schema.pattern}`);
    }
  }

  // number constraints
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${path}: ${value} < minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${path}: ${value} > maximum ${schema.maximum}`);
    }
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      errors.push(`${path}: ${value} <= exclusiveMinimum ${schema.exclusiveMinimum}`);
    }
    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
      errors.push(`${path}: ${value} >= exclusiveMaximum ${schema.exclusiveMaximum}`);
    }
  }

  // object constraints
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    // required
    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in value)) {
          errors.push(`${path}: missing required property "${key}"`);
        }
      }
    }
    // properties
    if (schema.properties) {
      for (const [key, subSchema] of Object.entries(schema.properties)) {
        if (key in value) {
          validateValue(subSchema, value[key], `${path}.${key}`, errors);
        }
      }
    }
    // additionalProperties
    if (schema.additionalProperties === false && schema.properties) {
      const allowed = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) {
          errors.push(`${path}: additional property "${key}" not allowed`);
        }
      }
    }
  }

  // array constraints
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${path}: array length ${value.length} < minItems ${schema.minItems}`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${path}: array length ${value.length} > maxItems ${schema.maxItems}`);
    }
    if (schema.items !== undefined) {
      value.forEach((item, i) => {
        validateValue(schema.items, item, `${path}[${i}]`, errors);
      });
    }
  }
}

/**
 * Validate chart data against the chart schema.
 * @param {object} chart - Parsed chart JSON
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateChart(chart) {
  const schemaPath = resolve(__dirname, '../spec/chart.schema.json');
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const errors = [];
  validateValue(schema, chart, '$', errors);
  return { ok: errors.length === 0, errors };
}

// CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node tools/validate-chart.js <chart.json>');
    process.exit(1);
  }
  const chartPath = resolve(args[0]);
  let chart;
  try {
    chart = JSON.parse(readFileSync(chartPath, 'utf8'));
  } catch (e) {
    console.error(`Failed to read/parse ${chartPath}: ${e.message}`);
    process.exit(1);
  }
  const result = validateChart(chart);
  if (result.ok) {
    console.log('CHART OK');
    process.exit(0);
  } else {
    console.error('CHART INVALID:');
    result.errors.forEach(e => console.error('  ' + e));
    process.exit(1);
  }
}
