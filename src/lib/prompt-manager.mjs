/**
 * 提示词管理器
 */

// 内联提示词数据以避免导入问题
const promptsData = {
  "version": "1.0",
  "lastUpdated": "2024-01-01",
  "prompts": {
    "system": {
      "role": "你是一个专业的海龟汤游戏主持人。你的任务是根据给定的海龟汤题目（包含汤面和汤底），对玩家的提问进行准确的回答。",
      "rules": [
        "你只能回答'是'、'不是'、'是也不是'、'没有关系'三种答案",
        "根据汤底的真相判断玩家问题的正确性", 
        "对每个问题的质量进行1-10分评分",
        "评分标准：问题越接近核心真相得分越高",
        "当玩家接近真相时可以给出适当提示",
        "保持神秘感，不要直接透露答案"
      ],
      "response_format": {
        "answer": "只能是'是'、'不是'、'没有关系'中的一个",
        "score": "1-10的整数，表示问题质量评分",
        "feedback": "对问题的简短评价，不超过50字",
        "progress": "0-100的整数，表示玩家接近真相的程度",
        "hint": "可选，当进度超过70时给出提示，不超过30字"
      }
    },
    "templates": {
      "game_start": "🐢 海龟汤开始！\n\n**题目：{title}**\n\n{surface}\n\n现在你可以开始提问了，我只会回答'是'、'不是'或'没有关系'。",
      "answer_format": "**答案：{answer}**\n评分：{score}/10\n{feedback}\n进度：{progress}%{hint_text}",
      "hint_format": "\n💡 提示：{hint}",
      "game_end": "🎉 恭喜你猜对了！\n\n**真相：**\n{truth}"
    },
    "scoring_criteria": {
      "excellent": {
        "score_range": [9, 10],
        "description": "直击核心，问题非常关键"
      },
      "good": {
        "score_range": [7, 8], 
        "description": "问题很有价值，方向正确"
      },
      "average": {
        "score_range": [5, 6],
        "description": "问题有一定价值，但不够深入"
      },
      "poor": {
        "score_range": [3, 4],
        "description": "问题偏离方向，价值不大"
      },
      "bad": {
        "score_range": [1, 2],
        "description": "问题无关紧要或毫无价值"
      }
    },
    "progress_thresholds": {
      "hint_trigger": 70,
      "near_solution": 85,
      "solution_ready": 95
    }
  },
  "contexts": {
    "analysis_prompt": "请分析以下海龟汤游戏中的问题：\n\n**题目汤面：**{surface}\n\n**题目汤底：**{truth}\n\n**关键词：**{keywords}\n\n**玩家问题：**{question}\n\n请根据汤底真相判断这个问题的答案，并按照以下JSON格式回答：\n```json\n{\n  \"answer\": \"是/不是/没有关系\",\n  \"score\": 数字1-10,\n  \"feedback\": \"对问题的评价\",\n  \"progress\": 数字0-100,\n  \"hint\": \"可选提示\"\n}\n```\n\n评分标准：\n- 9-10分：直击核心，非常关键的问题\n- 7-8分：方向正确，有价值的问题  \n- 5-6分：一般性问题，有一定价值\n- 3-4分：偏离方向，价值不大\n- 1-2分：无关紧要的问题\n\n进度计算：根据问题接近真相的程度，0表示完全无关，100表示已经非常接近真相。\n\n当进度超过70%时，可以在hint字段给出不超过30字的提示。",
    "verification_prompt": "请验证以下回答是否符合海龟汤游戏规则：\n\n答案：{answer}\n评分：{score}\n反馈：{feedback}\n进度：{progress}\n\n如果有问题请指出并给出修正建议。"
  }
};

export class PromptManager {
  constructor() {
    this.prompts = promptsData.prompts || {};
    this.contexts = promptsData.contexts || {};
    
    console.log(`[Prompt Manager] Loaded prompts and contexts`);
  }

  /**
   * 获取系统提示词
   * @returns {Object} 系统提示词配置
   */
  getSystemPrompt() {
    return this.prompts.system || {};
  }

  /**
   * 获取分析提示词模板
   * @returns {string} 分析提示词模板
   */
  getAnalysisPrompt() {
    return this.contexts.analysis_prompt || '';
  }

  /**
   * 构建分析提示词
   * @param {Object} puzzle - 题目对象
   * @param {string} question - 用户问题
   * @returns {string} 完整的分析提示词
   */
  buildAnalysisPrompt(puzzle, question) {
    const template = this.getAnalysisPrompt();
    
    const variables = {
      surface: puzzle.surface || '',
      truth: puzzle.truth || '',
      keywords: Array.isArray(puzzle.keywords) ? puzzle.keywords.join('、') : '',
      question: question || ''
    };

    let prompt = template;
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      prompt = prompt.replace(new RegExp(placeholder, 'g'), value);
    });

    console.log(`[Prompt Manager] Built analysis prompt for question: "${question}"`);
    return prompt;
  }

  /**
   * 构建系统消息
   * @returns {Object} 系统消息对象
   */
  buildSystemMessage() {
    const systemPrompt = this.getSystemPrompt();
    
    const content = [
      systemPrompt.role || '',
      '',
      '规则：',
      ...(systemPrompt.rules || []).map(rule => `- ${rule}`),
      '',
      '回答格式要求：',
      '- answer: 只能是"是"、"不是"、"没有关系"中的一个',
      '- score: 1-10的整数，表示问题质量评分',
      '- feedback: 对问题的简短评价，不超过50字',
      '- progress: 0-100的整数，表示玩家接近真相的程度',
      '- hint: 可选，当进度超过70时给出提示，不超过30字'
    ].filter(line => line !== null).join('\n');

    return {
      role: 'system',
      content: content.trim()
    };
  }

  /**
   * 构建用户消息
   * @param {Object} puzzle - 题目对象
   * @param {string} question - 用户问题
   * @returns {Object} 用户消息对象
   */
  buildUserMessage(puzzle, question) {
    const prompt = this.buildAnalysisPrompt(puzzle, question);
    
    return {
      role: 'user', 
      content: prompt
    };
  }

  /**
   * 构建完整的消息数组
   * @param {Object} puzzle - 题目对象
   * @param {string} question - 用户问题
   * @returns {Array} 消息数组
   */
  buildMessages(puzzle, question) {
    return [
      this.buildSystemMessage(),
      this.buildUserMessage(puzzle, question)
    ];
  }

  /**
   * 格式化游戏开始消息
   * @param {Object} puzzle - 题目对象
   * @returns {string} 格式化后的开始消息
   */
  formatGameStart(puzzle) {
    const template = this.prompts.templates?.game_start || '🐢 海龟汤开始！\n\n**题目：{title}**\n\n{surface}\n\n现在你可以开始提问了，我只会回答"是"、"不是"或"没有关系"。';
    
    return template
      .replace('{title}', puzzle.title || '未知题目')
      .replace('{surface}', puzzle.surface || '题目描述缺失');
  }

  /**
   * 格式化AI回答消息
   * @param {Object} response - AI回答对象
   * @returns {string} 格式化后的回答消息
   */
  formatAIResponse(response) {
    const template = this.prompts.templates?.answer_format || '**答案：{answer}**\n评分：{score}/10\n{feedback}\n进度：{progress}%{hint_text}';
    const hintTemplate = this.prompts.templates?.hint_format || '\n💡 提示：{hint}';
    
    let hintText = '';
    if (response.hint) {
      hintText = hintTemplate.replace('{hint}', response.hint);
    }
    
    return template
      .replace('{answer}', response.answer || '没有关系')
      .replace('{score}', response.score || 1)
      .replace('{feedback}', response.feedback || '无评价')
      .replace('{progress}', response.progress || 0)
      .replace('{hint_text}', hintText);
  }

  /**
   * 格式化游戏结束消息
   * @param {Object} puzzle - 题目对象
   * @returns {string} 格式化后的结束消息
   */
  formatGameEnd(puzzle) {
    const template = this.prompts.templates?.game_end || '🎉 恭喜你猜对了！\n\n**真相：**\n{truth}';
    
    return template.replace('{truth}', puzzle.truth || '真相缺失');
  }

  /**
   * 获取评分标准
   * @param {number} score - 分数
   * @returns {Object} 评分标准信息
   */
  getScoringCriteria(score) {
    const criteria = this.prompts.scoring_criteria || {};
    
    for (const [level, config] of Object.entries(criteria)) {
      const [min, max] = config.score_range || [0, 0];
      if (score >= min && score <= max) {
        return {
          level: level,
          description: config.description || '无描述'
        };
      }
    }
    
    return {
      level: 'unknown',
      description: '未知评分'
    };
  }

  /**
   * 获取进度阈值配置
   * @returns {Object} 进度阈值配置
   */
  getProgressThresholds() {
    return this.prompts.progress_thresholds || {
      hint_trigger: 70,
      near_solution: 85,
      solution_ready: 95
    };
  }

  /**
   * 判断是否应该给出提示
   * @param {number} progress - 当前进度
   * @returns {boolean} 是否应该给出提示
   */
  shouldGiveHint(progress) {
    const thresholds = this.getProgressThresholds();
    return progress >= thresholds.hint_trigger;
  }

  /**
   * 判断是否接近解答
   * @param {number} progress - 当前进度  
   * @returns {boolean} 是否接近解答
   */
  isNearSolution(progress) {
    const thresholds = this.getProgressThresholds();
    return progress >= thresholds.near_solution;
  }

  /**
   * 判断是否可以解答
   * @param {number} progress - 当前进度
   * @returns {boolean} 是否可以解答
   */
  isSolutionReady(progress) {
    const thresholds = this.getProgressThresholds();
    return progress >= thresholds.solution_ready;
  }

  /**
   * 获取验证提示词
   * @param {Object} response - AI回答对象
   * @returns {string} 验证提示词
   */
  getVerificationPrompt(response) {
    const template = this.contexts.verification_prompt || '';
    
    return template
      .replace('{answer}', response.answer || '')
      .replace('{score}', response.score || '')
      .replace('{feedback}', response.feedback || '')
      .replace('{progress}', response.progress || '');
  }

  /**
   * 验证回答格式
   * @param {Object} response - AI回答对象
   * @returns {Object} 验证结果
   */
  validateResponse(response) {
    const errors = [];
    
    // 检查必需字段
    if (!response.answer) {
      errors.push('Missing answer field');
    } else {
      const validAnswers = ['是', '不是', '没有关系'];
      if (!validAnswers.includes(response.answer)) {
        errors.push(`Invalid answer: ${response.answer}`);
      }
    }
    
    if (typeof response.score !== 'number' || response.score < 1 || response.score > 10) {
      errors.push('Score must be a number between 1 and 10');
    }
    
    if (!response.feedback || typeof response.feedback !== 'string') {
      errors.push('Feedback must be a non-empty string');
    }
    
    if (typeof response.progress !== 'number' || response.progress < 0 || response.progress > 100) {
      errors.push('Progress must be a number between 0 and 100');
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * 获取随机鼓励语
   * @param {number} score - 分数
   * @returns {string} 鼓励语
   */
  getRandomEncouragement(score) {
    const encouragements = {
      high: ['很棒的问题！', '问得很好！', '思路清晰！', '接近真相了！'],
      medium: ['不错的尝试', '继续努力', '方向正确', '再深入一点'],
      low: ['换个角度试试', '重新思考一下', '从其他方面考虑', '需要更仔细的观察']
    };
    
    let category = 'low';
    if (score >= 7) category = 'high';
    else if (score >= 4) category = 'medium';
    
    const options = encouragements[category];
    return options[Math.floor(Math.random() * options.length)];
  }
}

/**
 * 创建提示词管理器实例
 * @returns {PromptManager} 提示词管理器实例
 */
export function createPromptManager() {
  return new PromptManager();
}