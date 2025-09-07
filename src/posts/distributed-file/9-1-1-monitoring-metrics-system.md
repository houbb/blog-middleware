---
title: "监控指标体系建设:节点、集群、业务层面核心 metrics（容量、IOPS、吞吐、延迟）"
date: 2025-09-07
categories: "[DFS]"
tags: "[dfs, monitoring, metrics, observability, capacity, iops, throughput, latency]"
published: true
---
在分布式文件存储平台中，监控指标体系建设是确保系统稳定运行和性能优化的基础。一个完善的监控指标体系需要从节点、集群和业务三个层面进行全面覆盖，通过采集和分析核心指标（如容量、IOPS、吞吐量、延迟等），帮助运维人员实时了解系统状态，及时发现和解决问题。

## 9.1.1 节点层面监控指标

节点层面的监控指标关注单个存储节点的资源使用情况和性能表现，是整个监控体系的基础。这些指标能够帮助我们了解每个节点的健康状况和资源瓶颈。

### 9.1.1.1 CPU和内存监控

```python
# 节点CPU和内存监控实现
import psutil
import time
from typing import Dict, Any
import json
from datetime import datetime

class NodeCPUMemoryMonitor:
    """节点CPU和内存监控器"""
    
    def __init__(self, node_id: str, collection_interval_sec: int = 30):
        self.node_id = node_id
        self.collection_interval_sec = collection_interval_sec
        self.metrics_history = []
        self.alert_thresholds = {
            "cpu_utilization": 80.0,  # CPU使用率阈值
            "memory_utilization": 85.0  # 内存使用率阈值
        }
    
    def collect_metrics(self) -> Dict[str, Any]:
        """收集CPU和内存指标"""
        # CPU指标
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_count = psutil.cpu_count()
        cpu_freq = psutil.cpu_freq()
        
        # 内存指标
        memory = psutil.virtual_memory()
        
        metrics = {
            "node_id": self.node_id,
            "timestamp": datetime.now().isoformat(),
            "cpu": {
                "utilization_percent": cpu_percent,
                "count": cpu_count,
                "frequency_mhz": cpu_freq.current if cpu_freq else 0,
                "max_frequency_mhz": cpu_freq.max if cpu_freq else 0
            },
            "memory": {
                "total_bytes": memory.total,
                "available_bytes": memory.available,
                "used_bytes": memory.used,
                "utilization_percent": memory.percent,
                "cached_bytes": memory.cached,
                "buffers_bytes": memory.buffers,
                "shared_bytes": memory.shared
            }
        }
        
        # 添加到历史记录
        self.metrics_history.append(metrics)
        
        # 保留最近100条记录
        if len(self.metrics_history) > 100:
            self.metrics_history.pop(0)
        
        return metrics
    
    def check_alerts(self, metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
        """检查告警条件"""
        alerts = []
        
        # CPU使用率告警
        cpu_util = metrics["cpu"]["utilization_percent"]
        if cpu_util > self.alert_thresholds["cpu_utilization"]:
            alerts.append({
                "type": "high_cpu_utilization",
                "severity": "warning",
                "message": f"节点 {self.node_id} CPU使用率过高: {cpu_util:.2f}%",
                "threshold": self.alert_thresholds["cpu_utilization"]
            })
        
        # 内存使用率告警
        mem_util = metrics["memory"]["utilization_percent"]
        if mem_util > self.alert_thresholds["memory_utilization"]:
            alerts.append({
                "type": "high_memory_utilization",
                "severity": "warning",
                "message": f"节点 {self.node_id} 内存使用率过高: {mem_util:.2f}%",
                "threshold": self.alert_thresholds["memory_utilization"]
            })
        
        return alerts
    
    def get_resource_trend(self, metric_type: str, hours: int = 1) -> Dict[str, Any]:
        """获取资源使用趋势"""
        if not self.metrics_history:
            return {"message": "无历史数据"}
        
        # 过滤指定时间范围内的数据
        cutoff_time = datetime.now() - timedelta(hours=hours)
        recent_metrics = [
            m for m in self.metrics_history 
            if datetime.fromisoformat(m["timestamp"]) >= cutoff_time
        ]
        
        if not recent_metrics:
            return {"message": "指定时间范围内无数据"}
        
        # 计算趋势
        if metric_type == "cpu":
            values = [m["cpu"]["utilization_percent"] for m in recent_metrics]
        elif metric_type == "memory":
            values = [m["memory"]["utilization_percent"] for m in recent_metrics]
        else:
            return {"error": "不支持的指标类型"}
        
        if not values:
            return {"error": "无有效数据"}
        
        return {
            "metric_type": metric_type,
            "avg_value": sum(values) / len(values),
            "min_value": min(values),
            "max_value": max(values),
            "current_value": values[-1],
            "trend": "increasing" if values[-1] > values[0] else "decreasing" if values[-1] < values[0] else "stable"
        }
    
    def export_metrics(self, format: str = "json") -> str:
        """导出指标数据"""
        if format.lower() == "json":
            return json.dumps(self.metrics_history, indent=2, default=str)
        else:
            return str(self.metrics_history)

# 使用示例
monitor = NodeCPUMemoryMonitor("node-001", collection_interval_sec=30)

# 收集指标
metrics = monitor.collect_metrics()
print("收集到的指标:")
print(json.dumps(metrics, indent=2, default=str))

# 检查告警
alerts = monitor.check_alerts(metrics)
if alerts:
    print("\n触发的告警:")
    for alert in alerts:
        print(f"- {alert['message']}")

# 获取CPU使用趋势
cpu_trend = monitor.get_resource_trend("cpu", hours=1)
print("\nCPU使用趋势:")
print(json.dumps(cpu_trend, indent=2, default=str))
```

### 9.1.1.2 磁盘I/O监控

```python
# 磁盘I/O监控实现
import psutil
import time
from typing import Dict, Any, List
import json
from datetime import datetime, timedelta

class DiskIOMonitor:
    """磁盘I/O监控器"""
    
    def __init__(self, node_id: str, collection_interval_sec: int = 30):
        self.node_id = node_id
        self.collection_interval_sec = collection_interval_sec
        self.io_history = []
        self.alert_thresholds = {
            "iops": 10000,  # IOPS阈值
            "throughput_mb_per_sec": 100,  # 吞吐量阈值 (MB/s)
            "disk_utilization": 90.0  # 磁盘使用率阈值
        }
    
    def collect_io_metrics(self) -> Dict[str, Any]:
        """收集磁盘I/O指标"""
        # 获取磁盘I/O统计
        disk_io = psutil.disk_io_counters()
        
        # 获取磁盘使用情况
        disk_usage = psutil.disk_usage("/")
        
        # 计算IOPS和吞吐量
        iops_read = 0
        iops_write = 0
        throughput_read = 0
        throughput_write = 0
        
        if len(self.io_history) >= 1:
            prev_io = self.io_history[-1]["raw_io"]
            time_diff = time.time() - self.io_history[-1]["timestamp"]
            
            if time_diff > 0:
                iops_read = (disk_io.read_count - prev_io.read_count) / time_diff
                iops_write = (disk_io.write_count - prev_io.write_count) / time_diff
                throughput_read = (disk_io.read_bytes - prev_io.read_bytes) / time_diff
                throughput_write = (disk_io.write_bytes - prev_io.write_bytes) / time_diff
        
        metrics = {
            "node_id": self.node_id,
            "timestamp": time.time(),
            "collection_time": datetime.now().isoformat(),
            "raw_io": disk_io,  # 保存原始数据用于下次计算
            "io_stats": {
                "read_count": disk_io.read_count,
                "write_count": disk_io.write_count,
                "read_bytes": disk_io.read_bytes,
                "write_bytes": disk_io.write_bytes,
                "read_time_ms": disk_io.read_time,
                "write_time_ms": disk_io.write_time,
                "busy_time_ms": disk_io.busy_time if hasattr(disk_io, 'busy_time') else 0
            },
            "calculated_metrics": {
                "iops_read": iops_read,
                "iops_write": iops_write,
                "iops_total": iops_read + iops_write,
                "throughput_read_bytes_per_sec": throughput_read,
                "throughput_write_bytes_per_sec": throughput_write,
                "throughput_total_bytes_per_sec": throughput_read + throughput_write,
                "throughput_read_mb_per_sec": throughput_read / (1024 * 1024),
                "throughput_write_mb_per_sec": throughput_write / (1024 * 1024),
                "throughput_total_mb_per_sec": (throughput_read + throughput_write) / (1024 * 1024)
            },
            "disk_usage": {
                "total_bytes": disk_usage.total,
                "used_bytes": disk_usage.used,
                "free_bytes": disk_usage.free,
                "utilization_percent": disk_usage.percent
            }
        }
        
        # 添加到历史记录
        self.io_history.append(metrics)
        
        # 保留最近100条记录
        if len(self.io_history) > 100:
            self.io_history.pop(0)
        
        return metrics
    
    def check_io_alerts(self, metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
        """检查I/O告警条件"""
        alerts = []
        calc_metrics = metrics["calculated_metrics"]
        disk_usage = metrics["disk_usage"]
        
        # IOPS告警
        total_iops = calc_metrics["iops_total"]
        if total_iops > self.alert_thresholds["iops"]:
            alerts.append({
                "type": "high_iops",
                "severity": "warning",
                "message": f"节点 {self.node_id} IOPS过高: {total_iops:.2f}",
                "threshold": self.alert_thresholds["iops"]
            })
        
        # 吞吐量告警
        throughput_mb = calc_metrics["throughput_total_mb_per_sec"]
        if throughput_mb > self.alert_thresholds["throughput_mb_per_sec"]:
            alerts.append({
                "type": "high_throughput",
                "severity": "warning",
                "message": f"节点 {self.node_id} 吞吐量过高: {throughput_mb:.2f} MB/s",
                "threshold": self.alert_thresholds["throughput_mb_per_sec"]
            })
        
        # 磁盘使用率告警
        disk_util = disk_usage["utilization_percent"]
        if disk_util > self.alert_thresholds["disk_utilization"]:
            alerts.append({
                "type": "high_disk_utilization",
                "severity": "error",
                "message": f"节点 {self.node_id} 磁盘使用率过高: {disk_util:.2f}%",
                "threshold": self.alert_thresholds["disk_utilization"]
            })
        
        return alerts
    
    def get_io_performance_summary(self, hours: int = 1) -> Dict[str, Any]:
        """获取I/O性能摘要"""
        if len(self.io_history) < 2:
            return {"message": "数据不足，无法生成摘要"}
        
        # 过滤指定时间范围内的数据
        cutoff_time = time.time() - (hours * 3600)
        recent_metrics = [
            m for m in self.io_history 
            if m["timestamp"] >= cutoff_time
        ]
        
        if len(recent_metrics) < 2:
            return {"message": "指定时间范围内数据不足"}
        
        # 提取计算指标
        iops_values = [m["calculated_metrics"]["iops_total"] for m in recent_metrics if m["calculated_metrics"]["iops_total"] > 0]
        throughput_values = [m["calculated_metrics"]["throughput_total_mb_per_sec"] for m in recent_metrics if m["calculated_metrics"]["throughput_total_mb_per_sec"] > 0]
        disk_util_values = [m["disk_usage"]["utilization_percent"] for m in recent_metrics]
        
        if not iops_values or not throughput_values:
            return {"message": "无有效I/O数据"}
        
        return {
            "time_range_hours": hours,
            "data_points": len(recent_metrics),
            "iops": {
                "avg": sum(iops_values) / len(iops_values),
                "min": min(iops_values),
                "max": max(iops_values),
                "current": iops_values[-1]
            },
            "throughput_mb_per_sec": {
                "avg": sum(throughput_values) / len(throughput_values),
                "min": min(throughput_values),
                "max": max(throughput_values),
                "current": throughput_values[-1]
            },
            "disk_utilization_percent": {
                "avg": sum(disk_util_values) / len(disk_util_values),
                "min": min(disk_util_values),
                "max": max(disk_util_values),
                "current": disk_util_values[-1]
            }
        }

# 使用示例
io_monitor = DiskIOMonitor("node-001", collection_interval_sec=30)

# 模拟收集两次数据以计算IOPS和吞吐量
print("第一次收集:")
metrics1 = io_monitor.collect_io_metrics()
time.sleep(2)  # 等待2秒

print("第二次收集:")
metrics2 = io_monitor.collect_io_metrics()

# 检查告警
alerts = io_monitor.check_io_alerts(metrics2)
if alerts:
    print("\n触发的告警:")
    for alert in alerts:
        print(f"- {alert['message']}")

# 获取性能摘要
summary = io_monitor.get_io_performance_summary(hours=1)
print("\nI/O性能摘要:")
print(json.dumps(summary, indent=2, default=str))
```

### 9.1.1.3 网络监控

```python
# 网络监控实现
import psutil
import time
from typing import Dict, Any, List
import json
from datetime import datetime

class NetworkMonitor:
    """网络监控器"""
    
    def __init__(self, node_id: str, collection_interval_sec: int = 30):
        self.node_id = node_id
        self.collection_interval_sec = collection_interval_sec
        self.network_history = []
        self.alert_thresholds = {
            "bandwidth_mb_per_sec": 1000,  # 带宽阈值 (MB/s)
            "error_rate": 0.01,  # 错误率阈值 (1%)
            "drop_rate": 0.005  # 丢包率阈值 (0.5%)
        }
    
    def collect_network_metrics(self) -> Dict[str, Any]:
        """收集网络指标"""
        # 获取网络I/O统计
        net_io = psutil.net_io_counters()
        
        # 计算网络吞吐量和错误率
        throughput_sent = 0
        throughput_recv = 0
        error_rate = 0
        drop_rate = 0
        
        if len(self.network_history) >= 1:
            prev_net = self.network_history[-1]["raw_net"]
            time_diff = time.time() - self.network_history[-1]["timestamp"]
            
            if time_diff > 0:
                throughput_sent = (net_io.bytes_sent - prev_net.bytes_sent) / time_diff
                throughput_recv = (net_io.bytes_recv - prev_net.bytes_recv) / time_diff
                
                # 计算错误率和丢包率
                total_packets_sent = net_io.packets_sent - prev_net.packets_sent
                total_packets_recv = net_io.packets_recv - prev_net.packets_recv
                
                if total_packets_sent > 0:
                    errors_sent = net_io.errout - prev_net.errout
                    drops_sent = net_io.dropout - prev_net.dropout
                    error_rate = errors_sent / total_packets_sent
                    drop_rate = drops_sent / total_packets_sent
                
                if total_packets_recv > 0:
                    errors_recv = net_io.errin - prev_net.errin
                    drops_recv = net_io.dropin - prev_net.dropin
                    error_rate = (error_rate + (errors_recv / total_packets_recv)) / 2
                    drop_rate = (drop_rate + (drops_recv / total_packets_recv)) / 2
        
        metrics = {
            "node_id": self.node_id,
            "timestamp": time.time(),
            "collection_time": datetime.now().isoformat(),
            "raw_net": net_io,  # 保存原始数据用于下次计算
            "io_stats": {
                "bytes_sent": net_io.bytes_sent,
                "bytes_recv": net_io.bytes_recv,
                "packets_sent": net_io.packets_sent,
                "packets_recv": net_io.packets_recv,
                "errin": net_io.errin,
                "errout": net_io.errout,
                "dropin": net_io.dropin,
                "dropout": net_io.dropout
            },
            "calculated_metrics": {
                "throughput_sent_bytes_per_sec": throughput_sent,
                "throughput_recv_bytes_per_sec": throughput_recv,
                "throughput_sent_mb_per_sec": throughput_sent / (1024 * 1024),
                "throughput_recv_mb_per_sec": throughput_recv / (1024 * 1024),
                "total_throughput_mb_per_sec": (throughput_sent + throughput_recv) / (1024 * 1024),
                "error_rate": error_rate,
                "drop_rate": drop_rate
            }
        }
        
        # 添加到历史记录
        self.network_history.append(metrics)
        
        # 保留最近100条记录
        if len(self.network_history) > 100:
            self.network_history.pop(0)
        
        return metrics
    
    def check_network_alerts(self, metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
        """检查网络告警条件"""
        alerts = []
        calc_metrics = metrics["calculated_metrics"]
        
        # 带宽告警
        total_throughput = calc_metrics["total_throughput_mb_per_sec"]
        if total_throughput > self.alert_thresholds["bandwidth_mb_per_sec"]:
            alerts.append({
                "type": "high_bandwidth",
                "severity": "warning",
                "message": f"节点 {self.node_id} 网络带宽使用过高: {total_throughput:.2f} MB/s",
                "threshold": self.alert_thresholds["bandwidth_mb_per_sec"]
            })
        
        # 错误率告警
        error_rate = calc_metrics["error_rate"]
        if error_rate > self.alert_thresholds["error_rate"]:
            alerts.append({
                "type": "high_network_error_rate",
                "severity": "warning",
                "message": f"节点 {self.node_id} 网络错误率过高: {error_rate:.4f}",
                "threshold": self.alert_thresholds["error_rate"]
            })
        
        # 丢包率告警
        drop_rate = calc_metrics["drop_rate"]
        if drop_rate > self.alert_thresholds["drop_rate"]:
            alerts.append({
                "type": "high_packet_drop_rate",
                "severity": "warning",
                "message": f"节点 {self.node_id} 网络丢包率过高: {drop_rate:.4f}",
                "threshold": self.alert_thresholds["drop_rate"]
            })
        
        return alerts
    
    def get_network_performance_summary(self, hours: int = 1) -> Dict[str, Any]:
        """获取网络性能摘要"""
        if len(self.network_history) < 2:
            return {"message": "数据不足，无法生成摘要"}
        
        # 过滤指定时间范围内的数据
        cutoff_time = time.time() - (hours * 3600)
        recent_metrics = [
            m for m in self.network_history 
            if m["timestamp"] >= cutoff_time
        ]
        
        if len(recent_metrics) < 2:
            return {"message": "指定时间范围内数据不足"}
        
        # 提取计算指标
        throughput_values = [m["calculated_metrics"]["total_throughput_mb_per_sec"] for m in recent_metrics if m["calculated_metrics"]["total_throughput_mb_per_sec"] > 0]
        error_rate_values = [m["calculated_metrics"]["error_rate"] for m in recent_metrics]
        drop_rate_values = [m["calculated_metrics"]["drop_rate"] for m in recent_metrics]
        
        if not throughput_values:
            return {"message": "无有效网络数据"}
        
        return {
            "time_range_hours": hours,
            "data_points": len(recent_metrics),
            "throughput_mb_per_sec": {
                "avg": sum(throughput_values) / len(throughput_values),
                "min": min(throughput_values),
                "max": max(throughput_values),
                "current": throughput_values[-1]
            },
            "error_rate": {
                "avg": sum(error_rate_values) / len(error_rate_values) if error_rate_values else 0,
                "min": min(error_rate_values) if error_rate_values else 0,
                "max": max(error_rate_values) if error_rate_values else 0,
                "current": error_rate_values[-1] if error_rate_values else 0
            },
            "drop_rate": {
                "avg": sum(drop_rate_values) / len(drop_rate_values) if drop_rate_values else 0,
                "min": min(drop_rate_values) if drop_rate_values else 0,
                "max": max(drop_rate_values) if drop_rate_values else 0,
                "current": drop_rate_values[-1] if drop_rate_values else 0
            }
        }

# 使用示例
network_monitor = NetworkMonitor("node-001", collection_interval_sec=30)

# 模拟收集两次数据以计算网络指标
print("第一次收集:")
net_metrics1 = network_monitor.collect_network_metrics()
time.sleep(2)  # 等待2秒

print("第二次收集:")
net_metrics2 = network_monitor.collect_network_metrics()

# 检查告警
alerts = network_monitor.check_network_alerts(net_metrics2)
if alerts:
    print("\n触发的告警:")
    for alert in alerts:
        print(f"- {alert['message']}")

# 获取性能摘要
summary = network_monitor.get_network_performance_summary(hours=1)
print("\n网络性能摘要:")
print(json.dumps(summary, indent=2, default=str))
```

## 9.1.2 集群层面监控指标

集群层面的监控指标关注整个分布式文件存储集群的整体性能和健康状况，通过聚合各个节点的指标数据，提供全局视角的监控视图。

### 9.1.2.1 集群资源使用情况

```python
# 集群资源使用情况监控
from typing import Dict, List, Any
import statistics
from datetime import datetime

class ClusterResourceMonitor:
    """集群资源监控器"""
    
    def __init__(self):
        self.node_metrics = {}  # 节点指标缓存
        self.cluster_history = []
    
    def add_node_metrics(self, node_id: str, metrics: Dict[str, Any]):
        """添加节点指标"""
        self.node_metrics[node_id] = {
            "metrics": metrics,
            "timestamp": datetime.now()
        }
    
    def get_cluster_cpu_summary(self) -> Dict[str, Any]:
        """获取集群CPU使用情况摘要"""
        cpu_utils = []
        node_data = []
        
        for node_id, data in self.node_metrics.items():
            if "cpu" in data["metrics"]:
                cpu_util = data["metrics"]["cpu"]["utilization_percent"]
                cpu_utils.append(cpu_util)
                node_data.append({
                    "node_id": node_id,
                    "cpu_utilization": cpu_util
                })
        
        if not cpu_utils:
            return {"message": "无CPU数据"}
        
        return {
            "cluster_avg_cpu_utilization": statistics.mean(cpu_utils),
            "cluster_max_cpu_utilization": max(cpu_utils),
            "cluster_min_cpu_utilization": min(cpu_utils),
            "cpu_utilization_stddev": statistics.stdev(cpu_utils) if len(cpu_utils) > 1 else 0,
            "node_count": len(cpu_utils),
            "node_data": node_data
        }
    
    def get_cluster_memory_summary(self) -> Dict[str, Any]:
        """获取集群内存使用情况摘要"""
        mem_utils = []
        node_data = []
        
        for node_id, data in self.node_metrics.items():
            if "memory" in data["metrics"]:
                mem_util = data["metrics"]["memory"]["utilization_percent"]
                mem_utils.append(mem_util)
                node_data.append({
                    "node_id": node_id,
                    "memory_utilization": mem_util
                })
        
        if not mem_utils:
            return {"message": "无内存数据"}
        
        return {
            "cluster_avg_memory_utilization": statistics.mean(mem_utils),
            "cluster_max_memory_utilization": max(mem_utils),
            "cluster_min_memory_utilization": min(mem_utils),
            "memory_utilization_stddev": statistics.stdev(mem_utils) if len(mem_utils) > 1 else 0,
            "node_count": len(mem_utils),
            "node_data": node_data
        }
    
    def get_cluster_disk_summary(self) -> Dict[str, Any]:
        """获取集群磁盘使用情况摘要"""
        disk_utils = []
        node_data = []
        
        for node_id, data in self.node_metrics.items():
            if "disk_usage" in data["metrics"]:
                disk_util = data["metrics"]["disk_usage"]["utilization_percent"]
                disk_utils.append(disk_util)
                node_data.append({
                    "node_id": node_id,
                    "disk_utilization": disk_util
                })
        
        if not disk_utils:
            return {"message": "无磁盘数据"}
        
        return {
            "cluster_avg_disk_utilization": statistics.mean(disk_utils),
            "cluster_max_disk_utilization": max(disk_utils),
            "cluster_min_disk_utilization": min(disk_utils),
            "disk_utilization_stddev": statistics.stdev(disk_utils) if len(disk_utils) > 1 else 0,
            "node_count": len(disk_utils),
            "node_data": node_data
        }
    
    def get_cluster_health_score(self) -> float:
        """计算集群健康分数"""
        # 获取各项指标
        cpu_summary = self.get_cluster_cpu_summary()
        mem_summary = self.get_cluster_memory_summary()
        disk_summary = self.get_cluster_disk_summary()
        
        # 计算健康分数（满分100分）
        health_score = 100.0
        
        # CPU使用率影响（超过80%开始扣分）
        if isinstance(cpu_summary, dict) and "cluster_avg_cpu_utilization" in cpu_summary:
            avg_cpu = cpu_summary["cluster_avg_cpu_utilization"]
            if avg_cpu > 80:
                health_score -= (avg_cpu - 80) * 0.5
        
        # 内存使用率影响（超过85%开始扣分）
        if isinstance(mem_summary, dict) and "cluster_avg_memory_utilization" in mem_summary:
            avg_mem = mem_summary["cluster_avg_memory_utilization"]
            if avg_mem > 85:
                health_score -= (avg_mem - 85) * 0.8
        
        # 磁盘使用率影响（超过80%开始扣分）
        if isinstance(disk_summary, dict) and "cluster_avg_disk_utilization" in disk_summary:
            avg_disk = disk_summary["cluster_avg_disk_utilization"]
            if avg_disk > 80:
                health_score -= (avg_disk - 80) * 1.0
        
        # 确保分数不低于0
        return max(0, health_score)
    
    def get_cluster_resource_report(self) -> Dict[str, Any]:
        """获取集群资源报告"""
        report = {
            "timestamp": datetime.now().isoformat(),
            "cpu": self.get_cluster_cpu_summary(),
            "memory": self.get_cluster_memory_summary(),
            "disk": self.get_cluster_disk_summary(),
            "health_score": self.get_cluster_health_score()
        }
        
        # 添加到历史记录
        self.cluster_history.append(report)
        
        # 保留最近100条记录
        if len(self.cluster_history) > 100:
            self.cluster_history.pop(0)
        
        return report

# 使用示例
cluster_monitor = ClusterResourceMonitor()

# 模拟添加几个节点的指标
node1_metrics = {
    "cpu": {"utilization_percent": 45.2},
    "memory": {"utilization_percent": 65.8},
    "disk_usage": {"utilization_percent": 72.1}
}

node2_metrics = {
    "cpu": {"utilization_percent": 38.7},
    "memory": {"utilization_percent": 58.3},
    "disk_usage": {"utilization_percent": 65.4}
}

node3_metrics = {
    "cpu": {"utilization_percent": 52.1},
    "memory": {"utilization_percent": 71.4},
    "disk_usage": {"utilization_percent": 78.9}
}

cluster_monitor.add_node_metrics("node-001", node1_metrics)
cluster_monitor.add_node_metrics("node-002", node2_metrics)
cluster_monitor.add_node_metrics("node-003", node3_metrics)

# 获取集群资源报告
cluster_report = cluster_monitor.get_cluster_resource_report()
print("集群资源报告:")
print(json.dumps(cluster_report, indent=2, default=str))
```

### 9.1.2.2 集群I/O性能监控

```python
# 集群I/O性能监控
from typing import Dict, List, Any
import statistics
from datetime import datetime

class ClusterIOPerformanceMonitor:
    """集群I/O性能监控器"""
    
    def __init__(self):
        self.node_io_metrics = {}
        self.cluster_io_history = []
    
    def add_node_io_metrics(self, node_id: str, io_metrics: Dict[str, Any]):
        """添加节点I/O指标"""
        self.node_io_metrics[node_id] = {
            "metrics": io_metrics,
            "timestamp": datetime.now()
        }
    
    def get_cluster_io_summary(self) -> Dict[str, Any]:
        """获取集群I/O性能摘要"""
        iops_read_values = []
        iops_write_values = []
        throughput_read_values = []
        throughput_write_values = []
        node_data = []
        
        for node_id, data in self.node_io_metrics.items():
            calc_metrics = data["metrics"].get("calculated_metrics", {})
            
            # 收集IOPS数据
            iops_read = calc_metrics.get("iops_read", 0)
            iops_write = calc_metrics.get("iops_write", 0)
            
            if iops_read > 0:
                iops_read_values.append(iops_read)
            if iops_write > 0:
                iops_write_values.append(iops_write)
            
            # 收集吞吐量数据
            throughput_read = calc_metrics.get("throughput_read_mb_per_sec", 0)
            throughput_write = calc_metrics.get("throughput_write_mb_per_sec", 0)
            
            if throughput_read > 0:
                throughput_read_values.append(throughput_read)
            if throughput_write > 0:
                throughput_write_values.append(throughput_write)
            
            node_data.append({
                "node_id": node_id,
                "iops_read": iops_read,
                "iops_write": iops_write,
                "throughput_read_mb_per_sec": throughput_read,
                "throughput_write_mb_per_sec": throughput_write
            })
        
        if not iops_read_values and not throughput_read_values:
            return {"message": "无I/O数据"}
        
        summary = {
            "timestamp": datetime.now().isoformat(),
            "node_count": len(node_data),
            "node_data": node_data
        }
        
        # 计算IOPS统计
        if iops_read_values:
            summary["iops_read"] = {
                "total": sum(iops_read_values),
                "avg": statistics.mean(iops_read_values),
                "max": max(iops_read_values),
                "min": min(iops_read_values)
            }
        
        if iops_write_values:
            summary["iops_write"] = {
                "total": sum(iops_write_values),
                "avg": statistics.mean(iops_write_values),
                "max": max(iops_write_values),
                "min": min(iops_write_values)
            }
        
        # 计算吞吐量统计
        if throughput_read_values:
            summary["throughput_read_mb_per_sec"] = {
                "total": sum(throughput_read_values),
                "avg": statistics.mean(throughput_read_values),
                "max": max(throughput_read_values),
                "min": min(throughput_read_values)
            }
        
        if throughput_write_values:
            summary["throughput_write_mb_per_sec"] = {
                "total": sum(throughput_write_values),
                "avg": statistics.mean(throughput_write_values),
                "max": max(throughput_write_values),
                "min": min(throughput_write_values)
            }
        
        # 计算总IOPS和总吞吐量
        if iops_read_values or iops_write_values:
            total_iops = sum(iops_read_values) + sum(iops_write_values)
            summary["total_iops"] = total_iops
        
        if throughput_read_values or throughput_write_values:
            total_throughput = sum(throughput_read_values) + sum(throughput_write_values)
            summary["total_throughput_mb_per_sec"] = total_throughput
        
        return summary
    
    def get_cluster_io_trend(self, hours: int = 1) -> Dict[str, Any]:
        """获取集群I/O趋势"""
        if len(self.cluster_io_history) < 2:
            return {"message": "数据不足，无法生成趋势"}
        
        # 过滤指定时间范围内的数据
        cutoff_time = datetime.now() - timedelta(hours=hours)
        recent_summaries = [
            summary for summary in self.cluster_io_history
            if datetime.fromisoformat(summary["timestamp"]) >= cutoff_time
        ]
        
        if len(recent_summaries) < 2:
            return {"message": "指定时间范围内数据不足"}
        
        # 提取趋势数据
        timestamps = [summary["timestamp"] for summary in recent_summaries]
        total_iops_values = []
        total_throughput_values = []
        
        for summary in recent_summaries:
            if "total_iops" in summary:
                total_iops_values.append(summary["total_iops"])
            if "total_throughput_mb_per_sec" in summary:
                total_throughput_values.append(summary["total_throughput_mb_per_sec"])
        
        trend = {
            "time_range_hours": hours,
            "data_points": len(recent_summaries),
            "timestamps": timestamps
        }
        
        if total_iops_values:
            trend["iops_trend"] = {
                "values": total_iops_values,
                "avg": statistics.mean(total_iops_values),
                "min": min(total_iops_values),
                "max": max(total_iops_values),
                "trend": "increasing" if total_iops_values[-1] > total_iops_values[0] else 
                        "decreasing" if total_iops_values[-1] < total_iops_values[0] else "stable"
            }
        
        if total_throughput_values:
            trend["throughput_trend"] = {
                "values": total_throughput_values,
                "avg": statistics.mean(total_throughput_values),
                "min": min(total_throughput_values),
                "max": max(total_throughput_values),
                "trend": "increasing" if total_throughput_values[-1] > total_throughput_values[0] else 
                        "decreasing" if total_throughput_values[-1] < total_throughput_values[0] else "stable"
            }
        
        return trend
    
    def generate_io_performance_report(self) -> Dict[str, Any]:
        """生成I/O性能报告"""
        summary = self.get_cluster_io_summary()
        
        # 添加到历史记录
        self.cluster_io_history.append(summary)
        
        # 保留最近100条记录
        if len(self.cluster_io_history) > 100:
            self.cluster_io_history.pop(0)
        
        return summary

# 使用示例
io_monitor = ClusterIOPerformanceMonitor()

# 模拟添加几个节点的I/O指标
node1_io = {
    "calculated_metrics": {
        "iops_read": 1500,
        "iops_write": 800,
        "throughput_read_mb_per_sec": 45.2,
        "throughput_write_mb_per_sec": 28.7
    }
}

node2_io = {
    "calculated_metrics": {
        "iops_read": 1200,
        "iops_write": 650,
        "throughput_read_mb_per_sec": 38.5,
        "throughput_write_mb_per_sec": 22.1
    }
}

node3_io = {
    "calculated_metrics": {
        "iops_read": 1800,
        "iops_write": 950,
        "throughput_read_mb_per_sec": 52.8,
        "throughput_write_mb_per_sec": 35.4
    }
}

io_monitor.add_node_io_metrics("node-001", node1_io)
io_monitor.add_node_io_metrics("node-002", node2_io)
io_monitor.add_node_io_metrics("node-003", node3_io)

# 生成I/O性能报告
io_report = io_monitor.generate_io_performance_report()
print("集群I/O性能报告:")
print(json.dumps(io_report, indent=2, default=str))

# 获取I/O趋势
io_trend = io_monitor.get_cluster_io_trend(hours=1)
print("\n集群I/O趋势:")
print(json.dumps(io_trend, indent=2, default=str))
```

## 9.1.3 业务层面监控指标

业务层面的监控指标关注分布式文件存储平台对外提供的服务质量和用户体验，通过监控关键业务指标，确保平台能够满足业务需求。

### 9.1.3.1 文件操作性能监控

```python
# 文件操作性能监控
import time
from typing import Dict, List, Any
import statistics
from datetime import datetime, timedelta

class FileOperationMonitor:
    """文件操作监控器"""
    
    def __init__(self):
        self.operation_metrics = []
        self.alert_thresholds = {
            "read_latency_ms": 100,  # 读取延迟阈值
            "write_latency_ms": 200,  # 写入延迟阈值
            "delete_latency_ms": 50,  # 删除延迟阈值
            "error_rate": 0.01  # 错误率阈值
        }
    
    def record_operation(self, operation: str, latency_ms: float, 
                        success: bool = True, file_size_bytes: int = 0,
                        client_id: str = "unknown"):
        """记录文件操作"""
        metric = {
            "operation": operation,
            "latency_ms": latency_ms,
            "success": success,
            "file_size_bytes": file_size_bytes,
            "client_id": client_id,
            "timestamp": datetime.now().isoformat(),
            "unix_timestamp": time.time()
        }
        
        self.operation_metrics.append(metric)
        
        # 保留最近10000条记录
        if len(self.operation_metrics) > 10000:
            self.operation_metrics = self.operation_metrics[-10000:]
    
    def get_operation_summary(self, operation: str = None, 
                            hours: int = 1) -> Dict[str, Any]:
        """获取操作摘要"""
        # 过滤指定时间范围内的数据
        cutoff_time = time.time() - (hours * 3600)
        recent_metrics = [
            m for m in self.operation_metrics 
            if m["unix_timestamp"] >= cutoff_time
        ]
        
        if not recent_metrics:
            return {"message": "指定时间范围内无数据"}
        
        # 如果指定了操作类型，进一步过滤
        if operation:
            recent_metrics = [m for m in recent_metrics if m["operation"] == operation]
            if not recent_metrics:
                return {"message": f"指定时间范围内无{operation}操作数据"}
        
        # 按操作类型分组
        operation_groups = {}
        for metric in recent_metrics:
            op = metric["operation"]
            if op not in operation_groups:
                operation_groups[op] = []
            operation_groups[op].append(metric)
        
        # 计算每个操作类型的统计信息
        summary = {
            "time_range_hours": hours,
            "total_operations": len(recent_metrics),
            "operations_by_type": {}
        }
        
        for op, metrics in operation_groups.items():
            latencies = [m["latency_ms"] for m in metrics]
            successes = [m["success"] for m in metrics]
            file_sizes = [m["file_size_bytes"] for m in metrics if m["file_size_bytes"] > 0]
            
            op_summary = {
                "count": len(metrics),
                "success_rate": sum(successes) / len(successes) * 100,
                "latency_ms": {
                    "avg": statistics.mean(latencies),
                    "min": min(latencies),
                    "max": max(latencies),
                    "p50": statistics.median(latencies),
                    "p95": self._percentile(latencies, 95),
                    "p99": self._percentile(latencies, 99)
                }
            }
            
            # 文件大小统计（如果有文件大小数据）
            if file_sizes:
                op_summary["file_size_bytes"] = {
                    "avg": statistics.mean(file_sizes),
                    "min": min(file_sizes),
                    "max": max(file_sizes),
                    "total": sum(file_sizes)
                }
            
            summary["operations_by_type"][op] = op_summary
        
        return summary
    
    def check_business_alerts(self) -> List[Dict[str, Any]]:
        """检查业务告警"""
        alerts = []
        
        # 获取最近1分钟的操作摘要
        summary = self.get_operation_summary(hours=1/60)  # 1分钟
        
        if "operations_by_type" not in summary:
            return alerts
        
        for operation, stats in summary["operations_by_type"].items():
            # 延迟告警
            avg_latency = stats["latency_ms"]["avg"]
            threshold_key = f"{operation}_latency_ms"
            if threshold_key in self.alert_thresholds:
                threshold = self.alert_thresholds[threshold_key]
                if avg_latency > threshold:
                    alerts.append({
                        "type": f"high_{operation}_latency",
                        "severity": "warning",
                        "message": f"{operation}操作平均延迟过高: {avg_latency:.2f}ms",
                        "threshold": threshold
                    })
            
            # 错误率告警
            error_rate = 100 - stats["success_rate"]
            if error_rate > self.alert_thresholds["error_rate"] * 100:
                alerts.append({
                    "type": f"high_{operation}_error_rate",
                    "severity": "error",
                    "message": f"{operation}操作错误率过高: {error_rate:.2f}%",
                    "threshold": self.alert_thresholds["error_rate"] * 100
                })
        
        return alerts
    
    def get_client_performance(self, client_id: str = None, 
                              hours: int = 1) -> Dict[str, Any]:
        """获取客户端性能数据"""
        # 过滤指定时间范围内的数据
        cutoff_time = time.time() - (hours * 3600)
        recent_metrics = [
            m for m in self.operation_metrics 
            if m["unix_timestamp"] >= cutoff_time
        ]
        
        if not recent_metrics:
            return {"message": "指定时间范围内无数据"}
        
        # 如果指定了客户端ID，进一步过滤
        if client_id:
            recent_metrics = [m for m in recent_metrics if m["client_id"] == client_id]
            if not recent_metrics:
                return {"message": f"指定时间范围内无客户端{client_id}的数据"}
        
        # 按客户端分组
        client_groups = {}
        for metric in recent_metrics:
            client = metric["client_id"]
            if client not in client_groups:
                client_groups[client] = []
            client_groups[client].append(metric)
        
        # 计算每个客户端的性能统计
        client_performance = {}
        for client, metrics in client_groups.items():
            operations_by_type = {}
            total_operations = len(metrics)
            total_latency = sum(m["latency_ms"] for m in metrics)
            
            # 按操作类型分组统计
            for metric in metrics:
                op = metric["operation"]
                if op not in operations_by_type:
                    operations_by_type[op] = []
                operations_by_type[op].append(metric)
            
            client_stats = {
                "total_operations": total_operations,
                "avg_latency_ms": total_latency / total_operations if total_operations > 0 else 0,
                "operations_by_type": {}
            }
            
            # 计算每种操作类型的统计
            for op, op_metrics in operations_by_type.items():
                latencies = [m["latency_ms"] for m in op_metrics]
                successes = [m["success"] for m in op_metrics]
                
                client_stats["operations_by_type"][op] = {
                    "count": len(op_metrics),
                    "success_rate": sum(successes) / len(successes) * 100,
                    "latency_ms": {
                        "avg": statistics.mean(latencies),
                        "min": min(latencies),
                        "max": max(latencies),
                        "p50": statistics.median(latencies)
                    }
                }
            
            client_performance[client] = client_stats
        
        return {
            "time_range_hours": hours,
            "clients": client_performance
        }
    
    def _percentile(self, data: List[float], percentile: float) -> float:
        """计算百分位数"""
        if not data:
            return 0
        
        sorted_data = sorted(data)
        index = (percentile / 100) * (len(sorted_data) - 1)
        
        if index.is_integer():
            return sorted_data[int(index)]
        else:
            lower_index = int(index)
            upper_index = lower_index + 1
            weight = index - lower_index
            return sorted_data[lower_index] * (1 - weight) + sorted_data[upper_index] * weight

# 使用示例
file_monitor = FileOperationMonitor()

# 模拟记录一些文件操作
operations = [
    ("read", 45.2, True, 1024000, "client-001"),
    ("read", 52.1, True, 2048000, "client-001"),
    ("read", 120.5, False, 512000, "client-002"),  # 失败的操作
    ("write", 85.3, True, 1024000, "client-001"),
    ("write", 92.7, True, 2048000, "client-002"),
    ("delete", 25.1, True, 0, "client-001"),
    ("read", 48.3, True, 1024000, "client-003"),
    ("write", 88.9, True, 1536000, "client-003")
]

for op, latency, success, size, client in operations:
    file_monitor.record_operation(op, latency, success, size, client)

# 获取操作摘要
summary = file_monitor.get_operation_summary(hours=1)
print("文件操作摘要:")
print(json.dumps(summary, indent=2, default=str))

# 检查业务告警
alerts = file_monitor.check_business_alerts()
if alerts:
    print("\n触发的业务告警:")
    for alert in alerts:
        print(f"- {alert['message']}")

# 获取客户端性能数据
client_performance = file_monitor.get_client_performance(hours=1)
print("\n客户端性能数据:")
print(json.dumps(client_performance, indent=2, default=str))
```

### 9.1.3.2 存储容量和使用情况监控

```python
# 存储容量和使用情况监控
from typing import Dict, List, Any
import statistics
from datetime import datetime, timedelta

class StorageCapacityMonitor:
    """存储容量监控器"""
    
    def __init__(self):
        self.capacity_history = []
        self.alert_thresholds = {
            "utilization_warning": 80.0,  # 使用率警告阈值
            "utilization_critical": 90.0,  # 使用率严重阈值
            "growth_rate_warning": 5.0  # 日增长率警告阈值 (%)
        }
    
    def update_capacity_metrics(self, total_capacity_bytes: int, 
                              used_capacity_bytes: int,
                              file_count: int, directory_count: int,
                              node_count: int):
        """更新容量指标"""
        free_capacity_bytes = total_capacity_bytes - used_capacity_bytes
        utilization_percent = (used_capacity_bytes / total_capacity_bytes * 100) if total_capacity_bytes > 0 else 0
        
        metrics = {
            "timestamp": datetime.now().isoformat(),
            "unix_timestamp": time.time(),
            "total_capacity_bytes": total_capacity_bytes,
            "used_capacity_bytes": used_capacity_bytes,
            "free_capacity_bytes": free_capacity_bytes,
            "utilization_percent": utilization_percent,
            "file_count": file_count,
            "directory_count": directory_count,
            "node_count": node_count
        }
        
        self.capacity_history.append(metrics)
        
        # 保留最近1000条记录
        if len(self.capacity_history) > 1000:
            self.capacity_history = self.capacity_history[-1000:]
        
        return metrics
    
    def get_capacity_summary(self) -> Dict[str, Any]:
        """获取容量摘要"""
        if not self.capacity_history:
            return {"message": "无容量数据"}
        
        latest = self.capacity_history[-1]
        
        # 计算增长趋势
        growth_info = self._calculate_growth_trend()
        
        summary = {
            "current": {
                "total_capacity_tb": latest["total_capacity_bytes"] / (1024**4),
                "used_capacity_tb": latest["used_capacity_bytes"] / (1024**4),
                "free_capacity_tb": latest["free_capacity_bytes"] / (1024**4),
                "utilization_percent": latest["utilization_percent"],
                "file_count": latest["file_count"],
                "directory_count": latest["directory_count"],
                "node_count": latest["node_count"]
            },
            "growth_trend": growth_info
        }
        
        # 预估容量耗尽时间
        exhaustion_estimate = self._estimate_capacity_exhaustion()
        if exhaustion_estimate:
            summary["capacity_exhaustion_estimate"] = exhaustion_estimate
        
        return summary
    
    def _calculate_growth_trend(self) -> Dict[str, Any]:
        """计算容量增长趋势"""
        if len(self.capacity_history) < 2:
            return {"message": "数据不足，无法计算趋势"}
        
        # 计算最近7天的增长率
        cutoff_time = time.time() - (7 * 24 * 3600)  # 7天前
        recent_data = [m for m in self.capacity_history if m["unix_timestamp"] >= cutoff_time]
        
        if len(recent_data) < 2:
            return {"message": "7天内数据不足"}
        
        # 计算日均增长率
        first_entry = recent_data[0]
        last_entry = recent_data[-1]
        time_diff_days = (last_entry["unix_timestamp"] - first_entry["unix_timestamp"]) / (24 * 3600)
        
        if time_diff_days <= 0:
            return {"message": "时间差计算错误"}
        
        used_growth = last_entry["used_capacity_bytes"] - first_entry["used_capacity_bytes"]
        daily_growth_bytes = used_growth / time_diff_days if time_diff_days > 0 else 0
        daily_growth_rate = (daily_growth_bytes / first_entry["total_capacity_bytes"] * 100) if first_entry["total_capacity_bytes"] > 0 else 0
        
        return {
            "time_range_days": time_diff_days,
            "used_capacity_growth_bytes": used_growth,
            "daily_growth_bytes": daily_growth_bytes,
            "daily_growth_rate_percent": daily_growth_rate
        }
    
    def _estimate_capacity_exhaustion(self) -> Dict[str, Any]:
        """预估容量耗尽时间"""
        growth_trend = self._calculate_growth_trend()
        
        if not isinstance(growth_trend, dict) or "daily_growth_bytes" not in growth_trend:
            return {"message": "无法计算容量耗尽时间"}
        
        if len(self.capacity_history) < 1:
            return {"message": "无数据"}
        
        latest = self.capacity_history[-1]
        daily_growth_bytes = growth_trend["daily_growth_bytes"]
        
        if daily_growth_bytes <= 0:
            return {"message": "容量使用率未增长，无法预估耗尽时间"}
        
        free_bytes = latest["free_capacity_bytes"]
        days_until_full = free_bytes / daily_growth_bytes
        
        # 计算预估日期
        exhaustion_date = datetime.now() + timedelta(days=days_until_full)
        
        return {
            "days_until_full": round(days_until_full, 1),
            "estimated_exhaustion_date": exhaustion_date.isoformat(),
            "daily_growth_tb": daily_growth_bytes / (1024**4)
        }
    
    def check_capacity_alerts(self) -> List[Dict[str, Any]]:
        """检查容量告警"""
        alerts = []
        
        if not self.capacity_history:
            return alerts
        
        latest = self.capacity_history[-1]
        utilization = latest["utilization_percent"]
        
        # 使用率严重告警
        if utilization >= self.alert_thresholds["utilization_critical"]:
            alerts.append({
                "type": "critical_capacity_utilization",
                "severity": "critical",
                "message": f"存储容量使用率过高: {utilization:.2f}%",
                "threshold": self.alert_thresholds["utilization_critical"]
            })
        # 使用率警告告警
        elif utilization >= self.alert_thresholds["utilization_warning"]:
            alerts.append({
                "type": "warning_capacity_utilization",
                "severity": "warning",
                "message": f"存储容量使用率较高: {utilization:.2f}%",
                "threshold": self.alert_thresholds["utilization_warning"]
            })
        
        # 增长率告警
        growth_trend = self._calculate_growth_trend()
        if isinstance(growth_trend, dict) and "daily_growth_rate_percent" in growth_trend:
            daily_growth_rate = growth_trend["daily_growth_rate_percent"]
            if daily_growth_rate >= self.alert_thresholds["growth_rate_warning"]:
                alerts.append({
                    "type": "high_capacity_growth_rate",
                    "severity": "warning",
                    "message": f"存储容量日增长率达到: {daily_growth_rate:.2f}%",
                    "threshold": self.alert_thresholds["growth_rate_warning"]
                })
        
        return alerts
    
    def get_capacity_forecast(self, days_ahead: int = 30) -> Dict[str, Any]:
        """获取容量预测"""
        if not self.capacity_history:
            return {"message": "无历史数据，无法预测"}
        
        latest = self.capacity_history[-1]
        growth_trend = self._calculate_growth_trend()
        
        if not isinstance(growth_trend, dict) or "daily_growth_bytes" not in growth_trend:
            return {"message": "无法计算增长趋势"}
        
        daily_growth_bytes = growth_trend["daily_growth_bytes"]
        current_used = latest["used_capacity_bytes"]
        total_capacity = latest["total_capacity_bytes"]
        
        forecast = []
        current_date = datetime.now()
        
        for i in range(1, days_ahead + 1):
            future_date = current_date + timedelta(days=i)
            projected_used = current_used + (daily_growth_bytes * i)
            projected_utilization = (projected_used / total_capacity * 100) if total_capacity > 0 else 0
            
            forecast.append({
                "date": future_date.isoformat(),
                "used_capacity_tb": projected_used / (1024**4),
                "utilization_percent": projected_utilization
            })
        
        return {
            "forecast_period_days": days_ahead,
            "current_utilization": latest["utilization_percent"],
            "daily_growth_rate_percent": growth_trend.get("daily_growth_rate_percent", 0),
            "forecast": forecast
        }

# 使用示例
capacity_monitor = StorageCapacityMonitor()

# 模拟更新容量指标（多次调用模拟时间序列）
import random

# 初始状态
total_capacity = 100 * 1024**4  # 100TB
used_capacity = 30 * 1024**4    # 30TB
file_count = 100000
directory_count = 5000
node_count = 5

for i in range(10):
    # 模拟每天的容量增长
    daily_growth = random.uniform(0.5, 2) * 1024**4  # 0.5-2TB每天
    used_capacity += daily_growth
    file_count += random.randint(1000, 5000)
    
    metrics = capacity_monitor.update_capacity_metrics(
        total_capacity, used_capacity, file_count, directory_count, node_count
    )
    
    print(f"第{i+1}天容量更新: 使用率 {metrics['utilization_percent']:.2f}%")
    time.sleep(0.1)  # 模拟时间间隔

# 获取容量摘要
summary = capacity_monitor.get_capacity_summary()
print("\n容量摘要:")
print(json.dumps(summary, indent=2, default=str))

# 检查容量告警
alerts = capacity_monitor.check_capacity_alerts()
if alerts:
    print("\n触发的容量告警:")
    for alert in alerts:
        print(f"- {alert['message']}")

# 获取容量预测
forecast = capacity_monitor.get_capacity_forecast(days_ahead=30)
print("\n30天容量预测:")
print(json.dumps(forecast, indent=2, default=str))
```

## 总结

监控指标体系建设是分布式文件存储平台可观测性的核心组成部分。通过建立完善的节点、集群和业务层面的监控体系，我们能够：

1. **实时了解系统状态**：通过持续采集和分析关键指标，及时发现系统异常和性能瓶颈。

2. **预防性维护**：基于历史数据和趋势分析，预测潜在问题并提前采取措施。

3. **优化系统性能**：通过深入分析各项指标，找出性能瓶颈并进行针对性优化。

4. **提升用户体验**：通过业务层面的监控，确保平台能够满足用户的性能和可用性要求。

在实际部署中，需要根据具体的业务场景和系统架构，合理设置监控指标的采集频率、存储策略和告警阈值，确保监控系统既能提供足够的信息，又不会对系统性能造成过大负担。