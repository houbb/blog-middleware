---
title: "配置中心化管理: 不同环境的配置隔离与版本控制"
date: 2025-09-07
categories: [DistributedFile]
tags: [DistributedFile]
published: true
---
在分布式文件存储平台的生命周期中，配置管理是确保系统稳定运行和持续演进的关键环节。随着系统规模的扩大和环境的多样化，传统的配置管理方式已无法满足现代分布式系统的需求。本章将深入探讨配置中心化管理的核心理念、实现方案以及在不同环境中的配置隔离与版本控制策略。

## 8.3.1 配置管理挑战与需求

在分布式文件存储平台中，配置管理面临着诸多挑战，包括配置项的多样性、环境的复杂性、变更的频繁性以及一致性的要求。

### 8.3.1.1 配置项分类与管理

```python
# 配置项分类管理示例
from enum import Enum
from typing import Dict, Any, List
from dataclasses import dataclass
import json
import yaml
from datetime import datetime

class ConfigType(Enum):
    """配置项类型"""
    SYSTEM = "system"          # 系统配置
    NETWORK = "network"        # 网络配置
    STORAGE = "storage"        # 存储配置
    SECURITY = "security"      # 安全配置
    PERFORMANCE = "performance"  # 性能配置
    BUSINESS = "business"      # 业务配置

class ConfigScope(Enum):
    """配置作用域"""
    GLOBAL = "global"          # 全局配置
    CLUSTER = "cluster"        # 集群配置
    NODE = "node"              # 节点配置
    SERVICE = "service"        # 服务配置

@dataclass
class ConfigItem:
    """配置项定义"""
    key: str
    value: Any
    type: ConfigType
    scope: ConfigScope
    description: str
    default_value: Any = None
    required: bool = False
    sensitive: bool = False  # 是否为敏感配置
    validator: str = None    # 验证规则

class ConfigManager:
    """配置管理器"""
    def __init__(self):
        self.config_items: Dict[str, ConfigItem] = {}
        self.config_values: Dict[str, Dict[str, Any]] = {}
        self.config_history: Dict[str, List[Dict[str, Any]]] = {}
    
    def register_config_item(self, item: ConfigItem) -> bool:
        """
        注册配置项
        """
        if item.key in self.config_items:
            print(f"配置项 {item.key} 已存在")
            return False
        
        self.config_items[item.key] = item
        return True
    
    def set_config_value(self, key: str, value: Any, namespace: str = "default") -> bool:
        """
        设置配置值
        """
        if key not in self.config_items:
            print(f"配置项 {key} 未注册")
            return False
        
        # 验证配置值
        if not self._validate_config_value(key, value):
            print(f"配置值验证失败: {key} = {value}")
            return False
        
        # 记录历史版本
        self._record_config_history(key, namespace, value)
        
        # 设置配置值
        if namespace not in self.config_values:
            self.config_values[namespace] = {}
        
        self.config_values[namespace][key] = value
        return True
    
    def get_config_value(self, key: str, namespace: str = "default", default: Any = None) -> Any:
        """
        获取配置值
        """
        # 先从指定命名空间获取
        if namespace in self.config_values and key in self.config_values[namespace]:
            return self.config_values[namespace][key]
        
        # 从默认命名空间获取
        if "default" in self.config_values and key in self.config_values["default"]:
            return self.config_values["default"][key]
        
        # 返回默认值或配置项的默认值
        config_item = self.config_items.get(key)
        if config_item and config_item.default_value is not None:
            return config_item.default_value
        
        return default
    
    def _validate_config_value(self, key: str, value: Any) -> bool:
        """
        验证配置值
        """
        config_item = self.config_items.get(key)
        if not config_item:
            return False
        
        # 类型检查
        if config_item.type == ConfigType.SYSTEM:
            if not isinstance(value, (str, int, float, bool)):
                return False
        elif config_item.type == ConfigType.NETWORK:
            if not isinstance(value, (str, int)):
                return False
        elif config_item.type == ConfigType.STORAGE:
            if not isinstance(value, (int, float)):
                return False
        
        # 自定义验证规则
        if config_item.validator:
            try:
                # 这里简化处理，实际可以使用更复杂的验证逻辑
                if config_item.validator == "port" and isinstance(value, int):
                    return 1 <= value <= 65535
                elif config_item.validator == "percentage" and isinstance(value, (int, float)):
                    return 0 <= value <= 100
            except Exception:
                return False
        
        return True
    
    def _record_config_history(self, key: str, namespace: str, value: Any):
        """
        记录配置历史
        """
        history_key = f"{namespace}.{key}"
        if history_key not in self.config_history:
            self.config_history[history_key] = []
        
        self.config_history[history_key].append({
            "value": value,
            "timestamp": datetime.now().isoformat(),
            "version": len(self.config_history[history_key]) + 1
        })
    
    def get_config_history(self, key: str, namespace: str = "default") -> List[Dict[str, Any]]:
        """
        获取配置历史
        """
        history_key = f"{namespace}.{key}"
        return self.config_history.get(history_key, [])
    
    def export_config(self, namespace: str = "default", format: str = "json") -> str:
        """
        导出配置
        """
        config_data = self.config_values.get(namespace, {})
        
        if format.lower() == "json":
            return json.dumps(config_data, indent=2, default=str)
        elif format.lower() == "yaml":
            return yaml.dump(config_data, default_flow_style=False)
        else:
            return str(config_data)

# 使用示例
config_manager = ConfigManager()

# 注册配置项
config_items = [
    ConfigItem(
        key="network.bind_port",
        value=8080,
        type=ConfigType.NETWORK,
        scope=ConfigScope.GLOBAL,
        description="服务绑定端口",
        default_value=8080,
        required=True,
        validator="port"
    ),
    ConfigItem(
        key="storage.max_disk_usage",
        value=85,
        type=ConfigType.STORAGE,
        scope=ConfigScope.GLOBAL,
        description="磁盘最大使用率(%)",
        default_value=85,
        required=True,
        validator="percentage"
    ),
    ConfigItem(
        key="performance.thread_pool_size",
        value=32,
        type=ConfigType.PERFORMANCE,
        scope=ConfigScope.CLUSTER,
        description="线程池大小",
        default_value=16,
        required=True
    )
]

# 注册所有配置项
for item in config_items:
    config_manager.register_config_item(item)

# 设置配置值
config_manager.set_config_value("network.bind_port", 9000, "production")
config_manager.set_config_value("storage.max_disk_usage", 90, "production")
config_manager.set_config_value("performance.thread_pool_size", 64, "production")

# 获取配置值
bind_port = config_manager.get_config_value("network.bind_port", "production")
print(f"绑定端口: {bind_port}")

# 导出配置
config_json = config_manager.export_config("production", "json")
print(f"导出的配置:\n{config_json}")
```

### 8.3.1.2 环境隔离需求

```python
# 环境隔离管理示例
from typing import Dict, List
import os

class EnvironmentManager:
    """环境管理器"""
    def __init__(self):
        self.environments: Dict[str, Dict[str, str]] = {
            "development": {
                "namespace": "dev",
                "cluster_size": "small",
                "log_level": "DEBUG",
                "replication_factor": "1"
            },
            "testing": {
                "namespace": "test",
                "cluster_size": "medium",
                "log_level": "INFO",
                "replication_factor": "2"
            },
            "staging": {
                "namespace": "staging",
                "cluster_size": "large",
                "log_level": "WARN",
                "replication_factor": "3"
            },
            "production": {
                "namespace": "prod",
                "cluster_size": "xlarge",
                "log_level": "ERROR",
                "replication_factor": "3"
            }
        }
        self.current_environment = self._detect_environment()
    
    def _detect_environment(self) -> str:
        """
        检测当前环境
        """
        # 通过环境变量检测
        env_name = os.getenv("DFS_ENVIRONMENT", "development")
        
        # 验证环境名称
        if env_name not in self.environments:
            print(f"未知环境: {env_name}, 使用默认环境: development")
            return "development"
        
        return env_name
    
    def get_environment_config(self, env_name: str = None) -> Dict[str, str]:
        """
        获取环境配置
        """
        if env_name is None:
            env_name = self.current_environment
        
        return self.environments.get(env_name, self.environments["development"])
    
    def get_current_environment(self) -> str:
        """
        获取当前环境
        """
        return self.current_environment
    
    def switch_environment(self, env_name: str) -> bool:
        """
        切换环境
        """
        if env_name not in self.environments:
            print(f"不支持的环境: {env_name}")
            return False
        
        self.current_environment = env_name
        print(f"已切换到环境: {env_name}")
        return True
    
    def get_all_environments(self) -> List[str]:
        """
        获取所有支持的环境
        """
        return list(self.environments.keys())

# 配置环境适配器
class ConfigEnvironmentAdapter:
    """配置环境适配器"""
    def __init__(self, config_manager: ConfigManager, environment_manager: EnvironmentManager):
        self.config_manager = config_manager
        self.environment_manager = environment_manager
    
    def load_environment_config(self, env_name: str = None):
        """
        加载环境配置
        """
        env_config = self.environment_manager.get_environment_config(env_name)
        namespace = env_config.get("namespace", "default")
        
        # 根据环境设置配置值
        for key, value in env_config.items():
            if key != "namespace":
                # 转换配置键名
                config_key = self._map_env_key_to_config_key(key)
                if config_key:
                    # 转换值类型
                    typed_value = self._convert_value_type(config_key, value)
                    self.config_manager.set_config_value(config_key, typed_value, namespace)
    
    def _map_env_key_to_config_key(self, env_key: str) -> str:
        """
        映射环境键到配置键
        """
        key_mapping = {
            "log_level": "system.log_level",
            "replication_factor": "storage.replication_factor",
            "cluster_size": "system.cluster_size"
        }
        return key_mapping.get(env_key)
    
    def _convert_value_type(self, config_key: str, value: str) -> Any:
        """
        转换值类型
        """
        # 根据配置项定义转换类型
        config_item = self.config_manager.config_items.get(config_key)
        if not config_item:
            # 尝试自动转换
            if value.isdigit():
                return int(value)
            elif value.lower() in ("true", "false"):
                return value.lower() == "true"
            else:
                return value
        
        # 根据配置项类型转换
        if config_item.type in [ConfigType.SYSTEM, ConfigType.PERFORMANCE, ConfigType.STORAGE]:
            if value.isdigit():
                return int(value)
        
        return value

# 使用示例
env_manager = EnvironmentManager()
config_manager = ConfigManager()
adapter = ConfigEnvironmentAdapter(config_manager, env_manager)

# 加载生产环境配置
adapter.load_environment_config("production")

# 查看当前环境
current_env = env_manager.get_current_environment()
print(f"当前环境: {current_env}")

# 获取环境配置
env_config = env_manager.get_environment_config("production")
print(f"生产环境配置: {env_config}")
```

## 8.3.2 配置中心架构设计

配置中心是实现配置集中化管理的核心组件，需要具备高可用性、高性能、安全性和可扩展性等特性。

### 8.3.2.1 配置中心核心组件

```python
# 配置中心核心组件实现
import asyncio
import aiohttp
from typing import Dict, List, Optional, Callable
import hashlib
import time
from dataclasses import dataclass

@dataclass
class ConfigVersion:
    """配置版本信息"""
    version_id: str
    config_data: Dict[str, Any]
    timestamp: float
    author: str
    description: str

class ConfigStore:
    """配置存储层"""
    def __init__(self):
        self.configs: Dict[str, Dict[str, Any]] = {}
        self.versions: Dict[str, List[ConfigVersion]] = {}
        self.locks: Dict[str, asyncio.Lock] = {}
    
    async def get_config(self, namespace: str, key: str) -> Optional[Any]:
        """获取配置值"""
        config_key = f"{namespace}.{key}"
        return self.configs.get(config_key)
    
    async def set_config(self, namespace: str, key: str, value: Any, 
                        author: str = "system", description: str = "") -> str:
        """设置配置值"""
        config_key = f"{namespace}.{key}"
        
        # 创建锁以确保并发安全
        if config_key not in self.locks:
            self.locks[config_key] = asyncio.Lock()
        
        async with self.locks[config_key]:
            # 保存当前版本
            current_value = self.configs.get(config_key)
            if config_key not in self.versions:
                self.versions[config_key] = []
            
            # 生成版本ID
            version_id = self._generate_version_id(namespace, key, value)
            
            # 保存版本历史
            self.versions[config_key].append(ConfigVersion(
                version_id=version_id,
                config_data={"value": current_value} if current_value is not None else {},
                timestamp=time.time(),
                author=author,
                description=description
            ))
            
            # 更新配置值
            self.configs[config_key] = value
            
            return version_id
    
    async def get_config_history(self, namespace: str, key: str) -> List[ConfigVersion]:
        """获取配置历史"""
        config_key = f"{namespace}.{key}"
        return self.versions.get(config_key, [])
    
    async def rollback_config(self, namespace: str, key: str, version_id: str) -> bool:
        """回滚配置到指定版本"""
        config_key = f"{namespace}.{key}"
        
        if config_key not in self.versions:
            return False
        
        # 查找指定版本
        target_version = None
        for version in self.versions[config_key]:
            if version.version_id == version_id:
                target_version = version
                break
        
        if not target_version:
            return False
        
        # 恢复配置值
        self.configs[config_key] = target_version.config_data.get("value")
        return True
    
    def _generate_version_id(self, namespace: str, key: str, value: Any) -> str:
        """生成版本ID"""
        content = f"{namespace}.{key}.{value}.{time.time()}"
        return hashlib.md5(content.encode()).hexdigest()[:16]

class ConfigCache:
    """配置缓存层"""
    def __init__(self, ttl_seconds: int = 300):
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.ttl_seconds = ttl_seconds
        self.timestamps: Dict[str, float] = {}
    
    async def get(self, namespace: str, key: str) -> Optional[Any]:
        """从缓存获取配置"""
        config_key = f"{namespace}.{key}"
        
        # 检查缓存是否存在且未过期
        if config_key in self.cache:
            timestamp = self.timestamps.get(config_key, 0)
            if time.time() - timestamp < self.ttl_seconds:
                return self.cache[config_key].get("value")
            else:
                # 缓存过期，删除
                del self.cache[config_key]
                del self.timestamps[config_key]
        
        return None
    
    async def set(self, namespace: str, key: str, value: Any):
        """设置缓存"""
        config_key = f"{namespace}.{key}"
        self.cache[config_key] = {"value": value}
        self.timestamps[config_key] = time.time()
    
    async def invalidate(self, namespace: str, key: str):
        """失效缓存"""
        config_key = f"{namespace}.{key}"
        if config_key in self.cache:
            del self.cache[config_key]
        if config_key in self.timestamps:
            del self.timestamps[config_key]

class ConfigCenter:
    """配置中心主服务"""
    def __init__(self):
        self.store = ConfigStore()
        self.cache = ConfigCache()
        self.listeners: Dict[str, List[Callable]] = {}
        self.notification_queue = asyncio.Queue()
    
    async def get_config(self, namespace: str, key: str) -> Optional[Any]:
        """获取配置值"""
        # 先从缓存获取
        cached_value = await self.cache.get(namespace, key)
        if cached_value is not None:
            return cached_value
        
        # 从存储层获取
        value = await self.store.get_config(namespace, key)
        
        # 放入缓存
        if value is not None:
            await self.cache.set(namespace, key, value)
        
        return value
    
    async def set_config(self, namespace: str, key: str, value: Any,
                        author: str = "system", description: str = "") -> str:
        """设置配置值"""
        # 保存到存储层
        version_id = await self.store.set_config(namespace, key, value, author, description)
        
        # 更新缓存
        await self.cache.set(namespace, key, value)
        
        # 通知监听者
        await self._notify_listeners(namespace, key, value)
        
        return version_id
    
    async def watch_config(self, namespace: str, key: str, callback: Callable):
        """监听配置变化"""
        config_key = f"{namespace}.{key}"
        if config_key not in self.listeners:
            self.listeners[config_key] = []
        self.listeners[config_key].append(callback)
    
    async def _notify_listeners(self, namespace: str, key: str, value: Any):
        """通知监听者配置变化"""
        config_key = f"{namespace}.{key}"
        if config_key in self.listeners:
            for callback in self.listeners[config_key]:
                try:
                    await callback(namespace, key, value)
                except Exception as e:
                    print(f"通知监听者失败: {e}")
    
    async def get_config_history(self, namespace: str, key: str) -> List[ConfigVersion]:
        """获取配置历史"""
        return await self.store.get_config_history(namespace, key)
    
    async def rollback_config(self, namespace: str, key: str, version_id: str) -> bool:
        """回滚配置"""
        success = await self.store.rollback_config(namespace, key, version_id)
        if success:
            # 失效缓存
            await self.cache.invalidate(namespace, key)
        return success

# 配置客户端实现
class ConfigClient:
    """配置客户端"""
    def __init__(self, server_url: str):
        self.server_url = server_url
        self.local_cache: Dict[str, Any] = {}
        self.cache_timestamps: Dict[str, float] = {}
        self.cache_ttl = 300  # 5分钟缓存
    
    async def get_config(self, namespace: str, key: str) -> Optional[Any]:
        """获取配置"""
        config_key = f"{namespace}.{key}"
        
        # 检查本地缓存
        if config_key in self.local_cache:
            timestamp = self.cache_timestamps.get(config_key, 0)
            if time.time() - timestamp < self.cache_ttl:
                return self.local_cache[config_key]
            else:
                # 缓存过期，删除
                del self.local_cache[config_key]
                del self.cache_timestamps[config_key]
        
        # 从服务端获取
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.server_url}/api/v1/config/{namespace}/{key}"
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        value = data.get("value")
                        
                        # 更新本地缓存
                        self.local_cache[config_key] = value
                        self.cache_timestamps[config_key] = time.time()
                        
                        return value
        except Exception as e:
            print(f"获取配置失败: {e}")
        
        return None
    
    async def watch_config(self, namespace: str, key: str, callback: Callable):
        """监听配置变化"""
        # 这里简化实现，实际可以使用WebSocket或长轮询
        while True:
            try:
                new_value = await self.get_config(namespace, key)
                if new_value is not None:
                    await callback(namespace, key, new_value)
                await asyncio.sleep(30)  # 每30秒检查一次
            except Exception as e:
                print(f"监听配置失败: {e}")
                await asyncio.sleep(60)  # 出错后等待1分钟再重试

# 使用示例
async def demonstrate_config_center():
    # 创建配置中心
    config_center = ConfigCenter()
    
    # 设置配置
    version1 = await config_center.set_config("prod", "storage.replication_factor", 3, "admin", "生产环境副本因子")
    print(f"设置配置版本: {version1}")
    
    # 获取配置
    replication_factor = await config_center.get_config("prod", "storage.replication_factor")
    print(f"获取配置值: {replication_factor}")
    
    # 监听配置变化
    async def config_change_listener(namespace: str, key: str, value: Any):
        print(f"配置变化: {namespace}.{key} = {value}")
    
    await config_center.watch_config("prod", "storage.replication_factor", config_change_listener)
    
    # 修改配置
    version2 = await config_center.set_config("prod", "storage.replication_factor", 4, "admin", "增加副本因子")
    print(f"修改配置版本: {version2}")
    
    # 查看配置历史
    history = await config_center.get_config_history("prod", "storage.replication_factor")
    print(f"配置历史版本数: {len(history)}")
    for version in history:
        print(f"  版本 {version.version_id}: {version.config_data} ({version.timestamp})")

# 运行示例
# asyncio.run(demonstrate_config_center())
```

### 8.3.2.2 配置同步与分发

```python
# 配置同步与分发实现
import asyncio
import aiohttp
from typing import Dict, List, Set
import json

class ConfigSyncManager:
    """配置同步管理器"""
    def __init__(self, config_center: ConfigCenter):
        self.config_center = config_center
        self.nodes: Set[str] = set()  # 节点地址集合
        self.sync_tasks: Dict[str, asyncio.Task] = {}
    
    async def add_node(self, node_address: str):
        """添加节点"""
        self.nodes.add(node_address)
        print(f"添加节点: {node_address}")
    
    async def remove_node(self, node_address: str):
        """移除节点"""
        self.nodes.discard(node_address)
        print(f"移除节点: {node_address}")
    
    async def sync_config_to_all_nodes(self, namespace: str, key: str, value: Any):
        """同步配置到所有节点"""
        tasks = []
        for node in self.nodes:
            task = self._sync_config_to_node(node, namespace, key, value)
            tasks.append(task)
        
        # 并发执行同步任务
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 统计成功和失败的节点
        success_count = sum(1 for result in results if result is True)
        failure_count = len(results) - success_count
        
        print(f"配置同步完成: {success_count} 成功, {failure_count} 失败")
        return success_count == len(self.nodes)
    
    async def _sync_config_to_node(self, node_address: str, namespace: str, key: str, value: Any) -> bool:
        """同步配置到单个节点"""
        try:
            async with aiohttp.ClientSession() as session:
                url = f"http://{node_address}/api/v1/config"
                payload = {
                    "namespace": namespace,
                    "key": key,
                    "value": value
                }
                
                async with session.post(url, json=payload, timeout=10) as response:
                    if response.status == 200:
                        print(f"节点 {node_address} 配置同步成功")
                        return True
                    else:
                        print(f"节点 {node_address} 配置同步失败: {response.status}")
                        return False
        except Exception as e:
            print(f"节点 {node_address} 配置同步异常: {e}")
            return False
    
    async def start_continuous_sync(self, namespace: str, key: str):
        """启动持续同步"""
        config_key = f"{namespace}.{key}"
        if config_key in self.sync_tasks:
            print(f"同步任务已存在: {config_key}")
            return
        
        # 创建同步任务
        task = asyncio.create_task(self._continuous_sync_task(namespace, key))
        self.sync_tasks[config_key] = task
        print(f"启动持续同步任务: {config_key}")
    
    async def stop_continuous_sync(self, namespace: str, key: str):
        """停止持续同步"""
        config_key = f"{namespace}.{key}"
        if config_key in self.sync_tasks:
            task = self.sync_tasks[config_key]
            task.cancel()
            del self.sync_tasks[config_key]
            print(f"停止持续同步任务: {config_key}")
    
    async def _continuous_sync_task(self, namespace: str, key: str):
        """持续同步任务"""
        last_value = None
        try:
            while True:
                # 获取最新配置值
                current_value = await self.config_center.get_config(namespace, key)
                
                # 如果值发生变化，则同步到所有节点
                if current_value != last_value:
                    print(f"检测到配置变化: {namespace}.{key} = {current_value}")
                    await self.sync_config_to_all_nodes(namespace, key, current_value)
                    last_value = current_value
                
                # 每30秒检查一次
                await asyncio.sleep(30)
        except asyncio.CancelledError:
            print(f"持续同步任务被取消: {namespace}.{key}")
        except Exception as e:
            print(f"持续同步任务异常: {e}")

# 节点端配置接收器
class ConfigReceiver:
    """节点端配置接收器"""
    def __init__(self, config_manager: ConfigManager):
        self.config_manager = config_manager
        self.local_configs: Dict[str, Any] = {}
    
    async def handle_config_update(self, request) -> Dict[str, str]:
        """
        处理配置更新请求
        """
        try:
            # 解析请求数据
            data = await request.json()
            namespace = data.get("namespace")
            key = data.get("key")
            value = data.get("value")
            
            if not all([namespace, key, value is not None]):
                return {"status": "error", "message": "缺少必要参数"}
            
            # 更新本地配置
            config_key = f"{namespace}.{key}"
            self.local_configs[config_key] = value
            
            # 保存到配置管理器
            self.config_manager.set_config_value(key, value, namespace)
            
            print(f"配置已更新: {config_key} = {value}")
            
            # 持久化配置（简化实现）
            await self._persist_config(config_key, value)
            
            return {"status": "success", "message": "配置更新成功"}
        except Exception as e:
            print(f"配置更新处理失败: {e}")
            return {"status": "error", "message": str(e)}
    
    async def _persist_config(self, key: str, value: Any):
        """
        持久化配置到本地存储
        """
        # 这里简化处理，实际可以保存到文件或本地数据库
        config_file = f"/etc/dfs/config_{key.replace('.', '_')}.json"
        try:
            with open(config_file, "w") as f:
                json.dump({"key": key, "value": value, "timestamp": time.time()}, f)
        except Exception as e:
            print(f"配置持久化失败: {e}")

# 配置变更通知服务
class ConfigNotificationService:
    """配置变更通知服务"""
    def __init__(self):
        self.subscribers: Dict[str, List[str]] = {}  # 配置键 -> 订阅者列表
        self.webhooks: Dict[str, str] = {}  # 订阅者 -> webhook URL
    
    async def subscribe(self, config_key: str, subscriber_id: str, webhook_url: str):
        """订阅配置变更"""
        if config_key not in self.subscribers:
            self.subscribers[config_key] = []
        
        if subscriber_id not in self.subscribers[config_key]:
            self.subscribers[config_key].append(subscriber_id)
            self.webhooks[subscriber_id] = webhook_url
            print(f"订阅者 {subscriber_id} 订阅了配置 {config_key}")
    
    async def unsubscribe(self, config_key: str, subscriber_id: str):
        """取消订阅"""
        if config_key in self.subscribers:
            if subscriber_id in self.subscribers[config_key]:
                self.subscribers[config_key].remove(subscriber_id)
                if subscriber_id in self.webhooks:
                    del self.webhooks[subscriber_id]
                print(f"订阅者 {subscriber_id} 取消订阅了配置 {config_key}")
    
    async def notify_config_change(self, config_key: str, new_value: Any, old_value: Any = None):
        """通知配置变更"""
        if config_key not in self.subscribers:
            return
        
        # 并发通知所有订阅者
        tasks = []
        for subscriber_id in self.subscribers[config_key]:
            if subscriber_id in self.webhooks:
                task = self._send_notification(
                    self.webhooks[subscriber_id], 
                    config_key, 
                    new_value, 
                    old_value
                )
                tasks.append(task)
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _send_notification(self, webhook_url: str, config_key: str, new_value: Any, old_value: Any):
        """发送通知到webhook"""
        try:
            payload = {
                "config_key": config_key,
                "new_value": new_value,
                "old_value": old_value,
                "timestamp": time.time()
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(webhook_url, json=payload, timeout=10) as response:
                    if response.status == 200:
                        print(f"通知发送成功: {webhook_url}")
                    else:
                        print(f"通知发送失败: {webhook_url}, 状态码: {response.status}")
        except Exception as e:
            print(f"通知发送异常: {webhook_url}, 错误: {e}")

# 使用示例
async def demonstrate_config_sync():
    # 创建配置中心和相关组件
    config_center = ConfigCenter()
    sync_manager = ConfigSyncManager(config_center)
    
    # 添加节点
    await sync_manager.add_node("192.168.1.10:8080")
    await sync_manager.add_node("192.168.1.11:8080")
    await sync_manager.add_node("192.168.1.12:8080")
    
    # 设置配置
    await config_center.set_config("prod", "network.max_connections", 10000, "admin", "设置最大连接数")
    
    # 同步配置到所有节点
    success = await sync_manager.sync_config_to_all_nodes("prod", "network.max_connections", 10000)
    print(f"配置同步{'成功' if success else '失败'}")

# 运行示例
# asyncio.run(demonstrate_config_sync())
```

## 8.3.3 版本控制与回滚机制

版本控制是配置管理中的重要功能，能够确保配置变更的可追溯性和可恢复性。

### 8.3.3.1 配置版本管理

```python
# 配置版本管理实现
import hashlib
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict

@dataclass
class ConfigChange:
    """配置变更记录"""
    namespace: str
    key: str
    old_value: Any
    new_value: Any
    author: str
    timestamp: datetime
    description: str
    change_id: str

class ConfigVersionControl:
    """配置版本控制"""
    def __init__(self, config_store: ConfigStore):
        self.config_store = config_store
        self.changes: List[ConfigChange] = []
        self.tags: Dict[str, str] = {}  # 标签 -> 版本ID
    
    async def commit_change(self, namespace: str, key: str, new_value: Any,
                          old_value: Any, author: str, description: str) -> str:
        """提交配置变更"""
        # 生成变更ID
        change_content = f"{namespace}.{key}.{old_value}.{new_value}.{author}.{datetime.now().isoformat()}"
        change_id = hashlib.sha256(change_content.encode()).hexdigest()[:16]
        
        # 记录变更
        change = ConfigChange(
            namespace=namespace,
            key=key,
            old_value=old_value,
            new_value=new_value,
            author=author,
            timestamp=datetime.now(),
            description=description,
            change_id=change_id
        )
        
        self.changes.append(change)
        print(f"配置变更已提交: {change_id}")
        
        return change_id
    
    async def create_tag(self, tag_name: str, version_id: str) -> bool:
        """创建标签"""
        if tag_name in self.tags:
            print(f"标签已存在: {tag_name}")
            return False
        
        self.tags[tag_name] = version_id
        print(f"标签已创建: {tag_name} -> {version_id}")
        return True
    
    async def get_tag_version(self, tag_name: str) -> Optional[str]:
        """获取标签对应的版本"""
        return self.tags.get(tag_name)
    
    async def list_changes(self, limit: int = 50) -> List[ConfigChange]:
        """列出配置变更历史"""
        # 返回最近的变更记录
        return self.changes[-limit:] if len(self.changes) > limit else self.changes
    
    async def get_change_by_id(self, change_id: str) -> Optional[ConfigChange]:
        """根据ID获取变更记录"""
        for change in self.changes:
            if change.change_id == change_id:
                return change
        return None
    
    async def export_changes(self, format: str = "json") -> str:
        """导出变更历史"""
        changes_data = [asdict(change) for change in self.changes]
        
        if format.lower() == "json":
            return json.dumps(changes_data, indent=2, default=str)
        elif format.lower() == "yaml":
            return yaml.dump(changes_data, default_flow_style=False)
        else:
            return str(changes_data)

# 配置备份与恢复
class ConfigBackupManager:
    """配置备份管理器"""
    def __init__(self, config_center: ConfigCenter):
        self.config_center = config_center
        self.backups: Dict[str, Dict[str, Any]] = {}
    
    async def create_backup(self, backup_name: str, namespace: str = None) -> str:
        """创建配置备份"""
        backup_time = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_id = f"{backup_name}_{backup_time}"
        
        # 收集配置数据
        backup_data = {}
        
        # 如果指定了命名空间，只备份该命名空间的配置
        # 否则备份所有配置
        # 这里简化实现，实际需要遍历所有配置
        
        self.backups[backup_id] = {
            "name": backup_name,
            "timestamp": backup_time,
            "data": backup_data,
            "namespace": namespace
        }
        
        print(f"配置备份已创建: {backup_id}")
        return backup_id
    
    async def restore_backup(self, backup_id: str) -> bool:
        """恢复配置备份"""
        if backup_id not in self.backups:
            print(f"备份不存在: {backup_id}")
            return False
        
        backup_data = self.backups[backup_id]
        print(f"开始恢复备份: {backup_id}")
        
        # 恢复配置数据
        # 这里简化实现，实际需要逐个恢复配置项
        
        print(f"备份恢复完成: {backup_id}")
        return True
    
    async def list_backups(self) -> List[Dict[str, str]]:
        """列出所有备份"""
        return [
            {
                "id": backup_id,
                "name": backup_info["name"],
                "timestamp": backup_info["timestamp"],
                "namespace": backup_info["namespace"]
            }
            for backup_id, backup_info in self.backups.items()
        ]
    
    async def delete_backup(self, backup_id: str) -> bool:
        """删除备份"""
        if backup_id in self.backups:
            del self.backups[backup_id]
            print(f"备份已删除: {backup_id}")
            return True
        else:
            print(f"备份不存在: {backup_id}")
            return False

# 配置审计日志
class ConfigAuditLogger:
    """配置审计日志"""
    def __init__(self):
        self.audit_logs: List[Dict[str, Any]] = []
    
    async def log_access(self, namespace: str, key: str, user: str, action: str, 
                        ip_address: str = None, user_agent: str = None):
        """记录配置访问日志"""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "namespace": namespace,
            "key": key,
            "user": user,
            "action": action,  # read, write, delete, rollback
            "ip_address": ip_address,
            "user_agent": user_agent,
            "log_id": self._generate_log_id(namespace, key, user, action)
        }
        
        self.audit_logs.append(log_entry)
        print(f"配置访问日志: {user} {action} {namespace}.{key}")
    
    async def query_logs(self, namespace: str = None, user: str = None, 
                        action: str = None, limit: int = 100) -> List[Dict[str, Any]]:
        """查询审计日志"""
        filtered_logs = self.audit_logs
        
        if namespace:
            filtered_logs = [log for log in filtered_logs if log["namespace"] == namespace]
        
        if user:
            filtered_logs = [log for log in filtered_logs if log["user"] == user]
        
        if action:
            filtered_logs = [log for log in filtered_logs if log["action"] == action]
        
        # 按时间倒序排列
        filtered_logs.sort(key=lambda x: x["timestamp"], reverse=True)
        
        return filtered_logs[:limit]
    
    async def export_logs(self, format: str = "json") -> str:
        """导出审计日志"""
        if format.lower() == "json":
            return json.dumps(self.audit_logs, indent=2)
        elif format.lower() == "csv":
            # 简化CSV导出
            if not self.audit_logs:
                return ""
            
            headers = list(self.audit_logs[0].keys())
            csv_lines = [",".join(headers)]
            
            for log in self.audit_logs:
                values = [str(log.get(header, "")) for header in headers]
                csv_lines.append(",".join(values))
            
            return "\n".join(csv_lines)
        else:
            return str(self.audit_logs)
    
    def _generate_log_id(self, namespace: str, key: str, user: str, action: str) -> str:
        """生成日志ID"""
        content = f"{namespace}.{key}.{user}.{action}.{datetime.now().isoformat()}"
        return hashlib.md5(content.encode()).hexdigest()[:16]

# 使用示例
async def demonstrate_version_control():
    # 创建配置中心和相关组件
    config_center = ConfigCenter()
    version_control = ConfigVersionControl(config_center.store)
    backup_manager = ConfigBackupManager(config_center)
    audit_logger = ConfigAuditLogger()
    
    # 设置初始配置
    await config_center.set_config("prod", "storage.replication_factor", 3, "admin", "初始配置")
    
    # 提交配置变更
    change_id = await version_control.commit_change(
        namespace="prod",
        key="storage.replication_factor",
        old_value=3,
        new_value=4,
        author="admin",
        description="增加副本因子以提高可靠性"
    )
    
    # 创建标签
    await version_control.create_tag("v1.0.0", change_id)
    
    # 创建备份
    backup_id = await backup_manager.create_backup("weekly_backup", "prod")
    
    # 记录审计日志
    await audit_logger.log_access("prod", "storage.replication_factor", "admin", "write", "192.168.1.100")
    
    # 查询变更历史
    changes = await version_control.list_changes()
    print(f"变更历史记录数: {len(changes)}")
    
    # 查询审计日志
    logs = await audit_logger.query_logs(user="admin", action="write")
    print(f"审计日志记录数: {len(logs)}")

# 运行示例
# asyncio.run(demonstrate_version_control())
```

### 8.3.3.2 配置变更审批流程

```python
# 配置变更审批流程实现
from enum import Enum
from typing import Dict, List, Optional
import uuid

class ChangeStatus(Enum):
    """变更状态"""
    PENDING = "pending"      # 待审批
    APPROVED = "approved"    # 已批准
    REJECTED = "rejected"    # 已拒绝
    APPLIED = "applied"      # 已应用
    ROLLED_BACK = "rolled_back"  # 已回滚

@dataclass
class ConfigChangeRequest:
    """配置变更请求"""
    request_id: str
    namespace: str
    key: str
    old_value: Any
    new_value: Any
    author: str
    reason: str
    urgency: str  # low, medium, high, critical
    status: ChangeStatus
    approvers: List[str]
    approved_by: List[str]
    rejected_by: List[str]
    created_at: datetime
    updated_at: datetime

class ConfigChangeApproval:
    """配置变更审批"""
    def __init__(self, config_center: ConfigCenter):
        self.config_center = config_center
        self.change_requests: Dict[str, ConfigChangeRequest] = {}
        self.approvers: Dict[str, List[str]] = {}  # 配置键 -> 审批者列表
    
    async def submit_change_request(self, namespace: str, key: str, new_value: Any,
                                  author: str, reason: str, urgency: str = "medium") -> str:
        """提交变更请求"""
        # 获取当前值
        old_value = await self.config_center.get_config(namespace, key)
        
        # 生成请求ID
        request_id = str(uuid.uuid4())
        
        # 创建变更请求
        change_request = ConfigChangeRequest(
            request_id=request_id,
            namespace=namespace,
            key=key,
            old_value=old_value,
            new_value=new_value,
            author=author,
            reason=reason,
            urgency=urgency,
            status=ChangeStatus.PENDING,
            approvers=self.approvers.get(f"{namespace}.{key}", ["admin"]),
            approved_by=[],
            rejected_by=[],
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        self.change_requests[request_id] = change_request
        print(f"变更请求已提交: {request_id}")
        
        # 发送通知给审批者
        await self._notify_approvers(change_request)
        
        return request_id
    
    async def approve_change(self, request_id: str, approver: str, comment: str = "") -> bool:
        """批准变更"""
        if request_id not in self.change_requests:
            print(f"变更请求不存在: {request_id}")
            return False
        
        change_request = self.change_requests[request_id]
        
        # 检查审批者权限
        if approver not in change_request.approvers:
            print(f"审批者无权限: {approver}")
            return False
        
        # 添加到已批准列表
        if approver not in change_request.approved_by:
            change_request.approved_by.append(approver)
        
        # 更新时间
        change_request.updated_at = datetime.now()
        
        # 检查是否所有审批者都已批准
        if set(change_request.approved_by) >= set(change_request.approvers):
            change_request.status = ChangeStatus.APPROVED
            print(f"变更请求已批准: {request_id}")
            
            # 自动应用变更
            await self._apply_change(change_request)
        
        return True
    
    async def reject_change(self, request_id: str, rejector: str, reason: str) -> bool:
        """拒绝变更"""
        if request_id not in self.change_requests:
            print(f"变更请求不存在: {request_id}")
            return False
        
        change_request = self.change_requests[request_id]
        
        # 检查审批者权限
        if rejector not in change_request.approvers:
            print(f"审批者无权限: {rejector}")
            return False
        
        # 添加到已拒绝列表
        if rejector not in change_request.rejected_by:
            change_request.rejected_by.append(rejector)
        
        # 更新状态
        change_request.status = ChangeStatus.REJECTED
        change_request.updated_at = datetime.now()
        
        print(f"变更请求已拒绝: {request_id}, 原因: {reason}")
        return True
    
    async def _apply_change(self, change_request: ConfigChangeRequest):
        """应用变更"""
        try:
            # 应用配置变更
            await self.config_center.set_config(
                change_request.namespace,
                change_request.key,
                change_request.new_value,
                change_request.author,
                change_request.reason
            )
            
            # 更新状态
            change_request.status = ChangeStatus.APPLIED
            change_request.updated_at = datetime.now()
            
            print(f"变更已应用: {change_request.request_id}")
        except Exception as e:
            print(f"变更应用失败: {e}")
            # 可以在这里实现回滚逻辑
    
    async def _notify_approvers(self, change_request: ConfigChangeRequest):
        """通知审批者"""
        # 这里简化实现，实际可以通过邮件、消息队列等方式通知
        approvers_str = ", ".join(change_request.approvers)
        print(f"通知审批者: {approvers_str}")
        print(f"变更请求: {change_request.namespace}.{change_request.key}")
        print(f"变更内容: {change_request.old_value} -> {change_request.new_value}")
        print(f"变更原因: {change_request.reason}")
    
    async def get_pending_requests(self, approver: str = None) -> List[ConfigChangeRequest]:
        """获取待审批的请求"""
        pending_requests = [
            req for req in self.change_requests.values()
            if req.status == ChangeStatus.PENDING
        ]
        
        if approver:
            pending_requests = [
                req for req in pending_requests
                if approver in req.approvers
            ]
        
        return pending_requests
    
    async def get_request_by_id(self, request_id: str) -> Optional[ConfigChangeRequest]:
        """根据ID获取请求"""
        return self.change_requests.get(request_id)
    
    async def set_approvers(self, config_key: str, approvers: List[str]):
        """设置配置项的审批者"""
        self.approvers[config_key] = approvers
        print(f"配置项 {config_key} 的审批者已设置: {approvers}")

# 紧急变更处理
class EmergencyChangeHandler:
    """紧急变更处理"""
    def __init__(self, approval_system: ConfigChangeApproval):
        self.approval_system = approval_system
        self.emergency_contacts: List[str] = ["admin", "ops_lead", "architect"]
    
    async def submit_emergency_change(self, namespace: str, key: str, new_value: Any,
                                    author: str, reason: str) -> str:
        """提交紧急变更"""
        # 紧急变更可以直接应用，但需要事后补录审批
        print(f"紧急变更提交: {namespace}.{key} = {new_value}")
        print(f"变更原因: {reason}")
        
        # 直接应用变更
        await self.approval_system.config_center.set_config(
            namespace, key, new_value, author, f"紧急变更: {reason}"
        )
        
        # 创建紧急变更记录
        request_id = await self.approval_system.submit_change_request(
            namespace, key, new_value, author, reason, "critical"
        )
        
        # 通知紧急联系人
        await self._notify_emergency_contacts(request_id, namespace, key, new_value, reason)
        
        return request_id
    
    async def _notify_emergency_contacts(self, request_id: str, namespace: str, key: str, 
                                       new_value: Any, reason: str):
        """通知紧急联系人"""
        contacts_str = ", ".join(self.emergency_contacts)
        print(f"紧急变更通知: {contacts_str}")
        print(f"请求ID: {request_id}")
        print(f"变更详情: {namespace}.{key} = {new_value}")
        print(f"变更原因: {reason}")

# 使用示例
async def demonstrate_approval_workflow():
    # 创建配置中心和审批系统
    config_center = ConfigCenter()
    approval_system = ConfigChangeApproval(config_center)
    emergency_handler = EmergencyChangeHandler(approval_system)
    
    # 设置配置项的审批者
    await approval_system.set_approvers("prod.storage.replication_factor", ["admin", "architect"])
    
    # 提交变更请求
    request_id = await approval_system.submit_change_request(
        namespace="prod",
        key="storage.replication_factor",
        new_value=5,
        author="developer",
        reason="提高数据可靠性",
        urgency="high"
    )
    
    # 审批者批准变更
    await approval_system.approve_change(request_id, "admin", "同意变更")
    await approval_system.approve_change(request_id, "architect", "同意变更")
    
    # 查询待审批请求
    pending_requests = await approval_system.get_pending_requests("admin")
    print(f"待审批请求数: {len(pending_requests)}")
    
    # 提交紧急变更
    emergency_request_id = await emergency_handler.submit_emergency_change(
        namespace="prod",
        key="network.max_connections",
        new_value=20000,
        author="ops",
        reason="突发流量需要紧急扩容"
    )
    
    print(f"紧急变更请求ID: {emergency_request_id}")

# 运行示例
# asyncio.run(demonstrate_approval_workflow())
```

## 8.3.4 配置安全管理

配置安全管理是确保配置数据不被未授权访问和篡改的重要措施。

### 8.3.4.1 配置加密与解密

```python
# 配置加密与解密实现
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import os

class ConfigEncryption:
    """配置加密"""
    def __init__(self, master_password: str = None):
        self.master_password = master_password or os.getenv("CONFIG_MASTER_PASSWORD")
        self.cipher = self._create_cipher()
    
    def _create_cipher(self) -> Fernet:
        """创建加密器"""
        if not self.master_password:
            # 生成随机密钥
            key = Fernet.generate_key()
        else:
            # 基于主密码生成密钥
            salt = b'dfs_config_salt_2025'  # 固定盐值，实际应用中应该使用随机盐值
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=100000,
            )
            key = base64.urlsafe_b64encode(kdf.derive(self.master_password.encode()))
        
        return Fernet(key)
    
    def encrypt_value(self, value: str) -> str:
        """加密配置值"""
        if not isinstance(value, str):
            value = str(value)
        
        encrypted_bytes = self.cipher.encrypt(value.encode())
        return base64.urlsafe_b64encode(encrypted_bytes).decode()
    
    def decrypt_value(self, encrypted_value: str) -> str:
        """解密配置值"""
        try:
            encrypted_bytes = base64.urlsafe_b64decode(encrypted_value.encode())
            decrypted_bytes = self.cipher.decrypt(encrypted_bytes)
            return decrypted_bytes.decode()
        except Exception as e:
            print(f"解密失败: {e}")
            return None

class SecureConfigManager:
    """安全配置管理器"""
    def __init__(self, config_manager: ConfigManager, encryption: ConfigEncryption):
        self.config_manager = config_manager
        self.encryption = encryption
        self.sensitive_keys: Set[str] = set()  # 敏感配置键集合
    
    def register_sensitive_key(self, key: str):
        """注册敏感配置键"""
        self.sensitive_keys.add(key)
        print(f"敏感配置键已注册: {key}")
    
    def set_secure_config(self, key: str, value: Any, namespace: str = "default") -> bool:
        """安全地设置配置值"""
        # 如果是敏感配置，先加密
        if key in self.sensitive_keys:
            if isinstance(value, str):
                encrypted_value = self.encryption.encrypt_value(value)
                # 标记为加密值
                final_value = f"ENCRYPTED:{encrypted_value}"
            else:
                # 非字符串值直接存储
                final_value = value
        else:
            final_value = value
        
        return self.config_manager.set_config_value(key, final_value, namespace)
    
    def get_secure_config(self, key: str, namespace: str = "default", default: Any = None) -> Any:
        """安全地获取配置值"""
        value = self.config_manager.get_config_value(key, namespace, default)
        
        # 如果是加密值，先解密
        if isinstance(value, str) and value.startswith("ENCRYPTED:"):
            encrypted_part = value[10:]  # 移除"ENCRYPTED:"前缀
            decrypted_value = self.encryption.decrypt_value(encrypted_part)
            return decrypted_value
        
        return value

# 访问控制管理
class ConfigAccessControl:
    """配置访问控制"""
    def __init__(self):
        self.permissions: Dict[str, Dict[str, List[str]]] = {}  # 用户 -> 命名空间 -> 操作权限
        self.roles: Dict[str, List[str]] = {}  # 角色 -> 权限列表
    
    def create_role(self, role_name: str, permissions: List[str]):
        """创建角色"""
        self.roles[role_name] = permissions
        print(f"角色已创建: {role_name}")
    
    def assign_role_to_user(self, user: str, role_name: str, namespace: str = "default"):
        """为用户分配角色"""
        if role_name not in self.roles:
            print(f"角色不存在: {role_name}")
            return False
        
        if user not in self.permissions:
            self.permissions[user] = {}
        
        if namespace not in self.permissions[user]:
            self.permissions[user][namespace] = []
        
        # 添加角色权限
        role_permissions = self.roles[role_name]
        for permission in role_permissions:
            if permission not in self.permissions[user][namespace]:
                self.permissions[user][namespace].append(permission)
        
        print(f"用户 {user} 在命名空间 {namespace} 中已分配角色: {role_name}")
        return True
    
    def check_permission(self, user: str, namespace: str, action: str) -> bool:
        """检查用户权限"""
        if user not in self.permissions:
            return False
        
        if namespace not in self.permissions[user]:
            # 检查全局权限
            if "global" in self.permissions[user]:
                return action in self.permissions[user]["global"]
            return False
        
        return action in self.permissions[user][namespace]
    
    def grant_permission(self, user: str, namespace: str, action: str):
        """授予用户权限"""
        if user not in self.permissions:
            self.permissions[user] = {}
        
        if namespace not in self.permissions[user]:
            self.permissions[user][namespace] = []
        
        if action not in self.permissions[user][namespace]:
            self.permissions[user][namespace].append(action)
            print(f"用户 {user} 在命名空间 {namespace} 中已授予权限: {action}")
    
    def revoke_permission(self, user: str, namespace: str, action: str):
        """撤销用户权限"""
        if user in self.permissions and namespace in self.permissions[user]:
            if action in self.permissions[user][namespace]:
                self.permissions[user][namespace].remove(action)
                print(f"用户 {user} 在命名空间 {namespace} 中已撤销权限: {action}")

# 配置安全审计
class ConfigSecurityAudit:
    """配置安全审计"""
    def __init__(self, access_control: ConfigAccessControl):
        self.access_control = access_control
        self.security_events: List[Dict[str, Any]] = []
    
    async def log_security_event(self, event_type: str, user: str, namespace: str, 
                               resource: str, details: str = None, success: bool = True):
        """记录安全事件"""
        event = {
            "timestamp": datetime.now().isoformat(),
            "event_type": event_type,  # access_denied, unauthorized_change, sensitive_access
            "user": user,
            "namespace": namespace,
            "resource": resource,
            "details": details,
            "success": success,
            "event_id": self._generate_event_id(event_type, user, namespace)
        }
        
        self.security_events.append(event)
        print(f"安全事件: {event_type} - 用户: {user}, 资源: {resource}")
        
        # 如果是安全违规事件，发送告警
        if not success or event_type in ["access_denied", "unauthorized_change"]:
            await self._send_security_alert(event)
    
    async def _send_security_alert(self, event: Dict[str, Any]):
        """发送安全告警"""
        # 这里简化实现，实际可以通过邮件、短信、Slack等方式发送告警
        print(f"安全告警: {event['event_type']} - 用户: {event['user']}")
        print(f"详情: {event['details']}")
    
    async def get_security_events(self, event_type: str = None, user: str = None, 
                                time_range_hours: int = 24) -> List[Dict[str, Any]]:
        """获取安全事件"""
        filtered_events = self.security_events
        
        # 根据事件类型过滤
        if event_type:
            filtered_events = [event for event in filtered_events if event["event_type"] == event_type]
        
        # 根据用户过滤
        if user:
            filtered_events = [event for event in filtered_events if event["user"] == user]
        
        # 根据时间范围过滤
        if time_range_hours > 0:
            cutoff_time = datetime.now().timestamp() - (time_range_hours * 3600)
            filtered_events = [
                event for event in filtered_events 
                if datetime.fromisoformat(event["timestamp"]).timestamp() > cutoff_time
            ]
        
        # 按时间倒序排列
        filtered_events.sort(key=lambda x: x["timestamp"], reverse=True)
        
        return filtered_events
    
    async def generate_security_report(self, time_range_days: int = 7) -> Dict[str, Any]:
        """生成安全报告"""
        time_range_hours = time_range_days * 24
        events = await self.get_security_events(time_range_hours=time_range_hours)
        
        # 统计各类事件
        event_stats = {}
        user_stats = {}
        
        for event in events:
            # 事件类型统计
            event_type = event["event_type"]
            event_stats[event_type] = event_stats.get(event_type, 0) + 1
            
            # 用户统计
            user = event["user"]
            user_stats[user] = user_stats.get(user, 0) + 1
        
        report = {
            "report_period_days": time_range_days,
            "total_events": len(events),
            "event_statistics": event_stats,
            "user_statistics": user_stats,
            "high_risk_events": [
                event for event in events 
                if not event["success"] or event["event_type"] in ["unauthorized_change"]
            ]
        }
        
        return report
    
    def _generate_event_id(self, event_type: str, user: str, namespace: str) -> str:
        """生成事件ID"""
        content = f"{event_type}.{user}.{namespace}.{datetime.now().isoformat()}"
        return hashlib.md5(content.encode()).hexdigest()[:16]

# 使用示例
async def demonstrate_config_security():
    # 创建配置管理组件
    config_manager = ConfigManager()
    encryption = ConfigEncryption("my_secret_password")
    secure_manager = SecureConfigManager(config_manager, encryption)
    access_control = ConfigAccessControl()
    security_audit = ConfigSecurityAudit(access_control)
    
    # 注册敏感配置键
    secure_manager.register_sensitive_key("database.password")
    secure_manager.register_sensitive_key("api.secret_key")
    
    # 创建角色
    access_control.create_role("admin", ["read", "write", "delete", "admin"])
    access_control.create_role("developer", ["read", "write"])
    access_control.create_role("viewer", ["read"])
    
    # 为用户分配角色
    access_control.assign_role_to_user("alice", "admin", "prod")
    access_control.assign_role_to_user("bob", "developer", "prod")
    access_control.assign_role_to_user("charlie", "viewer", "prod")
    
    # 安全地设置敏感配置
    secure_manager.set_secure_config("database.password", "super_secret_password_123", "prod")
    secure_manager.set_secure_config("api.secret_key", "api_key_456789", "prod")
    
    # 安全地获取敏感配置
    db_password = secure_manager.get_secure_config("database.password", "prod")
    print(f"数据库密码: {db_password}")
    
    # 检查用户权限
    alice_can_write = access_control.check_permission("alice", "prod", "write")
    bob_can_delete = access_control.check_permission("bob", "prod", "delete")
    print(f"Alice 可以写入: {alice_can_write}")
    print(f"Bob 可以删除: {bob_can_delete}")
    
    # 记录安全事件
    await security_audit.log_security_event(
        event_type="sensitive_access",
        user="alice",
        namespace="prod",
        resource="database.password",
        details="访问数据库密码配置",
        success=True
    )
    
    # 生成安全报告
    security_report = await security_audit.generate_security_report(7)
    print(f"安全报告: {security_report}")

# 运行示例
# asyncio.run(demonstrate_config_security())
```

### 8.3.4.2 配置合规性检查

```python
# 配置合规性检查实现
from typing import Dict, List, Callable, Any
import re

class ConfigComplianceRule:
    """配置合规性规则"""
    def __init__(self, rule_id: str, name: str, description: str, 
                 config_key_pattern: str, validator: Callable[[Any], bool],
                 severity: str = "medium", remediation: str = None):
        self.rule_id = rule_id
        self.name = name
        self.description = description
        self.config_key_pattern = config_key_pattern
        self.validator = validator
        self.severity = severity  # low, medium, high, critical
        self.remediation = remediation

class ConfigComplianceChecker:
    """配置合规性检查器"""
    def __init__(self):
        self.rules: Dict[str, ConfigComplianceRule] = {}
        self.exclusions: Dict[str, List[str]] = {}  # 命名空间 -> 排除的规则ID列表
    
    def add_rule(self, rule: ConfigComplianceRule):
        """添加合规性规则"""
        self.rules[rule.rule_id] = rule
        print(f"合规性规则已添加: {rule.name}")
    
    def exclude_rule_for_namespace(self, rule_id: str, namespace: str):
        """为命名空间排除规则"""
        if namespace not in self.exclusions:
            self.exclusions[namespace] = []
        
        if rule_id not in self.exclusions[namespace]:
            self.exclusions[namespace].append(rule_id)
            print(f"规则 {rule_id} 已为命名空间 {namespace} 排除")
    
    async def check_compliance(self, config_manager: ConfigManager, 
                             namespace: str = "default") -> Dict[str, Any]:
        """检查配置合规性"""
        violations = []
        checked_rules = 0
        
        # 获取命名空间的配置
        namespace_configs = config_manager.config_values.get(namespace, {})
        
        # 检查每个配置项
        for config_key, config_value in namespace_configs.items():
            # 检查每个规则
            for rule_id, rule in self.rules.items():
                # 检查是否排除了此规则
                if (namespace in self.exclusions and 
                    rule_id in self.exclusions[namespace]):
                    continue
                
                # 检查配置键是否匹配规则模式
                if re.match(rule.config_key_pattern, config_key):
                    checked_rules += 1
                    
                    # 应用验证器
                    try:
                        is_valid = rule.validator(config_value)
                        if not is_valid:
                            violation = {
                                "rule_id": rule_id,
                                "rule_name": rule.name,
                                "config_key": config_key,
                                "config_value": config_value,
                                "severity": rule.severity,
                                "description": rule.description,
                                "remediation": rule.remediation
                            }
                            violations.append(violation)
                    except Exception as e:
                        print(f"规则 {rule_id} 验证配置 {config_key} 时出错: {e}")
        
        # 统计违规情况
        severity_counts = {}
        for violation in violations:
            severity = violation["severity"]
            severity_counts[severity] = severity_counts.get(severity, 0) + 1
        
        return {
            "namespace": namespace,
            "total_checked": checked_rules,
            "total_violations": len(violations),
            "severity_counts": severity_counts,
            "violations": violations,
            "compliance_rate": (checked_rules - len(violations)) / checked_rules if checked_rules > 0 else 1.0
        }
    
    async def check_all_namespaces(self, config_manager: ConfigManager) -> List[Dict[str, Any]]:
        """检查所有命名空间的合规性"""
        results = []
        namespaces = list(config_manager.config_values.keys())
        
        for namespace in namespaces:
            result = await self.check_compliance(config_manager, namespace)
            results.append(result)
        
        return results

# 常用合规性规则
def create_common_compliance_rules() -> List[ConfigComplianceRule]:
    """创建常用合规性规则"""
    rules = [
        ConfigComplianceRule(
            rule_id="SEC001",
            name="禁止明文密码",
            description="配置中不得包含明文密码",
            config_key_pattern=r".*password.*|.*secret.*|.*token.*",
            validator=lambda value: not (isinstance(value, str) and 
                                       re.search(r"[Pp]assword|[Ss]ecret|[Tt]oken", value)),
            severity="critical",
            remediation="使用加密存储或外部密钥管理服务"
        ),
        ConfigComplianceRule(
            rule_id="SEC002",
            name="安全端口检查",
            description="禁止使用不安全的端口",
            config_key_pattern=r".*port.*",
            validator=lambda value: not (isinstance(value, int) and value in [21, 23, 25, 80]),
            severity="high",
            remediation="使用安全端口（如443、8443）或启用TLS加密"
        ),
        ConfigComplianceRule(
            rule_id="PERF001",
            name="合理的线程池大小",
            description="线程池大小应在合理范围内",
            config_key_pattern=r".*thread.*pool.*",
            validator=lambda value: isinstance(value, int) and 1 <= value <= 1000,
            severity="medium",
            remediation="调整线程池大小至合理范围（1-1000）"
        ),
        ConfigComplianceRule(
            rule_id="STORAGE001",
            name="磁盘使用率限制",
            description="磁盘使用率不应超过90%",
            config_key_pattern=r".*disk.*usage.*|.*storage.*usage.*",
            validator=lambda value: isinstance(value, (int, float)) and value <= 90,
            severity="high",
            remediation="清理磁盘空间或扩展存储容量"
        ),
        ConfigComplianceRule(
            rule_id="NETWORK001",
            name="合理的连接数限制",
            description="最大连接数应在合理范围内",
            config_key_pattern=r".*max.*connections.*",
            validator=lambda value: isinstance(value, int) and 1 <= value <= 100000,
            severity="medium",
            remediation="调整最大连接数至合理范围（1-100000）"
        )
    ]
    
    return rules

# 配置健康检查
class ConfigHealthChecker:
    """配置健康检查"""
    def __init__(self, config_manager: ConfigManager):
        self.config_manager = config_manager
        self.health_checks: Dict[str, Callable] = {}
    
    def register_health_check(self, check_name: str, check_func: Callable[[], Dict[str, Any]]):
        """注册健康检查"""
        self.health_checks[check_name] = check_func
        print(f"健康检查已注册: {check_name}")
    
    async def run_health_checks(self) -> Dict[str, Any]:
        """运行所有健康检查"""
        results = {}
        overall_status = "healthy"
        
        for check_name, check_func in self.health_checks.items():
            try:
                result = check_func()
                results[check_name] = result
                
                # 如果有任何检查失败，整体状态为不健康
                if result.get("status") == "unhealthy":
                    overall_status = "unhealthy"
            except Exception as e:
                results[check_name] = {
                    "status": "error",
                    "message": str(e)
                }
                overall_status = "unhealthy"
        
        return {
            "timestamp": datetime.now().isoformat(),
            "overall_status": overall_status,
            "checks": results
        }
    
    def check_config_store_health(self) -> Dict[str, Any]:
        """检查配置存储健康"""
        try:
            # 检查配置存储是否可访问
            config_count = sum(len(configs) for configs in self.config_manager.config_values.values())
            
            return {
                "status": "healthy",
                "message": f"配置存储正常，共有 {config_count} 个配置项",
                "config_count": config_count
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "message": f"配置存储异常: {str(e)}"
            }
    
    def check_config_consistency(self) -> Dict[str, Any]:
        """检查配置一致性"""
        try:
            inconsistencies = []
            
            # 检查必需配置项是否存在
            required_configs = [
                "system.log_level",
                "network.bind_port",
                "storage.max_disk_usage"
            ]
            
            for config_key in required_configs:
                found = False
                for namespace_configs in self.config_manager.config_values.values():
                    if config_key in namespace_configs:
                        found = True
                        break
                
                if not found:
                    inconsistencies.append(f"缺少必需配置项: {config_key}")
            
            if inconsistencies:
                return {
                    "status": "unhealthy",
                    "message": "配置不一致",
                    "inconsistencies": inconsistencies
                }
            else:
                return {
                    "status": "healthy",
                    "message": "配置一致性检查通过"
                }
        except Exception as e:
            return {
                "status": "error",
                "message": f"配置一致性检查异常: {str(e)}"
            }

# 使用示例
async def demonstrate_compliance_checking():
    # 创建配置管理器并设置一些配置
    config_manager = ConfigManager()
    
    # 注册配置项
    config_items = [
        ConfigItem("database.password", "plaintext_password_123", ConfigType.SECURITY, ConfigScope.GLOBAL, "数据库密码"),
        ConfigItem("network.bind_port", 80, ConfigType.NETWORK, ConfigScope.GLOBAL, "绑定端口"),
        ConfigItem("storage.max_disk_usage", 95, ConfigType.STORAGE, ConfigScope.GLOBAL, "磁盘使用率"),
        ConfigItem("performance.thread_pool_size", 2000, ConfigType.PERFORMANCE, ConfigScope.CLUSTER, "线程池大小"),
        ConfigItem("network.max_connections", 150000, ConfigType.NETWORK, ConfigScope.GLOBAL, "最大连接数")
    ]
    
    for item in config_items:
        config_manager.register_config_item(item)
        config_manager.set_config_value(item.key, item.value, "prod")
    
    # 创建合规性检查器
    compliance_checker = ConfigComplianceChecker()
    
    # 添加常用规则
    rules = create_common_compliance_rules()
    for rule in rules:
        compliance_checker.add_rule(rule)
    
    # 为特定命名空间排除某些规则
    compliance_checker.exclude_rule_for_namespace("SEC001", "dev")
    
    # 执行合规性检查
    compliance_result = await compliance_checker.check_compliance(config_manager, "prod")
    print(f"合规性检查结果: {compliance_result}")
    
    # 创建健康检查器
    health_checker = ConfigHealthChecker(config_manager)
    
    # 注册健康检查
    health_checker.register_health_check("config_store", health_checker.check_config_store_health)
    health_checker.register_health_check("config_consistency", health_checker.check_config_consistency)
    
    # 运行健康检查
    health_results = await health_checker.run_health_checks()
    print(f"健康检查结果: {health_results}")

# 运行示例
# asyncio.run(demonstrate_compliance_checking())
```

## 总结

配置中心化管理是分布式文件存储平台稳定运行的重要保障。通过建立完善的配置管理体系，我们可以实现：

1. **环境隔离**：通过命名空间和环境管理，确保不同环境的配置相互独立，避免配置混乱。

2. **版本控制**：通过版本管理和变更历史记录，确保配置变更的可追溯性和可恢复性。

3. **安全管控**：通过加密存储、访问控制和安全审计，保护配置数据不被未授权访问和篡改。

4. **合规检查**：通过合规性规则和健康检查，确保配置符合安全和性能要求。

5. **自动化同步**：通过配置同步机制，确保集群中所有节点的配置保持一致。

在实际应用中，我们需要根据具体的业务场景和技术栈选择合适的工具和方案，并持续优化配置管理策略，以适应不断变化的需求和环境。配置管理不仅仅是技术问题，更是流程和规范的问题，需要建立完善的变更审批流程和安全管理制度，确保配置管理的安全性和可靠性。
