/**
 * 统一的日志系统
 */

export const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

export class Logger {
  constructor(name, level = LogLevel.INFO) {
    this.name = name;
    this.level = level;
    this.startTime = Date.now();
  }

  /**
   * 格式化日志消息
   * @param {string} level - 日志级别
   * @param {string} message - 消息
   * @param {any} data - 附加数据
   * @returns {string} 格式化后的日志
   */
  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const elapsed = Date.now() - this.startTime;
    
    let formatted = `[${timestamp}] [${level}] [${this.name}] ${message}`;
    
    if (elapsed > 0) {
      formatted += ` (${elapsed}ms)`;
    }
    
    return formatted;
  }

  /**
   * 错误日志
   * @param {string} message - 消息
   * @param {any} data - 附加数据
   */
  error(message, data = null) {
    if (this.level >= LogLevel.ERROR) {
      const formatted = this.formatMessage('ERROR', message, data);
      console.error(formatted);
      if (data) {
        console.error('Error data:', data);
      }
    }
  }

  /**
   * 警告日志
   * @param {string} message - 消息
   * @param {any} data - 附加数据
   */
  warn(message, data = null) {
    if (this.level >= LogLevel.WARN) {
      const formatted = this.formatMessage('WARN', message, data);
      console.warn(formatted);
      if (data) {
        console.warn('Warning data:', data);
      }
    }
  }

  /**
   * 信息日志
   * @param {string} message - 消息
   * @param {any} data - 附加数据
   */
  info(message, data = null) {
    if (this.level >= LogLevel.INFO) {
      const formatted = this.formatMessage('INFO', message, data);
      console.log(formatted);
      if (data) {
        console.log('Info data:', data);
      }
    }
  }

  /**
   * 调试日志
   * @param {string} message - 消息
   * @param {any} data - 附加数据
   */
  debug(message, data = null) {
    if (this.level >= LogLevel.DEBUG) {
      const formatted = this.formatMessage('DEBUG', message, data);
      console.log(formatted);
      if (data) {
        console.log('Debug data:', data);
      }
    }
  }

  /**
   * 记录方法执行时间
   * @param {string} methodName - 方法名
   * @param {Function} func - 要执行的函数
   * @returns {any} 函数执行结果
   */
  async time(methodName, func) {
    const start = Date.now();
    this.debug(`Starting ${methodName}`);
    
    try {
      const result = await func();
      const duration = Date.now() - start;
      this.debug(`Completed ${methodName} in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`Failed ${methodName} after ${duration}ms`, error);
      throw error;
    }
  }

  /**
   * 创建子日志器
   * @param {string} subName - 子日志器名称
   * @returns {Logger} 子日志器
   */
  child(subName) {
    return new Logger(`${this.name}:${subName}`, this.level);
  }

  /**
   * 设置日志级别
   * @param {number} level - 日志级别
   */
  setLevel(level) {
    this.level = level;
  }
}

/**
 * 全局日志器管理
 */
class LoggerManager {
  constructor() {
    this.loggers = new Map();
    this.globalLevel = LogLevel.INFO;
  }

  /**
   * 获取或创建日志器
   * @param {string} name - 日志器名称
   * @returns {Logger} 日志器实例
   */
  getLogger(name) {
    if (!this.loggers.has(name)) {
      this.loggers.set(name, new Logger(name, this.globalLevel));
    }
    return this.loggers.get(name);
  }

  /**
   * 设置全局日志级别
   * @param {number} level - 日志级别
   */
  setGlobalLevel(level) {
    this.globalLevel = level;
    for (const logger of this.loggers.values()) {
      logger.setLevel(level);
    }
  }

  /**
   * 获取所有日志器
   * @returns {Map} 日志器映射
   */
  getAllLoggers() {
    return new Map(this.loggers);
  }
}

// 全局日志器管理器实例
const loggerManager = new LoggerManager();

/**
 * 创建或获取日志器
 * @param {string} name - 日志器名称
 * @returns {Logger} 日志器实例
 */
export function createLogger(name) {
  return loggerManager.getLogger(name);
}

/**
 * 设置全局日志级别
 * @param {number} level - 日志级别
 */
export function setGlobalLogLevel(level) {
  loggerManager.setGlobalLevel(level);
}

/**
 * 从环境变量获取日志级别
 * @param {Object} env - 环境变量
 * @returns {number} 日志级别
 */
export function getLogLevelFromEnv(env) {
  const levelStr = env.LOG_LEVEL || 'INFO';
  
  switch (levelStr.toUpperCase()) {
    case 'ERROR':
      return LogLevel.ERROR;
    case 'WARN':
      return LogLevel.WARN;
    case 'INFO':
      return LogLevel.INFO;
    case 'DEBUG':
      return LogLevel.DEBUG;
    default:
      return LogLevel.INFO;
  }
}

/**
 * 初始化日志系统
 * @param {Object} env - 环境变量
 */
export function initializeLogging(env) {
  const level = getLogLevelFromEnv(env);
  setGlobalLogLevel(level);
  
  const logger = createLogger('LogSystem');
  logger.info(`Logging initialized with level: ${Object.keys(LogLevel)[level]}`);
}

// 默认导出常用的日志器
export default createLogger('Default');