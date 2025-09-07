---
title: "数据均衡与迁移: 热点调度、容量均衡、坏盘处理"
date: 2025-09-07
categories: [DistributedFile]
tags: [DistributedFile]
published: true
---
在分布式文件存储平台中，数据均衡与迁移是确保系统高性能、高可用性和资源有效利用的关键机制。随着数据的不断增长和访问模式的变化，系统需要动态调整数据分布，以避免热点节点、容量不均和硬件故障等问题。本章将深入探讨数据均衡与迁移的核心技术，包括热点调度策略、容量均衡算法以及坏盘处理机制。

## 6.1.4.1 数据均衡与迁移概述

数据均衡与迁移是分布式存储系统中的重要运维操作，旨在优化数据分布、提高系统性能和保障数据安全。

### 6.1.4.1.1 数据均衡的重要性

```python
# 数据均衡重要性分析
import matplotlib.pyplot as plt
import numpy as np
from typing import Dict, List

class DataBalancingImportance:
    def __init__(self):
        self.metrics = {}
    
    def analyze_load_distribution(self, node_loads: List[float]) -> Dict:
        """
        分析节点负载分布
        :param node_loads: 各节点负载列表
        :return: 分析结果
        """
        if not node_loads:
            return {"error": "No data provided"}
        
        mean_load = np.mean(node_loads)
        std_dev = np.std(node_loads)
        max_load = np.max(node_loads)
        min_load = np.min(node_loads)
        load_range = max_load - min_load
        
        # 计算负载均衡度（越接近1越好）
        balance_ratio = 1 - (std_dev / mean_load) if mean_load > 0 else 0
        
        return {
            "mean_load": mean_load,
            "std_deviation": std_dev,
            "max_load": max_load,
            "min_load": min_load,
            "load_range": load_range,
            "balance_ratio": balance_ratio,
            "imbalance_level": self._classify_imbalance(balance_ratio)
        }
    
    def _classify_imbalance(self, balance_ratio: float) -> str:
        """分类不平衡程度"""
        if balance_ratio >= 0.9:
            return "Excellent"
        elif balance_ratio >= 0.7:
            return "Good"
        elif balance_ratio >= 0.5:
            return "Fair"
        else:
            return "Poor"
    
    def calculate_performance_impact(self, balance_ratio: float) -> Dict:
        """
        计算负载不均衡对性能的影响
        """
        # 简化的性能影响模型
        # 假设性能与均衡度成正比
        performance_degradation = 1 - balance_ratio
        
        # 响应时间影响（假设基准响应时间为100ms）
        baseline_response = 100  # ms
        impacted_response = baseline_response * (1 + performance_degradation * 2)
        
        # 吞吐量影响（假设基准吞吐量为1000 ops/sec）
        baseline_throughput = 1000  # ops/sec
        impacted_throughput = baseline_throughput * (1 - performance_degradation * 0.8)
        
        return {
            "performance_degradation": performance_degradation,
            "response_time_impact_ms": impacted_response - baseline_response,
            "throughput_impact_ops": baseline_throughput - impacted_throughput,
            "estimated_performance_loss": performance_degradation * 100
        }
    
    def simulate_balancing_benefits(self, initial_loads: List[float], 
                                  balanced_loads: List[float]) -> Dict:
        """
        模拟均衡前后的性能对比
        """
        initial_analysis = self.analyze_load_distribution(initial_loads)
        balanced_analysis = self.analyze_load_distribution(balanced_loads)
        
        initial_performance = self.calculate_performance_impact(initial_analysis["balance_ratio"])
        balanced_performance = self.calculate_performance_impact(balanced_analysis["balance_ratio"])
        
        return {
            "before_balancing": {
                "balance_ratio": initial_analysis["balance_ratio"],
                "imbalance_level": initial_analysis["imbalance_level"],
                "performance_degradation": initial_performance["performance_degradation"]
            },
            "after_balancing": {
                "balance_ratio": balanced_analysis["balance_ratio"],
                "imbalance_level": balanced_analysis["imbalance_level"],
                "performance_degradation": balanced_performance["performance_degradation"]
            },
            "improvement": {
                "balance_improvement": balanced_analysis["balance_ratio"] - initial_analysis["balance_ratio"],
                "performance_gain": initial_performance["performance_degradation"] - balanced_performance["performance_degradation"],
                "response_time_improvement_ms": initial_performance["response_time_impact_ms"] - balanced_performance["response_time_impact_ms"],
                "throughput_improvement_ops": balanced_performance["throughput_impact_ops"] - initial_performance["throughput_impact_ops"]
            }
        }

# 使用示例
print("=== 数据均衡重要性分析 ===")

balancing_analyzer = DataBalancingImportance()

# 模拟不均衡的负载分布
unbalanced_loads = [10, 15, 20, 25, 80, 90, 100, 120, 150, 200]  # 明显不均衡
print(f"不均衡负载: {unbalanced_loads}")

unbalanced_analysis = balancing_analyzer.analyze_load_distribution(unbalanced_loads)
print(f"不均衡分析结果:")
print(f"  平均负载: {unbalanced_analysis['mean_load']:.2f}")
print(f"  标准差: {unbalanced_analysis['std_deviation']:.2f}")
print(f"  负载范围: {unbalanced_analysis['load_range']:.2f}")
print(f"  均衡比率: {unbalanced_analysis['balance_ratio']:.3f}")
print(f"  不均衡程度: {unbalanced_analysis['imbalance_level']}")

# 性能影响分析
unbalanced_performance = balancing_analyzer.calculate_performance_impact(unbalanced_analysis["balance_ratio"])
print(f"  性能退化: {unbalanced_performance['estimated_performance_loss']:.1f}%")
print(f"  响应时间影响: +{unbalanced_performance['response_time_impact_ms']:.2f}ms")
print(f"  吞吐量影响: -{unbalanced_performance['throughput_impact_ops']:.2f} ops/sec")

# 模拟均衡后的负载分布
balanced_loads = [85, 88, 90, 92, 95, 98, 100, 102, 105, 108]  # 相对均衡
print(f"\n均衡后负载: {balanced_loads}")

# 对比分析
comparison = balancing_analyzer.simulate_balancing_benefits(unbalanced_loads, balanced_loads)
print(f"\n均衡效果对比:")
print(f"  均衡度提升: {comparison['improvement']['balance_improvement']:.3f}")
print(f"  性能改善: {comparison['improvement']['performance_gain']:.3f}")
print(f"  响应时间改善: {comparison['improvement']['response_time_improvement_ms']:.2f}ms")
print(f"  吞吐量改善: +{comparison['improvement']['throughput_improvement_ops']:.2f} ops/sec")
```

### 6.1.4.1.2 数据迁移的挑战

```python
# 数据迁移挑战分析
class DataMigrationChallenges:
    def __init__(self):
        self.challenges = {
            "network_bandwidth": {
                "description": "迁移大量数据会占用网络带宽，影响正常业务",
                "impact": "high",
                "mitigation": "限流控制、离峰迁移"
            },
            "system_performance": {
                "description": "迁移过程会消耗系统资源，可能影响服务性能",
                "impact": "medium",
                "mitigation": "资源隔离、优先级调度"
            },
            "data_consistency": {
                "description": "迁移过程中需要保证数据一致性",
                "impact": "high",
                "mitigation": "原子操作、事务支持"
            },
            "migration_time": {
                "description": "大数据量迁移耗时长，增加系统风险",
                "impact": "medium",
                "mitigation": "增量迁移、并行处理"
            },
            "failure_recovery": {
                "description": "迁移过程中发生故障需要能够恢复",
                "impact": "high",
                "mitigation": "断点续传、回滚机制"
            }
        }
    
    def assess_migration_risk(self, data_size_gb: float, network_bw_gbps: float, 
                            system_load: float) -> Dict:
        """
        评估迁移风险
        :param data_size_gb: 数据大小(GB)
        :param network_bw_gbps: 网络带宽(Gbps)
        :param system_load: 系统负载(0-1)
        :return: 风险评估结果
        """
        # 计算迁移时间（简化模型）
        # 假设网络利用率为50%
        effective_bw_gbps = network_bw_gbps * 0.5
        transfer_rate_gbps = effective_bw_gbps * 0.8  # 考虑协议开销
        transfer_rate_gb_per_hour = transfer_rate_gbps * 3600 / 8
        estimated_time_hours = data_size_gb / transfer_rate_gb_per_hour if transfer_rate_gb_per_hour > 0 else float('inf')
        
        # 风险因子计算
        size_risk = min(data_size_gb / 1000, 1.0)  # 1TB为高风险阈值
        bandwidth_risk = max(1 - (network_bw_gbps / 10), 0)  # 10Gbps为基准
        load_risk = system_load
        
        overall_risk = (size_risk * 0.4 + bandwidth_risk * 0.3 + load_risk * 0.3)
        
        # 风险等级分类
        risk_level = self._classify_risk(overall_risk)
        
        return {
            "data_size_gb": data_size_gb,
            "network_bandwidth_gbps": network_bw_gbps,
            "system_load": system_load,
            "estimated_migration_time_hours": estimated_time_hours,
            "risk_factors": {
                "size_risk": size_risk,
                "bandwidth_risk": bandwidth_risk,
                "load_risk": load_risk
            },
            "overall_risk": overall_risk,
            "risk_level": risk_level,
            "recommendations": self._generate_recommendations(overall_risk, data_size_gb, system_load)
        }
    
    def _classify_risk(self, risk_score: float) -> str:
        """风险等级分类"""
        if risk_score < 0.3:
            return "Low"
        elif risk_score < 0.6:
            return "Medium"
        elif risk_score < 0.8:
            return "High"
        else:
            return "Critical"
    
    def _generate_recommendations(self, risk_score: float, data_size_gb: float, 
                                system_load: float) -> List[str]:
        """生成建议"""
        recommendations = []
        
        if risk_score >= 0.6:
            recommendations.append("建议在业务低峰期进行迁移")
        
        if data_size_gb > 500:
            recommendations.append("考虑使用增量迁移策略")
        
        if system_load > 0.7:
            recommendations.append("建议限制迁移并发度，避免影响在线业务")
        
        if risk_score >= 0.8:
            recommendations.append("制定详细的回滚计划和故障恢复方案")
            recommendations.append("安排专人监控迁移过程")
        
        return recommendations

# 使用示例
print("\n=== 数据迁移挑战分析 ===")

migration_challenges = DataMigrationChallenges()

# 评估不同场景的迁移风险
scenarios = [
    {"name": "小数据量低负载", "data_size_gb": 50, "network_bw_gbps": 10, "system_load": 0.3},
    {"name": "中等数据量中负载", "data_size_gb": 500, "network_bw_gbps": 5, "system_load": 0.6},
    {"name": "大数据量高负载", "data_size_gb": 2000, "network_bw_gbps": 2, "system_load": 0.8}
]

for scenario in scenarios:
    risk_assessment = migration_challenges.assess_migration_risk(
        scenario["data_size_gb"],
        scenario["network_bw_gbps"],
        scenario["system_load"]
    )
    
    print(f"\n场景: {scenario['name']}")
    print(f"  数据大小: {risk_assessment['data_size_gb']} GB")
    print(f"  估计迁移时间: {risk_assessment['estimated_migration_time_hours']:.2f} 小时")
    print(f"  整体风险: {risk_assessment['overall_risk']:.2f} ({risk_assessment['risk_level']})")
    print(f"  建议:")
    for i, recommendation in enumerate(risk_assessment["recommendations"], 1):
        print(f"    {i}. {recommendation}")
```

## 6.1.4.2 热点调度策略

热点调度是数据均衡的重要组成部分，旨在识别和缓解访问热点，确保系统负载均匀分布。

### 6.1.4.2.1 热点识别算法

```python
# 热点识别算法实现
import time
import threading
from typing import Dict, List, Tuple
from collections import defaultdict, deque
from dataclasses import dataclass

@dataclass
class AccessRecord:
    timestamp: float
    node_id: str
    data_id: str
    access_count: int
    access_type: str  # "read", "write", "metadata"

class HotspotDetector:
    def __init__(self, window_size: int = 1000, time_window_seconds: float = 300.0):
        """
        初始化热点检测器
        :param window_size: 访问记录窗口大小
        :param time_window_seconds: 时间窗口（秒）
        """
        self.window_size = window_size
        self.time_window = time_window_seconds
        self.access_records = deque(maxlen=window_size)
        self.node_access_stats = defaultdict(lambda: {"count": 0, "last_update": 0})
        self.data_access_stats = defaultdict(lambda: {"count": 0, "last_update": 0})
        self.lock = threading.Lock()
    
    def record_access(self, node_id: str, data_id: str, access_count: int = 1, 
                     access_type: str = "read"):
        """
        记录访问事件
        :param node_id: 节点ID
        :param data_id: 数据ID
        :param access_count: 访问次数
        :param access_type: 访问类型
        """
        with self.lock:
            record = AccessRecord(
                timestamp=time.time(),
                node_id=node_id,
                data_id=data_id,
                access_count=access_count,
                access_type=access_type
            )
            self.access_records.append(record)
            
            # 更新节点访问统计
            self.node_access_stats[node_id]["count"] += access_count
            self.node_access_stats[node_id]["last_update"] = time.time()
            
            # 更新数据访问统计
            self.data_access_stats[data_id]["count"] += access_count
            self.data_access_stats[data_id]["last_update"] = time.time()
    
    def detect_hot_nodes(self, threshold_percentile: float = 90) -> List[Tuple[str, int]]:
        """
        检测热点节点
        :param threshold_percentile: 阈值百分位数
        :return: [(节点ID, 访问次数), ...]
        """
        with self.lock:
            # 清理过期记录
            self._cleanup_expired_records()
            
            # 获取所有节点的访问次数
            node_counts = [(node_id, stats["count"]) 
                          for node_id, stats in self.node_access_stats.items()]
            
            if not node_counts:
                return []
            
            # 按访问次数排序
            node_counts.sort(key=lambda x: x[1], reverse=True)
            
            # 计算阈值
            counts = [count for _, count in node_counts]
            threshold_index = int(len(counts) * (threshold_percentile / 100))
            threshold_index = min(threshold_index, len(counts) - 1)
            threshold = counts[threshold_index] if counts else 0
            
            # 返回超过阈值的热点节点
            hot_nodes = [(node_id, count) for node_id, count in node_counts if count >= threshold]
            return hot_nodes
    
    def detect_hot_data(self, threshold_percentile: float = 95) -> List[Tuple[str, int]]:
        """
        检测热点数据
        :param threshold_percentile: 阈值百分位数
        :return: [(数据ID, 访问次数), ...]
        """
        with self.lock:
            # 清理过期记录
            self._cleanup_expired_records()
            
            # 获取所有数据的访问次数
            data_counts = [(data_id, stats["count"]) 
                          for data_id, stats in self.data_access_stats.items()]
            
            if not data_counts:
                return []
            
            # 按访问次数排序
            data_counts.sort(key=lambda x: x[1], reverse=True)
            
            # 计算阈值
            counts = [count for _, count in data_counts]
            threshold_index = int(len(counts) * (threshold_percentile / 100))
            threshold_index = min(threshold_index, len(counts) - 1)
            threshold = counts[threshold_index] if counts else 0
            
            # 返回超过阈值的热点数据
            hot_data = [(data_id, count) for data_id, count in data_counts if count >= threshold]
            return hot_data
    
    def get_access_trends(self, data_id: str, intervals: int = 5) -> List[Tuple[float, int]]:
        """
        获取数据访问趋势
        :param data_id: 数据ID
        :param intervals: 时间间隔数
        :return: [(时间戳, 访问次数), ...]
        """
        with self.lock:
            # 按时间窗口分组统计
            current_time = time.time()
            interval_duration = self.time_window / intervals
            
            trends = []
            for i in range(intervals):
                start_time = current_time - (intervals - i) * interval_duration
                end_time = current_time - (intervals - i - 1) * interval_duration
                
                count = 0
                for record in self.access_records:
                    if (record.data_id == data_id and 
                        start_time <= record.timestamp < end_time):
                        count += record.access_count
                
                trends.append((start_time, count))
            
            return trends
    
    def _cleanup_expired_records(self):
        """清理过期记录"""
        current_time = time.time()
        expired_time = current_time - self.time_window
        
        # 清理访问记录
        while self.access_records and self.access_records[0].timestamp < expired_time:
            self.access_records.popleft()
        
        # 清理过期的节点统计
        expired_nodes = [
            node_id for node_id, stats in self.node_access_stats.items()
            if stats["last_update"] < expired_time
        ]
        for node_id in expired_nodes:
            del self.node_access_stats[node_id]
        
        # 清理过期的数据统计
        expired_data = [
            data_id for data_id, stats in self.data_access_stats.items()
            if stats["last_update"] < expired_time
        ]
        for data_id in expired_data:
            del self.data_access_stats[data_id]

# 热点调度器
class HotspotScheduler:
    def __init__(self, detector: HotspotDetector):
        self.detector = detector
        self.migration_plan = []
        self.scheduling_lock = threading.Lock()
    
    def generate_migration_plan(self, hot_data_limit: int = 10) -> List[Dict]:
        """
        生成热点数据迁移计划
        :param hot_data_limit: 热点数据限制
        :return: 迁移计划
        """
        with self.scheduling_lock:
            # 检测热点数据
            hot_data = self.detector.detect_hot_data(95)
            hot_data = hot_data[:hot_data_limit]  # 限制数量
            
            migration_plan = []
            for data_id, access_count in hot_data:
                # 获取访问趋势
                trends = self.detector.get_access_trends(data_id)
                
                # 判断是否需要迁移（访问量持续增长）
                if self._should_migrate(trends):
                    # 选择目标节点（选择负载较低的节点）
                    target_node = self._select_target_node(data_id)
                    if target_node:
                        migration_plan.append({
                            "data_id": data_id,
                            "access_count": access_count,
                            "trends": trends,
                            "target_node": target_node,
                            "priority": self._calculate_priority(access_count, trends)
                        })
            
            # 按优先级排序
            migration_plan.sort(key=lambda x: x["priority"], reverse=True)
            self.migration_plan = migration_plan
            return migration_plan
    
    def _should_migrate(self, trends: List[Tuple[float, int]]) -> bool:
        """判断是否需要迁移"""
        if len(trends) < 2:
            return False
        
        # 简单的趋势判断：最近的访问量是否显著增长
        recent_avg = sum(count for _, count in trends[-2:]) / 2
        older_avg = sum(count for _, count in trends[:-2]) / (len(trends) - 2) if len(trends) > 2 else 0
        
        # 如果最近平均访问量是之前平均的2倍以上，则需要迁移
        return recent_avg > older_avg * 2 and recent_avg > 10
    
    def _select_target_node(self, data_id: str) -> str:
        """选择目标节点"""
        # 检测热点节点
        hot_nodes = self.detector.detect_hot_nodes(90)
        hot_node_ids = {node_id for node_id, _ in hot_nodes}
        
        # 选择非热点节点中负载最低的
        all_nodes = set(self.detector.node_access_stats.keys())
        candidate_nodes = all_nodes - hot_node_ids
        
        if not candidate_nodes:
            # 如果所有节点都是热点，选择访问次数最少的
            candidate_nodes = all_nodes
        
        # 选择访问次数最少的节点
        min_count = float('inf')
        target_node = None
        for node_id in candidate_nodes:
            count = self.detector.node_access_stats[node_id]["count"]
            if count < min_count:
                min_count = count
                target_node = node_id
        
        return target_node or "node_default"
    
    def _calculate_priority(self, access_count: int, trends: List[Tuple[float, int]]) -> int:
        """计算迁移优先级"""
        # 基于访问次数和增长趋势计算优先级
        trend_score = 0
        if len(trends) >= 2:
            recent = sum(count for _, count in trends[-2:])
            older = sum(count for _, count in trends[:-2]) if len(trends) > 2 else 0
            trend_score = recent - older
        
        return access_count + max(0, trend_score)

# 使用示例
print("\n=== 热点识别与调度 ===")

# 创建热点检测器和调度器
hotspot_detector = HotspotDetector(window_size=1000, time_window_seconds=300)
hotspot_scheduler = HotspotScheduler(hotspot_detector)

# 模拟访问记录
print("模拟访问记录...")
nodes = [f"node_{i}" for i in range(1, 6)]
data_items = [f"data_{i}" for i in range(1, 21)]

# 模拟热点访问模式
import random
for _ in range(500):
    node = random.choice(nodes)
    data = random.choice(data_items)
    access_count = random.randint(1, 10)
    access_type = random.choice(["read", "write", "metadata"])
    
    hotspot_detector.record_access(node, data, access_count, access_type)
    
    # 模拟某些数据成为热点
    if data in ["data_1", "data_2", "data_3"]:
        # 增加这些数据的访问频率
        for _ in range(3):
            hotspot_detector.record_access(node, data, random.randint(5, 20), "read")

# 检测热点节点
hot_nodes = hotspot_detector.detect_hot_nodes(80)
print(f"\n热点节点 (前80%):")
for node_id, count in hot_nodes[:5]:
    print(f"  {node_id}: {count} 次访问")

# 检测热点数据
hot_data = hotspot_detector.detect_hot_data(90)
print(f"\n热点数据 (前90%):")
for data_id, count in hot_data[:5]:
    print(f"  {data_id}: {count} 次访问")
    
    # 显示访问趋势
    trends = hotspot_detector.get_access_trends(data_id, 5)
    trend_desc = " -> ".join([str(count) for _, count in trends])
    print(f"    趋势: {trend_desc}")

# 生成迁移计划
migration_plan = hotspot_scheduler.generate_migration_plan(hot_data_limit=5)
print(f"\n迁移计划:")
for i, plan in enumerate(migration_plan, 1):
    print(f"  {i}. 数据 {plan['data_id']} (访问次数: {plan['access_count']})")
    print(f"     目标节点: {plan['target_node']}")
    print(f"     优先级: {plan['priority']}")
    trend_desc = " -> ".join([str(count) for _, count in plan['trends']])
    print(f"     趋势: {trend_desc}")
```

### 6.1.4.2.2 动态负载均衡

```python
# 动态负载均衡实现
import heapq
from typing import Dict, List, Tuple

class DynamicLoadBalancer:
    def __init__(self):
        self.node_metrics = {}  # 节点指标
        self.load_history = {}  # 负载历史
        self.balance_threshold = 0.2  # 负载差异阈值
    
    def update_node_metrics(self, node_id: str, metrics: Dict):
        """
        更新节点指标
        :param node_id: 节点ID
        :param metrics: 指标字典
        """
        self.node_metrics[node_id] = {
            "cpu_usage": metrics.get("cpu_usage", 0),
            "memory_usage": metrics.get("memory_usage", 0),
            "disk_io": metrics.get("disk_io", 0),
            "network_io": metrics.get("network_io", 0),
            "storage_usage": metrics.get("storage_usage", 0),
            "request_rate": metrics.get("request_rate", 0),
            "timestamp": time.time()
        }
        
        # 更新负载历史
        if node_id not in self.load_history:
            self.load_history[node_id] = []
        self.load_history[node_id].append(self.node_metrics[node_id])
        
        # 保持历史记录在合理范围内
        if len(self.load_history[node_id]) > 100:
            self.load_history[node_id].pop(0)
    
    def calculate_node_load(self, node_id: str) -> float:
        """
        计算节点负载分数 (0-1, 越高负载越重)
        :param node_id: 节点ID
        :return: 负载分数
        """
        if node_id not in self.node_metrics:
            return 0.0
        
        metrics = self.node_metrics[node_id]
        
        # 加权计算负载分数
        cpu_weight = 0.3
        memory_weight = 0.2
        disk_weight = 0.2
        network_weight = 0.15
        storage_weight = 0.1
        request_weight = 0.05
        
        load_score = (
            metrics["cpu_usage"] * cpu_weight +
            metrics["memory_usage"] * memory_weight +
            min(metrics["disk_io"] / 1000, 1.0) * disk_weight +  # 假设1000为高IO阈值
            min(metrics["network_io"] / 1000, 1.0) * network_weight +
            metrics["storage_usage"] * storage_weight +
            min(metrics["request_rate"] / 1000, 1.0) * request_weight  # 假设1000为高请求率阈值
        )
        
        return min(load_score, 1.0)
    
    def get_load_distribution(self) -> Dict[str, float]:
        """
        获取负载分布
        :return: {节点ID: 负载分数}
        """
        load_distribution = {}
        for node_id in self.node_metrics:
            load_distribution[node_id] = self.calculate_node_load(node_id)
        return load_distribution
    
    def identify_imbalanced_nodes(self) -> Tuple[List[str], List[str]]:
        """
        识别不平衡节点
        :return: (过载节点列表, 空闲节点列表)
        """
        load_distribution = self.get_load_distribution()
        if not load_distribution:
            return [], []
        
        loads = list(load_distribution.values())
        avg_load = sum(loads) / len(loads)
        max_load = max(loads)
        min_load = min(loads)
        
        # 识别过载和空闲节点
        overloaded_nodes = []
        idle_nodes = []
        
        for node_id, load in load_distribution.items():
            if load > avg_load + self.balance_threshold:
                overloaded_nodes.append(node_id)
            elif load < avg_load - self.balance_threshold:
                idle_nodes.append(node_id)
        
        return overloaded_nodes, idle_nodes
    
    def generate_balancing_actions(self, max_actions: int = 5) -> List[Dict]:
        """
        生成负载均衡操作
        :param max_actions: 最大操作数
        :return: 均衡操作列表
        """
        overloaded_nodes, idle_nodes = self.identify_imbalanced_nodes()
        if not overloaded_nodes or not idle_nodes:
            return []
        
        actions = []
        
        # 为每个过载节点生成迁移建议
        for overloaded_node in overloaded_nodes:
            # 获取该节点上需要迁移的数据
            data_to_migrate = self._select_data_for_migration(overloaded_node)
            
            for data_id, data_size in data_to_migrate[:2]:  # 每个节点最多迁移2个数据
                # 选择目标节点（最空闲的节点）
                target_node = self._select_target_node(idle_nodes)
                if target_node:
                    actions.append({
                        "action": "migrate",
                        "data_id": data_id,
                        "source_node": overloaded_node,
                        "target_node": target_node,
                        "data_size_mb": data_size,
                        "priority": self._calculate_migration_priority(
                            overloaded_node, target_node, data_size
                        )
                    })
                
                if len(actions) >= max_actions:
                    break
            
            if len(actions) >= max_actions:
                break
        
        # 按优先级排序
        actions.sort(key=lambda x: x["priority"], reverse=True)
        return actions[:max_actions]
    
    def _select_data_for_migration(self, node_id: str) -> List[Tuple[str, float]]:
        """
        选择需要迁移的数据
        :param node_id: 节点ID
        :return: [(数据ID, 数据大小MB), ...]
        """
        # 模拟数据选择逻辑
        # 实际实现中应根据数据访问频率、大小等因素选择
        sample_data = [
            ("data_001", 100.5),
            ("data_002", 250.0),
            ("data_003", 50.2),
            ("data_004", 500.8),
            ("data_005", 75.3)
        ]
        return sample_data
    
    def _select_target_node(self, candidate_nodes: List[str]) -> str:
        """
        选择目标节点
        :param candidate_nodes: 候选节点列表
        :return: 目标节点ID
        """
        if not candidate_nodes:
            return ""
        
        # 选择负载最轻的节点
        min_load = float('inf')
        target_node = ""
        
        for node_id in candidate_nodes:
            load = self.calculate_node_load(node_id)
            if load < min_load:
                min_load = load
                target_node = node_id
        
        return target_node
    
    def _calculate_migration_priority(self, source_node: str, target_node: str, 
                                    data_size_mb: float) -> float:
        """
        计算迁移优先级
        :param source_node: 源节点
        :param target_node: 目标节点
        :param data_size_mb: 数据大小
        :return: 优先级分数
        """
        source_load = self.calculate_node_load(source_node)
        target_load = self.calculate_node_load(target_node)
        
        # 优先级基于源节点负载和数据大小
        # 源节点负载越高，数据越大，优先级越高
        priority = source_load * 0.7 + (data_size_mb / 1000) * 0.3
        return priority

# 使用示例
print("\n=== 动态负载均衡 ===")

# 创建负载均衡器
load_balancer = DynamicLoadBalancer()

# 模拟节点指标更新
node_metrics_samples = [
    {"node_id": "node1", "metrics": {"cpu_usage": 0.85, "memory_usage": 0.75, "disk_io": 800, "network_io": 600, "storage_usage": 0.8, "request_rate": 900}},
    {"node_id": "node2", "metrics": {"cpu_usage": 0.45, "memory_usage": 0.35, "disk_io": 300, "network_io": 200, "storage_usage": 0.4, "request_rate": 300}},
    {"node_id": "node3", "metrics": {"cpu_usage": 0.95, "memory_usage": 0.90, "disk_io": 950, "network_io": 800, "storage_usage": 0.95, "request_rate": 1200}},
    {"node_id": "node4", "metrics": {"cpu_usage": 0.25, "memory_usage": 0.20, "disk_io": 150, "network_io": 100, "storage_usage": 0.25, "request_rate": 150}},
    {"node_id": "node5", "metrics": {"cpu_usage": 0.65, "memory_usage": 0.55, "disk_io": 500, "network_io": 400, "storage_usage": 0.6, "request_rate": 600}}
]

print("更新节点指标...")
for sample in node_metrics_samples:
    load_balancer.update_node_metrics(sample["node_id"], sample["metrics"])
    print(f"  {sample['node_id']}: CPU={sample['metrics']['cpu_usage']:.2f}, "
          f"内存={sample['metrics']['memory_usage']:.2f}, "
          f"存储使用={sample['metrics']['storage_usage']:.2f}")

# 获取负载分布
load_distribution = load_balancer.get_load_distribution()
print(f"\n负载分布:")
for node_id, load in load_distribution.items():
    print(f"  {node_id}: {load:.3f}")

# 识别不平衡节点
overloaded_nodes, idle_nodes = load_balancer.identify_imbalanced_nodes()
print(f"\n不平衡节点识别:")
print(f"  过载节点: {overloaded_nodes}")
print(f"  空闲节点: {idle_nodes}")

# 生成均衡操作
balancing_actions = load_balancer.generate_balancing_actions(max_actions=3)
print(f"\n负载均衡操作建议:")
for i, action in enumerate(balancing_actions, 1):
    print(f"  {i}. {action['action']} {action['data_id']}")
    print(f"     从 {action['source_node']} 迁移到 {action['target_node']}")
    print(f"     数据大小: {action['data_size_mb']} MB")
    print(f"     优先级: {action['priority']:.3f}")
```

## 6.1.4.3 容量均衡算法

容量均衡是确保各存储节点容量利用率相对均匀的重要机制，避免部分节点空间不足而其他节点大量空闲的情况。

### 6.1.4.3.1 容量监控与预测

```python
# 容量监控与预测系统
import math
from typing import Dict, List, Tuple
from datetime import datetime, timedelta

class CapacityMonitor:
    def __init__(self):
        self.node_capacity_stats = {}  # 节点容量统计
        self.capacity_predictions = {}  # 容量预测
        self.alert_thresholds = {
            "warning": 0.8,   # 80% 容量警告
            "critical": 0.95  # 95% 容量危险
        }
    
    def update_capacity_stats(self, node_id: str, total_capacity_gb: float, 
                            used_capacity_gb: float, reserved_capacity_gb: float = 0):
        """
        更新节点容量统计
        :param node_id: 节点ID
        :param total_capacity_gb: 总容量(GB)
        :param used_capacity_gb: 已用容量(GB)
        :param reserved_capacity_gb: 预留容量(GB)
        """
        available_capacity_gb = total_capacity_gb - used_capacity_gb - reserved_capacity_gb
        utilization_rate = used_capacity_gb / total_capacity_gb if total_capacity_gb > 0 else 0
        
        self.node_capacity_stats[node_id] = {
            "total_capacity_gb": total_capacity_gb,
            "used_capacity_gb": used_capacity_gb,
            "available_capacity_gb": available_capacity_gb,
            "reserved_capacity_gb": reserved_capacity_gb,
            "utilization_rate": utilization_rate,
            "timestamp": datetime.now()
        }
        
        # 更新容量预测
        self._update_capacity_prediction(node_id)
    
    def _update_capacity_prediction(self, node_id: str):
        """
        更新容量预测
        :param node_id: 节点ID
        """
        if node_id not in self.node_capacity_stats:
            return
        
        current_stats = self.node_capacity_stats[node_id]
        current_time = datetime.now()
        
        # 初始化预测记录
        if node_id not in self.capacity_predictions:
            self.capacity_predictions[node_id] = {
                "history": [],
                "trend": 0,
                "full_prediction_days": None
            }
        
        # 添加当前记录到历史
        self.capacity_predictions[node_id]["history"].append({
            "timestamp": current_time,
            "utilization": current_stats["utilization_rate"],
            "used_gb": current_stats["used_capacity_gb"]
        })
        
        # 保持历史记录在合理范围内（最多30天）
        history = self.capacity_predictions[node_id]["history"]
        cutoff_date = current_time - timedelta(days=30)
        self.capacity_predictions[node_id]["history"] = [
            record for record in history 
            if record["timestamp"] >= cutoff_date
        ]
        
        # 计算容量增长趋势
        recent_history = self.capacity_predictions[node_id]["history"][-7:]  # 最近7天
        if len(recent_history) >= 2:
            first_record = recent_history[0]
            last_record = recent_history[-1]
            time_diff_days = (last_record["timestamp"] - first_record["timestamp"]).days
            
            if time_diff_days > 0:
                utilization_diff = last_record["utilization"] - first_record["utilization"]
                trend = utilization_diff / time_diff_days  # 每天增长率
                self.capacity_predictions[node_id]["trend"] = trend
                
                # 预测填满时间
                if trend > 0:
                    remaining_utilization = 1.0 - last_record["utilization"]
                    days_to_full = remaining_utilization / trend
                    self.capacity_predictions[node_id]["full_prediction_days"] = days_to_full
                else:
                    self.capacity_predictions[node_id]["full_prediction_days"] = None
    
    def get_capacity_status(self, node_id: str) -> Dict:
        """
        获取节点容量状态
        :param node_id: 节点ID
        :return: 容量状态信息
        """
        if node_id not in self.node_capacity_stats:
            return {"error": "Node not found"}
        
        stats = self.node_capacity_stats[node_id]
        utilization = stats["utilization_rate"]
        
        # 确定状态级别
        if utilization >= self.alert_thresholds["critical"]:
            status = "critical"
        elif utilization >= self.alert_thresholds["warning"]:
            status = "warning"
        else:
            status = "normal"
        
        # 获取预测信息
        prediction_info = self.capacity_predictions.get(node_id, {})
        trend = prediction_info.get("trend", 0)
        full_prediction_days = prediction_info.get("full_prediction_days")
        
        return {
            "node_id": node_id,
            "status": status,
            "utilization_rate": utilization,
            "total_capacity_gb": stats["total_capacity_gb"],
            "used_capacity_gb": stats["used_capacity_gb"],
            "available_capacity_gb": stats["available_capacity_gb"],
            "growth_trend": trend,
            "full_prediction_days": full_prediction_days,
            "alert_thresholds": self.alert_thresholds
        }
    
    def get_cluster_capacity_overview(self) -> Dict:
        """
        获取集群容量概览
        :return: 集群容量统计
        """
        if not self.node_capacity_stats:
            return {"error": "No capacity data available"}
        
        total_capacity = sum(stats["total_capacity_gb"] for stats in self.node_capacity_stats.values())
        total_used = sum(stats["used_capacity_gb"] for stats in self.node_capacity_stats.values())
        total_available = sum(stats["available_capacity_gb"] for stats in self.node_capacity_stats.values())
        
        avg_utilization = total_used / total_capacity if total_capacity > 0 else 0
        
        # 统计各状态节点数
        status_counts = {"normal": 0, "warning": 0, "critical": 0}
        for node_id in self.node_capacity_stats:
            status = self.get_capacity_status(node_id)["status"]
            status_counts[status] += 1
        
        return {
            "cluster_stats": {
                "total_capacity_tb": total_capacity / 1024,
                "total_used_tb": total_used / 1024,
                "total_available_tb": total_available / 1024,
                "average_utilization": avg_utilization,
                "utilization_percentage": avg_utilization * 100
            },
            "node_status_distribution": status_counts,
            "nodes_needing_attention": status_counts["warning"] + status_counts["critical"]
        }
    
    def predict_capacity_needs(self, growth_rate: float = 0.1, 
                             planning_horizon_months: int = 12) -> Dict:
        """
        预测容量需求
        :param growth_rate: 预期增长率（每月）
        :param planning_horizon_months: 规划时间范围（月）
        :return: 容量需求预测
        """
        cluster_overview = self.get_cluster_capacity_overview()
        if "error" in cluster_overview:
            return cluster_overview
        
        current_capacity_tb = cluster_overview["cluster_stats"]["total_capacity_tb"]
        current_used_tb = cluster_overview["cluster_stats"]["total_used_tb"]
        
        # 计算未来容量需求
        months = list(range(1, planning_horizon_months + 1))
        capacity_projections = []
        used_projections = []
        
        for month in months:
            # 计算预期容量和使用量
            projected_capacity = current_capacity_tb * math.pow(1 + growth_rate, month)
            projected_used = current_used_tb * math.pow(1 + growth_rate, month)
            utilization_rate = projected_used / projected_capacity if projected_capacity > 0 else 0
            
            capacity_projections.append(projected_capacity)
            used_projections.append(projected_used)
        
        # 预测需要增加的容量
        final_projected_capacity = capacity_projections[-1] if capacity_projections else current_capacity_tb
        capacity_increase_needed = final_projected_capacity - current_capacity_tb
        
        return {
            "current_capacity_tb": current_capacity_tb,
            "current_used_tb": current_used_tb,
            "planning_horizon_months": planning_horizon_months,
            "growth_rate": growth_rate,
            "final_projected_capacity_tb": final_projected_capacity,
            "capacity_increase_needed_tb": capacity_increase_needed,
            "monthly_projections": {
                "months": months,
                "capacity_tb": capacity_projections,
                "used_tb": used_projections
            }
        }

# 使用示例
print("\n=== 容量监控与预测 ===")

# 创建容量监控器
capacity_monitor = CapacityMonitor()

# 模拟节点容量数据更新
node_capacity_data = [
    {"node_id": "node1", "total_gb": 10000, "used_gb": 7500, "reserved_gb": 200},
    {"node_id": "node2", "total_gb": 10000, "used_gb": 9200, "reserved_gb": 200},  # 高使用率
    {"node_id": "node3", "total_gb": 10000, "used_gb": 4500, "reserved_gb": 200},
    {"node_id": "node4", "total_gb": 10000, "used_gb": 8800, "reserved_gb": 200},  # 高使用率
    {"node_id": "node5", "total_gb": 10000, "used_gb": 3200, "reserved_gb": 200}
]

print("更新节点容量统计...")
for data in node_capacity_data:
    capacity_monitor.update_capacity_stats(
        data["node_id"], 
        data["total_gb"], 
        data["used_gb"], 
        data["reserved_gb"]
    )
    
    status = capacity_monitor.get_capacity_status(data["node_id"])
    print(f"  {data['node_id']}: 使用率 {status['utilization_rate']:.1%} "
          f"({status['used_capacity_gb']:.0f}/{status['total_capacity_gb']:.0f} GB) "
          f"状态: {status['status']}")

# 获取集群容量概览
cluster_overview = capacity_monitor.get_cluster_capacity_overview()
print(f"\n集群容量概览:")
print(f"  总容量: {cluster_overview['cluster_stats']['total_capacity_tb']:.1f} TB")
print(f"  已用容量: {cluster_overview['cluster_stats']['total_used_tb']:.1f} TB")
print(f"  平均使用率: {cluster_overview['cluster_stats']['utilization_percentage']:.1f}%")
print(f"  需要关注的节点数: {cluster_overview['nodes_needing_attention']}")

# 容量需求预测
capacity_prediction = capacity_monitor.predict_capacity_needs(
    growth_rate=0.08,  # 8%每月增长
    planning_horizon_months=6
)

print(f"\n容量需求预测 (6个月, 8%月增长率):")
print(f"  当前容量: {capacity_prediction['current_capacity_tb']:.1f} TB")
print(f"  最终预测容量: {capacity_prediction['final_projected_capacity_tb']:.1f} TB")
print(f"  需要增加容量: {capacity_prediction['capacity_increase_needed_tb']:.1f} TB")

# 显示月度预测
monthly_projections = capacity_prediction["monthly_projections"]
print(f"  月度预测:")
for i, (month, capacity, used) in enumerate(zip(
    monthly_projections["months"],
    monthly_projections["capacity_tb"],
    monthly_projections["used_tb"]
)):
    utilization = used / capacity if capacity > 0 else 0
    print(f"    第{month}月: {capacity:.1f} TB容量, {used:.1f} TB已用 ({utilization:.1%})")
    if i >= 4:  # 只显示前5个月
        break
```

### 6.1.4.3.2 容量均衡策略

```python
# 容量均衡策略实现
class CapacityBalancer:
    def __init__(self, capacity_monitor: CapacityMonitor):
        self.capacity_monitor = capacity_monitor
        self.balance_threshold = 0.1  # 10% 容量差异阈值
    
    def analyze_capacity_distribution(self) -> Dict:
        """
        分析容量分布
        :return: 容量分布分析结果
        """
        if not self.capacity_monitor.node_capacity_stats:
            return {"error": "No capacity data available"}
        
        # 获取所有节点的容量使用率
        utilizations = []
        node_info = []
        
        for node_id, stats in self.capacity_monitor.node_capacity_stats.items():
            utilization = stats["utilization_rate"]
            utilizations.append(utilization)
            node_info.append({
                "node_id": node_id,
                "utilization": utilization,
                "available_gb": stats["available_capacity_gb"],
                "used_gb": stats["used_capacity_gb"]
            })
        
        if not utilizations:
            return {"error": "No utilization data"}
        
        avg_utilization = sum(utilizations) / len(utilizations)
        max_utilization = max(utilizations)
        min_utilization = min(utilizations)
        utilization_range = max_utilization - min_utilization
        
        # 按使用率排序
        node_info.sort(key=lambda x: x["utilization"])
        
        return {
            "average_utilization": avg_utilization,
            "max_utilization": max_utilization,
            "min_utilization": min_utilization,
            "utilization_range": utilization_range,
            "imbalance_ratio": utilization_range / avg_utilization if avg_utilization > 0 else 0,
            "nodes_by_utilization": node_info,
            "is_balanced": utilization_range <= self.balance_threshold
        }
    
    def identify_capacity_imbalances(self) -> Tuple[List[Dict], List[Dict]]:
        """
        识别容量不平衡
        :return: (高容量节点列表, 低容量节点列表)
        """
        analysis = self.analyze_capacity_distribution()
        if "error" in analysis:
            return [], []
        
        avg_utilization = analysis["average_utilization"]
        nodes = analysis["nodes_by_utilization"]
        
        # 识别高容量和低容量节点
        high_capacity_nodes = [
            node for node in nodes 
            if node["utilization"] > avg_utilization + self.balance_threshold
        ]
        
        low_capacity_nodes = [
            node for node in nodes 
            if node["utilization"] < avg_utilization - self.balance_threshold
        ]
        
        return high_capacity_nodes, low_capacity_nodes
    
    def generate_capacity_balancing_plan(self, max_migrations: int = 5) -> List[Dict]:
        """
        生成容量均衡计划
        :param max_migrations: 最大迁移数
        :return: 均衡计划
        """
        high_capacity_nodes, low_capacity_nodes = self.identify_capacity_imbalances()
        if not high_capacity_nodes or not low_capacity_nodes:
            return []
        
        balancing_plan = []
        
        # 为每个高容量节点生成迁移建议
        for high_node in high_capacity_nodes:
            # 选择要迁移的数据
            data_to_migrate = self._select_data_for_capacity_migration(high_node)
            
            for data_id, data_size_gb in data_to_migrate[:2]:  # 每个节点最多迁移2个数据
                # 选择目标节点（容量最低的节点）
                target_node = self._select_capacity_target_node(low_capacity_nodes)
                if target_node:
                    # 计算迁移后的影响
                    estimated_impact = self._estimate_migration_impact(
                        high_node, target_node, data_size_gb
                    )
                    
                    balancing_plan.append({
                        "action": "capacity_balance",
                        "data_id": data_id,
                        "source_node": high_node["node_id"],
                        "target_node": target_node["node_id"],
                        "data_size_gb": data_size_gb,
                        "priority": self._calculate_capacity_priority(
                            high_node, target_node, data_size_gb
                        ),
                        "estimated_impact": estimated_impact
                    })
                
                if len(balancing_plan) >= max_migrations:
                    break
            
            if len(balancing_plan) >= max_migrations:
                break
        
        # 按优先级排序
        balancing_plan.sort(key=lambda x: x["priority"], reverse=True)
        return balancing_plan[:max_migrations]
    
    def _select_data_for_capacity_migration(self, high_node_info: Dict) -> List[Tuple[str, float]]:
        """
        选择用于容量迁移的数据
        :param high_node_info: 高容量节点信息
        :return: [(数据ID, 数据大小GB), ...]
        """
        # 模拟数据选择逻辑
        # 实际实现中应根据数据大小、访问频率、重要性等因素选择
        sample_data = [
            ("large_data_001", 150.0),  # 大文件
            ("medium_data_002", 75.5),
            ("small_data_003", 25.2),
            ("archive_data_004", 300.0),  # 归档文件
            ("temp_data_005", 10.8)
        ]
        
        # 优先选择大文件进行迁移以最大化均衡效果
        sample_data.sort(key=lambda x: x[1], reverse=True)
        return sample_data
    
    def _select_capacity_target_node(self, low_capacity_nodes: List[Dict]) -> Dict:
        """
        选择容量目标节点
        :param low_capacity_nodes: 低容量节点列表
        :return: 目标节点信息
        """
        if not low_capacity_nodes:
            return {}
        
        # 选择容量使用率最低的节点
        return min(low_capacity_nodes, key=lambda x: x["utilization"])
    
    def _estimate_migration_impact(self, source_node: Dict, target_node: Dict, 
                                 data_size_gb: float) -> Dict:
        """
        估计迁移影响
        :param source_node: 源节点信息
        :param target_node: 目标节点信息
        :param data_size_gb: 数据大小(GB)
        :return: 影响估计
        """
        # 计算迁移后的新使用率
        source_new_utilization = (source_node["used_gb"] - data_size_gb) / (
            source_node["used_gb"] / source_node["utilization"]
        ) if source_node["utilization"] > 0 else 0
        
        target_capacity_gb = target_node["used_gb"] / target_node["utilization"] if target_node["utilization"] > 0 else 10000
        target_new_utilization = (target_node["used_gb"] + data_size_gb) / target_capacity_gb
        
        # 计算均衡改善
        source_improvement = source_node["utilization"] - source_new_utilization
        target_increase = target_new_utilization - target_node["utilization"]
        
        return {
            "source_utilization_change": -source_improvement,
            "target_utilization_change": target_increase,
            "net_improvement": source_improvement - target_increase,
            "source_new_utilization": source_new_utilization,
            "target_new_utilization": target_new_utilization
        }
    
    def _calculate_capacity_priority(self, source_node: Dict, target_node: Dict, 
                                   data_size_gb: float) -> float:
        """
        计算容量均衡优先级
        :param source_node: 源节点信息
        :param target_node: 目标节点信息
        :param data_size_gb: 数据大小(GB)
        :return: 优先级分数
        """
        # 优先级基于源节点超载程度和数据大小
        source_overload = max(0, source_node["utilization"] - 0.8)  # 超过80%的部分
        priority = source_overload * 0.7 + (data_size_gb / 100) * 0.3
        return priority

# 使用示例
print("\n=== 容量均衡策略 ===")

# 创建容量均衡器
capacity_balancer = CapacityBalancer(capacity_monitor)

# 分析容量分布
capacity_analysis = capacity_balancer.analyze_capacity_distribution()
print(f"容量分布分析:")
print(f"  平均使用率: {capacity_analysis['average_utilization']:.1%}")
print(f"  最高使用率: {capacity_analysis['max_utilization']:.1%}")
print(f"  最低使用率: {capacity_analysis['min_utilization']:.1%}")
print(f"  使用率范围: {capacity_analysis['utilization_range']:.1%}")
print(f"  不均衡比率: {capacity_analysis['imbalance_ratio']:.2f}")
print(f"  是否均衡: {capacity_analysis['is_balanced']}")

# 显示节点按使用率排序
print(f"  节点使用率排序:")
for node in capacity_analysis["nodes_by_utilization"]:
    print(f"    {node['node_id']}: {node['utilization']:.1%} "
          f"(可用: {node['available_gb']:.0f} GB)")

# 识别容量不平衡
high_capacity_nodes, low_capacity_nodes = capacity_balancer.identify_capacity_imbalances()
print(f"\n容量不平衡识别:")
print(f"  高容量节点 ({len(high_capacity_nodes)}个):")
for node in high_capacity_nodes:
    print(f"    {node['node_id']}: {node['utilization']:.1%}")

print(f"  低容量节点 ({len(low_capacity_nodes)}个):")
for node in low_capacity_nodes:
    print(f"    {node['node_id']}: {node['utilization']:.1%}")

# 生成容量均衡计划
balancing_plan = capacity_balancer.generate_capacity_balancing_plan(max_migrations=3)
print(f"\n容量均衡计划:")
for i, plan in enumerate(balancing_plan, 1):
    print(f"  {i}. {plan['action']} {plan['data_id']}")
    print(f"     从 {plan['source_node']} ({plan['estimated_impact']['source_new_utilization']:.1%}) "
          f"迁移到 {plan['target_node']} ({plan['estimated_impact']['target_new_utilization']:.1%})")
    print(f"     数据大小: {plan['data_size_gb']} GB")
    print(f"     优先级: {plan['priority']:.3f}")
    print(f"     净改善: {plan['estimated_impact']['net_improvement']:.1%}")
```

## 6.1.4.4 坏盘处理机制

坏盘处理是分布式存储系统中保障数据可靠性和系统稳定性的关键机制。

### 6.1.4.4.1 磁盘故障检测

```python
# 磁盘故障检测系统
import hashlib
import time
from typing import Dict, List, Tuple
from enum import Enum
from dataclasses import dataclass

class DiskHealthStatus(Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    FAILING = "failing"
    FAILED = "failed"

@dataclass
class DiskHealthMetrics:
    disk_id: str
    node_id: str
    status: DiskHealthStatus
    temperature: float
    read_errors: int
    write_errors: int
    reallocated_sectors: int
    pending_sectors: int
    spin_retry_count: int
    seek_time: float
    last_check_time: float
    health_score: float

class DiskFailureDetector:
    def __init__(self):
        self.disk_health_metrics = {}
        self.failure_history = []
        self.health_thresholds = {
            "temperature_max": 50.0,  # 摄氏度
            "read_errors_threshold": 10,
            "write_errors_threshold": 10,
            "reallocated_sectors_threshold": 5,
            "pending_sectors_threshold": 1,
            "spin_retry_threshold": 5,
            "seek_time_threshold": 20.0  # 毫秒
        }
    
    def update_disk_metrics(self, disk_id: str, node_id: str, metrics: Dict):
        """
        更新磁盘健康指标
        :param disk_id: 磁盘ID
        :param node_id: 节点ID
        :param metrics: 健康指标
        """
        # 计算健康分数
        health_score = self._calculate_health_score(metrics)
        
        # 确定健康状态
        status = self._determine_disk_status(metrics, health_score)
        
        # 更新健康指标
        self.disk_health_metrics[disk_id] = DiskHealthMetrics(
            disk_id=disk_id,
            node_id=node_id,
            status=status,
            temperature=metrics.get("temperature", 0),
            read_errors=metrics.get("read_errors", 0),
            write_errors=metrics.get("write_errors", 0),
            reallocated_sectors=metrics.get("reallocated_sectors", 0),
            pending_sectors=metrics.get("pending_sectors", 0),
            spin_retry_count=metrics.get("spin_retry_count", 0),
            seek_time=metrics.get("seek_time", 0),
            last_check_time=time.time(),
            health_score=health_score
        )
    
    def _calculate_health_score(self, metrics: Dict) -> float:
        """
        计算磁盘健康分数 (0-100, 越高越健康)
        :param metrics: 健康指标
        :return: 健康分数
        """
        # 基于各项指标计算健康分数
        temperature_score = max(0, 100 - max(0, (metrics.get("temperature", 0) - 30) * 5))
        read_error_score = max(0, 100 - (metrics.get("read_errors", 0) * 10))
        write_error_score = max(0, 100 - (metrics.get("write_errors", 0) * 10))
        reallocated_score = max(0, 100 - (metrics.get("reallocated_sectors", 0) * 20))
        pending_score = max(0, 100 - (metrics.get("pending_sectors", 0) * 50))
        spin_retry_score = max(0, 100 - (metrics.get("spin_retry_count", 0) * 20))
        seek_time_score = max(0, 100 - max(0, (metrics.get("seek_time", 0) - 10) * 5))
        
        # 加权平均
        health_score = (
            temperature_score * 0.15 +
            read_error_score * 0.15 +
            write_error_score * 0.15 +
            reallocated_score * 0.2 +
            pending_score * 0.1 +
            spin_retry_score * 0.1 +
            seek_time_score * 0.15
        )
        
        return min(health_score, 100)
    
    def _determine_disk_status(self, metrics: Dict, health_score: float) -> DiskHealthStatus:
        """
        确定磁盘状态
        :param metrics: 健康指标
        :param health_score: 健康分数
        :return: 磁盘状态
        """
        # 检查是否已经失败
        if (metrics.get("read_errors", 0) > self.health_thresholds["read_errors_threshold"] * 2 or
            metrics.get("write_errors", 0) > self.health_thresholds["write_errors_threshold"] * 2 or
            metrics.get("reallocated_sectors", 0) > self.health_thresholds["reallocated_sectors_threshold"] * 3 or
            metrics.get("pending_sectors", 0) > self.health_thresholds["pending_sectors_threshold"] * 5):
            return DiskHealthStatus.FAILED
        
        # 检查是否即将失败
        if (metrics.get("read_errors", 0) > self.health_thresholds["read_errors_threshold"] or
            metrics.get("write_errors", 0) > self.health_thresholds["write_errors_threshold"] or
            metrics.get("reallocated_sectors", 0) > self.health_thresholds["reallocated_sectors_threshold"] or
            metrics.get("pending_sectors", 0) > self.health_thresholds["pending_sectors_threshold"] or
            metrics.get("temperature", 0) > self.health_thresholds["temperature_max"] or
            health_score < 30):
            return DiskHealthStatus.FAILING
        
        # 检查是否降级
        if (metrics.get("spin_retry_count", 0) > self.health_thresholds["spin_retry_threshold"] or
            metrics.get("seek_time", 0) > self.health_thresholds["seek_time_threshold"] or
            health_score < 60):
            return DiskHealthStatus.DEGRADED
        
        # 健康状态
        return DiskHealthStatus.HEALTHY
    
    def get_disk_health_status(self, disk_id: str) -> Dict:
        """
        获取磁盘健康状态
        :param disk_id: 磁盘ID
        :return: 健康状态信息
        """
        if disk_id not in self.disk_health_metrics:
            return {"error": "Disk not found"}
        
        metrics = self.disk_health_metrics[disk_id]
        return {
            "disk_id": metrics.disk_id,
            "node_id": metrics.node_id,
            "status": metrics.status.value,
            "health_score": metrics.health_score,
            "temperature": metrics.temperature,
            "read_errors": metrics.read_errors,
            "write_errors": metrics.write_errors,
            "reallocated_sectors": metrics.reallocated_sectors,
            "pending_sectors": metrics.pending_sectors,
            "spin_retry_count": metrics.spin_retry_count,
            "seek_time": metrics.seek_time,
            "last_check_time": metrics.last_check_time,
            "recommendations": self._generate_health_recommendations(metrics)
        }
    
    def _generate_health_recommendations(self, metrics: DiskHealthMetrics) -> List[str]:
        """
        生成健康建议
        :param metrics: 磁盘指标
        :return: 建议列表
        """
        recommendations = []
        
        if metrics.status == DiskHealthStatus.FAILED:
            recommendations.append("磁盘已失败，需要立即更换")
            recommendations.append("停止使用该磁盘，防止数据丢失")
        elif metrics.status == DiskHealthStatus.FAILING:
            recommendations.append("磁盘即将失败，建议尽快备份数据并更换磁盘")
            recommendations.append("增加监控频率，准备应急方案")
        elif metrics.status == DiskHealthStatus.DEGRADED:
            recommendations.append("磁盘性能下降，建议关注后续健康状况")
            recommendations.append("考虑在维护窗口期进行检查")
        
        # 具体建议
        if metrics.temperature > self.health_thresholds["temperature_max"]:
            recommendations.append(f"磁盘温度过高 ({metrics.temperature}°C)，改善散热")
        
        if metrics.read_errors > self.health_thresholds["read_errors_threshold"]:
            recommendations.append(f"读取错误过多 ({metrics.read_errors})，检查连接和磁盘表面")
        
        if metrics.reallocated_sectors > self.health_thresholds["reallocated_sectors_threshold"]:
            recommendations.append(f"重新分配扇区过多 ({metrics.reallocated_sectors})，磁盘可能出现坏道")
        
        if metrics.pending_sectors > self.health_thresholds["pending_sectors_threshold"]:
            recommendations.append(f"待处理扇区 ({metrics.pending_sectors})，需要立即关注")
        
        return recommendations
    
    def get_failing_disks(self) -> List[Dict]:
        """
        获取即将失败的磁盘列表
        :return: 即将失败的磁盘信息列表
        """
        failing_disks = []
        for disk_id, metrics in self.disk_health_metrics.items():
            if metrics.status in [DiskHealthStatus.FAILING, DiskHealthStatus.FAILED]:
                failing_disks.append(self.get_disk_health_status(disk_id))
        return failing_disks
    
    def predict_disk_failures(self, prediction_window_hours: float = 24) -> List[Dict]:
        """
        预测磁盘故障
        :param prediction_window_hours: 预测时间窗口（小时）
        :return: 预测的故障磁盘列表
        """
        predicted_failures = []
        current_time = time.time()
        
        for disk_id, metrics in self.disk_health_metrics.items():
            # 基于健康分数下降趋势预测
            if metrics.health_score < 40:
                # 计算健康分数下降速度
                # 简化处理：假设持续下降
                time_to_failure_hours = max(1, metrics.health_score * 0.5)
                
                if time_to_failure_hours <= prediction_window_hours:
                    predicted_failures.append({
                        "disk_id": disk_id,
                        "node_id": metrics.node_id,
                        "predicted_failure_time_hours": time_to_failure_hours,
                        "current_health_score": metrics.health_score,
                        "urgency": "high" if time_to_failure_hours < 6 else "medium"
                    })
        
        return predicted_failures

# 使用示例
print("\n=== 磁盘故障检测 ===")

# 创建磁盘故障检测器
disk_detector = DiskFailureDetector()

# 模拟磁盘健康数据更新
disk_health_data = [
    {
        "disk_id": "disk1_node1",
        "node_id": "node1",
        "metrics": {
            "temperature": 42.5,
            "read_errors": 2,
            "write_errors": 1,
            "reallocated_sectors": 0,
            "pending_sectors": 0,
            "spin_retry_count": 0,
            "seek_time": 12.5
        }
    },
    {
        "disk_id": "disk2_node1",
        "node_id": "node1",
        "metrics": {
            "temperature": 55.0,  # 温度过高
            "read_errors": 15,    # 读取错误过多
            "write_errors": 8,
            "reallocated_sectors": 3,
            "pending_sectors": 1,  # 有待处理扇区
            "spin_retry_count": 3,
            "seek_time": 25.0     # 寻道时间过长
        }
    },
    {
        "disk_id": "disk1_node2",
        "node_id": "node2",
        "metrics": {
            "temperature": 48.0,
            "read_errors": 25,    # 读取错误严重
            "write_errors": 12,
            "reallocated_sectors": 8,   # 重新分配扇区过多
            "pending_sectors": 2,       # 有待处理扇区
            "spin_retry_count": 7,
            "seek_time": 35.0           # 寻道时间很长
        }
    },
    {
        "disk_id": "disk1_node3",
        "node_id": "node3",
        "metrics": {
            "temperature": 38.0,
            "read_errors": 0,
            "write_errors": 0,
            "reallocated_sectors": 0,
            "pending_sectors": 0,
            "spin_retry_count": 0,
            "seek_time": 8.5
        }
    }
]

print("更新磁盘健康指标...")
for data in disk_health_data:
    disk_detector.update_disk_metrics(
        data["disk_id"],
        data["node_id"],
        data["metrics"]
    )
    
    health_status = disk_detector.get_disk_health_status(data["disk_id"])
    print(f"  {data['disk_id']}: 状态 {health_status['status']}, "
          f"健康分数 {health_status['health_score']:.1f}")
    print(f"    温度: {health_status['temperature']:.1f}°C, "
          f"读取错误: {health_status['read_errors']}, "
          f"写入错误: {health_status['write_errors']}")
    
    if health_status["recommendations"]:
        print(f"    建议: {', '.join(health_status['recommendations'][:2])}")  # 只显示前两条建议

# 获取即将失败的磁盘
failing_disks = disk_detector.get_failing_disks()
print(f"\n即将失败的磁盘 ({len(failing_disks)}个):")
for disk in failing_disks:
    print(f"  {disk['disk_id']}: {disk['status']}, 健康分数 {disk['health_score']:.1f}")
    if disk['recommendations']:
        print(f"    建议: {', '.join(disk['recommendations'][:2])}")

# 预测磁盘故障
predicted_failures = disk_detector.predict_disk_failures(prediction_window_hours=48)
print(f"\n预测故障磁盘 ({len(predicted_failures)}个):")
for failure in predicted_failures:
    print(f"  {failure['disk_id']}: 预计 {failure['predicted_failure_time_hours']:.1f} 小后失败, "
          f"紧急程度: {failure['urgency']}")
```

### 6.1.4.4.2 数据恢复与重建

```python
# 数据恢复与重建机制
import threading
import time
import queue
from typing import Dict, List, Callable
from dataclasses import dataclass

@dataclass
class RecoveryTask:
    task_id: str
    disk_id: str
    node_id: str
    data_blocks: List[str]  # 需要恢复的数据块ID列表
    priority: int  # 恢复优先级
    status: str  # "pending", "running", "completed", "failed"
    start_time: float
    estimated_duration: float

class DataRecoveryManager:
    def __init__(self, disk_detector: DiskFailureDetector):
        self.disk_detector = disk_detector
        self.recovery_tasks = {}
        self.recovery_queue = queue.PriorityQueue()
        self.recovery_workers = []
        self.max_concurrent_recoveries = 3
        self.recovery_lock = threading.Lock()
        self.recovery_callbacks = []
        
        # 启动恢复工作线程
        self._start_recovery_workers()
    
    def _start_recovery_workers(self):
        """启动恢复工作线程"""
        for i in range(self.max_concurrent_recoveries):
            worker = threading.Thread(target=self._recovery_worker, daemon=True, 
                                    name=f"RecoveryWorker-{i}")
            worker.start()
            self.recovery_workers.append(worker)
    
    def register_recovery_callback(self, callback: Callable):
        """注册恢复回调函数"""
        self.recovery_callbacks.append(callback)
    
    def initiate_recovery(self, disk_id: str, node_id: str, 
                         data_blocks: List[str], priority: int = 1) -> str:
        """
        启动数据恢复
        :param disk_id: 磁盘ID
        :param node_id: 节点ID
        :param data_blocks: 需要恢复的数据块ID列表
        :param priority: 恢复优先级
        :return: 任务ID
        """
        task_id = f"recovery_{disk_id}_{int(time.time())}"
        
        # 估算恢复时间（简化模型）
        estimated_duration = len(data_blocks) * 0.5  # 假设每个块0.5秒
        
        recovery_task = RecoveryTask(
            task_id=task_id,
            disk_id=disk_id,
            node_id=node_id,
            data_blocks=data_blocks,
            priority=priority,
            status="pending",
            start_time=time.time(),
            estimated_duration=estimated_duration
        )
        
        with self.recovery_lock:
            self.recovery_tasks[task_id] = recovery_task
            # 使用负优先级因为PriorityQueue是小顶堆
            self.recovery_queue.put((-priority, task_id))
        
        print(f"启动恢复任务 {task_id}，包含 {len(data_blocks)} 个数据块")
        
        # 触发回调
        for callback in self.recovery_callbacks:
            try:
                callback("task_created", recovery_task)
            except Exception as e:
                print(f"回调执行错误: {e}")
        
        return task_id
    
    def _recovery_worker(self):
        """恢复工作线程"""
        while True:
            try:
                # 获取恢复任务
                priority, task_id = self.recovery_queue.get(timeout=1.0)
                
                with self.recovery_lock:
                    if task_id not in self.recovery_tasks:
                        self.recovery_queue.task_done()
                        continue
                    
                    task = self.recovery_tasks[task_id]
                    task.status = "running"
                
                # 执行恢复
                success = self._execute_recovery(task)
                
                # 更新任务状态
                with self.recovery_lock:
                    if task_id in self.recovery_tasks:
                        task = self.recovery_tasks[task_id]
                        task.status = "completed" if success else "failed"
                        task.estimated_duration = time.time() - task.start_time
                
                # 触发回调
                for callback in self.recovery_callbacks:
                    try:
                        callback("task_completed" if success else "task_failed", task)
                    except Exception as e:
                        print(f"回调执行错误: {e}")
                
                self.recovery_queue.task_done()
                
            except queue.Empty:
                continue
            except Exception as e:
                print(f"恢复工作线程错误: {e}")
    
    def _execute_recovery(self, task: RecoveryTask) -> bool:
        """
        执行数据恢复
        :param task: 恢复任务
        :return: 是否成功
        """
        print(f"开始执行恢复任务 {task.task_id}")
        
        try:
            # 模拟恢复过程
            for i, block_id in enumerate(task.data_blocks):
                # 模拟恢复时间
                time.sleep(0.1)  # 每个块0.1秒
                
                # 模拟恢复进度
                progress = (i + 1) / len(task.data_blocks) * 100
                if i % 10 == 0 or i == len(task.data_blocks) - 1:  # 每10个块或最后块报告进度
                    print(f"  恢复进度: {progress:.1f}% ({i+1}/{len(task.data_blocks)})")
                
                # 模拟可能的恢复失败
                if i == len(task.data_blocks) // 2 and random.random() < 0.1:  # 10%概率在中间失败
                    raise Exception("模拟恢复失败")
            
            print(f"恢复任务 {task.task_id} 完成")
            return True
            
        except Exception as e:
            print(f"恢复任务 {task.task_id} 失败: {e}")
            return False
    
    def get_recovery_status(self, task_id: str = None) -> Dict:
        """
        获取恢复状态
        :param task_id: 任务ID，如果为None则返回所有任务状态
        :return: 恢复状态信息
        """
        with self.recovery_lock:
            if task_id:
                if task_id not in self.recovery_tasks:
                    return {"error": "Task not found"}
                task = self.recovery_tasks[task_id]
                return {
                    "task_id": task.task_id,
                    "disk_id": task.disk_id,
                    "node_id": task.node_id,
                    "status": task.status,
                    "progress": self._calculate_progress(task),
                    "start_time": task.start_time,
                    "duration": time.time() - task.start_time,
                    "estimated_duration": task.estimated_duration,
                    "data_blocks_count": len(task.data_blocks)
                }
            else:
                # 返回所有任务状态
                tasks_status = []
                for task in self.recovery_tasks.values():
                    tasks_status.append({
                        "task_id": task.task_id,
                        "disk_id": task.disk_id,
                        "node_id": task.node_id,
                        "status": task.status,
                        "progress": self._calculate_progress(task),
                        "data_blocks_count": len(task.data_blocks)
                    })
                return {"tasks": tasks_status}
    
    def _calculate_progress(self, task: RecoveryTask) -> float:
        """计算恢复进度"""
        if task.status == "completed":
            return 100.0
        elif task.status == "failed":
            return 0.0
        elif task.status == "running":
            # 简化进度计算
            elapsed = time.time() - task.start_time
            return min(99.0, (elapsed / task.estimated_duration) * 100)
        else:
            return 0.0
    
    def cancel_recovery(self, task_id: str) -> bool:
        """
        取消恢复任务
        :param task_id: 任务ID
        :return: 是否成功取消
        """
        with self.recovery_lock:
            if task_id not in self.recovery_tasks:
                return False
            
            task = self.recovery_tasks[task_id]
            if task.status == "running":
                # 正在运行的任务无法取消
                return False
            
            # 从队列中移除任务
            temp_queue = queue.PriorityQueue()
            while not self.recovery_queue.empty():
                try:
                    priority, queue_task_id = self.recovery_queue.get_nowait()
                    if queue_task_id != task_id:
                        temp_queue.put((priority, queue_task_id))
                except queue.Empty:
                    break
            
            self.recovery_queue = temp_queue
            del self.recovery_tasks[task_id]
            
            # 触发回调
            for callback in self.recovery_callbacks:
                try:
                    callback("task_cancelled", task)
                except Exception as e:
                    print(f"回调执行错误: {e}")
            
            return True

# 使用示例
print("\n=== 数据恢复与重建 ===")

# 创建数据恢复管理器
recovery_manager = DataRecoveryManager(disk_detector)

# 注册恢复回调
def recovery_callback(event: str, task: RecoveryTask):
    print(f"恢复回调 - 事件: {event}, 任务: {task.task_id}, 状态: {task.status}")

recovery_manager.register_recovery_callback(recovery_callback)

# 模拟启动恢复任务
print("启动数据恢复任务...")

# 为即将失败的磁盘启动恢复
failing_disks = disk_detector.get_failing_disks()
recovery_tasks = []

for disk in failing_disks:
    # 模拟需要恢复的数据块
    data_blocks = [f"block_{disk['disk_id']}_{i}" for i in range(50)]
    
    # 启动恢复任务
    task_id = recovery_manager.initiate_recovery(
        disk_id=disk["disk_id"],
        node_id=disk["node_id"],
        data_blocks=data_blocks,
        priority=1 if disk["status"] == "failed" else 2  # 失败磁盘优先级更高
    )
    
    recovery_tasks.append(task_id)
    print(f"  为磁盘 {disk['disk_id']} 启动恢复任务 {task_id}")

# 监控恢复进度
print("\n监控恢复进度...")
for _ in range(20):  # 监控20次
    time.sleep(1)  # 每秒检查一次
    
    for task_id in recovery_tasks:
        status = recovery_manager.get_recovery_status(task_id)
        if "error" not in status:
            print(f"  任务 {task_id}: 状态 {status['status']}, 进度 {status['progress']:.1f}%")
    
    # 检查是否所有任务都完成
    all_completed = True
    for task_id in recovery_tasks:
        status = recovery_manager.get_recovery_status(task_id)
        if "error" not in status and status["status"] not in ["completed", "failed"]:
            all_completed = False
            break
    
    if all_completed:
        break

# 获取最终恢复状态
print("\n最终恢复状态:")
for task_id in recovery_tasks:
    status = recovery_manager.get_recovery_status(task_id)
    if "error" not in status:
        print(f"  任务 {task_id}: {status['status']}, "
              f"耗时 {status['duration']:.1f}秒, "
              f"数据块数 {status['data_blocks_count']}")
```

## 总结

数据均衡与迁移是分布式文件存储平台中确保高性能、高可用性和资源有效利用的关键机制。通过本章的深入探讨，我们了解了以下核心内容：

1. **数据均衡的重要性**：负载不均衡会导致性能下降、资源浪费和用户体验不佳，通过量化分析可以清楚地看到均衡带来的性能提升。

2. **热点调度策略**：通过智能的热点识别算法和动态调度机制，可以有效缓解访问热点，确保系统负载均匀分布。

3. **容量均衡算法**：基于容量监控和预测的均衡策略能够预防容量不足问题，确保各节点资源利用率相对均匀。

4. **坏盘处理机制**：完善的磁盘故障检测、预测和数据恢复机制是保障数据可靠性和系统稳定性的关键。

在实际工程应用中，需要注意以下要点：

- **平衡性能与成本**：迁移操作会消耗系统资源，需要在均衡效果和系统性能之间找到平衡点。
- **渐进式实施**：大规模的均衡操作应该分批进行，避免对系统造成过大冲击。
- **完善的监控体系**：建立全面的监控和告警机制，及时发现和处理各种异常情况。
- **自动化运维**：通过智能化的调度算法和自动化工具，减少人工干预，提高运维效率。

通过合理设计和实现这些机制，分布式文件存储平台能够在不断变化的负载和数据分布情况下，始终保持良好的性能和可靠性。