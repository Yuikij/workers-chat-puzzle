/**
 * AI主持人核心逻辑
 */

import { LLMClient } from './llm-client.mjs';
import { createPromptManager } from './prompt-manager.mjs';
import { createPuzzleManager } from './puzzle-manager.mjs';
import { buildAIConfig, validateAIConfig } from '../config/ai-config.mjs';
import { safeNumber, createErrorResponse, createSuccessResponse, measureTime } from './utils.mjs';
import { createLogger } from './logger.mjs';
import { AppError, ValidationError, ConfigError, handleError, wrapAsync } from './error-handler.mjs';

export class AIHost {
  constructor(env = {}) {
    // 初始化日志器
    this.logger = createLogger('AIHost');
    
    try {
      // 构建和验证配置
      this.config = buildAIConfig(env);
      const validation = validateAIConfig(this.config);
      
      if (!validation.isValid) {
        throw new ConfigError(
          `AI Host configuration error: ${validation.errors.join(', ')}`,
          'ai_host_config',
          { errors: validation.errors }
        );
      }
      
      if (validation.warnings.length > 0) {
        this.logger.warn('Configuration warnings', { warnings: validation.warnings });
      }
      
      // 初始化组件
      this.llmClient = new LLMClient(this.config.llm);
      this.promptManager = createPromptManager();
      this.puzzleManager = createPuzzleManager();
      
      // 游戏状态
      this.currentSession = null;
      this.questionHistory = [];
      this.gameStartTime = null;
      
      this.logger.info('AI Host initialized successfully', {
        hasApiKey: !!this.config.llm.apiKey,
        model: this.config.llm.model
      });
      
    } catch (error) {
      this.logger.error('Failed to initialize AI Host', error);
      throw error;
    }
  }

  /**
   * 开始新的AI主持游戏
   * @param {string} puzzleId - 题目ID，null则随机选择
   * @param {Object} options - 游戏选项
   * @returns {Object} 游戏开始结果
   */
  async startGame(puzzleId = null, options = {}) {
    return this.logger.time('startGame', async () => {
      try {
        this.logger.info('Starting new game', { puzzleId, options });
        
        // 检查当前状态
        if (this.currentSession?.isActive) {
          throw new AppError('已有活跃的游戏会话', 'GAME_ALREADY_ACTIVE', 409);
        }
        
        // 选择题目
        const puzzle = await this.selectPuzzle(puzzleId, options.filters);
        if (!puzzle) {
          throw new AppError('无法找到合适的题目', 'PUZZLE_NOT_FOUND', 404);
        }
        
        // 验证题目完整性
        const puzzleValidation = this.validatePuzzle(puzzle);
        if (!puzzleValidation.isValid) {
          throw new ValidationError(
            `题目数据不完整: ${puzzleValidation.errors.join(', ')}`,
            'puzzle',
            { errors: puzzleValidation.errors }
          );
        }
        
        // 初始化游戏会话
        this.currentSession = this.createGameSession(puzzle);
        this.questionHistory = [];
        this.gameStartTime = Date.now();
        
        this.logger.info('Game started successfully', {
          puzzleId: puzzle.id,
          puzzleTitle: puzzle.title,
          sessionId: this.currentSession.sessionId
        });
        
        return createSuccessResponse({
          puzzle: {
            id: puzzle.id,
            title: puzzle.title,
            surface: puzzle.surface,
            difficulty: puzzle.difficulty,
            category: puzzle.category
          },
          sessionId: this.currentSession.sessionId,
          startMessage: this.promptManager.formatGameStart(puzzle)
        }, 'Game started successfully');
        
      } catch (error) {
        this.logger.error('Failed to start game', error);
        return handleError(error, { method: 'startGame', puzzleId, options });
      }
    });
  }

  /**
   * 选择题目
   * @param {string} puzzleId - 题目ID
   * @param {Object} filters - 过滤条件
   * @returns {Object|null} 选中的题目
   */
  async selectPuzzle(puzzleId, filters = {}) {
    if (puzzleId) {
      return this.puzzleManager.getPuzzleById(puzzleId);
    } else {
      return this.puzzleManager.getRandomPuzzle(filters);
    }
  }

  /**
   * 创建游戏会话
   * @param {Object} puzzle - 题目对象
   * @returns {Object} 游戏会话对象
   */
  createGameSession(puzzle) {
    return {
      puzzle: puzzle,
      startTime: Date.now(),
      questionCount: 0,
      totalScore: 0,
      progress: 0,
      hintsGiven: 0,
      isActive: true,
      sessionId: this.generateSessionId(),
      lastActivity: Date.now()
    };
  }

  /**
   * 验证题目数据完整性
   * @param {Object} puzzle - 题目对象
   * @returns {Object} 验证结果
   */
  validatePuzzle(puzzle) {
    const errors = [];
    
    const requiredFields = ['id', 'title', 'surface', 'truth'];
    for (const field of requiredFields) {
      if (!puzzle[field]) {
        errors.push(`缺少必需字段: ${field}`);
      }
    }
    
    if (puzzle.keywords && !Array.isArray(puzzle.keywords)) {
      errors.push('keywords 必须是数组');
    }
    
    if (puzzle.hints && !Array.isArray(puzzle.hints)) {
      errors.push('hints 必须是数组');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 处理用户问题
   * @param {string} question - 用户问题
   * @param {string} userId - 用户ID
   * @returns {Object} AI回答结果
   */
  async processQuestion(question, userId) {
    return measureTime(async () => {
      try {
        console.log(`[AI Host] Processing question from ${userId}: "${question}"`);
        
        // 验证输入参数
        const inputValidation = this.validateQuestionInput(question, userId);
        if (!inputValidation.isValid) {
          return createErrorResponse(inputValidation.error, 'INVALID_INPUT');
        }
        
        // 检查游戏状态
        const gameStateCheck = this.validateGameState();
        if (!gameStateCheck.isValid) {
          return createErrorResponse(gameStateCheck.error, gameStateCheck.code);
        }
        
        // 更新最后活动时间
        this.currentSession.lastActivity = Date.now();
        
        // 检查重复问题
        const isDuplicate = this.checkDuplicateQuestion(question);
        
        // 处理AI响应
        const aiResponse = await this.processAIResponse(question, isDuplicate, userId);
        if (!aiResponse.success) {
          return aiResponse;
        }
        
        // 更新游戏状态
        this.updateGameState(question, aiResponse.data.response, userId);
        
        console.log(`[AI Host] Response generated successfully for ${userId}`);
        
        return createSuccessResponse({
          response: aiResponse.data.response,
          formattedMessage: aiResponse.data.formattedMessage,
          gameState: this.getGameState()
        });
        
      } catch (error) {
        console.error('[AI Host] Failed to process question:', error);
        return createErrorResponse(
          '处理问题时发生内部错误',
          'INTERNAL_ERROR',
          { originalError: error.message }
        );
      }
    }, `processQuestion for ${userId}`);
  }

  /**
   * 验证问题输入
   * @param {string} question - 问题内容
   * @param {string} userId - 用户ID
   * @returns {Object} 验证结果
   */
  validateQuestionInput(question, userId) {
    if (!question || typeof question !== 'string') {
      return { isValid: false, error: '问题内容不能为空' };
    }
    
    if (question.trim().length === 0) {
      return { isValid: false, error: '问题内容不能为空' };
    }
    
    if (question.length > 200) {
      return { isValid: false, error: '问题内容太长，请限制在200字符内' };
    }
    
    if (!userId || typeof userId !== 'string') {
      return { isValid: false, error: '用户ID无效' };
    }
    
    return { isValid: true };
  }

  /**
   * 验证游戏状态
   * @returns {Object} 验证结果
   */
  validateGameState() {
    if (!this.currentSession || !this.currentSession.isActive) {
      return { 
        isValid: false, 
        error: '没有进行中的游戏',
        code: 'NO_ACTIVE_GAME'
      };
    }
    
    if (this.currentSession.questionCount >= this.config.game.maxQuestionsPerRound) {
      return {
        isValid: false,
        error: '已达到最大问题数量限制',
        code: 'MAX_QUESTIONS_REACHED'
      };
    }
    
    const gameElapsedTime = Date.now() - this.gameStartTime;
    if (gameElapsedTime > this.config.game.maxGameDuration * 1000) {
      this.endGame();
      return {
        isValid: false,
        error: '游戏时间已到',
        code: 'GAME_TIMEOUT'
      };
    }
    
    return { isValid: true };
  }

  /**
   * 处理AI响应
   * @param {string} question - 问题内容
   * @param {boolean} isDuplicate - 是否重复问题
   * @param {string} userId - 用户ID
   * @returns {Object} AI响应结果
   */
  async processAIResponse(question, isDuplicate, userId) {
    try {
      // 构建消息并调用LLM
      const messages = this.promptManager.buildMessages(this.currentSession.puzzle, question);
      const llmResponse = await this.llmClient.chatCompletion(messages, {
        maxTokens: this.config.llm.maxTokens,
        temperature: this.config.llm.temperature
      });
      
      // 解析和验证响应
      let parsedResponse = this.llmClient.parseResponse(llmResponse);
      parsedResponse = this.llmClient.validateResponse(parsedResponse);
      
      // 应用游戏逻辑调整
      parsedResponse = this.applyGameLogic(parsedResponse, question, isDuplicate);
      
      // 格式化回答
      const formattedResponse = this.promptManager.formatAIResponse(parsedResponse);
      
      return createSuccessResponse({
        response: parsedResponse,
        formattedMessage: formattedResponse
      });
      
    } catch (error) {
      console.error('[AI Host] AI response processing failed:', error);
      
      // 降级处理：返回默认响应
      const fallbackResponse = this.createFallbackResponse(question);
      const formattedResponse = this.promptManager.formatAIResponse(fallbackResponse);
      
      console.log('[AI Host] Using fallback response');
      return createSuccessResponse({
        response: fallbackResponse,
        formattedMessage: formattedResponse
      });
    }
  }

  /**
   * 创建降级响应
   * @param {string} question - 问题内容
   * @returns {Object} 降级响应
   */
  createFallbackResponse(question) {
    return {
      answer: '没有关系',
      score: 3,
      feedback: '系统处理中遇到问题，请重新提问',
      progress: Math.max(0, this.currentSession.progress - 5),
      hint: null
    };
  }

  /**
   * 应用游戏逻辑调整
   * @param {Object} response - LLM原始响应
   * @param {string} question - 用户问题
   * @param {boolean} isDuplicate - 是否重复问题
   * @returns {Object} 调整后的响应
   */
  applyGameLogic(response, question, isDuplicate) {
    const adjusted = { ...response };
    
    // 重复问题惩罚
    if (isDuplicate) {
      adjusted.score = Math.max(1, adjusted.score + this.config.scoring.repetitionPenalty);
      adjusted.feedback += ' (重复问题)';
    }
    
    // 创新问题加分
    if (this.isCreativeQuestion(question)) {
      adjusted.score = Math.min(10, adjusted.score + this.config.scoring.creativityBonus);
    }
    
    // 关键词匹配加成
    if (this.hasKeywordMatch(question)) {
      adjusted.progress = Math.min(100, adjusted.progress + this.config.progress.keywordMatchBonus);
    }
    
    // 直接问题加成
    if (this.isDirectQuestion(question)) {
      adjusted.progress = Math.min(100, adjusted.progress + this.config.progress.directQuestionBonus);
    }
    
    // 错误方向惩罚
    if (adjusted.answer === '没有关系' && adjusted.score > 6) {
      adjusted.progress = Math.max(0, adjusted.progress + this.config.progress.wrongDirectionPenalty);
    }
    
    // 进度平滑处理
    const previousProgress = this.currentSession.progress;
    adjusted.progress = this.smoothProgress(previousProgress, adjusted.progress);
    
    // 自动提示逻辑
    if (this.shouldAutoHint()) {
      if (!adjusted.hint && adjusted.progress > this.promptManager.getProgressThresholds().hint_trigger) {
        adjusted.hint = this.generateAutoHint();
      }
    }
    
    return adjusted;
  }

  /**
   * 检查重复问题
   * @param {string} question - 当前问题
   * @returns {boolean} 是否重复
   */
  checkDuplicateQuestion(question) {
    const normalized = question.toLowerCase().trim();
    return this.questionHistory.some(item => 
      item.question.toLowerCase().trim() === normalized
    );
  }

  /**
   * 判断是否为创新问题
   * @param {string} question - 问题内容
   * @returns {boolean} 是否创新
   */
  isCreativeQuestion(question) {
    const creativeKeywords = ['为什么', '如何', '什么原因', '怎么回事', '背后的原因'];
    const questionLower = question.toLowerCase();
    return creativeKeywords.some(keyword => questionLower.includes(keyword));
  }

  /**
   * 检查关键词匹配
   * @param {string} question - 问题内容
   * @returns {boolean} 是否匹配关键词
   */
  hasKeywordMatch(question) {
    const puzzle = this.currentSession.puzzle;
    if (!puzzle.keywords) return false;
    
    const questionLower = question.toLowerCase();
    return puzzle.keywords.some(keyword => 
      questionLower.includes(keyword.toLowerCase())
    );
  }

  /**
   * 判断是否为直接问题
   * @param {string} question - 问题内容
   * @returns {boolean} 是否直接问题
   */
  isDirectQuestion(question) {
    const directPatterns = [
      /是不是.*?/,
      /是否.*?/,
      /.*吗\？?$/,
      /有没有.*?/,
      /会不会.*?/
    ];
    
    return directPatterns.some(pattern => pattern.test(question));
  }

  /**
   * 平滑进度处理
   * @param {number} previousProgress - 之前的进度
   * @param {number} newProgress - 新的进度
   * @returns {number} 平滑后的进度
   */
  smoothProgress(previousProgress, newProgress) {
    // 限制单次进度变化幅度
    const maxChange = 15;
    const minChange = -10;
    
    let change = newProgress - previousProgress;
    change = Math.max(minChange, Math.min(maxChange, change));
    
    return Math.max(0, Math.min(100, previousProgress + change));
  }

  /**
   * 判断是否应该自动给提示
   * @returns {boolean} 是否应该给提示
   */
  shouldAutoHint() {
    const { questionCount, hintsGiven } = this.currentSession;
    const { autoHintThreshold, hintFrequency } = this.config.game;
    
    // 超过阈值自动给提示
    if (questionCount >= autoHintThreshold) {
      return true;
    }
    
    // 按频率给提示
    if (questionCount > 0 && questionCount % hintFrequency === 0 && hintsGiven < 3) {
      return true;
    }
    
    return false;
  }

  /**
   * 生成自动提示
   * @returns {string} 提示内容
   */
  generateAutoHint() {
    const puzzle = this.currentSession.puzzle;
    if (!puzzle.hints || puzzle.hints.length === 0) {
      return '注意观察细节，从不同角度思考';
    }
    
    // 根据已给提示数量选择不同级别的提示
    const hintIndex = Math.min(this.currentSession.hintsGiven, puzzle.hints.length - 1);
    return puzzle.hints[hintIndex];
  }

  /**
   * 更新游戏状态
   * @param {string} question - 用户问题
   * @param {Object} response - AI响应
   * @param {string} userId - 用户ID
   */
  updateGameState(question, response, userId) {
    // 记录问题历史
    this.questionHistory.push({
      question: question,
      answer: response.answer,
      score: response.score,
      userId: userId,
      timestamp: Date.now()
    });
    
    // 更新会话状态
    this.currentSession.questionCount++;
    this.currentSession.totalScore += response.score;
    this.currentSession.progress = response.progress;
    
    if (response.hint) {
      this.currentSession.hintsGiven++;
    }
    
    console.log(`[AI Host] Game state updated: questions=${this.currentSession.questionCount}, progress=${this.currentSession.progress}%`);
  }

  /**
   * 获取游戏状态
   * @returns {Object} 当前游戏状态
   */
  getGameState() {
    if (!this.currentSession) {
      return null;
    }
    
    const elapsedTime = Date.now() - this.gameStartTime;
    
    return {
      sessionId: this.currentSession.sessionId,
      puzzle: {
        id: this.currentSession.puzzle.id,
        title: this.currentSession.puzzle.title,
        difficulty: this.currentSession.puzzle.difficulty
      },
      questionCount: this.currentSession.questionCount,
      totalScore: this.currentSession.totalScore,
      averageScore: this.currentSession.questionCount > 0 ? 
        (this.currentSession.totalScore / this.currentSession.questionCount).toFixed(1) : 0,
      progress: this.currentSession.progress,
      hintsGiven: this.currentSession.hintsGiven,
      elapsedTime: Math.round(elapsedTime / 1000),
      maxQuestions: this.config.game.maxQuestionsPerRound,
      isActive: this.currentSession.isActive
    };
  }

  /**
   * 结束游戏
   * @param {boolean} solved - 是否已解决
   * @returns {Object} 游戏结束结果
   */
  endGame(solved = false) {
    try {
      if (!this.currentSession) {
        return createErrorResponse('没有进行中的游戏', 'NO_ACTIVE_GAME');
      }
      
      if (!this.currentSession.isActive) {
        return createErrorResponse('游戏已经结束', 'GAME_ALREADY_ENDED');
      }
      
      const endTime = Date.now();
      const duration = endTime - this.gameStartTime;
      const gameState = this.getGameState();
      
      // 更新会话状态
      this.currentSession.isActive = false;
      this.currentSession.endTime = endTime;
      this.currentSession.solved = solved;
      
      // 生成统计信息
      const statistics = this.generateGameStatistics(gameState, duration);
      
      const result = {
        solved: solved,
        gameState: gameState,
        duration: Math.round(duration / 1000),
        puzzle: this.sanitizePuzzleForResult(this.currentSession.puzzle),
        statistics: statistics
      };
      
      if (solved) {
        result.endMessage = this.promptManager.formatGameEnd(this.currentSession.puzzle);
      }
      
      console.log(`[AI Host] Game ended: solved=${solved}, duration=${result.duration}s, questions=${this.currentSession.questionCount}`);
      
      return createSuccessResponse(result, 'Game ended successfully');
      
    } catch (error) {
      console.error('[AI Host] Failed to end game:', error);
      return createErrorResponse(
        '结束游戏时发生错误',
        'INTERNAL_ERROR',
        { originalError: error.message }
      );
    }
  }

  /**
   * 生成游戏统计信息
   * @param {Object} gameState - 游戏状态
   * @param {number} duration - 游戏时长
   * @returns {Object} 统计信息
   */
  generateGameStatistics(gameState, duration) {
    const avgTime = this.currentSession.questionCount > 0 ? 
      Math.round(duration / this.currentSession.questionCount / 1000) : 0;
    
    return {
      totalQuestions: this.currentSession.questionCount,
      totalScore: this.currentSession.totalScore,
      averageScore: gameState.averageScore,
      hintsUsed: this.currentSession.hintsGiven,
      finalProgress: this.currentSession.progress,
      duration: Math.round(duration / 1000),
      averageTimePerQuestion: avgTime,
      efficiency: this.calculateEfficiency()
    };
  }

  /**
   * 计算游戏效率
   * @returns {number} 效率分数 (0-100)
   */
  calculateEfficiency() {
    if (this.currentSession.questionCount === 0) return 0;
    
    const progressPerQuestion = this.currentSession.progress / this.currentSession.questionCount;
    const scoreEfficiency = this.currentSession.totalScore / this.currentSession.questionCount;
    
    // 综合进度效率和分数效率
    return Math.round((progressPerQuestion * 0.6 + scoreEfficiency * 4) * 10) / 10;
  }

  /**
   * 净化题目信息用于结果返回
   * @param {Object} puzzle - 原始题目
   * @returns {Object} 净化后的题目信息
   */
  sanitizePuzzleForResult(puzzle) {
    return {
      id: puzzle.id,
      title: puzzle.title,
      surface: puzzle.surface,
      difficulty: puzzle.difficulty,
      category: puzzle.category,
      // 游戏结束时才暴露真相
      truth: puzzle.truth
    };
  }

  /**
   * 检查是否解决
   * @param {Object} response - AI响应
   * @returns {boolean} 是否已解决
   */
  checkIfSolved(response) {
    return response.progress >= this.promptManager.getProgressThresholds().solution_ready;
  }

  /**
   * 获取游戏统计
   * @returns {Object} 游戏统计信息
   */
  getGameStatistics() {
    return {
      currentSession: this.getGameState(),
      puzzleStats: this.puzzleManager.getStatistics(),
      questionHistory: this.questionHistory.map(q => ({
        question: q.question,
        answer: q.answer,
        score: q.score,
        timestamp: q.timestamp
      }))
    };
  }

  /**
   * 测试AI连接
   * @returns {Promise<Object>} 测试结果
   */
  async testConnection() {
    try {
      const success = await this.llmClient.testConnection();
      return {
        success: success,
        config: this.llmClient.getConfig()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 生成会话ID
   * @returns {string} 会话ID
   */
  generateSessionId() {
    return `ai_host_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 清理资源
   */
  cleanup() {
    if (this.currentSession && this.currentSession.isActive) {
      this.endGame(false);
    }
    
    this.currentSession = null;
    this.questionHistory = [];
    this.gameStartTime = null;
    
    console.log('[AI Host] Cleaned up resources');
  }
}

/**
 * 创建AI主持人实例
 * @param {Object} env - 环境变量
 * @returns {AIHost} AI主持人实例
 */
export function createAIHost(env) {
  return new AIHost(env);
}