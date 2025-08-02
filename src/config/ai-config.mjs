/**
 * AI配置管理
 */

/**
 * 默认AI配置
 */
export const DEFAULT_AI_CONFIG = {
  // LLM API配置
  llm: {
    apiUrl: '',
    model: 'gpt-4',
    maxTokens: 1000,
    temperature: 0.7,
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 1000
  },
  
  // 游戏规则配置
  game: {
    maxQuestionsPerRound: 50,        // 每轮最大问题数
    hintFrequency: 5,                // 每5个问题给一次提示
    autoHintThreshold: 20,           // 超过20个问题自动给提示
    minScoreForHint: 5,              // 最低分数要求才给提示
    progressBoostOnGoodQuestion: 5,  // 好问题的进度加成
    maxGameDuration: 1800,           // 最大游戏时长（秒）
  },
  
  // 评分配置
  scoring: {
    baseScore: 1,                    // 基础分数
    maxScore: 10,                    // 最高分数
    progressWeight: 0.3,             // 进度权重
    creativityBonus: 2,              // 创新问题加分
    repetitionPenalty: -1,           // 重复问题扣分
  },
  
  // 进度计算配置
  progress: {
    keywordMatchBonus: 10,           // 关键词匹配加成
    directQuestionBonus: 15,         // 直接问题加成
    logicalDeductionBonus: 12,       // 逻辑推理加成
    wrongDirectionPenalty: -5,       // 错误方向惩罚
    hintUsagePenalty: -2,            // 使用提示惩罚
  },
  
  // 响应配置
  response: {
    enableEmoji: true,               // 启用表情符号
    enableEncouragement: true,       // 启用鼓励语
    enableProgress: true,            // 显示进度
    enableScoring: true,             // 显示评分
    maxFeedbackLength: 50,           // 最大反馈长度
    maxHintLength: 30,               // 最大提示长度
  }
};

/**
 * 环境配置映射
 */
export const ENV_CONFIG_MAP = {
  // LLM配置
  'LLM_API_URL': 'llm.apiUrl',
  'LLM_API_KEY': 'llm.apiKey',
  'LLM_MODEL': 'llm.model',
  'LLM_MAX_TOKENS': 'llm.maxTokens',
  'LLM_TEMPERATURE': 'llm.temperature',
  'LLM_TIMEOUT': 'llm.timeout',
  'LLM_MAX_RETRIES': 'llm.maxRetries',
  
  // 游戏配置
  'GAME_MAX_QUESTIONS': 'game.maxQuestionsPerRound',
  'GAME_HINT_FREQUENCY': 'game.hintFrequency',
  'GAME_AUTO_HINT_THRESHOLD': 'game.autoHintThreshold',
  'GAME_MAX_DURATION': 'game.maxGameDuration',
  
  // 评分配置
  'SCORING_MAX_SCORE': 'scoring.maxScore',
  'SCORING_PROGRESS_WEIGHT': 'scoring.progressWeight',
  'SCORING_CREATIVITY_BONUS': 'scoring.creativityBonus',
  
  // 响应配置
  'RESPONSE_ENABLE_EMOJI': 'response.enableEmoji',
  'RESPONSE_ENABLE_ENCOURAGEMENT': 'response.enableEncouragement',
  'RESPONSE_MAX_FEEDBACK_LENGTH': 'response.maxFeedbackLength',
  'RESPONSE_MAX_HINT_LENGTH': 'response.maxHintLength',
};

/**
 * 解析配置值
 * @param {string} value - 环境变量值
 * @param {string} type - 配置类型
 * @returns {any} 解析后的值
 */
function parseConfigValue(value, type) {
  if (!value) return undefined;
  
  switch (type) {
    case 'number':
      const num = Number(value);
      return isNaN(num) ? undefined : num;
    case 'boolean':
      return value.toLowerCase() === 'true';
    case 'string':
    default:
      return value;
  }
}

/**
 * 获取配置值类型
 * @param {string} path - 配置路径
 * @returns {string} 配置类型
 */
function getConfigType(path) {
  const numberPaths = [
    'llm.maxTokens', 'llm.temperature', 'llm.timeout', 'llm.maxRetries',
    'game.maxQuestionsPerRound', 'game.hintFrequency', 'game.autoHintThreshold',
    'game.maxGameDuration', 'scoring.maxScore', 'scoring.progressWeight',
    'scoring.creativityBonus', 'response.maxFeedbackLength', 'response.maxHintLength'
  ];
  
  const booleanPaths = [
    'response.enableEmoji', 'response.enableEncouragement',
    'response.enableProgress', 'response.enableScoring'
  ];
  
  if (numberPaths.includes(path)) return 'number';
  if (booleanPaths.includes(path)) return 'boolean';
  return 'string';
}

/**
 * 设置嵌套对象属性
 * @param {Object} obj - 目标对象
 * @param {string} path - 属性路径
 * @param {any} value - 属性值
 */
function setNestedProperty(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[keys[keys.length - 1]] = value;
}

/**
 * 从环境变量构建配置
 * @param {Object} env - 环境变量对象
 * @returns {Object} AI配置对象
 */
export function buildAIConfig(env = {}) {
  // 深拷贝默认配置
  const config = JSON.parse(JSON.stringify(DEFAULT_AI_CONFIG));
  
  // 应用环境变量
  Object.entries(ENV_CONFIG_MAP).forEach(([envKey, configPath]) => {
    const envValue = env[envKey];
    if (envValue !== undefined) {
      const type = getConfigType(configPath);
      const parsedValue = parseConfigValue(envValue, type);
      
      if (parsedValue !== undefined) {
        setNestedProperty(config, configPath, parsedValue);
        console.log(`[AI Config] Set ${configPath} = ${parsedValue} (from ${envKey})`);
      }
    }
  });
  
  // 特殊处理API_KEY
  if (env.LLM_API_KEY) {
    config.llm.apiKey = env.LLM_API_KEY;
    console.log(`[AI Config] Set API key (length: ${env.LLM_API_KEY.length})`);
  }
  
  return config;
}

/**
 * 验证AI配置
 * @param {Object} config - AI配置对象
 * @returns {Object} 验证结果
 */
export function validateAIConfig(config) {
  const errors = [];
  const warnings = [];
  
  // 验证LLM配置
  if (!config.llm?.apiUrl) {
    errors.push('LLM API URL is required');
  }
  
  if (!config.llm?.apiKey) {
    warnings.push('LLM API key is not set');
  }
  
  if (!config.llm?.model) {
    errors.push('LLM model is required');
  }
  
  // 验证数值范围
  if (config.llm?.maxTokens && (config.llm.maxTokens < 100 || config.llm.maxTokens > 4000)) {
    warnings.push('LLM max tokens should be between 100 and 4000');
  }
  
  if (config.llm?.temperature && (config.llm.temperature < 0 || config.llm.temperature > 2)) {
    warnings.push('LLM temperature should be between 0 and 2');
  }
  
  if (config.game?.maxQuestionsPerRound && config.game.maxQuestionsPerRound < 10) {
    warnings.push('Max questions per round seems too low');
  }
  
  if (config.scoring?.maxScore && config.scoring.maxScore !== 10) {
    warnings.push('Max score is recommended to be 10');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors,
    warnings: warnings
  };
}

/**
 * 获取配置摘要（用于日志）
 * @param {Object} config - AI配置对象
 * @returns {Object} 配置摘要
 */
export function getConfigSummary(config) {
  return {
    llm: {
      apiUrl: config.llm?.apiUrl,
      model: config.llm?.model,
      maxTokens: config.llm?.maxTokens,
      temperature: config.llm?.temperature,
      hasApiKey: !!config.llm?.apiKey
    },
    game: {
      maxQuestionsPerRound: config.game?.maxQuestionsPerRound,
      maxGameDuration: config.game?.maxGameDuration
    },
    scoring: {
      maxScore: config.scoring?.maxScore
    },
    response: {
      enableEmoji: config.response?.enableEmoji,
      enableScoring: config.response?.enableScoring
    }
  };
}

/**
 * 创建开发环境配置
 * @returns {Object} 开发环境配置
 */
export function createDevConfig() {
  const config = JSON.parse(JSON.stringify(DEFAULT_AI_CONFIG));
  
  // 开发环境特殊配置
  config.llm.apiUrl = 'http://localhost:3000/v1';
  config.llm.timeout = 10000;
  config.llm.maxRetries = 1;
  config.game.maxQuestionsPerRound = 20;
  config.response.enableEmoji = true;
  
  return config;
}

/**
 * 创建生产环境配置
 * @returns {Object} 生产环境配置
 */
export function createProdConfig() {
  const config = JSON.parse(JSON.stringify(DEFAULT_AI_CONFIG));
  
  // 生产环境特殊配置
  config.llm.timeout = 30000;
  config.llm.maxRetries = 3;
  config.game.maxQuestionsPerRound = 50;
  config.response.enableEmoji = true;
  
  return config;
}