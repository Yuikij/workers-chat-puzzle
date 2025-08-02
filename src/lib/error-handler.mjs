/**
 * 统一的错误处理系统
 */

import { createLogger } from './logger.mjs';

const logger = createLogger('ErrorHandler');

/**
 * 错误类型枚举
 */
export const ErrorType = {
  VALIDATION: 'VALIDATION_ERROR',
  NETWORK: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT_ERROR',
  AUTHENTICATION: 'AUTH_ERROR',
  AUTHORIZATION: 'AUTHZ_ERROR',
  NOT_FOUND: 'NOT_FOUND_ERROR',
  CONFLICT: 'CONFLICT_ERROR',
  RATE_LIMIT: 'RATE_LIMIT_ERROR',
  INTERNAL: 'INTERNAL_ERROR',
  CONFIG: 'CONFIG_ERROR',
  EXTERNAL_API: 'EXTERNAL_API_ERROR'
};

/**
 * 自定义错误基类
 */
export class AppError extends Error {
  constructor(message, type = ErrorType.INTERNAL, code = 500, details = {}) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.code = code;
    this.details = details;
    this.timestamp = Date.now();
    this.isOperational = true;
    
    // 保持错误堆栈
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * 转换为JSON格式
   * @returns {Object} JSON表示
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }

  /**
   * 获取用户友好的错误消息
   * @returns {string} 用户友好的消息
   */
  getUserMessage() {
    const userMessages = {
      [ErrorType.VALIDATION]: '输入数据有误，请检查后重试',
      [ErrorType.NETWORK]: '网络连接异常，请稍后重试',
      [ErrorType.TIMEOUT]: '请求超时，请稍后重试',
      [ErrorType.AUTHENTICATION]: '身份验证失败，请重新登录',
      [ErrorType.AUTHORIZATION]: '权限不足，无法执行此操作',
      [ErrorType.NOT_FOUND]: '请求的资源未找到',
      [ErrorType.CONFLICT]: '操作冲突，请刷新后重试',
      [ErrorType.RATE_LIMIT]: '请求过于频繁，请稍后重试',
      [ErrorType.INTERNAL]: '系统内部错误，请稍后重试',
      [ErrorType.CONFIG]: '系统配置错误，请联系管理员',
      [ErrorType.EXTERNAL_API]: '外部服务异常，请稍后重试'
    };
    
    return userMessages[this.type] || '未知错误，请稍后重试';
  }
}

/**
 * 验证错误
 */
export class ValidationError extends AppError {
  constructor(message, field = null, details = {}) {
    super(message, ErrorType.VALIDATION, 400, { field, ...details });
    this.name = 'ValidationError';
  }
}

/**
 * 网络错误
 */
export class NetworkError extends AppError {
  constructor(message, details = {}) {
    super(message, ErrorType.NETWORK, 500, details);
    this.name = 'NetworkError';
  }
}

/**
 * 超时错误
 */
export class TimeoutError extends AppError {
  constructor(message, timeout = null, details = {}) {
    super(message, ErrorType.TIMEOUT, 408, { timeout, ...details });
    this.name = 'TimeoutError';
  }
}

/**
 * 权限错误
 */
export class AuthorizationError extends AppError {
  constructor(message, requiredPermission = null, details = {}) {
    super(message, ErrorType.AUTHORIZATION, 403, { requiredPermission, ...details });
    this.name = 'AuthorizationError';
  }
}

/**
 * 配置错误
 */
export class ConfigError extends AppError {
  constructor(message, configKey = null, details = {}) {
    super(message, ErrorType.CONFIG, 500, { configKey, ...details });
    this.name = 'ConfigError';
  }
}

/**
 * 外部API错误
 */
export class ExternalAPIError extends AppError {
  constructor(message, apiName = null, statusCode = null, details = {}) {
    super(message, ErrorType.EXTERNAL_API, 502, { apiName, statusCode, ...details });
    this.name = 'ExternalAPIError';
  }
}

/**
 * 错误处理器
 */
export class ErrorHandler {
  constructor() {
    this.errorCounts = new Map();
    this.errorCallbacks = new Map();
  }

  /**
   * 处理错误
   * @param {Error} error - 错误对象
   * @param {Object} context - 上下文信息
   * @returns {Object} 处理结果
   */
  handleError(error, context = {}) {
    const errorInfo = this.analyzeError(error, context);
    
    // 记录错误
    this.logError(errorInfo);
    
    // 更新错误统计
    this.updateErrorStats(errorInfo);
    
    // 执行错误回调
    this.executeErrorCallbacks(errorInfo);
    
    // 返回格式化的错误响应
    return this.formatErrorResponse(errorInfo);
  }

  /**
   * 分析错误
   * @param {Error} error - 错误对象
   * @param {Object} context - 上下文信息
   * @returns {Object} 错误信息
   */
  analyzeError(error, context) {
    const isAppError = error instanceof AppError;
    
    return {
      id: this.generateErrorId(),
      error: error,
      type: isAppError ? error.type : ErrorType.INTERNAL,
      code: isAppError ? error.code : 500,
      message: error.message,
      userMessage: isAppError ? error.getUserMessage() : '系统内部错误',
      details: isAppError ? error.details : {},
      stack: error.stack,
      timestamp: Date.now(),
      context: context,
      isOperational: isAppError ? error.isOperational : false
    };
  }

  /**
   * 记录错误日志
   * @param {Object} errorInfo - 错误信息
   */
  logError(errorInfo) {
    const { error, type, context } = errorInfo;
    
    if (errorInfo.isOperational) {
      logger.warn(`Operational error: ${error.message}`, {
        type,
        context,
        errorId: errorInfo.id
      });
    } else {
      logger.error(`Unexpected error: ${error.message}`, {
        type,
        context,
        stack: error.stack,
        errorId: errorInfo.id
      });
    }
  }

  /**
   * 更新错误统计
   * @param {Object} errorInfo - 错误信息
   */
  updateErrorStats(errorInfo) {
    const key = errorInfo.type;
    const count = this.errorCounts.get(key) || 0;
    this.errorCounts.set(key, count + 1);
  }

  /**
   * 执行错误回调
   * @param {Object} errorInfo - 错误信息
   */
  executeErrorCallbacks(errorInfo) {
    const callbacks = this.errorCallbacks.get(errorInfo.type) || [];
    for (const callback of callbacks) {
      try {
        callback(errorInfo);
      } catch (callbackError) {
        logger.error('Error in error callback', callbackError);
      }
    }
  }

  /**
   * 格式化错误响应
   * @param {Object} errorInfo - 错误信息
   * @returns {Object} 格式化的响应
   */
  formatErrorResponse(errorInfo) {
    return {
      success: false,
      error: {
        id: errorInfo.id,
        type: errorInfo.type,
        message: errorInfo.userMessage,
        code: errorInfo.code,
        timestamp: errorInfo.timestamp,
        // 在开发环境下包含更多调试信息
        ...(process.env.NODE_ENV === 'development' && {
          originalMessage: errorInfo.message,
          details: errorInfo.details,
          stack: errorInfo.stack
        })
      }
    };
  }

  /**
   * 生成错误ID
   * @returns {string} 错误ID
   */
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 注册错误回调
   * @param {string} errorType - 错误类型
   * @param {Function} callback - 回调函数
   */
  onError(errorType, callback) {
    if (!this.errorCallbacks.has(errorType)) {
      this.errorCallbacks.set(errorType, []);
    }
    this.errorCallbacks.get(errorType).push(callback);
  }

  /**
   * 获取错误统计
   * @returns {Object} 错误统计
   */
  getErrorStats() {
    return Object.fromEntries(this.errorCounts);
  }

  /**
   * 清除错误统计
   */
  clearErrorStats() {
    this.errorCounts.clear();
  }

  /**
   * 包装异步函数以进行错误处理
   * @param {Function} func - 异步函数
   * @param {Object} context - 上下文信息
   * @returns {Function} 包装后的函数
   */
  wrapAsync(func, context = {}) {
    return async (...args) => {
      try {
        return await func(...args);
      } catch (error) {
        return this.handleError(error, { ...context, args });
      }
    };
  }
}

// 全局错误处理器实例
const globalErrorHandler = new ErrorHandler();

/**
 * 全局错误处理函数
 * @param {Error} error - 错误对象
 * @param {Object} context - 上下文信息
 * @returns {Object} 处理结果
 */
export function handleError(error, context = {}) {
  return globalErrorHandler.handleError(error, context);
}

/**
 * 包装异步函数
 * @param {Function} func - 异步函数
 * @param {Object} context - 上下文信息
 * @returns {Function} 包装后的函数
 */
export function wrapAsync(func, context = {}) {
  return globalErrorHandler.wrapAsync(func, context);
}

/**
 * 注册错误回调
 * @param {string} errorType - 错误类型
 * @param {Function} callback - 回调函数
 */
export function onError(errorType, callback) {
  globalErrorHandler.onError(errorType, callback);
}

/**
 * 获取错误统计
 * @returns {Object} 错误统计
 */
export function getErrorStats() {
  return globalErrorHandler.getErrorStats();
}

// 默认导出
export default globalErrorHandler;