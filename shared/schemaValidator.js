/**
 * 纯净轻量 JSON Schema 结构校验器（零外部依赖）
 * 严格按照标准 JSON Schema 规范进行递归校验，提供精确定位与可读错误提示
 */

export function validateSchema(data, schema, currentPath = "") {
  const errors = [];
  if (!schema || typeof schema !== "object") {
    return { valid: true, errors: [] };
  }

  // 1. null / undefined 检查
  if (data === null || data === undefined) {
    errors.push(`${formatPath(currentPath)} 数据为空 (null/undefined)`);
    return { valid: false, errors };
  }

  // 2. 检查 type
  if (schema.type) {
    const actualType = getActualType(data);
    const expectedType = schema.type;
    if (expectedType === "integer") {
      if (typeof data !== "number" || !Number.isInteger(data)) {
        errors.push(`${formatPath(currentPath)} 期望类型为 integer，实际为 ${actualType}`);
      }
    } else if (expectedType === "number") {
      if (typeof data !== "number" || Number.isNaN(data)) {
        errors.push(`${formatPath(currentPath)} 期望类型为 number，实际为 ${actualType}`);
      }
    } else if (actualType !== expectedType) {
      errors.push(`${formatPath(currentPath)} 期望类型为 ${expectedType}，实际为 ${actualType}`);
      return { valid: false, errors };
    }
  }

  // 3. 检查 enum
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    if (!schema.enum.includes(data)) {
      errors.push(`${formatPath(currentPath)} 值 "${data}" 不在允许的枚举范围 [${schema.enum.join(", ")}] 之内`);
    }
  }

  // 4. 对象校验 (type === "object")
  if (schema.type === "object" || (typeof data === "object" && !Array.isArray(data) && data !== null)) {
    // 4.1 必填字段 required 检查
    if (Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (data[field] === undefined || data[field] === null || data[field] === "") {
          errors.push(`${formatPath(currentPath ? `${currentPath}.${field}` : field)} 必填字段缺失或为空`);
        }
      }
    }

    // 4.2 properties 递归校验
    if (schema.properties && typeof schema.properties === "object") {
      for (const [propKey, propSchema] of Object.entries(schema.properties)) {
        if (data[propKey] !== undefined && data[propKey] !== null) {
          const nextPath = currentPath ? `${currentPath}.${propKey}` : propKey;
          const propRes = validateSchema(data[propKey], propSchema, nextPath);
          if (!propRes.valid) {
            errors.push(...propRes.errors);
          }
        }
      }
    }
  }

  // 5. 数组校验 (type === "array")
  if (schema.type === "array" || Array.isArray(data)) {
    if (!Array.isArray(data)) {
      errors.push(`${formatPath(currentPath)} 期望为数组，实际为 ${typeof data}`);
      return { valid: false, errors };
    }

    if (typeof schema.minItems === "number" && data.length < schema.minItems) {
      errors.push(`${formatPath(currentPath)} 数组元素数量不足（至少需 ${schema.minItems} 项，实际为 ${data.length} 项）`);
    }

    if (typeof schema.maxItems === "number" && data.length > schema.maxItems) {
      errors.push(`${formatPath(currentPath)} 数组元素数量超限（至多允许 ${schema.maxItems} 项，实际为 ${data.length} 项）`);
    }

    if (schema.items && typeof schema.items === "object") {
      for (let i = 0; i < data.length; i++) {
        const itemPath = `${currentPath}[${i}]`;
        const itemRes = validateSchema(data[i], schema.items, itemPath);
        if (!itemRes.valid) {
          errors.push(...itemRes.errors);
        }
      }
    }
  }

  // 6. 字符串长度校验
  if (typeof data === "string") {
    if (typeof schema.minLength === "number" && data.length < schema.minLength) {
      errors.push(`${formatPath(currentPath)} 字符长度不足（最小 ${schema.minLength}，实际 ${data.length}）`);
    }
    if (typeof schema.maxLength === "number" && data.length > schema.maxLength) {
      errors.push(`${formatPath(currentPath)} 字符长度超限（最大 ${schema.maxLength}，实际 ${data.length}）`);
    }
  }

  // 7. 数值范围校验
  if (typeof data === "number") {
    if (typeof schema.minimum === "number" && data < schema.minimum) {
      errors.push(`${formatPath(currentPath)} 数值过小（最小值 ${schema.minimum}，实际 ${data}）`);
    }
    if (typeof schema.maximum === "number" && data > schema.maximum) {
      errors.push(`${formatPath(currentPath)} 数值过大（最大值 ${schema.maximum}，实际 ${data}）`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function getActualType(val) {
  if (val === null) return "null";
  if (Array.isArray(val)) return "array";
  return typeof val;
}

function formatPath(path) {
  return path ? `[${path}]` : "根对象";
}
