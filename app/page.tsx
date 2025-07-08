'use client';

import { useState, useEffect, useCallback, memo } from 'react';
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
  latency: number | null;
  status: 'pending' | 'testing' | 'success' | 'error';
  testCount: number;
  failureCount: number;
}

// 优化表格行组件
const TableRow = memo(
  ({
    site,
    onCopyDomain,
    getStatusColor,
    getStatusText,
    getPacketLossRate,
  }: {
    site: Site;
    onCopyDomain: (domain: string) => void;
    getStatusColor: (latency: number | null) => string;
    getStatusText: (status: string, latency: number | null) => string;
    getPacketLossRate: (site: Site) => string;
  }) => (
    <tr
      onClick={() => onCopyDomain(site.domain)}
      className="hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors cursor-pointer"
    >
      <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
        {site.domain}
      </td>
      <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 dark:text-gray-300">
        <span
          className={`inline-flex items-center px-2 py-0.5 sm:px-2.5 rounded-full text-xs font-medium ${getStatusColor(site.latency)}`}
        >
          {getStatusText(site.status, site.latency)}
        </span>
      </td>
      <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 dark:text-gray-300">
        {getPacketLossRate(site)}
      </td>
    </tr>
  ),
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
      latency: null,
      status: 'pending' as const,
      testCount: 0,
      failureCount: 0,
    })),
  );

  const [isTesting, setIsTesting] = useState(false);

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

  // 串行测试所有域名
  const runSpeedTest = useCallback(async () => {
    setIsTesting(true);

    for (let i = 0; i < sites.length; i++) {
      // 更新当前测试状态
      setSites(prev =>
        prev.map((site, index) =>
          index === i
            ? {
                ...site,
                status: 'testing' as const,
              }
            : site,
        ),
      );

      // 执行测试
      const latency = await testSingleDomain(sites[i].domain);

      // 更新测试结果 - 只保留最好成绩，同时更新测试计数和失败次数
      setSites(prev => {
        const updated = prev.map((site, index) =>
          index === i
            ? {
                ...site,
                latency:
                  latency !== null &&
                  (site.latency === null || latency < site.latency)
                    ? latency
                    : site.latency,
                status:
                  latency !== null ? ('success' as const) : ('error' as const),
                testCount: site.testCount + 1,
                failureCount:
                  latency === null ? site.failureCount + 1 : site.failureCount,
              }
            : site,
        );

        // 实时排序
        return [...updated].sort((a, b) => {
          if (a.latency === null && b.latency === null) {
            return 0;
          }
          if (a.latency === null) {
            return 1;
          }
          if (b.latency === null) {
            return -1;
          }
          return a.latency - b.latency;
        });
      });

      // 测试间隔
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsTesting(false);
  }, [sites]);

  // 自动循环测试
  useEffect(() => {
    // 页面加载后立即开始第一次测试
    if (!isTesting) {
      runSpeedTest();
    }

    const interval = setInterval(() => {
      if (!isTesting) {
        runSpeedTest();
      }
    }, 100); // 频繁检查，一轮完成立刻开始下一轮

    return () => clearInterval(interval);
  }, [isTesting, runSpeedTest]);

  const getPacketLossRate = useCallback((site: Site) => {
    if (site.testCount === 0) {
      return '0%';
    }
    const lossRate = (site.failureCount / site.testCount) * 100;
    return `${lossRate.toFixed(1)}%`;
  }, []);

  const getStatusColor = useCallback((latency: number | null) => {
    if (latency === null) {
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
    if (latency < 200) {
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    }
    if (latency < 400) {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    }
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  }, []);

  const getStatusText = useCallback(
    (status: string, latency: number | null) => {
      if (latency !== null) {
        return `${latency.toFixed(0)}ms`;
      }
      switch (status) {
        case 'error':
          return '超时';
        default:
          return '等待中';
      }
    },
    [],
  );

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 py-4 sm:py-8 lg:py-12 px-2 sm:px-4 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight text-gray-900 dark:text-white mb-4 leading-tight font-[family-name:var(--font-geist-sans)]">
            PackyCode API 延迟监控面板
          </h1>
          <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 font-normal max-w-2xl mx-auto leading-relaxed font-[family-name:var(--font-geist-sans)]">
            实时监控各服务节点的网络延迟性能，点击表格行即可复制对应的 API 地址
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed min-w-[320px]">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="w-1/2 px-2 sm:px-4 lg:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600">
                    域名
                  </th>
                  <th className="w-1/4 px-2 sm:px-4 lg:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600">
                    延迟
                  </th>
                  <th className="w-1/4 px-2 sm:px-4 lg:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600">
                    丢包率
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sites.map(site => (
                  <TableRow
                    key={site.domain}
                    site={site}
                    onCopyDomain={copyDomain}
                    getStatusColor={getStatusColor}
                    getStatusText={getStatusText}
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
