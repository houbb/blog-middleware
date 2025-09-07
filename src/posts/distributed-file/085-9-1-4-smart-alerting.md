---
title: "智能告警:阈值设定、告警收敛、根因分析"
date: 2025-09-07
categories: [DistributedFile]
tags: [DistributedFile]
published: true
---
在分布式文件存储平台中，随着系统规模的扩大和复杂性的增加，传统的基于固定阈值的简单告警机制已经无法满足现代运维的需求。大量的告警信息不仅会造成"告警疲劳"，还可能掩盖真正重要的问题。因此，构建一个智能的告警系统成为保障系统稳定性和提升运维效率的关键。

## 9.4.1 告警阈值设定

合理的告警阈值设定是智能告警系统的基础，它需要在及时发现问题和避免误报之间找到平衡点。

### 9.4.1.1 基于历史数据的动态阈值

```python
# 基于历史数据的动态阈值设定
import numpy as np
from typing import List, Tuple, Dict, Any
from datetime import datetime, timedelta
import statistics

class DynamicThresholdCalculator:
    """动态阈值计算器"""
    
    def __init__(self, window_size_hours: int = 24):
        self.window_size_hours = window_size_hours
        self.metrics_history = {}
    
    def add_metric_data(self, metric_name: str, value: float, timestamp: datetime = None):
        """添加指标数据"""
        if timestamp is None:
            timestamp = datetime.now()
        
        if metric_name not in self.metrics_history:
            self.metrics_history[metric_name] = []
        
        self.metrics_history[metric_name].append({
            "value": value,
            "timestamp": timestamp
        })
        
        # 清理过期数据
        self._cleanup_old_data(metric_name)
    
    def _cleanup_old_data(self, metric_name: str):
        """清理过期数据"""
        cutoff_time = datetime.now() - timedelta(hours=self.window_size_hours)
        self.metrics_history[metric_name] = [
            data for data in self.metrics_history[metric_name]
            if data["timestamp"] >= cutoff_time
        ]
    
    def calculate_dynamic_thresholds(self, metric_name: str) -> Dict[str, float]:
        """计算动态阈值"""
        if metric_name not in self.metrics_history:
            return {"error": "无历史数据"}
        
        values = [data["value"] for data in self.metrics_history[metric_name]]
        if len(values) < 10:  # 至少需要10个数据点
            return {"error": "数据不足"}
        
        # 计算基本统计信息
        mean_val = statistics.mean(values)
        std_val = statistics.stdev(values) if len(values) > 1 else 0
        
        # 基于3σ原则计算阈值
        warning_threshold = mean_val + 2 * std_val
        critical_threshold = mean_val + 3 * std_val
        
        # 考虑季节性因素（简化实现）
        recent_values = values[-24:] if len(values) >= 24 else values
        recent_mean = statistics.mean(recent_values)
        
        # 动态调整阈值
        adjusted_warning = warning_threshold * (recent_mean / mean_val) if mean_val > 0 else warning_threshold
        adjusted_critical = critical_threshold * (recent_mean / mean_val) if mean_val > 0 else critical_threshold
        
        return {
            "mean": mean_val,
            "std": std_val,
            "warning_threshold": max(adjusted_warning, mean_val * 1.1),  # 至少比平均值高10%
            "critical_threshold": max(adjusted_critical, mean_val * 1.5),  # 至少比平均值高50%
            "data_points": len(values)
        }
    
    def detect_anomalies(self, metric_name: str, current_value: float) -> Dict[str, Any]:
        """检测异常"""
        thresholds = self.calculate_dynamic_thresholds(metric_name)
        
        if "error" in thresholds:
            return thresholds
        
        severity = "normal"
        if current_value >= thresholds["critical_threshold"]:
            severity = "critical"
        elif current_value >= thresholds["warning_threshold"]:
            severity = "warning"
        
        return {
            "metric_name": metric_name,
            "current_value": current_value,
            "severity": severity,
            "thresholds": thresholds
        }

# 使用示例
def demonstrate_dynamic_thresholds():
    """演示动态阈值"""
    calculator = DynamicThresholdCalculator(window_size_hours=24)
    
    # 模拟添加历史数据（CPU使用率）
    import random
    for i in range(100):
        # 模拟正常情况下的CPU使用率（平均60%，标准差10%）
        cpu_usage = random.normalvariate(60, 10)
        cpu_usage = max(0, min(100, cpu_usage))  # 限制在0-100之间
        timestamp = datetime.now() - timedelta(hours=24 * (100 - i) / 100)
        calculator.add_metric_data("cpu_utilization", cpu_usage, timestamp)
    
    # 计算动态阈值
    thresholds = calculator.calculate_dynamic_thresholds("cpu_utilization")
    print("CPU使用率动态阈值:")
    print(f"  平均值: {thresholds['mean']:.2f}%")
    print(f"  警告阈值: {thresholds['warning_threshold']:.2f}%")
    print(f"  严重阈值: {thresholds['critical_threshold']:.2f}%")
    
    # 检测异常
    test_values = [55, 75, 85, 95]
    for value in test_values:
        anomaly = calculator.detect_anomalies("cpu_utilization", value)
        print(f"  CPU使用率 {value}%: {anomaly['severity']}")

# 运行演示
# demonstrate_dynamic_thresholds()
```

### 9.4.1.2 多维度阈值设定

```python
# 多维度阈值设定
from typing import Dict, Any, List
import json

class MultiDimensionalThresholdManager:
    """多维度阈值管理器"""
    
    def __init__(self):
        self.thresholds = {}
        self.dimension_weights = {}
    
    def set_threshold(self, metric_name: str, dimensions: Dict[str, str], 
                     warning_threshold: float, critical_threshold: float,
                     weight: float = 1.0):
        """设置多维度阈值"""
        key = self._generate_key(metric_name, dimensions)
        self.thresholds[key] = {
            "metric_name": metric_name,
            "dimensions": dimensions,
            "warning_threshold": warning_threshold,
            "critical_threshold": critical_threshold
        }
        self.dimension_weights[key] = weight
    
    def _generate_key(self, metric_name: str, dimensions: Dict[str, str]) -> str:
        """生成键值"""
        dim_str = ",".join([f"{k}={v}" for k, v in sorted(dimensions.items())])
        return f"{metric_name}[{dim_str}]"
    
    def get_threshold(self, metric_name: str, dimensions: Dict[str, str]) -> Dict[str, Any]:
        """获取匹配的阈值"""
        # 精确匹配
        exact_key = self._generate_key(metric_name, dimensions)
        if exact_key in self.thresholds:
            return self.thresholds[exact_key]
        
        # 模糊匹配（部分维度匹配）
        best_match = None
        best_match_count = 0
        
        for key, threshold in self.thresholds.items():
            if threshold["metric_name"] == metric_name:
                match_count = self._count_dimension_matches(dimensions, threshold["dimensions"])
                if match_count > best_match_count:
                    best_match = threshold
                    best_match_count = match_count
        
        return best_match or {"error": "未找到匹配的阈值"}
    
    def _count_dimension_matches(self, query_dims: Dict[str, str], 
                               threshold_dims: Dict[str, str]) -> int:
        """计算维度匹配数量"""
        count = 0
        for key, value in query_dims.items():
            if key in threshold_dims and threshold_dims[key] == value:
                count += 1
        return count
    
    def evaluate_multi_dimensional_alert(self, metric_name: str, 
                                       dimensions: Dict[str, str],
                                       current_value: float) -> Dict[str, Any]:
        """评估多维度告警"""
        threshold = self.get_threshold(metric_name, dimensions)
        
        if "error" in threshold:
            return threshold
        
        severity = "normal"
        if current_value >= threshold["critical_threshold"]:
            severity = "critical"
        elif current_value >= threshold["warning_threshold"]:
            severity = "warning"
        
        return {
            "metric_name": metric_name,
            "dimensions": dimensions,
            "current_value": current_value,
            "severity": severity,
            "threshold": threshold
        }

# 使用示例
def demonstrate_multi_dimensional_thresholds():
    """演示多维度阈值"""
    manager = MultiDimensionalThresholdManager()
    
    # 设置不同维度的阈值
    manager.set_threshold(
        "disk_io_latency", 
        {"node_type": "storage", "disk_type": "ssd"},
        warning_threshold=50.0,
        critical_threshold=100.0
    )
    
    manager.set_threshold(
        "disk_io_latency", 
        {"node_type": "storage", "disk_type": "hdd"},
        warning_threshold=100.0,
        critical_threshold=200.0
    )
    
    manager.set_threshold(
        "disk_io_latency", 
        {"node_type": "compute"},
        warning_threshold=20.0,
        critical_threshold=50.0
    )
    
    # 评估不同情况下的告警
    test_cases = [
        {"node_type": "storage", "disk_type": "ssd", "value": 75.0},
        {"node_type": "storage", "disk_type": "hdd", "value": 150.0},
        {"node_type": "compute", "value": 30.0},
        {"node_type": "storage", "disk_type": "nvme", "value": 40.0}  # 无精确匹配，应使用最接近的
    ]
    
    for case in test_cases:
        value = case.pop("value")
        result = manager.evaluate_multi_dimensional_alert("disk_io_latency", case, value)
        print(f"磁盘IO延迟 {value}ms 在 {case} 维度下: {result['severity']}")
        if "threshold" in result:
            print(f"  使用阈值: {result['threshold']['warning_threshold']}/{result['threshold']['critical_threshold']}")

# 运行演示
# demonstrate_multi_dimensional_thresholds()
```

## 9.4.2 告警收敛策略

告警收敛是智能告警系统的核心功能之一，旨在减少告警噪音，提高告警的有效性。

### 9.4.2.1 告警分组与聚合

```python
# 告警分组与聚合实现
from typing import Dict, List, Any
from datetime import datetime, timedelta
import hashlib
import json

class Alert:
    """告警对象"""
    
    def __init__(self, alert_id: str, title: str, content: str, 
                 severity: str, source: str, timestamp: datetime = None):
        self.alert_id = alert_id
        self.title = title
        self.content = content
        self.severity = severity
        self.source = source
        self.timestamp = timestamp or datetime.now()
        self.status = "active"  # active, suppressed, resolved
        self.suppressed_by = None

class AlertGroup:
    """告警组"""
    
    def __init__(self, group_id: str, title: str):
        self.group_id = group_id
        self.title = title
        self.alerts: List[Alert] = []
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
        self.severity = "info"
        self.suppressed = False
        self.suppression_reason = None
    
    def add_alert(self, alert: Alert):
        """添加告警到组"""
        self.alerts.append(alert)
        self.updated_at = datetime.now()
        self._update_severity()
    
    def _update_severity(self):
        """更新组的严重性"""
        severity_order = {"info": 0, "warning": 1, "error": 2, "critical": 3}
        max_severity = "info"
        
        for alert in self.alerts:
            if severity_order[alert.severity] > severity_order[max_severity]:
                max_severity = alert.severity
        
        self.severity = max_severity
    
    def get_alert_count_by_severity(self) -> Dict[str, int]:
        """按严重性统计告警数量"""
        counts = {"info": 0, "warning": 0, "error": 0, "critical": 0}
        for alert in self.alerts:
            counts[alert.severity] += 1
        return counts

class AlertAggregator:
    """告警聚合器"""
    
    def __init__(self, grouping_window_minutes: int = 5):
        self.grouping_window_minutes = grouping_window_minutes
        self.alert_groups: Dict[str, AlertGroup] = {}
        self.alert_to_group: Dict[str, str] = {}  # alert_id -> group_id
    
    def _generate_group_key(self, alert: Alert) -> str:
        """生成告警组键"""
        # 基于告警标题和来源生成组键
        key_data = f"{alert.title}|{alert.source}"
        return hashlib.md5(key_data.encode()).hexdigest()
    
    def process_alert(self, alert: Alert) -> AlertGroup:
        """处理告警并返回所属的告警组"""
        group_key = self._generate_group_key(alert)
        
        # 检查是否存在现有的告警组
        existing_group = None
        if group_key in self.alert_groups:
            group = self.alert_groups[group_key]
            # 检查是否在时间窗口内
            time_diff = alert.timestamp - group.created_at
            if time_diff <= timedelta(minutes=self.grouping_window_minutes):
                existing_group = group
        
        # 如果没有现有组或超出时间窗口，创建新组
        if existing_group is None:
            group_title = alert.title
            existing_group = AlertGroup(group_key, group_title)
            self.alert_groups[group_key] = existing_group
        
        # 将告警添加到组中
        existing_group.add_alert(alert)
        self.alert_to_group[alert.alert_id] = group_key
        
        return existing_group
    
    def get_active_groups(self) -> List[AlertGroup]:
        """获取活跃的告警组"""
        return [group for group in self.alert_groups.values() 
                if not group.suppressed and group.alerts]
    
    def suppress_group(self, group_id: str, reason: str):
        """抑制告警组"""
        if group_id in self.alert_groups:
            group = self.alert_groups[group_id]
            group.suppressed = True
            group.suppression_reason = reason
            # 抑制组内所有告警
            for alert in group.alerts:
                alert.status = "suppressed"
                alert.suppressed_by = reason

# 使用示例
def demonstrate_alert_aggregation():
    """演示告警聚合"""
    aggregator = AlertAggregator(grouping_window_minutes=5)
    
    # 创建一些相似的告警
    alerts = [
        Alert("alert-001", "磁盘使用率过高", "节点node-001磁盘使用率95%", "warning", "node-001"),
        Alert("alert-002", "磁盘使用率过高", "节点node-002磁盘使用率92%", "warning", "node-002"),
        Alert("alert-003", "磁盘使用率过高", "节点node-003磁盘使用率97%", "warning", "node-003"),
        Alert("alert-004", "CPU使用率过高", "节点node-001CPU使用率95%", "critical", "node-001"),
        Alert("alert-005", "CPU使用率过高", "节点node-002CPU使用率90%", "error", "node-002"),
    ]
    
    # 处理告警
    groups = []
    for alert in alerts:
        group = aggregator.process_alert(alert)
        groups.append(group)
        print(f"告警 '{alert.title}' 被分配到组 '{group.title}' (组ID: {group.group_id[:8]}...)")
    
    # 显示告警组统计
    print("\n告警组统计:")
    active_groups = aggregator.get_active_groups()
    for group in active_groups:
        counts = group.get_alert_count_by_severity()
        print(f"  组 '{group.title}':")
        print(f"    总告警数: {len(group.alerts)}")
        print(f"    严重性分布: {counts}")
        print(f"    最高严重性: {group.severity}")

# 运行演示
# demonstrate_alert_aggregation()
```

### 9.4.2.2 告警抑制与静默

```python
# 告警抑制与静默实现
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import re

class SuppressionRule:
    """抑制规则"""
    
    def __init__(self, rule_id: str, name: str, condition: Dict[str, Any], 
                 duration_minutes: int, description: str = ""):
        self.rule_id = rule_id
        self.name = name
        self.condition = condition
        self.duration_minutes = duration_minutes
        self.description = description
        self.created_at = datetime.now()
        self.active = True
    
    def matches_alert(self, alert: Alert) -> bool:
        """检查告警是否匹配此规则"""
        for key, value in self.condition.items():
            if key == "title_pattern":
                if not re.search(value, alert.title):
                    return False
            elif key == "source_pattern":
                if not re.search(value, alert.source):
                    return False
            elif key == "severity":
                if alert.severity != value:
                    return False
            elif key.startswith("content_"):
                content_key = key.replace("content_", "")
                if content_key in alert.content and value not in str(alert.content[content_key]):
                    return False
        return True

class MaintenanceWindow:
    """维护窗口"""
    
    def __init__(self, window_id: str, name: str, start_time: datetime, 
                 end_time: datetime, scope: Dict[str, Any], description: str = ""):
        self.window_id = window_id
        self.name = name
        self.start_time = start_time
        self.end_time = end_time
        self.scope = scope
        self.description = description
        self.active = True
    
    def is_active(self, check_time: datetime = None) -> bool:
        """检查维护窗口是否处于活动状态"""
        if not self.active:
            return False
        
        if check_time is None:
            check_time = datetime.now()
        
        return self.start_time <= check_time <= self.end_time
    
    def matches_scope(self, alert: Alert) -> bool:
        """检查告警是否在维护窗口范围内"""
        for key, value in self.scope.items():
            if key == "source_pattern":
                if not re.search(value, alert.source):
                    return False
            elif key == "node_group":
                # 简化实现，实际可能需要更复杂的匹配逻辑
                if value not in alert.source:
                    return False
        return True

class AlertSuppressionManager:
    """告警抑制管理器"""
    
    def __init__(self):
        self.suppression_rules: Dict[str, SuppressionRule] = {}
        self.maintenance_windows: Dict[str, MaintenanceWindow] = {}
        self.active_suppressions: Dict[str, Dict[str, Any]] = {}  # alert_id -> suppression_info
    
    def add_suppression_rule(self, rule: SuppressionRule):
        """添加抑制规则"""
        self.suppression_rules[rule.rule_id] = rule
    
    def add_maintenance_window(self, window: MaintenanceWindow):
        """添加维护窗口"""
        self.maintenance_windows[window.window_id] = window
    
    def should_suppress_alert(self, alert: Alert) -> Optional[Dict[str, Any]]:
        """检查是否应该抑制告警"""
        current_time = datetime.now()
        
        # 检查活动的抑制规则
        for rule in self.suppression_rules.values():
            if not rule.active:
                continue
            
            if rule.matches_alert(alert):
                return {
                    "type": "rule",
                    "rule_id": rule.rule_id,
                    "rule_name": rule.name,
                    "reason": f"匹配抑制规则: {rule.name}"
                }
        
        # 检查维护窗口
        for window in self.maintenance_windows.values():
            if not window.active:
                continue
            
            if window.is_active(current_time) and window.matches_scope(alert):
                return {
                    "type": "maintenance",
                    "window_id": window.window_id,
                    "window_name": window.name,
                    "reason": f"在维护窗口内: {window.name}"
                }
        
        # 检查临时抑制
        if alert.alert_id in self.active_suppressions:
            suppression_info = self.active_suppressions[alert.alert_id]
            if current_time <= suppression_info["expires_at"]:
                return suppression_info
            else:
                # 抑制已过期，移除它
                del self.active_suppressions[alert.alert_id]
        
        return None
    
    def temporarily_suppress_alert(self, alert_id: str, duration_minutes: int, 
                                 reason: str = "临时抑制"):
        """临时抑制告警"""
        expires_at = datetime.now() + timedelta(minutes=duration_minutes)
        self.active_suppressions[alert_id] = {
            "type": "temporary",
            "reason": reason,
            "expires_at": expires_at
        }

# 使用示例
def demonstrate_alert_suppression():
    """演示告警抑制"""
    manager = AlertSuppressionManager()
    
    # 添加抑制规则
    disk_rule = SuppressionRule(
        "rule-001",
        "磁盘维护期间忽略磁盘告警",
        {"title_pattern": "磁盘使用率.*过高", "source_pattern": ".*"},
        60,
        "在磁盘维护期间忽略磁盘使用率告警"
    )
    manager.add_suppression_rule(disk_rule)
    
    # 添加维护窗口
    maintenance_window = MaintenanceWindow(
        "maint-001",
        "夜间维护窗口",
        datetime.now() - timedelta(minutes=30),
        datetime.now() + timedelta(minutes=30),
        {"source_pattern": "node-00.*"},
        "夜间系统维护"
    )
    manager.add_maintenance_window(maintenance_window)
    
    # 创建一些告警进行测试
    alerts = [
        Alert("alert-001", "磁盘使用率过高", "节点node-001磁盘使用率95%", "warning", "node-001"),
        Alert("alert-002", "CPU使用率过高", "节点node-002CPU使用率95%", "critical", "node-002"),
        Alert("alert-003", "网络连接失败", "节点node-003无法连接到存储集群", "error", "node-003"),
    ]
    
    # 检查是否应该抑制这些告警
    for alert in alerts:
        suppression_info = manager.should_suppress_alert(alert)
        if suppression_info:
            print(f"告警 '{alert.title}' 被抑制: {suppression_info['reason']}")
        else:
            print(f"告警 '{alert.title}' 未被抑制，需要处理")

# 运行演示
# demonstrate_alert_suppression()
```

## 9.4.3 根因分析

根因分析（Root Cause Analysis, RCA）是智能告警系统的重要组成部分，能够帮助运维人员快速定位问题的根本原因。

### 9.4.3.1 基于依赖关系的根因分析

```python
# 基于依赖关系的根因分析
from typing import Dict, List, Set, Any
from datetime import datetime, timedelta
import networkx as nx

class SystemComponent:
    """系统组件"""
    
    def __init__(self, component_id: str, name: str, component_type: str):
        self.component_id = component_id
        self.name = name
        self.component_type = component_type  # e.g., 'service', 'database', 'network'
        self.status = "healthy"  # healthy, warning, error, critical
        self.last_check = datetime.now()
        self.metrics = {}

class DependencyGraph:
    """依赖图"""
    
    def __init__(self):
        self.graph = nx.DiGraph()  # 有向图，边表示依赖关系
        self.components: Dict[str, SystemComponent] = {}
    
    def add_component(self, component: SystemComponent):
        """添加组件"""
        self.components[component.component_id] = component
        self.graph.add_node(component.component_id, component=component)
    
    def add_dependency(self, from_component_id: str, to_component_id: str):
        """添加依赖关系 (from -> to 表示 from 依赖于 to)"""
        self.graph.add_edge(from_component_id, to_component_id)
    
    def update_component_status(self, component_id: str, status: str, 
                              metrics: Dict[str, Any] = None):
        """更新组件状态"""
        if component_id in self.components:
            component = self.components[component_id]
            component.status = status
            component.last_check = datetime.now()
            if metrics:
                component.metrics.update(metrics)
    
    def get_dependent_components(self, component_id: str) -> List[str]:
        """获取依赖于指定组件的所有组件"""
        return list(self.graph.predecessors(component_id))
    
    def get_dependencies(self, component_id: str) -> List[str]:
        """获取指定组件依赖的所有组件"""
        return list(self.graph.successors(component_id))

class RootCauseAnalyzer:
    """根因分析器"""
    
    def __init__(self, dependency_graph: DependencyGraph):
        self.dependency_graph = dependency_graph
        self.alerts = []
    
    def add_alert(self, alert: Alert):
        """添加告警"""
        self.alerts.append(alert)
    
    def analyze_root_causes(self) -> List[Dict[str, Any]]:
        """分析根因"""
        root_causes = []
        
        # 按时间排序告警
        sorted_alerts = sorted(self.alerts, key=lambda x: x.timestamp)
        
        # 查找可能的根因组件
        for alert in sorted_alerts:
            component_id = self._extract_component_id(alert)
            if not component_id:
                continue
            
            # 检查该组件是否为根因
            is_root_cause = self._is_root_cause(component_id, alert)
            if is_root_cause:
                # 查找受影响的组件
                affected_components = self._find_affected_components(component_id)
                
                root_causes.append({
                    "component_id": component_id,
                    "component_name": self.dependency_graph.components.get(component_id, {}).get("name", "Unknown"),
                    "alert": alert,
                    "confidence": self._calculate_confidence(component_id, alert),
                    "affected_components": affected_components,
                    "analysis_time": datetime.now()
                })
        
        # 按置信度排序
        root_causes.sort(key=lambda x: x["confidence"], reverse=True)
        return root_causes
    
    def _extract_component_id(self, alert: Alert) -> Optional[str]:
        """从告警中提取组件ID"""
        # 简化实现，实际可能需要更复杂的解析逻辑
        if "node-" in alert.source:
            return alert.source
        return None
    
    def _is_root_cause(self, component_id: str, alert: Alert) -> bool:
        """判断组件是否为根因"""
        # 检查该组件是否有上游依赖组件也出现告警
        dependencies = self.dependency_graph.get_dependencies(component_id)
        
        # 如果该组件没有依赖其他组件，可能是根因
        if not dependencies:
            return True
        
        # 检查依赖组件的状态
        for dep_id in dependencies:
            dep_component = self.dependency_graph.components.get(dep_id)
            if dep_component and dep_component.status == "healthy":
                # 如果依赖组件健康，当前组件更可能是根因
                continue
            else:
                # 如果依赖组件不健康，当前组件可能不是根因
                return False
        
        return True
    
    def _find_affected_components(self, root_component_id: str) -> List[Dict[str, Any]]:
        """查找受影响的组件"""
        affected = []
        dependent_components = self.dependency_graph.get_dependent_components(root_component_id)
        
        for component_id in dependent_components:
            component = self.dependency_graph.components.get(component_id)
            if component:
                affected.append({
                    "component_id": component_id,
                    "component_name": component.name,
                    "status": component.status
                })
        
        return affected
    
    def _calculate_confidence(self, component_id: str, alert: Alert) -> float:
        """计算根因置信度"""
        confidence = 0.5  # 基础置信度
        
        # 根据告警严重性调整置信度
        severity_weights = {"info": 0.1, "warning": 0.3, "error": 0.6, "critical": 1.0}
        confidence += severity_weights.get(alert.severity, 0)
        
        # 根据组件类型调整置信度
        component = self.dependency_graph.components.get(component_id)
        if component:
            type_weights = {"database": 1.0, "network": 0.9, "service": 0.7, "storage": 0.8}
            confidence += type_weights.get(component.component_type, 0.5)
        
        # 限制置信度在0-1之间
        return min(1.0, max(0.0, confidence))

# 使用示例
def demonstrate_root_cause_analysis():
    """演示根因分析"""
    # 创建依赖图
    dep_graph = DependencyGraph()
    
    # 添加组件
    components = [
        SystemComponent("db-master", "主数据库", "database"),
        SystemComponent("db-slave", "从数据库", "database"),
        SystemComponent("web-001", "Web服务器1", "service"),
        SystemComponent("web-002", "Web服务器2", "service"),
        SystemComponent("storage-001", "存储节点1", "storage"),
        SystemComponent("storage-002", "存储节点2", "storage"),
    ]
    
    for component in components:
        dep_graph.add_component(component)
    
    # 添加依赖关系
    dep_graph.add_dependency("web-001", "db-master")  # web-001 依赖 db-master
    dep_graph.add_dependency("web-002", "db-master")  # web-002 依赖 db-master
    dep_graph.add_dependency("db-master", "storage-001")  # db-master 依赖 storage-001
    
    # 更新组件状态
    dep_graph.update_component_status("db-master", "critical", {"connections": 0})
    dep_graph.update_component_status("web-001", "error", {"response_time": 5000})
    dep_graph.update_component_status("web-002", "error", {"response_time": 4500})
    dep_graph.update_component_status("storage-001", "healthy")
    
    # 创建分析器并添加告警
    analyzer = RootCauseAnalyzer(dep_graph)
    
    alerts = [
        Alert("alert-001", "数据库连接失败", "主数据库无法连接", "critical", "db-master"),
        Alert("alert-002", "Web服务响应超时", "Web服务器1响应时间过长", "error", "web-001"),
        Alert("alert-003", "Web服务响应超时", "Web服务器2响应时间过长", "error", "web-002"),
    ]
    
    for alert in alerts:
        analyzer.add_alert(alert)
    
    # 分析根因
    root_causes = analyzer.analyze_root_causes()
    
    print("根因分析结果:")
    for cause in root_causes:
        print(f"  可能的根因: {cause['component_name']} (置信度: {cause['confidence']:.2f})")
        print(f"    告警: {cause['alert'].title}")
        print(f"    受影响组件: {[comp['component_name'] for comp in cause['affected_components']]}")

# 运行演示
# demonstrate_root_cause_analysis()
```

### 9.4.3.2 基于机器学习的异常检测

```python
# 基于机器学习的异常检测
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from typing import List, Dict, Any, Tuple
from datetime import datetime, timedelta

class MLAnomalyDetector:
    """基于机器学习的异常检测器"""
    
    def __init__(self, contamination: float = 0.1):
        self.contamination = contamination
        self.model = IsolationForest(contamination=contamination, random_state=42)
        self.scaler = StandardScaler()
        self.is_trained = False
        self.feature_names = []
        self.history_data = []
    
    def add_history_data(self, features: List[float], timestamp: datetime = None, 
                        metadata: Dict[str, Any] = None):
        """添加历史数据"""
        if timestamp is None:
            timestamp = datetime.now()
        
        self.history_data.append({
            "features": features,
            "timestamp": timestamp,
            "metadata": metadata or {}
        })
    
    def train_model(self, feature_names: List[str]):
        """训练模型"""
        if len(self.history_data) < 10:
            raise ValueError("需要至少10个数据点来训练模型")
        
        self.feature_names = feature_names
        features_array = np.array([data["features"] for data in self.history_data])
        
        # 标准化特征
        features_scaled = self.scaler.fit_transform(features_array)
        
        # 训练模型
        self.model.fit(features_scaled)
        self.is_trained = True
        
        return True
    
    def detect_anomalies(self, features: List[float]) -> Dict[str, Any]:
        """检测异常"""
        if not self.is_trained:
            raise ValueError("模型尚未训练")
        
        # 标准化特征
        features_array = np.array([features])
        features_scaled = self.scaler.transform(features_array)
        
        # 预测
        prediction = self.model.predict(features_scaled)[0]
        anomaly_score = self.model.decision_function(features_scaled)[0]
        
        # 预测结果: 1表示正常，-1表示异常
        is_anomaly = prediction == -1
        
        return {
            "is_anomaly": is_anomaly,
            "anomaly_score": anomaly_score,
            "confidence": abs(anomaly_score),  # 置信度基于异常分数的绝对值
            "severity": self._calculate_severity(anomaly_score)
        }
    
    def _calculate_severity(self, anomaly_score: float) -> str:
        """根据异常分数计算严重性"""
        abs_score = abs(anomaly_score)
        if abs_score > 0.6:
            return "critical"
        elif abs_score > 0.4:
            return "error"
        elif abs_score > 0.2:
            return "warning"
        else:
            return "info"
    
    def get_feature_importance(self) -> List[Tuple[str, float]]:
        """获取特征重要性（简化实现）"""
        if not self.is_trained or not self.feature_names:
            return []
        
        # IsolationForest不直接提供特征重要性，这里使用一种简化的方法
        # 基于训练数据的方差来估计重要性
        features_array = np.array([data["features"] for data in self.history_data])
        variances = np.var(features_array, axis=0)
        total_var = np.sum(variances)
        
        if total_var == 0:
            return [(name, 1.0/len(self.feature_names)) for name in self.feature_names]
        
        importances = [(self.feature_names[i], variances[i]/total_var) 
                      for i in range(len(self.feature_names))]
        return sorted(importances, key=lambda x: x[1], reverse=True)

# 使用示例
def demonstrate_ml_anomaly_detection():
    """演示基于机器学习的异常检测"""
    detector = MLAnomalyDetector(contamination=0.1)
    
    # 模拟系统指标数据：[CPU使用率, 内存使用率, 磁盘IO, 网络流量]
    feature_names = ["cpu_usage", "memory_usage", "disk_io", "network_traffic"]
    
    # 添加正常的历史数据
    np.random.seed(42)
    for i in range(100):
        # 生成正常范围内的数据
        cpu = np.random.normal(60, 10)  # 平均60%，标准差10%
        memory = np.random.normal(70, 15)  # 平均70%，标准差15%
        disk_io = np.random.normal(100, 20)  # 平均100 IOPS，标准差20
        network = np.random.normal(50, 10)  # 平均50 MB/s，标准差10
        
        # 确保值在合理范围内
        cpu = max(0, min(100, cpu))
        memory = max(0, min(100, memory))
        disk_io = max(0, disk_io)
        network = max(0, network)
        
        features = [cpu, memory, disk_io, network]
        timestamp = datetime.now() - timedelta(hours=100-i)
        detector.add_history_data(features, timestamp)
    
    # 训练模型
    detector.train_model(feature_names)
    print("模型训练完成")
    
    # 检测正常数据
    normal_data = [65, 75, 95, 45]
    result = detector.detect_anomalies(normal_data)
    print(f"正常数据检测结果: 异常={result['is_anomaly']}, 严重性={result['severity']}, 置信度={result['confidence']:.3f}")
    
    # 检测异常数据
    anomaly_data = [95, 98, 500, 200]  # CPU和内存使用率极高，磁盘IO和网络流量也异常
    result = detector.detect_anomalies(anomaly_data)
    print(f"异常数据检测结果: 异常={result['is_anomaly']}, 严重性={result['severity']}, 置信度={result['confidence']:.3f}")
    
    # 获取特征重要性
    importance = detector.get_feature_importance()
    print("\n特征重要性:")
    for name, imp in importance:
        print(f"  {name}: {imp:.3f}")

# 运行演示
# demonstrate_ml_anomaly_detection()
```

通过以上实现，我们构建了一个完整的智能告警系统，包括动态阈值设定、多维度阈值管理、告警分组与聚合、告警抑制与静默、基于依赖关系的根因分析以及基于机器学习的异常检测。这些功能可以帮助运维团队更有效地管理分布式文件存储平台的监控告警，提高问题定位和解决的效率。