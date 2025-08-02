/**
 * 通用工具函数
 */

/**
 * 深拷贝对象
 * @param {any} obj - 要拷贝的对象
 * @returns {any} 深拷贝后的对象
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }
  
  if (typeof obj === 'object') {
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  
  return obj;
}

/**
 * 安全的JSON解析
 * @param {string} jsonString - JSON字符串
 * @param {any} defaultValue - 解析失败时的默认值
 * @returns {any} 解析结果或默认值
 */
export function safeJsonParse(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn(`[Utils] JSON parse failed:`, error.message);
    return defaultValue;
  }
}

/**
 * 安全的JSON字符串化
 * @param {any} obj - 要序列化的对象
 * @param {string} defaultValue - 序列化失败时的默认值
 * @returns {string} JSON字符串或默认值
 */
export function safeJsonStringify(obj, defaultValue = '{}') {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    console.warn(`[Utils] JSON stringify failed:`, error.message);
    return defaultValue;
  }
}

/**
 * 创建带超时的Promise
 * @param {Promise} promise - 原始Promise
 * @param {number} timeout - 超时时间（毫秒）
 * @param {string} errorMessage - 超时错误信息
 * @returns {Promise} 带超时的Promise
 */
export function withTimeout(promise, timeout, errorMessage = 'Operation timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(errorMessage)), timeout)
    )
  ]);
}

/**
 * 延迟函数
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise} Promise对象
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 创建去重数组
 * @param {Array} array - 原始数组
 * @param {Function} keyFn - 键函数（可选）
 * @returns {Array} 去重后的数组
 */
export function uniqueArray(array, keyFn = null) {
  if (!Array.isArray(array)) {
    return [];
  }
  
  if (keyFn) {
    const seen = new Set();
    return array.filter(item => {
      const key = keyFn(item);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
  
  return [...new Set(array)];
}

/**
 * 验证对象字段
 * @param {Object} obj - 要验证的对象
 * @param {Array} requiredFields - 必需字段列表
 * @param {Array} optionalFields - 可选字段列表
 * @returns {Object} 验证结果
 */
export function validateFields(obj, requiredFields = [], optionalFields = []) {
  const errors = [];
  const warnings = [];
  
  // 检查必需字段
  for (const field of requiredFields) {
    if (!(field in obj) || obj[field] === undefined || obj[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // 检查未知字段
  const allowedFields = new Set([...requiredFields, ...optionalFields]);
  for (const field in obj) {
    if (!allowedFields.has(field)) {
      warnings.push(`Unknown field: ${field}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 安全的数字转换
 * @param {any} value - 要转换的值
 * @param {number} defaultValue - 默认值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 转换后的数字
 */
export function safeNumber(value, defaultValue = 0, min = -Infinity, max = Infinity) {
  const num = Number(value);
  if (isNaN(num)) {
    return defaultValue;
  }
  return Math.min(max, Math.max(min, num));
}

/**
 * 安全的字符串截取
 * @param {any} value - 要转换的值
 * @param {number} maxLength - 最大长度
 * @param {string} defaultValue - 默认值
 * @returns {string} 截取后的字符串
 */
export function safeString(value, maxLength = 1000, defaultValue = '') {
  if (typeof value !== 'string') {
    value = String(value || defaultValue);
  }
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

/**
 * 生成随机ID
 * @param {number} length - ID长度
 * @param {string} prefix - 前缀
 * @returns {string} 随机ID
 */
export function generateId(length = 8, prefix = '') {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = prefix;
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 创建错误响应
 * @param {string} message - 错误信息
 * @param {number} code - 错误代码
 * @param {Object} details - 详细信息
 * @returns {Object} 错误响应对象
 */
export function createErrorResponse(message, code = 'UNKNOWN_ERROR', details = {}) {
  return {
    success: false,
    error: {
      message,
      code,
      timestamp: Date.now(),
      ...details
    }
  };
}

/**
 * 创建成功响应
 * @param {any} data - 响应数据
 * @param {string} message - 成功信息
 * @returns {Object} 成功响应对象
 */
export function createSuccessResponse(data = null, message = 'Success') {
  const response = {
    success: true,
    message,
    timestamp: Date.now()
  };
  
  if (data !== null) {
    response.data = data;
  }
  
  return response;
}

/**
 * 记录函数执行时间
 * @param {Function} func - 要执行的函数
 * @param {string} name - 函数名称
 * @returns {any} 函数执行结果
 */
export async function measureTime(func, name = 'Anonymous') {
  const startTime = Date.now();
  try {
    const result = await func();
    const endTime = Date.now();
    console.log(`[Utils] ${name} executed in ${endTime - startTime}ms`);
    return result;
  } catch (error) {
    const endTime = Date.now();
    console.error(`[Utils] ${name} failed after ${endTime - startTime}ms:`, error);
    throw error;
  }
}

/**
 * 限制并发执行数量
 * @param {Array} tasks - 任务数组
 * @param {number} limit - 并发限制
 * @returns {Promise<Array>} 执行结果
 */
export async function limitConcurrency(tasks, limit = 3) {
  const results = [];
  const executing = [];
  
  for (const task of tasks) {
    const promise = Promise.resolve(task()).then(result => {
      executing.splice(executing.indexOf(promise), 1);
      return result;
    });
    
    results.push(promise);
    executing.push(promise);
    
    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }
  
  return Promise.all(results);
}