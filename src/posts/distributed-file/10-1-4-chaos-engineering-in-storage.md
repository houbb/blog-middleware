---
title: "混沌工程在存储系统中的应用实践"
date: 2025-09-07
categories: [DistributedFile]
tags: [DistributedFile]
published: true
---

混沌工程（Chaos Engineering）是一种通过在系统中引入受控的故障来提高系统弹性和可靠性的实践方法。在分布式文件存储系统中，混沌工程可以帮助我们发现系统中的潜在问题，验证故障处理机制的有效性，并提高系统的整体稳定性。

## 10.4.1 混沌工程基础理论

混沌工程的核心思想是在生产环境中进行受控的实验，通过观察系统在各种故障条件下的表现来识别系统的薄弱环节。这种方法比传统的测试方法更加有效，因为它能够揭示在实验室环境中难以复现的真实世界问题。

### 10.4.1.1 混沌工程原则

```python
# 混沌工程框架实现
import time
import threading
from typing import Dict, List, Any, Optional, Callable, Set
from datetime import datetime, timedelta
import random
import json

class ChaosExperiment:
    """混沌实验"""
    
    def __init__(self, experiment_id: str, name: str, description: str):
        self.experiment_id = experiment_id
        self.name = name
        self.description = description
        self.status = "pending"  # pending, running, completed, failed
        self.start_time: Optional[datetime] = None
        self.end_time: Optional[datetime] = None
        self.configuration: Dict[str, Any] = {}
        self.targets: List[str] = []
        self.actions: List[Dict[str, Any]] = []
        self.verifications: List[Dict[str, Any]] = []
        self.results: Dict[str, Any] = {}

class ChaosPrinciple:
    """混沌工程原则"""
    
    def __init__(self):
        self.principles = [
            "构建假设：围绕稳态行为建立假设",
            "多样化现实：多样化真实世界的事件",
            "在生产环境中运行实验",
            "自动化实验以推动流程",
            "最小化影响：将负面影响降到最低"
        ]
    
    def get_principles(self) -> List[str]:
        """获取混沌工程原则"""
        return self.principles.copy()
    
    def validate_experiment(self, experiment: ChaosExperiment) -> bool:
        """验证实验是否符合混沌工程原则"""
        violations = []
        
        # 检查是否建立了假设
        if not experiment.configuration.get("hypothesis"):
            violations.append("实验缺少明确的假设")
        
        # 检查是否在生产环境中（模拟检查）
        if not experiment.configuration.get("production_environment", False):
            violations.append("实验未在生产环境中运行")
        
        # 检查是否有最小化影响的措施
        if not experiment.configuration.get("blast_radius_limitation"):
            violations.append("实验缺少影响范围限制")
        
        if violations:
            print(f"实验 {experiment.experiment_id} 违反混沌工程原则:")
            for violation in violations:
                print(f"  - {violation}")
            return False
        
        print(f"实验 {experiment.experiment_id} 符合混沌工程原则")
        return True

class ChaosHypothesis:
    """混沌假设"""
    
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
        self.metrics: List[Dict[str, Any]] = []
        self.tolerance: float = 0.95  # 95%的容忍度
    
    def add_metric(self, metric_name: str, expected_value: Any, 
                   tolerance: float = 0.95):
        """添加指标"""
        self.metrics.append({
            "name": metric_name,
            "expected": expected_value,
            "tolerance": tolerance
        })
    
    def validate(self, actual_metrics: Dict[str, Any]) -> Dict[str, Any]:
        """验证假设"""
        results = {
            "passed": True,
            "metric_results": [],
            "overall_score": 1.0
        }
        
        passed_count = 0
        total_count = len(self.metrics)
        
        for metric in self.metrics:
            metric_name = metric["name"]
            expected = metric["expected"]
            tolerance = metric["tolerance"]
            actual = actual_metrics.get(metric_name)
            
            # 简化的验证逻辑
            if actual is not None:
                # 对于数值类型指标
                if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
                    diff_ratio = abs(actual - expected) / expected if expected != 0 else 0
                    passed = diff_ratio <= (1 - tolerance)
                # 对于布尔类型指标
                elif isinstance(expected, bool) and isinstance(actual, bool):
                    passed = expected == actual
                # 对于其他类型
                else:
                    passed = expected == actual
            else:
                passed = False
            
            metric_result = {
                "metric": metric_name,
                "expected": expected,
                "actual": actual,
                "passed": passed
            }
            results["metric_results"].append(metric_result)
            
            if passed:
                passed_count += 1
        
        results["overall_score"] = passed_count / total_count if total_count > 0 else 1.0
        results["passed"] = results["overall_score"] >= self.tolerance
        
        return results

# 使用示例
def demonstrate_chaos_principles():
    """演示混沌工程原则"""
    # 创建原则验证器
    principle = ChaosPrinciple()
    
    # 显示原则
    print("混沌工程原则:")
    for i, p in enumerate(principle.get_principles(), 1):
        print(f"  {i}. {p}")
    
    # 创建实验
    experiment = ChaosExperiment(
        "exp-001",
        "网络延迟测试",
        "测试网络延迟对存储系统性能的影响"
    )
    
    # 配置实验
    experiment.configuration = {
        "hypothesis": "网络延迟增加50%不会导致系统不可用",
        "production_environment": True,
        "blast_radius_limitation": "仅影响单个数据中心"
    }
    
    # 验证实验
    principle.validate_experiment(experiment)
    
    # 创建假设
    hypothesis = ChaosHypothesis(
        "性能稳定性假设",
        "系统在故障条件下仍能保持95%的正常性能"
    )
    hypothesis.add_metric("read_latency_ms", 50, 0.90)
    hypothesis.add_metric("write_latency_ms", 100, 0.90)
    hypothesis.add_metric("system_availability", True, 0.95)
    
    # 验证假设（模拟实际指标）
    actual_metrics = {
        "read_latency_ms": 55,  # 略高于预期
        "write_latency_ms": 95,  # 略低于预期
        "system_availability": True
    }
    
    validation_result = hypothesis.validate(actual_metrics)
    print(f"\n假设验证结果:")
    print(f"  总体通过: {validation_result['passed']}")
    print(f"  总体得分: {validation_result['overall_score']:.2%}")
    print(f"  指标详情:")
    for result in validation_result["metric_results"]:
        status = "通过" if result["passed"] else "失败"
        print(f"    {result['metric']}: {result['actual']} (期望: {result['expected']}) [{status}]")

# 运行演示
# demonstrate_chaos_principles()
```

### 10.4.1.2 混沌实验设计方法

```python
# 混沌实验设计
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime, timedelta
import random
import time

class ChaosExperimentDesigner:
    """混沌实验设计器"""
    
    def __init__(self):
        self.experiment_templates: Dict[str, Dict[str, Any]] = {}
        self.design_patterns: List[str] = [
            "故障注入",
            "负载测试",
            "资源配置",
            "网络干扰",
            "时钟偏移"
        ]
    
    def add_experiment_template(self, template_id: str, template: Dict[str, Any]):
        """添加实验模板"""
        self.experiment_templates[template_id] = template
        print(f"实验模板 {template_id} 已添加")
    
    def get_design_patterns(self) -> List[str]:
        """获取设计模式"""
        return self.design_patterns.copy()
    
    def design_experiment(self, system_type: str, failure_mode: str) -> ChaosExperiment:
        """设计混沌实验"""
        experiment_id = f"chaos-{int(time.time()*1000)}-{random.randint(1000, 9999)}"
        
        # 根据系统类型和故障模式选择模板
        template = self._select_template(system_type, failure_mode)
        
        experiment = ChaosExperiment(
            experiment_id,
            template.get("name", f"{system_type} {failure_mode} 测试"),
            template.get("description", f"测试{system_type}系统在{failure_mode}条件下的表现")
        )
        
        # 应用模板配置
        experiment.configuration = template.get("configuration", {}).copy()
        experiment.targets = template.get("targets", []).copy()
        experiment.actions = template.get("actions", []).copy()
        experiment.verifications = template.get("verifications", []).copy()
        
        print(f"设计混沌实验: {experiment.name}")
        print(f"  实验ID: {experiment.experiment_id}")
        print(f"  目标: {len(experiment.targets)} 个")
        print(f"  动作: {len(experiment.actions)} 个")
        print(f"  验证: {len(experiment.verifications)} 个")
        
        return experiment
    
    def _select_template(self, system_type: str, failure_mode: str) -> Dict[str, Any]:
        """选择实验模板"""
        # 简化实现，实际中会根据系统类型和故障模式选择合适的模板
        template_key = f"{system_type}-{failure_mode}"
        
        if template_key in self.experiment_templates:
            return self.experiment_templates[template_key]
        
        # 默认模板
        return {
            "name": f"{system_type} {failure_mode} 测试",
            "description": f"测试{system_type}系统在{failure_mode}条件下的表现",
            "configuration": {
                "hypothesis": f"系统在{failure_mode}条件下仍能正常运行",
                "production_environment": True,
                "blast_radius_limitation": "最小化影响范围"
            },
            "targets": ["sample-target"],
            "actions": [{"type": "sample-action", "parameters": {}}],
            "verifications": [{"type": "sample-verification", "metrics": []}]
        }
    
    def generate_experiment_report(self, experiment: ChaosExperiment) -> Dict[str, Any]:
        """生成实验报告"""
        duration = None
        if experiment.start_time and experiment.end_time:
            duration = experiment.end_time - experiment.start_time
        
        report = {
            "experiment_id": experiment.experiment_id,
            "name": experiment.name,
            "status": experiment.status,
            "duration": str(duration) if duration else "N/A",
            "targets": experiment.targets,
            "actions_count": len(experiment.actions),
            "verifications_count": len(experiment.verifications),
            "results": experiment.results,
            "generated_at": datetime.now().isoformat()
        }
        
        return report

class ChaosFailureMode:
    """故障模式定义"""
    
    def __init__(self):
        self.failure_modes = {
            "storage": [
                "磁盘故障",
                "磁盘满",
                "IO延迟",
                "数据损坏"
            ],
            "network": [
                "网络分区",
                "网络延迟",
                "网络丢包",
                "带宽限制"
            ],
            "compute": [
                "CPU过载",
                "内存不足",
                "进程崩溃",
                "时钟偏移"
            ],
            "system": [
                "内核崩溃",
                "文件系统损坏",
                "权限问题",
                "配置错误"
            ]
        }
    
    def get_failure_modes(self, system_type: str) -> List[str]:
        """获取指定系统的故障模式"""
        return self.failure_modes.get(system_type, [])
    
    def get_all_failure_modes(self) -> Dict[str, List[str]]:
        """获取所有故障模式"""
        return self.failure_modes.copy()

# 使用示例
def demonstrate_experiment_design():
    """演示实验设计"""
    # 创建实验设计器
    designer = ChaosExperimentDesigner()
    
    # 添加实验模板
    designer.add_experiment_template("storage-disk-failure", {
        "name": "存储磁盘故障测试",
        "description": "测试存储系统在磁盘故障时的表现",
        "configuration": {
            "hypothesis": "系统在单个磁盘故障时仍能保持数据完整性和服务可用性",
            "production_environment": True,
            "blast_radius_limitation": "仅影响单个磁盘"
        },
        "targets": ["storage-node-1"],
        "actions": [
            {
                "type": "disk_failure",
                "parameters": {
                    "disk_id": "disk-001",
                    "failure_type": "io_error"
                }
            }
        ],
        "verifications": [
            {
                "type": "data_integrity_check",
                "metrics": ["data_consistency", "service_availability"]
            }
        ]
    })
    
    # 显示设计模式
    print("混沌实验设计模式:")
    for pattern in designer.get_design_patterns():
        print(f"  - {pattern}")
    
    # 显示故障模式
    failure_mode = ChaosFailureMode()
    print("\n故障模式:")
    all_modes = failure_mode.get_all_failure_modes()
    for system_type, modes in all_modes.items():
        print(f"  {system_type}: {', '.join(modes)}")
    
    # 设计实验
    print("\n设计实验:")
    experiment = designer.design_experiment("storage", "磁盘故障")
    
    # 生成实验报告模板
    report = designer.generate_experiment_report(experiment)
    print(f"\n实验报告模板:")
    print(f"  实验名称: {report['name']}")
    print(f"  实验状态: {report['status']}")
    print(f"  目标数量: {len(report['targets'])}")

# 运行演示
# demonstrate_experiment_design()
```

## 10.4.2 存储系统故障注入

在分布式文件存储系统中，故障注入是混沌工程的核心实践之一。通过向系统注入各种类型的故障，我们可以验证系统的容错能力和恢复机制。

### 10.4.2.1 磁盘故障注入

```python
# 磁盘故障注入实现
import time
import threading
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime, timedelta
import random
import os

class DiskFaultInjector:
    """磁盘故障注入器"""
    
    def __init__(self):
        self.injected_faults: Dict[str, Dict[str, Any]] = {}
        self.fault_callbacks: List[Callable[[str, Dict[str, Any]], None]] = []
        self.inject_lock = threading.Lock()
    
    def add_fault_callback(self, callback: Callable[[str, Dict[str, Any]], None]):
        """添加故障回调"""
        self.fault_callbacks.append(callback)
    
    def inject_io_error(self, disk_id: str, error_rate: float = 0.1) -> str:
        """注入IO错误"""
        fault_id = f"fault-{int(time.time()*1000)}-{random.randint(1000, 9999)}"
        
        fault_info = {
            "fault_id": fault_id,
            "disk_id": disk_id,
            "fault_type": "io_error",
            "error_rate": error_rate,
            "start_time": datetime.now(),
            "end_time": None,
            "status": "active"
        }
        
        with self.inject_lock:
            self.injected_faults[fault_id] = fault_info
        
        print(f"注入磁盘 {disk_id} IO错误故障 (错误率: {error_rate:.1%})")
        
        # 调用故障回调
        for callback in self.fault_callbacks:
            try:
                callback(fault_id, fault_info)
            except Exception as e:
                print(f"调用故障回调时出错: {e}")
        
        return fault_id
    
    def inject_disk_full(self, disk_id: str, fill_percentage: float = 0.95) -> str:
        """注入磁盘满故障"""
        fault_id = f"fault-{int(time.time()*1000)}-{random.randint(1000, 9999)}"
        
        fault_info = {
            "fault_id": fault_id,
            "disk_id": disk_id,
            "fault_type": "disk_full",
            "fill_percentage": fill_percentage,
            "start_time": datetime.now(),
            "end_time": None,
            "status": "active"
        }
        
        with self.inject_lock:
            self.injected_faults[fault_id] = fault_info
        
        print(f"注入磁盘 {disk_id} 空间满故障 (填充率: {fill_percentage:.1%})")
        
        # 调用故障回调
        for callback in self.fault_callbacks:
            try:
                callback(fault_id, fault_info)
            except Exception as e:
                print(f"调用故障回调时出错: {e}")
        
        return fault_id
    
    def inject_latency(self, disk_id: str, latency_ms: int = 1000) -> str:
        """注入磁盘延迟"""
        fault_id = f"fault-{int(time.time()*1000)}-{random.randint(1000, 9999)}"
        
        fault_info = {
            "fault_id": fault_id,
            "disk_id": disk_id,
            "fault_type": "latency",
            "latency_ms": latency_ms,
            "start_time": datetime.now(),
            "end_time": None,
            "status": "active"
        }
        
        with self.inject_lock:
            self.injected_faults[fault_id] = fault_info
        
        print(f"注入磁盘 {disk_id} 延迟故障 ({latency_ms}ms)")
        
        # 调用故障回调
        for callback in self.fault_callbacks:
            try:
                callback(fault_id, fault_info)
            except Exception as e:
                print(f"调用故障回调时出错: {e}")
        
        return fault_id
    
    def inject_data_corruption(self, disk_id: str, corruption_rate: float = 0.01) -> str:
        """注入数据损坏"""
        fault_id = f"fault-{int(time.time()*1000)}-{random.randint(1000, 9999)}"
        
        fault_info = {
            "fault_id": fault_id,
            "disk_id": disk_id,
            "fault_type": "data_corruption",
            "corruption_rate": corruption_rate,
            "start_time": datetime.now(),
            "end_time": None,
            "status": "active"
        }
        
        with self.inject_lock:
            self.injected_faults[fault_id] = fault_info
        
        print(f"注入磁盘 {disk_id} 数据损坏故障 (损坏率: {corruption_rate:.1%})")
        
        # 调用故障回调
        for callback in self.fault_callbacks:
            try:
                callback(fault_id, fault_info)
            except Exception as e:
                print(f"调用故障回调时出错: {e}")
        
        return fault_id
    
    def remove_fault(self, fault_id: str) -> bool:
        """移除故障"""
        with self.inject_lock:
            if fault_id not in self.injected_faults:
                return False
            
            fault_info = self.injected_faults[fault_id]
            fault_info["status"] = "removed"
            fault_info["end_time"] = datetime.now()
            
            print(f"移除故障 {fault_id} ({fault_info['fault_type']})")
            return True
    
    def get_active_faults(self) -> List[Dict[str, Any]]:
        """获取活跃故障"""
        with self.inject_lock:
            return [info.copy() for info in self.injected_faults.values() 
                   if info["status"] == "active"]
    
    def get_fault_info(self, fault_id: str) -> Dict[str, Any]:
        """获取故障信息"""
        with self.inject_lock:
            if fault_id not in self.injected_faults:
                return {"error": "故障不存在"}
            return self.injected_faults[fault_id].copy()

class StorageSystemSimulator:
    """存储系统模拟器"""
    
    def __init__(self):
        self.disks: Dict[str, Dict[str, Any]] = {}
        self.io_operations: List[Dict[str, Any]] = []
        self.fault_injector = DiskFaultInjector()
        self.simulation_thread: Optional[threading.Thread] = None
        self.simulating = False
    
    def add_disk(self, disk_id: str, path: str, capacity_gb: int):
        """添加磁盘"""
        self.disks[disk_id] = {
            "path": path,
            "capacity_gb": capacity_gb,
            "used_gb": 0,
            "status": "healthy"
        }
        print(f"添加磁盘 {disk_id}: {path} ({capacity_gb}GB)")
    
    def simulate_io_operation(self, disk_id: str, operation: str, 
                           data_size_kb: int = 1024) -> Dict[str, Any]:
        """模拟IO操作"""
        if disk_id not in self.disks:
            return {"error": "磁盘不存在"}
        
        disk_info = self.disks[disk_id]
        operation_id = f"io-{int(time.time()*1000)}-{random.randint(1000, 9999)}"
        
        # 检查是否有活跃的故障
        active_faults = self.fault_injector.get_active_faults()
        disk_faults = [f for f in active_faults if f["disk_id"] == disk_id]
        
        result = {
            "operation_id": operation_id,
            "disk_id": disk_id,
            "operation": operation,
            "data_size_kb": data_size_kb,
            "start_time": datetime.now(),
            "end_time": None,
            "duration_ms": 0,
            "success": True,
            "error": None,
            "applied_faults": []
        }
        
        # 模拟故障影响
        for fault in disk_faults:
            result["applied_faults"].append(fault["fault_id"])
            
            if fault["fault_type"] == "io_error":
                # 模拟IO错误
                if random.random() < fault["error_rate"]:
                    result["success"] = False
                    result["error"] = "IO错误"
                    break
            elif fault["fault_type"] == "disk_full":
                # 检查磁盘空间
                if disk_info["used_gb"] / disk_info["capacity_gb"] > fault["fill_percentage"]:
                    result["success"] = False
                    result["error"] = "磁盘空间不足"
                    break
            elif fault["fault_type"] == "latency":
                # 增加延迟
                time.sleep(fault["latency_ms"] / 1000.0)
            elif fault["fault_type"] == "data_corruption":
                # 模拟数据损坏
                if random.random() < fault["corruption_rate"]:
                    result["success"] = False
                    result["error"] = "数据校验失败"
                    break
        
        # 模拟正常IO操作时间
        if result["success"]:
            base_latency = random.uniform(1, 10)  # 1-10ms基础延迟
            time.sleep(base_latency / 1000.0)
            
            # 更新磁盘使用情况（写操作）
            if operation == "write":
                disk_info["used_gb"] += data_size_kb / 1024 / 1024  # 转换为GB
        
        result["end_time"] = datetime.now()
        result["duration_ms"] = (result["end_time"] - result["start_time"]).total_seconds() * 1000
        
        self.io_operations.append(result)
        return result
    
    def get_disk_status(self, disk_id: str) -> Dict[str, Any]:
        """获取磁盘状态"""
        if disk_id not in self.disks:
            return {"error": "磁盘不存在"}
        return self.disks[disk_id].copy()
    
    def start_simulation(self, operations_per_second: int = 10):
        """开始模拟"""
        if self.simulating:
            return
        
        self.simulating = True
        self.simulation_thread = threading.Thread(
            target=self._simulation_loop, 
            args=(operations_per_second,)
        )
        self.simulation_thread.daemon = True
        self.simulation_thread.start()
        print(f"开始存储系统模拟 ({operations_per_second} 操作/秒)")
    
    def stop_simulation(self):
        """停止模拟"""
        self.simulating = False
        if self.simulation_thread:
            self.simulation_thread.join(timeout=5)
        print("存储系统模拟已停止")
    
    def _simulation_loop(self, ops_per_second: int):
        """模拟循环"""
        interval = 1.0 / ops_per_second
        operation_types = ["read", "write"]
        
        while self.simulating:
            try:
                # 随机选择磁盘和操作类型
                if self.disks:
                    disk_id = random.choice(list(self.disks.keys()))
                    operation = random.choice(operation_types)
                    data_size = random.randint(1, 10240)  # 1KB-10MB
                    
                    # 执行IO操作
                    result = self.simulate_io_operation(disk_id, operation, data_size)
                    
                    # 输出结果（仅失败的操作）
                    if not result["success"]:
                        print(f"IO操作失败: {result['operation']} on {result['disk_id']} - {result['error']}")
                
                time.sleep(interval)
            except Exception as e:
                print(f"模拟循环出错: {e}")

# 故障回调函数
def on_disk_fault(fault_id: str, fault_info: Dict[str, Any]):
    """磁盘故障回调"""
    print(f"检测到磁盘故障: {fault_info['fault_type']} on {fault_info['disk_id']}")

# 使用示例
def demonstrate_disk_fault_injection():
    """演示磁盘故障注入"""
    # 创建存储系统模拟器
    storage_sim = StorageSystemSimulator()
    storage_sim.fault_injector.add_fault_callback(on_disk_fault)
    
    # 添加磁盘
    storage_sim.add_disk("disk-001", "/data/disk1", 1000)
    storage_sim.add_disk("disk-002", "/data/disk2", 1000)
    storage_sim.add_disk("disk-003", "/data/disk3", 1000)
    
    # 开始模拟
    storage_sim.start_simulation(operations_per_second=5)
    
    # 注入不同类型的故障
    print("\n注入IO错误故障...")
    fault1 = storage_sim.fault_injector.inject_io_error("disk-001", error_rate=0.2)
    time.sleep(5)
    
    print("\n注入磁盘满故障...")
    fault2 = storage_sim.fault_injector.inject_disk_full("disk-002", fill_percentage=0.8)
    time.sleep(5)
    
    print("\n注入延迟故障...")
    fault3 = storage_sim.fault_injector.inject_latency("disk-003", latency_ms=500)
    time.sleep(5)
    
    # 移除故障
    print("\n移除故障...")
    storage_sim.fault_injector.remove_fault(fault1)
    storage_sim.fault_injector.remove_fault(fault2)
    storage_sim.fault_injector.remove_fault(fault3)
    
    # 继续运行一段时间
    time.sleep(10)
    
    # 停止模拟
    storage_sim.stop_simulation()
    
    # 显示最终统计
    print(f"\n最终统计:")
    print(f"  总IO操作数: {len(storage_sim.io_operations)}")
    failed_ops = [op for op in storage_sim.io_operations if not op["success"]]
    print(f"  失败操作数: {len(failed_ops)}")
    print(f"  失败率: {len(failed_ops)/len(storage_sim.io_operations):.2%}" if storage_sim.io_operations else "N/A")

# 运行演示
# demonstrate_disk_fault_injection()
```

### 10.4.2.2 网络故障注入

```python
# 网络故障注入实现
import time
import threading
from typing import Dict, List, Any, Optional, Callable, Set
from datetime import datetime, timedelta
import random

class NetworkFaultInjector:
    """网络故障注入器"""
    
    def __init__(self):
        self.injected_faults: Dict[str, Dict[str, Any]] = {}
        self.network_topology: Dict[str, Set[str]] = {}
        self.fault_callbacks: List[Callable[[str, Dict[str, Any]], None]] = []
        self.inject_lock = threading.Lock()
    
    def add_fault_callback(self, callback: Callable[[str, Dict[str, Any]], None]):
        """添加故障回调"""
        self.fault_callbacks.append(callback)
    
    def add_node(self, node_id: str, connections: List[str]):
        """添加节点及其连接"""
        self.network_topology[node_id] = set(connections)
        print(f"添加节点 {node_id} 及其连接: {connections}")
    
    def inject_network_partition(self, partitioned_nodes: List[str]) -> str:
        """注入网络分区"""
        fault_id = f"fault-{int(time.time()*1000)}-{random.randint(1000, 9999)}"
        
        # 断开分区节点与其他节点的连接
        affected_connections = []
        for node in partitioned_nodes:
            if node in self.network_topology:
                original_connections = self.network_topology[node].copy()
                # 移除与非分区节点的连接
                new_connections = self.network_topology[node].intersection(set(partitioned_nodes))
                self.network_topology[node] = new_connections
                affected_connections.append({
                    "node": node,
                    "original": list(original_connections),
                    "new": list(new_connections)
                })
        
        fault_info = {
            "fault_id": fault_id,
            "fault_type": "network_partition",
            "partitioned_nodes": partitioned_nodes,
            "affected_connections": affected_connections,
            "start_time": datetime.now(),
            "end_time": None,
            "status": "active"
        }
        
        with self.inject_lock:
            self.injected_faults[fault_id] = fault_info
        
        print(f"注入网络分区故障，隔离节点: {partitioned_nodes}")
        
        # 调用故障回调
        for callback in self.fault_callbacks:
            try:
                callback(fault_id, fault_info)
            except Exception as e:
                print(f"调用故障回调时出错: {e}")
        
        return fault_id
    
    def inject_latency(self, source_node: str, target_node: str, 
                      latency_ms: int = 1000) -> str:
        """注入网络延迟"""
        fault_id = f"fault-{int(time.time()*1000)}-{random.randint(1000, 9999)}"
        
        fault_info = {
            "fault_id": fault_id,
            "fault_type": "network_latency",
            "source_node": source_node,
            "target_node": target_node,
            "latency_ms": latency_ms,
            "start_time": datetime.now(),
            "end_time": None,
            "status": "active"
        }
        
        with self.inject_lock:
            self.injected_faults[fault_id] = fault_info
        
        print(f"注入网络延迟故障: {source_node} -> {target_node} ({latency_ms}ms)")
        
        # 调用故障回调
        for callback in self.fault_callbacks:
            try:
                callback(fault_id, fault_info)
            except Exception as e:
                print(f"调用故障回调时出错: {e}")
        
        return fault_id
    
    def inject_packet_loss(self, source_node: str, target_node: str, 
                          loss_rate: float = 0.1) -> str:
        """注入网络丢包"""
        fault_id = f"fault-{int(time.time()*1000)}-{random.randint(1000, 9999)}"
        
        fault_info = {
            "fault_id": fault_id,
            "fault_type": "packet_loss",
            "source_node": source_node,
            "target_node": target_node,
            "loss_rate": loss_rate,
            "start_time": datetime.now(),
            "end_time": None,
            "status": "active"
        }
        
        with self.inject_lock:
            self.injected_faults[fault_id] = fault_info
        
        print(f"注入网络丢包故障: {source_node} -> {target_node} (丢包率: {loss_rate:.1%})")
        
        # 调用故障回调
        for callback in self.fault_callbacks:
            try:
                callback(fault_id, fault_info)
            except Exception as e:
                print(f"调用故障回调时出错: {e}")
        
        return fault_id
    
    def inject_bandwidth_limit(self, source_node: str, target_node: str, 
                             bandwidth_mbps: float = 1.0) -> str:
        """注入带宽限制"""
        fault_id = f"fault-{int(time.time()*1000)}-{random.randint(1000, 9999)}"
        
        fault_info = {
            "fault_id": fault_id,
            "fault_type": "bandwidth_limit",
            "source_node": source_node,
            "target_node": target_node,
            "bandwidth_mbps": bandwidth_mbps,
            "start_time": datetime.now(),
            "end_time": None,
            "status": "active"
        }
        
        with self.inject_lock:
            self.injected_faults[fault_id] = fault_info
        
        print(f"注入带宽限制故障: {source_node} -> {target_node} ({bandwidth_mbps} Mbps)")
        
        # 调用故障回调
        for callback in self.fault_callbacks:
            try:
                callback(fault_id, fault_info)
            except Exception as e:
                print(f"调用故障回调时出错: {e}")
        
        return fault_id
    
    def remove_fault(self, fault_id: str) -> bool:
        """移除故障"""
        with self.inject_lock:
            if fault_id not in self.injected_faults:
                return False
            
            fault_info = self.injected_faults[fault_id]
            fault_info["status"] = "removed"
            fault_info["end_time"] = datetime.now()
            
            # 恢复网络连接（针对网络分区）
            if fault_info["fault_type"] == "network_partition":
                self._restore_network_partition(fault_info)
            
            print(f"移除网络故障 {fault_id} ({fault_info['fault_type']})")
            return True
    
    def _restore_network_partition(self, fault_info: Dict[str, Any]):
        """恢复网络分区"""
        affected_connections = fault_info.get("affected_connections", [])
        for conn_info in affected_connections:
            node = conn_info["node"]
            original_connections = conn_info["original"]
            if node in self.network_topology:
                self.network_topology[node] = set(original_connections)
    
    def get_active_faults(self) -> List[Dict[str, Any]]:
        """获取活跃故障"""
        with self.inject_lock:
            return [info.copy() for info in self.injected_faults.values() 
                   if info["status"] == "active"]
    
    def get_network_topology(self) -> Dict[str, Set[str]]:
        """获取网络拓扑"""
        return {node: connections.copy() for node, connections in self.network_topology.items()}
    
    def simulate_network_operation(self, source_node: str, target_node: str) -> Dict[str, Any]:
        """模拟网络操作"""
        operation_id = f"net-{int(time.time()*1000)}-{random.randint(1000, 9999)}"
        
        result = {
            "operation_id": operation_id,
            "source_node": source_node,
            "target_node": target_node,
            "start_time": datetime.now(),
            "end_time": None,
            "duration_ms": 0,
            "success": True,
            "error": None,
            "applied_faults": []
        }
        
        # 检查节点是否存在
        if source_node not in self.network_topology or target_node not in self.network_topology:
            result["success"] = False
            result["error"] = "节点不存在"
            result["end_time"] = datetime.now()
            result["duration_ms"] = (result["end_time"] - result["start_time"]).total_seconds() * 1000
            return result
        
        # 检查连接是否存在
        if target_node not in self.network_topology[source_node]:
            result["success"] = False
            result["error"] = "节点间无连接"
            result["end_time"] = datetime.now()
            result["duration_ms"] = (result["end_time"] - result["start_time"]).total_seconds() * 1000
            return result
        
        # 检查是否有活跃的网络故障
        active_faults = self.get_active_faults()
        applied_faults = []
        
        for fault in active_faults:
            if fault["fault_type"] == "network_partition":
                # 检查是否涉及分区节点
                partitioned_nodes = set(fault["partitioned_nodes"])
                if source_node in partitioned_nodes and target_node not in partitioned_nodes:
                    result["success"] = False
                    result["error"] = "网络分区隔离"
                    applied_faults.append(fault["fault_id"])
                    break
                elif source_node not in partitioned_nodes and target_node in partitioned_nodes:
                    result["success"] = False
                    result["error"] = "网络分区隔离"
                    applied_faults.append(fault["fault_id"])
                    break
            elif fault["fault_type"] == "network_latency":
                # 检查是否匹配源和目标节点
                if (fault["source_node"] == source_node and 
                    fault["target_node"] == target_node):
                    # 增加延迟
                    time.sleep(fault["latency_ms"] / 1000.0)
                    applied_faults.append(fault["fault_id"])
            elif fault["fault_type"] == "packet_loss":
                # 检查是否匹配源和目标节点
                if (fault["source_node"] == source_node and 
                    fault["target_node"] == target_node):
                    # 模拟丢包
                    if random.random() < fault["loss_rate"]:
                        result["success"] = False
                        result["error"] = "网络丢包"
                        applied_faults.append(fault["fault_id"])
                        break
            elif fault["fault_type"] == "bandwidth_limit":
                # 检查是否匹配源和目标节点
                if (fault["source_node"] == source_node and 
                    fault["target_node"] == target_node):
                    # 模拟带宽限制（简化实现）
                    # 在实际实现中，会根据数据大小和带宽限制计算传输时间
                    applied_faults.append(fault["fault_id"])
        
        result["applied_faults"] = applied_faults
        
        # 模拟正常网络延迟
        if result["success"]:
            base_latency = random.uniform(0.1, 5.0)  # 0.1-5ms基础延迟
            time.sleep(base_latency / 1000.0)
        
        result["end_time"] = datetime.now()
        result["duration_ms"] = (result["end_time"] - result["start_time"]).total_seconds() * 1000
        
        return result

class NetworkSystemSimulator:
    """网络系统模拟器"""
    
    def __init__(self):
        self.fault_injector = NetworkFaultInjector()
        self.network_operations: List[Dict[str, Any]] = []
        self.simulation_thread: Optional[threading.Thread] = None
        self.simulating = False
    
    def add_node(self, node_id: str, connections: List[str]):
        """添加节点"""
        self.fault_injector.add_node(node_id, connections)
    
    def simulate_network_traffic(self, operations_per_second: int = 10):
        """模拟网络流量"""
        if self.simulating:
            return
        
        self.simulating = True
        self.simulation_thread = threading.Thread(
            target=self._traffic_simulation_loop, 
            args=(operations_per_second,)
        )
        self.simulation_thread.daemon = True
        self.simulation_thread.start()
        print(f"开始网络流量模拟 ({operations_per_second} 操作/秒)")
    
    def stop_simulation(self):
        """停止模拟"""
        self.simulating = False
        if self.simulation_thread:
            self.simulation_thread.join(timeout=5)
        print("网络流量模拟已停止")
    
    def _traffic_simulation_loop(self, ops_per_second: int):
        """流量模拟循环"""
        interval = 1.0 / ops_per_second
        nodes = list(self.fault_injector.network_topology.keys())
        
        while self.simulating:
            try:
                # 随机选择源节点和目标节点
                if len(nodes) >= 2:
                    source_node = random.choice(nodes)
                    target_node = random.choice([n for n in nodes if n != source_node])
                    
                    # 执行网络操作
                    result = self.fault_injector.simulate_network_operation(source_node, target_node)
                    self.network_operations.append(result)
                    
                    # 输出失败的操作
                    if not result["success"]:
                        print(f"网络操作失败: {source_node} -> {target_node} - {result['error']}")
                
                time.sleep(interval)
            except Exception as e:
                print(f"流量模拟循环出错: {e}")

# 网络故障回调函数
def on_network_fault(fault_id: str, fault_info: Dict[str, Any]):
    """网络故障回调"""
    print(f"检测到网络故障: {fault_info['fault_type']}")

# 使用示例
def demonstrate_network_fault_injection():
    """演示网络故障注入"""
    # 创建网络系统模拟器
    network_sim = NetworkSystemSimulator()
    network_sim.fault_injector.add_fault_callback(on_network_fault)
    
    # 添加节点和连接
    network_topology = {
        "node-001": ["node-002", "node-003", "node-004"],
        "node-002": ["node-001", "node-003", "node-005"],
        "node-003": ["node-001", "node-002", "node-004", "node-005"],
        "node-004": ["node-001", "node-003", "node-005"],
        "node-005": ["node-002", "node-003", "node-004"]
    }
    
    for node_id, connections in network_topology.items():
        network_sim.add_node(node_id, connections)
    
    # 开始模拟
    network_sim.simulate_network_traffic(operations_per_second=5)
    
    # 注入网络分区故障
    print("\n注入网络分区故障...")
    fault1 = network_sim.fault_injector.inject_network_partition(["node-001", "node-002"])
    time.sleep(5)
    
    # 注入网络延迟故障
    print("\n注入网络延迟故障...")
    fault2 = network_sim.fault_injector.inject_latency("node-003", "node-004", latency_ms=2000)
    time.sleep(5)
    
    # 注入丢包故障
    print("\n注入网络丢包故障...")
    fault3 = network_sim.fault_injector.inject_packet_loss("node-004", "node-005", loss_rate=0.3)
    time.sleep(5)
    
    # 注入带宽限制故障
    print("\n注入带宽限制故障...")
    fault4 = network_sim.fault_injector.inject_bandwidth_limit("node-005", "node-001", bandwidth_mbps=0.5)
    time.sleep(5)
    
    # 移除故障
    print("\n移除故障...")
    network_sim.fault_injector.remove_fault(fault1)
    network_sim.fault_injector.remove_fault(fault2)
    network_sim.fault_injector.remove_fault(fault3)
    network_sim.fault_injector.remove_fault(fault4)
    
    # 继续运行一段时间
    time.sleep(10)
    
    # 停止模拟
    network_sim.stop_simulation()
    
    # 显示最终统计
    print(f"\n最终统计:")
    print(f"  总网络操作数: {len(network_sim.network_operations)}")
    failed_ops = [op for op in network_sim.network_operations if not op["success"]]
    print(f"  失败操作数: {len(failed_ops)}")
    print(f"  失败率: {len(failed_ops)/len(network_sim.network_operations):.2%}" if network_sim.network_operations else "N/A")

# 运行演示
# demonstrate_network_fault_injection()
```

## 10.4.3 实验监控与评估

混沌实验的成功不仅取决于故障的注入，更重要的是对实验过程的监控和结果的评估。这需要建立完善的监控体系和评估机制。

### 10.4.3.1 实验监控体系

```python
# 实验监控体系
import time
import threading
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime, timedelta
import random
import json

class ChaosExperimentMonitor:
    """混沌实验监控器"""
    
    def __init__(self):
        self.experiments: Dict[str, ChaosExperiment] = {}
        self.metrics_collectors: List[Callable[[], Dict[str, Any]]] = []
        self.alert_callbacks: List[Callable[[str, Dict[str, Any]], None]] = []
        self.monitor_thread: Optional[threading.Thread] = None
        self.monitoring = False
        self.collected_metrics: List[Dict[str, Any]] = []
    
    def add_experiment(self, experiment: ChaosExperiment):
        """添加实验"""
        self.experiments[experiment.experiment_id] = experiment
        print(f"添加实验到监控器: {experiment.name}")
    
    def add_metrics_collector(self, collector: Callable[[], Dict[str, Any]]):
        """添加指标收集器"""
        self.metrics_collectors.append(collector)
    
    def add_alert_callback(self, callback: Callable[[str, Dict[str, Any]], None]):
        """添加告警回调"""
        self.alert_callbacks.append(callback)
    
    def start_monitoring(self, collection_interval: int = 5):
        """开始监控"""
        if self.monitoring:
            return
        
        self.monitoring = True
        self.monitor_thread = threading.Thread(
            target=self._monitoring_loop, 
            args=(collection_interval,)
        )
        self.monitor_thread.daemon = True
        self.monitor_thread.start()
        print(f"混沌实验监控已启动 (收集间隔: {collection_interval}秒)")
    
    def stop_monitoring(self):
        """停止监控"""
        self.monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5)
        print("混沌实验监控已停止")
    
    def _monitoring_loop(self, collection_interval: int):
        """监控循环"""
        while self.monitoring:
            try:
                # 收集指标
                metrics = self._collect_metrics()
                self.collected_metrics.append(metrics)
                
                # 检查是否需要告警
                self._check_alerts(metrics)
                
                # 保存指标（限制历史数据量）
                if len(self.collected_metrics) > 1000:
                    self.collected_metrics = self.collected_metrics[-500:]
                
                time.sleep(collection_interval)
            except Exception as e:
                print(f"监控循环出错: {e}")
    
    def _collect_metrics(self) -> Dict[str, Any]:
        """收集指标"""
        metrics = {
            "timestamp": datetime.now().isoformat(),
            "experiments": {},
            "system_metrics": {}
        }
        
        # 收集实验状态
        for exp_id, experiment in self.experiments.items():
            metrics["experiments"][exp_id] = {
                "name": experiment.name,
                "status": experiment.status,
                "start_time": experiment.start_time.isoformat() if experiment.start_time else None,
                "duration": str(datetime.now() - experiment.start_time) if experiment.start_time else "N/A"
            }
        
        # 收集系统指标
        for collector in self.metrics_collectors:
            try:
                system_metrics = collector()
                metrics["system_metrics"].update(system_metrics)
            except Exception as e:
                print(f"收集系统指标时出错: {e}")
        
        return metrics
    
    def _check_alerts(self, metrics: Dict[str, Any]):
        """检查告警"""
        # 检查实验状态变化
        for exp_id, exp_info in metrics["experiments"].items():
            experiment = self.experiments.get(exp_id)
            if experiment and experiment.status != exp_info["status"]:
                alert_info = {
                    "type": "experiment_status_change",
                    "experiment_id": exp_id,
                    "experiment_name": exp_info["name"],
                    "old_status": experiment.status,
                    "new_status": exp_info["status"],
                    "timestamp": metrics["timestamp"]
                }
                self._trigger_alert("experiment_status", alert_info)
        
        # 检查系统指标异常
        system_metrics = metrics["system_metrics"]
        if system_metrics:
            # 检查系统可用性
            availability = system_metrics.get("system_availability", 1.0)
            if availability < 0.95:  # 可用性低于95%
                alert_info = {
                    "type": "low_availability",
                    "availability": availability,
                    "threshold": 0.95,
                    "timestamp": metrics["timestamp"]
                }
                self._trigger_alert("system_health", alert_info)
            
            # 检查延迟异常
            avg_latency = system_metrics.get("average_latency_ms", 0)
            if avg_latency > 1000:  # 平均延迟超过1秒
                alert_info = {
                    "type": "high_latency",
                    "latency": avg_latency,
                    "threshold": 1000,
                    "timestamp": metrics["timestamp"]
                }
                self._trigger_alert("performance", alert_info)
    
    def _trigger_alert(self, alert_type: str, alert_info: Dict[str, Any]):
        """触发告警"""
        print(f"触发告警 [{alert_type}]: {alert_info}")
        for callback in self.alert_callbacks:
            try:
                callback(alert_type, alert_info)
            except Exception as e:
                print(f"调用告警回调时出错: {e}")
    
    def get_experiment_status(self, experiment_id: str) -> Dict[str, Any]:
        """获取实验状态"""
        if experiment_id not in self.experiments:
            return {"error": "实验不存在"}
        
        experiment = self.experiments[experiment_id]
        return {
            "experiment_id": experiment_id,
            "name": experiment.name,
            "status": experiment.status,
            "start_time": experiment.start_time.isoformat() if experiment.start_time else None,
            "end_time": experiment.end_time.isoformat() if experiment.end_time else None,
            "duration": str(experiment.end_time - experiment.start_time) if experiment.start_time and experiment.end_time else "N/A"
        }
    
    def get_recent_metrics(self, count: int = 10) -> List[Dict[str, Any]]:
        """获取最近的指标"""
        return self.collected_metrics[-count:] if self.collected_metrics else []

class SystemMetricsCollector:
    """系统指标收集器"""
    
    def __init__(self):
        self.metrics_history: List[Dict[str, Any]] = []
    
    def collect_metrics(self) -> Dict[str, Any]:
        """收集系统指标"""
        # 模拟系统指标收集
        metrics = {
            "system_availability": random.uniform(0.9, 1.0),
            "average_latency_ms": random.uniform(10, 500),
            "error_rate": random.uniform(0, 0.05),
            "throughput_ops_per_sec": random.uniform(100, 1000),
            "cpu_usage": random.uniform(20, 80),
            "memory_usage": random.uniform(30, 70),
            "disk_io_utilization": random.uniform(10, 60),
            "network_throughput_mbps": random.uniform(50, 500)
        }
        
        # 记录历史数据
        metrics["timestamp"] = datetime.now().isoformat()
        self.metrics_history.append(metrics)
        
        # 限制历史数据量
        if len(self.metrics_history) > 100:
            self.metrics_history = self.metrics_history[-50:]
        
        return metrics
    
    def get_metrics_history(self, hours: int = 1) -> List[Dict[str, Any]]:
        """获取历史指标"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        return [m for m in self.metrics_history 
                if datetime.fromisoformat(m["timestamp"]) >= cutoff_time]

class ChaosExperimentEvaluator:
    """混沌实验评估器"""
    
    def __init__(self):
        self.evaluation_criteria: Dict[str, Any] = {}
        self.evaluation_results: Dict[str, List[Dict[str, Any]]] = {}
    
    def set_evaluation_criteria(self, criteria: Dict[str, Any]):
        """设置评估标准"""
        self.evaluation_criteria = criteria
        print(f"设置评估标准: {list(criteria.keys())}")
    
    def evaluate_experiment(self, experiment: ChaosExperiment, 
                          metrics_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """评估实验"""
        evaluation_id = f"eval-{int(time.time()*1000)}-{random.randint(1000, 9999)}"
        
        # 计算实验期间的指标统计
        if not metrics_history:
            return {
                "evaluation_id": evaluation_id,
                "experiment_id": experiment.experiment_id,
                "status": "failed",
                "error": "无指标数据"
            }
        
        # 计算各项指标的统计值
        stats = self._calculate_metrics_statistics(metrics_history)
        
        # 根据评估标准进行评估
        evaluation_result = self._perform_evaluation(stats)
        
        result = {
            "evaluation_id": evaluation_id,
            "experiment_id": experiment.experiment_id,
            "timestamp": datetime.now().isoformat(),
            "statistics": stats,
            "evaluation": evaluation_result,
            "recommendations": self._generate_recommendations(evaluation_result)
        }
        
        # 保存评估结果
        if experiment.experiment_id not in self.evaluation_results:
            self.evaluation_results[experiment.experiment_id] = []
        self.evaluation_results[experiment.experiment_id].append(result)
        
        return result
    
    def _calculate_metrics_statistics(self, metrics_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """计算指标统计"""
        if not metrics_history:
            return {}
        
        # 初始化统计值
        stats = {
            "count": len(metrics_history),
            "availability": {"min": 1.0, "max": 0.0, "avg": 0.0},
            "latency": {"min": float('inf'), "max": 0.0, "avg": 0.0},
            "error_rate": {"min": float('inf'), "max": 0.0, "avg": 0.0},
            "throughput": {"min": float('inf'), "max": 0.0, "avg": 0.0}
        }
        
        # 计算各项指标
        availability_sum = 0
        latency_sum = 0
        error_rate_sum = 0
        throughput_sum = 0
        
        for metrics in metrics_history:
            system_metrics = metrics.get("system_metrics", {})
            
            # 可用性
            availability = system_metrics.get("system_availability", 1.0)
            stats["availability"]["min"] = min(stats["availability"]["min"], availability)
            stats["availability"]["max"] = max(stats["availability"]["max"], availability)
            availability_sum += availability
            
            # 延迟
            latency = system_metrics.get("average_latency_ms", 0)
            stats["latency"]["min"] = min(stats["latency"]["min"], latency)
            stats["latency"]["max"] = max(stats["latency"]["max"], latency)
            latency_sum += latency
            
            # 错误率
            error_rate = system_metrics.get("error_rate", 0)
            stats["error_rate"]["min"] = min(stats["error_rate"]["min"], error_rate)
            stats["error_rate"]["max"] = max(stats["error_rate"]["max"], error_rate)
            error_rate_sum += error_rate
            
            # 吞吐量
            throughput = system_metrics.get("throughput_ops_per_sec", 0)
            stats["throughput"]["min"] = min(stats["throughput"]["min"], throughput)
            stats["throughput"]["max"] = max(stats["throughput"]["max"], throughput)
            throughput_sum += throughput
        
        # 计算平均值
        stats["availability"]["avg"] = availability_sum / len(metrics_history)
        stats["latency"]["avg"] = latency_sum / len(metrics_history)
        stats["error_rate"]["avg"] = error_rate_sum / len(metrics_history)
        stats["throughput"]["avg"] = throughput_sum / len(metrics_history)
        
        return stats
    
    def _perform_evaluation(self, stats: Dict[str, Any]) -> Dict[str, Any]:
        """执行评估"""
        evaluation = {
            "passed": True,
            "score": 100,
            "criteria_results": {}
        }
        
        # 获取评估标准
        criteria = self.evaluation_criteria
        
        # 评估可用性
        availability_criteria = criteria.get("availability", {"min": 0.95})
        min_availability = availability_criteria.get("min", 0.95)
        avg_availability = stats["availability"]["avg"]
        
        availability_passed = avg_availability >= min_availability
        evaluation["criteria_results"]["availability"] = {
            "passed": availability_passed,
            "actual": avg_availability,
            "expected": min_availability,
            "score": 100 if availability_passed else max(0, 100 * (avg_availability / min_availability))
        }
        
        if not availability_passed:
            evaluation["passed"] = False
            evaluation["score"] -= 20
        
        # 评估延迟
        latency_criteria = criteria.get("latency", {"max": 1000})
        max_latency = latency_criteria.get("max", 1000)
        avg_latency = stats["latency"]["avg"]
        
        latency_passed = avg_latency <= max_latency
        evaluation["criteria_results"]["latency"] = {
            "passed": latency_passed,
            "actual": avg_latency,
            "expected": max_latency,
            "score": 100 if latency_passed else max(0, 100 * (max_latency / avg_latency))
        }
        
        if not latency_passed:
            evaluation["passed"] = False
            evaluation["score"] -= 20
        
        # 评估错误率
        error_rate_criteria = criteria.get("error_rate", {"max": 0.01})
        max_error_rate = error_rate_criteria.get("max", 0.01)
        avg_error_rate = stats["error_rate"]["avg"]
        
        error_rate_passed = avg_error_rate <= max_error_rate
        evaluation["criteria_results"]["error_rate"] = {
            "passed": error_rate_passed,
            "actual": avg_error_rate,
            "expected": max_error_rate,
            "score": 100 if error_rate_passed else max(0, 100 * ((max_error_rate + 0.001) / (avg_error_rate + 0.001)))
        }
        
        if not error_rate_passed:
            evaluation["passed"] = False
            evaluation["score"] -= 20
        
        # 确保分数在0-100范围内
        evaluation["score"] = max(0, min(100, evaluation["score"]))
        
        return evaluation
    
    def _generate_recommendations(self, evaluation_result: Dict[str, Any]) -> List[str]:
        """生成建议"""
        recommendations = []
        criteria_results = evaluation_result.get("criteria_results", {})
        
        for criterion, result in criteria_results.items():
            if not result.get("passed", True):
                if criterion == "availability":
                    recommendations.append("提高系统可用性，检查故障恢复机制")
                elif criterion == "latency":
                    recommendations.append("优化系统延迟，检查性能瓶颈")
                elif criterion == "error_rate":
                    recommendations.append("降低错误率，改进错误处理机制")
        
        if not recommendations:
            recommendations.append("系统表现良好，继续保持")
        
        return recommendations
    
    def get_evaluation_history(self, experiment_id: str) -> List[Dict[str, Any]]:
        """获取评估历史"""
        return self.evaluation_results.get(experiment_id, [])

# 告警回调函数
def on_chaos_alert(alert_type: str, alert_info: Dict[str, Any]):
    """混沌告警回调"""
    print(f"混沌告警 [{alert_type}]: {alert_info['type']} at {alert_info['timestamp']}")

# 使用示例
def demonstrate_experiment_monitoring():
    """演示实验监控"""
    # 创建监控器
    monitor = ChaosExperimentMonitor()
    monitor.add_alert_callback(on_chaos_alert)
    
    # 创建指标收集器
    metrics_collector = SystemMetricsCollector()
    monitor.add_metrics_collector(metrics_collector.collect_metrics)
    
    # 创建实验
    experiment = ChaosExperiment(
        "exp-001",
        "存储系统混沌测试",
        "测试存储系统在各种故障下的表现"
    )
    experiment.status = "running"
    experiment.start_time = datetime.now()
    
    # 添加实验到监控器
    monitor.add_experiment(experiment)
    
    # 创建评估器
    evaluator = ChaosExperimentEvaluator()
    evaluator.set_evaluation_criteria({
        "availability": {"min": 0.95},
        "latency": {"max": 500},
        "error_rate": {"max": 0.02}
    })
    
    # 开始监控
    monitor.start_monitoring(collection_interval=2)
    
    # 模拟实验运行
    print("开始混沌实验监控...")
    for i in range(30):  # 运行30个周期
        # 模拟实验状态变化
        if i == 10:
            experiment.status = "completed"
            experiment.end_time = datetime.now()
            print("实验完成")
        
        time.sleep(1)
    
    # 停止监控
    monitor.stop_monitoring()
    
    # 显示实验状态
    status = monitor.get_experiment_status("exp-001")
    print(f"\n实验最终状态: {status}")
    
    # 显示最近指标
    recent_metrics = monitor.get_recent_metrics(5)
    print(f"\n最近5次指标收集:")
    for metrics in recent_metrics:
        exp_count = len(metrics.get("experiments", {}))
        sys_metrics = metrics.get("system_metrics", {})
        print(f"  时间: {metrics['timestamp']}")
        print(f"    实验数: {exp_count}")
        print(f"    系统指标: {len(sys_metrics)} 项")
    
    # 评估实验
    print(f"\n评估实验...")
    evaluation = evaluator.evaluate_experiment(experiment, metrics_collector.get_metrics_history())
    print(f"  评估ID: {evaluation['evaluation_id']}")
    print(f"  通过: {evaluation['evaluation']['passed']}")
    print(f"  分数: {evaluation['evaluation']['score']}")
    print(f"  建议: {evaluation['recommendations']}")

# 运行演示
# demonstrate_experiment_monitoring()
```

### 10.4.3.2 实验报告与改进建议

```python
# 实验报告与改进建议
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import json
import random

class ChaosExperimentReporter:
    """混沌实验报告器"""
    
    def __init__(self):
        self.reports: Dict[str, Dict[str, Any]] = {}
    
    def generate_experiment_report(self, experiment: ChaosExperiment, 
                                 metrics_history: List[Dict[str, Any]],
                                 evaluation_result: Dict[str, Any]) -> str:
        """生成实验报告"""
        report_id = f"report-{int(time.time()*1000)}-{random.randint(1000, 9999)}"
        
        # 计算实验持续时间
        duration = "N/A"
        if experiment.start_time:
            end_time = experiment.end_time or datetime.now()
            duration = str(end_time - experiment.start_time)
        
        # 生成报告内容
        report = {
            "report_id": report_id,
            "generated_at": datetime.now().isoformat(),
            "experiment": {
                "id": experiment.experiment_id,
                "name": experiment.name,
                "description": experiment.description,
                "status": experiment.status,
                "duration": duration,
                "start_time": experiment.start_time.isoformat() if experiment.start_time else None,
                "end_time": experiment.end_time.isoformat() if experiment.end_time else None,
                "configuration": experiment.configuration,
                "targets": experiment.targets,
                "actions": experiment.actions,
                "verifications": experiment.verifications
            },
            "metrics_summary": self._summarize_metrics(metrics_history),
            "evaluation": evaluation_result,
            "recommendations": self._generate_detailed_recommendations(evaluation_result),
            "conclusions": self._generate_conclusions(experiment, evaluation_result)
        }
        
        # 保存报告
        self.reports[report_id] = report
        
        return report_id
    
    def _summarize_metrics(self, metrics_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """汇总指标"""
        if not metrics_history:
            return {"message": "无指标数据"}
        
        summary = {
            "total_samples": len(metrics_history),
            "time_range": {
                "start": metrics_history[0]["timestamp"] if metrics_history else None,
                "end": metrics_history[-1]["timestamp"] if metrics_history else None
            },
            "system_metrics": {}
        }
        
        # 汇总系统指标
        if metrics_history:
            last_metrics = metrics_history[-1].get("system_metrics", {})
            summary["system_metrics"] = {
                "latest": last_metrics,
                "sample_count": len([m for m in metrics_history if "system_metrics" in m])
            }
        
        return summary
    
    def _generate_detailed_recommendations(self, evaluation_result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """生成详细建议"""
        recommendations = []
        evaluation = evaluation_result.get("evaluation", {})
        criteria_results = evaluation.get("criteria_results", {})
        
        for criterion, result in criteria_results.items():
            if not result.get("passed", True):
                recommendation = {
                    "criterion": criterion,
                    "issue": f"{criterion}未达到预期标准",
                    "actual": result.get("actual"),
                    "expected": result.get("expected"),
                    "severity": self._assess_severity(result.get("score", 0)),
                    "actions": self._suggest_actions(criterion, result)
                }
                recommendations.append(recommendation)
        
        return recommendations
    
    def _assess_severity(self, score: float) -> str:
        """评估严重性"""
        if score >= 80:
            return "low"
        elif score >= 60:
            return "medium"
        else:
            return "high"
    
    def _suggest_actions(self, criterion: str, result: Dict[str, Any]) -> List[str]:
        """建议行动"""
        actions = []
        
        if criterion == "availability":
            actions.extend([
                "检查故障检测和恢复机制",
                "优化负载均衡策略",
                "增加冗余节点",
                "改进健康检查频率"
            ])
        elif criterion == "latency":
            actions.extend([
                "分析性能瓶颈",
                "优化数据访问路径",
                "增加缓存层",
                "升级硬件资源"
            ])
        elif criterion == "error_rate":
            actions.extend([
                "改进错误处理逻辑",
                "增加重试机制",
                "优化超时设置",
                "加强输入验证"
            ])
        
        return actions
    
    def _generate_conclusions(self, experiment: ChaosExperiment, 
                            evaluation_result: Dict[str, Any]) -> List[str]:
        """生成结论"""
        conclusions = []
        evaluation = evaluation_result.get("evaluation", {})
        
        if evaluation.get("passed"):
            conclusions.append(f"实验 '{experiment.name}' 成功通过所有评估标准")
            conclusions.append("系统在故障条件下表现出良好的稳定性和恢复能力")
        else:
            conclusions.append(f"实验 '{experiment.name}' 未完全通过评估")
            conclusions.append("系统在某些故障场景下存在改进空间")
        
        # 添加统计信息
        score = evaluation.get("score", 0)
        conclusions.append(f"总体评估得分: {score}/100")
        
        return conclusions
    
    def get_report(self, report_id: str) -> Dict[str, Any]:
        """获取报告"""
        return self.reports.get(report_id, {"error": "报告不存在"})
    
    def export_report(self, report_id: str, format: str = "json") -> str:
        """导出报告"""
        report = self.get_report(report_id)
        if "error" in report:
            return json.dumps(report)
        
        if format.lower() == "json":
            return json.dumps(report, indent=2, ensure_ascii=False)
        else:
            return self._format_report_text(report)
    
    def _format_report_text(self, report: Dict[str, Any]) -> str:
        """格式化文本报告"""
        lines = []
        lines.append("=" * 60)
        lines.append("混沌工程实验报告")
        lines.append("=" * 60)
        lines.append("")
        
        # 实验信息
        exp_info = report.get("experiment", {})
        lines.append(f"实验名称: {exp_info.get('name', 'N/A')}")
        lines.append(f"实验ID: {exp_info.get('id', 'N/A')}")
        lines.append(f"状态: {exp_info.get('status', 'N/A')}")
        lines.append(f"持续时间: {exp_info.get('duration', 'N/A')}")
        lines.append("")
        
        # 评估结果
        evaluation = report.get("evaluation", {})
        lines.append("评估结果:")
        lines.append(f"  通过: {evaluation.get('passed', 'N/A')}")
        lines.append(f"  得分: {evaluation.get('score', 'N/A')}/100")
        lines.append("")
        
        # 建议
        recommendations = report.get("recommendations", [])
        if recommendations:
            lines.append("改进建议:")
            for i, rec in enumerate(recommendations, 1):
                lines.append(f"  {i}. {rec.get('issue', 'N/A')}")
                lines.append(f"     严重性: {rec.get('severity', 'N/A')}")
                actions = rec.get('actions', [])
                if actions:
                    lines.append("     建议行动:")
                    for action in actions:
                        lines.append(f"       - {action}")
                lines.append("")
        
        # 结论
        conclusions = report.get("conclusions", [])
        if conclusions:
            lines.append("结论:")
            for conclusion in conclusions:
                lines.append(f"  - {conclusion}")
        
        lines.append("")
        lines.append("=" * 60)
        lines.append("报告生成时间: " + report.get("generated_at", "N/A"))
        lines.append("=" * 60)
        
        return "\n".join(lines)

class ChaosExperimentImprovementPlanner:
    """混沌实验改进规划器"""
    
    def __init__(self):
        self.improvement_plans: Dict[str, Dict[str, Any]] = {}
    
    def create_improvement_plan(self, report_id: str, 
                              recommendations: List[Dict[str, Any]]) -> str:
        """创建改进计划"""
        plan_id = f"plan-{int(time.time()*1000)}-{random.randint(1000, 9999)}"
        
        # 分析建议并创建行动计划
        action_items = []
        for rec in recommendations:
            actions = rec.get("actions", [])
            for action in actions:
                action_item = {
                    "id": f"action-{len(action_items)+1:03d}",
                    "description": action,
                    "criterion": rec.get("criterion"),
                    "severity": rec.get("severity", "medium"),
                    "priority": self._calculate_priority(rec.get("severity", "medium"), rec.get("score", 50)),
                    "estimated_effort": self._estimate_effort(action),
                    "status": "planned"
                }
                action_items.append(action_item)
        
        # 按优先级排序
        action_items.sort(key=lambda x: x["priority"], reverse=True)
        
        plan = {
            "plan_id": plan_id,
            "report_id": report_id,
            "created_at": datetime.now().isoformat(),
            "action_items": action_items,
            "status": "planned",
            "progress": 0.0
        }
        
        self.improvement_plans[plan_id] = plan
        return plan_id
    
    def _calculate_priority(self, severity: str, score: float) -> int:
        """计算优先级"""
        severity_weights = {"low": 1, "medium": 2, "high": 3}
        severity_weight = severity_weights.get(severity, 2)
        score_weight = (100 - score) / 10  # 分数越低，优先级越高
        return int(severity_weight * 10 + score_weight)
    
    def _estimate_effort(self, action: str) -> str:
        """估算工作量"""
        # 简化实现，实际中可能需要更复杂的估算
        effort_keywords = {
            "low": ["检查", "验证", "更新", "配置"],
            "medium": ["优化", "改进", "增加", "修改"],
            "high": ["重构", "替换", "升级", "重新设计"]
        }
        
        action_lower = action.lower()
        for effort, keywords in effort_keywords.items():
            if any(keyword in action_lower for keyword in keywords):
                return effort
        
        return "medium"
    
    def update_action_status(self, plan_id: str, action_id: str, status: str) -> bool:
        """更新行动状态"""
        if plan_id not in self.improvement_plans:
            return False
        
        plan = self.improvement_plans[plan_id]
        for action in plan["action_items"]:
            if action["id"] == action_id:
                action["status"] = status
                # 更新计划进度
                self._update_plan_progress(plan)
                return True
        
        return False
    
    def _update_plan_progress(self, plan: Dict[str, Any]):
        """更新计划进度"""
        total_actions = len(plan["action_items"])
        completed_actions = sum(1 for action in plan["action_items"] 
                              if action["status"] == "completed")
        plan["progress"] = completed_actions / total_actions if total_actions > 0 else 0
        
        # 检查是否所有行动都已完成
        if completed_actions == total_actions:
            plan["status"] = "completed"
    
    def get_improvement_plan(self, plan_id: str) -> Dict[str, Any]:
        """获取改进计划"""
        return self.improvement_plans.get(plan_id, {"error": "改进计划不存在"})
    
    def get_action_items_by_status(self, plan_id: str, status: str) -> List[Dict[str, Any]]:
        """根据状态获取行动项"""
        plan = self.improvement_plans.get(plan_id, {})
        if "error" in plan:
            return []
        
        return [action for action in plan.get("action_items", []) 
                if action.get("status") == status]

# 使用示例
def demonstrate_experiment_reporting():
    """演示实验报告"""
    # 创建报告器
    reporter = ChaosExperimentReporter()
    
    # 创建改进规划器
    planner = ChaosExperimentImprovementPlanner()
    
    # 创建模拟实验
    experiment = ChaosExperiment(
        "exp-001",
        "存储系统混沌测试",
        "测试存储系统在各种故障下的表现"
    )
    experiment.status = "completed"
    experiment.start_time = datetime.now() - timedelta(minutes=30)
    experiment.end_time = datetime.now()
    experiment.configuration = {
        "hypothesis": "系统在故障条件下仍能保持95%的可用性",
        "production_environment": True
    }
    experiment.targets = ["storage-node-1", "storage-node-2"]
    experiment.actions = [{"type": "disk_failure", "parameters": {"disk_id": "disk-001"}}]
    experiment.verifications = [{"type": "availability_check", "metrics": ["system_availability"]}]
    
    # 创建模拟指标历史
    metrics_history = []
    for i in range(10):
        metrics = {
            "timestamp": (datetime.now() - timedelta(minutes=30-i*3)).isoformat(),
            "system_metrics": {
                "system_availability": random.uniform(0.85, 1.0),
                "average_latency_ms": random.uniform(50, 500),
                "error_rate": random.uniform(0, 0.05)
            }
        }
        metrics_history.append(metrics)
    
    # 创建模拟评估结果
    evaluation_result = {
        "evaluation": {
            "passed": False,
            "score": 75,
            "criteria_results": {
                "availability": {
                    "passed": False,
                    "actual": 0.92,
                    "expected": 0.95,
                    "score": 85
                },
                "latency": {
                    "passed": True,
                    "actual": 150,
                    "expected": 500,
                    "score": 100
                },
                "error_rate": {
                    "passed": False,
                    "actual": 0.03,
                    "expected": 0.02,
                    "score": 60
                }
            }
        },
        "recommendations": [
            {
                "criterion": "availability",
                "issue": "系统可用性未达到95%的标准",
                "actual": 0.92,
                "expected": 0.95,
                "severity": "medium",
                "actions": [
                    "检查故障检测和恢复机制",
                    "优化负载均衡策略"
                ]
            },
            {
                "criterion": "error_rate",
                "issue": "错误率超过预期标准",
                "actual": 0.03,
                "expected": 0.02,
                "severity": "high",
                "actions": [
                    "改进错误处理逻辑",
                    "增加重试机制"
                ]
            }
        ]
    }
    
    # 生成报告
    print("生成混沌实验报告...")
    report_id = reporter.generate_experiment_report(
        experiment, 
        metrics_history, 
        evaluation_result
    )
    
    # 显示报告摘要
    report = reporter.get_report(report_id)
    print(f"报告ID: {report_id}")
    print(f"生成时间: {report.get('generated_at')}")
    
    exp_info = report.get("experiment", {})
    print(f"实验名称: {exp_info.get('name')}")
    print(f"实验状态: {exp_info.get('status')}")
    
    evaluation = report.get("evaluation", {})
    print(f"评估通过: {evaluation.get('passed')}")
    print(f"评估得分: {evaluation.get('score')}/100")
    
    # 导出JSON格式报告
    print("\n导出JSON格式报告:")
    json_report = reporter.export_report(report_id, "json")
    print(json_report[:500] + "..." if len(json_report) > 500 else json_report)
    
    # 导出文本格式报告
    print("\n导出文本格式报告:")
    text_report = reporter.export_report(report_id, "text")
    print(text_report[:1000] + "..." if len(text_report) > 1000 else text_report)
    
    # 创建改进计划
    print("\n创建改进计划...")
    recommendations = report.get("recommendations", [])
    plan_id = planner.create_improvement_plan(report_id, recommendations)
    
    # 显示改进计划
    plan = planner.get_improvement_plan(plan_id)
    print(f"改进计划ID: {plan_id}")
    print(f"关联报告: {plan.get('report_id')}")
    print(f"计划状态: {plan.get('status')}")
    print(f"完成进度: {plan.get('progress'):.1%}")
    
    action_items = plan.get("action_items", [])
    print(f"行动项数量: {len(action_items)}")
    for i, action in enumerate(action_items, 1):
        print(f"  {i}. {action.get('description')}")
        print(f"     优先级: {action.get('priority')}")
        print(f"     工作量: {action.get('estimated_effort')}")
        print(f"     状态: {action.get('status')}")
    
    # 更新行动项状态
    print("\n更新行动项状态...")
    if action_items:
        first_action_id = action_items[0]["id"]
        planner.update_action_status(plan_id, first_action_id, "completed")
        print(f"更新行动项 {first_action_id} 为完成状态")
    
    # 显示更新后的计划
    updated_plan = planner.get_improvement_plan(plan_id)
    print(f"更新后进度: {updated_plan.get('progress'):.1%}")

# 运行演示
# demonstrate_experiment_reporting()
```

通过以上实现，我们构建了一个完整的混沌工程应用体系，包括：

1. **混沌工程基础理论**：介绍了混沌工程的核心原则和假设验证方法
2. **存储系统故障注入**：实现了磁盘和网络故障的注入机制
3. **实验监控与评估**：建立了完善的监控体系和评估机制
4. **实验报告与改进建议**：提供了详细的报告生成和改进建议功能

这些功能可以帮助分布式文件存储系统团队系统性地进行混沌工程实践，提高系统的稳定性和可靠性。