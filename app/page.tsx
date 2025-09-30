'use client';

import { useState, useCallback, memo, useMemo } from 'react';
import dynamic from 'next/dynamic';

// 懒加载 toast 组件
const Toaster = dynamic(
  () => import('react-hot-toast').then(mod => ({ default: mod.Toaster })),
  {
    ssr: false,
  },
);

// 动态导入 toast 函数
let toastModule: typeof import('react-hot-toast') | null = null;
const loadToast = async () => {
  if (!toastModule) {
    toastModule = await import('react-hot-toast');
  }
  return toastModule;
};

interface Site {
  domain: string;
  latencyHistory: number[];
  status: 'pending' | 'testing' | 'success' | 'error';
  testCount: number;
  failureCount: number;
  service: '公交车' | '私家车' | 'Codex';
}

// 判断服务类型
const getServiceType = (domain: string): '公交车' | '私家车' | 'Codex' => {
  const lowerDomain = domain.toLowerCase();
  if (lowerDomain.includes('codex')) {
    return 'Codex';
  }
  if (lowerDomain.includes('share')) {
    return '私家车';
  }
  return '公交车';
};

// 优化表格行组件
const TableRow = memo(
  ({
    site,
    onCopyDomain,
    getMinLatency,
    getMaxLatency,
    getAverageLatency,
    getPacketLossRate,
  }: {
    site: Site;
    onCopyDomain: (domain: string) => void;
    getMinLatency: (site: Site) => number | null;
    getMaxLatency: (site: Site) => number | null;
    getAverageLatency: (site: Site) => number | null;
    getPacketLossRate: (site: Site) => string;
  }) => {
    const formatLatency = (latency: number | null) => {
      if (latency === null) {
        return (
          <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
            -
          </span>
        );
      }

      const value = `${latency.toFixed(0)}ms`;
      let colorClass = '';

      if (latency < 200) {
        colorClass = 'bg-green-500 text-white';
      } else if (latency < 400) {
        colorClass = 'bg-yellow-500 text-white';
      } else {
        colorClass = 'bg-red-500 text-white';
      }

      return (
        <span
          className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}
        >
          {value}
        </span>
      );
    };

    return (
      <tr
        onClick={() => onCopyDomain(site.domain)}
        className="hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors cursor-pointer"
      >
        <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {site.domain}
        </td>
        <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 dark:text-gray-300">
          {site.service}
        </td>
        <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 dark:text-gray-300">
          {formatLatency(getMinLatency(site))}
        </td>
        <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 dark:text-gray-300">
          {formatLatency(getMaxLatency(site))}
        </td>
        <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 dark:text-gray-300">
          {formatLatency(getAverageLatency(site))}
        </td>
        <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 dark:text-gray-300">
          {getPacketLossRate(site)}
        </td>
      </tr>
    );
  },
);

TableRow.displayName = 'TableRow';

export default function Home() {
  // 从环境变量获取域名列表
  const getDomains = () => {
    const domainsEnv =
      process.env.NEXT_PUBLIC_DOMAINS ||
      'claude.ai,anthropic.com,google.com,github.com,stackoverflow.com,vercel.com';
    return domainsEnv.split(',').map(domain => domain.trim());
  };

  const [sites, setSites] = useState<Site[]>(() =>
    getDomains().map(domain => ({
      domain,
      latencyHistory: [],
      status: 'pending' as const,
      testCount: 0,
      failureCount: 0,
      service: getServiceType(domain),
    })),
  );

  const [isTesting, setIsTesting] = useState(false);
  const [currentRound, setCurrentRound] = useState(0);
  const [isManualTesting, setIsManualTesting] = useState(false);
  const [filterType, setFilterType] = useState<
    'all' | '公交车' | '私家车' | 'Codex'
  >('all');

  // 并发测试配置
  const CONCURRENT_LIMIT = 6;
  const TOTAL_ROUNDS = 10;

  // 复制域名到剪贴板
  const copyDomain = async (domain: string) => {
    try {
      await navigator.clipboard.writeText(domain);
      const toast = await loadToast();
      toast.default.success(`已复制: ${domain}`, {
        duration: 2000,
        position: 'top-center',
        icon: '📋',
      });
    } catch {
      const toast = await loadToast();
      toast.default.error('复制失败', {
        duration: 2000,
        position: 'top-center',
      });
    }
  };

  // 精准测试单个域名延迟
  const testSingleDomain = async (domain: string): Promise<number | null> => {
    const start = performance.now();
    try {
      await fetch(`https://${domain}/`, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
      return performance.now() - start;
    } catch {
      return null;
    }
  };

  // 真正的并发测试所有域名
  const runSpeedTest = useCallback(async () => {
    setIsTesting(true);

    // 创建测试队列：所有站点的索引
    const queue = [...Array(sites.length).keys()];
    let activeTests = 0;
    let completedTests = 0;

    // 递归测试函数
    const testNext = async (): Promise<void> => {
      if (queue.length === 0 || activeTests >= CONCURRENT_LIMIT) {
        return;
      }

      const index = queue.shift()!;
      activeTests++;

      // 立即标记为测试状态
      setSites(prev =>
        prev.map((site, i) =>
          i === index ? { ...site, status: 'testing' as const } : site,
        ),
      );

      try {
        // 执行测试
        const latency = await testSingleDomain(sites[index].domain);

        // 立即更新该站点的测试结果
        setSites(prev => {
          const updated = prev.map((site, i) => {
            if (i !== index) {
              return site;
            }

            return {
              ...site,
              latencyHistory:
                latency !== null
                  ? [...site.latencyHistory, latency]
                  : site.latencyHistory,
              status:
                latency !== null ? ('success' as const) : ('error' as const),
              testCount: site.testCount + 1,
              failureCount:
                latency === null ? site.failureCount + 1 : site.failureCount,
            };
          });

          // 实时排序 - 按平均延迟排序
          return [...updated].sort((a, b) => {
            const aAvgLatency =
              a.latencyHistory.length > 0
                ? a.latencyHistory.reduce((sum, lat) => sum + lat, 0) /
                  a.latencyHistory.length
                : null;
            const bAvgLatency =
              b.latencyHistory.length > 0
                ? b.latencyHistory.reduce((sum, lat) => sum + lat, 0) /
                  b.latencyHistory.length
                : null;

            if (aAvgLatency === null && bAvgLatency === null) {
              return 0;
            }
            if (aAvgLatency === null) {
              return 1;
            }
            if (bAvgLatency === null) {
              return -1;
            }
            return aAvgLatency - bAvgLatency;
          });
        });
      } finally {
        activeTests--;
        completedTests++;

        // 如果还有待测试的站点，继续下一个
        if (queue.length > 0) {
          testNext();
        }
      }
    };

    // 启动初始并发测试
    for (let i = 0; i < Math.min(CONCURRENT_LIMIT, sites.length); i++) {
      testNext();
    }

    // 等待所有测试完成
    while (completedTests < sites.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setIsTesting(false);
  }, [sites]);

  // 手动测试控制函数
  const startManualTest = useCallback(async () => {
    setIsManualTesting(true);
    setCurrentRound(0);

    // 执行10轮测试
    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
      setCurrentRound(round);
      await runSpeedTest();

      // 等待当前轮完成
      while (isTesting) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 每轮测试完成后暂停1秒（最后一轮除外）
      if (round < TOTAL_ROUNDS) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    setIsManualTesting(false);
    setCurrentRound(0);
  }, [runSpeedTest, isTesting, TOTAL_ROUNDS]);

  // 统计指标计算函数
  const getMinLatency = useCallback((site: Site) => {
    if (site.latencyHistory.length === 0) {
      return null;
    }
    return Math.min(...site.latencyHistory);
  }, []);

  const getMaxLatency = useCallback((site: Site) => {
    if (site.latencyHistory.length === 0) {
      return null;
    }
    return Math.max(...site.latencyHistory);
  }, []);

  const getAverageLatency = useCallback((site: Site) => {
    if (site.latencyHistory.length === 0) {
      return null;
    }
    const sum = site.latencyHistory.reduce((acc, latency) => acc + latency, 0);
    return sum / site.latencyHistory.length;
  }, []);

  const getPacketLossRate = useCallback((site: Site) => {
    if (site.testCount === 0) {
      return '0%';
    }
    const lossRate = (site.failureCount / site.testCount) * 100;
    return `${lossRate.toFixed(1)}%`;
  }, []);

  // 根据筛选条件过滤站点
  const filteredSites = useMemo(() => {
    if (filterType === 'all') {
      return sites;
    }
    return sites.filter(site => site.service === filterType);
  }, [sites, filterType]);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 py-4 sm:py-8 lg:py-12 px-2 sm:px-4 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight text-gray-900 dark:text-white mb-4 leading-tight font-[family-name:var(--font-geist-sans)]">
            PackyCode API 延迟监控面板
          </h1>
          <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 font-normal max-w-2xl mx-auto leading-relaxed font-[family-name:var(--font-geist-sans)] mb-6">
            实时监控各服务节点的网络延迟性能，点击表格行即可复制对应的 API 地址
          </p>

          {/* 测试控制按钮 */}
          <div className="mb-6">
            <button
              onClick={startManualTest}
              disabled={isManualTesting}
              className={`px-6 py-3 rounded-lg font-medium text-base transition-colors ${
                isManualTesting
                  ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed text-gray-500 dark:text-gray-400'
                  : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg hover:shadow-xl'
              }`}
            >
              {isManualTesting
                ? `测试中 (${currentRound}/${TOTAL_ROUNDS})`
                : '开始测试'}
            </button>
          </div>

          {/* 服务类型筛选 */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            {(['all', '公交车', '私家车', 'Codex'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                  filterType === type
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {type === 'all' ? '全部' : type}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed min-w-[600px]">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="w-2/6 px-2 sm:px-4 lg:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600">
                    域名
                  </th>
                  <th className="w-1/6 px-2 sm:px-4 lg:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600">
                    服务
                  </th>
                  <th className="w-1/6 px-2 sm:px-4 lg:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600">
                    最低延迟
                  </th>
                  <th className="w-1/6 px-2 sm:px-4 lg:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600">
                    最高延迟
                  </th>
                  <th className="w-1/6 px-2 sm:px-4 lg:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600">
                    平均延迟
                  </th>
                  <th className="w-1/6 px-2 sm:px-4 lg:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600">
                    丢包率
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredSites.map(site => (
                  <TableRow
                    key={site.domain}
                    site={site}
                    onCopyDomain={copyDomain}
                    getMinLatency={getMinLatency}
                    getMaxLatency={getMaxLatency}
                    getAverageLatency={getAverageLatency}
                    getPacketLossRate={getPacketLossRate}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Toast 容器 */}
        <Toaster />
      </div>
    </div>
  );
}
