---
title: "可视化监控与告警中心"
date: 2025-09-07
categories: [DistributedFile]
tags: [DistributedFile]
published: true
---

在分布式文件存储平台的运维管理中，可视化监控与告警中心是确保系统稳定运行的核心组件。通过直观的可视化界面和智能化的告警机制，运维人员能够实时掌握系统状态，快速响应异常情况，有效预防潜在风险。

## 13.1.1 可视化监控系统设计

可视化监控系统需要将复杂的系统指标以直观、易懂的方式呈现给用户，帮助运维人员快速理解系统状态。

### 13.1.1.1 监控数据可视化框架

```python
# 可视化监控框架
import time
import threading
from typing import Dict, List, Any, Callable, Optional
from datetime import datetime, timedelta
import json
import random

class MonitoringDashboard:
    """监控仪表板"""
    
    def __init__(self, dashboard_name: str):
        self.dashboard_name = dashboard_name
        self.widgets = {}
        self.data_sources = {}
        self.refresh_interval = 30  # 默认30秒刷新
        self.last_refresh = None
        self.monitoring = False
    
    def add_data_source(self, source_id: str, data_func: Callable):
        """添加数据源"""
        self.data_sources[source_id] = data_func
        print(f"添加数据源: {source_id}")
    
    def add_widget(self, widget_id: str, widget_config: Dict[str, Any]):
        """添加监控小部件"""
        self.widgets[widget_id] = {
            "config": widget_config,
            "data": None,
            "last_updated": None,
            "error": None
        }
        print(f"添加监控小部件: {widget_id}")
    
    def get_widget_data(self, widget_id: str) -> Dict[str, Any]:
        """获取小部件数据"""
        if widget_id not in self.widgets:
            return {"error": "小部件不存在"}
        
        widget = self.widgets[widget_id]
        try:
            # 获取数据源
            source_id = widget["config"].get("data_source")
            if not source_id or source_id not in self.data_sources:
                return {"error": "数据源不存在"}
            
            # 获取数据
            data = self.data_sources[source_id]()
            widget["data"] = data
            widget["last_updated"] = datetime.now().isoformat()
            widget["error"] = None
            
            return {
                "widget_id": widget_id,
                "data": data,
                "timestamp": widget["last_updated"]
            }
        except Exception as e:
            widget["error"] = str(e)
            return {"error": f"获取数据失败: {e}"}
    
    def refresh_all_widgets(self) -> Dict[str, Any]:
        """刷新所有小部件"""
        results = {}
        for widget_id in self.widgets:
            results[widget_id] = self.get_widget_data(widget_id)
        self.last_refresh = datetime.now().isoformat()
        return results
    
    def start_auto_refresh(self, interval: int = 30):
        """启动自动刷新"""
        self.refresh_interval = interval
        self.monitoring = True
        
        def refresh_loop():
            while self.monitoring:
                try:
                    self.refresh_all_widgets()
                    time.sleep(self.refresh_interval)
                except Exception as e:
                    print(f"自动刷新出错: {e}")
        
        refresh_thread = threading.Thread(target=refresh_loop)
        refresh_thread.daemon = True
        refresh_thread.start()
        print(f"监控仪表板自动刷新已启动，间隔: {interval}秒")
    
    def stop_auto_refresh(self):
        """停止自动刷新"""
        self.monitoring = False
        print("监控仪表板自动刷新已停止")
    
    def get_dashboard_state(self) -> Dict[str, Any]:
        """获取仪表板状态"""
        widget_states = {}
        for widget_id, widget in self.widgets.items():
            widget_states[widget_id] = {
                "config": widget["config"],
                "last_updated": widget["last_updated"],
                "has_error": widget["error"] is not None,
                "error": widget["error"]
            }
        
        return {
            "dashboard_name": self.dashboard_name,
            "widgets": widget_states,
            "last_refresh": self.last_refresh,
            "auto_refresh_enabled": self.monitoring,
            "refresh_interval": self.refresh_interval
        }

class ChartRenderer:
    """图表渲染器"""
    
    def __init__(self):
        self.chart_types = ["line", "bar", "pie", "area", "gauge"]
    
    def render_line_chart(self, data: Dict[str, Any], config: Dict[str, Any] = None) -> str:
        """渲染折线图"""
        config = config or {}
        title = config.get("title", "折线图")
        width = config.get("width", 600)
        height = config.get("height", 400)
        
        # 生成简单的HTML图表（实际实现中会使用专业的图表库）
        html = f"<div class='chart-container' style='width: {width}px; height: {height}px;'>"
        html += f"  <h3>{title}</h3>"
        html += f"  <div class='line-chart'>"
        html += f"    数据点数: {len(data.get('values', []))}"
        html += f"  </div>"
        html += f"</div>"
        return html
    
    def render_gauge_chart(self, data: Dict[str, Any], config: Dict[str, Any] = None) -> str:
        """渲染仪表图"""
        config = config or {}
        title = config.get("title", "仪表图")
        value = data.get("value", 0)
        max_value = data.get("max", 100)
        width = config.get("width", 300)
        height = config.get("height", 200)
        
        percentage = min(100, max(0, (value / max_value) * 100))
        
        html = f"<div class='chart-container' style='width: {width}px; height: {height}px;'>"
        html += f"  <h3>{title}</h3>"
        html += f"  <div class='gauge-chart'>"
        html += f"    <div class='gauge-value'>{value}/{max_value}</div>"
        html += f"    <div class='gauge-percentage'>{percentage:.1f}%</div>"
        html += f"  </div>"
        html += f"</div>"
        return html
    
    def render_status_panel(self, data: Dict[str, Any], config: Dict[str, Any] = None) -> str:
        """渲染状态面板"""
        config = config or {}
        title = config.get("title", "状态面板")
        
        html = f"<div class='status-panel'>"
        html += f"  <h3>{title}</h3>"
        html += f"  <div class='status-items'>"
        
        for item_name, item_value in data.items():
            status_class = "status-normal"
            if isinstance(item_value, dict) and "status" in item_value:
                status = item_value["status"]
                value = item_value.get("value", "N/A")
                if status == "critical":
                    status_class = "status-critical"
                elif status == "warning":
                    status_class = "status-warning"
            else:
                value = item_value
                status = "normal"
            
            html += f"    <div class='status-item {status_class}'>"
            html += f"      <span class='item-name'>{item_name}:</span>"
            html += f"      <span class='item-value'>{value}</span>"
            html += f"    </div>"
        
        html += f"  </div>"
        html += f"</div>"
        return html

class MetricsCollector:
    """指标收集器"""
    
    def __init__(self):
        self.metrics = {}
        self.collectors = {}
    
    def add_collector(self, metric_name: str, collector_func: Callable):
        """添加指标收集器"""
        self.collectors[metric_name] = collector_func
    
    def collect_metrics(self) -> Dict[str, Any]:
        """收集所有指标"""
        collected_metrics = {}
        for metric_name, collector in self.collectors.items():
            try:
                collected_metrics[metric_name] = collector()
            except Exception as e:
                collected_metrics[metric_name] = {"error": f"收集失败: {e}"}
        self.metrics = collected_metrics
        return collected_metrics
    
    def get_metric(self, metric_name: str) -> Any:
        """获取特定指标"""
        if not self.metrics:
            self.collect_metrics()
        return self.metrics.get(metric_name)

# 模拟数据收集函数
def collect_cpu_metrics():
    """收集CPU指标"""
    return {
        "usage": random.uniform(20, 80),
        "cores": 8,
        "load_average": [random.uniform(0.5, 3.0) for _ in range(3)]
    }

def collect_memory_metrics():
    """收集内存指标"""
    total = 32 * 1024 * 1024 * 1024  # 32GB
    used = random.uniform(0.3, 0.8) * total
    return {
        "total_bytes": total,
        "used_bytes": used,
        "free_bytes": total - used,
        "utilization": (used / total) * 100
    }

def collect_disk_metrics():
    """收集磁盘指标"""
    total = 2 * 1024 * 1024 * 1024 * 1024  # 2TB
    used = random.uniform(0.2, 0.7) * total
    return {
        "total_bytes": total,
        "used_bytes": used,
        "free_bytes": total - used,
        "utilization": (used / total) * 100
    }

def collect_network_metrics():
    """收集网络指标"""
    return {
        "bytes_sent": random.uniform(1000000, 10000000),
        "bytes_received": random.uniform(1000000, 10000000),
        "packets_sent": random.uniform(1000, 10000),
        "packets_received": random.uniform(1000, 10000)
    }

def collect_cluster_status():
    """收集集群状态"""
    nodes = ["node-001", "node-002", "node-003", "node-004", "node-005"]
    status_counts = {"online": 0, "offline": 0, "warning": 0}
    
    for node in nodes:
        if random.random() > 0.1:  # 90%概率在线
            status_counts["online"] += 1
        else:
            status_counts["offline"] += 1
    
    return {
        "total_nodes": len(nodes),
        "online_nodes": status_counts["online"],
        "offline_nodes": status_counts["offline"],
        "warning_nodes": status_counts["warning"],
        "health_status": "healthy" if status_counts["offline"] == 0 else "degraded"
    }

# 使用示例
def demonstrate_visual_monitoring():
    """演示可视化监控"""
    # 创建监控仪表板
    dashboard = MonitoringDashboard("存储系统监控面板")
    
    # 创建指标收集器
    metrics_collector = MetricsCollector()
    metrics_collector.add_collector("cpu", collect_cpu_metrics)
    metrics_collector.add_collector("memory", collect_memory_metrics)
    metrics_collector.add_collector("disk", collect_disk_metrics)
    metrics_collector.add_collector("network", collect_network_metrics)
    metrics_collector.add_collector("cluster", collect_cluster_status)
    
    # 添加数据源
    dashboard.add_data_source("system_metrics", metrics_collector.collect_metrics)
    
    # 添加监控小部件
    dashboard.add_widget("cpu_usage", {
        "type": "gauge",
        "title": "CPU使用率",
        "data_source": "system_metrics",
        "metric_path": "cpu.usage"
    })
    
    dashboard.add_widget("memory_usage", {
        "type": "gauge",
        "title": "内存使用率",
        "data_source": "system_metrics",
        "metric_path": "memory.utilization"
    })
    
    dashboard.add_widget("cluster_status", {
        "type": "status",
        "title": "集群状态",
        "data_source": "system_metrics",
        "metric_path": "cluster"
    })
    
    # 创建图表渲染器
    chart_renderer = ChartRenderer()
    
    # 刷新并渲染小部件
    print("刷新监控数据...")
    refresh_results = dashboard.refresh_all_widgets()
    
    # 渲染图表
    cpu_data = metrics_collector.get_metric("cpu")
    if cpu_data and not isinstance(cpu_data, dict) or "error" not in cpu_data:
        gauge_html = chart_renderer.render_gauge_chart(
            {"value": cpu_data["usage"], "max": 100},
            {"title": "CPU使用率"}
        )
        print("CPU使用率图表:")
        print(gauge_html[:200] + "..." if len(gauge_html) > 200 else gauge_html)
    
    # 显示仪表板状态
    dashboard_state = dashboard.get_dashboard_state()
    print(f"\n仪表板状态:")
    print(f"  仪表板名称: {dashboard_state['dashboard_name']}")
    print(f"  小部件数量: {len(dashboard_state['widgets'])}")
    print(f"  自动刷新: {'启用' if dashboard_state['auto_refresh_enabled'] else '禁用'}")
    
    # 启动自动刷新（演示用，实际使用时会持续运行）
    print("\n启动自动刷新演示...")
    dashboard.start_auto_refresh(interval=10)  # 10秒间隔用于演示
    
    # 运行15秒
    time.sleep(15)
    dashboard.stop_auto_refresh()

# 运行演示
# demonstrate_visual_monitoring()
```

### 13.1.1.2 告警中心实现

```python
# 告警中心实现
from typing import Dict, List, Any, Callable, Optional
from datetime import datetime, timedelta
import threading
import json

class Alert:
    """告警对象"""
    
    def __init__(self, alert_id: str, rule_id: str, severity: str, 
                 message: str, details: Dict[str, Any]):
        self.alert_id = alert_id
        self.rule_id = rule_id
        self.severity = severity  # critical, high, medium, low
        self.message = message
        self.details = details
        self.created_at = datetime.now()
        self.status = "active"  # active, acknowledged, resolved
        self.acknowledged_by = None
        self.acknowledged_at = None
        self.resolved_at = None
        self.notifications = []

class AlertRule:
    """告警规则"""
    
    def __init__(self, rule_id: str, name: str, description: str,
                 condition: Callable, severity: str, 
                 notification_channels: List[str] = None):
        self.rule_id = rule_id
        self.name = name
        self.description = description
        self.condition = condition
        self.severity = severity
        self.notification_channels = notification_channels or []
        self.enabled = True
        self.last_evaluated = None
        self.evaluation_interval = 60  # 默认60秒评估一次

class AlertCenter:
    """告警中心"""
    
    def __init__(self):
        self.alert_rules = {}
        self.active_alerts = {}
        self.alert_history = []
        self.notification_channels = {}
        self.alert_callbacks = []
        self.evaluating = False
    
    def add_alert_rule(self, rule: AlertRule):
        """添加告警规则"""
        self.alert_rules[rule.rule_id] = rule
        print(f"添加告警规则: {rule.name}")
    
    def add_notification_channel(self, channel_name: str, channel_func: Callable):
        """添加通知渠道"""
        self.notification_channels[channel_name] = channel_func
    
    def add_alert_callback(self, callback: Callable[[Alert], None]):
        """添加告警回调"""
        self.alert_callbacks.append(callback)
    
    def evaluate_alert_rules(self):
        """评估告警规则"""
        for rule_id, rule in self.alert_rules.items():
            if not rule.enabled:
                continue
            
            try:
                rule.last_evaluated = datetime.now()
                if rule.condition():
                    # 触发告警
                    self._trigger_alert(rule)
            except Exception as e:
                print(f"评估告警规则 {rule_id} 失败: {e}")
    
    def _trigger_alert(self, rule: AlertRule):
        """触发告警"""
        alert_id = f"alert_{int(datetime.now().timestamp() * 1000)}"
        
        # 创建告警对象
        alert = Alert(
            alert_id=alert_id,
            rule_id=rule.rule_id,
            severity=rule.severity,
            message=f"告警: {rule.name}",
            details={"rule_name": rule.name, "description": rule.description}
        )
        
        # 添加到活动告警
        self.active_alerts[alert_id] = alert
        
        # 添加到历史记录
        self.alert_history.append(alert)
        
        # 发送通知
        self._send_notifications(alert, rule)
        
        # 调用回调函数
        for callback in self.alert_callbacks:
            try:
                callback(alert)
            except Exception as e:
                print(f"告警回调执行失败: {e}")
        
        print(f"触发告警: {alert_id} - {rule.name}")
    
    def _send_notifications(self, alert: Alert, rule: AlertRule):
        """发送通知"""
        for channel_name in rule.notification_channels:
            if channel_name in self.notification_channels:
                try:
                    channel_func = self.notification_channels[channel_name]
                    notification_result = channel_func(alert)
                    alert.notifications.append({
                        "channel": channel_name,
                        "result": notification_result,
                        "sent_at": datetime.now().isoformat()
                    })
                except Exception as e:
                    print(f"通过渠道 {channel_name} 发送通知失败: {e}")
    
    def acknowledge_alert(self, alert_id: str, user: str) -> bool:
        """确认告警"""
        if alert_id not in self.active_alerts:
            return False
        
        alert = self.active_alerts[alert_id]
        alert.status = "acknowledged"
        alert.acknowledged_by = user
        alert.acknowledged_at = datetime.now()
        
        print(f"告警 {alert_id} 已被 {user} 确认")
        return True
    
    def resolve_alert(self, alert_id: str) -> bool:
        """解决告警"""
        if alert_id not in self.active_alerts:
            return False
        
        alert = self.active_alerts[alert_id]
        alert.status = "resolved"
        alert.resolved_at = datetime.now()
        
        # 从活动告警中移除
        del self.active_alerts[alert_id]
        
        print(f"告警 {alert_id} 已解决")
        return True
    
    def get_active_alerts(self, severity: str = None) -> List[Alert]:
        """获取活动告警"""
        alerts = list(self.active_alerts.values())
        if severity:
            alerts = [alert for alert in alerts if alert.severity == severity]
        return alerts
    
    def get_alert_statistics(self) -> Dict[str, Any]:
        """获取告警统计"""
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        status_counts = {"active": 0, "acknowledged": 0, "resolved": 0}
        
        # 统计活动告警
        for alert in self.active_alerts.values():
            severity_counts[alert.severity] += 1
            status_counts[alert.status] += 1
        
        # 统计历史告警
        total_alerts = len(self.alert_history)
        recent_alerts = [
            alert for alert in self.alert_history
            if datetime.now() - alert.created_at < timedelta(hours=24)
        ]
        
        return {
            "active_alerts": len(self.active_alerts),
            "total_alerts": total_alerts,
            "recent_alerts_24h": len(recent_alerts),
            "severity_distribution": severity_counts,
            "status_distribution": status_counts
        }
    
    def start_alert_evaluation(self, interval: int = 60):
        """启动告警评估"""
        self.evaluating = True
        
        def evaluation_loop():
            while self.evaluating:
                try:
                    self.evaluate_alert_rules()
                    time.sleep(interval)
                except Exception as e:
                    print(f"告警评估出错: {e}")
        
        eval_thread = threading.Thread(target=evaluation_loop)
        eval_thread.daemon = True
        eval_thread.start()
        print(f"告警评估已启动，间隔: {interval}秒")
    
    def stop_alert_evaluation(self):
        """停止告警评估"""
        self.evaluating = False
        print("告警评估已停止")

# 通知渠道实现示例
def email_notification(alert: Alert) -> Dict[str, Any]:
    """邮件通知"""
    # 模拟邮件发送
    print(f"发送邮件告警: {alert.message}")
    return {"status": "sent", "channel": "email"}

def sms_notification(alert: Alert) -> Dict[str, Any]:
    """短信通知"""
    # 模拟短信发送
    print(f"发送短信告警: {alert.message}")
    return {"status": "sent", "channel": "sms"}

def webhook_notification(alert: Alert) -> Dict[str, Any]:
    """Webhook通知"""
    # 模拟Webhook调用
    print(f"调用Webhook告警: {alert.message}")
    return {"status": "sent", "channel": "webhook"}

# 告警规则条件示例
def high_cpu_condition():
    """高CPU使用率条件"""
    # 模拟检查CPU使用率
    cpu_usage = random.uniform(0, 100)
    return cpu_usage > 80

def disk_full_condition():
    """磁盘满条件"""
    # 模拟检查磁盘使用率
    disk_usage = random.uniform(0, 100)
    return disk_usage > 90

def node_offline_condition():
    """节点离线条件"""
    # 模拟检查节点状态
    return random.random() < 0.05  # 5%概率节点离线

# 使用示例
def on_alert_triggered(alert: Alert):
    """告警触发回调"""
    print(f"告警回调: {alert.alert_id} - {alert.message}")

def demonstrate_alerting_center():
    """演示告警中心"""
    # 创建告警中心
    alert_center = AlertCenter()
    
    # 添加通知渠道
    alert_center.add_notification_channel("email", email_notification)
    alert_center.add_notification_channel("sms", sms_notification)
    alert_center.add_notification_channel("webhook", webhook_notification)
    
    # 添加告警回调
    alert_center.add_alert_callback(on_alert_triggered)
    
    # 创建告警规则
    cpu_rule = AlertRule(
        rule_id="high_cpu",
        name="CPU使用率过高",
        description="检测CPU使用率是否超过80%",
        condition=high_cpu_condition,
        severity="high",
        notification_channels=["email", "sms"]
    )
    
    disk_rule = AlertRule(
        rule_id="disk_full",
        name="磁盘空间不足",
        description="检测磁盘使用率是否超过90%",
        condition=disk_full_condition,
        severity="critical",
        notification_channels=["email", "sms", "webhook"]
    )
    
    node_rule = AlertRule(
        rule_id="node_offline",
        name="节点离线",
        description="检测是否有节点离线",
        condition=node_offline_condition,
        severity="medium",
        notification_channels=["email"]
    )
    
    # 添加告警规则
    alert_center.add_alert_rule(cpu_rule)
    alert_center.add_alert_rule(disk_rule)
    alert_center.add_alert_rule(node_rule)
    
    # 启动告警评估
    print("启动告警评估...")
    alert_center.start_alert_evaluation(interval=5)  # 5秒间隔用于演示
    
    # 运行20秒以触发一些告警
    print("运行告警评估20秒...")
    time.sleep(20)
    
    # 显示告警统计
    stats = alert_center.get_alert_statistics()
    print(f"\n告警统计:")
    print(f"  活动告警: {stats['active_alerts']}")
    print(f"  总告警数: {stats['total_alerts']}")
    print(f"  24小时告警: {stats['recent_alerts_24h']}")
    print(f"  严重程度分布: {stats['severity_distribution']}")
    
    # 获取活动告警
    active_alerts = alert_center.get_active_alerts()
    print(f"\n当前活动告警 ({len(active_alerts)} 个):")
    for alert in active_alerts[:3]:  # 只显示前3个
        print(f"  {alert.alert_id}: {alert.message} ({alert.severity})")
    
    # 确认一个告警
    if active_alerts:
        first_alert_id = active_alerts[0].alert_id
        alert_center.acknowledge_alert(first_alert_id, "admin")
        
        # 解决一个告警
        if len(active_alerts) > 1:
            second_alert_id = active_alerts[1].alert_id
            alert_center.resolve_alert(second_alert_id)
    
    # 停止告警评估
    alert_center.stop_alert_evaluation()

# 运行演示
# demonstrate_alerting_center()
```

## 13.1.2 智能告警与根因分析

智能告警系统能够减少告警噪音，提高告警的准确性和可操作性。

### 13.1.2.1 告警收敛与关联分析

```python
# 智能告警系统
from typing import Dict, List, Any, Set
from datetime import datetime, timedelta
import hashlib

class AlertCorrelation:
    """告警关联分析"""
    
    def __init__(self):
        self.alert_patterns = {}
        self.correlation_rules = []
    
    def add_correlation_rule(self, rule_id: str, condition: Callable, 
                           related_alerts: List[str]):
        """添加关联规则"""
        self.correlation_rules.append({
            "rule_id": rule_id,
            "condition": condition,
            "related_alerts": related_alerts
        })
    
    def analyze_alert_correlations(self, alerts: List[Alert]) -> List[Dict[str, Any]]:
        """分析告警关联"""
        correlations = []
        
        for rule in self.correlation_rules:
            try:
                if rule["condition"](alerts):
                    # 找到相关的告警
                    related_alerts = [
                        alert for alert in alerts 
                        if alert.rule_id in rule["related_alerts"]
                    ]
                    
                    correlation = {
                        "rule_id": rule["rule_id"],
                        "related_alerts": [alert.alert_id for alert in related_alerts],
                        "correlation_time": datetime.now().isoformat(),
                        "confidence": self._calculate_correlation_confidence(related_alerts)
                    }
                    correlations.append(correlation)
            except Exception as e:
                print(f"关联分析规则 {rule['rule_id']} 执行失败: {e}")
        
        return correlations
    
    def _calculate_correlation_confidence(self, alerts: List[Alert]) -> float:
        """计算关联置信度"""
        if not alerts:
            return 0.0
        
        # 简单的时间相关性计算
        time_diffs = []
        for i in range(1, len(alerts)):
            diff = abs((alerts[i].created_at - alerts[i-1].created_at).total_seconds())
            time_diffs.append(diff)
        
        if not time_diffs:
            return 0.8  # 单个告警，默认置信度
        
        avg_diff = sum(time_diffs) / len(time_diffs)
        # 时间越接近，置信度越高
        confidence = max(0.1, min(1.0, 1.0 / (1.0 + avg_diff / 60.0)))
        return confidence

class AlertSuppression:
    """告警抑制"""
    
    def __init__(self):
        self.suppression_rules = []
        self.suppressed_alerts = set()
    
    def add_suppression_rule(self, rule_id: str, condition: Callable, 
                           duration: int = 3600):
        """添加抑制规则"""
        self.suppression_rules.append({
            "rule_id": rule_id,
            "condition": condition,
            "duration": duration,  # 秒
            "created_at": datetime.now()
        })
    
    def should_suppress_alert(self, alert: Alert) -> bool:
        """判断是否应该抑制告警"""
        for rule in self.suppression_rules:
            try:
                if rule["condition"](alert):
                    suppression_key = f"{alert.rule_id}_{alert.details.get('resource', 'unknown')}"
                    self.suppressed_alerts.add(suppression_key)
                    return True
            except Exception as e:
                print(f"抑制规则 {rule['rule_id']} 执行失败: {e}")
        return False
    
    def get_suppression_status(self) -> Dict[str, Any]:
        """获取抑制状态"""
        return {
            "suppression_rules": len(self.suppression_rules),
            "suppressed_alerts": len(self.suppressed_alerts),
            "suppressed_alert_list": list(self.suppressed_alerts)
        }

class RootCauseAnalyzer:
    """根因分析器"""
    
    def __init__(self):
        self.analysis_rules = []
        self.analysis_history = []
    
    def add_analysis_rule(self, rule_id: str, analyzer: Callable):
        """添加分析规则"""
        self.analysis_rules.append({
            "rule_id": rule_id,
            "analyzer": analyzer
        })
    
    def analyze_root_cause(self, alerts: List[Alert]) -> Dict[str, Any]:
        """分析根因"""
        analysis_results = []
        
        for rule in self.analysis_rules:
            try:
                result = rule["analyzer"](alerts)
                if result:
                    analysis_results.append({
                        "rule_id": rule["rule_id"],
                        "result": result,
                        "analyzed_at": datetime.now().isoformat()
                    })
            except Exception as e:
                print(f"根因分析规则 {rule['rule_id']} 执行失败: {e}")
        
        # 合并分析结果
        merged_result = self._merge_analysis_results(analysis_results)
        
        analysis_record = {
            "alerts_analyzed": [alert.alert_id for alert in alerts],
            "results": analysis_results,
            "merged_result": merged_result,
            "analyzed_at": datetime.now().isoformat()
        }
        
        self.analysis_history.append(analysis_record)
        return merged_result
    
    def _merge_analysis_results(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """合并分析结果"""
        if not results:
            return {"root_cause": "unknown", "confidence": 0.0}
        
        # 简单的合并策略：选择置信度最高的结果
        best_result = max(results, key=lambda x: x["result"].get("confidence", 0))
        return best_result["result"]

# 关联分析规则示例
def cpu_disk_correlation(alerts: List[Alert]) -> bool:
    """CPU和磁盘告警关联规则"""
    cpu_alerts = [a for a in alerts if a.rule_id == "high_cpu"]
    disk_alerts = [a for a in alerts if a.rule_id == "disk_full"]
    
    if not cpu_alerts or not disk_alerts:
        return False
    
    # 检查时间相关性（5分钟内）
    for cpu_alert in cpu_alerts:
        for disk_alert in disk_alerts:
            time_diff = abs((cpu_alert.created_at - disk_alert.created_at).total_seconds())
            if time_diff <= 300:  # 5分钟
                return True
    return False

# 抑制规则示例
def maintenance_window_suppression(alert: Alert) -> bool:
    """维护窗口抑制规则"""
    # 检查是否在维护窗口内
    current_hour = datetime.now().hour
    return 2 <= current_hour <= 4  # 凌晨2-4点为维护窗口

# 根因分析规则示例
def disk_full_root_cause(alerts: List[Alert]) -> Dict[str, Any]:
    """磁盘满根因分析"""
    disk_alerts = [a for a in alerts if a.rule_id == "disk_full"]
    if not disk_alerts:
        return None
    
    return {
        "root_cause": "磁盘空间不足",
        "confidence": 0.9,
        "recommendation": "清理磁盘空间或扩容存储",
        "affected_resources": [a.details.get("resource", "unknown") for a in disk_alerts]
    }

# 使用示例
def demonstrate_intelligent_alerting():
    """演示智能告警"""
    # 创建智能告警组件
    correlation_analyzer = AlertCorrelation()
    alert_suppressor = AlertSuppression()
    root_cause_analyzer = RootCauseAnalyzer()
    
    # 添加关联规则
    correlation_analyzer.add_correlation_rule(
        "cpu_disk_correlation",
        cpu_disk_correlation,
        ["high_cpu", "disk_full"]
    )
    
    # 添加抑制规则
    alert_suppressor.add_suppression_rule(
        "maintenance_window",
        maintenance_window_suppression,
        7200  # 2小时
    )
    
    # 添加根因分析规则
    root_cause_analyzer.add_analysis_rule(
        "disk_full_analysis",
        disk_full_root_cause
    )
    
    # 模拟一些告警
    sample_alerts = [
        Alert("alert_001", "high_cpu", "high", "CPU使用率过高", {"resource": "node-001"}),
        Alert("alert_002", "disk_full", "critical", "磁盘空间不足", {"resource": "node-001"}),
        Alert("alert_003", "high_cpu", "high", "CPU使用率过高", {"resource": "node-002"})
    ]
    
    # 分析告警关联
    correlations = correlation_analyzer.analyze_alert_correlations(sample_alerts)
    print(f"发现 {len(correlations)} 个告警关联:")
    for correlation in correlations:
        print(f"  关联规则: {correlation['rule_id']}")
        print(f"  相关告警: {correlation['related_alerts']}")
        print(f"  置信度: {correlation['confidence']:.2f}")
    
    # 检查告警抑制
    for alert in sample_alerts:
        should_suppress = alert_suppressor.should_suppress_alert(alert)
        print(f"告警 {alert.alert_id} 是否被抑制: {should_suppress}")
    
    suppression_status = alert_suppressor.get_suppression_status()
    print(f"\n抑制状态: {suppression_status}")
    
    # 根因分析
    root_cause = root_cause_analyzer.analyze_root_cause(sample_alerts)
    print(f"\n根因分析结果:")
    print(f"  根因: {root_cause.get('root_cause', 'unknown')}")
    print(f"  置信度: {root_cause.get('confidence', 0.0):.2f}")
    print(f"  建议: {root_cause.get('recommendation', 'N/A')}")

# 运行演示
# demonstrate_intelligent_alerting()
```

通过构建完善的可视化监控与告警中心，我们能够为分布式文件存储平台提供强大的运维支持，帮助运维人员及时发现和处理系统问题，确保系统的稳定运行。