/**
 * LLM API 客户端 - 支持 OpenAI 范式的各种 LLM 服务
 */

export class LLMClient {
  constructor(config = {}) {
    this.apiUrl = config.apiUrl || '';
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'gpt-4';
    this.maxTokens = config.maxTokens || 1000;
    this.temperature = config.temperature || 0.7;
    this.timeout = config.timeout || 30000; // 30秒超时
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000; // 1秒重试延迟
  }

  /**
   * 发送聊天完成请求
   * @param {Array} messages - 消息数组
   * @param {Object} options - 可选参数
   * @returns {Promise} API响应
   */
  async chatCompletion(messages, options = {}) {
    // 如果没有API URL或API Key，使用模拟模式
    if (!this.apiUrl || !this.apiKey) {
      console.log('[LLM Client] Using mock mode - no API credentials provided');
      return this.generateMockResponse(messages);
    }
    
    const requestBody = {
      model: options.model || this.model,
      messages: messages,
      max_tokens: options.maxTokens || this.maxTokens,
      temperature: options.temperature || this.temperature,
      stream: options.stream || false,
      ...options.extraParams
    };

    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...options.headers
      },
      body: JSON.stringify(requestBody)
    };

    // 打印完整的请求信息
    console.log('🚀 [LLM Request] ===== 完整请求信息 =====');
    console.log(`📍 URL: ${this.apiUrl}/chat/completions`);
    console.log(`🔑 Headers:`, {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey.substring(0, 10)}...`,
      ...options.headers
    });
    console.log(`📝 Request Body:`, JSON.stringify(requestBody, null, 2));
    console.log('=====================================');

    return this.makeRequestWithRetry(`${this.apiUrl}/chat/completions`, requestOptions);
  }

  /**
   * 带重试机制的请求
   * @param {string} url - 请求URL
   * @param {Object} options - 请求选项
   * @returns {Promise} 响应结果
   */
  async makeRequestWithRetry(url, options) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`[LLM Client] Attempt ${attempt}/${this.maxRetries} to ${url}`);
        
        const response = await this.makeRequestWithTimeout(url, options);
        
        if (!response.ok) {
          const errorText = await response.text();
          
          // 打印错误响应信息
          console.log('❌ [LLM Error Response] ===== 错误响应信息 =====');
          console.log(`📊 Status: ${response.status} ${response.statusText}`);
          console.log(`🎯 Response Headers:`, Object.fromEntries(response.headers.entries()));
          console.log(`⚠️ Error Body:`, errorText);
          console.log('===========================================');
          
          const error = new Error(`HTTP ${response.status}: ${errorText}`);
          error.status = response.status;
          error.response = response;
          throw error;
        }

        const data = await response.json();
        
        // 打印完整的响应信息
        console.log('✅ [LLM Response] ===== 完整响应信息 =====');
        console.log(`📊 Status: ${response.status} ${response.statusText}`);
        console.log(`🎯 Response Headers:`, Object.fromEntries(response.headers.entries()));
        console.log(`📋 Response Body:`, JSON.stringify(data, null, 2));
        console.log('======================================');
        
        console.log(`[LLM Client] Request successful on attempt ${attempt}`);
        return data;
        
      } catch (error) {
        lastError = error;
        console.error(`[LLM Client] Attempt ${attempt} failed:`, error.message);
        
        // 如果是客户端错误（4xx），不重试
        if (error.status && error.status >= 400 && error.status < 500) {
          throw error;
        }
        
        // 最后一次尝试，直接抛出错误
        if (attempt === this.maxRetries) {
          break;
        }
        
        // 指数退避延迟
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        console.log(`[LLM Client] Waiting ${delay}ms before retry...`);
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * 带超时的请求
   * @param {string} url - 请求URL
   * @param {Object} options - 请求选项
   * @returns {Promise} fetch响应
   */
  async makeRequestWithTimeout(url, options) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      return response;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 解析LLM响应，提取JSON内容
   * @param {Object} response - LLM API响应
   * @returns {Object} 解析后的数据
   */
  parseResponse(response) {
    try {
      if (!response.choices || response.choices.length === 0) {
        throw new Error('No choices in response');
      }

      const content = response.choices[0].message.content;
      console.log(`[LLM Client] Raw response:`, content);

      // 尝试提取JSON内容
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                       content.match(/```\s*([\s\S]*?)\s*```/) ||
                       content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const parsed = JSON.parse(jsonStr);
        console.log(`[LLM Client] Parsed JSON:`, parsed);
        return parsed;
      }

      // 如果没有找到JSON格式，尝试直接解析整个内容
      try {
        const parsed = JSON.parse(content);
        console.log(`[LLM Client] Direct parsed JSON:`, parsed);
        return parsed;
      } catch {
        // 如果都解析失败，返回原始内容
        console.warn(`[LLM Client] Failed to parse JSON, returning raw content`);
        return {
          answer: "没有关系",
          score: 1,
          feedback: "回答格式有误，请重新提问",
          progress: 0
        };
      }
    } catch (error) {
      console.error(`[LLM Client] Error parsing response:`, error);
      return {
        answer: "没有关系", 
        score: 1,
        feedback: "系统处理错误，请重新提问",
        progress: 0
      };
    }
  }

  /**
   * 验证响应格式
   * @param {Object} parsed - 解析后的响应
   * @returns {Object} 验证并修正后的响应
   */
  validateResponse(parsed) {
    const validated = {
      answer: "没有关系",
      score: 1,
      feedback: "无效回答",
      progress: 0,
      hint: undefined
    };

    // 验证answer字段
    const validAnswers = ["是", "不是", "没有关系"];
    if (parsed.answer && validAnswers.includes(parsed.answer)) {
      validated.answer = parsed.answer;
    }

    // 验证score字段
    if (typeof parsed.score === 'number' && parsed.score >= 1 && parsed.score <= 10) {
      validated.score = Math.round(parsed.score);
    }

    // 验证feedback字段
    if (typeof parsed.feedback === 'string' && parsed.feedback.length > 0) {
      validated.feedback = parsed.feedback.slice(0, 100); // 限制长度
    }

    // 验证progress字段
    if (typeof parsed.progress === 'number' && parsed.progress >= 0 && parsed.progress <= 100) {
      validated.progress = Math.round(parsed.progress);
    }

    // 验证hint字段
    if (parsed.hint && typeof parsed.hint === 'string' && parsed.hint.length > 0) {
      validated.hint = parsed.hint.slice(0, 50); // 限制长度
    }

    console.log(`[LLM Client] Validated response:`, validated);
    return validated;
  }

  /**
   * 测试API连接
   * @returns {Promise<boolean>} 连接是否成功
   */
  async testConnection() {
    try {
      const response = await this.chatCompletion([
        { role: "user", content: "测试连接，请回复'连接成功'" }
      ], { maxTokens: 50 });
      
      return response && response.choices && response.choices.length > 0;
    } catch (error) {
      console.error('[LLM Client] Connection test failed:', error);
      return false;
    }
  }

  /**
   * Sleep函数
   * @param {number} ms - 毫秒数
   * @returns {Promise} Promise对象
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取客户端配置信息
   * @returns {Object} 配置信息
   */
  getConfig() {
    return {
      apiUrl: this.apiUrl,
      model: this.model,
      maxTokens: this.maxTokens,
      temperature: this.temperature,
      timeout: this.timeout,
      maxRetries: this.maxRetries,
      hasApiKey: !!this.apiKey
    };
  }

  /**
   * 生成模拟响应（用于演示和开发）
   * @param {Array} messages - 消息数组
   * @returns {Promise} 模拟的API响应
   */
  async generateMockResponse(messages) {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    
    // 提取用户的问题
    const userMessage = messages.find(msg => msg.role === 'user');
    if (!userMessage) {
      throw new Error('No user message found');
    }
    
    const question = this.extractQuestionFromPrompt(userMessage.content);
    
    // 生成智能的模拟响应
    const mockResponse = this.generateIntelligentResponse(question);
    
    console.log(`[LLM Mock] Generated response for question: "${question}"`);
    console.log(`[LLM Mock] Response:`, mockResponse);
    
    return {
      choices: [{
        message: {
          role: 'assistant',
          content: JSON.stringify(mockResponse)
        }
      }],
      usage: {
        prompt_tokens: userMessage.content.length / 4,
        completion_tokens: JSON.stringify(mockResponse).length / 4,
        total_tokens: (userMessage.content.length + JSON.stringify(mockResponse).length) / 4
      }
    };
  }

  /**
   * 从提示词中提取问题
   * @param {string} prompt - 完整的提示词
   * @returns {string} 提取出的问题
   */
  extractQuestionFromPrompt(prompt) {
    // 查找 "玩家问题：" 后面的内容
    const questionMatch = prompt.match(/\*\*玩家问题：\*\*(.+?)(?:\n|$)/);
    if (questionMatch) {
      return questionMatch[1].trim();
    }
    
    // 如果没找到，返回最后一行作为问题
    const lines = prompt.split('\n').filter(line => line.trim());
    return lines[lines.length - 1] || '未知问题';
  }

  /**
   * 生成智能的模拟响应
   * @param {string} question - 用户问题
   * @returns {Object} 格式化的响应对象
   */
  generateIntelligentResponse(question) {
    const answers = ['是', '不是', '没有关系'];
    const answer = answers[Math.floor(Math.random() * answers.length)];
    
    // 基于问题内容的智能评分
    let score = 5; // 基础分数
    let feedback = '一般的问题';
    let progress = Math.floor(Math.random() * 30) + 10; // 10-40之间的进度
    
    const questionLower = question.toLowerCase();
    
    // 检查问题质量并调整分数
    if (questionLower.includes('为什么') || questionLower.includes('怎么') || questionLower.includes('如何')) {
      score = Math.floor(Math.random() * 2) + 8; // 8-9分
      feedback = '很好的问题，直击核心！';
      progress += 15;
    } else if (questionLower.includes('是否') || questionLower.includes('是不是') || question.endsWith('吗？') || question.endsWith('吗')) {
      score = Math.floor(Math.random() * 2) + 6; // 6-7分
      feedback = '不错的尝试，方向正确';
      progress += 10;
    } else if (question.length < 5) {
      score = Math.floor(Math.random() * 2) + 2; // 2-3分
      feedback = '问题太简单，需要更详细';
      progress += 5;
    } else if (questionLower.includes('死') || questionLower.includes('杀') || questionLower.includes('凶手')) {
      score = Math.floor(Math.random() * 2) + 7; // 7-8分  
      feedback = '接近真相了！';
      progress += 12;
    }
    
    // 确保进度在合理范围内
    progress = Math.min(85, Math.max(5, progress));
    
    // 偶尔给一些提示
    let hint = null;
    if (progress > 60 && Math.random() < 0.3) {
      const hints = [
        '注意关键人物的职业',
        '思考物品的特殊用途',
        '考虑时间和地点的关系',
        '关注细节中的矛盾',
        '从心理角度分析动机'
      ];
      hint = hints[Math.floor(Math.random() * hints.length)];
    }
    
    const response = {
      answer: answer,
      score: score,
      feedback: feedback,
      progress: progress
    };
    
    if (hint) {
      response.hint = hint;
    }
    
    return response;
  }
}

/**
 * 创建LLM客户端实例
 * @param {Object} env - 环境变量对象
 * @returns {LLMClient} LLM客户端实例
 */
export function createLLMClient(env) {
  const config = {
    apiUrl: env.LLM_API_URL || '',
    apiKey: env.LLM_API_KEY || '',
    model: env.LLM_MODEL || 'gpt-4',
    maxTokens: parseInt(env.LLM_MAX_TOKENS) || 1000,
    temperature: parseFloat(env.LLM_TEMPERATURE) || 0.7,
    timeout: parseInt(env.LLM_TIMEOUT) || 30000,
    maxRetries: parseInt(env.LLM_MAX_RETRIES) || 3
  };

  console.log(`[LLM Client] Creating client with config:`, {
    ...config,
    apiKey: config.apiKey ? '***hidden***' : 'not set'
  });

  return new LLMClient(config);
}