/**
 * 命令队列系统
 *
 * ==================== 教学说明 ====================
 *
 * 为什么需要命令队列？
 * ---------------
 * 1. 防止并发冲突：同一会话的多个请求可能会同时修改会话状态
 * 2. 保证顺序执行：确保消息按顺序处理，避免状态混乱
 * 3. 资源控制：限制并发数量，避免系统过载
 *
 * 工作原理：
 * ---------
 * - 每个会话有独立的队列（session lane）
 * - 可选的全局队列（global lane）用于系统级串行化
 * - 使用 Promise 链确保任务按顺序执行
 */

/**
 * 队列项类型
 * @typedef {Object} QueueEntry
 * @property {Function} task - 要执行的任务函数
 * @property {Function} resolve - Promise resolve 函数
 * @property {Function} reject - Promise reject 函数
 * @property {number} enqueuedAt - 入队时间戳
 * @property {number} warnAfterMs - 警告等待时间（毫秒）
 */

/**
 * 队列状态类型
 * @typedef {Object} LaneState
 * @property {string} lane - 队列名称
 * @property {QueueEntry[]} queue - 待执行任务队列
 * @property {number} active - 正在执行的任务数
 * @property {number} maxConcurrent - 最大并发数
 * @property {boolean} draining - 是否正在排空队列
 */

export class CommandQueue {
  /** @type {Map<string, LaneState>} */
  lanes = new Map();

  /**
   * 获取或创建队列状态
   * @param {string} lane - 队列名称
   * @returns {LaneState}
   */
  getLaneState(lane) {
    const existing = this.lanes.get(lane);
    if (existing) {
      return existing;
    }

    const created = {
      lane,
      queue: [],
      active: 0,
      maxConcurrent: 1,
      draining: false,
    };
    this.lanes.set(lane, created);
    return created;
  }

  /**
   * 排空队列（执行所有待执行任务）
   * @param {string} lane - 队列名称
   */
  drainLane(lane) {
    const state = this.getLaneState(lane);
    if (state.draining) {
      return; // 已经在排空中
    }

    state.draining = true;

    const pump = () => {
      // 当有空闲槽位且有任务时，继续执行
      while (state.active < state.maxConcurrent && state.queue.length > 0) {
        const entry = state.queue.shift();
        const waitedMs = Date.now() - entry.enqueuedAt;

        // 如果等待时间过长，发出警告
        if (waitedMs >= entry.warnAfterMs) {
          entry.onWait?.(waitedMs, state.queue.length);
          console.warn(
            `[Queue] Lane "${lane}" wait exceeded: ${waitedMs}ms, ${state.queue.length} queued ahead`
          );
        }

        console.log(
          `[Queue] Dequeued from "${lane}": waited ${waitedMs}ms, ${state.queue.length} remaining`
        );

        state.active += 1;

        // 异步执行任务
        (async () => {
          const startTime = Date.now();
          try {
            const result = await entry.task();
            state.active -= 1;
            console.log(
              `[Queue] Task done on "${lane}": duration ${Date.now() - startTime}ms, ${state.active} active, ${state.queue.length} queued`
            );
            pump(); // 继续处理下一个任务
            entry.resolve(result);
          } catch (err) {
            state.active -= 1;
            console.error(
              `[Queue] Task error on "${lane}": duration ${Date.now() - startTime}ms, error: ${err}`
            );
            pump(); // 继续处理下一个任务
            entry.reject(err);
          }
        })();
      }

      state.draining = false;
    };

    pump();
  }

  /**
   * 设置队列的最大并发数
   * @param {string} lane - 队列名称
   * @param {number} maxConcurrent - 最大并发数
   */
  setConcurrency(lane, maxConcurrent) {
    const cleaned = lane.trim() || 'main';
    const state = this.getLaneState(cleaned);
    state.maxConcurrent = Math.max(1, Math.floor(maxConcurrent));
    this.drainLane(cleaned);
  }

  /**
   * 将任务加入队列并等待执行
   * @template T
   * @param {string} lane - 队列名称
   * @param {() => Promise<T>} task - 要执行的任务
   * @param {Object} opts - 选项
   * @param {number} [opts.warnAfterMs=2000] - 等待警告时间（毫秒）
   * @param {Function} [opts.onWait] - 等待回调函数
   * @returns {Promise<T>}
   */
  enqueue(lane, task, opts = {}) {
    const cleaned = lane.trim() || 'main';
    const warnAfterMs = opts.warnAfterMs ?? 2000;
    const state = this.getLaneState(cleaned);

    return new Promise((resolve, reject) => {
      state.queue.push({
        task: () => task(),
        resolve: (value) => resolve(value),
        reject,
        enqueuedAt: Date.now(),
        warnAfterMs,
        onWait: opts.onWait,
      });

      console.log(
        `[Queue] Enqueued to "${cleaned}": ${state.queue.length + state.active} total`
      );

      this.drainLane(cleaned);
    });
  }

  /**
   * 获取队列大小
   * @param {string} [lane='main'] - 队列名称
   * @returns {number}
   */
  getSize(lane = 'main') {
    const resolved = lane.trim() || 'main';
    const state = this.lanes.get(resolved);
    if (!state) {
      return 0;
    }
    return state.queue.length + state.active;
  }

  /**
   * 获取所有队列的总大小
   * @returns {number}
   */
  getTotalSize() {
    let total = 0;
    for (const state of this.lanes.values()) {
      total += state.queue.length + state.active;
    }
    return total;
  }

  /**
   * 清空队列
   * @param {string} [lane='main'] - 队列名称
   * @returns {number} 清空的任务数
   */
  clear(lane = 'main') {
    const cleaned = lane.trim() || 'main';
    const state = this.lanes.get(cleaned);
    if (!state) {
      return 0;
    }
    const removed = state.queue.length;
    state.queue.length = 0;
    return removed;
  }
}

/**
 * 导出单例实例
 */
export const globalQueue = new CommandQueue();
