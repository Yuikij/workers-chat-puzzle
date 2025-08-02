/**
 * 海龟汤题库管理器
 */

// 内联题库数据以避免导入问题
const puzzlesData = {
  "version": "1.0",
  "lastUpdated": "2024-01-01",
  "puzzles": [
    {
      "id": "classic_003",
      "title": "镜子碎了",
      "difficulty": "简单",
      "category": "经典", 
      "tags": ["职业", "意外", "生活"],
      "surface": "一个女人在家里看到镜子碎了，然后就自杀了。为什么？",
      "truth": "她是一个杂技演员，靠走钢丝为生。她在家练习时用镜子来观察自己的动作。镜子碎了意味着她看不到自己的动作，在演出中可能会失足死亡。她选择自杀而不是面对这种危险。",
      "keywords": ["杂技", "钢丝", "练习", "镜子", "职业", "危险"],
      "hints": [
        "镜子对她的职业非常重要",
        "她的工作需要精确的身体控制",
        "没有镜子她无法安全工作",
        "她的职业有生命危险"
      ]
    },
    {
      "id": "classic_004",
      "title": "电话亭",
      "difficulty": "中等",
      "category": "经典",
      "tags": ["身份", "秘密", "恐惧"],
      "surface": "一个男人在深夜使用电话亭打电话，突然看到一个人向他走来，他立刻挂掉电话逃跑了。为什么？",
      "truth": "这个男人是个逃犯，他在使用电话亭时看到了警察向他走来。他意识到自己可能被发现了，所以立刻逃跑。",
      "keywords": ["逃犯", "警察", "身份", "追捕", "恐惧", "逃跑"],
      "hints": [
        "男人有不可告人的秘密",
        "走来的人代表某种威胁",
        "他的身份不能被发现",
        "这是一种本能的恐惧反应"
      ]
    },
    {
      "id": "classic_005",
      "title": "雨夜归家",
      "difficulty": "困难",
      "category": "经典",
      "tags": ["家庭", "背叛", "发现"],
      "surface": "一个男人雨夜回家，用钥匙开门进入，发现客厅的灯是亮着的，但是他立刻转身离开了。为什么？",
      "truth": "男人出差回来，按约定如果妻子一个人在家，客厅应该关灯。灯亮着说明家里有其他人。他意识到妻子可能在外遇，选择离开避免尴尬的confrontation。",
      "keywords": ["出差", "约定", "外遇", "信号", "背叛", "发现"],
      "hints": [
        "他和家人之间有某种约定",
        "灯的状态传达了一个信息",
        "这个信息让他意识到了什么",
        "他选择避免面对某种情况"
      ]
    },
    {
      "id": "modern_001",
      "title": "电梯惊魂",
      "difficulty": "中等",
      "category": "现代",
      "tags": ["心理", "恐惧", "错觉"],
      "surface": "一个女人坐电梯到20楼，但在18楼突然按了紧急停止按钮冲出电梯。为什么？",
      "truth": "她发现电梯里只有她一个人，但是按钮面板上20楼的按钮是亮着的，说明有人按过。她意识到可能有人躲在电梯里，或者有其他异常情况，出于恐惧选择逃离。",
      "keywords": ["电梯", "按钮", "一个人", "异常", "恐惧", "逃离"],
      "hints": [
        "电梯里的某个细节很不正常",
        "她发现了矛盾的现象",
        "这让她感到恐惧",
        "她选择立即离开"
      ]
    },
    {
      "id": "modern_002",
      "title": "网购惊魂",
      "difficulty": "困难",
      "category": "现代",
      "tags": ["网络", "隐私", "跟踪"],
      "surface": "一个男人收到一个包裹，打开后立刻报警。包裹里装的是一本普通的书。为什么？",
      "truth": "这本书是他昨天在网上浏览但没有购买的，而且包裹上的地址精确到了他的具体房间号，这说明有人在跟踪他的网络行为和实际位置，这是一种威胁和警告。",
      "keywords": ["网购", "浏览记录", "跟踪", "隐私", "威胁", "警告"],
      "hints": [
        "他从来没有买过这本书",
        "但这本书跟他有某种联系",
        "包裹的信息透露了什么",
        "这代表一种威胁"
      ]
    },
    {
      "id": "suspense_001", 
      "title": "午夜来电",
      "difficulty": "中等",
      "category": "悬疑",
      "tags": ["时间", "家庭", "异常"],
      "surface": "一个女人深夜接到丈夫的电话，丈夫说他在加班，但她立刻知道丈夫在撒谎。为什么？",
      "truth": "电话里传来了钟声，是整点报时的钟声。但她知道丈夫的办公室里没有这样的钟，而且那个钟声她很熟悉——那是她娘家的钟声。说明丈夫在她娘家，可能和她的姐妹有不正当关系。",
      "keywords": ["钟声", "办公室", "娘家", "背景音", "撒谎", "外遇"],
      "hints": [
        "电话里有特殊的背景音",
        "这个声音她很熟悉",
        "她知道丈夫办公室的情况",
        "背景音暴露了真实位置"
      ]
    }
  ]
};

export class PuzzleManager {
  constructor() {
    this.puzzles = puzzlesData.puzzles || [];
    this.currentPuzzle = null;
    
    console.log(`[Puzzle Manager] Loaded ${this.puzzles.length} puzzles`);
  }

  /**
   * 获取所有题目列表
   * @returns {Array} 题目列表
   */
  getAllPuzzles() {
    return this.puzzles.map(puzzle => ({
      id: puzzle.id,
      title: puzzle.title,
      difficulty: puzzle.difficulty,
      category: puzzle.category,
      tags: puzzle.tags
    }));
  }

  /**
   * 根据ID获取题目
   * @param {string} puzzleId - 题目ID
   * @returns {Object|null} 题目对象
   */
  getPuzzleById(puzzleId) {
    const puzzle = this.puzzles.find(p => p.id === puzzleId);
    if (!puzzle) {
      console.warn(`[Puzzle Manager] Puzzle not found: ${puzzleId}`);
      return null;
    }
    
    console.log(`[Puzzle Manager] Found puzzle: ${puzzle.title}`);
    return { ...puzzle }; // 返回副本
  }

  /**
   * 随机选择一个题目
   * @param {Object} filters - 过滤条件
   * @returns {Object|null} 随机题目
   */
  getRandomPuzzle(filters = {}) {
    let filteredPuzzles = [...this.puzzles];

    // 按难度过滤
    if (filters.difficulty) {
      filteredPuzzles = filteredPuzzles.filter(p => 
        p.difficulty === filters.difficulty
      );
    }

    // 按分类过滤
    if (filters.category) {
      filteredPuzzles = filteredPuzzles.filter(p => 
        p.category === filters.category
      );
    }

    // 按标签过滤
    if (filters.tags && filters.tags.length > 0) {
      filteredPuzzles = filteredPuzzles.filter(p => 
        filters.tags.some(tag => p.tags.includes(tag))
      );
    }

    // 排除已使用的题目
    if (filters.excludeIds && filters.excludeIds.length > 0) {
      filteredPuzzles = filteredPuzzles.filter(p => 
        !filters.excludeIds.includes(p.id)
      );
    }

    if (filteredPuzzles.length === 0) {
      console.warn(`[Puzzle Manager] No puzzles match the filters:`, filters);
      return null;
    }

    const randomIndex = Math.floor(Math.random() * filteredPuzzles.length);
    const selectedPuzzle = filteredPuzzles[randomIndex];
    
    console.log(`[Puzzle Manager] Selected random puzzle: ${selectedPuzzle.title}`);
    return { ...selectedPuzzle };
  }

  /**
   * 设置当前题目
   * @param {string} puzzleId - 题目ID
   * @returns {boolean} 是否设置成功
   */
  setCurrentPuzzle(puzzleId) {
    const puzzle = this.getPuzzleById(puzzleId);
    if (!puzzle) {
      return false;
    }
    
    this.currentPuzzle = puzzle;
    console.log(`[Puzzle Manager] Set current puzzle: ${puzzle.title}`);
    return true;
  }

  /**
   * 获取当前题目
   * @returns {Object|null} 当前题目
   */
  getCurrentPuzzle() {
    return this.currentPuzzle ? { ...this.currentPuzzle } : null;
  }

  /**
   * 清除当前题目
   */
  clearCurrentPuzzle() {
    console.log(`[Puzzle Manager] Cleared current puzzle`);
    this.currentPuzzle = null;
  }

  /**
   * 根据难度获取题目
   * @param {string} difficulty - 难度等级
   * @returns {Array} 对应难度的题目列表
   */
  getPuzzlesByDifficulty(difficulty) {
    const validDifficulties = ['简单', '中等', '困难'];
    if (!validDifficulties.includes(difficulty)) {
      console.warn(`[Puzzle Manager] Invalid difficulty: ${difficulty}`);
      return [];
    }

    return this.puzzles
      .filter(p => p.difficulty === difficulty)
      .map(p => ({ ...p }));
  }

  /**
   * 根据分类获取题目
   * @param {string} category - 分类
   * @returns {Array} 对应分类的题目列表
   */
  getPuzzlesByCategory(category) {
    return this.puzzles
      .filter(p => p.category === category)
      .map(p => ({ ...p }));
  }

  /**
   * 搜索题目
   * @param {string} keyword - 搜索关键词
   * @returns {Array} 匹配的题目列表
   */
  searchPuzzles(keyword) {
    if (!keyword || keyword.trim().length === 0) {
      return [];
    }

    const searchTerm = keyword.toLowerCase().trim();
    
    return this.puzzles.filter(puzzle => {
      return (
        puzzle.title.toLowerCase().includes(searchTerm) ||
        puzzle.surface.toLowerCase().includes(searchTerm) ||
        puzzle.truth.toLowerCase().includes(searchTerm) ||
        puzzle.keywords.some(k => k.toLowerCase().includes(searchTerm)) ||
        puzzle.tags.some(t => t.toLowerCase().includes(searchTerm))
      );
    }).map(p => ({ ...p }));
  }

  /**
   * 获取统计信息
   * @returns {Object} 题库统计信息
   */
  getStatistics() {
    const stats = {
      total: this.puzzles.length,
      byDifficulty: {},
      byCategory: {},
      byTags: {}
    };

    // 按难度统计
    this.puzzles.forEach(puzzle => {
      stats.byDifficulty[puzzle.difficulty] = (stats.byDifficulty[puzzle.difficulty] || 0) + 1;
    });

    // 按分类统计
    this.puzzles.forEach(puzzle => {
      stats.byCategory[puzzle.category] = (stats.byCategory[puzzle.category] || 0) + 1;
    });

    // 按标签统计
    this.puzzles.forEach(puzzle => {
      puzzle.tags.forEach(tag => {
        stats.byTags[tag] = (stats.byTags[tag] || 0) + 1;
      });
    });

    return stats;
  }

  /**
   * 验证题目格式
   * @param {Object} puzzle - 题目对象
   * @returns {Object} 验证结果
   */
  validatePuzzle(puzzle) {
    const errors = [];
    
    // 必需字段检查
    const requiredFields = ['id', 'title', 'surface', 'truth', 'difficulty', 'category'];
    requiredFields.forEach(field => {
      if (!puzzle[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    });

    // 字段类型检查
    if (puzzle.keywords && !Array.isArray(puzzle.keywords)) {
      errors.push('keywords must be an array');
    }
    
    if (puzzle.tags && !Array.isArray(puzzle.tags)) {
      errors.push('tags must be an array');
    }
    
    if (puzzle.hints && !Array.isArray(puzzle.hints)) {
      errors.push('hints must be an array');
    }

    // 难度值检查
    const validDifficulties = ['简单', '中等', '困难'];
    if (puzzle.difficulty && !validDifficulties.includes(puzzle.difficulty)) {
      errors.push(`Invalid difficulty: ${puzzle.difficulty}`);
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * 添加新题目（用于扩展题库）
   * @param {Object} puzzle - 新题目
   * @returns {boolean} 是否添加成功
   */
  addPuzzle(puzzle) {
    const validation = this.validatePuzzle(puzzle);
    if (!validation.isValid) {
      console.error(`[Puzzle Manager] Invalid puzzle:`, validation.errors);
      return false;
    }

    // 检查ID是否已存在
    if (this.puzzles.find(p => p.id === puzzle.id)) {
      console.error(`[Puzzle Manager] Puzzle ID already exists: ${puzzle.id}`);
      return false;
    }

    this.puzzles.push({ ...puzzle });
    console.log(`[Puzzle Manager] Added new puzzle: ${puzzle.title}`);
    return true;
  }

  /**
   * 获取可用的分类列表
   * @returns {Array} 分类列表
   */
  getCategories() {
    const categories = [...new Set(this.puzzles.map(p => p.category))];
    return categories.sort();
  }

  /**
   * 获取可用的标签列表
   * @returns {Array} 标签列表
   */
  getTags() {
    const allTags = this.puzzles.flatMap(p => p.tags || []);
    const uniqueTags = [...new Set(allTags)];
    return uniqueTags.sort();
  }

  /**
   * 获取可用的难度列表
   * @returns {Array} 难度列表
   */
  getDifficulties() {
    return ['简单', '中等', '困难'];
  }
}

/**
 * 创建题库管理器实例
 * @returns {PuzzleManager} 题库管理器实例
 */
export function createPuzzleManager() {
  return new PuzzleManager();
}