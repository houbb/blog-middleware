---
title: "配置管理与权限控制"
date: 2025-09-07
categories: [DistributedFile]
tags: [DistributedFile]
published: true
---

在分布式文件存储平台中，配置管理与权限控制是确保系统安全性和可维护性的核心要素。通过精细化的配置管理和严格的权限控制，我们能够有效防止未授权访问，保障系统配置的一致性，并为不同角色的用户提供适当的系统访问权限。

## 13.1.2 配置管理系统设计

配置管理系统需要提供灵活的配置存储、版本控制和动态更新能力，以适应分布式系统的复杂需求。

### 13.1.2.1 配置存储与版本控制

```python
# 配置管理系统
import time
import threading
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime, timedelta
import json
import hashlib

class ConfigurationItem:
    """配置项"""
    
    def __init__(self, key: str, value: Any, description: str = "", 
                 category: str = "general", tags: List[str] = None):
        self.key = key
        self.value = value
        self.description = description
        self.category = category
        self.tags = tags or []
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
        self.version = 1
        self.history = []

class ConfigurationStore:
    """配置存储"""
    
    def __init__(self, store_name: str):
        self.store_name = store_name
        self.configurations = {}
        self.watchers = {}
        self.lock = threading.RLock()
    
    def set_config(self, key: str, value: Any, description: str = "", 
                   category: str = "general", tags: List[str] = None) -> bool:
        """设置配置项"""
        with self.lock:
            if key in self.configurations:
                # 更新现有配置
                config_item = self.configurations[key]
                # 保存历史版本
                config_item.history.append({
                    "value": config_item.value,
                    "version": config_item.version,
                    "updated_at": config_item.updated_at.isoformat()
                })
                config_item.value = value
                config_item.version += 1
                config_item.updated_at = datetime.now()
                config_item.description = description
                config_item.category = category
                config_item.tags = tags or []
            else:
                # 创建新配置
                self.configurations[key] = ConfigurationItem(
                    key, value, description, category, tags
                )
            
            # 通知观察者
            self._notify_watchers(key, value)
            
            print(f"配置项 {key} 已更新")
            return True
    
    def get_config(self, key: str, default: Any = None) -> Any:
        """获取配置项"""
        with self.lock:
            if key in self.configurations:
                return self.configurations[key].value
            return default
    
    def get_config_item(self, key: str) -> Optional[ConfigurationItem]:
        """获取配置项详细信息"""
        with self.lock:
            return self.configurations.get(key)
    
    def delete_config(self, key: str) -> bool:
        """删除配置项"""
        with self.lock:
            if key in self.configurations:
                del self.configurations[key]
                self._notify_watchers(key, None)
                print(f"配置项 {key} 已删除")
                return True
            return False
    
    def list_configs(self, category: str = None, tag: str = None) -> Dict[str, Any]:
        """列出配置项"""
        with self.lock:
            result = {}
            for key, config_item in self.configurations.items():
                # 根据分类或标签过滤
                if category and config_item.category != category:
                    continue
                if tag and tag not in config_item.tags:
                    continue
                result[key] = {
                    "value": config_item.value,
                    "description": config_item.description,
                    "category": config_item.category,
                    "tags": config_item.tags,
                    "version": config_item.version,
                    "created_at": config_item.created_at.isoformat(),
                    "updated_at": config_item.updated_at.isoformat()
                }
            return result
    
    def add_watcher(self, key: str, callback: Callable[[str, Any], None]):
        """添加配置观察者"""
        if key not in self.watchers:
            self.watchers[key] = []
        self.watchers[key].append(callback)
        print(f"为配置项 {key} 添加观察者")
    
    def _notify_watchers(self, key: str, value: Any):
        """通知观察者"""
        if key in self.watchers:
            for callback in self.watchers[key]:
                try:
                    callback(key, value)
                except Exception as e:
                    print(f"通知观察者失败: {e}")
    
    def export_config(self, format: str = "json") -> str:
        """导出配置"""
        with self.lock:
            export_data = {}
            for key, config_item in self.configurations.items():
                export_data[key] = {
                    "value": config_item.value,
                    "description": config_item.description,
                    "category": config_item.category,
                    "tags": config_item.tags,
                    "version": config_item.version,
                    "created_at": config_item.created_at.isoformat(),
                    "updated_at": config_item.updated_at.isoformat(),
                    "history": config_item.history
                }
            
            if format.lower() == "json":
                return json.dumps(export_data, indent=2, ensure_ascii=False)
            else:
                return str(export_data)
    
    def import_config(self, config_data: str, format: str = "json") -> bool:
        """导入配置"""
        try:
            if format.lower() == "json":
                data = json.loads(config_data)
            else:
                data = eval(config_data)  # 简化处理，实际应用中应更安全
            
            with self.lock:
                for key, config_dict in data.items():
                    self.configurations[key] = ConfigurationItem(
                        key=key,
                        value=config_dict["value"],
                        description=config_dict.get("description", ""),
                        category=config_dict.get("category", "general"),
                        tags=config_dict.get("tags", [])
                    )
                    # 恢复版本信息
                    self.configurations[key].version = config_dict.get("version", 1)
                    self.configurations[key].created_at = datetime.fromisoformat(
                        config_dict.get("created_at", datetime.now().isoformat())
                    )
                    self.configurations[key].updated_at = datetime.fromisoformat(
                        config_dict.get("updated_at", datetime.now().isoformat())
                    )
                    self.configurations[key].history = config_dict.get("history", [])
            
            print(f"成功导入 {len(data)} 个配置项")
            return True
        except Exception as e:
            print(f"导入配置失败: {e}")
            return False

class ConfigurationVersionControl:
    """配置版本控制"""
    
    def __init__(self, config_store: ConfigurationStore):
        self.config_store = config_store
        self.snapshots = {}
        self.rollback_points = {}
    
    def create_snapshot(self, snapshot_name: str, description: str = "") -> str:
        """创建配置快照"""
        snapshot_id = f"snapshot_{int(datetime.now().timestamp() * 1000)}"
        
        config_data = self.config_store.export_config()
        self.snapshots[snapshot_id] = {
            "name": snapshot_name,
            "description": description,
            "data": config_data,
            "created_at": datetime.now().isoformat()
        }
        
        print(f"创建配置快照: {snapshot_name} ({snapshot_id})")
        return snapshot_id
    
    def restore_snapshot(self, snapshot_id: str) -> bool:
        """恢复配置快照"""
        if snapshot_id not in self.snapshots:
            print(f"快照 {snapshot_id} 不存在")
            return False
        
        snapshot = self.snapshots[snapshot_id]
        return self.config_store.import_config(snapshot["data"])
    
    def set_rollback_point(self, point_name: str, description: str = "") -> str:
        """设置回滚点"""
        rollback_id = f"rollback_{int(datetime.now().timestamp() * 1000)}"
        
        config_data = self.config_store.export_config()
        self.rollback_points[rollback_id] = {
            "name": point_name,
            "description": description,
            "data": config_data,
            "created_at": datetime.now().isoformat()
        }
        
        print(f"设置回滚点: {point_name} ({rollback_id})")
        return rollback_id
    
    def rollback_to_point(self, rollback_id: str) -> bool:
        """回滚到指定点"""
        if rollback_id not in self.rollback_points:
            print(f"回滚点 {rollback_id} 不存在")
            return False
        
        rollback_point = self.rollback_points[rollback_id]
        return self.config_store.import_config(rollback_point["data"])
    
    def list_snapshots(self) -> Dict[str, Any]:
        """列出快照"""
        return {
            snapshot_id: {
                "name": snapshot["name"],
                "description": snapshot["description"],
                "created_at": snapshot["created_at"]
            }
            for snapshot_id, snapshot in self.snapshots.items()
        }
    
    def list_rollback_points(self) -> Dict[str, Any]:
        """列出回滚点"""
        return {
            point_id: {
                "name": point["name"],
                "description": point["description"],
                "created_at": point["created_at"]
            }
            for point_id, point in self.rollback_points.items()
        }

# 使用示例
def on_config_change(key: str, value: Any):
    """配置变更回调"""
    print(f"配置变更通知: {key} = {value}")

def demonstrate_configuration_management():
    """演示配置管理"""
    # 创建配置存储
    config_store = ConfigurationStore("主配置存储")
    
    # 添加配置项
    config_store.set_config(
        "storage.max_file_size",
        1073741824,  # 1GB
        "最大文件大小限制",
        "storage",
        ["limit", "performance"]
    )
    
    config_store.set_config(
        "network.max_connections",
        1000,
        "最大并发连接数",
        "network",
        ["performance", "security"]
    )
    
    config_store.set_config(
        "security.enable_encryption",
        True,
        "是否启用数据加密",
        "security",
        ["encryption", "compliance"]
    )
    
    # 添加观察者
    config_store.add_watcher("storage.max_file_size", on_config_change)
    
    # 获取配置
    max_file_size = config_store.get_config("storage.max_file_size")
    print(f"最大文件大小: {max_file_size} 字节")
    
    # 列出配置
    storage_configs = config_store.list_configs(category="storage")
    print(f"\n存储相关配置:")
    for key, config in storage_configs.items():
        print(f"  {key}: {config['value']} ({config['description']})")
    
    # 导出配置
    config_export = config_store.export_config()
    print(f"\n配置导出长度: {len(config_export)} 字符")
    
    # 创建版本控制
    version_control = ConfigurationVersionControl(config_store)
    
    # 创建快照
    snapshot_id = version_control.create_snapshot(
        "初始配置",
        "系统初始配置状态"
    )
    
    # 修改配置
    config_store.set_config("storage.max_file_size", 2147483648)  # 2GB
    
    # 创建回滚点
    rollback_id = version_control.set_rollback_point(
        "扩容前配置",
        "存储扩容前的配置状态"
    )
    
    # 列出快照和回滚点
    snapshots = version_control.list_snapshots()
    rollback_points = version_control.list_rollback_points()
    
    print(f"\n快照数量: {len(snapshots)}")
    print(f"回滚点数量: {len(rollback_points)}")

# 运行演示
# demonstrate_configuration_management()
```

### 13.1.2.2 动态配置更新

```python
# 动态配置更新系统
import time
import threading
from typing import Dict, List, Any, Callable, Optional
from datetime import datetime, timedelta

class DynamicConfigUpdater:
    """动态配置更新器"""
    
    def __init__(self, config_store: ConfigurationStore):
        self.config_store = config_store
        self.update_callbacks = {}
        self.update_queue = []
        self.updating = False
        self.update_thread = None
    
    def register_update_callback(self, config_key: str, callback: Callable[[Any, Any], None]):
        """注册配置更新回调"""
        if config_key not in self.update_callbacks:
            self.update_callbacks[config_key] = []
        self.update_callbacks[config_key].append(callback)
        print(f"为配置项 {config_key} 注册更新回调")
    
    def schedule_config_update(self, key: str, value: Any, delay_seconds: int = 0):
        """调度配置更新"""
        update_item = {
            "key": key,
            "value": value,
            "scheduled_at": datetime.now() + timedelta(seconds=delay_seconds),
            "created_at": datetime.now()
        }
        
        self.update_queue.append(update_item)
        print(f"调度配置更新: {key} = {value} (延迟: {delay_seconds}秒)")
        
        if not self.updating:
            self._start_update_processor()
    
    def _start_update_processor(self):
        """启动更新处理器"""
        self.updating = True
        self.update_thread = threading.Thread(target=self._update_processor)
        self.update_thread.daemon = True
        self.update_thread.start()
    
    def _update_processor(self):
        """更新处理循环"""
        while self.updating:
            try:
                current_time = datetime.now()
                ready_updates = [
                    update for update in self.update_queue
                    if update["scheduled_at"] <= current_time
                ]
                
                for update in ready_updates:
                    self._apply_config_update(update)
                    self.update_queue.remove(update)
                
                if not self.update_queue:
                    self.updating = False
                
                time.sleep(1)
            except Exception as e:
                print(f"配置更新处理器出错: {e}")
    
    def _apply_config_update(self, update: Dict[str, Any]):
        """应用配置更新"""
        key = update["key"]
        new_value = update["value"]
        
        # 获取旧值
        old_value = self.config_store.get_config(key)
        
        # 更新配置
        self.config_store.set_config(key, new_value)
        
        # 调用更新回调
        if key in self.update_callbacks:
            for callback in self.update_callbacks[key]:
                try:
                    callback(old_value, new_value)
                except Exception as e:
                    print(f"配置更新回调执行失败: {e}")
    
    def cancel_scheduled_update(self, key: str) -> bool:
        """取消调度的更新"""
        cancelled_count = 0
        for update in self.update_queue[:]:  # 创建副本以避免修改列表时出错
            if update["key"] == key:
                self.update_queue.remove(update)
                cancelled_count += 1
        
        if cancelled_count > 0:
            print(f"取消了 {cancelled_count} 个 {key} 的调度更新")
            return True
        return False
    
    def get_pending_updates(self) -> List[Dict[str, Any]]:
        """获取待处理的更新"""
        return self.update_queue.copy()

class ConfigValidation:
    """配置验证"""
    
    def __init__(self):
        self.validators = {}
    
    def add_validator(self, config_key: str, validator: Callable[[Any], bool], 
                     error_message: str = ""):
        """添加配置验证器"""
        self.validators[config_key] = {
            "validator": validator,
            "error_message": error_message
        }
        print(f"为配置项 {config_key} 添加验证器")
    
    def validate_config(self, key: str, value: Any) -> Dict[str, Any]:
        """验证配置"""
        if key not in self.validators:
            return {"valid": True, "message": "无需验证"}
        
        validator_info = self.validators[key]
        try:
            is_valid = validator_info["validator"](value)
            return {
                "valid": is_valid,
                "message": "" if is_valid else validator_info["error_message"]
            }
        except Exception as e:
            return {
                "valid": False,
                "message": f"验证执行失败: {e}"
            }
    
    def validate_all_configs(self, config_store: ConfigurationStore) -> Dict[str, Any]:
        """验证所有配置"""
        results = {}
        for key in self.validators:
            value = config_store.get_config(key)
            if value is not None:
                results[key] = self.validate_config(key, value)
        return results

# 配置验证函数示例
def validate_max_file_size(value: int) -> bool:
    """验证最大文件大小"""
    return isinstance(value, int) and 0 < value <= 10737418240  # 最大10GB

def validate_max_connections(value: int) -> bool:
    """验证最大连接数"""
    return isinstance(value, int) and 0 < value <= 10000

def validate_encryption_flag(value: bool) -> bool:
    """验证加密标志"""
    return isinstance(value, bool)

# 使用示例
def on_max_file_size_change(old_value: int, new_value: int):
    """最大文件大小变更回调"""
    print(f"最大文件大小从 {old_value} 变更为 {new_value}")
    # 这里可以执行相关的系统调整操作

def demonstrate_dynamic_config():
    """演示动态配置更新"""
    # 创建配置存储和相关组件
    config_store = ConfigurationStore("动态配置存储")
    dynamic_updater = DynamicConfigUpdater(config_store)
    config_validator = ConfigValidation()
    
    # 添加配置项
    config_store.set_config("storage.max_file_size", 1073741824)  # 1GB
    config_store.set_config("network.max_connections", 1000)
    config_store.set_config("security.enable_encryption", True)
    
    # 添加验证器
    config_validator.add_validator(
        "storage.max_file_size",
        validate_max_file_size,
        "文件大小必须是1字节到10GB之间的整数"
    )
    
    config_validator.add_validator(
        "network.max_connections",
        validate_max_connections,
        "连接数必须是1到10000之间的整数"
    )
    
    config_validator.add_validator(
        "security.enable_encryption",
        validate_encryption_flag,
        "加密标志必须是布尔值"
    )
    
    # 验证配置
    validation_results = config_validator.validate_all_configs(config_store)
    print("配置验证结果:")
    for key, result in validation_results.items():
        status = "通过" if result["valid"] else "失败"
        print(f"  {key}: {status} - {result['message']}")
    
    # 注册更新回调
    dynamic_updater.register_update_callback(
        "storage.max_file_size",
        on_max_file_size_change
    )
    
    # 调度配置更新
    print("\n调度配置更新...")
    dynamic_updater.schedule_config_update(
        "storage.max_file_size",
        2147483648,  # 2GB
        delay_seconds=5
    )
    
    dynamic_updater.schedule_config_update(
        "network.max_connections",
        2000,
        delay_seconds=3
    )
    
    # 查看待处理更新
    pending_updates = dynamic_updater.get_pending_updates()
    print(f"待处理更新数量: {len(pending_updates)}")
    for update in pending_updates:
        print(f"  {update['key']}: {update['value']} (计划时间: {update['scheduled_at']})")
    
    # 等待更新完成
    print("等待更新完成...")
    time.sleep(10)
    
    # 检查更新后的配置
    new_max_file_size = config_store.get_config("storage.max_file_size")
    new_max_connections = config_store.get_config("network.max_connections")
    print(f"更新后的最大文件大小: {new_max_file_size}")
    print(f"更新后的最大连接数: {new_max_connections}")

# 运行演示
# demonstrate_dynamic_config()
```

## 13.1.3 权限控制系统实现

权限控制系统需要提供细粒度的访问控制，确保用户只能访问其被授权的资源和功能。

### 13.1.3.1 基于角色的访问控制(RBAC)

```python
# 权限控制系统
from typing import Dict, List, Set, Any, Optional
from datetime import datetime, timedelta
import hashlib
import secrets

class Permission:
    """权限"""
    
    def __init__(self, permission_id: str, name: str, description: str = ""):
        self.permission_id = permission_id
        self.name = name
        self.description = description
        self.created_at = datetime.now()

class Role:
    """角色"""
    
    def __init__(self, role_id: str, name: str, description: str = ""):
        self.role_id = role_id
        self.name = name
        self.description = description
        self.permissions: Set[str] = set()  # 权限ID集合
        self.created_at = datetime.now()
    
    def add_permission(self, permission_id: str):
        """添加权限"""
        self.permissions.add(permission_id)
    
    def remove_permission(self, permission_id: str):
        """移除权限"""
        self.permissions.discard(permission_id)
    
    def has_permission(self, permission_id: str) -> bool:
        """检查是否具有权限"""
        return permission_id in self.permissions

class User:
    """用户"""
    
    def __init__(self, user_id: str, username: str, email: str = ""):
        self.user_id = user_id
        self.username = username
        self.email = email
        self.roles: Set[str] = set()  # 角色ID集合
        self.direct_permissions: Set[str] = set()  # 直接分配的权限
        self.created_at = datetime.now()
        self.is_active = True
        self.last_login = None

class RBACManager:
    """RBAC管理器"""
    
    def __init__(self):
        self.permissions: Dict[str, Permission] = {}
        self.roles: Dict[str, Role] = {}
        self.users: Dict[str, User] = {}
        self.role_hierarchy: Dict[str, Set[str]] = {}  # 父角色 -> 子角色集合
    
    def create_permission(self, permission_id: str, name: str, description: str = "") -> bool:
        """创建权限"""
        if permission_id in self.permissions:
            print(f"权限 {permission_id} 已存在")
            return False
        
        self.permissions[permission_id] = Permission(permission_id, name, description)
        print(f"创建权限: {name} ({permission_id})")
        return True
    
    def create_role(self, role_id: str, name: str, description: str = "") -> bool:
        """创建角色"""
        if role_id in self.roles:
            print(f"角色 {role_id} 已存在")
            return False
        
        self.roles[role_id] = Role(role_id, name, description)
        print(f"创建角色: {name} ({role_id})")
        return True
    
    def create_user(self, user_id: str, username: str, email: str = "") -> bool:
        """创建用户"""
        if user_id in self.users:
            print(f"用户 {user_id} 已存在")
            return False
        
        self.users[user_id] = User(user_id, username, email)
        print(f"创建用户: {username} ({user_id})")
        return True
    
    def assign_permission_to_role(self, permission_id: str, role_id: str) -> bool:
        """为角色分配权限"""
        if permission_id not in self.permissions:
            print(f"权限 {permission_id} 不存在")
            return False
        
        if role_id not in self.roles:
            print(f"角色 {role_id} 不存在")
            return False
        
        self.roles[role_id].add_permission(permission_id)
        print(f"为角色 {role_id} 分配权限 {permission_id}")
        return True
    
    def assign_role_to_user(self, role_id: str, user_id: str) -> bool:
        """为用户分配角色"""
        if role_id not in self.roles:
            print(f"角色 {role_id} 不存在")
            return False
        
        if user_id not in self.users:
            print(f"用户 {user_id} 不存在")
            return False
        
        self.users[user_id].roles.add(role_id)
        print(f"为用户 {user_id} 分配角色 {role_id}")
        return True
    
    def add_direct_permission_to_user(self, permission_id: str, user_id: str) -> bool:
        """为用户直接分配权限"""
        if permission_id not in self.permissions:
            print(f"权限 {permission_id} 不存在")
            return False
        
        if user_id not in self.users:
            print(f"用户 {user_id} 不存在")
            return False
        
        self.users[user_id].direct_permissions.add(permission_id)
        print(f"为用户 {user_id} 直接分配权限 {permission_id}")
        return True
    
    def set_role_hierarchy(self, parent_role_id: str, child_role_id: str) -> bool:
        """设置角色层次关系"""
        if parent_role_id not in self.roles:
            print(f"父角色 {parent_role_id} 不存在")
            return False
        
        if child_role_id not in self.roles:
            print(f"子角色 {child_role_id} 不存在")
            return False
        
        if parent_role_id not in self.role_hierarchy:
            self.role_hierarchy[parent_role_id] = set()
        
        self.role_hierarchy[parent_role_id].add(child_role_id)
        print(f"设置角色层次: {parent_role_id} -> {child_role_id}")
        return True
    
    def get_user_permissions(self, user_id: str) -> Set[str]:
        """获取用户的所有权限"""
        if user_id not in self.users:
            return set()
        
        user = self.users[user_id]
        permissions = set(user.direct_permissions)
        
        # 获取用户角色的权限
        for role_id in user.roles:
            if role_id in self.roles:
                permissions.update(self.roles[role_id].permissions)
        
        # 获取继承角色的权限
        for role_id in user.roles:
            inherited_permissions = self._get_inherited_permissions(role_id)
            permissions.update(inherited_permissions)
        
        return permissions
    
    def _get_inherited_permissions(self, role_id: str) -> Set[str]:
        """获取继承的权限"""
        permissions = set()
        
        # 获取直接子角色
        child_roles = self.role_hierarchy.get(role_id, set())
        for child_role_id in child_roles:
            if child_role_id in self.roles:
                permissions.update(self.roles[child_role_id].permissions)
                # 递归获取子角色的继承权限
                permissions.update(self._get_inherited_permissions(child_role_id))
        
        return permissions
    
    def check_user_permission(self, user_id: str, permission_id: str) -> bool:
        """检查用户是否具有指定权限"""
        if user_id not in self.users:
            return False
        
        user_permissions = self.get_user_permissions(user_id)
        return permission_id in user_permissions
    
    def get_user_roles(self, user_id: str) -> List[Dict[str, Any]]:
        """获取用户的角色信息"""
        if user_id not in self.users:
            return []
        
        user = self.users[user_id]
        roles_info = []
        
        for role_id in user.roles:
            if role_id in self.roles:
                role = self.roles[role_id]
                roles_info.append({
                    "role_id": role.role_id,
                    "name": role.name,
                    "description": role.description,
                    "permissions": list(role.permissions)
                })
        
        return roles_info

class SessionManager:
    """会话管理器"""
    
    def __init__(self, rbac_manager: RBACManager):
        self.rbac_manager = rbac_manager
        self.sessions = {}
        self.session_timeout = timedelta(hours=8)  # 8小时会话超时
    
    def create_session(self, user_id: str) -> str:
        """创建会话"""
        if user_id not in self.rbac_manager.users:
            raise ValueError(f"用户 {user_id} 不存在")
        
        session_id = secrets.token_urlsafe(32)
        self.sessions[session_id] = {
            "user_id": user_id,
            "created_at": datetime.now(),
            "last_activity": datetime.now(),
            "permissions": self.rbac_manager.get_user_permissions(user_id)
        }
        
        # 更新用户最后登录时间
        self.rbac_manager.users[user_id].last_login = datetime.now()
        
        print(f"为用户 {user_id} 创建会话 {session_id[:8]}...")
        return session_id
    
    def validate_session(self, session_id: str) -> bool:
        """验证会话"""
        if session_id not in self.sessions:
            return False
        
        session = self.sessions[session_id]
        
        # 检查会话是否过期
        if datetime.now() - session["last_activity"] > self.session_timeout:
            del self.sessions[session_id]
            return False
        
        # 更新最后活动时间
        session["last_activity"] = datetime.now()
        return True
    
    def check_session_permission(self, session_id: str, permission_id: str) -> bool:
        """检查会话权限"""
        if not self.validate_session(session_id):
            return False
        
        session = self.sessions[session_id]
        return permission_id in session["permissions"]
    
    def get_session_user(self, session_id: str) -> Optional[str]:
        """获取会话用户"""
        if not self.validate_session(session_id):
            return None
        
        return self.sessions[session_id]["user_id"]
    
    def destroy_session(self, session_id: str) -> bool:
        """销毁会话"""
        if session_id in self.sessions:
            del self.sessions[session_id]
            print(f"会话 {session_id[:8]}... 已销毁")
            return True
        return False

# 使用示例
def demonstrate_rbac():
    """演示RBAC权限控制"""
    # 创建RBAC管理器
    rbac = RBACManager()
    
    # 创建权限
    rbac.create_permission("file.read", "读取文件", "允许读取文件内容")
    rbac.create_permission("file.write", "写入文件", "允许创建和修改文件")
    rbac.create_permission("file.delete", "删除文件", "允许删除文件")
    rbac.create_permission("user.manage", "管理用户", "允许管理用户账户")
    rbac.create_permission("system.configure", "系统配置", "允许修改系统配置")
    
    # 创建角色
    rbac.create_role("viewer", "查看者", "只能查看文件")
    rbac.create_role("editor", "编辑者", "可以编辑文件")
    rbac.create_role("admin", "管理员", "具有系统管理权限")
    
    # 为角色分配权限
    rbac.assign_permission_to_role("file.read", "viewer")
    
    rbac.assign_permission_to_role("file.read", "editor")
    rbac.assign_permission_to_role("file.write", "editor")
    
    rbac.assign_permission_to_role("file.read", "admin")
    rbac.assign_permission_to_role("file.write", "admin")
    rbac.assign_permission_to_role("file.delete", "admin")
    rbac.assign_permission_to_role("user.manage", "admin")
    rbac.assign_permission_to_role("system.configure", "admin")
    
    # 设置角色层次（admin继承editor，editor继承viewer）
    rbac.set_role_hierarchy("admin", "editor")
    rbac.set_role_hierarchy("editor", "viewer")
    
    # 创建用户
    rbac.create_user("user-001", "Alice", "alice@example.com")
    rbac.create_user("user-002", "Bob", "bob@example.com")
    rbac.create_user("user-003", "Charlie", "charlie@example.com")
    
    # 为用户分配角色
    rbac.assign_role_to_user("viewer", "user-001")
    rbac.assign_role_to_user("editor", "user-002")
    rbac.assign_role_to_user("admin", "user-003")
    
    # 为用户直接分配权限
    rbac.add_direct_permission_to_user("file.delete", "user-002")
    
    # 检查用户权限
    print("用户权限检查:")
    test_users = ["user-001", "user-002", "user-003"]
    test_permissions = ["file.read", "file.write", "file.delete", "user.manage"]
    
    for user_id in test_users:
        user = rbac.users[user_id]
        print(f"\n用户 {user.username} ({user_id}):")
        print(f"  角色: {list(user.roles)}")
        
        for perm in test_permissions:
            has_permission = rbac.check_user_permission(user_id, perm)
            print(f"    {perm}: {'允许' if has_permission else '拒绝'}")
    
    # 会话管理示例
    print("\n会话管理演示:")
    session_manager = SessionManager(rbac)
    
    # 创建会话
    session_id = session_manager.create_session("user-002")
    print(f"创建会话: {session_id[:8]}...")
    
    # 验证会话
    is_valid = session_manager.validate_session(session_id)
    print(f"会话有效性: {is_valid}")
    
    # 检查会话权限
    can_read = session_manager.check_session_permission(session_id, "file.read")
    can_write = session_manager.check_session_permission(session_id, "file.write")
    can_manage_users = session_manager.check_session_permission(session_id, "user.manage")
    
    print(f"会话具有读取权限: {can_read}")
    print(f"会话具有写入权限: {can_write}")
    print(f"会话具有用户管理权限: {can_manage_users}")
    
    # 获取会话用户
    session_user = session_manager.get_session_user(session_id)
    print(f"会话用户: {session_user}")

# 运行演示
# demonstrate_rbac()
```

通过建立完善的配置管理与权限控制系统，我们能够确保分布式文件存储平台的配置一致性和访问安全性，为系统的稳定运行和安全管理提供坚实的基础。